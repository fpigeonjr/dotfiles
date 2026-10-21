#!/usr/bin/env bash
set -euo pipefail

# Quick latency sampler for USAi chat-completions models.
# Usage:
#   scripts/usai-latency-check.sh
#   scripts/usai-latency-check.sh --runs 3 --timeout 20
#   scripts/usai-latency-check.sh --models "claude_4_5_haiku,gpt-5.6-terra"

if ! command -v curl >/dev/null 2>&1; then
  echo "error: curl is required" >&2
  exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "error: python3 is required" >&2
  exit 1
fi

runs=1
timeout_s=25
models_csv="claude_4_5_haiku,claude-sonnet-5.5,claude-opus-5,gpt-5.6-luna,gpt-5.6-terra,gpt-6-astra,gemini-3.8-flash,gemini-3.5-flash,gemini-3-7-flash"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --runs)
      runs="${2:-}"
      shift 2
      ;;
    --timeout)
      timeout_s="${2:-}"
      shift 2
      ;;
    --models)
      models_csv="${2:-}"
      shift 2
      ;;
    -h|--help)
      sed -n '1,14p' "$0"
      exit 0
      ;;
    *)
      echo "error: unknown arg '$1'" >&2
      exit 1
      ;;
  esac
done

if [[ -z "${USAI_API_KEY:-}" && -z "${GSAI_API_KEY:-}" ]]; then
  echo "error: set USAI_API_KEY (or GSAI_API_KEY)" >&2
  exit 1
fi
api_key="${USAI_API_KEY:-${GSAI_API_KEY:-}}"

if ! [[ "$runs" =~ ^[0-9]+$ ]] || [[ "$runs" -lt 1 ]]; then
  echo "error: --runs must be a positive integer" >&2
  exit 1
fi
if ! [[ "$timeout_s" =~ ^[0-9]+$ ]] || [[ "$timeout_s" -lt 1 ]]; then
  echo "error: --timeout must be a positive integer" >&2
  exit 1
fi

endpoint="https://api.gsa.usai.gov/api/v1/chat/completions"
IFS=',' read -r -a models <<< "$models_csv"

echo "USAi latency check | runs=${runs} | timeout=${timeout_s}s | endpoint=${endpoint}"
echo
printf "%-48s %-6s %-10s %-10s %-10s\n" "model" "n" "p50" "p90" "status"
printf "%-48s %-6s %-10s %-10s %-10s\n" "------------------------------------------------" "------" "----------" "----------" "----------"

for model in "${models[@]}"; do
  model="$(echo "$model" | xargs)"
  [[ -z "$model" ]] && continue

  samples_file="$(mktemp)"
  status="ok"

  for ((i=1; i<=runs; i++)); do
    payload=$(python3 - <<PY
import json
print(json.dumps({
  "model": "${model}",
  "messages": [{"role": "user", "content": "Reply with exactly: ok"}],
  "max_tokens": 8
}))
PY
)

    result="$(curl -sS -o /dev/null \
      --max-time "$timeout_s" \
      -w '%{time_total} %{http_code}' \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${api_key}" \
      -d "$payload" \
      "$endpoint" || true)"

    t="${result%% *}"
    code="${result##* }"

    if [[ -z "$t" || "$t" == "$result" || ! "$code" =~ ^[0-9]{3}$ ]]; then
      status="curl-error"
      continue
    fi

    if [[ "$code" != "200" ]]; then
      status="http-${code}"
    fi

    echo "$t" >> "$samples_file"
  done

  summary="$(python3 - "$samples_file" <<'PY'
import sys
from statistics import median
p=sys.argv[1]
vals=[]
with open(p) as f:
  for line in f:
    line=line.strip()
    if not line:
      continue
    try:
      vals.append(float(line))
    except ValueError:
      pass
if not vals:
  print('0 - -')
  raise SystemExit
import math
vals.sort()
n=len(vals)
p50=vals[n//2]
p90=vals[max(0, math.ceil(n*0.9)-1)]
print(f"{n} {p50:.2f}s {p90:.2f}s")
PY
)"

  n="${summary%% *}"
  rest="${summary#* }"
  p50="${rest%% *}"
  p90="${rest##* }"

  printf "%-48s %-6s %-10s %-10s %-10s\n" "$model" "$n" "$p50" "$p90" "$status"
  rm -f "$samples_file"
done
