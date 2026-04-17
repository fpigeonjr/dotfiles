#!/usr/bin/env bash
# sync-notes-to-icloud.sh
# One-way mirror of ~/Notes to iCloud LogSeq Graph folder.
# Source of truth is always ~/Notes; iCloud copy is read-only for mobile access.

set -euo pipefail

SOURCE="$HOME/Notes/"
DEST="$HOME/Library/Mobile Documents/iCloud~com~logseq~logseq/Documents/Graph/"
LOG_DIR="$HOME/.local/share/logs"
LOG_FILE="$LOG_DIR/sync-notes-to-icloud.log"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
echo "[$TIMESTAMP] Starting sync: $SOURCE -> $DEST" >> "$LOG_FILE"

rsync \
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
  "$SOURCE" "$DEST" >> "$LOG_FILE" 2>&1

EXIT_CODE=$?
FINISH_TIME=$(date '+%Y-%m-%d %H:%M:%S')

if [ $EXIT_CODE -eq 0 ]; then
  echo "[$FINISH_TIME] Sync completed successfully." >> "$LOG_FILE"
else
  echo "[$FINISH_TIME] Sync FAILED with exit code $EXIT_CODE." >> "$LOG_FILE"
fi

echo "---" >> "$LOG_FILE"
exit $EXIT_CODE
