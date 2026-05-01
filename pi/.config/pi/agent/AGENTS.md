# Global Pi Agent Instructions

## Model Tiers

The `model-tiers` extension is loaded. Use these commands to switch provider families and scope `Ctrl+P` cycling:

| command | instant | thinking | pro |
|---|---|---|---|
| `/a` | claude-haiku-4-5 (Bedrock) | claude-sonnet-4-6 | claude-opus-4-7 |
| `/e` | qwen3-coder-30b (Bedrock) | qwen3-235b-a22b-2507 (Bedrock) | qwen3-coder-480b (Bedrock) |
| `/n` | llama-4-maverick (NIM) | kimi-k2-thinking (NIM) | qwen3.5-397b (NIM) |
| `/g` | gemini-2.5-flash/off (Gemini) | gemini-2.5-flash/medium | gemini-2.5-flash/high |
| `/o` | gpt-5.4-mini (Codex) | gpt-5.4 | gpt-5.5 |
| `/oc` | deepseek-v4-flash (OpenCode Go) | kimi-k2.6 | deepseek-v4-pro |

- `kimi-k2.5` stalls frequently — multiple 10m+ non-responses observed on Bedrock and NIM. Available via `/model` but don't put it in a tier.

- `/g` requires `GEMINI_API_KEY` (free tier, Google AI Studio) in `~/.config/zsh/local.zsh`. `gemini-2.5-pro` is not available on the free tier — all three `/g` tiers use `gemini-2.5-flash`.

- `/n` requires `NVIDIA_NIM_API_KEY` in `~/.config/zsh/local.zsh`.

- `/oc` requires `OPENCODE_API_KEY` (OpenCode Go subscription) in `~/.config/zsh/local.zsh` and `/connect` in OpenCode TUI.

- `/a thinking` jumps directly to a named tier; bare `/a` always starts at instant
- `Ctrl+P` / `Shift+Ctrl+P` cycles tiers within the active family
- `/model` (Ctrl+L) escapes to free model selection and clears family tracking
- Footer shows active family and tier, e.g. `a·thinking`

## Dotfiles / Committing

Pi rewrites `defaultModel` and `defaultThinkingLevel` in `settings.json` on every session. Always `git diff` before staging — only `lastChangelogVersion` (and intentional config changes) should be committed; revert the model fields to `haiku-4-5` / `off` (`a·instant`) if dirty.

## Clarifying Questions

When you need to ask clarifying questions before proceeding, ask them **one at a time**.
Pose a single question, wait for the user's response, then ask the next question if still needed.

Do not front-load a numbered list of all questions at once.
