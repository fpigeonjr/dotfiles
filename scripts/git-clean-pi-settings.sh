#!/usr/bin/env bash
# Git clean filter for Pi settings.json files.
# Strips session-mutated defaultProvider / defaultModel / defaultThinkingLevel
# values so switching models in Pi does not dirty the dotfiles repository.
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
        data["defaultProvider"] = "amazon-bedrock"
        data["defaultModel"] = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
        data["defaultThinkingLevel"] = "off"

    trailing_newline = "\n" if raw.endswith("\n") else ""
    sys.stdout.write(json.dumps(data, indent=2, ensure_ascii=False) + trailing_newline)
else:
    sys.stdout.write(raw)
' "$file_path"
