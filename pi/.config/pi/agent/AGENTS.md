# Global Pi Agent Instructions

## Model Tiers

The `model-tiers` extension is loaded. Use these commands to switch provider families and scope `Ctrl+P` cycling:

| command | instant | thinking | pro |
|---|---|---|---|
| `/a` *(disabled)* | claude-haiku-4-5 (Bedrock) | claude-sonnet-5 | claude-opus-5 |
| `/c` | claude-haiku-5.5 (Copilot) | claude-sonnet-5.5 | claude-opus-5.5 |
| `/co` | gpt-6-luna (Copilot) | gpt-6.1-terra | gpt-6.2-sol |
| `/cg` | gemini-4-hydrogen/low (Copilot) | gemini-4-neon/medium | gemini-4-carbon/high |
| `/g` *(disabled)* | gemini-3.8-flash/low (Gemini) | gemini-3.8-flash/medium | gemini-3.8-flash/high |
| `/n` | nemotron-3.5-lightning (NIM) | nemotron-3.5-super-vl | nemotron-3-ultra |
| `/o` | gpt-6-luna (Codex) | gpt-6.1-terra | gpt-6.2-sol |

- Don't put Kimi in a tier: on NIM, `kimi-k3.1-pro` took 60–90s per turn on the free tier (2026-11, not in Pi's built-in `nvidia` list), and `kimi-k2.5` stalled 10m+ before it was retired.

- `/g` (Gemini API free tier) is disabled: it was barely used and hung or errored in 2026-11 tests, and `/cg` covers Gemini via Copilot. `GEMINI_API_KEY` is commented out in `~/.config/zsh/local.zsh`; to re-enable, uncomment it and delete `/g`'s `disabled` line in `model-tiers.ts`. `gemini-2.5-pro` is not available on the free tier — all three `/g` tiers use `gemini-3.8-flash`.

- `/n` uses Pi's built-in `nvidia` provider, which reads `NVIDIA_API_KEY`; `~/.config/zsh/local.zsh` sets it from `NVIDIA_NIM_API_KEY`. Pi maintains its model list and limits (`pi --list-models nvidia`). NIM retires free-tier models often (HTTP 410; the whole previous list died by 2026-11), so re-test tool calls before changing `/n`. The provider sends no reasoning effort (`supportsReasoningEffort: false`), so `/n` thinking levels are labels only.

- `/a` (Bedrock) is disabled: its family in `model-tiers.ts` has `disabled: "Bedrock access paused"`, so `/a` isn't registered and `/tiers` shows it dimmed. Delete that line to re-enable.

- `/c thinking` jumps directly to a named tier; bare `/c` always starts at instant
- `Ctrl+P` / `Shift+Ctrl+P` cycles tiers within the active family
- `/model` (Ctrl+L) escapes to free model selection; picking a non-tier model clears family tracking, picking a tier model joins that tier
- Footer shows active family and tier, e.g. `c·thinking`

## Dotfiles / Committing

Pi rewrites `defaultModel`, `defaultThinkingLevel`, and its changelog bookkeeping (`lastChangelogVersion`, `extensionChangelogVersions`) in `settings.json`. The dotfiles `pi-settings` Git clean filter (`scripts/git-clean-pi-settings.sh`) pins the model fields to `claude-haiku-5.5` / `off` (`c·instant`) and drops the changelog fields, so they never reach a commit. If `git status` shows `settings.json` modified but `git diff` is empty, `git add` it (stages nothing, clears the flag). If `git diff` shows only those fields, check the filter is configured: `git config filter.pi-settings.clean` (setup line in the README).

## Clarifying Questions

When you need to ask clarifying questions before proceeding, ask them **one at a time**.
Pose a single question, wait for the user's response, then ask the next question if still needed.

Do not front-load a numbered list of all questions at once.
