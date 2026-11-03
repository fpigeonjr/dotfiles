# Global Pi Agent Instructions

## Model Tiers

The `model-tiers` extension is loaded. Use these commands to switch provider families and scope `Ctrl+P` cycling:

| command | instant | thinking | pro |
|---|---|---|---|
| `/a` | claude-haiku-4-5 (Bedrock) | claude-sonnet-5 | claude-opus-5 |
| `/c` | claude-haiku-5.5 (Copilot) | claude-sonnet-5.5 | claude-opus-5.5 |
| `/g` | gemini-3.8-flash/low (Gemini) | gemini-3.8-flash/medium | gemini-3.8-flash/high |
| `/n` | llama-4-maverick (NIM) | kimi-k2-thinking (NIM) | — |
| `/o` | gpt-6-luna (Codex) | gpt-6.1-sol | gpt-6.1-terra |

- `kimi-k2.5` stalls frequently — multiple 10m+ non-responses observed on Bedrock and NIM. Available via `/model` but don't put it in a tier.

- `/g` requires `GEMINI_API_KEY` (free tier, Google AI Studio) in `~/.config/zsh/local.zsh`. `gemini-2.5-pro` is not available on the free tier — all three `/g` tiers use `gemini-3.8-flash`.

- `/n` requires `NVIDIA_NIM_API_KEY` in `~/.config/zsh/local.zsh`. It has no pro tier: `qwen3.5-397b` reached end-of-life (HTTP 410), so `Ctrl+P` cycles instant ↔ thinking.

- `/a thinking` jumps directly to a named tier; bare `/a` always starts at instant
- `Ctrl+P` / `Shift+Ctrl+P` cycles tiers within the active family
- `/model` (Ctrl+L) escapes to free model selection and clears family tracking
- Footer shows active family and tier, e.g. `a·thinking`

## Dotfiles / Committing

Pi rewrites `defaultModel`, `defaultThinkingLevel`, and its changelog bookkeeping (`lastChangelogVersion`, `extensionChangelogVersions`) in `settings.json`. The dotfiles `pi-settings` Git clean filter (`scripts/git-clean-pi-settings.sh`) pins the model fields to `claude-haiku-5.5` / `off` (`c·instant`) and drops the changelog fields, so they never reach a commit. If `git status` shows `settings.json` modified but `git diff` is empty, `git add` it (stages nothing, clears the flag). If `git diff` shows only those fields, check the filter is configured: `git config filter.pi-settings.clean` (setup line in the README).

## Clarifying Questions

When you need to ask clarifying questions before proceeding, ask them **one at a time**.
Pose a single question, wait for the user's response, then ask the next question if still needed.

Do not front-load a numbered list of all questions at once.
