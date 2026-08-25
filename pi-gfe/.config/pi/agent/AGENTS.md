# Global Pi Agent Instructions (GFE)

## Model Tiers

The `model-tiers` extension is loaded. `/a`, `/g`, `/o`, and `/c` are served via **GitHub Copilot** — no API keys required beyond the GSA org Copilot licence. `/u` uses the custom **GSA AI / USAi** provider. `/f` and `/x` are served via **Flexion's AWS Bedrock** (region `us-east-2`) and require the `ClaudeCodeAccess-FlexionLLM` SSO profile to be active.

Use these commands to switch provider families and scope `Ctrl+P` cycling:

| command | instant | thinking | pro |
|---|---|---|---|
| `/a` | claude-haiku-4.5 (Copilot) | claude-sonnet-4.6 | claude-opus-4.7 |
| `/g` | gemini-3-flash-preview (Copilot) | gemini-2.5-pro | gemini-3.1-pro-preview |
| `/o` | gpt-5.4-mini (Copilot) | gpt-5.4 | gpt-5.5 |
| `/c` | gpt-5-mini (Copilot) | gpt-5.3-codex | claude-opus-4.5 |
| `/u` | claude-haiku-4.5 (GSA AI) | claude-sonnet-5 | claude-opus-5 |
| `/f` | claude-haiku-4.5 (Flexion Bedrock) | claude-sonnet-5 | claude-opus-5 |
| `/x` | gpt-5.6-luna (Flexion Bedrock) | gpt-5.6-terra | gpt-5.6-sol |

- `/a thinking` jumps directly to a named tier; bare `/a` always starts at instant
- `Ctrl+P` / `Shift+Ctrl+P` cycles tiers within the active family
- `/model` (Ctrl+L) escapes to free model selection and clears family tracking
- Footer shows active family and tier, e.g. `a·thinking`

**Thinking level notes:**
- `/a thinking` (claude-sonnet-4.6) — capability step only; Copilot does not expose a thinking level for this model. Border color will not change.
- `/a pro` (claude-opus-4.7) — full `xhigh` thinking supported.
- `/o thinking` (gpt-5.4) and `/o pro` (gpt-5.5) — full `xhigh` thinking supported.
- `/g` tiers — Gemini via Copilot does not support reasoning effort; all three tiers run at `off`. The ladder is purely by model capability.
- `/c` tiers — GFE Copilot mixed stack; models do not support reasoning effort; all three tiers run at `off`. The ladder is purely by model capability.
- `/u` tiers — GSA AI / USAi does not expose reasoning effort; all three tiers run at `off`. The ladder is purely by model capability.
- `/f` tiers — **Flexion Bedrock (Claude), `us-east-2`**, via the `us.anthropic.*` inference-profile IDs (raw model IDs are not on-demand callable). `/f instant` (Claude Haiku 4.5) has no extended thinking, so it runs `off`. `/f thinking` (Claude Sonnet 5) and `/f pro` (Claude Opus 5) support genuine `xhigh` extended thinking.
- `/x` tiers — **Flexion Bedrock (GPT), `us-east-2`**, via the `us.openai.*` inference-profile IDs. GPT-5.6 supports reasoning effort on Bedrock (`low`/`medium`/`high`/`xhigh`/`none`), but the store map exposes `xhigh` only: `/x instant` (GPT-5.6 Luna) runs `off`, while `/x thinking` (GPT-5.6 Terra) and `/x pro` (GPT-5.6 Sol) run `xhigh`. Ordering is Luna < Terra < Sol.

## Flexion Bedrock (`/f`, `/x`)

- Requires an active `ClaudeCodeAccess-FlexionLLM` SSO session (`aws sso login --profile ClaudeCodeAccess-FlexionLLM`) with `AWS_PROFILE`/`AWS_REGION` pointing at `us-east-2`.
- Models are added to the (git-ignored) `models-store.json` under `amazon-bedrock` with `baseUrl` set to `us-east-2`; the provider signs against `AWS_REGION`.
- `fable-5` is intentionally excluded — it routes to `us-east-1` where this role lacks `bedrock:InvokeModel` (AccessDenied).

## Custom Providers

- `gsai` (GSA AI / USAi) is registered via `extensions/gsai.ts`
- Requires `GSAI_API_KEY` in `~/.config/zsh/local.zsh` (`USAI_API_KEY` also works)
- Use `/u` for the GSA AI tier stack, or `/model` to pick any GSA model manually; the provider discovers `/api/v1/models` at startup when a key is present

## Dotfiles / Committing

Pi rewrites `defaultModel` and `defaultThinkingLevel` in `settings.json` on every session. Always `git diff` before staging — only `lastChangelogVersion` (and intentional config changes) should be committed; revert the model fields to `claude-haiku-4.5` / `off` (`a·instant`) if dirty.

## Clarifying Questions

When you need to ask clarifying questions before proceeding, ask them **one at a time**.
Pose a single question, wait for the user's response, then ask the next question if still needed.

Do not front-load a numbered list of all questions at once.
