#!/usr/bin/env bash
set -euo pipefail

repo_root="${HERMES_REPO:-$HOME/Code/hermes}"
main_label="system/ai.hermes.gateway"
area_label="system/ai.hermes.area-agents"
main_plist="/Library/LaunchDaemons/ai.hermes.gateway.plist"
area_plist="/Library/LaunchDaemons/ai.hermes.area-agents.plist"

usage() {
  cat <<'EOF'
Usage: hermes-restart-daemons.sh [all|main|area|status|logs|help]

Commands:
  all     Restart main Hermes gateway, then Area Agent supervisor. Default.
  main    Restart only the main Hermes gateway system LaunchDaemon.
  area    Restart only the Area Agent supervisor system LaunchDaemon.
  status  Print launchd status and Area Agent registry preview.
  logs    Tail recent main gateway and Area Agent logs.
  help    Show this help.

Notes:
  - Uses macOS system LaunchDaemons, not `hermes gateway restart`.
  - Area Agent restart delegates to ~/Code/hermes/scripts/install-area-agent-daemon.sh
    so the runtime copy in ~/.hermes/lib/area-agents is refreshed first.
  - Set HERMES_REPO=/path/to/hermes to override the repo path.
EOF
}

require_macos() {
  if [[ "$(uname -s)" != "Darwin" ]]; then
    echo "This helper is only for macOS launchd system daemons." >&2
    exit 1
  fi
}

require_repo() {
  if [[ ! -d "$repo_root" ]]; then
    echo "Hermes repo not found: $repo_root" >&2
    echo "Set HERMES_REPO=/path/to/hermes and retry." >&2
    exit 1
  fi
}

print_section() {
  printf '\n==> %s\n' "$1"
}

print_launchd_status() {
  local label="$1"

  if launchctl print "$label" >/dev/null 2>&1; then
    launchctl print "$label" | awk '
      /state =|active count =|pid =|last exit code =|path =/ { print }
    '
  else
    echo "$label is not loaded"
  fi
}

preflight() {
  require_repo

  print_section "Preflight"
  cd "$repo_root"

  printf 'hermes: '
  if command -v hermes >/dev/null 2>&1; then
    command -v hermes
  else
    echo "not found on PATH"
  fi

  scripts/validate-area-agent-registry.rb
  scripts/run-area-agent-gateways.rb --list
}

restart_main() {
  require_macos

  print_section "Restart main Hermes gateway"
  sudo launchctl print "$main_label" >/dev/null 2>&1 || true
  sudo launchctl bootout "$main_label" >/dev/null 2>&1 || true
  sleep 2
  sudo launchctl bootstrap system "$main_plist"

  print_section "Main gateway status"
  print_launchd_status "$main_label"
}

restart_area() {
  require_macos
  require_repo

  print_section "Restart Area Agent supervisor"
  cd "$repo_root"
  scripts/run-area-agent-gateways.rb --list
  "$repo_root/scripts/install-area-agent-daemon.sh"

  print_section "Area Agent supervisor status"
  print_launchd_status "$area_label"
}

status() {
  require_macos

  print_section "Main gateway"
  print_launchd_status "$main_label"

  print_section "Area Agent supervisor"
  print_launchd_status "$area_label"

  print_section "Area Agent children"
  ps -axo pid,ppid,stat,command \
    | grep -E 'run-area-agent-gateways|--profile .* gateway run --replace' \
    | grep -v grep \
    || true

  print_section "Area Agent registry preview"
  require_repo
  cd "$repo_root"
  scripts/run-area-agent-gateways.rb --list
}

logs() {
  print_section "Main gateway log"
  tail -n 80 "$HOME/.hermes/logs/gateway.log" 2>/dev/null || true

  print_section "Main gateway error log"
  tail -n 80 "$HOME/.hermes/logs/gateway.error.log" 2>/dev/null || true

  print_section "Area Agent supervisor log"
  tail -n 120 "$HOME/.hermes/logs/area-agents.log" 2>/dev/null || true

  print_section "Area Agent supervisor error log"
  tail -n 120 "$HOME/.hermes/logs/area-agents.error.log" 2>/dev/null || true
}

main() {
  local command="${1:-all}"

  case "$command" in
    all)
      preflight
      restart_main
      restart_area
      status
      ;;
    main)
      restart_main
      ;;
    area)
      restart_area
      ;;
    status)
      status
      ;;
    logs)
      logs
      ;;
    help|-h|--help)
      usage
      ;;
    *)
      usage >&2
      exit 2
      ;;
  esac
}

main "$@"
