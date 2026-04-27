# Global Pi Agent Instructions

## Model Tiers

The `model-tiers` extension is loaded. Use these commands to switch provider families and scope `Ctrl+P` cycling:

| command | instant | thinking | pro |
|---|---|---|---|
| `/a` | claude-haiku-4-5 (Bedrock) | claude-sonnet-4-6 | claude-opus-4-7 |
| `/e` | qwen3-coder-30b (Bedrock) | qwen3-coder-480b | kimi-k2.5 |
| `/g` | gemini-2.5-flash/off (Gemini CLI) | gemini-2.5-flash/medium | gemini-2.5-pro |
| `/o` | gpt-5.4-mini (Codex) | gpt-5.4 | gpt-5.5 |

- `/a thinking` jumps directly to a named tier; bare `/a` always starts at instant
- `Ctrl+P` / `Shift+Ctrl+P` cycles tiers within the active family
- `/model` (Ctrl+L) escapes to free model selection and clears family tracking
- Footer shows active family and tier, e.g. `a·thinking`

## Clarifying Questions

When you need to ask clarifying questions before proceeding, ask them **one at a time**.
Pose a single question, wait for the user's response, then ask the next question if still needed.

Do not front-load a numbered list of all questions at once.
