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
When using on Linux systems that have existing git configs:
1. **Backup existing config**: `cp ~/.gitconfig ~/.gitconfig.backup`
2. **Check for conflicts**: Compare settings before stowing
3. **Merge manually if needed**: Combine useful settings from both configs

## Structure

```
dotfiles/
├── config/          # Modern config files (~/.config/)
│   └── .config/
│       └── nvim/    # Neovim configuration (LazyVim)
├── git/             # Git configuration
│   ├── .gitconfig
│   └── .gitignore_global
├── shell/           # Shell configuration
│   ├── .zsh_functions/
│   │   └── image-tools.zsh
│   ├── .env.local
│   └── .zshrc
├── ssh/             # SSH client configuration
│   └── .ssh/
│       └── config
└── vim/             # Vim configuration
    └── .vimrc
```

## Prerequisites

- [GNU Stow](https://www.gnu.org/software/stow/)
- [Oh My Zsh](https://ohmyzsh.sh/) (for shell configuration)
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

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url> ~/dotfiles
   cd ~/dotfiles
   ```

2. **Stow packages individually:**
   ```bash
   stow git        # Git configuration
   stow shell      # Zsh, profile, functions
   stow vim        # Vim configuration
   stow config     # Neovim configuration
   stow ssh        # SSH client config
   ```

3. **Or stow all packages at once:**
   ```bash
   stow */
   ```

## Usage

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

### Stow Conflicts
If stow reports conflicts:
```bash
# Remove conflicting files manually
rm ~/.conflicting-file

# Then stow again
stow packagename
```

### Broken Symlinks
Check for broken symlinks:
```bash
find ~ -maxdepth 1 -type l ! -exec test -e {} \; -print
```

### Verify Stow Status
```bash
# Check what's currently stowed
ls -la ~ | grep dotfiles
```

## Security Notes

- SSH keys and sensitive data are excluded via `.gitignore`
- Only configuration files are tracked, not secrets
- Review `.env.local` and `.profile` for sensitive environment variables

## Package Overview

| Package | Contains | Purpose |
|---------|----------|---------|
| `git` | .gitconfig, .gitignore_global | Git settings and global ignores |
| `shell` | .zshrc, .env.local, functions | Shell configuration |
| `vim` | .vimrc | Traditional Vim settings |
| `config` | .config/nvim/ | Modern Neovim configuration |
| `ssh` | .ssh/config | SSH client settings (no keys) |

## Dependencies

- **Zsh plugins:** zsh-syntax-highlighting
- **Neovim:** LazyVim distribution
- **Tools:** fnm, zoxide, fastfetch, podman
- **macOS specific:** Uses Keychain for SSH keys
