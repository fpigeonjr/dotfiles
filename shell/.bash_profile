#
# ~/.bash_profile
#

# macOS: /etc/profile's path_helper puts the system dirs first, so a login bash
# (including the one Hermes uses for every cron terminal command) would otherwise
# resolve python3/ruby to the macOS copies instead of Homebrew's.
[[ -x /opt/homebrew/bin/brew ]] && eval "$(/opt/homebrew/bin/brew shellenv)"

[[ -f ~/.bashrc ]] && . ~/.bashrc
