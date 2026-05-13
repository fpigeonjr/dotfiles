# GFE Setup

**Machine:** Government-furnished MacBook Pro (M1, 16 GB)  
**Boundary:** Work client only. No Flexion credentials, no personal tools.  
**VPN:** This machine is the only path to lower environments — keep it stable.

---

## Stow targets

Clone the dotfiles repo then run exactly these stow commands. Nothing else.

```bash
git clone <your-dotfiles-repo> ~/dotfiles
cd ~/dotfiles

stow git          # .gitconfig with includeIf for local email override
stow ssh          # SSH client config (includes ~/.ssh/config.local)
stow shell        # Zsh entrypoint, common.zsh, macos.zsh
stow vim          # .vimrc
stow vscode       # VS Code settings and keybindings
stow homebrew     # gives you access to Brewfile.gfe

# config: skip opencode (Flexion Bedrock) — stow everything else
stow --ignore='opencode' config   # nvim, ghostty, zed

# AI coding agents — Copilot-only variants (no Flexion credentials required)
stow opencode-gfe   # OpenCode with GitHub Copilot config
stow pi-gfe         # Pi coding agent with GitHub Copilot config
```

### Do NOT stow on the GFE

| Package | Why |
|---|---|
| `pi` | Flexion Bedrock profiles — use `pi-gfe` instead |
| `config` opencode subtree | Flexion Bedrock config — use `opencode-gfe` instead |
| `aws` | Flexion-only AWS SSO profile |
| `claude` | Personal Claude Code / Bedrock auth |
| `logseq` | Personal notes — iCloud paths |
| `vscode-insiders` | Use stable VS Code on a government machine |

---

## Machine-local files (create on GFE, never commit)

These three files live only on this machine. They are gitignored by design — they
contain work-specific paths and identities that should not appear in a public repo.

### 1 — `~/.gitconfig.local` — gov email override

```ini
[user]
    email = you@agency.gov
    signingkey = ~/.ssh/id_ed25519_gov.pub
```

The `[includeIf "gitdir:~/"]` block already in `.gitconfig` picks this up
automatically for every repo under `~/`. No per-repo `git config user.email` needed.

### 2 — `~/.config/zsh/local.zsh` — gov prompt and aliases

```bash
cp ~/dotfiles/shell/.config/zsh/local.zsh.gfe ~/.config/zsh/local.zsh
# then edit — set your gov= alias to the actual repo path
```

The `gov-mbp` prompt hostname immediately tells you which machine you're on.

### 3 — `~/.ssh/config.local` — gov-specific SSH hosts

The stowed `~/.ssh/config` starts with `Include ~/.ssh/config.local`.
Create this file after you have cloned gov repos and know the host aliases:

```
# ~/.ssh/config.local — gov hosts only, never committed
Host github-gov
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_gov

# Add jump hosts, bastion IPs, etc. as you encounter them
```

---

## AI coding agents (GitHub Copilot)

Both `opencode-gfe` and `pi-gfe` use only GitHub Copilot models — no Flexion
credentials, no personal API keys. Auth flows through your GSA GitHub account.

### 1 — Copilot authentication

OpenCode and Pi both use `gh` for Copilot token exchange. Run this once:

```bash
gh auth login
# Choose: GitHub.com → HTTPS → Login with a web browser
# Then in the browser, sign in with your GSA GitHub account
```

Your GSA org Copilot licence is already provisioned — no separate activation needed.

### 2 — OpenCode notifier plugin

```bash
cd ~/.config/opencode && npm install
```

This installs `@opencode-ai/plugin` locally so the `@mohak34/opencode-notifier`
plugin can load. Run once after stow, and again after any `opencode-gfe` package
update that bumps `package.json`.

### 3 — Pi coding agent

```bash
npm install -g @earendil-works/pi-coding-agent
```

Pi is distributed via npm (GSA Helix Artifactory mirror). After install, launch
with `pi` and run `/login` → select **GitHub Copilot** on first use. Subsequent
sessions authenticate automatically via the stored `gh` token.

---



**Do not copy keys from the Flexion laptop.** Generate a new key pair on the GFE:

```bash
ssh-keygen -t ed25519 -C "you@agency.gov" -f ~/.ssh/id_ed25519_gov
```

Add the public key to your gov GitHub account. Store the passphrase in the macOS
Keychain (the stowed SSH config already enables `UseKeychain yes`).

---

## Homebrew

```bash
# Install Homebrew if not present
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install only the GFE-minimal package list
brew bundle install --file=~/dotfiles/homebrew/Brewfile.gfe
```

Do not run `brew bundle install` against the main `Brewfile` — it will pull in
`podman`, `logseq`, `bitwarden`, and the rest of the personal stack.

### Containers (opt-in)

If the work project local dev stack requires containerised services, uncomment in
`Brewfile.gfe` and re-run:

```
brew "podman"
cask "podman-desktop"
```

---

## VS Code extensions

After `stow vscode`, install the minimum set for the work project:

```bash
code --install-extension esbenp.prettier-vscode
code --install-extension dbaeumer.vscode-eslint
code --install-extension bradlc.vscode-tailwindcss
code --install-extension github.vscode-pull-request-github
code --install-extension streetsidesoftware.code-spell-checker
```

Only install GitHub Copilot if the work organisation has provisioned a licence for
you. Do not auth it with a personal subscription.

---

## Git identity sanity check

After setup, verify the right email is used before your first commit:

```bash
# Should show your gov address, not the default noreply address
cd ~/Code/<any-repo>
git config user.email
```

---

## What intentionally stays off this machine

| Thing | Reason |
|---|---|
| Flexion Bedrock credentials | Wrong AWS org |
| Personal API keys (NVIDIA, Gemini, OpenCode) | Personal subscriptions |
| Contractor browser profile / MFA app | Resolved in pre-flight above |
| `pi` agent | Flexion Bedrock profiles, personal API keys |
| LogSeq / Obsidian | Personal notes on iCloud |
| Bitwarden | Personal password vault |
| Mac Mini screen sharing | Keep personal and work infrastructure separate |

---

## Visual boundary reminder

A distinct prompt hostname (`gov-mbp`, set in `local.zsh`) makes it immediately obvious
which machine you are working on. Optionally set a distinct Ghostty theme:

```bash
# Append to ~/.config/zsh/local.zsh
# Add a matching theme entry to ~/.config/ghostty/config first
export GHOSTTY_THEME_OVERRIDE="gov"
```

---

## Maintenance

- `brew upgrade` — run periodically, not daily
- If you add a package via `brew install`, capture it:
  ```bash
  brew bundle dump --file=~/dotfiles/homebrew/Brewfile.gfe --force
  ```
  then commit `Brewfile.gfe`
- Keep `~/.gitconfig.local`, `~/.config/zsh/local.zsh`, and
  `~/.ssh/config.local` in a **private** gist or local note — they contain
  enough context to rebuild quickly but must not be in the public dotfiles repo
