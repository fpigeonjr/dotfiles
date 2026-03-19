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

[[ -r "$ZDOTFILES_CONFIG_DIR/common.zsh" ]] && source "$ZDOTFILES_CONFIG_DIR/common.zsh"
[[ -r "$ZDOTFILES_CONFIG_DIR/$DOTFILES_OS.zsh" ]] && source "$ZDOTFILES_CONFIG_DIR/$DOTFILES_OS.zsh"
[[ -r "$ZDOTFILES_CONFIG_DIR/local.zsh" ]] && source "$ZDOTFILES_CONFIG_DIR/local.zsh"
