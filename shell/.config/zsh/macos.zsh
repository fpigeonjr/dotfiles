# macOS-specific Zsh additions.

if [[ -d /opt/homebrew/bin ]]; then
  path=(/opt/homebrew/bin /opt/homebrew/sbin $path)
fi

# Re-prepend fnm's active node bin after Homebrew PATH manipulation so fnm beats
# the Homebrew node formula. FNM_MULTISHELL_PATH is set by `fnm env` in common.zsh.
[[ -n "$FNM_MULTISHELL_PATH" ]] && path=("$FNM_MULTISHELL_PATH/bin" $path)

if [[ -d /usr/local/bin ]]; then
  path=(/usr/local/bin /usr/local/sbin $path)
fi

# macOS-specific Ruby paths (Homebrew)
if [[ -d /opt/homebrew/opt/ruby/bin ]]; then
  path=(/opt/homebrew/opt/ruby/bin $path)
fi

if [[ -d /opt/homebrew/lib/ruby/gems/3.4.0/bin ]]; then
  path=(/opt/homebrew/lib/ruby/gems/3.4.0/bin $path)
fi

# macOS clipboard
if command -v pbcopy >/dev/null 2>&1; then
  alias clip='pbcopy'
fi

# macOS-specific aliases
alias code='code-insiders'
alias work='cd ~/Code/OPRE-OPS/frontend'
alias graph="cd ~/Library/Mobile\ Documents/iCloud~com~logseq~logseq/Documents/Graph"
