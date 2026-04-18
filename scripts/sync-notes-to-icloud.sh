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
RSYNC_BIN="/usr/bin/rsync"

if command -v /opt/homebrew/bin/rsync >/dev/null 2>&1; then
  RSYNC_BIN="/opt/homebrew/bin/rsync"
fi

RSYNC_ARGS=(
  --recursive
  --links
  --omit-dir-times
  --no-times
  --size-only
  --inplace
  --delete-after
  --ignore-errors
  --no-perms
  --no-owner
  --no-group
  --exclude='.git/'
  --exclude='.stfolder'
  --exclude='.stfolder.*'
  --exclude='.stignore'
  --exclude='.obsidian/'
  --exclude='.DS_Store'
  --exclude='AGENTS.md'
  --exclude='node_modules/'
)

# Ensure log directory exists
mkdir -p "$LOG_DIR"
mkdir -p "$(dirname "$LOCK_DIR")"

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
echo "[$TIMESTAMP] Starting sync: $SOURCE -> $DEST" >> "$LOG_FILE"
echo "[$TIMESTAMP] Using rsync binary: $RSYNC_BIN" >> "$LOG_FILE"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "[$TIMESTAMP] Skipping run, previous sync still in progress." >> "$LOG_FILE"
  echo "---" >> "$LOG_FILE"
  exit 0
fi

cleanup() {
  rmdir "$LOCK_DIR" 2>/dev/null || true
}
trap cleanup EXIT

STAGING_ROOT="$HOME/.local/state/sync-notes-to-icloud-staging"
TMP_DEST="$STAGING_ROOT/Graph/"

rm -rf "$STAGING_ROOT"
mkdir -p "$TMP_DEST"

"$RSYNC_BIN" \
  "${RSYNC_ARGS[@]}" \
  "$SOURCE" "$TMP_DEST" >> "$LOG_FILE" 2>&1

EXIT_CODE=$?

RSYNC_EXIT_CODE=0
if [ $EXIT_CODE -eq 0 ]; then
  "$RSYNC_BIN" \
    "${RSYNC_ARGS[@]}" \
    "$TMP_DEST" "$DEST" >> "$LOG_FILE" 2>&1
  RSYNC_EXIT_CODE=$?
  EXIT_CODE=$RSYNC_EXIT_CODE
fi

VERIFY_FAILED=0
JOURNAL_REL="journals/$(date '+%Y_%m_%d').md"
SRC_FILE="${SOURCE%/}/$JOURNAL_REL"
DST_FILE="${DEST%/}/$JOURNAL_REL"
if [ -f "$SRC_FILE" ]; then
  SRC_SIZE=$(stat -f '%z' "$SRC_FILE" 2>/dev/null || echo '')
  DST_SIZE=$(stat -f '%z' "$DST_FILE" 2>/dev/null || echo '')
  if [ -z "$DST_SIZE" ] || [ "$SRC_SIZE" != "$DST_SIZE" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Verification FAILED for $JOURNAL_REL (src size=$SRC_SIZE, dst size=$DST_SIZE)." >> "$LOG_FILE"
    VERIFY_FAILED=1
  else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Verification passed for $JOURNAL_REL (size $SRC_SIZE)." >> "$LOG_FILE"
  fi
fi

PAGES_NOTE_REL="pages/Logseq Conventions.md"
SRC_NOTE_FILE="${SOURCE%/}/$PAGES_NOTE_REL"
DST_NOTE_FILE="${DEST%/}/$PAGES_NOTE_REL"
if [ -f "$SRC_NOTE_FILE" ]; then
  SRC_NOTE_SIZE=$(stat -f '%z' "$SRC_NOTE_FILE" 2>/dev/null || echo '')
  DST_NOTE_SIZE=$(stat -f '%z' "$DST_NOTE_FILE" 2>/dev/null || echo '')
  if [ -z "$DST_NOTE_SIZE" ] || [ "$SRC_NOTE_SIZE" != "$DST_NOTE_SIZE" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Verification FAILED for $PAGES_NOTE_REL (src size=$SRC_NOTE_SIZE, dst size=$DST_NOTE_SIZE)." >> "$LOG_FILE"
    VERIFY_FAILED=1
  else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Verification passed for $PAGES_NOTE_REL (size $SRC_NOTE_SIZE)." >> "$LOG_FILE"
  fi
fi

if [ $VERIFY_FAILED -eq 1 ]; then
  EXIT_CODE=1
elif [ $RSYNC_EXIT_CODE -eq 23 ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Rsync reported partial transfer (23), but key file verification passed. Treating run as usable with iCloud caveats." >> "$LOG_FILE"
  EXIT_CODE=0
fi

rm -rf "$STAGING_ROOT"
FINISH_TIME=$(date '+%Y-%m-%d %H:%M:%S')

if [ $EXIT_CODE -eq 0 ]; then
  echo "[$FINISH_TIME] Sync completed successfully." >> "$LOG_FILE"
else
  echo "[$FINISH_TIME] Sync FAILED with exit code $EXIT_CODE." >> "$LOG_FILE"
fi

echo "---" >> "$LOG_FILE"
exit $EXIT_CODE
