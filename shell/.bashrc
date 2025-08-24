# Enhanced Bash Configuration
# OMArchy integration + robbyrussell-inspired theme + directory persistence

# ===== OMArchy Integration =====
# Source OMArchy defaults (keep existing functionality)
source ~/.local/share/omarchy/default/bash/rc

# ===== Environment Setup =====
export EDITOR="nvim"
export VISUAL="$EDITOR"

# ===== History Settings =====
export HISTSIZE=10000
export HISTFILESIZE=10000
export HISTCONTROL=ignoreboth:erasedups
shopt -s histappend
shopt -s checkwinsize

# ===== Directory Persistence =====
# Save current directory on exit
trap 'pwd > ~/.bash_last_dir' EXIT

# Restore last directory on startup (if it exists and is valid)
if [[ -f ~/.bash_last_dir ]]; then
    LAST_DIR=$(cat ~/.bash_last_dir)
    if [[ -d "$LAST_DIR" ]]; then
        cd "$LAST_DIR"
    fi
fi

# ===== Git Functions for Prompt =====
parse_git_branch() {
    git branch 2> /dev/null | sed -e '/^[^*]/d' -e 's/* \(.*\)/(\1)/'
}

git_prompt_info() {
    local branch=$(parse_git_branch)
    if [[ -n "$branch" ]]; then
        echo " git:$branch"
    fi
}

# ===== Robbyrussell-inspired Prompt =====
# Colors
RED='\[\033[0;31m\]'
GREEN='\[\033[0;32m\]'
YELLOW='\[\033[0;33m\]'
BLUE='\[\033[0;34m\]'
CYAN='\[\033[0;36m\]'
WHITE='\[\033[0;37m\]'
RESET='\[\033[0m\]'

# Prompt function
build_prompt() {
    local exit_code=$?
    local arrow_color=""
    
    # Green arrow for success, red for errors (like robbyrussell)
    if [[ $exit_code -eq 0 ]]; then
        arrow_color=$GREEN
    else
        arrow_color=$RED
    fi
    
    # Build prompt: ➜ hostname:directory git:(branch)
    PS1="${arrow_color}➜ ${RESET}"
    PS1+="${CYAN}\h${RESET}:"  # hostname in cyan
    PS1+="${BLUE}\W${RESET}"   # current directory in blue
    PS1+="${YELLOW}\$(git_prompt_info)${RESET} " # git info in yellow
    PS1+="$ "
}

# Set the prompt
PROMPT_COMMAND=build_prompt

# ===== Completion Settings =====
if ! shopt -oq posix; then
  if [ -f /usr/share/bash-completion/bash_completion ]; then
    . /usr/share/bash-completion/bash_completion
  elif [ -f /etc/bash_completion ]; then
    . /etc/bash_completion
  fi
fi

# ===== fnm (Fast Node Manager) =====
eval "$(fnm env --use-on-cd --shell bash)"

# ===== Aliases =====
# Navigation
alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'
alias ..='cd ..'
alias ...='cd ../..'

# Git aliases (matching your zsh config style)
alias gs='git status'
alias ga='git add'
alias gc='git commit'
alias gp='git push'
alias gl='git pull'
alias gd='git diff'

# System aliases
alias grep='grep --color=auto'
alias fgrep='fgrep --color=auto'
alias egrep='egrep --color=auto'
alias neofetch='fastfetch'

# Container aliases (from your zsh config)
alias pod-up='podman compose up --build --watch'
alias dc-up-init='podman compose --profile data-initial up --build'
alias dc-up-prod="podman compose -f docker-compose.static.yml up --build"
alias pod-down='podman compose down -v'
alias dc-up="pod-up"
alias dc-down="pod-down"

# ===== Custom Functions =====
# Create directory and cd into it
mkcd() {
    mkdir -p "$1" && cd "$1"
}

# Quick edit and reload bashrc
bashrc() {
    if [[ $# -eq 0 ]]; then
        $EDITOR ~/.bashrc
    else
        case "$1" in
            reload|r)
                source ~/.bashrc
                echo "bashrc reloaded!"
                ;;
            edit|e)
                $EDITOR ~/.bashrc
                ;;
            *)
                echo "Usage: bashrc [edit|reload]"
                ;;
        esac
    fi
}

# ===== Load Custom Functions =====
if [[ -d ~/.bash_functions ]]; then
    for f in ~/.bash_functions/*.bash; do
        [[ -f "$f" ]] && source "$f"
    done
fi

# ===== Environment Variables =====
# Source local environment variables
[[ -f ~/.env.local ]] && source ~/.env.local

# ===== zoxide (smart cd) =====
if command -v zoxide &> /dev/null; then
    eval "$(zoxide init bash)"
fi