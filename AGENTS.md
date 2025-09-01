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
- Ghostty terminal emulator

### OMArchy/Linux (Arch-based)
- Use pacman for system packages (`sudo pacman -S`)
- Bash as default shell
- Hyprland window manager with Waybar
- Manual SSH key management
- Custom keybindings for Hyprland (Super+A for ChatGPT, Super+B for Brave)

## File Organization
- Configuration files in `config/.config/`
- Shell configs in `shell/`
- Editor configs in respective directories
- Custom functions in language-specific subdirectories

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
- **Zsh**: `source ~/.zshrc` or restart terminal
- **Bash**: `source ~/.bashrc` or restart terminal
- **Syntax errors**: Use `zsh -n` or `bash -n` to check

### Stow Conflicts
- Use backup and manual resolution (see README.md)
- Check for broken symlinks: `find ~ -maxdepth 1 -type l ! -exec test -e {} \; -print`
- Verify current stow status: `ls -la ~ | grep dotfiles`

### Git Configuration
- **Email conflicts**: Check per-repo settings with `git config user.email`
- **Authentication**: Test with `ssh -T git@github.com`
- **Branch issues**: Default branch is `main`, not `master`

## Security Guidelines
- **Never commit**: SSH keys, tokens, passwords, API keys
- **Use .env.local**: For sensitive environment variables
- **Review .gitignore**: Before committing changes
- **Sanitize configs**: Remove personal paths/usernames before sharing
- **Backup first**: Always backup existing configs before stowing (see README.md)
- **SSH config**: Only configuration, never actual keys