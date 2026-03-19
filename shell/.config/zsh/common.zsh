export EDITOR="nvim"
export VISUAL="$EDITOR"

if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
  export PATH="$PATH:$HOME/.local/bin"
fi

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
