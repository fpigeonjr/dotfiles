# Linux-specific Zsh additions.

if command -v xclip >/dev/null 2>&1; then
  alias clip='xclip -selection clipboard'
elif command -v wl-copy >/dev/null 2>&1; then
  alias clip='wl-copy'
fi

if [[ -d /usr/local/bin ]]; then
  path=(/usr/local/bin /usr/local/sbin $path)
fi
