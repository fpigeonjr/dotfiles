# Agent Guidelines for Dotfiles Repository

## Build/Lint/Test Commands
- **Lua formatting**: `stylua --config ~/.config/nvim/stylua.toml .` (2-space indent, 120 column width)
- **JavaScript/TypeScript**: `npx prettier --write .` and `npx eslint .`
- **Shell scripts**: No specific linter configured, use shellcheck if available
- **Single test**: No test framework configured (configuration repo)

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
- No Cursor rules or Copilot instructions configured

### File Organization
- Configuration files in `config/.config/`
- Shell configs in `shell/`
- Editor configs in respective directories
- Custom functions in language-specific subdirectories

## Development Workflow
1. Edit configuration files directly
2. Test changes by sourcing/restarting relevant applications
3. Use `git` for version control with descriptive commit messages
4. No automated testing - manual verification required