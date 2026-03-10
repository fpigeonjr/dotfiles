#!/bin/bash

set -euo pipefail

HOST="pi"
BACKUP_DIR="${HOME}/Downloads/pi-pre-upgrade-backups/20260310-150325"
REMOTE_BACKUP_BASE="/home/pi/pi-restore"
RUN_UPGRADE=1
RUN_GRAVITY=1

usage() {
  cat <<'EOF'
Usage: scripts/pi-bookworm-restore.sh [options]

Restore a fresh Raspberry Pi OS Bookworm Pi-hole install from a saved backup set.

Options:
  --host HOST              SSH host to target (default: pi)
  --backup-dir PATH        Local backup directory (default: ~/Downloads/pi-pre-upgrade-backups/20260310-150325)
  --remote-backup-base DIR Remote working directory (default: /home/pi/pi-restore)
  --skip-upgrade           Skip apt update/full-upgrade on the Pi
  --skip-gravity           Skip pihole updateGravity after restore
  -h, --help               Show this help

Notes:
  - Run this from your Mac after imaging Bookworm, enabling SSH, and installing Pi-hole.
  - The remote host must allow passwordless sudo for the pi user.
EOF
}

log() {
  printf '[pi-restore] %s\n' "$*"
}

die() {
  printf '[pi-restore] ERROR: %s\n' "$*" >&2
  exit 1
}

require_file() {
  local file_path="$1"
  [[ -f "$file_path" ]] || die "Required file not found: $file_path"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      HOST="$2"
      shift 2
      ;;
    --backup-dir)
      BACKUP_DIR="$2"
      shift 2
      ;;
    --remote-backup-base)
      REMOTE_BACKUP_BASE="$2"
      shift 2
      ;;
    --skip-upgrade)
      RUN_UPGRADE=0
      shift
      ;;
    --skip-gravity)
      RUN_GRAVITY=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Unknown option: $1"
      ;;
  esac
done

[[ -d "$BACKUP_DIR" ]] || die "Backup directory not found: $BACKUP_DIR"
require_file "$BACKUP_DIR/pihole.toml"
require_file "$BACKUP_DIR/gravity.db"
require_file "$BACKUP_DIR/pihole-etc.tgz"

log "Checking SSH connectivity to $HOST"
ssh "$HOST" "true"

log "Verifying remote OS and sudo access"
ssh "$HOST" "grep -q 'VERSION_CODENAME=bookworm' /etc/os-release && sudo -n true"

if [[ "$RUN_UPGRADE" -eq 1 ]]; then
  log "Updating Bookworm packages"
  ssh "$HOST" "sudo apt update && sudo apt full-upgrade -y"
fi

REMOTE_BACKUP_DIR="$REMOTE_BACKUP_BASE/$(basename "$BACKUP_DIR")"

log "Uploading backup set to $HOST:$REMOTE_BACKUP_DIR"
ssh "$HOST" "mkdir -p '$REMOTE_BACKUP_BASE'"
scp -r "$BACKUP_DIR" "$HOST:$REMOTE_BACKUP_BASE/"

log "Checking Pi-hole availability"
ssh "$HOST" "command -v pihole >/dev/null 2>&1"

log "Restoring Pi-hole configuration"
ssh "$HOST" "set -euo pipefail; \
  backup_dir='$REMOTE_BACKUP_DIR'; \
  restore_tmp=\
\$(mktemp -d); \
  sudo tar -xzf \"\$backup_dir/pihole-etc.tgz\" -C \"\$restore_tmp\" etc/pihole/custom.list >/dev/null 2>&1 || true; \
  remote_snapshot=/etc/pihole.pre-bookworm-restore-\$(date +%Y%m%d-%H%M%S).tgz; \
  sudo tar -czf \"\$remote_snapshot\" /etc/pihole >/dev/null 2>&1 || true; \
  sudo cp \"\$backup_dir/pihole.toml\" /etc/pihole/pihole.toml; \
  sudo cp \"\$backup_dir/gravity.db\" /etc/pihole/gravity.db; \
  if [[ -f \"\$restore_tmp/etc/pihole/custom.list\" ]]; then sudo cp \"\$restore_tmp/etc/pihole/custom.list\" /etc/pihole/custom.list; fi; \
  sudo chown pihole:pihole /etc/pihole/gravity.db /etc/pihole/pihole.toml /etc/pihole/custom.list 2>/dev/null || true; \
  sudo systemctl restart pihole-FTL; \
  rm -rf \"\$restore_tmp\"; \
  printf 'Remote Pi-hole backup saved to %s\n' \"\$remote_snapshot\""

if [[ "$RUN_GRAVITY" -eq 1 ]]; then
  log "Refreshing gravity"
  ssh "$HOST" "pihole updateGravity"
fi

log "Running health checks"
ssh "$HOST" "set -e; \
  pihole status; \
  printf '\n---\n'; \
  dig +short google.com @127.0.0.1; \
  printf '\n---\n'; \
  dig +short koshelf.books @127.0.0.1 || true"

log "Restore complete"
