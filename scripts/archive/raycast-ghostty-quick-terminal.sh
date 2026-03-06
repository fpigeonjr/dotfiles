#!/bin/bash

# Ghostty Quick Terminal - Global Access via Raycast
# Works around macOS limitation where keybinds are app-scoped

# Store the currently active application to return focus later
current_app=$(osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true' 2>/dev/null)

# Check if Ghostty is running, start if not
if ! pgrep -f "Ghostty" > /dev/null; then
    open -a Ghostty
    sleep 2
fi

# Method 1: Activate Ghostty, trigger quick terminal, return to previous app
osascript -e '
tell application "Ghostty" to activate
delay 0.2
tell application "System Events" to key code 111
delay 0.1
' 2>/dev/null

# Return focus to the previous application (optional - comment out if you want to stay in terminal)
if [[ -n "$current_app" && "$current_app" != "Ghostty" ]]; then
    osascript -e "tell application \"$current_app\" to activate" 2>/dev/null
fi

# Fallback: If accessibility fails, just open new window on current desktop
if [ $? -ne 0 ]; then
    echo "Accessibility permissions needed. Using new window fallback."
    open -na Ghostty
fi