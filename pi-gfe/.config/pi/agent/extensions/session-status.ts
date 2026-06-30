/**
 * session-status — Pi extension for session status footer
 *
 * Renders a two-line custom footer:
 *   Line 1:  [model] provider tier 📁 dirname | 🌿 branch
 *   Line 2:  ████████░░ 80% | 45.2k tok | $0.000 | ⏱ 5m 23s
 *
 * Token count shows current context window size (from ctx.getContextUsage()).
 * Color-coded based on smart zone / dumb zone thresholds:
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

import { createBashTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

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

// Sentinel appended to every bash command so we can detect the working directory
// after the command runs (e.g. after `wt switch` changes the worktree).
// Must be stripped from the result before the LLM sees it.
const CWD_MARKER = "###PI_CWD###:";

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
  // Our own branch cache — updated whenever the cwd changes via bash tool
  // (e.g. `wt switch`).  Overrides footerData.getGitBranch() in render().
  let cachedBranch: string | null | undefined = undefined; // undefined = not yet read
  let cachedCost = 0;
  let cachedContextPct = 0;
  let cachedContextTokens = 0;
  let isActive = false;
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
      case "gsai":
        return "usai";
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

  // ─── Branch helper ───────────────────────────────────────────────────────
  // Read current git branch for a given directory, updating the module-level
  // cache. Silently falls back to null (not in a repo / git not available).

  async function refreshBranch(cwd: string): Promise<void> {
    try {
      const result = await pi.exec("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd, timeout: 3000 });
      cachedBranch = result.code === 0 ? result.stdout.trim() : null;
    } catch {
      cachedBranch = null;
    }
    footerTui?.requestRender();
  }

  // ─── Bash tool override ───────────────────────────────────────────────────
  // Replaces the built-in bash tool with a spawnHook-wrapped version that
  // appends a cwd marker after each command. The marker is stripped before the
  // result reaches the LLM. When the marker shows a new directory (e.g. after
  // `wt switch`), we update cachedCwd and re-read the git branch.

  function registerBashTool(sessionCwd: string): void {
    const bashTool = createBashTool(sessionCwd, {
      spawnHook: ({ command, cwd: spawnCwd, env }) => ({
        // Wrap in a subshell so `exit` inside the original command is still
        // captured correctly. The marker is printed after the command finishes,
        // regardless of exit code, and the original exit code is forwarded.
        command: `{ ${command}\n}; __pi_exit=$?; echo "${CWD_MARKER}$(pwd)"; exit $__pi_exit`,
        cwd: spawnCwd,
        env,
      }),
    });

    pi.registerTool({
      ...bashTool,
      execute: async (toolCallId, params, signal, onUpdate, _ctx) => {
        const result = await bashTool.execute(toolCallId, params, signal, onUpdate);

        // Strip the cwd marker from the result content so the LLM never sees it.
        let detectedCwd: string | undefined;
        const cleanedContent = result.content.map((block) => {
          if (block.type !== "text") return block;
          const markerIdx = block.text.lastIndexOf(CWD_MARKER);
          if (markerIdx === -1) return block;
          const afterMarker = block.text.slice(markerIdx + CWD_MARKER.length);
          const newline = afterMarker.indexOf("\n");
          detectedCwd = (newline === -1 ? afterMarker : afterMarker.slice(0, newline)).trim();
          // Remove the marker line entirely (including leading newline).
          const cleaned = block.text.slice(0, markerIdx).replace(/\n$/, "");
          return { ...block, text: cleaned };
        });

        // If the directory changed, update caches and re-render the footer.
        if (detectedCwd && detectedCwd !== cachedCwd) {
          cachedCwd = detectedCwd;
          // Fire-and-forget: read the new branch asynchronously.
          void refreshBranch(detectedCwd);
        }

        return { ...result, content: cleanedContent };
      },
    });
  }

  // ─── Footer setup ────────────────────────────────────────────────────────

  function setupFooter(ctx: Parameters<Parameters<ExtensionAPI["on"]>[1]>[1]): void {
    ctx.ui.setFooter((tui, theme, footerData) => {
      footerTui = tui;
      const unsubBranch = footerData.onBranchChange(() => tui.requestRender());

      // Tick every second so the elapsed timer stays live and branch/cwd stay
      // fresh even when pi is idle (no turns, no git watcher events).
      const tickInterval = setInterval(() => tui.requestRender(), 1000);

      return {
        dispose: () => {
          footerTui = null;
          unsubBranch();
          clearInterval(tickInterval);
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
          // Prefer our own cachedBranch (kept up-to-date after wt/cd/git calls)
          // over footerData.getGitBranch() which is fixed to the session's
          // original cwd and won't update when the worktree changes mid-session.
          const branch = cachedBranch !== undefined ? cachedBranch : footerData.getGitBranch();
          const branchStr = branch ? theme.fg("dim", ` | 🌿 ${branch}`) : "";
          const providerStr = theme.fg("muted", ` ${provider}`);
          const tierStr = tierLabel ? " " + theme.fg("accent", tierLabel) : "";
          const line1 =
            theme.fg("accent", `[${model}]`) +
            providerStr +
            tierStr +
            theme.fg("dim", ` 📁 ${dirName}`) +
            branchStr;

          // ── Cost + context pct + tokens — updated by turn_end, never via ctx ──
          const totalCost = cachedCost;
          const pct = cachedContextPct;
          const totalTokens = cachedContextTokens;

          // ── Format token count with k suffix ──
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

          const tokenStats = theme.fg(tokenColor, `${fmt(totalTokens)} tok`);

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
    modelId = ctx.model?.id ?? "no-model";
    providerId = ctx.model?.provider ?? "no-provider";
    interactive = ctx.hasUI;

    // Non-interactive (--print) mode: no TUI, no footer, no notifications.
    // Skip all async ctx usage to avoid stale-ctx throws after Pi disposes.
    if (!interactive) return;

    // Update cached values for the new/resumed session.
    // cachedCwd must be refreshed here because the footer render closure reads it
    // as a module-level variable (footerData does not expose getCwd).
    cachedCwd = ctx.cwd;
    // Reset per-session stats only for fresh starts (not reload, which keeps history).
    if (event.reason !== "reload") {
      cachedCost = 0;
      cachedContextPct = 0;
      cachedContextTokens = 0;
    }
    // Reset branch cache so the next render reads the live value.
    cachedBranch = undefined;
    // Register the bash tool override BEFORE setting up the footer so that the
    // tool is ready as soon as the session becomes interactive.
    registerBashTool(ctx.cwd);
    // Seed the branch cache asynchronously — don't await so we don't delay
    // the synchronous footer setup below.
    void refreshBranch(ctx.cwd);
    // Set up footer synchronously before any await so ctx is never stale.
    setupFooter(ctx);
  });

  // Accumulate cost incrementally from message_end so agent_end never needs ctx.
  pi.on("message_end", async (event) => {
    if (event.message.role === "assistant") {
      const usage = (event.message as any).usage;
      cachedCost += usage?.cost?.total ?? 0;
    }
  });

  // Cache context% and tokens after each turn while ctx is guaranteed live.
  pi.on("turn_end", async (_event, ctx) => {
    try {
      const usage = ctx.getContextUsage();
      if (usage?.percent != null) cachedContextPct = Math.min(100, Math.round(usage.percent));
      if (usage?.tokens != null) cachedContextTokens = usage.tokens;
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
