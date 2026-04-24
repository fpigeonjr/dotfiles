# Agent Guidelines for Dotfiles Repository

## Build/Lint/Test Commands
- **Lua formatting**: `stylua --config ~/.config/nvim/stylua.toml .` (2-space indent, 120 column width)
- **JavaScript/TypeScript**: `npx prettier --write .` and `npx eslint .`
- **Shell scripts**: No specific linter configured, use shellcheck if available
- **Single test**: No test framework configured (configuration repo)

## Testing Commands
- **Neovim config**: `nvim --headless -c "checkhealth" -c "qa"`
- **Zsh config**: `zsh -n ~/.zshrc` (syntax check)
- **Bash config**: `bash -n ~/.bashrc` (syntax check)
- **Git config**: `git config --list --show-origin`
- **SSH config**: `ssh -T git@github.com` (test connectivity)
- **Stow verification**: `ls -la ~ | grep dotfiles` (check symlinks)

## Code Style Guidelines

### Lua (Neovim config)
- Use 2-space indentation
- Descriptive variable names (snake_case)
- Proper error handling with `if file then ... end`
- Table formatting: consistent alignment
- Comments: Brief, descriptive comments for complex logic

### Shell Scripts (Bash/Zsh)
- Use `[[ ]]` for conditionals (bash)
- Proper error checking with `command -v` before using tools
- Function definitions: `function_name() { ... }`
- Variable naming: UPPER_CASE for constants, lower_case for locals
- Error messages: Clear usage instructions

### General
- Format on save enabled in editors
- Prettier as default formatter for web technologies
- ESLint for JavaScript/TypeScript validation
### GitHub Copilot (Neovim)
- Plugin: zbirenbaum/copilot.lua
- Toggle: `<leader>ct` (auto-trigger), `<leader>cd` (disable), `<leader>ce` (enable)
- Panel: `<leader>cp` (open suggestions panel)
- Authentication required: `:Copilot auth`
- Disabled for: yaml, gitcommit, help files
- Insert mode shortcuts: `Ctrl+j` (accept), `Ctrl+l` (accept word), `Ctrl+e` (dismiss)

## Platform Considerations

### macOS
- Use Homebrew for package management (`brew install`, `brew bundle`)
- Zsh as default shell
- Keychain integration for SSH keys
- VS Code/VS Code Insiders configurations in Library/Application Support/
- cmux terminal (native macOS app built on libghostty) — reads `~/.config/ghostty/config`
- cmux CLI added to PATH via `shell/.config/zsh/macos.zsh` (app bundle bin directory)
- OpenCode plugins auto-loaded from `config/.config/opencode/plugins/` — no config entry required
- **`aws-auth-check.js` plugin**: checks AWS SSO credential expiry every 5 min on `session.idle`; warns via console + cmux notification when credentials expire within 30 min or have already expired; deduplicates warnings per token so you only see each warning once

### OMArchy/Linux (Arch-based)
- Use pacman for system packages (`sudo pacman -S`)
- Prefer the shared Zsh setup for shell changes; keep Bash for OMArchy/bash-specific compatibility only
- Hyprland window manager with Waybar
- Manual SSH key management
- Custom keybindings for Hyprland (Super+A for ChatGPT, Super+B for Brave)

## File Organization
- Configuration files in `config/.config/`
- Shell configs in `shell/`
- Shared Zsh layers in `shell/.config/zsh/` with `common.zsh`, `macos.zsh`, and `linux.zsh`
- Editor configs in respective directories
- Custom functions in language-specific subdirectories
- Claude Code config in `claude/.claude/` (stow package: `stow claude`)
- Pi extensions in `pi/.config/pi/agent/extensions/` (live via directory folding — no restow needed)

## Development Workflow
1. Edit configuration files directly
2. Test changes by sourcing/restarting relevant applications
3. Use `git` for version control with descriptive commit messages
4. No automated testing - manual verification required

## Troubleshooting

