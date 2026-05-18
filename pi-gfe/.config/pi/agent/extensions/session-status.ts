/**
 * session-status — Pi extension for session status footer
 *
 * Renders a two-line custom footer:
 *   Line 1:  [model] provider tier 📁 dirname | 🌿 branch
 *   Line 2:  ████████░░ 80% | ↑23k ↓5k | $0.000 | ⏱ 5m 23s
 *
 * Token counts are color-coded:
 *   < 80k tokens: dim (smart zone)
 *   80k-100k: yellow (approaching dumb zone)
 *   > 100k: red (dumb zone - compact recommended)
 *
 * Also:
 *   - Fires cmux notify when Pi finishes a turn and is waiting for input,
 *     matching the same pane-ring behaviour as the opencode cmux-notify plugin.
 *   - Plays a macOS notification sound after each turn (when afplay is available).
 *
 * Commands:
 *   /exit  — alias for /quit
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Inline implementation — @earendil-works/pi-tui is not bundled with Pi.
// Strips ANSI escape sequences when measuring width so colored strings
// are truncated correctly (visible chars only, not escape bytes).
function truncateToWidth(str: string, width: number): string {
  let visible = 0;
  let result = "";
  let i = 0;
  while (i < str.length) {
    // Check for an ANSI escape sequence at position i
    const rest = str.slice(i);
    const m = rest.match(/^\x1b\[[0-9;]*m/);
    if (m) {
      result += m[0];
      i += m[0].length;
    } else {
      if (visible >= width) break;
      result += str[i];
      visible++;
      i++;
    }
  }
  return result;
}

const NOTIFICATION_SOUND = "/System/Library/Sounds/Submarine.aiff"; // swap to taste

export default function (pi: ExtensionAPI) {
  const sessionStart = Date.now();

  let footerTui: { requestRender(): void } | null = null;

  // Tier label from model-tiers extension (injected via pi.events)
  let tierLabel: string | undefined;

  // All render-time data is cached from event handlers so the render closure
  // never touches session-bound ctx directly (avoids stale-ctx throws in
  // --print mode when Pi invalidates the session ctx after the turn).
  let modelId = "no-model";
  let providerId = "no-provider";
  let cachedCwd = "";
  let cachedCost = 0;
  let cachedContextPct = 0;
  let cachedInputTokens = 0;
  let cachedOutputTokens = 0;
  let isActive = false;
  let sessionGen = 0;
  // False in --print / non-interactive mode. Suppresses footer, notifications,
  // and all async ctx access that would be stale after Pi disposes the session.
  let interactive = false;

  // ─── Cross-extension: receive tier label from model-tiers ──────────────────
  pi.events.on("model-tiers:change", (data: { label: string | undefined }) => {
    tierLabel = data.label;
    footerTui?.requestRender();
  });

  // ─── Model display name ────────────────────────────────────────────────────
  // Strips provider prefix from Bedrock ARNs (no-op for Copilot model IDs,
  // but kept for safety if model IDs ever include a dot-namespace prefix).

  function friendlyModel(id: string): string {
    // Strip leading pure-alpha dot-namespaced provider segments
    // e.g. "us.anthropic." or "deepseek." but NOT "v3." (has a digit — part of the model name)
    const segs = id.split(".");
    let i = 0;
    while (i < segs.length - 1 && /^[a-zA-Z]+$/.test(segs[i])) {
      i++;
    }
    const provider = i > 0 ? segs[i - 1] : "";
    const model = segs.slice(i).join(".");

    // If the remaining name starts with a bare version tag (v3, r1, etc.) the provider
    // name would be lost entirely — prepend it so "deepseek.v3.2" → "deepseek-v3.2".
    if (provider && /^[vr]\d/.test(model)) {
      return `${provider}-${model}`;
    }
    return model || id;
  }

  function friendlyProvider(id: string): string {
    switch (id) {
      case "github-copilot":
        return "copilot";
      case "amazon-bedrock":
        return "bedrock";
      case "openai-codex":
        return "codex";
      case "opencode-go":
        return "oc-go";
      default:
        return id || "unknown";
    }
  }

  // ─── cmux notifications ──────────────────────────────────────────────────
  // Mirrors opencode's cmux-notify plugin: ring the pane when Pi is idle.
  // Gated on CMUX_SOCKET_PATH so it is a no-op in any other terminal.

  async function cmuxNotify(title: string, body: string): Promise<void> {
    if (!process.env.CMUX_SOCKET_PATH) return;
    try {
      await pi.exec("cmux", ["notify", "--title", title, "--body", body], { timeout: 2000 });
    } catch {
      // cmux not reachable — silently ignore
    }
  }

  // ─── audio notifications ─────────────────────────────────────────────────
  // Fire-and-forget afplay call — never awaited so it never blocks the extension.
  // No-op on non-macOS or if afplay is unavailable.

  function audioNotify(): void {
    pi.exec("/usr/bin/afplay", [NOTIFICATION_SOUND], { timeout: 5000 }).catch(() => {});
  }

  // ─── Progress bar ────────────────────────────────────────────────────────

  function buildBar(pct: number): string {
    const filled = Math.min(10, Math.round(pct / 10));
    return "█".repeat(filled) + "░".repeat(10 - filled);
  }

  // ─── Footer setup ────────────────────────────────────────────────────────

  function setupFooter(ctx: Parameters<Parameters<ExtensionAPI["on"]>[1]>[1]): void {
    ctx.ui.setFooter((tui, theme, footerData) => {
      footerTui = tui;
      const unsubBranch = footerData.onBranchChange(() => tui.requestRender());

      return {
        dispose: () => {
          footerTui = null;
          unsubBranch();
        },
        invalidate() {},
        render(width: number): string[] {
          // Bail out if the session has already shut down — a pending TUI timer
          // can fire after ctx is invalidated, causing a stale-ctx throw.
          if (!isActive) return ["", ""];

          // ── Model + directory + branch (line 1) ──
          // All values are read from module-level cache — never from ctx —
          // so this closure stays safe after Pi invalidates the session ctx.
          const model = friendlyModel(modelId);
          const provider = friendlyProvider(providerId);
          const dirName = cachedCwd.split("/").pop() || cachedCwd;
          const branch = footerData.getGitBranch();
          const branchStr = branch ? theme.fg("dim", ` | 🌿 ${branch}`) : "";
          const providerStr = theme.fg("muted", ` ${provider}`);
          const tierStr = tierLabel ? " " + theme.fg("accent", tierLabel) : "";
          const line1 =
            theme.fg("accent", `[${model}]`) +
            providerStr +
            tierStr +
            theme.fg("dim", ` 📁 ${dirName}`) +
            branchStr;

          // ── Cost + context pct + tokens — updated by agent_end, never via ctx ──
          const totalCost = cachedCost;
          const pct = cachedContextPct;
          const totalTokens = cachedInputTokens + cachedOutputTokens;

          // ── Format token counts with k suffix ──
          const fmt = (n: number) => (n < 1000 ? `${n}` : `${(n / 1000).toFixed(1)}k`);

          // ── Color code tokens based on total ──
          let tokenColor: "dim" | "warning" | "error";
          if (totalTokens > 100_000) {
            tokenColor = "error";
          } else if (totalTokens >= 80_000) {
            tokenColor = "warning";
          } else {
            tokenColor = "dim";
          }

          const tokenStats = theme.fg(tokenColor, `↑${fmt(cachedInputTokens)} ↓${fmt(cachedOutputTokens)}`);

          // ── Session duration ──
          const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
          const hours = Math.floor(elapsed / 3600);
          const mins = Math.floor((elapsed % 3600) / 60);
          const secs = elapsed % 60;

          // ── Context bar with color ──
          const bar = buildBar(pct);
          const barColored =
            pct >= 90
              ? theme.fg("error", bar)
              : pct >= 70
                ? theme.fg("warning", bar)
                : theme.fg("success", bar);

          // ── Assemble line 2 ──
          const sep = theme.fg("dim", " | ");
          const parts: string[] = [
            `${barColored} ${pct}%`,
            tokenStats,
            theme.fg("muted", `$${totalCost.toFixed(3)}`),
            theme.fg("dim", `⏱ ${hours > 0 ? `${hours}h ` : ""}${mins}m ${secs < 10 ? "0" : ""}${secs}s`),
          ];
          const line2 = parts.join(sep);

          return [truncateToWidth(line1, width), truncateToWidth(line2, width)];
        },
      };
    });
  }

  // ─── /exit alias for /quit ─────────────────────────────────────────────────

  pi.registerCommand("exit", {
    description: "Exit pi (alias for /quit)",
    handler: async (_args, ctx) => {
      ctx.shutdown();
    },
  });

  pi.on("session_start", async (event, ctx) => {
    isActive = true;
    const myGen = ++sessionGen;
    modelId = ctx.model?.id ?? "no-model";
    providerId = ctx.model?.provider ?? "no-provider";
    interactive = ctx.hasUI;

    // Non-interactive (--print) mode: no TUI, no footer, no notifications.
    // Skip all async ctx usage to avoid stale-ctx throws after Pi disposes.
    if (!interactive) return;

    cachedCwd = ctx.cwd;
    cachedCost = 0;
    cachedContextPct = 0;
    cachedInputTokens = 0;
    cachedOutputTokens = 0;
    // Set up footer synchronously before any await so ctx is never stale.
    setupFooter(ctx);
  });

  // Accumulate cost and tokens incrementally from message_end so agent_end never needs ctx.
  pi.on("message_end", async (event) => {
    if (event.message.role === "assistant") {
      const usage = (event.message as any).usage;
      cachedCost += usage?.cost?.total ?? 0;
      cachedInputTokens += usage?.input ?? 0;
      cachedOutputTokens += usage?.output ?? 0;
    }
  });

  // Cache context% after each turn while ctx is guaranteed live.
  pi.on("turn_end", async (_event, ctx) => {
    try {
      const usage = ctx.getContextUsage();
      if (usage?.percent != null) cachedContextPct = Math.min(100, Math.round(usage.percent));
    } catch {
      // ctx stale in --print mode — keep last cached value
    }
  });

  // agent_end: no ctx needed — all data already cached above.
  pi.on("agent_end", async () => {
    if (!interactive) return;
    footerTui?.requestRender();
    await cmuxNotify("Pi", "Waiting for input");
    audioNotify();
  });

  // Update cached model ID and re-render footer when model changes
  pi.on("model_select", async (event) => {
    modelId = event.model.id;
    providerId = event.model.provider;
    footerTui?.requestRender();
  });

  pi.on("session_shutdown", async () => {
    isActive = false;
    footerTui = null;
  });
}
