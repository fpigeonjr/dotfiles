#!/usr/bin/env bash
# Git clean filter for Pi settings.json files.
# Pins session-mutated defaultProvider / defaultModel / defaultThinkingLevel
# values and drops Pi's changelog bookkeeping (lastChangelogVersion,
# extensionChangelogVersions) so model switches and Pi/extension updates do
# not dirty the dotfiles repository. A fresh machine shows Pi's changelog once.
#
# Install in a fresh clone with:
#   git config filter.pi-settings.clean "scripts/git-clean-pi-settings.sh %f"

set -euo pipefail

file_path="${1:-}"

if ! command -v python3 >/dev/null 2>&1; then
  cat
  exit 0
fi

python3 -c '
import json
import sys

path = sys.argv[1] if len(sys.argv) > 1 else ""
raw = sys.stdin.read()

try:
    data = json.loads(raw)
except Exception:
    sys.stdout.write(raw)
    sys.exit(0)

if isinstance(data, dict):
    if path.startswith("pi/"):
        data["defaultProvider"] = "github-copilot"
        data["defaultModel"] = "claude-haiku-5.5"
        data["defaultThinkingLevel"] = "off"
        data.pop("lastChangelogVersion", None)
        data.pop("extensionChangelogVersions", None)

    trailing_newline = "\n" if raw.endswith("\n") else ""
    sys.stdout.write(json.dumps(data, indent=2, ensure_ascii=False) + trailing_newline)
else:
    sys.stdout.write(raw)
' "$file_path"
