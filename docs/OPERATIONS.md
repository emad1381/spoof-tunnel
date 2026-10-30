# Operations

## Service and data

```sh
systemctl status emad-spoof-panel
journalctl -u emad-spoof-panel -n 100 --no-pager
systemctl restart emad-spoof-panel
systemctl stop emad-spoof-panel
```

Data is under `/etc/spoof-panel`: SQLite database, private generated configurations and `spoof-l3`. The panel binary is `/opt/emad-spoof/spoof-panel`. Back up the database while stopped; it contains PSKs and password hashes. Installer upgrades preserve it and stop the service before replacing binaries.

Administrator bootstrap is CLI-only; the HTTP setup endpoint is disabled. The persistent JWT secret survives restarts. Tokens expire after 24 hours. Password changes increment the administrator token version and invalidate previously issued tokens.

Use HTTPS reverse proxy or SSH forwarding for remote management. Preserve the complete random URL prefix and WebSocket Upgrade headers. The service does not enable permissive CORS. Trusted administrators can see PSKs through authenticated exports/configuration APIs. It is not a multi-tenant security boundary.

The systemd service bounds capabilities to CAP_NET_ADMIN/CAP_NET_RAW, restricts system writes, uses a private temporary directory and keeps a private data directory. The installer requires systemd, iproute2 and `/dev/net/tun`. It does not silently install a new host firewall policy.

## Use the link

The default subnet gives Iran `10.77.0.1` and the foreign peer `10.77.0.2`. First:

```sh
ping -c 3 10.77.0.2
```

Bind your service to the foreign TUN address. Example, in a directory containing only public diagnostic files:

```sh
# Foreign host
python3 -m http.server 18080 --bind 10.77.0.2
# Iran host
curl --max-time 10 http://10.77.0.2:18080/
```

Publishing a public Iran port to this private service requires a separate TCP proxy or explicitly scoped forwarding rules. The panel does not add public exposure implicitly. LAN or Internet gateway routing requires deliberate forwarding/routes/NAT owned by the deployment. Keep real endpoint routes outside the TUN ranges.

## Diagnose in order

1. **Process error:** read instance logs; inspect TUN availability, local assigned IP, permissions, interface collision and MTU.
2. **Running without peer response:** start/import the actual paired peer; check PSK, real/spoof IPs, reciprocal carriers and identifiers/ports.
3. **Both running without response:** verify source spoof acceptance in both providers, firewall and reverse-path filtering. Software cannot override provider source validation.
4. **Peer connected but no ping:** inspect TUN addresses, subnet and host firewall.
5. **Ping works but service fails:** check application bind address, port, listening sockets and explicit forwarding.
6. **Intermittent:** check clock sync, outer loss and MTU. TCP-shaped carriers are not congestion-controlled TCP.

Each link needs a unique `/30`; the builder creates an interface name. Stop a running link before editing. Coordinate carrier/key changes at both ends. Use the auto-start checkbox in the pair builder or TUN editor to choose boot persistence; starting a process alone does not change that preference.

To roll back, restore a matching old binary pair and database backup, then restart. There is no remote automatic updater. Disabling the systemd service preserves the data.
