#!/bin/bash

# Ghostty Quick Terminal - Simple Raycast Integration
# Uses open command with arguments to trigger quick terminal

# Check if Ghostty is running, start if not
if ! pgrep -f "Ghostty" > /dev/null; then
    open -a Ghostty
    sleep 1
fi

# Use Ghostty's IPC or command line to trigger quick terminal
# Since we can't easily send F12 without permissions, let's use the new window approach
# but with quick-terminal-like behavior through window options

open -na Ghostty --args \
    --quick-terminal-size=40% \
    --window-position=top