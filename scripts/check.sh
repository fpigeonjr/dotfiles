#!/usr/bin/env bash
# check.sh — syntax, lint, config, and test checks for this dotfiles repo.

set -euo pipefail
shopt -s nullglob

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

failures=0

run_check() {
  local label="$1"
  shift
  if "$@"; then
    printf '✓ %s\n' "$label"
  else
    printf '✗ %s\n' "$label" >&2
    ((failures++)) || true
  fi
}

# `bash -n` and `zsh -n` only syntax-check the first file argument (treating
# subsequent args as positional parameters), so check every file individually.
check_syntax() {
  local shell_bin="$1"
  shift
  local rc=0
  local file
  if [[ $# -eq 0 ]]; then
    echo "No files matched for $shell_bin syntax check." >&2
    return 1
  fi
  for file in "$@"; do
    "$shell_bin" -n "$file" || rc=1
  done
  return "$rc"
}

if command -v zsh >/dev/null 2>&1; then
  run_check "zsh syntax" check_syntax zsh \
    shell/.zshrc \
    shell/.config/zsh/common.zsh \
    shell/.config/zsh/macos.zsh \
    shell/.config/zsh/linux.zsh \
    shell/.zsh_functions/*.zsh
else
  echo "- zsh syntax (skipped: zsh not installed)"
fi

run_check "bash syntax" check_syntax bash \
  shell/.bashrc \
  shell/.bash_profile \
  shell/.bash_functions/*.bash \
  scripts/*.sh \
  claude/.claude/statusline.sh \
  test/*.sh

if command -v plutil >/dev/null 2>&1; then
  run_check "launchd plist lint" plutil -lint scripts/*.plist
else
  echo "- launchd plist lint (skipped: plutil not installed)"
fi

check_ghostty_whitespace() {
  local cfg="config/.config/ghostty/config"
  local rc=0
  if [[ ! -f "$cfg" ]]; then
    echo "Missing Ghostty config: $cfg" >&2
    return 1
  fi
  grep -n '[[:space:]]$' "$cfg" || rc=$?
  if [[ "$rc" -eq 0 ]]; then
    echo "Ghostty config contains trailing whitespace (Ghostty stops parsing at trailing whitespace)." >&2
    return 1
  elif [[ "$rc" -ne 1 ]]; then
    echo "Failed to inspect Ghostty config (grep exit $rc)." >&2
    return 1
  fi
}
run_check "ghostty trailing whitespace" check_ghostty_whitespace

run_check "hermes wrapper tests" ./test/hermes-restart-daemons-test.sh

if command -v shellcheck >/dev/null 2>&1; then
  run_check "shellcheck" shellcheck -S warning scripts/*.sh claude/.claude/statusline.sh test/*.sh
else
  echo "- shellcheck (skipped: not installed)"
fi

if command -v stylua >/dev/null 2>&1; then
  run_check "stylua" stylua --check --config-path config/.config/nvim/stylua.toml config/.config/nvim
else
  echo "- stylua (skipped: not installed)"
fi

if (( failures > 0 )); then
  printf '\n%d check(s) failed.\n' "$failures" >&2
  exit 1
fi

printf '\nAll checks passed.\n'
