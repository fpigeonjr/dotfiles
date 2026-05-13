# Global Pi Agent Instructions (GFE)

## Model Tiers

The `model-tiers` extension is loaded. All models are served via **GitHub Copilot** — no API keys required beyond the GSA org Copilot licence.

Use these commands to switch provider families and scope `Ctrl+P` cycling:

| command | instant | thinking | pro |
|---|---|---|---|
| `/a` | claude-haiku-4.5 (Copilot) | claude-sonnet-4.6 | claude-opus-4.7 |
| `/g` | gemini-3-flash-preview (Copilot) | gemini-2.5-pro | gemini-3.1-pro-preview |
| `/o` | gpt-5.4-mini (Copilot) | gpt-5.4 | gpt-5.5 |

- `/a thinking` jumps directly to a named tier; bare `/a` always starts at instant
- `Ctrl+P` / `Shift+Ctrl+P` cycles tiers within the active family
- `/model` (Ctrl+L) escapes to free model selection and clears family tracking
- Footer shows active family and tier, e.g. `a·thinking`

**Thinking level notes:**
- `/a thinking` (claude-sonnet-4.6) — capability step only; Copilot does not expose a thinking level for this model. Border color will not change.
- `/a pro` (claude-opus-4.7) — full `xhigh` thinking supported.
- `/o thinking` (gpt-5.4) and `/o pro` (gpt-5.5) — full `xhigh` thinking supported.
- `/g` tiers — Gemini via Copilot does not support reasoning effort; all three tiers run at `off`. The ladder is purely by model capability.

## Dotfiles / Committing

Pi rewrites `defaultModel` and `defaultThinkingLevel` in `settings.json` on every session. Always `git diff` before staging — only `lastChangelogVersion` (and intentional config changes) should be committed; revert the model fields to `claude-haiku-4.5` / `off` (`a·instant`) if dirty.

## Clarifying Questions

When you need to ask clarifying questions before proceeding, ask them **one at a time**.
Pose a single question, wait for the user's response, then ask the next question if still needed.

Do not front-load a numbered list of all questions at once.
