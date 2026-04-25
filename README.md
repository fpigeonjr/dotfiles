# Dotfiles

Personal configuration files managed with [GNU Stow](https://www.gnu.org/software/stow/).

## ⚠️ Important Notes

### Git Configuration
- **Default email**: Set to personal email 
- **Work projects**: Manually configure work email per repository:
  ```bash
  cd ~/Code/work-project
  git config user.email "work@example.com"
  ```

### Breaking Changes from Previous Configs
- **Default branch**: Uses `main` (not `master`)
- **Pull strategy**: Uses `rebase` by default for cleaner history
- **Email**: Defaults to personal email (override per project as needed)
- **New aliases**: Added `co`, `br`, `ci`, `st` for common git commands

### Cross-Platform Compatibility
This repo is organized around a shared Zsh setup plus OS-specific overlays:
1. **Shared shell base**: `shell/.zshrc` loads `shell/.config/zsh/common.zsh`
2. **OS overlays**: `shell/.config/zsh/macos.zsh` and `shell/.config/zsh/linux.zsh`
3. **Local overrides**: Copy `shell/.config/zsh/local.zsh.example` to `~/.config/zsh/local.zsh` for machine-specific settings and secrets

When using on Linux systems that have existing git configs:
1. **Backup existing config**: `cp ~/.gitconfig ~/.gitconfig.backup`
2. **Check for conflicts**: Compare settings before stowing
3. **Merge manually if needed**: Combine useful settings from both configs

### OMArchy/Hyprland Integration
The Hyprland configuration is designed for [OMArchy](https://omarchy.org) systems:
- **Keybindings**: Custom app launchers (Super+A for ChatGPT, Super+B for Brave)
- **Theme integration**: Sources OMArchy theme system
- **Hardware**: Configured for modern displays with proper scaling
- **Input**: Natural touchpad scrolling and fingerprint authentication

Note: Hyprland configs only apply to OMArchy/Linux systems with Hyprland installed.

### Machine-Specific Linux Fixes
- `scripts/install-lid-wakeup-fix.sh`: Installs a small systemd service that disables ACPI lid wakeup on boot for laptops that immediately wake from suspend with the lid open.
- This is intentionally managed as an install script plus service template instead of a stowed `~/.config` file, because it writes to `/etc/systemd/system/` and is machine-specific.

### Worktrunk for OPRE OPS
- **Local override**: `~/.config/worktrunk/config.toml` includes a repo-specific override for `github.com/HHS/OPRE-OPS`
- **Why**: Worktrunk's default sibling worktree naming can preserve uppercase repo names, which breaks Podman/Lazydocker compose project naming
- **Behavior**: New OPRE OPS worktrees are created under `.worktrees/{{ branch | sanitize_db }}` so paths stay lowercase-safe
- **Shell integration**: Loaded in `shell/.config/zsh/common.zsh` — enables auto-cd after `wt switch` and tab completions (no-op if `wt` is not installed)

### OpenCode
- **Global config**: `config/.config/opencode/opencode.json` is stowed to `~/.config/opencode/opencode.json`
- **Custom agents**: Store reusable agents in `config/.config/opencode/agents/`
- **Current custom agent**: `study.md` adds a primary study mode focused on guided learning, hints, and knowledge checks
- **Plugins**: Global plugins live in `config/.config/opencode/plugins/` and are auto-loaded at startup (no config entry needed)
- **Current plugin**: `cmux-notify.js` fires `cmux notify` on `session.idle`, `session.error`, and `permission.asked` — triggers the blue pane ring and sidebar badge in cmux. Safe outside cmux (gated on `CMUX_SOCKET_PATH`)
- **Apply changes**: Run `stow -R config` from `~/dotfiles` after adding or updating OpenCode config files

### cmux
- **What it is**: Native macOS terminal built on libghostty with vertical tabs, notification rings, and an in-app browser — designed for running multiple AI coding agents in parallel
- **Reads existing Ghostty config**: No separate cmux config needed; it uses `~/.config/ghostty/config` for fonts, themes, and colors
- **CLI on PATH**: `macos.zsh` adds `/Applications/cmux.app/Contents/Resources/bin` to PATH automatically when cmux is installed
- **OpenCode integration**: `cmux omo` launches OpenCode with the `oh-my-opencode` plugin in a shadow config — each subagent gets its own native cmux pane. Your `~/.config/opencode/` is never modified
- **Notification ring**: `cmux-notify.js` plugin bridges OpenCode session events to cmux's visual pane ring
- **Install**: `brew tap manaflow-ai/cmux && brew install --cask cmux`

### Amazon Bedrock Model Access
- **Profile**: `ClaudeCodeAccess-FlexionLLM` in `us-east-2` (managed by Flexion org via AWS IAM Identity Center)
- **Permitted providers**: Anthropic (Claude), DeepSeek, Meta Llama, Amazon Nova, Mistral, Qwen, MiniMax, Moonshot AI (Kimi), Z.AI (GLM), NVIDIA Nemotron, Google Gemma, Writer Palmyra, OpenAI OSS, TwelveLabs Pegasus
- **Auto-discovery**: `bedrock:ListFoundationModels` is now permitted — OpenCode will discover models available in `us-east-2`. However, discovered models may still fail if they require an inference profile or don't support tool call streaming
- **Verified working** (tool calls + streaming): `qwen3-coder-480b`, `nova-pro`, `kimi-k2.5`, `minimax-m2.5`, `glm-5`, `gemma-3-27b`, `ministral-14b`, `gpt-oss-120b`, `gpt-oss-20b`
- **Confirmed working recently**: `nova-2-lite`, `qwen3-next-80b`
- **Blocked by IAM in `us-east-2`**: `kimi-k2-thinking` — denied on `bedrock:InvokeModelWithResponseStream` for `moonshot.kimi-k2-thinking`
- **Configured but not yet verified here**: `claude-opus-4-6`, `mistral-large`, `devstral`, `qwen3-coder-30b`, `llama4-scout`
- **Requires inference profile** (use `us.` prefix): `llama4-maverick` — must use `us.meta.llama4-maverick-17b-instruct-v1:0`
- **DeepSeek**: IAM policy permits `deepseek.*`; R1 (`deepseek-r1`) is configured with `tool_call: false` — useful for reasoning/analysis but not agentic tasks
- **Nova Premier**: Access denied — requires 30 days of prior active usage per AWS policy
- **Magistral Small**: Works but over-eager, makes unnecessary tool calls for simple tasks
- **Tool call limitation**: `tool_call: false` in the config is currently ignored by upstream OpenCode — tools are always sent, causing failures on models that don't support streaming + tool use. Tracked upstream at [anomalyco/opencode#19966](https://github.com/anomalyco/opencode/issues/19966), fix pending in [anomalyco/opencode#20040](https://github.com/anomalyco/opencode/pull/20040). A colleague's Flexion fork ([flexion/opencode, `flex` branch](https://github.com/flexion/opencode/tree/flex)) already ships this fix — worth watching for when it merges upstream
- **Models with `tool_call: false`**: `llama4-maverick`, `llama4-scout`, `deepseek-r1` — usable for read-only/chat queries now, but will fail in agentic sessions until the upstream fix lands
- **Adding new models**: Find the Bedrock model ID in the [AWS docs](https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html) and add an entry under `provider.amazon-bedrock.models` in `opencode.json`

### Pi Agent `models.json`
- **Do not create `~/.config/pi/agent/models.json` to override Bedrock model metadata.** The `pi-ai` package ships a bundled `models.generated.js` with correct `contextWindow`, `maxTokens`, and real per-token `cost` values for all Bedrock models.
- Overriding with a local `models.json` (even with zeros or conservative window sizes) silently replaces the bundled values — causing the context fill bar to saturate too early, premature compaction, and `$0.000` cost in the footer.
- Only add `models.json` for genuinely custom providers (Ollama, vLLM, proxies) or models not yet in the bundled registry. Check `node_modules/@mariozechner/pi-ai/dist/models.generated.js` first before adding any entry.

### Model Cheat Sheet

| Model | Best For | Speed | Notes |
|---|---|---|---|
| `claude-sonnet-4-6` | Reliable everyday work | Medium | Previous default |
| `claude-haiku-4-5` | Small model, cheap follow-ups | Fast | Current `small_model` |
| `kimi-k2.5` | General coding, alternative default | Medium | Good Bedrock non-Claude default |
| `qwen3-coder-480b` | Complex coding, large refactors | Slow | Largest coding-specific model |
| `qwen3-coder-30b` | Everyday coding, faster Qwen | Fast | Can hallucinate on simple tasks |
| `qwen3-next-80b` | General coding, faster Qwen | Fast | Good candidate for cheaper day-to-day use |
| `gpt-oss-120b` | General coding, alternative to Kimi | Medium | OpenAI open-weight on Bedrock |
| `gpt-oss-20b` | Fast tasks, lightweight coding | Fast | Smaller GPT OSS variant |
| `nova-2-lite` | Long-context reasoning, AWS-native | Fast | Newer Nova option with large context window |
| `nova-pro` | General purpose, AWS-native | Fast | Amazon's flagship, reliable |
| `gemma-3-27b` | General coding | Medium | Google, clean responses |
| `glm-5` | General coding | Medium | Z.AI, good quality |
| `minimax-m2.5` | Titles, summaries, small tasks | Very fast | Fast Bedrock utility model |
| `ministral-14b` | Lightweight coding tasks | Fast | Mistral small model |
| `mistral-large` | Reasoning-heavy tasks | Medium | Mistral's flagship, 4.4s |
| `devstral` | Coding-specific (Mistral) | Fast | Mistral coding model, 4.4s |
| `llama4-maverick` | Multimodal, general | Medium | No tool calls on Bedrock; chat/read-only only |
| `llama4-scout` | Huge context, multi-doc analysis | Medium | 10M token context; no tool calls on Bedrock |
| `deepseek-r1` | Hard reasoning, math, STEM | Slow | Chain-of-thought; no tool calls on Bedrock; 64K context |
| `deepseek-v3.2` | Coding, general (latest DeepSeek) | Medium | Newer/stronger than V3; bare model ID `deepseek.v3.2` |
| `claude-opus-4-7` | Default, highest reliability | Medium | **Current default** (pi) |
| `claude-opus-4-6` | Hardest coding and review tasks | Slow | Strong upgrade path when Sonnet is not enough |

**Quick picks:**
- Default everyday work → `claude-opus-4-7` (pi), `claude-sonnet-4-6` (OpenCode)
- Hard problem / big codebase → `qwen3-coder-480b`
- Need speed → `claude-haiku-4-5`, `qwen3-next-80b`, or `minimax-m2.5`
- AWS-native long context → `nova-2-lite`
- Claude reliability → `claude-opus-4-7` or `claude-sonnet-4-6`

## Structure

```
dotfiles/
├── claude/          # Claude Code configuration
│   └── .claude/
│       ├── settings.json  # Bedrock/SSO settings, status bar command
│       └── statusline.sh  # Status bar renderer
├── config/          # Modern config files (~/.config/)
│   └── .config/
│       ├── ghostty/ # Ghostty terminal configuration
│       ├── opencode/ # OpenCode config and custom agents
│       ├── hypr/    # Hyprland window manager (OMArchy)
│       ├── nvim/    # Neovim configuration (LazyVim + GitHub Copilot)
│       ├── waybar/  # Waybar status bar (OMArchy) with VPN module
│       └── zed/     # Zed editor settings and keymaps
├── git/             # Git configuration
│   ├── .gitconfig
│   └── .gitignore_global
├── homebrew/        # Homebrew package management
│   └── Brewfile     # List of installed packages
├── pi/              # Pi coding agent configuration
│   └── .config/pi/agent/
│       ├── AGENTS.md        # Global system prompt additions
│       ├── settings.json    # Model whitelist, provider, thinking level
│       ├── extensions/      # Auto-discovered TypeScript extensions
│       │   └── flexion-aws-status.ts  # Footer, AWS expiry, cmux notify
│       └── prompts/         # Slash-command prompt templates
├── scripts/         # Utility scripts
│   ├── wt-clean.sh  # Clean up stale worktrunk worktrees
│   ├── pi-pihole-restore.sh # Restore Pi-hole configuration
│   └── install-lid-wakeup-fix.sh # Systemd service for lid wakeup fix
├── logseq/          # Logseq knowledge management
│   ├── .logseq/
│   │   ├── config/
│   │   │   ├── config.edn    # Global shortcuts and settings
│   │   │   └── plugins.edn   # Installed plugins list
│   │   ├── custom.css        # Global Logseq custom styling (fallback)
│   │   ├── settings/
│   │   │   ├── logseq-everforest-theme.json
│   │   │   └── logseq-journals-calendar.json
│   │   └── preferences.json  # UI preferences and themes
│   └── Notes/logseq/
│       └── custom.css        # Graph-level custom CSS (active — takes precedence)
├── shell/           # Shell configuration
│   ├── .bash_functions/
│   │   └── image-tools.bash  # Bash image utilities
│   ├── .zsh_functions/
│   │   └── image-tools.zsh
│   ├── .bashrc           # Enhanced bash config (Arch Linux/OMArchy)
│   ├── .bash_profile     # Bash profile (sources .bashrc)
│   ├── .config/zsh/      # Shared + OS-specific Zsh config layers
│   ├── .env.local
│   └── .zshrc            # Cross-platform Zsh entrypoint
├── ssh/             # SSH client configuration
│   └── .ssh/
│       └── config
├── vim/             # Vim configuration
│   └── .vimrc
├── vscode/          # VS Code configuration
│   └── Library/Application Support/Code/User/
│       ├── settings.json
│       └── keybindings.json
└── vscode-insiders/ # VS Code Insiders configuration
    └── Library/Application Support/Code - Insiders/User/
        ├── settings.json
        └── keybindings.json
```

## Prerequisites

- [GNU Stow](https://www.gnu.org/software/stow/)
- [Oh My Zsh](https://ohmyzsh.sh/) (optional, for Zsh plugins/theme)
- [Neovim](https://neovim.io/) (for nvim config)

### Install Stow

**macOS (Homebrew):**
```bash
brew install stow
```

**Arch Linux:**
```bash
sudo pacman -S stow
```

## Installation

### Fresh Machine Setup

1. **Install prerequisites:**
   ```bash
   # Install Homebrew (if not already installed)
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   
   # Install Stow
   brew install stow
   ```

2. **Clone the repository:**
   ```bash
   git clone <your-repo-url> ~/dotfiles
   cd ~/dotfiles
   ```

3. **Install packages from Brewfile:**
    ```bash
    brew bundle install --file=homebrew/Brewfile
    ```

   On Linux, install the shell dependencies you want manually (`zsh`, `fnm`, `zoxide`, `fastfetch`, etc.) or with your distro package manager.

4. **Stow packages individually:**
   ```bash
   stow git          # Git configuration
   stow shell        # Cross-platform Zsh, Bash, profile, functions
   stow vim          # Vim configuration
   stow config       # App configs including Ghostty, Neovim, Zed, and Hyprland
   stow ssh          # SSH client config
   stow aws          # AWS CLI config (SSO profile for Flexion Bedrock)
   stow vscode       # VS Code settings and keybindings
   stow vscode-insiders # VS Code Insiders settings
   stow logseq       # Logseq configuration
   stow homebrew     # Homebrew Brewfile
   stow claude       # Claude Code settings and statusline
   stow pi           # Pi coding agent config, extensions, and prompts
   ```

   **Important**: After stowing `shell`, verify the zsh config directory is properly linked:
   ```bash
   ls -la ~/.config/zsh  # Should show: ~/.config/zsh -> ../dotfiles/shell/.config/zsh
   ```
   
   This symlink is critical for the modular zsh configuration to work. If it's missing, run:
   ```bash
   cd ~/dotfiles
   stow -R shell
   ```

5. **Or stow all packages at once:**
   ```bash
   stow */
   ```

### Existing Machine (Update)

If you already have some configs and want to adopt them:

1. **Pull latest changes:**
   ```bash
   cd ~/dotfiles
   git pull
   ```

2. **Stow with adopt flag to take over existing files:**
   ```bash
   stow --adopt packagename  # For specific package
   # or
   stow --adopt */           # For all packages
   ```

## Usage

### Zsh Layout

- `~/.zshrc` detects the OS and loads shared config first
- `~/.config/zsh/common.zsh` holds portable aliases, tool init, and function loading
- `~/.config/zsh/macos.zsh` holds Homebrew and macOS-specific behavior
- `~/.config/zsh/linux.zsh` holds Linux clipboard and path behavior
- `~/.config/zsh/local.zsh` is optional and stays machine-specific

### Raspberry Pi Pi-hole Rebuild

After flashing a fresh Bookworm card, enabling SSH, and installing Pi-hole, you can restore the saved Pi-hole config with:

```bash
./scripts/pi-pihole-restore.sh
```

The script expects the backup set at `~/Downloads/pi-pre-upgrade-backups/20260310-150325` by default and can target a different host or backup directory with `--host` and `--backup-dir`.

### Cleaning Up Stale Worktrunk Worktrees

Use the `wt-clean` helper script to remove stale git worktrees created with [worktrunk](https://worktrunk.dev):

```bash
# Interactive mode (shows what will be removed, asks for confirmation)
wt-clean

# Dry run (see what would be removed without actually removing)
wt-clean --dry-run

# Remove without confirmation
wt-clean --force

# Verbose output
wt-clean -v
```

The script identifies and removes:
- **Prunable worktrees**: Directories that were manually deleted with stale metadata
- **Integrated worktrees**: Branches merged into main (safe to delete)
- **Empty worktrees**: Same commit as main with clean working tree

Requirements: `wt` (worktrunk) and `jq` installed (both available via Homebrew).

The script lives in `scripts/wt-clean.sh`. To make it available on PATH, symlink it to `~/.local/bin` (the convention used in this repo):

```bash
ln -sf ~/dotfiles/scripts/wt-clean.sh ~/.local/bin/wt-clean
```

### LogSeq Asset Compression (`scripts/compress-logseq-assets.sh`)

Compresses PNG, JPEG, and HEIC images in a LogSeq `assets/` directory to WebP format and updates all markdown link references in `pages/` and `journals/`. Handles all four LogSeq link patterns (`![alt](../assets/...)`, `![[filename]]`, `file::`, and `file-path::`).

**Two modes:**

- `--migrate`: One-time full migration of all existing images. Creates a `asset-compression` git branch, handles HEIC files via `sips`, and requires a clean working tree.
- `--incremental`: Only converts new images (those without an existing `.webp` sibling). Safe to re-run; idempotent.

Both modes accept `--dry-run` (default, no changes) or `--execute` (performs the conversion).

**Requirements:** `cwebp` (`brew install webp`), `sips` (built into macOS, needed for `--migrate` only).

**Initial migration (run once):**
```bash
# Preview
compress-logseq-assets --migrate --dry-run

# Execute (creates asset-compression branch, converts everything, updates links)
compress-logseq-assets --migrate --execute
```

**Symlink to PATH:**
```bash
ln -sf ~/dotfiles/scripts/compress-logseq-assets.sh ~/.local/bin/compress-logseq-assets
```

**LaunchAgent job (Mac Mini — run weekly to compress newly added images):**

Install the bundled LaunchAgent and load it in the user domain:
```bash
mkdir -p ~/Library/LaunchAgents ~/.local/share/logs
ln -sf ~/dotfiles/scripts/com.fpigeon.compress-logseq-assets.plist \
  ~/Library/LaunchAgents/com.fpigeon.compress-logseq-assets.plist
launchctl bootout "gui/$(id -u)" ~/Library/LaunchAgents/com.fpigeon.compress-logseq-assets.plist 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/com.fpigeon.compress-logseq-assets.plist
launchctl enable "gui/$(id -u)/com.fpigeon.compress-logseq-assets"
launchctl kickstart -k "gui/$(id -u)/com.fpigeon.compress-logseq-assets"
```

This LaunchAgent runs every Sunday at `03:00`, uses the same `--incremental --execute` behavior as the old cron entry, injects the Homebrew-friendly PATH, and logs to `~/.local/share/logs/compress-logseq-assets.log`. New images pasted into LogSeq during the week are compressed before the next iCloud sync picks them up.

**Sync job (every 15 minutes):**
```bash
mkdir -p ~/Library/LaunchAgents ~/.local/share/logs ~/.local/state
ln -sf ~/dotfiles/scripts/com.fpigeon.sync-notes-to-icloud.plist \
  ~/Library/LaunchAgents/com.fpigeon.sync-notes-to-icloud.plist
launchctl bootout "gui/$(id -u)" ~/Library/LaunchAgents/com.fpigeon.sync-notes-to-icloud.plist 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/com.fpigeon.sync-notes-to-icloud.plist
launchctl enable "gui/$(id -u)/com.fpigeon.sync-notes-to-icloud"
launchctl kickstart -k "gui/$(id -u)/com.fpigeon.sync-notes-to-icloud"
```

This LaunchAgent runs every 15 minutes and once when loaded. The script still writes its own detailed sync log to `~/.local/share/logs/sync-notes-to-icloud.log`, and `launchd` stdout/stderr go to `~/.local/share/logs/launchd-sync-notes-to-icloud.log`.

### Export-Style Sync Behavior

The sync script uses an **export-style** approach that minimizes iCloud Drive traversal issues:

1. **Staging**: Creates a clean staging area at `~/.local/state/sync-notes-to-icloud-staging/`
2. **Selective copy**: Only copies `journals/`, `pages/`, `assets/`, `logseq/`, `whiteboards/` and select top-level files (config files are optional — only included if they exist)
3. **Protected paths**: The `logseq/bak/` directory is protected from deletion (preserves Logseq's automatic backups)
4. **Verification**: After sync, verifies key files (today's journal, conventions page) by size to ensure delivery
5. **Error handling**: Treats rsync exit codes 23 (partial transfer) and 11 (EDEADLK - iCloud file locks) as success if verification passes

After both agents are loaded, remove the old cron entries with `crontab -e` or `crontab -r` after confirming the LaunchAgents are running.

**Troubleshooting findings (2026-04-17):**

- The old cron-based sync was running on schedule, but failed against `~/Library/Mobile Documents/...` with `Operation not permitted`.
- The failure was not caused by Unix file permissions. Script execute bits, ownership, and log directory permissions were already correct.
- The root cause was macOS privacy/TCC access for the non-interactive job context. Moving the sync from `cron` to a user `LaunchAgent` was the correct scheduler change for iCloud Drive access.
- The minimum practical permission change for this setup was granting `Full Disk Access` to `/bin/bash` and `rsync`, because those are the executables the LaunchAgent runs during sync. After that change, the iCloud permission error stopped.
- The built-in macOS `/usr/bin/rsync` was still unreliable for this workload and produced `mmap: Resource deadlock avoided` errors on files in `~/Notes`.
- Installing Homebrew `rsync` fixed the remaining sync failures. The sync script now prefers `/opt/homebrew/bin/rsync` automatically when available and logs which binary it used on each run.
- A successful verification run completed at `2026-04-17 21:26:14`, with the log showing `Using rsync binary: /opt/homebrew/bin/rsync` followed by `Sync completed successfully.`

**Recommended macOS setup for `sync-notes-to-icloud.sh`:**

- Scheduler: user `LaunchAgent`, not `cron`
- Permissions: `Full Disk Access` for `/bin/bash` and `rsync`
- `rsync`: Homebrew `rsync` (`brew install rsync`), not the system `/usr/bin/rsync`
- Verification:
  - `launchctl print "gui/$(id -u)/com.fpigeon.sync-notes-to-icloud"`
  - `tail -n 20 ~/.local/share/logs/sync-notes-to-icloud.log`

**Recovery:** If anything goes wrong, the Notes repo has a `pre-asset-compression-YYYYMMDD` git tag to restore from.

### Adding New Configurations

1. **Create a new package directory:**
   ```bash
   mkdir ~/dotfiles/newpackage
   ```

2. **Move your dotfiles to the package:**
   ```bash
   mv ~/.someconfig ~/dotfiles/newpackage/
   ```

3. **Stow the new package:**
   ```bash
   cd ~/dotfiles
   stow newpackage
   ```

### Updating Configurations

Simply edit the files in your dotfiles directory. Changes are immediately reflected since they're symlinked.

### Adding New Files to Existing Packages

1. **Add the file to the appropriate package directory**
2. **Re-stow if necessary:**
   ```bash
   stow -R packagename  # Restow to pick up new files
   ```

## Maintenance

### Backup Before Major Changes
```bash
# Create a backup branch before major updates
git checkout -b backup-$(date +%Y%m%d)
git checkout main
```

### Keep Dependencies Updated
- Update Oh My Zsh: `omz update`
- Update Neovim plugins: `:Lazy sync` in nvim
- Update Homebrew packages: `brew upgrade`
- Regenerate Brewfile: `brew bundle dump --force --file=homebrew/Brewfile`

### Sync Across Machines
```bash
# On machine A (after making changes)
git add .
git commit -m "Update configurations"
git push

# On machine B
git pull
stow -R */  # Restow all packages
```

## Troubleshooting

### Before First-Time Setup: Backup Existing Configs

**Always backup existing configurations before stowing for the first time:**
```bash
# Create backup directory
mkdir -p ~/config-backup/$(date +%Y%m%d)

# Backup common config files
cp ~/.gitconfig ~/config-backup/$(date +%Y%m%d)/ 2>/dev/null || true
cp ~/.zshrc ~/config-backup/$(date +%Y%m%d)/ 2>/dev/null || true
cp ~/.vimrc ~/config-backup/$(date +%Y%m%d)/ 2>/dev/null || true
cp -r ~/.config/nvim ~/config-backup/$(date +%Y%m%d)/ 2>/dev/null || true
cp -r ~/.config/zed ~/config-backup/$(date +%Y%m%d)/ 2>/dev/null || true
cp -r ~/.config/hypr ~/config-backup/$(date +%Y%m%d)/ 2>/dev/null || true
cp ~/Library/Application\ Support/Code/User/settings.json ~/config-backup/$(date +%Y%m%d)/vscode-settings.json 2>/dev/null || true
cp -r ~/.logseq/config ~/config-backup/$(date +%Y%m%d)/ 2>/dev/null || true
cp ~/.logseq/preferences.json ~/config-backup/$(date +%Y%m%d)/ 2>/dev/null || true

echo "Backup created in ~/config-backup/$(date +%Y%m%d)/"
```

### How Stow Works (Directory Folding)

Stow uses **directory folding** — rather than symlinking individual files, it symlinks entire directories when it can. For example, after `stow shell`, `~/.config/zsh` is a symlink pointing to `~/dotfiles/shell/.config/zsh`. Files inside that directory appear as regular files under `~` but *are* the repo files.

```bash
# Confirm a directory is folded (look for -> in output)
ls -la ~/.config/zsh
# lrwxr-xr-x ... ~/.config/zsh -> ../dotfiles/shell/.config/zsh

# A file inside a folded dir shows as a regular file — this is correct
ls -la ~/.config/zsh/common.zsh
# -rw-r--r-- ... (not a symlink, but edits go directly into the repo)
```

**Key implications:**
- Editing a file inside a folded directory edits the dotfiles repo file directly — changes are live immediately, no restow needed.
- **Never `rm` a file inside a folded stow path** — it deletes the actual repo file, not a symlink.
- If you need to add a new file to a package that's already stowed, just create it in the repo and run `stow -R <package>` to pick it up.

```bash
# Verify key directories are properly folded
ls -la ~/.config/zsh ~/.config/ghostty ~/.zsh_functions
# All should show as symlinks into ~/dotfiles/
```

### Stow Conflicts

When stow reports "cannot stow over existing target", you have three options:

**Method 1: Manual backup and removal (Recommended - Safest)**
```bash
# Backup the conflicting file first
cp ~/.conflicting-file ~/.conflicting-file.backup

# Remove the conflicting file
rm ~/.conflicting-file

# Then stow normally
stow packagename

# If issues occur, restore from backup:
# cp ~/.conflicting-file.backup ~/.conflicting-file
```

**Method 2: Using -R flag (Only for already-stowed packages)**
```bash
# This only works if the package was previously stowed successfully
# -R (restow) removes existing symlinks, then recreates them
stow -R packagename

# Note: -R will FAIL if there are actual file conflicts
# It only removes symlinks it previously created
```

**Method 3: Using --adopt flag (Advanced - Modifies your dotfiles repo)**
```bash
# CAUTION: This modifies your dotfiles repo!
stow --adopt packagename
```

⚠️ **Critical Notes about `--adopt`:**
- Takes existing files from your system and **overwrites** files in your dotfiles repo
- Your carefully crafted configurations will be replaced with current system files
- Always run `git diff` after using `--adopt` to see what changed
- Only commit if you actually want to keep the system versions over your dotfiles versions
- This is useful when setting up dotfiles on a machine with existing configs you prefer

**Safe workflow with --adopt:**
```bash
# 1. Create a backup branch first
git checkout -b backup-before-adopt-$(date +%Y%m%d)
git checkout main

# 2. Try adopt
stow --adopt packagename

# 3. MANDATORY: Review what changed
git diff

# 4. Decision point:
# Keep adopted changes: git add . && git commit -m "Adopt system configs"
# Revert adopted changes: git checkout -- .
```

### Restoring from Backup

If something goes wrong after stowing:
```bash
# Unstow the problematic package
stow -D packagename

# Restore from backup
cp ~/config-backup/YYYYMMDD/.configfile ~/.configfile

# Fix issues, then try stowing again
```

### Other Common Issues

**Code Style Reference:**

| Language | Style | Formatter |
|----------|-------|-----------|
| Lua (Neovim) | 2-space indent, 120 col width | `stylua --config ~/.config/nvim/stylua.toml .` |
| Shell (Bash/Zsh) | `[[ ]]` conditionals, `command -v` guards, snake_case locals | `shellcheck` (if available) |
| JavaScript/TypeScript | Prettier defaults | `npx prettier --write .` + `npx eslint .` |

Syntax-check shell configs before sourcing:
```bash
zsh -n ~/.zshrc          # Zsh syntax check
bash -n ~/.bashrc         # Bash syntax check
bash -n scripts/foo.sh   # Any script in scripts/
```

**Neovim / GitHub Copilot keybindings** (plugin: `zbirenbaum/copilot.lua`):

| Mode | Key | Action |
|------|-----|--------|
| Normal | `<leader>ct` | Toggle auto-suggest |
| Normal | `<leader>cd` | Disable Copilot |
| Normal | `<leader>ce` | Enable Copilot |
| Normal | `<leader>cp` | Open suggestions panel |
| Insert | `Ctrl+j` | Accept suggestion |
| Insert | `Ctrl+l` | Accept next word |
| Insert | `Ctrl+e` | Dismiss suggestion |

Copilot is disabled for: `yaml`, `gitcommit`, `help` filetypes. Run `:Copilot auth` if authentication is needed.

**Ghostty config settings being silently ignored:**

Ghostty stops parsing the config file at any line with trailing whitespace — all settings after that line are dropped with no error. Symptoms include settings appearing in the file but having no effect.

```bash
# Check for trailing whitespace
rg "\s+$" config/.config/ghostty/config

# Verify what Ghostty actually loaded
ghostty +show-config --default=false
```

**`copy-on-select = clipboard` not working on macOS:**

This is a known bug in Ghostty builds prior to 1.3.1. The `clipboard` value is the correct setting (copies selection to the system clipboard automatically), but may be silently ignored on affected builds. Workaround: use `Cmd+C` after selecting text, then `Cmd+V` to paste.

**Broken Symlinks:**
```bash
# Find broken symlinks
find ~ -maxdepth 1 -type l ! -exec test -e {} \; -print

# Remove broken symlinks
find ~ -maxdepth 1 -type l ! -exec test -e {} \; -delete
```

**Verify Stow Status:**
```bash
# Check what's currently stowed
ls -la ~ | grep dotfiles

# Check specific config directories
ls -la ~/.config/ | grep dotfiles
```

**Complete Reset (Nuclear option):**
```bash
# Unstow everything
cd ~/dotfiles
stow -D */

# Restore all from backup
cp -r ~/config-backup/YYYYMMDD/* ~/

# Start fresh with stowing
```

## Security Notes

- SSH keys and sensitive data are excluded via `.gitignore`
- Only configuration files are tracked, not secrets
- Review `.env.local` for sensitive environment variables

## Package Overview

| Package | Contains | Purpose |
|---------|----------|---------|
| `git` | .gitconfig, .gitignore_global | Git settings and global ignores |
| `shell` | .bashrc, .bash_profile, .zshrc, .env.local, functions | Shell configuration (bash for Arch/OMArchy, zsh for macOS) |
| `vim` | .vimrc | Traditional Vim settings |
| `config` | .config/nvim/, .config/zed/, .config/hypr/, .config/waybar/, .config/ghostty/, .config/opencode/ | Modern app configurations (Neovim includes GitHub Copilot; OpenCode config, agents, and plugins) |
| `ssh` | .ssh/config | SSH client settings (no keys) |
| `aws` | .aws/config | AWS CLI SSO profile for Flexion Bedrock access |
| `vscode` | settings.json, keybindings.json | VS Code configuration |
| `vscode-insiders` | settings.json, keybindings.json | VS Code Insiders configuration |
| `logseq` | .logseq/config/, .logseq/custom.css, .logseq/settings/, .logseq/preferences.json, Notes/logseq/custom.css | Logseq knowledge management settings, plugins, and graph-level CSS (graph CSS takes precedence over global) |
| `homebrew` | Brewfile | Homebrew package list for easy setup |
| `claude` | .claude/settings.json, .claude/statusline.sh | Claude Code Bedrock/SSO config and status bar renderer |
| `pi` | .config/pi/agent/ | Pi coding agent settings, extensions, and prompt templates |

## Dependencies

- **Zsh plugins:** zsh-syntax-highlighting
- **Neovim:** LazyVim distribution
- **Tools:** fnm, zoxide, fastfetch, podman
- **macOS specific:** Uses Keychain for SSH keys
