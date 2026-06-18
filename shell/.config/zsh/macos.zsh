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
