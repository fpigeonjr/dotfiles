#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
script="$script_dir/scripts/hermes-restart-daemons.sh"

assert_contains() {
  local haystack="$1"
  local needle="$2"

  if [[ "$haystack" != *"$needle"* ]]; then
    echo "Expected output to contain: $needle" >&2
    echo "--- output ---" >&2
    echo "$haystack" >&2
    exit 1
  fi
}

assert_file_contains() {
  local path="$1"
  local needle="$2"

  if ! grep -Fq "$needle" "$path"; then
    echo "Expected $path to contain: $needle" >&2
    echo "--- file ---" >&2
    cat "$path" >&2
    exit 1
  fi
}

make_fake_repo() {
  local root="$1"

  mkdir -p "$root/scripts"

  cat >"$root/scripts/validate-area-agent-registry.rb" <<'FAKE'
#!/usr/bin/env bash
echo "valid registry: fake"
FAKE

  cat >"$root/scripts/run-area-agent-gateways.rb" <<'FAKE'
#!/usr/bin/env bash
echo "configured agents: accountant"
echo "skipped agents: none"
FAKE

  chmod +x "$root/scripts/validate-area-agent-registry.rb" "$root/scripts/run-area-agent-gateways.rb"
}

make_fake_path() {
  local bin="$1"
  local log="$2"

  mkdir -p "$bin"

  cat >"$bin/uname" <<'FAKE'
#!/usr/bin/env bash
echo Darwin
FAKE

  cat >"$bin/sleep" <<'FAKE'
#!/usr/bin/env bash
exit 0
FAKE

  cat >"$bin/launchctl" <<'FAKE'
#!/usr/bin/env bash
set -euo pipefail
echo "launchctl $*" >>"$TEST_LOG"

if [[ "${1:-}" == "print" ]]; then
  label="${2:-}"
  if [[ "$label" == "system/ai.hermes.area-agents" && ! -f "$TEST_STATE/area_loaded" ]]; then
    exit 113
  fi
  echo "	active count = 1"
  echo "	path = /Library/LaunchDaemons/test.plist"
  echo "	state = running"
  echo "	pid = 123"
  exit 0
fi

if [[ "${1:-}" == "bootstrap" ]]; then
  touch "$TEST_STATE/area_loaded"
  exit 0
fi

if [[ "${1:-}" == "bootout" ]]; then
  rm -f "$TEST_STATE/main_loaded"
  exit 0
fi
FAKE

  cat >"$bin/sudo" <<'FAKE'
#!/usr/bin/env bash
echo "sudo $*" >>"$TEST_LOG"
exec "$@"
FAKE

  cat >"$bin/ps" <<'FAKE'
#!/usr/bin/env bash
echo "123 1 S /usr/bin/ruby /fake/run-area-agent-gateways.rb"
echo "124 123 S python -m hermes_cli.main --profile accountant gateway run --replace"
FAKE

  cat >"$bin/tail" <<'FAKE'
#!/usr/bin/env bash
echo "tail $*" >>"$TEST_LOG"
FAKE

  chmod +x "$bin/"*
}

run_test() {
  local name="$1"
  shift
  echo "test: $name"
  "$@"
}

test_status_prints_daemon_state() {
  local tmp bin repo output
  tmp="$(mktemp -d)"
  bin="$tmp/bin"
  repo="$tmp/hermes"
  export TEST_LOG="$tmp/calls.log"
  export TEST_STATE="$tmp/state"
  mkdir -p "$TEST_STATE"
  touch "$TEST_STATE/area_loaded"
  make_fake_path "$bin" "$TEST_LOG"
  make_fake_repo "$repo"

  output="$(PATH="$bin:/usr/bin:/bin" HERMES_REPO="$repo" "$script" status)"

  assert_contains "$output" "==> Main gateway"
  assert_contains "$output" "==> Area Agent supervisor"
  assert_contains "$output" "configured agents: accountant"
  assert_contains "$output" "--profile accountant gateway run --replace"
}

