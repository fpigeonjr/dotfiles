#!/usr/bin/env bash
# install-launchagents.sh — install or reinstall LaunchAgent plists
#
# Replaces the __HOME__ placeholder with $HOME, writes real plists to
# ~/Library/LaunchAgents/, and loads them. Safe to re-run; unloads
# existing agents before reinstalling.
#
# Usage:
#   ./scripts/install-launchagents.sh

set -euo pipefail

DOTFILES_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
LOG_DIR="$HOME/.local/share/logs"

AGENTS=(
  "com.fpigeon.compress-logseq-assets"
  "com.fpigeon.sync-notes-to-icloud"
)

mkdir -p "$LAUNCH_AGENTS_DIR" "$LOG_DIR"

for agent in "${AGENTS[@]}"; do
  template="$DOTFILES_DIR/scripts/${agent}.plist"
  dest="$LAUNCH_AGENTS_DIR/${agent}.plist"

  if [[ ! -f "$template" ]]; then
    echo "⚠️  Template not found: $template — skipping"
    continue
  fi

  # Unload if currently loaded (ignore errors if not loaded)
  launchctl bootout "gui/$(id -u)/${agent}" 2>/dev/null || true

  # Remove old symlink or file
  rm -f "$dest"

  # Substitute __HOME__ and write real plist
  sed "s|__HOME__|$HOME|g" "$template" > "$dest"

  # Load the agent
  launchctl bootstrap "gui/$(id -u)" "$dest"
  launchctl enable "gui/$(id -u)/${agent}"

  echo "✅  $agent installed and loaded"
done

echo ""
echo "Verify with:"
echo "  launchctl print gui/\$(id -u)/com.fpigeon.compress-logseq-assets"
echo "  launchctl print gui/\$(id -u)/com.fpigeon.sync-notes-to-icloud"
