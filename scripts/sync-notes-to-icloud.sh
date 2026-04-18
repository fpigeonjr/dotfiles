#!/usr/bin/env bash
# sync-notes-to-icloud.sh
# One-way mirror of ~/Notes to iCloud LogSeq Graph folder.
# Source of truth is always ~/Notes; iCloud copy is read-only for mobile access.

set -uo pipefail

SOURCE="$HOME/Notes/"
DEST="$HOME/Library/Mobile Documents/iCloud~com~logseq~logseq/Documents/Graph/"
LOG_DIR="$HOME/.local/share/logs"
LOG_FILE="$LOG_DIR/sync-notes-to-icloud.log"
LOCK_DIR="$HOME/.local/state/sync-notes-to-icloud.lock"

# Ensure log directory exists
mkdir -p "$LOG_DIR"
mkdir -p "$(dirname "$LOCK_DIR")"

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
echo "[$TIMESTAMP] Starting sync: $SOURCE -> $DEST" >> "$LOG_FILE"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "[$TIMESTAMP] Skipping run, previous sync still in progress." >> "$LOG_FILE"
  echo "---" >> "$LOG_FILE"
  exit 0
fi

cleanup() {
  rmdir "$LOCK_DIR" 2>/dev/null || true
}
trap cleanup EXIT

TMP_DEST="${DEST%/}.tmp/"

rm -rf "$TMP_DEST"
mkdir -p "$TMP_DEST"

/usr/bin/rsync \
  --archive \
  --delete \
  --exclude='.git/' \
  --exclude='.stfolder' \
  --exclude='.stfolder.*' \
  --exclude='.stignore' \
  --exclude='.obsidian/' \
  --exclude='.DS_Store' \
  --exclude='AGENTS.md' \
  --exclude='node_modules/' \
  "$SOURCE" "$TMP_DEST" >> "$LOG_FILE" 2>&1

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  /usr/bin/rsync \
    --archive \
    --delete \
    "$TMP_DEST" "$DEST" >> "$LOG_FILE" 2>&1
  EXIT_CODE=$?
fi

rm -rf "$TMP_DEST"

EXIT_CODE=$?
FINISH_TIME=$(date '+%Y-%m-%d %H:%M:%S')

if [ $EXIT_CODE -eq 0 ]; then
  echo "[$FINISH_TIME] Sync completed successfully." >> "$LOG_FILE"
else
  echo "[$FINISH_TIME] Sync FAILED with exit code $EXIT_CODE." >> "$LOG_FILE"
fi

echo "---" >> "$LOG_FILE"
exit $EXIT_CODE
