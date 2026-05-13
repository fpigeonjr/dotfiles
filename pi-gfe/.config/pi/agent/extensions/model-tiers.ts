/**
 * model-tiers — Pi extension for tiered model selection (GFE / GitHub Copilot)
 *
 * Registers three provider family commands that each scope Ctrl+P to a
 * three-model instant → thinking → pro ladder. All models are served via
 * GitHub Copilot — no Bedrock, NIM, or personal API keys required.
 *
 *   /a   Anthropic via Copilot   haiku-4.5 → sonnet-4.6 → opus-4.7
 *   /g   Google via Copilot      gemini-3-flash-preview → gemini-2.5-pro → gemini-3.1-pro-preview
 *   /o   OpenAI via Copilot      gpt-5.4-mini → gpt-5.4 → gpt-5.5
 *
 * Usage:
 *   /a              → switches to instant tier for Anthropic, scopes Ctrl+P
 *   /a thinking     → jumps directly to thinking tier
 *   Ctrl+P          → advance to next tier within active family
 *   Shift+Ctrl+P    → back to previous tier within active family
 *   /tiers          → toggle compact tier table (3 lines, never truncates)
 *
 * Cold-start default: if no persisted state and no model match, silently
 * activates a·instant (claude-haiku-4.5) so Ctrl+P always works without
 * typing a command.
 *
 * Footer shows active family and tier, e.g. "a·thinking" (via pi.events
 * cross-extension comms with copilot-status).
 *
 * Note on thinking levels:
 *   - claude-sonnet-4.6 has no thinkingLevelMap via Copilot — it is a
 *     capability step, not a true thinking tier. thinking: "off" is correct.
 *   - claude-opus-4.7 supports xhigh thinking.
 *   - gpt-5.4 and gpt-5.5 support xhigh thinking.
 *   - Gemini models via Copilot do not expose reasoning effort — all off.
 *
 * State persists across session resume/fork via pi.appendEntry().
 * Selecting a model via /model (Ctrl+L) clears family tracking.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

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
      { name: "instant",  model: "claude-haiku-4.5",  thinking: "off",   short: "haiku-4.5"  },
      { name: "thinking", model: "claude-sonnet-4.6", thinking: "off",   short: "sonnet-4.6" },
      { name: "pro",      model: "claude-opus-4.7",   thinking: "xhigh", short: "opus-4.7"   },
    ],
  },
  g: {
    label: "g",
    provider: "github-copilot",
    tiers: [
      { name: "instant",  model: "gemini-3-flash-preview",  thinking: "off", short: "g3-flash"    },
      { name: "thinking", model: "gemini-2.5-pro",          thinking: "off", short: "g2.5-pro"    },
      { name: "pro",      model: "gemini-3.1-pro-preview",  thinking: "off", short: "g3.1-pro"    },
    ],
  },
  o: {
    label: "o",
    provider: "github-copilot",
    tiers: [
      { name: "instant",  model: "gpt-5.4-mini", thinking: "off",   short: "5.4-mini" },
      { name: "thinking", model: "gpt-5.4",       thinking: "xhigh", short: "5.4"      },
      { name: "pro",      model: "gpt-5.5",       thinking: "xhigh", short: "5.5"      },
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
      ctx.ui.notify(`model-tiers: not found — ${family.provider}/${tier.model}`, "error");
      return;
    }

    _ownSwitch = true;
    try {
      const ok = await pi.setModel(model);
      if (!ok) {
        ctx.ui.notify(`model-tiers: no auth for ${family.provider}/${tier.model}`, "error");
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

    pi.registerCommand(key, {
      description: `${family.provider} tier stack — instant / thinking / pro`,
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

  // ─── /tiers — compact toggle widget (3 lines, never truncates) ─────────────

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
        const provider = theme.fg("dim", family.provider);
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
        ctx.ui.notify("model-tiers: pick a provider first — /a  /g  /o", "info");
        return;
      }
      await activateTier(activeFamily, (tierIndex + 1) % 3, ctx);
    },
  });

  pi.registerShortcut("shift+ctrl+p", {
    description: "Cycle to previous model tier (model-tiers)",
    handler: async (ctx) => {
      if (!activeFamily) {
        ctx.ui.notify("model-tiers: pick a provider first — /a  /g  /o", "info");
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

    // 3. Cold-start default: nothing matched — silently activate a·instant
    //    so Ctrl+P always works without typing a command first.
    if (!activeFamily) {
      await activateTier("a", 0, ctx);
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
