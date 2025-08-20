# Convert all JPG/JPEG/PNG in the current dir to WebP.
# Env vars you can set before running:
#   WEBP_QUALITY=75   (default 75; try 70–80)
#   WEBP_EFFORT=6     (0–6; higher = smaller/slower)
#   REMOVE_ORIGINAL=1 (1=delete source if webp is smaller, 0=keep)
compress_to_webp() {
  setopt LOCAL_OPTIONS NULL_GLOB EXTENDED_GLOB

  # settings
  local Q="${WEBP_QUALITY:-75}"
  local E="${WEBP_EFFORT:-6}"
  local REMOVE="${REMOVE_ORIGINAL:-1}"

  # deps
  for bin in cwebp; do
    command -v "$bin" >/dev/null 2>&1 || {
      echo "Missing $bin. Install: brew install webp"
      return 1
    }
  done

  # portable filesize: mac (BSD) stat first, then GNU
  filesize() {
    local f="$1" s
    s=$(stat -f%z "$f" 2>/dev/null || stat -c%s "$f" 2>/dev/null) || return 1
    echo "$s"
  }

  # loop images
  for src in *.(jpg|jpeg|png)(#i); do
    [[ -e "$src" ]] || continue
    local base="${src%.*}"
    local dst="${base}.webp"

    # encode: lossy, no metadata, higher effort, auto-filter
    # Tip: for very flat graphics/logos, try adding "-lossless" instead.
    cwebp -q "$Q" -m "$E" -af -metadata none "$src" -o "$dst" >/dev/null 2>&1
    if [[ $? -ne 0 || ! -s "$dst" ]]; then
      echo "❌ Failed: $src"
      continue
    fi

    local osize nsize
    osize=$(filesize "$src") || osize=0
    nsize=$(filesize "$dst") || nsize=0

    # show savings
    if (( osize > 0 )); then
      local saved=$(( osize - nsize ))
      local pct=$(( 100 * saved / osize ))
      printf "✅ %s → %s  (saved ~%d%%)\n" "$src" "$dst" "$pct"
    else
      printf "✅ %s → %s\n" "$src" "$dst"
    fi

    # optionally remove original if webp is smaller
    if (( REMOVE == 1 )) && (( nsize > 0 && nsize < osize )); then
      rm -f -- "$src"
    fi
  done
}