### Neovim Issues
- **Plugin problems**: `:Lazy sync`, `:checkhealth`, `:messages`
- **Copilot not working**: `:Copilot status`, `:Copilot auth`
- **LSP issues**: `:LspInfo`, `:checkhealth lsp`

### Shell Configuration Issues
- **Zsh**: `source ~/.zshrc` or restart terminal; keep shared logic in `~/.config/zsh/common.zsh` and OS-specific logic in `~/.config/zsh/macos.zsh` or `~/.config/zsh/linux.zsh`
- **Bash**: `source ~/.bashrc` or restart terminal
- **Syntax errors**: Use `zsh -n` or `bash -n` to check
- **Repo shell helpers**: Validate scripts in `scripts/` with `bash -n path/to/script.sh`

### LaunchAgent / Cron Issues
- **iCloud sync on macOS**: Prefer a user `LaunchAgent` over `cron` for jobs that read or write `~/Library/Mobile Documents/...` or other TCC-protected locations.
- **Minimum practical permissions**: Grant `Full Disk Access` to `/bin/bash` and `rsync` for the `sync-notes-to-icloud` LaunchAgent workflow.
- **System `rsync` is not sufficient here**: Prefer Homebrew `rsync` (`/opt/homebrew/bin/rsync`, `brew install rsync`) because the macOS-provided `/usr/bin/rsync` can fail with `mmap: Resource deadlock avoided` during large note syncs.
- **Verification**: `launchctl print "gui/$(id -u)/com.fpigeon.sync-notes-to-icloud"` and `tail -n 20 ~/.local/share/logs/sync-notes-to-icloud.log`

### Stow — How It Works in This Repo
- **Stow uses directory folding**: entire directories are symlinked, not individual files. For example, `~/.config/zsh` is a symlink to `~/dotfiles/shell/.config/zsh`, and `~/.zsh_functions` is a symlink to `~/dotfiles/shell/.zsh_functions`. Files inside those directories appear as regular files under `~` but they ARE the dotfiles repo files.
- **Editing dotfiles repo files = live immediately**: because `~/.config/zsh/macos.zsh` resolves to `~/dotfiles/shell/.config/zsh/macos.zsh` via directory symlink, edits take effect on next shell source — no restow needed.
- **`ls -la` on a file inside a folded dir shows `-rw-r--r--` (regular file), not `lrwxr-xr-x`**: this is expected and correct. Check the parent to confirm: `ls -la ~/.config/zsh` should show `lrwxr-xr-x ... -> ../dotfiles/shell/.config/zsh`.
- **Never `rm` a home-path file to force restow**: since the directory is folded, `rm ~/.config/zsh/somefile` deletes the actual dotfiles repo file. Always check the parent symlink first with `ls -la <parent-dir>`.
- **Verify folding is active**: `ls -la ~/.config/zsh ~/.zsh_functions ~/.config/ghostty` — all should show as symlinks into `~/dotfiles/`.

### Stow Conflicts
- Use backup and manual resolution (see README.md)
- Check for broken symlinks: `find ~ -maxdepth 1 -type l ! -exec test -e {} \; -print`
- Verify current stow status: `ls -la ~ | grep dotfiles`

### Logseq CSS
- Two `custom.css` files exist in the `logseq` stow package:
  - `logseq/.logseq/custom.css` → `~/.logseq/custom.css` (global fallback)
  - `logseq/Notes/logseq/custom.css` → `~/Notes/logseq/custom.css` (graph-level, **active**)
- LogSeq reads the graph-level file first; always edit `logseq/Notes/logseq/custom.css`
- Keep both files in sync when making style changes
- Reload LogSeq after CSS changes: `Cmd+Shift+R`

