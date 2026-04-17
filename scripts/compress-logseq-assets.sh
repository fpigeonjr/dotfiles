#!/usr/bin/env bash
#
# compress-logseq-assets.sh - Compress LogSeq asset images to WebP
#
# Converts PNG, JPEG, and HEIC images in the LogSeq assets/ directory to WebP
# format and updates all markdown link references in pages/ and journals/.
#
# Modes:
#   --migrate      Full one-time migration of all existing images
#   --incremental  Only convert new images (no .webp sibling yet) - safe to re-run
#   --cron         Alias for --incremental --execute (sets PATH, used by cron)
#
# Flags:
#   --dry-run      Show what would happen without making changes (default)
#   --execute      Actually perform conversions and link updates
#   --notes-dir    Path to LogSeq graph root (default: ~/Notes)
#
# Usage:
#   compress-logseq-assets.sh --migrate --dry-run
#   compress-logseq-assets.sh --migrate --execute
#   compress-logseq-assets.sh --incremental --dry-run
#   compress-logseq-assets.sh --incremental --execute
#   compress-logseq-assets.sh --cron
#
# Cron entry (Mac Mini, Sundays at 3am):
#   0 3 * * 0 /Users/fpigeon/dotfiles/scripts/compress-logseq-assets.sh --cron
#
# Backup / recovery:
#   The --migrate mode creates a git branch 'asset-compression' and requires
#   a clean working tree. To revert everything:
#     git checkout pre-asset-compression-YYYYMMDD -- .
#   or restore the tag with:
#     git checkout pre-asset-compression-YYYYMMDD
#
# Dependencies:
#   cwebp   - brew install webp
#   sips    - built into macOS (required only for --migrate HEIC conversion)

set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── Defaults ──────────────────────────────────────────────────────────────────
MODE=""
DRY_RUN=true
NOTES_DIR="$HOME/Notes"
WEBP_QUALITY=75
WEBP_EFFORT=6
LOG_DIR="$HOME/.local/share/logs"
LOG_FILE="$LOG_DIR/compress-logseq-assets.log"
IS_CRON=false

# ── Argument parsing ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --migrate)
      MODE="migrate"
      shift
      ;;
    --incremental)
      MODE="incremental"
      shift
      ;;
    --cron)
      MODE="incremental"
      DRY_RUN=false
      IS_CRON=true
      # Ensure Homebrew is on PATH when invoked from cron
      export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:$PATH"
      shift
      ;;
    --dry-run|-n)
      DRY_RUN=true
      shift
      ;;
    --execute)
      DRY_RUN=false
      shift
      ;;
    --notes-dir)
      NOTES_DIR="$2"
      shift 2
      ;;
    --help|-h)
      sed -n '2,/^$/p' "$0" | sed 's/^# //' | sed 's/^#//'
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Run with --help for usage."
      exit 1
      ;;
  esac
done

# ── Validate mode ─────────────────────────────────────────────────────────────
if [[ -z "$MODE" ]]; then
  echo -e "${RED}Error: must specify --migrate, --incremental, or --cron${NC}"
  echo "Run with --help for usage."
  exit 1
fi

# ── Paths ─────────────────────────────────────────────────────────────────────
ASSETS_DIR="$NOTES_DIR/assets"
PAGES_DIR="$NOTES_DIR/pages"
JOURNALS_DIR="$NOTES_DIR/journals"

# ── Logging (cron mode writes to file; interactive prints to stdout) ───────────
log() {
  local msg="$1"
  if [[ "$IS_CRON" == true ]]; then
    echo "$msg" >> "$LOG_FILE"
  else
    echo -e "$msg"
  fi
}

log_section() {
  log ""
  log "${BOLD}${BLUE}── $1 ──────────────────────────────────────────────${NC}"
}

# ── Counters ──────────────────────────────────────────────────────────────────
converted=0
skipped_larger=0
skipped_error=0
links_updated=0
files_with_links=0

# ── Helper: human-readable bytes ──────────────────────────────────────────────
human_bytes() {
  local bytes=$1
  if (( bytes >= 1048576 )); then
    echo "$(( bytes / 1048576 ))MB"
  elif (( bytes >= 1024 )); then
    echo "$(( bytes / 1024 ))KB"
  else
    echo "${bytes}B"
  fi
}

# ── Helper: portable file size ────────────────────────────────────────────────
filesize() {
  local f="$1"
  stat -f%z "$f" 2>/dev/null || stat -c%s "$f" 2>/dev/null || echo 0
}