test_area_restart_success_does_not_retry() {
  local tmp bin repo output
  tmp="$(mktemp -d)"
  bin="$tmp/bin"
  repo="$tmp/hermes"
  export TEST_LOG="$tmp/calls.log"
  export TEST_STATE="$tmp/state"
  mkdir -p "$TEST_STATE"
  make_fake_path "$bin" "$TEST_LOG"
  make_fake_repo "$repo"

  cat >"$repo/scripts/install-area-agent-daemon.sh" <<'FAKE'
#!/usr/bin/env bash
echo "installer ok"
touch "$TEST_STATE/area_loaded"
FAKE
  chmod +x "$repo/scripts/install-area-agent-daemon.sh"

  output="$(PATH="$bin:/usr/bin:/bin" HERMES_REPO="$repo" "$script" area)"

  assert_contains "$output" "installer ok"
  assert_contains "$output" "Area Agent supervisor status"
  assert_file_contains "$TEST_LOG" "launchctl print system/ai.hermes.area-agents"
}

test_area_restart_retries_after_bootstrap_race() {
  local tmp bin repo output
  tmp="$(mktemp -d)"
  bin="$tmp/bin"
  repo="$tmp/hermes"
  export TEST_LOG="$tmp/calls.log"
  export TEST_STATE="$tmp/state"
  mkdir -p "$TEST_STATE"
  make_fake_path "$bin" "$TEST_LOG"
  make_fake_repo "$repo"

  cat >"$repo/scripts/install-area-agent-daemon.sh" <<'FAKE'
#!/usr/bin/env bash
echo "Bootstrap failed: 5: Input/output error" >&2
exit 5
FAKE
  chmod +x "$repo/scripts/install-area-agent-daemon.sh"

  output="$(PATH="$bin:/usr/bin:/bin" HERMES_REPO="$repo" "$script" area 2>&1)"

  assert_contains "$output" "Area Agent installer failed"
  assert_contains "$output" "Retrying Area Agent bootstrap in 3s"
  assert_file_contains "$TEST_LOG" "sudo launchctl bootstrap system /Library/LaunchDaemons/ai.hermes.area-agents.plist"
  assert_file_contains "$TEST_LOG" "launchctl bootstrap system /Library/LaunchDaemons/ai.hermes.area-agents.plist"
}

test_area_restart_does_not_retry_unrelated_failure() {
  local tmp bin repo output status
  tmp="$(mktemp -d)"
  bin="$tmp/bin"
  repo="$tmp/hermes"
  export TEST_LOG="$tmp/calls.log"
  export TEST_STATE="$tmp/state"
  mkdir -p "$TEST_STATE"
  make_fake_path "$bin" "$TEST_LOG"
  make_fake_repo "$repo"

  cat >"$repo/scripts/install-area-agent-daemon.sh" <<'FAKE'
#!/usr/bin/env bash
echo "sudo: a terminal is required to read the password" >&2
exit 1
FAKE
  chmod +x "$repo/scripts/install-area-agent-daemon.sh"

  set +e
  output="$(PATH="$bin:/usr/bin:/bin" HERMES_REPO="$repo" "$script" area 2>&1)"
  status=$?
  set -e

  if [[ "$status" -eq 0 ]]; then
    echo "Expected unrelated installer failure to remain failed" >&2
    exit 1
  fi
  assert_contains "$output" "sudo: a terminal is required"
  if [[ -f "$TEST_LOG" ]] && grep -Fq "sudo launchctl bootstrap system" "$TEST_LOG"; then
    echo "Expected no bootstrap retry for unrelated installer failure" >&2
    cat "$TEST_LOG" >&2
    exit 1
  fi
}

run_test "status prints daemon state" test_status_prints_daemon_state
run_test "area restart success does not retry" test_area_restart_success_does_not_retry
run_test "area restart retries after bootstrap race" test_area_restart_retries_after_bootstrap_race
run_test "area restart does not retry unrelated failure" test_area_restart_does_not_retry_unrelated_failure

echo "ok"
