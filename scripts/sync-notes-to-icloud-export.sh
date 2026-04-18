#!/usr/bin/env bash
# sync-notes-to-icloud-export.sh
# iCloud-friendly export of key Logseq content from ~/Notes to iCloud Graph.
# Avoids broad mirror traversal and focuses on journals/pages/assets plus selected top-level files.

set -uo pipefail

SOURCE="$HOME/Notes"
DEST="$HOME/Library/Mobile Documents/iCloud~com~logseq~logseq/Documents/Graph"
LOG_DIR="$HOME/.local/share/logs"
LOG_FILE="$LOG_DIR/sync-notes-to-icloud.log"
LOCK_DIR="$HOME/.local/state/sync-notes-to-icloud.lock"
STAGING_ROOT="$HOME/.local/state/sync-notes-to-icloud-staging"
STAGING_GRAPH="$STAGING_ROOT/Graph"
RSYNC_BIN="/usr/bin/rsync"

if command -v /opt/homebrew/bin/rsync >/dev/null 2>&1; then
  RSYNC_BIN="/opt/homebrew/bin/rsync"
fi

mkdir -p "$LOG_DIR"
mkdir -p "$(dirname "$LOCK_DIR")"

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
echo "[$TIMESTAMP] Starting export sync: $SOURCE -> $DEST" >> "$LOG_FILE"
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

rm -rf "$STAGING_ROOT"
mkdir -p "$STAGING_GRAPH"

# Build a clean export set in staging.
for dir in journals pages assets logseq whiteboards; do
  if [ -d "$SOURCE/$dir" ]; then
    mkdir -p "$STAGING_GRAPH/$dir"
    "$RSYNC_BIN" -a --delete \
      --exclude='.DS_Store' \
      --exclude='bak/' \
      "$SOURCE/$dir/" "$STAGING_GRAPH/$dir/" >> "$LOG_FILE" 2>&1 || {
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] FAILED staging directory $dir." >> "$LOG_FILE"
        rm -rf "$STAGING_ROOT"
        echo "---" >> "$LOG_FILE"
        exit 1
      }
  fi
done

for file in config.edn custom.css graphs-txid.edn pages-metadata.edn version-files synced-graph-info.md; do
  if [ -f "$SOURCE/$file" ]; then
    cp "$SOURCE/$file" "$STAGING_GRAPH/$file"
  fi
done

EXPORT_LIST=$(mktemp)
cat > "$EXPORT_LIST" <<'EOF'
journals/
pages/
assets/
logseq/
whiteboards/
config.edn
custom.css
graphs-txid.edn
pages-metadata.edn
version-files
synced-graph-info.md
EOF

"$RSYNC_BIN" -a \
  --inplace \
  --size-only \
  --omit-dir-times \
  --no-times \
  --no-perms \
  --no-owner \
  --no-group \
  --delete-after \
  --ignore-errors \
  --files-from="$EXPORT_LIST" \
  "$STAGING_GRAPH/" "$DEST/" >> "$LOG_FILE" 2>&1
RSYNC_EXIT=$?
rm -f "$EXPORT_LIST"

VERIFY_FAILED=0
for rel in "journals/$(date '+%Y_%m_%d').md" "pages/Logseq Conventions.md"; do
  SRC_FILE="$SOURCE/$rel"
  DST_FILE="$DEST/$rel"
  if [ -f "$SRC_FILE" ]; then
    SRC_SIZE=$(stat -f '%z' "$SRC_FILE" 2>/dev/null || echo '')
    DST_SIZE=$(stat -f '%z' "$DST_FILE" 2>/dev/null || echo '')
    if [ -z "$DST_SIZE" ] || [ "$SRC_SIZE" != "$DST_SIZE" ]; then
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] Verification FAILED for $rel (src size=$SRC_SIZE, dst size=$DST_SIZE)." >> "$LOG_FILE"
      VERIFY_FAILED=1
    else
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] Verification passed for $rel (size $SRC_SIZE)." >> "$LOG_FILE"
    fi
  fi
done

rm -rf "$STAGING_ROOT"
FINISH_TIME=$(date '+%Y-%m-%d %H:%M:%S')

if [ $VERIFY_FAILED -eq 1 ]; then
  echo "[$FINISH_TIME] Export sync FAILED verification." >> "$LOG_FILE"
  echo "---" >> "$LOG_FILE"
  exit 1
fi

if [ $RSYNC_EXIT -eq 23 ]; then
  echo "[$FINISH_TIME] Export sync usable with iCloud caveats (rsync 23, verification passed)." >> "$LOG_FILE"
  echo "---" >> "$LOG_FILE"
  exit 0
fi

if [ $RSYNC_EXIT -eq 0 ]; then
  echo "[$FINISH_TIME] Export sync completed successfully." >> "$LOG_FILE"
  echo "---" >> "$LOG_FILE"
  exit 0
fi

echo "[$FINISH_TIME] Export sync FAILED with exit code $RSYNC_EXIT." >> "$LOG_FILE"
echo "---" >> "$LOG_FILE"
exit $RSYNC_EXIT