# ── Phase 0: Preflight checks ─────────────────────────────────────────────────
preflight() {
  log_section "Phase 0: Preflight"

  # Check required directories
  for dir in "$ASSETS_DIR" "$PAGES_DIR" "$JOURNALS_DIR"; do
    if [[ ! -d "$dir" ]]; then
      log "${RED}Error: directory not found: $dir${NC}"
      exit 1
    fi
  done
  log "${GREEN}✓${NC} Notes directory structure looks good: $NOTES_DIR"

  # Check cwebp
  if ! command -v cwebp &>/dev/null; then
    log "${RED}Error: cwebp not found. Install with: brew install webp${NC}"
    exit 1
  fi
  log "${GREEN}✓${NC} cwebp found: $(command -v cwebp)"

  # Check sips (migrate mode only -- needed for HEIC)
  if [[ "$MODE" == "migrate" ]]; then
    if ! command -v sips &>/dev/null; then
      log "${RED}Error: sips not found (should be built into macOS)${NC}"
      exit 1
    fi
    log "${GREEN}✓${NC} sips found: $(command -v sips)"
  fi

  # Git checks (migrate mode only)
  if [[ "$MODE" == "migrate" && "$DRY_RUN" == false ]]; then
    if ! git -C "$NOTES_DIR" rev-parse --git-dir &>/dev/null; then
      log "${RED}Error: $NOTES_DIR is not a git repository${NC}"
      exit 1
    fi
    local git_status
    git_status=$(git -C "$NOTES_DIR" status --porcelain)
    if [[ -n "$git_status" ]]; then
      log "${RED}Error: git working tree is not clean. Commit or stash changes first.${NC}"
      log "$git_status"
      exit 1
    fi
    log "${GREEN}✓${NC} Git working tree is clean"

    # Create asset-compression branch
    if git -C "$NOTES_DIR" rev-parse --verify asset-compression &>/dev/null; then
      log "${YELLOW}⚠${NC}  Branch 'asset-compression' already exists -- switching to it"
      git -C "$NOTES_DIR" checkout asset-compression
    else
      git -C "$NOTES_DIR" checkout -b asset-compression
      log "${GREEN}✓${NC} Created and switched to branch: asset-compression"
    fi
  fi

  if [[ "$DRY_RUN" == true ]]; then
    log "${YELLOW}DRY RUN -- no files will be modified${NC}"
  fi
}

