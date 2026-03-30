# Cross-platform Zsh entrypoint for macOS and Linux.

setopt EXTENDED_GLOB

export DOTFILES_OS="unknown"
case "$(uname -s)" in
  Darwin)
    export DOTFILES_OS="macos"
    ;;
  Linux)
    export DOTFILES_OS="linux"
    ;;
esac

export ZDOTFILES_CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/zsh"

# Oh My Zsh remains optional so shell startup stays healthy on fresh machines.
export ZSH="$HOME/.oh-my-zsh"
ZSH_THEME="robbyrussell"
plugins=(git zsh-syntax-highlighting)

if [[ -r "$ZSH/oh-my-zsh.sh" ]]; then
  source "$ZSH/oh-my-zsh.sh"
fi

# User configuration

# export MANPATH="/usr/local/man:$MANPATH"
# You may need to manually set your language environment
# export LANG=en_US.UTF-8

# Preferred editor for local and remote sessions
# if [[ -n $SSH_CONNECTION ]]; then
export EDITOR="nvim"
export VISUAL="$EDITOR"
# else
#   export EDITOR='nvim'
# fi

# Compilation flags
# export ARCHFLAGS="-arch $(uname -m)"

# Set personal aliases, overriding those provided by Oh My Zsh libs,
# plugins, and themes. Aliases can be placed here, though Oh My Zsh
# users are encouraged to define aliases within a top-level file in
# the $ZSH_CUSTOM folder, with .zsh extension. Examples:
# - $ZSH_CUSTOM/aliases.zsh
# - $ZSH_CUSTOM/macos.zsh
# For a full list of active aliases, run `alias`.
#
alias zshell="code ~/.zshrc"
alias ohmyzsh="code ~/.oh-my-zsh"
alias new="source ~/.zshrc"
# SSH
alias pi-up="pihole -up"
alias speedtest="networkquality"
alias neofetch="fastfetch"
alias pod-up='podman compose up --build'
alias dc-up-init='podman compose --profile data-initial up --build'
alias dc-up-prod="podman compose -f docker-compose.static.yml up --build"
alias pod-down='podman compose down -v'
alias dc-up="pod-up"
alias dc-down="pod-down"

# fnm - Fast Node Manager
if command -v fnm >/dev/null 2>&1; then
  eval "$(fnm env --use-on-cd --shell zsh)"
fi
#code default
alias code='code-insiders'
#macos shortcuts
alias work='cd ~/code/OPRE-OPS/frontend'
alias graph="cd ~/Library/Mobile\ Documents/iCloud~com~logseq~logseq/Documents/Graph"
alias journal='graph'
alias matrix='cmatrix'
# Source environment variables
[ -f ~/.env.local ] && source ~/.env.local
# Created by `pipx` on 2025-05-29 21:25:12
export PATH="$PATH:$HOME/.local/bin"
export PATH="/opt/homebrew/opt/ruby/bin:$PATH"
# Homebrew Ruby gem executables
export PATH="/opt/homebrew/lib/ruby/gems/3.4.0/bin:$PATH"

# KOShelf server management
alias koshelf-start="start_koshelf"
alias koshelf-stop="stop_koshelf"
alias koshelf-restart="restart_koshelf"
alias koshelf-status="koshelf_status"
alias koshelf-logs="koshelf_logs"
alias library="open http://koshelf.books"

# Load custom functions
for f in ~/.zsh_functions/*.zsh(N); do
  source "$f"
done

# zoxide
if command -v zoxide >/dev/null 2>&1; then
  eval "$(zoxide init zsh)"
fi

[[ -r "$ZDOTFILES_CONFIG_DIR/common.zsh" ]] && source "$ZDOTFILES_CONFIG_DIR/common.zsh"
[[ -r "$ZDOTFILES_CONFIG_DIR/$DOTFILES_OS.zsh" ]] && source "$ZDOTFILES_CONFIG_DIR/$DOTFILES_OS.zsh"
[[ -r "$ZDOTFILES_CONFIG_DIR/local.zsh" ]] && source "$ZDOTFILES_CONFIG_DIR/local.zsh"