### Ghostty Configuration
- **Reload config**: `Cmd+Shift+,` in Ghostty (no restart needed)
- **Verify active config**: `ghostty +show-config --default=false` (only shows non-default values)
- **Trailing whitespace causes silent truncation**: Ghostty stops parsing the config file at any line with trailing whitespace. All settings after that line are silently ignored. Always check with `rg "\s+$" config/.config/ghostty/config` before debugging missing settings.
- **`copy-on-select = clipboard` on macOS**: On macOS the selection clipboard is not supported, so `copy-on-select = true` (default) falls back to the system clipboard. The `clipboard` value targets both clipboards and is the correct setting, but has been reported broken in some HEAD builds (fixed in 1.3.1). Workaround: use `Cmd+C` after selecting.
- **Config file is a symlink**: `~/.config/ghostty/config` → dotfiles repo (already stowed); no re-stow needed after edits.
- **cmux bundles its own Ghostty**: The `ghostty` binary in PATH comes from `/Applications/cmux.app/Contents/Resources/bin/ghostty` (a HEAD build), not from the Homebrew `Ghostty.app`. `brew upgrade ghostty` does not affect the version used by cmux.
- **SSH doubled keystrokes from cmux**: cmux's bundled Ghostty HEAD build sets `TERM=xterm-ghostty` in SSH sessions, which causes every keystroke to be doubled on the remote host. Workaround: add `SetEnv TERM=xterm-256color` to the SSH host entry in `ssh/.ssh/config`. Filed upstream: https://github.com/manaflow-ai/cmux/issues/2969
- **Ghostty shell integration guard**: `common.zsh` only sources the Ghostty shell integration if `$GHOSTTY_RESOURCES_DIR` is set AND `$GHOSTTY_SHELL_INTEGRATION_FEATURES` is unset AND `$SSH_CONNECTION` is unset AND `$TERM_PROGRAM == ghostty`. This prevents double-registering ZLE hooks over SSH or in non-Ghostty terminals.
- **Global quick terminal hotkey**: `keybind = global:super+grave_accent=toggle_quick_terminal` — the `global:` prefix is the documented way to register a system-wide hotkey on macOS. Requires Accessibility permissions: System Settings → Privacy & Security → Accessibility.

### Git Configuration
- **Email conflicts**: Check per-repo settings with `git config user.email`
- **Authentication**: Test with `ssh -T git@github.com`
- **Branch issues**: Default branch is `main`, not `master`

### Claude Code
- **Config location**: `claude/.claude/` stow package → `~/.claude/settings.json` and `~/.claude/statusline.sh`
- **Stow**: `stow claude` from repo root
- **Bedrock settings baked in**: `CLAUDE_CODE_USE_BEDROCK=1`, `AWS_PROFILE=ClaudeCodeAccess-FlexionLLM`, `AWS_REGION=us-east-2` set via `env` block in `settings.json` — no need to run `flexion-claude` before launching
- **Auto-authentication on launch**: `alias claude='_flexion_ensure_sso && command claude'` in `flexion-claude.zsh` checks SSO session validity before every launch
- **Mid-session auth refresh**: `awsAuthRefresh` in `settings.json` triggers `aws sso login` automatically when credentials expire during a long session
- **Status bar**: `statusLine.command` in `settings.json` points to `~/.claude/statusline.sh` which renders: `[model] 📁 dir | 🌿 branch` / `████░░ 40% | $0.05 | ⏱ 5m 23s | 🔐 AWS: expires at 4:15 PM EDT`
- **Don't set `model`**: omitted from `settings.json` intentionally — Claude Code defaults to its built-in model selection for Bedrock

