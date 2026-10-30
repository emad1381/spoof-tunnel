# Spoof Tunnel · EMAD

![Panel](docs/images/dashboard.png)
[فارسی](README-fa.md) · [Architecture](docs/ARCHITECTURE.md) · [Operations](docs/OPERATIONS.md) · [Tests](docs/TESTING.md)

An authenticated IPv4 **TUN tunnel** with a Persian web panel, paired configuration builder, real peer status and Linux installer. Derived from [ParsaKSH/spoof-tunnel](https://github.com/ParsaKSH/spoof-tunnel), Apache-2.0.

The new `spoof-l3` engine carries **inner TCP, UDP and ICMP** over ICMP, TCP-shaped raw packets, UDP, IP protocol 4 or experimental protocol 253. Send and receive carriers are independently selectable. The new engine and panel need no Rust/eBPF toolchain. The upstream UDP relay remains separate in source.

## One-line installation

Run as root on **each Linux amd64 VPS**. No build toolchain is needed; this downloads the tested release package.

```sh
curl -fsSL https://raw.githubusercontent.com/emad1381/spoof-tunnel/main/install.sh | bash
```

## Features

- TUN address/MTU configuration; unique interfaces and subnets per link.
- AES-256-GCM, directional keys, random sessions, replay windows and authenticated challenge/response heartbeat.
- Complementary JSON exports/imports: generate once, import the peer, start both.
- Separate process and peer states, traffic counters, live logs and SQLite persistence.
- CLI administrator bootstrap and systemd installer.
- No implicit default-route, public port forwarding, NAT or global firewall changes.

## Build and install

Requirements: Linux/WSL, Go version from go.mod, Node.js 24+ and npm. Both VPSs need `/dev/net/tun`, iproute2 and permission to send spoofed source addresses.

```sh
bash scripts/build.sh
```

Copy the **entire dist directory** to each VPS:

```sh
sudo bash dist/install.sh
```

First install prints random administrator credentials and URL. Later installs preserve the database. The panel serves HTTP: use HTTPS reverse proxy or SSH forwarding for remote administration. The URL prefix does not replace authentication.

## Connect

1. Open both panels. Choose **ساخت اتصال دوطرفه** on one.
2. Enter the real and spoofed source IPv4 addresses of both hosts separately.
3. Choose outer carriers, receiver identifiers/ports, a unique `/30` subnet and this panel's role.
4. Generate. Download the other end's JSON and import it under **اتصال‌ها** on the peer. The export contains the PSK: keep it private.
5. Start both ends. Process status appears first; authenticated peer response appears only when the other end answers.
6. Reach services through TUN addresses, e.g. `ping 10.77.0.2`. Bind the service to the foreign TUN address or configure explicit forwarding; see [Operations](docs/OPERATIONS.md).

This creates a private link; it does not automatically publish a public application port or route all Internet traffic. Each link needs a non-overlapping subnet. The builder generates a distinct interface name.

## Verify

```sh
go test -race ./internal/l3
(cd panel/backend && go test -race ./internal/...)
go build -o spoof-l3 ./cmd/spoof-l3
sudo python3 scripts/integration_l3.py
```

Six carrier combinations passed isolated namespace tests: ping, 128 KiB exact TCP echo, UDP echo and authenticated heartbeats. This is not proof of provider-specific reachability or sustained production performance.

## Scope

Linux and IPv4. No FEC, custom retransmission/congestion control, automatic fallback, IPv6 or default gateway wizard. Inner TCP handles its own reliability. The frame design is documented and tested, without an independent cryptographic audit.

This project is not PenguTunnel or wire-compatible with it. Protocol 4 carries encrypted project frames, not standard IPIP payload. TCP-shaped carriers do not perform a normal TCP handshake. No standardized GRE/OSPF/IPsec support is claimed. Provider source validation can block the tunnel regardless of software.

## Attribution

[LICENSE](LICENSE), [NOTICE](NOTICE). Upstream history is retained. No PenguTunnel binary, decompilation, licensing patch, operational PSK or access token is included.
