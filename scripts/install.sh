#!/usr/bin/env bash
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run as root.' >&2; exit 1; }
[[ $(uname -s) == Linux ]] || { echo 'Linux required.' >&2; exit 1; }
command -v systemctl >/dev/null || { echo 'systemd required.' >&2; exit 1; }
command -v ip >/dev/null || { echo 'Install iproute2 first.' >&2; exit 1; }
[[ -c /dev/net/tun ]] || { echo '/dev/net/tun unavailable; enable TUN on the VPS.' >&2; exit 1; }

src=$(cd "$(dirname "$0")" && pwd)
for file in spoof-l3 spoof-panel; do
  [[ -f "$src/$file" ]] || { echo "Missing $src/$file; use the built dist package." >&2; exit 1; }
done

# Verify checksums. The list may carry CRLF if it was produced on Windows,
# so strip carriage returns before feeding it to sha256sum.
if [[ -f "$src/SHA256SUMS" ]]; then
  if ( cd "$src" && tr -d '\r' < SHA256SUMS | sha256sum -c - >/dev/null 2>&1 ); then
    echo "  ✓ Package checksums verified"
  else
    echo 'Checksum verification failed; refusing to install a corrupted package.' >&2
    exit 1
  fi
fi

install -d -m 700 /etc/spoof-panel
install -d -m 755 /opt/spoof-panel

# Clean up the legacy service/binary layout from older releases.
systemctl stop emad-spoof-panel.service 2>/dev/null || true
systemctl disable emad-spoof-panel.service 2>/dev/null || true
rm -f /etc/systemd/system/emad-spoof-panel.service
rm -rf /opt/emad-spoof

# Stop the current service before replacing a running binary.
systemctl stop spoof-panel.service 2>/dev/null || true

install -m 755 "$src/spoof-l3" /etc/spoof-panel/spoof-l3
install -m 755 "$src/spoof-panel" /opt/spoof-panel/spoof-panel

# Bootstrap the administrator account on first install only.
first_run=0
if [[ ! -f /etc/spoof-panel/panel.db ]]; then
  first_run=1
  /opt/spoof-panel/spoof-panel --setup
fi

cat > /etc/systemd/system/spoof-panel.service <<'UNIT'
[Unit]
Description=Spoof Tunnel Panel
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
Environment=SPOOF_DATA_DIR=/etc/spoof-panel
ExecStart=/opt/spoof-panel/spoof-panel
Restart=on-failure
RestartSec=3
KillMode=mixed
TimeoutStopSec=30
UMask=0077
LimitNOFILE=65536
NoNewPrivileges=true
CapabilityBoundingSet=CAP_NET_ADMIN CAP_NET_RAW
AmbientCapabilities=CAP_NET_ADMIN CAP_NET_RAW
ProtectSystem=strict
ReadWritePaths=/etc/spoof-panel
ProtectHome=true
ProtectKernelTunables=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable spoof-panel.service >/dev/null 2>&1 || true
systemctl restart spoof-panel.service >/dev/null 2>&1 || true
sleep 1

if systemctl is-active --quiet spoof-panel.service; then
  state='running'
else
  state='not running — inspect: journalctl -u spoof-panel -n 50 --no-pager'
fi

server_ip=$(curl -s4 --max-time 3 ifconfig.me 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')

echo ""
echo "  ✓ Installation complete"
echo "  Service : spoof-panel ($state)"
echo "  Status  : systemctl status spoof-panel"
echo "  Logs    : journalctl -u spoof-panel -f"
[[ -n "${server_ip:-}" ]] && echo "  Server  : $server_ip"
if [[ $first_run -eq 0 ]]; then
  echo "  Note    : existing database preserved; credentials unchanged."
fi
echo ""
