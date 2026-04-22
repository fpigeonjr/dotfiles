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
 * Placed in ~/.config/pi/agent/extensions/ (auto-discovered via PI_CODING_AGENT_DIR).
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { AssistantMessage } from "@mariozechner/pi-ai";
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
    return id.replace(/^(\w[\w-]*\.)+/, "") || id;
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
          // ── Model + directory + branch (line 1) ──
          const model = friendlyModel(ctx.model?.id ?? "no-model");
          const dirName = ctx.cwd.split("/").pop() || ctx.cwd;
          const branch = footerData.getGitBranch();
          const branchStr = branch ? theme.fg("dim", ` | 🌿 ${branch}`) : "";
          const line1 =
            theme.fg("accent", `[${model}]`) +
            theme.fg("dim", ` 📁 ${dirName}`) +
            branchStr;

          // ── Cost from session branch ──
          let totalCost = 0;
          for (const entry of ctx.sessionManager.getBranch()) {
            if (entry.type === "message" && entry.message.role === "assistant") {
              const m = entry.message as AssistantMessage;
              totalCost += m.usage?.cost?.total ?? 0;
            }
          }

          // ── Context usage ──
          const usage = ctx.getContextUsage();
          const pct = usage
            ? Math.min(100, Math.round((usage.tokens / usage.contextWindow) * 100))
            : 0;

          // ── Session duration ──
          const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
          const mins = Math.floor(elapsed / 60);
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
            theme.fg("dim", `⏱ ${mins}m ${secs < 10 ? "0" : ""}${secs}s`),
          ];
          if (awsStr) parts.push(awsStr);
          const line2 = parts.join(sep);

          return [truncateToWidth(line1, width), truncateToWidth(line2, width)];
        },
      };
    });
  }

  // ─── Events ─────────────────────────────────────────────────────────────

  pi.on("session_start", async (_event, ctx) => {
    await refreshAws();
    setupFooter(ctx);

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

  // Refresh AWS expiry, re-render footer, ring cmux pane, and play audio after each agent turn
  pi.on("agent_end", async (_event) => {
    await refreshAws();
    footerTui?.requestRender();
    await cmuxNotify("Pi", "Waiting for input");
    audioNotify();
  });

  // Update footer when model changes
  pi.on("model_select", async (_event) => {
    footerTui?.requestRender();
  });

  pi.on("session_shutdown", async () => {
    footerTui = null;
  });
}
