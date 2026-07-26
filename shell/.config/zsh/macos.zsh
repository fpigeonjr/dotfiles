# macOS-specific Zsh additions.

# Homebrew — prepend both Intel and Apple Silicon locations
if [[ -x /opt/homebrew/bin/brew ]]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
elif [[ -x /usr/local/bin/brew ]]; then
  eval "$(/usr/local/bin/brew shellenv)"
fi

# cmux CLI — add to PATH when installed
if [[ -d /Applications/cmux.app/Contents/Resources/bin ]]; then
  export PATH="/Applications/cmux.app/Contents/Resources/bin:$PATH"
fi

# Prefer BSD (macOS) open for URLs — already the default, but explicit here
# so open_url() in common.zsh doesn't need OS branching.

# Re-run fnm env after Homebrew shellenv so fnm shims win over /opt/homebrew/bin/node.
# Homebrew installs its own node; without this, `fnm use` switches the version fnm
# tracks but Homebrew's node (earlier in PATH) still answers `which node`.
if command -v fnm >/dev/null 2>&1; then
  eval "$(fnm env --use-on-cd --shell zsh)"
fi

# Persistent ssh-agent via LaunchAgent (scripts/com.fpigeonjr.ssh-agent.plist).
# launchd keeps a long-lived agent on a fixed socket so git SSH commit signing
# (gpg.format=ssh) and SSH auth work across shells without re-entering passphrases.
# Install the agent with: ~/dotfiles/scripts/install-launchagents.sh
if [[ -S "$HOME/.ssh/ssh-agent.sock" ]]; then
  export SSH_AUTH_SOCK="$HOME/.ssh/ssh-agent.sock"
  # Load the default key lazily in interactive shells only. Non-interactive
  # shells (scripts, agents) skip this so they don't block on a passphrase prompt.
  if [[ -o interactive ]] && ! ssh-add -l >/dev/null 2>&1; then
    ssh-add "$HOME/.ssh/id_ed25519" 2>/dev/null || true
  fi
fi
