# Image Tools - Bash Functions
# Convert image formats, resize images, optimize images

# Convert image to different format
img_convert() {
    if [[ $# -lt 2 ]]; then
        echo "Usage: img_convert <input_file> <output_format>"
        echo "Example: img_convert photo.png jpg"
        return 1
    fi
    
    local input="$1"
    local format="$2"
    local output="${input%.*}.$format"
    
    if ! command -v convert &> /dev/null; then
        echo "ImageMagick not installed. Install with: sudo pacman -S imagemagick"
        return 1
    fi
    
    convert "$input" "$output"
    echo "Converted $input to $output"
}

# Resize image
img_resize() {
    if [[ $# -lt 2 ]]; then
        echo "Usage: img_resize <input_file> <width>x<height>"
        echo "Example: img_resize photo.jpg 800x600"
        return 1
    fi
    
    local input="$1"
    local size="$2"
    local output="${input%.*}_resized.${input##*.}"
    
    if ! command -v convert &> /dev/null; then
        echo "ImageMagick not installed. Install with: sudo pacman -S imagemagick"
        return 1
    fi
    
    convert "$input" -resize "$size" "$output"
    echo "Resized $input to $size -> $output"
}

# Optimize image (reduce file size)
img_optimize() {
    if [[ $# -lt 1 ]]; then
        echo "Usage: img_optimize <input_file> [quality]"
        echo "Example: img_optimize photo.jpg 85"
        return 1
    fi
    
    local input="$1"
    local quality="${2:-80}"
    local output="${input%.*}_optimized.${input##*.}"
    
    if ! command -v convert &> /dev/null; then
        echo "ImageMagick not installed. Install with: sudo pacman -S imagemagick"
        return 1
    fi
    
    convert "$input" -quality "$quality" "$output"
    echo "Optimized $input (quality: $quality%) -> $output"
}