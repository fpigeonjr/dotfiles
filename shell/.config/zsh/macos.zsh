# macOS-specific Zsh additions.

if [[ -d /opt/homebrew/bin ]]; then
  path=(/opt/homebrew/bin /opt/homebrew/sbin $path)
fi

if [[ -d /usr/local/bin ]]; then
  path=(/usr/local/bin /usr/local/sbin $path)
fi

if command -v pbcopy >/dev/null 2>&1; then
  alias clip='pbcopy'
fi
