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

### OMArchy/Hyprland Integration
The Hyprland configuration is designed for [OMArchy](https://omarchy.org) systems:
- **Keybindings**: Custom app launchers (Super+A for ChatGPT, Super+B for Brave)
- **Theme integration**: Sources OMArchy theme system
- **Hardware**: Configured for modern displays with proper scaling
- **Input**: Natural touchpad scrolling and fingerprint authentication

Note: Hyprland configs only apply to OMArchy/Linux systems with Hyprland installed.

## Structure

```
dotfiles/
├── config/          # Modern config files (~/.config/)
│   └── .config/
│       ├── hypr/    # Hyprland window manager (OMArchy)
│       ├── nvim/    # Neovim configuration (LazyVim)
│       ├── waybar/  # Waybar status bar (OMArchy) with VPN module
│       └── zed/     # Zed editor settings and keymaps
├── ghostty/         # Ghostty terminal configuration
│   └── config       # Terminal settings, colors, fonts
├── git/             # Git configuration
│   ├── .gitconfig
│   └── .gitignore_global
├── homebrew/        # Homebrew package management
│   └── Brewfile     # List of installed packages
├── logseq/          # Logseq knowledge management
│   ├── config/
│   │   ├── config.edn    # Global shortcuts and settings
│   │   └── plugins.edn   # Installed plugins list
│   ├── settings/
│   │   ├── logseq-everforest-theme.json
│   │   └── logseq-journals-calendar.json
│   └── preferences.json  # UI preferences and themes
├── shell/           # Shell configuration
│   ├── .bash_functions/
│   │   └── image-tools.bash  # Bash image utilities
│   ├── .zsh_functions/
│   │   └── image-tools.zsh
│   ├── .bashrc           # Enhanced bash config (Arch Linux/OMArchy)
│   ├── .bash_profile     # Bash profile (sources .bashrc)
│   ├── .env.local
│   └── .zshrc            # Zsh configuration (macOS)
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

4. **Stow packages individually:**
   ```bash
    stow git        # Git configuration
    stow shell      # Zsh, profile, functions
    stow vim        # Vim configuration
    stow config     # Neovim, Zed, and Hyprland configuration
    stow ghostty    # Ghostty terminal configuration
    stow ssh        # SSH client config
    stow vscode     # VS Code settings and keybindings
    stow vscode-insiders # VS Code Insiders settings
    stow logseq     # Logseq configuration
    stow homebrew   # Homebrew Brewfile
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
| `config` | .config/nvim/, .config/zed/, .config/hypr/, .config/waybar/ | Modern app configurations |
| `ghostty` | config | Terminal emulator settings and themes |
| `ssh` | .ssh/config | SSH client settings (no keys) |
| `vscode` | settings.json, keybindings.json | VS Code configuration |
| `vscode-insiders` | settings.json, keybindings.json | VS Code Insiders configuration |
| `logseq` | config.edn, plugins.edn, preferences.json | Logseq knowledge management settings and plugins |
| `homebrew` | Brewfile | Homebrew package list for easy setup |

## Dependencies

- **Zsh plugins:** zsh-syntax-highlighting
- **Neovim:** LazyVim distribution
- **Tools:** fnm, zoxide, fastfetch, podman
- **macOS specific:** Uses Keychain for SSH keys
