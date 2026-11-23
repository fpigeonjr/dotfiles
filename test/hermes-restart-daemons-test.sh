#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
script="$script_dir/scripts/hermes-restart-daemons.sh"

tmp_root="$(mktemp -d)"
trap 'rm -rf "$tmp_root"' EXIT

assert_eq() {
  local actual="$1"
  local expected="$2"

  if [[ "$actual" != "$expected" ]]; then
    echo "Expected: $expected" >&2
    echo "Actual:   $actual" >&2
    exit 1
  fi
}

make_fake_repo_helper() {
  local repo="$1"
  local exit_code="${2:-0}"

  mkdir -p "$repo/scripts"
  cat >"$repo/scripts/hermes-restart-daemons.sh" <<FAKE
#!/usr/bin/env bash
printf 'delegated:'
printf '[%s]' "\$@"
printf '\n'
exit $exit_code
FAKE
  chmod +x "$repo/scripts/hermes-restart-daemons.sh"
}

run_test() {
  local name="$1"
  shift
  echo "test: $name"
  "$@"
}

test_delegates_to_hermes_repo_with_arguments() {
  local repo="$tmp_root/custom-hermes"
  local output
  make_fake_repo_helper "$repo"

  output="$(HERMES_REPO="$repo" "$script" status "with spaces" --verbose)"
  assert_eq "$output" "delegated:[status][with spaces][--verbose]"
}

test_defaults_to_home_code_hermes() {
  local fake_home="$tmp_root/home"
  local output
  make_fake_repo_helper "$fake_home/Code/hermes"

  output="$(env -u HERMES_REPO HOME="$fake_home" "$script" area)"
  assert_eq "$output" "delegated:[area]"
}

test_propagates_nonzero_exit_code() {
  local repo="$tmp_root/failing-hermes"
  local status=0
  make_fake_repo_helper "$repo" 42

  HERMES_REPO="$repo" "$script" logs >/dev/null || status=$?
  assert_eq "$status" "42"
}

test_fails_when_target_helper_missing() {
  local repo="$tmp_root/missing-hermes"
  local status=0
  mkdir -p "$repo"

  HERMES_REPO="$repo" "$script" status >/dev/null 2>&1 || status=$?
  if [[ "$status" -eq 0 ]]; then
    echo "Expected non-zero exit status when repository helper is missing" >&2
    exit 1
  fi
}

run_test "delegates to HERMES_REPO with arguments" test_delegates_to_hermes_repo_with_arguments
run_test "defaults to \$HOME/Code/hermes when HERMES_REPO is unset" test_defaults_to_home_code_hermes
run_test "propagates non-zero exit code from delegated helper" test_propagates_nonzero_exit_code
run_test "fails when repository helper is missing" test_fails_when_target_helper_missing

echo "ok"