### Pi Coding Agent
- **Install**: `npm install -g @mariozechner/pi-coding-agent` (not Homebrew — pi.dev only documents npm, the Homebrew formula is community-maintained and lags behind); auth via `/login` after launching `pi`
- **Flexion Bedrock auth**: run `flexion-pi` (wrapper in `shell/.zsh_functions/flexion-claude.zsh`) instead of `pi` directly — it performs AWS SSO login against `ClaudeCodeAccess-FlexionLLM`, exports raw `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`AWS_SESSION_TOKEN` (so pi gets a fully region-scoped SigV4 credential), and passes `--provider amazon-bedrock --model "$PI_MODEL"`
- **`pi` alias on macOS**: `macos.zsh` sets `alias pi='flexion-pi'` so typing `pi` in any macOS shell automatically goes through the Flexion Bedrock wrapper — no need to remember `flexion-pi`
- **SSO session check uses `env-no-export` format**: `flexion_sso_session_valid` calls `aws configure export-credentials --format env-no-export` (not `json`) because the JSON format can trigger a spurious interactive SSO login prompt on some awscli versions when credentials are expired; `env-no-export` fails cleanly with a non-zero exit code instead
- **Current version: v0.70.0**: Upgraded from v0.69.0 on 2026-04-23. Key additions: searchable fuzzy `/login` provider selector; GPT-5.5 Codex support (`openai-codex/gpt-5.5`); OSC 9;4 progress is now **opt-in** (set `terminal.showTerminalProgress: true` in settings — we have this enabled); `--no-builtin-tools` now correctly keeps extension tools active; Bedrock HTTP/2 transport failures auto-retry instead of hanging. Breaking change: OSC 9;4 progress indicators are disabled by default — re-enable via `terminal.showTerminalProgress: true` in `/settings` (already set in our `settings.json`). The `/quit` shutdown crash affecting extensions with custom footers accessing `ctx` is fixed at the framework level (our `isActive` guard in `flexion-aws-status.ts` remains as belt-and-suspenders).
- **Config location**: `$PI_CODING_AGENT_DIR` is exported in `shell/.config/zsh/common.zsh` as `$XDG_CONFIG_HOME/pi/agent` (resolves to `~/.config/pi/agent`), backed by the `pi/` stow package
- **Extensions**: `pi/.config/pi/agent/extensions/` — auto-discovered, live via directory folding, no restow needed after adding files
- **Global AGENTS.md**: `pi/.config/pi/agent/AGENTS.md` — appended to the system prompt for every session; currently instructs the agent to ask clarifying questions one at a time instead of dumping a numbered list
- **`flexion-aws-status.ts` extension**: renders a two-line custom footer showing `[model] 📁 dir | 🌿 branch` / `███░░ 80% | $0.05 | ⏱ 5m 23s | 🔐 AWS: expires at 4:15 PM EDT`; also warns on session_start if credentials are expired or expiring within 30 min; AWS expiry is cached for 5 min and refreshed after each agent turn
- **`web-browse.ts` extension**: registers two LLM-callable tools — `web_fetch` (fetch any URL, returns cleaned readable text) and `web_search` (DuckDuckGo Lite search, returns results list); no API keys required; lets the agent look up AWS announcements, docs, GitHub files, etc. on demand
- **Philosophy**: Keep the config minimal. Pi is built to be extended via prompt templates, skills, and TypeScript extensions rather than via large config files. Only add things when a real task demands them.
- **Prompt templates**: Markdown files in `pi/.config/pi/agent/prompts/` are invoked as `/<filename-without-extension>` in interactive mode. Use `{{args}}` for arguments (pi native syntax).
- **Stow**: `stow pi` from the repo root
- **Verify config is loaded**: launch `pi`, then `/settings` to inspect the active settings, or `/reload` after editing files
- **Not a substitute for opencode**: `config/.config/opencode/` stays as-is; pi runs alongside. No config is shared between the two.
- **pi rewrites settings.json**: Pi merges runtime state (`n` = last changelog version, `defaultModel`, `defaultProvider`, `enabledModels` with provider-prefixed IDs) back into `settings.json` on every session. Always review `git diff pi/` before committing — revert any pi-written drift back to the intentional values in this file.
- **Bedrock model whitelist (Flexion endpoint)**: The `us.` short inference profile IDs are required (`us.anthropic.claude-sonnet-4-6` etc.) — bare model IDs fail with `ValidationException: Invocation of model ID with on-demand throughput isn't supported`. These four are pinned in `enabledModels` so Ctrl+P cycles among them. The endpoint also rejects `thinking.display` on the legacy `thinking: { type: "enabled", budget_tokens }` shape — error: `thinking.enabled.display: Extra inputs are not permitted`. Sonnet 4.6 and Opus 4.7 use the newer `adaptive` thinking shape (see `supportsAdaptiveThinking` in `pi-ai/dist/providers/amazon-bedrock.js`); Sonnet 4.5 and Haiku 4.5 use the legacy shape but the endpoint accepts `display` on those IDs.
- **Other ACTIVE models on the Flexion Bedrock endpoint (as of 2026-04-23)** — not yet tested with pi but available to add to `enabledModels` for experimentation. Use bare model IDs (no `us.` prefix) for non-Anthropic models; test each before pinning as the Flexion endpoint may not support all of them:
  - **Anthropic**: `anthropic.claude-opus-4-6-v1` (Opus 4.6), `anthropic.claude-opus-4-5-20251101-v1:0` (Opus 4.5), `anthropic.claude-opus-4-1-20250805-v1:0` (Opus 4.1)
  - **DeepSeek** ⭐: `deepseek.v3.2` (V3.2, latest — strong coding), `deepseek.v3-v1:0` (V3), `deepseek.r1-v1:0` (R1 reasoning — chain-of-thought)
  - **Qwen** ⭐: `qwen.qwen3-coder-480b-a35b-v1:0` (Coder 480B MoE, coding-focused), `qwen.qwen3-coder-30b-a3b-v1:0` (Coder 30B MoE), `qwen.qwen3-235b-a22b-2507-v1:0` (235B general), `qwen.qwen3-32b-v1:0` (32B general), `qwen.qwen3-next-80b-a3b` (80B), `qwen.qwen3-vl-235b-a22b` (vision+language)
  - **Moonshot AI** ⭐: `moonshot.kimi-k2-thinking` (K2 reasoning), `moonshotai.kimi-k2.5` (K2.5, latest)
  - **OpenAI OSS**: `openai.gpt-oss-120b-1:0` (120B), `openai.gpt-oss-20b-1:0` (20B)
  - **Mistral**: `mistral.mistral-large-3-675b-instruct` (Large 3, 675B), `mistral.devstral-2-123b` (Devstral 2, coding-focused 123B), `mistral.magistral-small-2509` (Magistral Small, reasoning), `mistral.pixtral-large-2502-v1:0` (Pixtral Large, vision), `mistral.ministral-3-14b-instruct` / `mistral.ministral-3-8b-instruct` / `mistral.ministral-3-3b-instruct` (Ministral series, small/fast), `mistral.voxtral-small-24b-2507` / `mistral.voxtral-mini-3b-2507` (audio/speech)
  - **NVIDIA Nemotron**: `nvidia.nemotron-super-3-120b` (120B reasoning), `nvidia.nemotron-nano-3-30b` (30B), `nvidia.nemotron-nano-12b-v2` / `nvidia.nemotron-nano-9b-v2` (nano)
  - **MiniMax**: `minimax.minimax-m2.5` (M2.5, latest), `minimax.minimax-m2.1`, `minimax.minimax-m2`
  - **Z.AI**: `zai.glm-5` (GLM-5), `zai.glm-4.7` / `zai.glm-4.7-flash` (GLM-4.7 series)
  - **Meta**: `meta.llama4-scout-17b-instruct-v1:0` (Llama 4 Scout 17B MoE), `meta.llama4-maverick-17b-instruct-v1:0` (Llama 4 Maverick 17B MoE)
  - **Amazon Nova**: `amazon.nova-2-lite-v1:0` (Nova 2 Lite), `amazon.nova-2-sonic-v1:0` (Nova 2 Sonic, realtime audio)


## Security Guidelines
- **Never commit**: SSH keys, tokens, passwords, API keys
- **Use .env.local**: For sensitive environment variables
- **Review .gitignore**: Before committing changes
- **Sanitize configs**: Remove personal paths/usernames before sharing
- **Backup first**: Always backup existing configs before stowing (see README.md)
- **SSH config**: Only configuration, never actual keys
