#!/bin/bash

# Ghostty Quick Terminal - Stay Focused Version
# Activates Ghostty and shows quick terminal without returning focus

# Check if Ghostty is running, start if not
if ! pgrep -f "Ghostty" > /dev/null; then
    open -a Ghostty
    sleep 2
fi

# Activate Ghostty and trigger quick terminal
osascript -e '
tell application "Ghostty" to activate
delay 0.3
tell application "System Events" to key code 111
' 2>/dev/null

# Fallback if AppleScript fails
if [ $? -ne 0 ]; then
    echo "Using fallback: opening new window"
    open -na Ghostty
fi