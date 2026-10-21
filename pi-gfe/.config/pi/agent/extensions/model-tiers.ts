/**
 * model-tiers — Pi extension for tiered model selection (GFE / GitHub Copilot)
 *
 * Registers provider family commands that each scope Ctrl+P to a
 * three-model instant → thinking → pro ladder. /a, /g, /o, and /c use GitHub
 * Copilot; /u and /n use USAi.
 *
 *   /a   Anthropic via Copilot   haiku-4.5 → sonnet-5.5 → opus-5.5
 *   /g   Google via Copilot      gemini-3.6-flash → gemini-3.7-flash → gemini-3.7-flash
 *   /o   OpenAI via Copilot      gpt-6-luna → gpt-6-sol → gpt-6.1-sol
 *   /c   GFE Copilot (mixed)     gpt-5-mini → gpt-5.3-codex → claude-opus-4.8
 *   /u   USAi (Claude)           claude-haiku-4.5 → claude-sonnet-5.5 → claude-opus-5
 *   /n   USAi (GPT)              gpt-5.6-luna → gpt-5.6-sol → gpt-6-astra
 *
 * Usage:
 *   /u              → switches to instant tier for USAi Claude, scopes Ctrl+P
 *   /u thinking     → jumps directly to thinking tier
 *   Ctrl+P          → advance to next tier within active family
 *   Shift+Ctrl+P    → back to previous tier within active family
 *   /tiers          → toggle compact tier table (never truncates)
 *
 * Cold-start default: activates n·instant (gpt-5.6-luna via USAi) so
 * Ctrl+P always works without typing a command first.
 *
 * Footer shows active family and tier, e.g. "n·instant" (via pi.events
 * cross-extension comms with copilot-status).
 *
 * Note on thinking levels:
 *   - claude-sonnet-5.5 and claude-opus-5.5 support xhigh thinking.
 *   - gpt-6-sol and gpt-6.1-sol support xhigh thinking.
 *   - Gemini models via Copilot do not expose reasoning effort — all off.
 *   - USAi models do not expose reasoning effort — all off (/u and /n).
 *
 * State persists across session resume/fork via pi.appendEntry().
 * Selecting a model via /model (Ctrl+L) clears family tracking.
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";

type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
type TierName = "instant" | "thinking" | "pro";

interface Tier {
  name: TierName;
  model: string;
  thinking: ThinkingLevel;
  short: string; // compact label for /tiers widget
}

interface Family {
  label: string;
  provider: string;
  providerName?: string;
  tiers: [Tier, Tier, Tier];
}

interface PersistedState {
  family: string;
  index: number;
}

const TIER_NAMES: TierName[] = ["instant", "thinking", "pro"];

const FAMILIES: Record<string, Family> = {
  a: {
    label: "a",
    provider: "github-copilot",
    tiers: [
      {
        name: "instant",
        model: "claude-haiku-4.5",
        thinking: "off",
        short: "haiku-4.5",
      },
      {
        name: "thinking",
        model: "claude-sonnet-5.5",
        thinking: "xhigh",
        short: "sonnet-5.5",
      },
      {
        name: "pro",
        model: "claude-opus-5.5",
        thinking: "xhigh",
        short: "opus-5.5",
      },
    ],
  },
  g: {
    label: "g",
    provider: "github-copilot",
    tiers: [
      {
        name: "instant",
        model: "gemini-3.6-flash",
        thinking: "off",
        short: "g3.6-flash",
      },
      {
        name: "thinking",
        model: "gemini-3.7-flash",
        thinking: "off",
        short: "g3.7-flash",
      },
      {
        name: "pro",
        model: "gemini-3.7-flash",
        thinking: "off",
        short: "g3.7-flash",
      },
    ],
  },
  o: {
    label: "o",
    provider: "github-copilot",
    tiers: [
      {
        name: "instant",
        model: "gpt-6-luna",
        thinking: "off",
        short: "6-luna",
      },
      {
        name: "thinking",
        model: "gpt-6-sol",
        thinking: "xhigh",
        short: "6-sol",
      },
      {
        name: "pro",
        model: "gpt-6.1-sol",
        thinking: "xhigh",
        short: "6.1-sol",
      },
    ],
  },
  c: {
    label: "c",
    provider: "github-copilot",
    tiers: [
      {
        name: "instant",
        model: "gpt-5-mini",
        thinking: "off",
        short: "5-mini",
      },
      {
        name: "thinking",
        model: "gpt-5.3-codex",
        thinking: "off",
        short: "5.3-codex",
      },
      {
        name: "pro",
        model: "claude-opus-4.8",
        thinking: "off",
        short: "opus-4.8",
      },
    ],
  },
  u: {
    label: "u",
    provider: "usai",
    providerName: "USAi",
    tiers: [
      {
        name: "instant",
        model: "claude_4_5_haiku",
        thinking: "off",
        short: "haiku-4.5",
      },
      {
        name: "thinking",
        model: "claude-sonnet-5.5",
        thinking: "off",
        short: "sonnet-5.5",
      },
      { name: "pro", model: "claude-opus-5", thinking: "off", short: "opus-5" },
    ],
  },
  // USAi OpenAI stack. USAi does not expose reasoning effort, so all tiers
  // run off; GPT-6 Astra is the currently callable GPT-6 deployment.
  n: {
    label: "n",
    provider: "usai",
    providerName: "USAi",
    tiers: [
      {
        name: "instant",
        model: "gpt-5.6-luna",
        thinking: "off",
        short: "5.6-luna",
      },
      {
        name: "thinking",
        model: "gpt-5.6-sol-latest-guardrails-defaultv2",
        thinking: "off",
        short: "5.6-sol",
      },
      {
        name: "pro",
        model: "gpt-6-astra",
        thinking: "off",
        short: "6-astra",
      },
    ],
  },
};

export default function (pi: ExtensionAPI) {
  let activeFamily: string | undefined;
  let tierIndex = 0;
  // Guard: suppress model_select handler when we triggered the change
  let _ownSwitch = false;
  // Track /tiers widget visibility
  let tiersWidgetVisible = false;

  // ─── Status bar ────────────────────────────────────────────────────────────

  function updateStatus(ctx: ExtensionContext): void {
    if (!activeFamily) {
      ctx.ui.setStatus("model-tiers", undefined);
      pi.events.emit("model-tiers:change", { label: undefined });
      return;
    }
    const tier = FAMILIES[activeFamily].tiers[tierIndex];
    const label = `${activeFamily}·${tier.name}`;
    // setStatus targets the default footer; emit covers the custom copilot footer.
    ctx.ui.setStatus("model-tiers", ctx.ui.theme.fg("accent", label));
    pi.events.emit("model-tiers:change", { label });
  }

  // ─── Core switcher ─────────────────────────────────────────────────────────

  async function activateTier(
    familyKey: string,
    index: number,
    ctx: ExtensionContext,
  ): Promise<void> {
    const family = FAMILIES[familyKey];
    const tier = family.tiers[index];

    const model = ctx.modelRegistry.find(family.provider, tier.model);
    if (!model) {
      ctx.ui.notify(
        `model-tiers: not found — ${family.provider}/${tier.model}`,
        "error",
      );
      return;
    }

    _ownSwitch = true;
    try {
      const ok = await pi.setModel(model);
      if (!ok) {
        ctx.ui.notify(
          `model-tiers: no auth for ${family.provider}/${tier.model}`,
          "error",
        );
        return;
      }
      // setThinkingLevel drives the editor border color natively.
      pi.setThinkingLevel(tier.thinking);
    } finally {
      _ownSwitch = false;
    }

    activeFamily = familyKey;
    tierIndex = index;
    updateStatus(ctx);
  }

  // ─── Commands ──────────────────────────────────────────────────────────────

  for (const key of Object.keys(FAMILIES)) {
    const family = FAMILIES[key];
    const displayProvider =
      family.providerName ??
      (family.provider === "usai" ? "USAi" : family.provider);

    pi.registerCommand(key, {
      description: `${displayProvider} tier stack — instant / thinking / pro`,
      getArgumentCompletions: () =>
        TIER_NAMES.map((t) => ({ value: t, label: t })),
      handler: async (args, ctx) => {
        const arg = args?.trim().toLowerCase() as TierName | undefined;
        const index = arg ? TIER_NAMES.indexOf(arg) : 0;
        if (arg && index === -1) {
          ctx.ui.notify(
            `model-tiers: unknown tier "${arg}" — use instant, thinking, or pro`,
            "error",
          );
          return;
        }
        await activateTier(key, index, ctx);
      },
    });
  }

  // ─── /tiers — compact toggle widget (4 lines, never truncates) ─────────────

  pi.registerCommand("tiers", {
    description: "Show all tier stacks (toggle)",
    handler: async (_args, ctx) => {
      if (tiersWidgetVisible) {
        ctx.ui.setWidget("model-tiers-table", undefined);
        tiersWidgetVisible = false;
        return;
      }

      const { theme } = ctx.ui;
      const rows = Object.entries(FAMILIES).map(([key, family]) => {
        const isActiveFamily = key === activeFamily;
        const prefix = isActiveFamily ? theme.fg("accent", "▶") : " ";
        const slash = isActiveFamily
          ? theme.fg("accent", `/${key}`)
          : theme.fg("muted", `/${key}`);
        const tierLabels = family.tiers
          .map((t, i) =>
            isActiveFamily && i === tierIndex
              ? theme.fg("accent", `[${t.short}]`)
              : theme.fg("dim", t.short),
          )
          .join(theme.fg("dim", " / "));
        const provider = theme.fg(
          "dim",
          family.providerName ??
            (family.provider === "usai" ? "usai" : family.provider),
        );
        return `${prefix} ${slash}  ${tierLabels}  ${provider}`;
      });

      ctx.ui.setWidget("model-tiers-table", rows);
      tiersWidgetVisible = true;
    },
  });

  // Auto-clear /tiers widget when the user sends a message
  pi.on("agent_start", async (_event, ctx) => {
    if (tiersWidgetVisible) {
      ctx.ui.setWidget("model-tiers-table", undefined);
      tiersWidgetVisible = false;
    }
  });

  // ─── Ctrl+P / Shift+Ctrl+P — tier cycling ─────────────────────────────────

  pi.registerShortcut("ctrl+p", {
    description: "Cycle to next model tier (model-tiers)",
    handler: async (ctx) => {
      if (!activeFamily) {
        ctx.ui.notify(
          "model-tiers: pick a provider first — /a  /g  /o  /c  /u  /n",
          "info",
        );
        return;
      }
      await activateTier(activeFamily, (tierIndex + 1) % 3, ctx);
    },
  });

  pi.registerShortcut("shift+ctrl+p", {
    description: "Cycle to previous model tier (model-tiers)",
    handler: async (ctx) => {
      if (!activeFamily) {
        ctx.ui.notify(
          "model-tiers: pick a provider first — /a  /g  /o  /c  /u  /n",
          "info",
        );
        return;
      }
      await activateTier(activeFamily, (tierIndex + 2) % 3, ctx);
    },
  });

  // ─── Session persistence ───────────────────────────────────────────────────

  // Save state at the start of each turn so resume restores exactly where we left off.
  pi.on("turn_start", async () => {
    if (activeFamily !== undefined) {
      pi.appendEntry<PersistedState>("model-tiers-state", {
        family: activeFamily,
        index: tierIndex,
      });
    }
  });

  pi.on("session_start", async (_event, ctx) => {
    // 1. Try to restore from the most recent persisted entry.
    const entries = ctx.sessionManager.getEntries();
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i] as any;
      if (entry.type === "custom" && entry.customType === "model-tiers-state") {
        const { family, index } = (entry.data ?? {}) as Partial<PersistedState>;
        if (family && FAMILIES[family] && typeof index === "number") {
          const expectedModel = FAMILIES[family].tiers[index].model;
          const currentModel = ctx.model?.id;
          if (currentModel !== expectedModel) {
            // Tier config was updated since this session was last active (e.g. a model
            // was renamed or removed). Force-activate so pi uses the current model ID
            // rather than the stale one pi restored from session state.
            await activateTier(family, index, ctx);
          } else {
            activeFamily = family;
            tierIndex = index;
            // Restore thinking level — pi doesn't persist it across sessions.
            pi.setThinkingLevel(FAMILIES[family].tiers[index].thinking);
            updateStatus(ctx);
          }
          return;
        }
        break;
      }
    }

    // 2. Auto-detect family from the current model ID.
    const currentId = ctx.model?.id;
    if (currentId) {
      outer: for (const [key, family] of Object.entries(FAMILIES)) {
        for (let i = 0; i < family.tiers.length; i++) {
          if (family.tiers[i].model === currentId) {
            activeFamily = key;
            tierIndex = i;
            break outer;
          }
        }
      }
    }

    // 3. Cold-start default: nothing matched — activate n·instant (GPT-5.6 Luna via USAi)
    //    so Ctrl+P always works without typing a command first.
    if (!activeFamily) {
      await activateTier("n", 0, ctx);
      return;
    }

    updateStatus(ctx);
  });

  // ─── Clear family tracking if user picks a model outside our tiers ─────────

  pi.on("model_select", async (event, ctx) => {
    if (_ownSwitch || event.source === "restore") return;
    // User picked something manually via /model or Ctrl+L.
    const id = event.model.id;
    let matched = false;
    outer: for (const [key, family] of Object.entries(FAMILIES)) {
      for (let i = 0; i < family.tiers.length; i++) {
        if (family.tiers[i].model === id) {
          activeFamily = key;
          tierIndex = i;
          matched = true;
          break outer;
        }
      }
    }
    if (!matched) {
      activeFamily = undefined;
      tierIndex = 0;
    }
    updateStatus(ctx);
  });
}
