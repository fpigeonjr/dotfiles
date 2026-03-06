#!/bin/bash

# Alternative Ghostty Launcher - Always opens on current desktop
# This creates a new window instead of using quick terminal

# Configuration to make the window behave like a quick terminal
open -na Ghostty --args \
    --window-height=40% \
    --window-position=center \
    --window-new-tab-position=current \
    --macos-non-native-fullscreen=true \
    --window-inherit-working-directory=true