# ── Phase 1: Convert HEIC -> WebP (migrate mode only) ─────────────────────────
convert_heic() {
  log_section "Phase 1: HEIC -> WebP (migrate only)"

  local heic_files=()
  while IFS= read -r -d '' f; do
    heic_files+=("$f")
  done < <(find "$ASSETS_DIR" -maxdepth 1 -iname "*.heic" -print0 2>/dev/null)

  if [[ ${#heic_files[@]} -eq 0 ]]; then
    log "  No HEIC files found -- skipping"
    return
  fi

  log "  Found ${#heic_files[@]} HEIC file(s)"

  for src in "${heic_files[@]}"; do
    local base="${src%.*}"
    local dst="${base}.webp"
    local tmp="${base}._tmp_.jpg"
    local filename
    filename=$(basename "$src")

    local osize
    osize=$(filesize "$src")

    if [[ "$DRY_RUN" == true ]]; then
      log "  ${CYAN}[dry-run]${NC} HEIC -> WebP: $filename ($(human_bytes "$osize"))"
      (( converted++ )) || true
      continue
    fi

    # HEIC -> tmp JPEG via sips (lossless intermediate)
    if ! sips -s format jpeg "$src" --out "$tmp" &>/dev/null; then
      log "  ${RED}✗${NC} sips failed on: $filename"
      rm -f "$tmp"
      (( skipped_error++ )) || true
      continue
    fi

    # tmp JPEG -> WebP
    if ! cwebp -q "$WEBP_QUALITY" -m "$WEBP_EFFORT" -af -metadata none "$tmp" -o "$dst" &>/dev/null; then
      log "  ${RED}✗${NC} cwebp failed on: $filename"
      rm -f "$tmp" "$dst"
      (( skipped_error++ )) || true
      continue
    fi
    rm -f "$tmp"

    local nsize
    nsize=$(filesize "$dst")

    if [[ ! -s "$dst" ]]; then
      log "  ${RED}✗${NC} Zero-byte output for: $filename"
      rm -f "$dst"
      (( skipped_error++ )) || true
      continue
    fi

    local saved=$(( osize - nsize ))
    local pct=0
    (( osize > 0 )) && pct=$(( 100 * saved / osize ))

    log "  ${GREEN}✓${NC} $filename -> $(basename "$dst")  $(human_bytes "$osize") -> $(human_bytes "$nsize") (saved ~${pct}%)"
    rm -f "$src"
    (( converted++ )) || true
    # HEIC files are orphaned (no note references them) -- no link updates needed
  done
}

# ── Phase 2: Convert PNG/JPEG -> WebP ─────────────────────────────────────────
# In --migrate mode: all PNG/JPEG files
# In --incremental mode: only files without an existing .webp sibling
convert_images() {
  local phase_label
  if [[ "$MODE" == "migrate" ]]; then
    phase_label="Phase 2: PNG/JPEG -> WebP (all files)"
  else
    phase_label="Phase 1: PNG/JPEG -> WebP (new files only)"
  fi
  log_section "$phase_label"

  local image_files=()
  while IFS= read -r -d '' f; do
    image_files+=("$f")
  done < <(find "$ASSETS_DIR" -maxdepth 1 \( -iname "*.png" -o -iname "*.jpg" -o -iname "*.jpeg" \) -print0 2>/dev/null)

  if [[ ${#image_files[@]} -eq 0 ]]; then
    log "  No PNG/JPEG files found -- skipping"
    return
  fi

  local eligible=()
  for src in "${image_files[@]}"; do
    local base="${src%.*}"
    local webp_sibling="${base}.webp"
    if [[ "$MODE" == "incremental" && -f "$webp_sibling" ]]; then
      continue  # already converted
    fi
    eligible+=("$src")
  done

  if [[ ${#eligible[@]} -eq 0 ]]; then
    log "  No new images to convert (all already have .webp siblings)"
    return
  fi

  log "  Found ${#eligible[@]} image(s) to process"
  log ""

  # Track which files were successfully converted (for link updates)
  CONVERTED_FILES=()

  for src in "${eligible[@]}"; do
    local base="${src%.*}"
    local dst="${base}.webp"
    local filename
    filename=$(basename "$src")
    local ext="${src##*.}"

    local osize
    osize=$(filesize "$src")

    if [[ "$DRY_RUN" == true ]]; then
      log "  ${CYAN}[dry-run]${NC} $filename -> $(basename "$dst")  ($(human_bytes "$osize"))"
      CONVERTED_FILES+=("$filename")
      (( converted++ )) || true
      continue
    fi

    if ! cwebp -q "$WEBP_QUALITY" -m "$WEBP_EFFORT" -af -metadata none "$src" -o "$dst" &>/dev/null; then
      log "  ${RED}✗${NC} cwebp failed: $filename"
      rm -f "$dst"
      (( skipped_error++ )) || true
      continue
    fi

    if [[ ! -s "$dst" ]]; then
      log "  ${RED}✗${NC} Zero-byte output: $filename"
      rm -f "$dst"
      (( skipped_error++ )) || true
      continue
    fi

    local nsize
    nsize=$(filesize "$dst")

    # Skip if WebP is larger -- keep the original, no link change
    if (( nsize >= osize )); then
      log "  ${YELLOW}↷${NC}  $filename -- WebP ($(human_bytes "$nsize")) >= original ($(human_bytes "$osize")), keeping original"
      rm -f "$dst"
      (( skipped_larger++ )) || true
      continue
    fi

    local saved=$(( osize - nsize ))
    local pct=0
    (( osize > 0 )) && pct=$(( 100 * saved / osize ))

    log "  ${GREEN}✓${NC} $filename -> $(basename "$dst")  $(human_bytes "$osize") -> $(human_bytes "$nsize") (saved ~${pct}%)"
    rm -f "$src"
    CONVERTED_FILES+=("$filename")
    (( converted++ )) || true
  done
}

# ── Phase 3: Update markdown links ────────────────────────────────────────────
# Efficiently updates links by building a combined sed script and running it
# once per markdown file, rather than once per converted filename.
update_links() {
  local phase_label
  if [[ "$MODE" == "migrate" ]]; then
    phase_label="Phase 3: Update note links"
  else
    phase_label="Phase 2: Update note links"
  fi
  log_section "$phase_label"

  if [[ ${#CONVERTED_FILES[@]} -eq 0 ]]; then
    log "  No files were converted -- no links to update"
    return
  fi

  # Collect all markdown files
  local md_files=()
  while IFS= read -r -d '' f; do
    md_files+=("$f")
  done < <(find "$PAGES_DIR" "$JOURNALS_DIR" -name "*.md" -print0 2>/dev/null)

  if [[ ${#md_files[@]} -eq 0 ]]; then
    log "  ${YELLOW}⚠${NC}  No markdown files found in pages/ or journals/"
    return
  fi

  # Build a combined sed script: one substitution per converted file.
  # Each rule replaces the exact old filename with the .webp version.
  # Using | as delimiter to avoid clashing with / in filenames.
  local sed_script=""
  for old_filename in "${CONVERTED_FILES[@]}"; do
    local base="${old_filename%.*}"
    local new_filename="${base}.webp"
    # Escape any special sed regex characters in the filename (dots, brackets, etc.)
    local escaped_old
    escaped_old=$(printf '%s' "$old_filename" | sed 's/[[\.*^$()+?{|]/\\&/g')
    sed_script+="s|${escaped_old}|${new_filename}|g;"
  done

  log "  Scanning ${#md_files[@]} markdown files for ${#CONVERTED_FILES[@]} converted filename(s)..."
  log ""

  # Write all old filenames to a temp pattern file for fast grep -F -f matching.
  # This turns O(files × filenames) grep calls into O(files) calls.
  local pattern_file
  pattern_file=$(mktemp /tmp/compress-logseq-patterns.XXXXXX)
  trap 'rm -f "$pattern_file"' RETURN

  for old_filename in "${CONVERTED_FILES[@]}"; do
    printf '%s\n' "$old_filename" >> "$pattern_file"
  done

  local total_files_changed=0
  local total_refs_changed=0

  for md in "${md_files[@]}"; do
    # Single grep call to pre-filter: does this file reference ANY converted filename?
    if ! grep -qFf "$pattern_file" "$md" 2>/dev/null; then
      continue
    fi

    # Count total matching references in this file (for reporting)
    local refs_before
    refs_before=$(grep -cFf "$pattern_file" "$md" 2>/dev/null || true)

    if [[ "$DRY_RUN" == true ]]; then
      log "  ${CYAN}[dry-run]${NC} $(basename "$md") -- $refs_before reference(s) would be updated"
      (( total_refs_changed += refs_before )) || true
      (( total_files_changed++ )) || true
      continue
    fi

    # Apply all substitutions in a single sed pass (sed_script built above)
    sed -i '' "$sed_script" "$md"
    log "  ${GREEN}✓${NC} $(basename "$md") -- updated $refs_before reference(s)"
    (( total_files_changed++ )) || true
    (( total_refs_changed += refs_before )) || true
  done

  (( links_updated += total_refs_changed )) || true
  (( files_with_links += total_files_changed )) || true
}

# ── Phase 4: Summary report ────────────────────────────────────────────────────
report() {
  log_section "Summary"

  if [[ "$DRY_RUN" == true ]]; then
    log "  ${YELLOW}(Dry run -- no changes were made)${NC}"
  fi

  log "  Images converted:          ${GREEN}${converted}${NC}"
  log "  Skipped (WebP larger):     ${YELLOW}${skipped_larger}${NC}"
  log "  Skipped (errors):          ${RED}${skipped_error}${NC}"
  log "  Link references updated:   ${GREEN}${links_updated}${NC} across ${files_with_links} file(s)"

  if [[ "$MODE" == "migrate" && "$DRY_RUN" == false && $converted -gt 0 ]]; then
    log ""
    log "  ${BOLD}Next steps:${NC}"
    log "   1. Open LogSeq and spot-check a few pages with images"
    log "   2. If everything looks good:"
    log "      cd $NOTES_DIR"
    log "      git add -A && git commit -m 'chore: compress assets to WebP'"
    log "      git checkout main && git merge asset-compression"
    log "   3. If something is wrong:"
    log "      git checkout pre-asset-compression-$(date +%Y%m%d) -- ."
  fi

  if [[ "$IS_CRON" == true && $converted -gt 0 ]]; then
    log ""
    log "  Run 'git -C $NOTES_DIR diff --stat' to review changes before next sync."
  fi
  log ""
}

# ── Setup logging for cron mode ───────────────────────────────────────────────
if [[ "$IS_CRON" == true ]]; then
  mkdir -p "$LOG_DIR"
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
  echo "" >> "$LOG_FILE"
  echo "=== [$TIMESTAMP] compress-logseq-assets --cron ===" >> "$LOG_FILE"
  # Redirect all further output to log file
  exec >> "$LOG_FILE" 2>&1
fi

# ── Main ──────────────────────────────────────────────────────────────────────
CONVERTED_FILES=()

preflight

if [[ "$MODE" == "migrate" ]]; then
  convert_heic
  convert_images
  update_links
  report
else
  # incremental: skip HEIC (orphaned, one-time only)
  convert_images
  update_links
  report
fi
