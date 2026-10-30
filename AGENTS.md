# Agent Guidelines for Dotfiles Repository

## Repo Structure
- Managed with GNU Stow — each top-level directory is a stow package
- Config files live under `<package>/<stow-target-path>` (e.g. `shell/.config/zsh/`)
- Stow uses directory folding: `~/.config/zsh` is a symlink to `~/dotfiles/shell/.config/zsh`
- Edits to files inside folded dirs take effect immediately — no restow needed
- Never `rm` a file under a folded stow path; it deletes the real dotfiles file

## Code Style
- **Lua**: 2-space indent, 120 col width (`stylua --config ~/.config/nvim/stylua.toml`)
- **Shell**: `[[ ]]` for conditionals, `command -v` before using tools, snake_case locals
- **JS/TS**: `npx prettier --write` (2-space indent)

## Lint / Syntax Check
- Zsh: `zsh -n ~/.zshrc`
- Bash: `bash -n ~/.bashrc`
- Shell scripts in `scripts/`: `bash -n scripts/<file>.sh`
- Lua: `stylua --config ~/.config/nvim/stylua.toml .`
- Organization-specific GFE profiles are maintained in the separate Helix dotfiles collection.

## Platform
- macOS: Homebrew, Zsh default shell
- Linux (OMArchy/Arch): pacman, Hyprland, Bash for OMArchy-specific compat
- Shared Zsh logic → `shell/.config/zsh/common.zsh`; OS-specific → `macos.zsh` / `linux.zsh`

## Key Package Locations
- Shell config: `shell/.config/zsh/`
- Neovim: `config/.config/nvim/`
- Ghostty: `config/.config/ghostty/`
- Herdr: `herdr/.config/herdr/`
- Pi agent: `pi/.config/pi/agent/` (personal/contractor)
- Claude Code: `claude/.claude/`
- OpenCode: `config/.config/opencode/` (personal/contractor)

## Safety
- Never commit SSH keys, tokens, API keys, or passwords
- Secrets go in `~/.config/zsh/local.zsh` (not tracked)
- Review `.gitignore` before staging new files
