/**
 * model-tiers — Pi extension for tiered model selection
 *
 * Registers four provider family commands that each scope Ctrl+P to a
 * three-model instant → thinking → pro ladder.
 *
 *   /a  Anthropic via Bedrock   haiku → sonnet → opus
 *   /e  Experiment via Bedrock  qwen3-coder-30b → qwen3-coder-480b → kimi-k2.5
 *   /g  Google via Gemini CLI   2.5-flash/off → 2.5-flash/medium → 2.5-pro
 *   /o  OpenAI via Codex        gpt-5.4-mini → gpt-5.4 → gpt-5.5
 *
 * Usage:
 *   /a              → switches to instant tier for Anthropic, scopes Ctrl+P
 *   /a thinking     → jumps directly to thinking tier
 *   Ctrl+P          → advance to next tier within active family
 *   Shift+Ctrl+P    → back to previous tier within active family
 *   /tiers          → toggle tier table widget above editor
 *
 * Footer shows active family and tier, e.g. "a·thinking" (via pi.events
 * cross-extension comms with flexion-aws-status).
 *
 * Editor border color reflects the thinking level natively via
 * pi.setThinkingLevel() — no extra code needed.
 *
 * State persists across session resume/fork via pi.appendEntry().
 * Selecting a model via /model (Ctrl+L) clears family tracking.
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
type TierName = "instant" | "thinking" | "pro";

interface Tier {
  name: TierName;
  model: string;
  thinking: ThinkingLevel;
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
    provider: "amazon-bedrock",
    tiers: [
      { name: "instant",  model: "us.anthropic.claude-haiku-4-5-20251001-v1:0", thinking: "off" },
      { name: "thinking", model: "us.anthropic.claude-sonnet-4-6",              thinking: "medium" },
      { name: "pro",      model: "us.anthropic.claude-opus-4-7",                thinking: "high" },
    ],
  },
  e: {
    label: "e",
    provider: "amazon-bedrock",
    tiers: [
      // Amazon Nova models require inference profiles not in pi registry.
      // Using qwen3-coder-30b — smaller/faster coding model, same family as thinking tier.
      { name: "instant",  model: "qwen.qwen3-coder-30b-a3b-v1:0",      thinking: "off" },
      // qwen3-coder-480b marked thinking=no in pi registry; reasoning is internal.
      { name: "thinking", model: "qwen.qwen3-coder-480b-a35b-v1:0",     thinking: "off" },
      { name: "pro",      model: "deepseek.v3.2",                          thinking: "high" },
    ],
  },
  g: {
    label: "g",
    provider: "google-gemini-cli",
    tiers: [
      // gemini-2.0-flash returns 404 on Cloud Code Assist — not in this subscription.
      // Use 2.5-flash for both instant (thinking off) and thinking (thinking medium).
      // 2.5-pro kept at pro; returns 429 when quota is exhausted, works when quota resets.
      { name: "instant",  model: "gemini-2.5-flash", thinking: "off" },
      { name: "thinking", model: "gemini-2.5-flash", thinking: "medium" },
      { name: "pro",      model: "gemini-2.5-pro",   thinking: "high" },
    ],
  },
  o: {
    label: "o",
    provider: "openai-codex",
    tiers: [
      { name: "instant",  model: "gpt-5.4-mini", thinking: "off" },
      { name: "thinking", model: "gpt-5.4",       thinking: "medium" },
      { name: "pro",      model: "gpt-5.5",       thinking: "high" },
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
    // setStatus targets the default footer; emit covers the custom flexion footer.
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

  // ─── /tiers — toggle tier table widget ─────────────────────────────────────

  pi.registerCommand("tiers", {
    description: "Show all tier stacks (toggle)",
    handler: async (_args, ctx) => {
      if (tiersWidgetVisible) {
        ctx.ui.setWidget("model-tiers-table", undefined);
        tiersWidgetVisible = false;
        return;
      }

      const rows: string[] = [];
      for (const [key, family] of Object.entries(FAMILIES)) {
        const isActiveFamily = key === activeFamily;
        rows.push(`${isActiveFamily ? "▶" : " "} /${key}  (${family.provider})`);
        for (let i = 0; i < family.tiers.length; i++) {
          const tier = family.tiers[i];
          const isCurrent = isActiveFamily && i === tierIndex;
          rows.push(`    ${isCurrent ? "→" : " "} ${tier.name.padEnd(9)}${tier.model}`);
        }
        rows.push("");
      }
      rows.pop(); // remove trailing blank line

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
        ctx.ui.notify("model-tiers: pick a provider first — /a  /e  /g  /o", "info");
        return;
      }
      await activateTier(activeFamily, (tierIndex + 1) % 3, ctx);
    },
  });

  pi.registerShortcut("shift+ctrl+p", {
    description: "Cycle to previous model tier (model-tiers)",
    handler: async (ctx) => {
      if (!activeFamily) {
        ctx.ui.notify("model-tiers: pick a provider first — /a  /e  /g  /o", "info");
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
          activeFamily = family;
          tierIndex = index;
          // Restore thinking level — pi doesn't persist it across sessions.
          pi.setThinkingLevel(FAMILIES[family].tiers[index].thinking);
          updateStatus(ctx);
          return;
        }
        break;
      }
    }

    // 2. Fall back: auto-detect family from the current model ID.
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
    updateStatus(ctx);
  });

  // ─── Clear family tracking if user picks a model outside our tiers ─────────

  pi.on("model_select", async (event, ctx) => {
    if (_ownSwitch || event.source === "restore") return;
    // User picked something manually via /model or Ctrl+L.
    // Re-sync family tracking in case they picked one of our tier models,
    // otherwise clear it.
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
