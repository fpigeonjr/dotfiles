/**
 * flexion-aws-status — Pi extension for Flexion Bedrock session status
 *
 * Renders a two-line custom footer matching the Claude Code statusline:
 *   Line 1:  [model] 📁 dirname | 🌿 branch
 *   Line 2:  ████████░░ 80% | $0.05 | ⏱ 5m 23s | 🔐 AWS: expires at 4:15 PM EDT
 *
 * Also:
 *   - Warns on session_start if AWS credentials are expired or expiring soon.
 *   - Fires cmux notify when Pi finishes a turn and is waiting for input,
 *     matching the same pane-ring behaviour as the opencode cmux-notify plugin.
 *
 * Commands:
 *   /reauth  — re-authenticate AWS SSO in-place (opens browser, updates process.env)
 *   /exit    — alias for /quit
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { truncateToWidth } from "@mariozechner/pi-tui";

const PROFILE = "ClaudeCodeAccess-FlexionLLM";
const AWS_CACHE_MS = 5 * 60 * 1000; // refresh expiry every 5 minutes
const NOTIFICATION_SOUND = "/System/Library/Sounds/Submarine.aiff"; // swap to taste

export default function (pi: ExtensionAPI) {
  const sessionStart = Date.now();

  // Cached AWS expiry — updated async, read sync in footer render
  let awsExpiresAt: Date | null = null;
  let awsLastCheck = 0;
  let footerTui: { requestRender(): void } | null = null;

  // Tier label from model-tiers extension (injected via pi.events)
  let tierLabel: string | undefined;

  // All render-time data is cached from event handlers so the render closure
  // never touches session-bound ctx directly (avoids stale-ctx throws in
  // --print mode when Pi invalidates the session ctx after the turn).
  let modelId = "no-model";
  let cachedCwd = "";
  let cachedCost = 0;
  let cachedContextPct = 0;
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

  // ─── AWS credential helpers ──────────────────────────────────────────────

  async function refreshAws(): Promise<void> {
    const now = Date.now();
    if (now - awsLastCheck < AWS_CACHE_MS) return;
    awsLastCheck = now;
    try {
      const result = await pi.exec(
        "aws",
        ["configure", "export-credentials", "--profile", PROFILE, "--format", "process"],
        { timeout: 3000 }
      );
      if (result.code === 0 && result.stdout.trim()) {
        const creds = JSON.parse(result.stdout) as { Expiration?: string };
        awsExpiresAt = creds.Expiration ? new Date(creds.Expiration) : null;
      } else {
        awsExpiresAt = null;
      }
    } catch {
      awsExpiresAt = null;
    }
    footerTui?.requestRender();
  }

  function awsStatusText(theme: ReturnType<typeof Object.create>): string {
    if (!awsExpiresAt) return "";
    const remaining = (awsExpiresAt.getTime() - Date.now()) / 1000;
    const timeStr = awsExpiresAt.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
    if (remaining < 0) return theme.fg("error", `🔐 AWS: expired at ${timeStr}`);
    if (remaining < 1800) return theme.fg("warning", `🔐 AWS: expires at ${timeStr}`);
    return theme.fg("success", `🔐 AWS: expires at ${timeStr}`);
  }

  // ─── Model display name ────────────────────────────────────────────────────
  // Strips provider prefix from Bedrock ARNs:
  //   us.anthropic.claude-sonnet-4-6  →  claude-sonnet-4-6
  //   us.meta.llama4-scout-17b        →  llama4-scout-17b
  //   claude-sonnet-4-6               →  unchanged

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
    // name would be lost entirely — prepend it so "deepseek.v3.2" → "deepseek-v3.2"
    // and "deepseek.r1-v1:0" → "deepseek-r1-v1:0" rather than just "v3.2" / "r1-v1:0".
    if (provider && /^[vr]\d/.test(model)) {
      return `${provider}-${model}`;
    }
    return model || id;
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
          const dirName = cachedCwd.split("/").pop() || cachedCwd;
          const branch = footerData.getGitBranch();
          const branchStr = branch ? theme.fg("dim", ` | 🌿 ${branch}`) : "";
          const tierStr = tierLabel ? " " + theme.fg("accent", tierLabel) : "";
          const line1 =
            theme.fg("accent", `[${model}]`) +
            tierStr +
            theme.fg("dim", ` 📁 ${dirName}`) +
            branchStr;

          // ── Cost + context pct — updated by agent_end, never via ctx ──
          const totalCost = cachedCost;
          const pct = cachedContextPct;

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

          // ── AWS expiry (use live remaining, cached expiresAt) ──
          const awsStr = awsStatusText(theme);

          // ── Assemble line 2 ──
          const sep = theme.fg("dim", " | ");
          const parts: string[] = [
            `${barColored} ${pct}%`,
            theme.fg("muted", `$${totalCost.toFixed(3)}`),
            theme.fg("dim", `⏱ ${hours > 0 ? `${hours}h ` : ""}${mins}m ${secs < 10 ? "0" : ""}${secs}s`),
          ];
          if (awsStr) parts.push(awsStr);
          const line2 = parts.join(sep);

          return [truncateToWidth(line1, width), truncateToWidth(line2, width)];
        },
      };
    });
  }

  // ─── Events ─────────────────────────────────────────────────────────────

  // ─── /reauth — re-authenticate AWS SSO without leaving Pi ──────────────────
  // Opens the browser SSO flow, then exports fresh credentials into process.env
  // so the Bedrock SDK picks them up without restarting Pi.

  pi.registerCommand("reauth", {
    description: "Re-authenticate AWS SSO credentials without leaving Pi",
    handler: async (_args, ctx) => {
      ctx.ui.notify("🔐 Opening AWS SSO login in your browser...", "info");

      // Step 1: SSO login — opens browser automatically on macOS, waits for completion.
      const loginResult = await pi.exec(
        "aws",
        ["sso", "login", "--profile", PROFILE],
        { timeout: 5 * 60 * 1000 }
      );

      if (loginResult.code !== 0 || loginResult.killed) {
        ctx.ui.notify(
          `❌ AWS SSO login failed: ${loginResult.stderr.trim() || "timed out"}`,
          "error"
        );
        return;
      }

      // Step 2: Export fresh credentials as JSON (includes Expiration field).
      const credsResult = await pi.exec(
        "aws",
        ["configure", "export-credentials", "--profile", PROFILE, "--format", "process"],
        { timeout: 10000 }
      );

      if (credsResult.code !== 0 || !credsResult.stdout.trim()) {
        ctx.ui.notify("❌ Failed to export credentials after login", "error");
        return;
      }

      let creds: { AccessKeyId: string; SecretAccessKey: string; SessionToken?: string; Expiration?: string };
      try {
        creds = JSON.parse(credsResult.stdout);
      } catch {
        ctx.ui.notify("❌ Could not parse credential response", "error");
        return;
      }

      // Step 3: Update process.env — AWS SDK reads these lazily so Bedrock
      // picks up the new creds on the very next request.
      process.env.AWS_ACCESS_KEY_ID = creds.AccessKeyId;
      process.env.AWS_SECRET_ACCESS_KEY = creds.SecretAccessKey;
      if (creds.SessionToken) process.env.AWS_SESSION_TOKEN = creds.SessionToken;

      // Step 4: Update cached expiry and refresh footer.
      awsExpiresAt = creds.Expiration ? new Date(creds.Expiration) : null;
      awsLastCheck = Date.now();
      footerTui?.requestRender();

      const expiryStr = awsExpiresAt
        ? awsExpiresAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZoneName: "short" })
        : "unknown";
      ctx.ui.notify(`✅ AWS credentials refreshed — expires at ${expiryStr}`, "success");
    },
  });

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
    interactive = ctx.hasUI;

    // Non-interactive (--print) mode: no TUI, no footer, no notifications.
    // Skip all async ctx usage to avoid stale-ctx throws after Pi disposes.
    if (!interactive) return;

    cachedCwd = ctx.cwd;
    cachedCost = 0;
    cachedContextPct = 0;
    // Set up footer synchronously before any await so ctx is never
    // accessed after a potential session replacement during refreshAws().
    setupFooter(ctx);
    await refreshAws();

    // Guard: bail if a newer session has started while refreshAws() was awaiting.
    // Using a generation counter rather than isActive because the new session
    // resets isActive=true before this continuation resumes.
    if (sessionGen !== myGen) return;

    // Warn if credentials are expired or expiring within 30 min
    if (awsExpiresAt) {
      const remaining = (awsExpiresAt.getTime() - Date.now()) / 1000;
      if (remaining < 0) {
        ctx.ui.notify(
          "⚠️ AWS credentials have expired. Re-run flexion-pi to refresh.",
          "error"
        );
      } else if (remaining < 1800) {
        const mins = Math.floor(remaining / 60);
        ctx.ui.notify(
          `⚠️ AWS credentials expire in ${mins} minutes. Consider re-running flexion-pi.`,
          "warning"
        );
      }
    }
  });

  // Refresh AWS expiry, update cached cost+context, re-render footer, and notify after each turn.
  // Accumulate cost incrementally from message_end so agent_end never needs ctx.
  pi.on("message_end", async (event) => {
    if (event.message.role === "assistant") {
      cachedCost += (event.message as any).usage?.cost?.total ?? 0;
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
    await refreshAws();
    footerTui?.requestRender();
    await cmuxNotify("Pi", "Waiting for input");
    audioNotify();
  });

  // Update cached model ID and re-render footer when model changes
  pi.on("model_select", async (event) => {
    modelId = event.model.id;
    footerTui?.requestRender();
  });

  pi.on("session_shutdown", async () => {
    isActive = false;
    footerTui = null;
  });
}
