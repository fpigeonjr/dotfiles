# Global Pi Agent Instructions (GFE)

## Model Tiers

The `model-tiers` extension is loaded. `/a`, `/g`, `/o`, and `/c` are served via **GitHub Copilot** — no API keys required beyond the GSA org Copilot licence. `/u` and `/n` use **USAi**.

Use these commands to switch provider families and scope `Ctrl+P` cycling:

| command | instant | thinking | pro |
|---|---|---|---|
| `/u` | claude-haiku-4.5 (USAi) | claude-sonnet-5.5 | claude-opus-5 |
| `/n` | gpt-5.6-luna (USAi) | gpt-5.6-sol | gpt-6-astra |
| `/a` | claude-haiku-4.5 (Copilot) | claude-sonnet-5.5 | claude-opus-5.5 |
| `/g` | gemini-3.6-flash (Copilot) | gemini-3.7-flash | gemini-3.7-flash |
| `/o` | gpt-6-luna (Copilot) | gpt-6-sol | gpt-6.1-sol |
| `/c` | gpt-5-mini (Copilot) | gpt-5.3-codex | claude-opus-4.8 |

- `/u thinking` jumps directly to a named tier; bare `/u` always starts at instant
- `Ctrl+P` / `Shift+Ctrl+P` cycles tiers within the active family
- `/model` (Ctrl+L) escapes to free model selection and clears family tracking
- Footer shows active family and tier, e.g. `n·instant`

**Thinking level notes:**
- `/a thinking` (claude-sonnet-5.5) and `/a pro` (claude-opus-5.5) — full `xhigh` thinking supported.
- `/o thinking` (gpt-6-sol) and `/o pro` (gpt-6.1-sol) — full `xhigh` thinking supported.
- `/g` tiers — Gemini via Copilot (3.6-flash < 3.7-flash) runs at `off`. The ladder is by capability.
- `/c` tiers — GFE Copilot mixed stack; models do not support reasoning effort; all three tiers run at `off`. The ladder is purely by model capability.
- `/u` tiers — **USAi Claude stack**. USAi does not expose reasoning effort; all three tiers run at `off`; Sonnet 5.5 is the new thinking tier.
- `/n` tiers — **USAi OpenAI stack**. USAi does not expose reasoning effort; all three tiers run at `off`. The ladder is GPT-5.6 Luna → GPT-5.6 Sol → GPT-6 Astra; Astra was verified with text, streaming, and tool calls. Other GPT-6 IDs are advertised but currently return deployment `404`s, so they are not tiered.

## Custom Providers

- `usai` (USAi) is registered via `extensions/usai.ts`
- Requires `USAI_API_KEY` in `~/.config/zsh/local.zsh` (`GSAI_API_KEY` also works)
- Use `/u` (Claude stack) or `/n` (OpenAI stack) for the USAi tier stacks, or `/model` to pick any USAi model manually; the provider discovers `/api/v1/models` at startup when a key is present

## Dotfiles / Committing

Pi rewrites `defaultModel` and `defaultThinkingLevel` in `settings.json` on every session. Always `git diff` before staging — only `lastChangelogVersion` (and intentional config changes) should be committed; revert the model fields to `gpt-5.6-luna` / `off` (`n·instant`) if dirty.

## Clarifying Questions

When you need to ask clarifying questions before proceeding, ask them **one at a time**.
Pose a single question, wait for the user's response, then ask the next question if still needed.

Do not front-load a numbered list of all questions at once.
