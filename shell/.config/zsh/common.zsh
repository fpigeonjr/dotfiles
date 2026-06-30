export EDITOR="nvim"
export VISUAL="$EDITOR"

if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
  export PATH="$PATH:$HOME/.local/bin"
fi

# pi coding agent (https://github.com/badlogic/pi-mono) — point it at XDG config
# instead of the default ~/.pi/agent so config lives under version control.
export PI_CODING_AGENT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/pi/agent"

alias zshell="$EDITOR ~/.zshrc"
alias ohmyzsh="$EDITOR ~/.oh-my-zsh"
alias new="source ~/.zshrc"
alias pi-up="pihole -up"
alias neofetch="fastfetch"
alias pod-up='podman compose up --build'
alias dc-up-init='podman compose --profile data-initial up --build'
alias dc-up-prod="podman compose -f docker-compose.static.yml up --build"
alias pod-down='podman compose down -v'
alias dc-up="pod-up"
alias dc-down="pod-down"
alias wt-clean="$HOME/dotfiles/scripts/wt-clean.sh"
alias graph="cd ~/Documents/Graph"
alias journal='graph'
alias matrix='cmatrix'
alias koshelf-start="start_koshelf"
alias koshelf-stop="stop_koshelf"
alias koshelf-restart="restart_koshelf"
alias koshelf-status="koshelf_status"
alias koshelf-logs="koshelf_logs"

open_url() {
  if command -v open >/dev/null 2>&1; then
    open "$@"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$@"
  else
    echo "No URL opener found. Install xdg-utils or use a browser directly."
    return 1
  fi
}

speedtest() {
  if command -v networkquality >/dev/null 2>&1; then
    networkquality "$@"
  elif command -v speedtest >/dev/null 2>&1; then
    command speedtest "$@"
  elif command -v speedtest-cli >/dev/null 2>&1; then
    command speedtest-cli "$@"
  else
    echo "No speed test command found. Install networkquality, speedtest, or speedtest-cli."
    return 1
  fi
}

library() {
  open_url "http://koshelf.books"
}

if command -v fnm >/dev/null 2>&1; then
  eval "$(fnm env --use-on-cd --shell zsh)"
  # 'default' alias tracks lts-latest; run `fnm install --lts` to upgrade.
  # Guard on the alias existing — avoids a multi-second hang on machines where
  # fnm is installed but no Node versions are managed (e.g. fresh / restricted
  # environments where `fnm use default` tries to resolve over the network).
  if [[ -n "$FNM_DIR" && -e "$FNM_DIR/aliases/default" ]]; then
    fnm use default --silent-if-unchanged 2>/dev/null
  fi
fi

[[ -f ~/.env.local ]] && source ~/.env.local

for f in ~/.zsh_functions/*.zsh(N); do
  source "$f"
done

if command -v zoxide >/dev/null 2>&1; then
  eval "$(zoxide init zsh)"
fi

if command -v ng >/dev/null 2>&1; then
  source <(ng completion script)
fi

if command -v wt >/dev/null 2>&1; then
  eval "$(command wt config shell init zsh)"
fi

# Ghostty/cmux shell integration - ensures PWD reporting works in all shells
# (not just directly-spawned ones), enabling window-inherit-working-directory.
# Allow an explicit opt-out for machines where Ghostty shell integration breaks
# prompt rendering.
# Guard: only source manually if Ghostty has NOT already auto-injected integration.
# Auto-injection sets $GHOSTTY_SHELL_FEATURES; if it's set, skip manual source to
# avoid double-registering prompt/ZLE hooks, which can cause prompt redraw issues.
if [[ -z $DOTFILES_DISABLE_GHOSTTY_SHELL_INTEGRATION && -n $GHOSTTY_RESOURCES_DIR && -z $GHOSTTY_SHELL_FEATURES && -z $SSH_CONNECTION && $TERM_PROGRAM == "ghostty" ]]; then
  # Upstream Ghostty path
  if [[ -f "$GHOSTTY_RESOURCES_DIR/shell-integration/zsh/ghostty-integration" ]]; then
    source "$GHOSTTY_RESOURCES_DIR/shell-integration/zsh/ghostty-integration"
  # cmux places the integration file one level above GHOSTTY_RESOURCES_DIR
  elif [[ -f "${GHOSTTY_RESOURCES_DIR:h}/shell-integration/ghostty-integration.zsh" ]]; then
    source "${GHOSTTY_RESOURCES_DIR:h}/shell-integration/ghostty-integration.zsh"
  fi
fi
