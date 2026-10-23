# Global Pi Agent Instructions (GFE)

## Model Tiers

The `model-tiers` extension is loaded. `/a`, `/g`, `/o`, and `/c` are served via **GitHub Copilot** — no API keys required beyond the GSA org Copilot licence. `/u` and `/n` use **USAi**.

Use these commands to switch provider families and scope `Ctrl+P` cycling:

| command | instant | thinking | pro |
|---|---|---|---|
| `/u` | claude-haiku-4.5 (USAi) | claude-sonnet-5.5 | claude-opus-5 |
| `/n` | gpt-5.6-luna (USAi) | gpt-6-sol | gpt-6-astra |
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
- `/n` tiers — **USAi OpenAI stack**. USAi does not expose reasoning effort; all three tiers run at `off`. The ladder is GPT-5.6 Luna → GPT-6 Sol → GPT-6 Astra. GPT-6 Luna, Sol, 6.1 Sol and Astra are callable (checked with chat, streaming and tool use); keep the steadier 5.6 Luna for instant, and Astra for pro. Recheck availability before changing tiers again.

## Delegation

You can spawn Pi subagents in Herdr. At the start of a substantial task, consider whether a bounded read-only investigation, independent review, or parallel work on separate files would help. Delegate when it improves speed or confidence; do not delegate trivial or tightly sequential work. Give each child one clear outcome and retain responsibility for synthesis and verification. Follow the subagent model-routing rules below.

## Subagent Model Routing

When spawning subagents, the `thinking` argument is validated against the model's
`supportedThinkingLevels` **before launch**, and a mismatch is a hard failure, not a clamp.
Omitting `thinking` clamps silently, but orchestration rules require it to be explicit.

**Rule: every `usai/*` child must be spawned with `thinking: "off"`.**

`extensions/usai.ts` declares all USAi models `reasoning: false`, so their only supported
level is `off`. That declaration is correct, not a workaround — the USAi gateway accepts
`reasoning_effort` (even invalid values like `"BANANAS"` return HTTP 200) and an Anthropic
`thinking` block, but returns no reasoning tokens and no thinking content. The knob is
dropped upstream. Do not "fix" this by setting `reasoning: true` or adding a
`thinkingLevelMap`; that would fake a control that does not exist.

Consequence for delegation: with USAi, **model capability is the only lever**. Pick the tier
by model, not by thinking level:

| work | USAi model |
|---|---|
| recon, mechanical, bounded | `usai/claude_4_5_haiku`, `usai/gpt-5.6-luna` |
| implementation, ordinary review, test runs | `usai/claude-sonnet-5.5`, `usai/gpt-6-sol-latest-guardrails-defaultv2` |
| architecture, security, hard diagnosis, adversarial review | `usai/claude-opus-5`, `usai/gpt-6-astra` |

Subagent `model` needs the **exact** live ID, which is not always the pretty tier name above
(`claude_4_5_haiku`, not `claude-haiku-4.5`; `gpt-6-sol-latest-guardrails-defaultv2`, not
`gpt-6-sol`). Confirm with:
`curl -s -H "Authorization: Bearer $USAI_API_KEY" "$USAI_BASE_URL/models"`

When a child genuinely needs reasoning effort, route it to a `github-copilot/*` model
instead — `claude-opus-5.5`, `gpt-6-sol`, and `gpt-6.1-sol` support `xhigh`. Mixing
providers across children is fine and buys cross-family independence for reviews.

## Bounded Delegation Preference

Prefer explicit authenticated USAi GPT model IDs across delegated tasks: use
`usai/gpt-5.6-luna` for bounded recon and mechanical work,
`usai/gpt-6-sol-latest-guardrails-defaultv2` for implementation, test runs, and
ordinary work, and `usai/gpt-6-astra` for architecture, security, and hard
diagnosis. Set `thinking: "off"` for every USAi child. Do not silently substitute
models; report actual routing. For reviews of GPT-authored work, prefer a
different model family. A same-family reviewer in a fresh standalone session is
context-isolated, not cross-family independent; do not use it when cross-family
verification is required. Explicit task or review requirements take precedence.

Uncertain integration failures begin with diagnosis-only work: at most roughly ten
tool calls, one reproducible failure, and a concrete hypothesis or blocker. A partial
answer with evidence beats speculation. Authorize implementation after diagnosis;
do not launch another broad repair investigation without new evidence.

Timeboxes and prompt tool-call caps are advisory unless enforced by a verified,
supported mechanism. Never promise automatic cancellation from a warning threshold.
When an over-budget advisory arrives, the parent must decide promptly whether to
cancel or explicitly extend the investigation, reporting that decision to the user.

## Subagent Timeboxing

`~/.config/pi/agent/herdr-agents/config.json` sets `supervision.hangWarningMinutes: 8`
(down from the default 15). Advisories are **warning-only** — they never interrupt, kill,
retry, or restart a child; they just wake the parent with the session path and recovery
options. The cancel decision stays with the parent via `subagent_cancel`.

The config is a backstop, not a budget. Every open-ended analysis child also needs a
prompt-level timebox, because long read-only investigations sprawl — the model keeps
gathering corroboration instead of concluding. Include in such prompts:

- a tool-call cap: *"Use at most ~25 tool calls. If you hit that, stop and report what you
  established plus what remains open."*
- a partial-result contract: *"A partial answer with evidence beats a complete answer you
  had to guess at. Never speculate to fill a gap — label it UNVERIFIED."*
- an ordered stop condition rather than a flat list of questions: *"answer Q1–Q3 first,
  then stop if the verdict is already determined."* A prompt with six independent numbered
  sub-questions invites six independent investigations.

Children that run a command loop (build, test, mutation runs) self-limit and need this
less than pure-read reviewers do.

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
