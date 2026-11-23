#!/usr/bin/env bash
set -euo pipefail

input=$(cat)

model="unknown"
dir=""
cost="0"
pct="0"
duration_ms="0"

if command -v jq >/dev/null 2>&1 && [[ -n "$input" ]]; then
  if jq_out=$(printf '%s' "$input" | jq -r '
    (.model.display_name // "unknown"),
    (.workspace.current_dir // ""),
    (.cost.total_cost_usd // 0),
    ((.context_window.used_percentage // 0) | tonumber? // 0 | floor),
    ((.cost.total_duration_ms // 0) | tonumber? // 0 | floor)
  ' 2>/dev/null) && [[ -n "$jq_out" ]]; then
    {
      IFS= read -r model || true
      IFS= read -r dir || true
      IFS= read -r cost || true
      IFS= read -r pct || true
      IFS= read -r duration_ms || true
    } <<< "$jq_out"
  fi
fi

[[ -n "$model" ]] || model="unknown"
[[ "$pct" =~ ^[0-9]+$ ]] || pct=0
[[ "$duration_ms" =~ ^[0-9]+$ ]] || duration_ms=0

CYAN='\033[36m'
GREEN='\033[32m'
YELLOW='\033[33m'
RED='\033[31m'
RESET='\033[0m'

# Detect OS for cross-platform date commands
IS_MACOS=false
[[ "$(uname -s)" == "Darwin" ]] && IS_MACOS=true

# Get AWS credentials expiration time
get_aws_ttl() {
  # Check if required commands are available
  command -v jq &>/dev/null || return 1
  command -v aws &>/dev/null || return 1

  local profile="${AWS_PROFILE:-ClaudeCodeAccess-FlexionLLM}"

  # Read AWS credentials expiration
  local expiration
  expiration=$(aws configure export-credentials --profile "$profile" --format process 2>/dev/null | jq -r '.Expiration') || return 1
  [[ -z "$expiration" || "$expiration" == "null" ]] && return 1

  # Convert to Unix timestamp and calculate remaining time
  local expiration_ts remaining
  if $IS_MACOS; then
    # macOS: -j prevents setting date, -f specifies input format
    # Must strip colon from tz offset (+00:00 -> +0000) for %z
    expiration_ts=$(date -j -f "%Y-%m-%dT%H:%M:%S%z" "${expiration%:*}${expiration##*:}" +%s 2>/dev/null) || return 1
  else
    # Linux: date -d handles ISO 8601 natively
    expiration_ts=$(date -d "$expiration" +%s 2>/dev/null) || return 1
  fi
  remaining=$((expiration_ts - $(date +%s)))

  # Format expiration time as readable string
  local expire_time
  if $IS_MACOS; then
    expire_time=$(date -r "$expiration_ts" "+%I:%M %p %Z" 2>/dev/null | sed 's/^0//') || return 1
  else
    # Linux: date -d @ interprets argument as epoch seconds
    expire_time=$(date -d "@$expiration_ts" "+%I:%M %p %Z" 2>/dev/null | sed 's/^0//') || return 1
  fi

  # Output with appropriate color
  if [[ $remaining -lt 0 ]]; then
    echo -e "${RED}expired at ${expire_time}${RESET}"
  elif [[ $remaining -lt 3600 ]]; then
    echo -e "${YELLOW}expires at ${expire_time}${RESET}"
  else
    echo -e "${GREEN}expires at ${expire_time}${RESET}"
  fi
}

aws_ttl=$(get_aws_ttl || true)

# Pick bar color based on context usage
if [[ "$pct" -ge 90 ]]; then
  bar_color="$RED"
elif [[ "$pct" -ge 70 ]]; then
  bar_color="$YELLOW"
else
  bar_color="$GREEN"
fi

filled=$((pct / 10))
(( filled > 10 )) && filled=10
empty=$((10 - filled))
bar=""
for ((i = 0; i < filled; i++)); do bar+="█"; done
for ((i = 0; i < empty; i++)); do bar+="░"; done

mins=$((duration_ms / 60000))
secs=$(((duration_ms % 60000) / 1000))

branch=""
git_dir="${dir:-.}"
if [[ -d "$git_dir" ]] && git -C "$git_dir" rev-parse --git-dir >/dev/null 2>&1; then
  current_branch=$(git -C "$git_dir" branch --show-current 2>/dev/null || true)
  [[ -n "$current_branch" ]] && branch=" | 🌿 ${current_branch}"
fi

echo -e "${CYAN}[$model]${RESET} 📁 ${dir##*/}$branch"
cost_fmt=$(printf '$%.2f' "$cost" 2>/dev/null || printf '$0.00')
if [[ -n "$aws_ttl" ]]; then
  echo -e "${bar_color}${bar}${RESET} ${pct}% | ${YELLOW}${cost_fmt}${RESET} | ⏱️ ${mins}m ${secs}s | 🔐 AWS: ${aws_ttl}"
else
  echo -e "${bar_color}${bar}${RESET} ${pct}% | ${YELLOW}${cost_fmt}${RESET} | ⏱️ ${mins}m ${secs}s"
fi
