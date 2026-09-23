#!/usr/bin/env bash
# Compatibility wrapper. The repository helper is the sole implementation.
set -euo pipefail

repo_root="${HERMES_REPO:-$HOME/Code/hermes}"
exec "$repo_root/scripts/hermes-restart-daemons.sh" "$@"
