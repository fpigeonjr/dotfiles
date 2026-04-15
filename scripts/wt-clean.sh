#!/usr/bin/env bash
#
# wt-clean.sh - Clean up stale worktrunk worktrees
#
# Identifies and removes worktrees that are:
# - Prunable (directory missing, metadata stale)
# - Integrated (merged into main)
# - Empty (same as main, clean working tree)
#
# Usage:
#   wt-clean                 # Interactive mode (confirm before removal)
#   wt-clean --dry-run       # Show what would be removed
#   wt-clean --force         # Remove without confirmation
#   wt-clean --help          # Show this help

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DRY_RUN=false
FORCE=false
VERBOSE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run|-n)
      DRY_RUN=true
      shift
      ;;
    --force|-f)
      FORCE=true
      shift
      ;;
    -v|--verbose)
      VERBOSE=true
      shift
      ;;
    --help|-h)
      sed -n '1,/^$/p' "$0" | sed '1d;$d' | sed 's/^# //'
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Check if wt is installed
if ! command -v wt &> /dev/null; then
  echo -e "${RED}Error: wt (worktrunk) not found. Install from https://worktrunk.dev${NC}"
  exit 1
fi

# Check if jq is installed
if ! command -v jq &> /dev/null; then
  echo -e "${RED}Error: jq not found. Install with: brew install jq${NC}"
  exit 1
fi

# Fetch worktree data
echo -e "${BLUE}Fetching worktree status...${NC}"
worktree_data=$(wt list --format=json 2>/dev/null || echo "[]")

# Find stale worktrees
prunable=$(echo "$worktree_data" | jq -r '.[] | select(.worktree.state == "prunable") | .branch // .path' 2>/dev/null || true)
integrated=$(echo "$worktree_data" | jq -r '.[] | select(.main_state == "integrated" or .main_state == "empty") | select(.is_main == false) | .branch' 2>/dev/null || true)

# Combine all stale worktrees (prunable first, then integrated)
stale_list=$(printf "%s\n" "$prunable" "$integrated" | grep -v '^$' | sort -u)

if [ -z "$stale_list" ]; then
  echo -e "${GREEN}✓ No stale worktrees found${NC}"
  exit 0
fi

# Count stale worktrees
stale_count=$(echo "$stale_list" | wc -l | xargs)

echo ""
echo -e "${YELLOW}Found ${stale_count} stale worktree(s) to remove:${NC}"
echo ""
echo "$stale_list" | while read -r item; do
  # Get more details from worktree data
  details=$(echo "$worktree_data" | jq -r ".[] | select(.branch == \"$item\" or .path == \"$item\") | \"\(.branch // .path) - \(.worktree.state // .main_state)\"" 2>/dev/null || echo "$item")
  echo -e "  ${BLUE}•${NC} $details"
done

echo ""

# Dry run mode
if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}Dry run mode - no changes made${NC}"
  exit 0
fi

# Ask for confirmation (unless force)
if [ "$FORCE" = false ]; then
  read -p "Remove ${stale_count} worktree(s)? [y/N] " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
  fi
fi

# Remove stale worktrees
removed=0
failed=0

echo ""
echo "$stale_list" | while read -r item; do
  if [ -z "$item" ]; then
    continue
  fi

  if [ "$VERBOSE" = true ]; then
    echo -e "${BLUE}Removing: ${NC}$item"
  fi

  if wt remove "$item" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Removed: $item"
    ((removed++)) || true
  else
    echo -e "${RED}✗${NC} Failed to remove: $item"
    ((failed++)) || true
  fi
done

# Also run git worktree prune to clean up prunable entries
if git worktree prune 2>/dev/null; then
  if [ "$VERBOSE" = true ]; then
    echo -e "${GREEN}✓${NC} Ran git worktree prune"
  fi
fi

echo ""
echo -e "${GREEN}Complete!${NC} Processed ${stale_count} worktree(s)"
