#!/bin/bash

set -euo pipefail

SERVICE_PATH="/etc/systemd/system/disable-lid-wakeup.service"

usage() {
  cat <<'EOF'
Usage: scripts/install-lid-wakeup-fix.sh [--uninstall]

Install or remove a small systemd service that disables ACPI lid wakeup
at boot on Macs where an open lid causes immediate resume from suspend.

Options:
  --uninstall   Remove the service and re-enable lid wakeup now
  -h, --help    Show this help
EOF
}

write_service() {
  sudo install -d /etc/systemd/system
  sudo tee "$SERVICE_PATH" >/dev/null <<'EOF'
[Unit]
Description=Disable ACPI lid wakeup on boot
After=local-fs.target

[Service]
Type=oneshot
ExecStart=/usr/bin/sh -c "grep -q 'LID0.*enabled' /proc/acpi/wakeup && echo LID0 > /proc/acpi/wakeup || true"

[Install]
WantedBy=multi-user.target
EOF
}

disable_lid_wakeup_now() {
  if grep -q 'LID0.*enabled' /proc/acpi/wakeup; then
    echo LID0 | sudo tee /proc/acpi/wakeup >/dev/null
  fi
}

enable_lid_wakeup_now() {
  if grep -q 'LID0.*disabled' /proc/acpi/wakeup; then
    echo LID0 | sudo tee /proc/acpi/wakeup >/dev/null
  fi
}

uninstall() {
  sudo systemctl disable --now disable-lid-wakeup.service >/dev/null 2>&1 || true
  sudo rm -f "$SERVICE_PATH"
  sudo systemctl daemon-reload
  enable_lid_wakeup_now
  echo "Removed disable-lid-wakeup.service and re-enabled lid wakeup."
}

install_fix() {
  write_service
  sudo systemctl daemon-reload
  sudo systemctl enable --now disable-lid-wakeup.service
  disable_lid_wakeup_now
  echo "Installed disable-lid-wakeup.service and disabled lid wakeup."
}

case "${1:-}" in
  --uninstall)
    uninstall
    ;;
  -h|--help)
    usage
    ;;
  "")
    install_fix
    ;;
  *)
    echo "Unknown option: $1" >&2
    usage >&2
    exit 1
    ;;
esac
