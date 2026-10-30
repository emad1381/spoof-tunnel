#!/usr/bin/env bash
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run as root.' >&2; exit 1; }
[[ $(uname -s) == Linux ]] || { echo 'Linux required.' >&2; exit 1; }
command -v systemctl >/dev/null || { echo 'systemd required.' >&2; exit 1; }
command -v ip >/dev/null || { echo 'Install iproute2 first.' >&2; exit 1; }
[[ -c /dev/net/tun ]] || { echo '/dev/net/tun unavailable; enable TUN on the VPS.' >&2; exit 1; }
src=$(cd "$(dirname "$0")" && pwd)
for file in spoof-l3 spoof-panel; do [[ -f "$src/$file" ]] || { echo "Missing $src/$file; use the built dist package." >&2; exit 1; }; done
if [[ -f "$src/SHA256SUMS" ]]; then (cd "$src" && sha256sum -c SHA256SUMS); fi
install -d -m 700 /etc/spoof-panel
install -d -m 755 /opt/emad-spoof
# Stop the old service before replacing an executing Linux binary.
systemctl stop emad-spoof-panel.service 2>/dev/null || true
install -m 755 "$src/spoof-l3" /etc/spoof-panel/spoof-l3
install -m 755 "$src/spoof-panel" /opt/emad-spoof/spoof-panel
if [[ ! -f /etc/spoof-panel/panel.db ]]; then
 /opt/emad-spoof/spoof-panel --setup
fi
cat > /etc/systemd/system/emad-spoof-panel.service <<'UNIT'
[Unit]
Description=EMAD Spoof Tunnel Panel
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
Environment=SPOOF_DATA_DIR=/etc/spoof-panel
ExecStart=/opt/emad-spoof/spoof-panel
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
systemctl enable --now emad-spoof-panel.service
echo 'Installed. Status: systemctl status emad-spoof-panel'
echo 'Panel URL: journalctl -u emad-spoof-panel -n 20 --no-pager'
echo 'Use HTTPS via a reverse proxy, or access the panel through SSH forwarding.'
