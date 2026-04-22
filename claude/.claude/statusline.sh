#!/bin/bash
input=$(cat)

model=$(echo "$input" | jq -r '.model.display_name')
dir=$(echo "$input" | jq -r '.workspace.current_dir')
cost=$(echo "$input" | jq -r '.cost.total_cost_usd // 0')
pct=$(echo "$input" | jq -r '.context_window.used_percentage // 0' | cut -d. -f1)
duration_ms=$(echo "$input" | jq -r '.cost.total_duration_ms // 0')

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

  # Read AWS credentials expiration
  local expiration
  expiration=$(aws configure export-credentials --profile ClaudeCodeAccess-FlexionLLM --format process 2>/dev/null | jq -r '.Expiration') || return 1
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

aws_ttl=$(get_aws_ttl)

# Pick bar color based on context usage
if [ "$pct" -ge 90 ]; then
  bar_color="$RED"
elif [ "$pct" -ge 70 ]; then
  bar_color="$YELLOW"
else bar_color="$GREEN"; fi

filled=$((pct / 10))
empty=$((10 - filled))
bar=$(printf "%${filled}s" | tr ' ' '█')$(printf "%${empty}s" | tr ' ' '░')

mins=$((duration_ms / 60000))
secs=$(((duration_ms % 60000) / 1000))

branch=""
git rev-parse --git-dir >/dev/null 2>&1 && branch=" | 🌿 $(git branch --show-current 2>/dev/null)"

echo -e "${CYAN}[$model]${RESET} 📁 ${dir##*/}$branch"
cost_fmt=$(printf '$%.2f' "$cost")
if [[ -n "$aws_ttl" ]]; then
  echo -e "${bar_color}${bar}${RESET} ${pct}% | ${YELLOW}${cost_fmt}${RESET} | ⏱️ ${mins}m ${secs}s | 🔐 AWS: ${aws_ttl}"
else
  echo -e "${bar_color}${bar}${RESET} ${pct}% | ${YELLOW}${cost_fmt}${RESET} | ⏱️ ${mins}m ${secs}s"
fi
