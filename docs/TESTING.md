# Validation and regressions

Use Linux/WSL with Go from go.mod, Node.js 24, npm, iproute2 and TUN. Raw-socket integration tests require root and run in isolated namespaces; they send no public spoof traffic.

## Checks

```sh
go test -race ./internal/l3 ./internal/tester
(cd panel/backend && go test -race ./internal/... && go vet ./internal/...)
bash scripts/build.sh
(cd panel/frontend && npx playwright install chromium && npm run test:ui)
SPOOF_PANEL_BINARY=dist/spoof-panel python3 scripts/smoke_panel.py
sudo env SPOOF_L3_BINARY="$PWD/dist/spoof-l3" python3 scripts/integration_l3.py
sudo env SPOOF_L3_BINARY="$PWD/dist/spoof-l3" python3 scripts/integration_delay.py
sudo python3 scripts/integration_multipeer.py
```

The carrier matrix covers all 25 ordered send/receive combinations of ICMP, UDP, raw TCP, protocol 4 and protocol 253, plus five homogeneous carrier cases with reciprocal rotating-source allowlists. Every case checks inner ping, an exact 128 KiB TCP echo, UDP echo and authenticated heartbeat responses on both ends. The delayed-path test adds 1700 ms in each direction and requires a valid heartbeat while inner ping RTT exceeds three seconds.

The multi-peer integration test runs the real Go panel and engine with one Iran IP and three simultaneous foreign peers on an isolated virtual switch. For all five carriers (ICMP, UDP, raw TCP, IPIP and protocol 253), peers share receive ports/ICMP identifiers and the foreign spoof source but have separate keys, TUN subnets and public forward ports. Concurrent TCP and UDP probes verify distinct service replies, conflicting configurations are rejected, and stopping/restarting one link leaves the other operational.

Unit regressions cover immediate forwarder stop, TCP half-close, completed-connection goroutine cleanup, diagnostic restart joining, IPv4 iteration overflow, disabled forwarding persistence, subnet/interface conflicts, stale updates, shared password-reset revocation, and WebSocket header authentication. Native legacy transport regressions join receiving calls before freeing Rust handles and close UDP receivers/senders during traffic. Raw tests skip when not run as root.

Playwright uses the real static production output with controlled API responses to check desktop/mobile controls, theme hydration, login errors, diagnostic restoration, IP-pool state, traffic totals, focus management, UTF-8 password lengths slow-response ordering, and the locally served Persian Vazirmatn font. This is separate from smoke_panel.py, which exercises the built Go HTTP server and a temporary real SQLite database, including administrator upgrade/reset behavior.

## Legacy source

The retained UDP relay uses Rust/CGo; the new TUN engine does not. To validate the default legacy library and its Go wrappers:

```sh
(cd rust && cargo test --locked -p spoof-transport && cargo build --locked --release -p spoof-transport)
go test -race ./cmd/... ./internal/...
sudo env "PATH=$PATH" go test -race ./internal/transport
```

Optional XDP requires building the eBPF program and loader with its separate toolchain/kernel support. It is not part of the production TUN carrier matrix.

## CI and limits

The active validation workflow is `.github/workflows/panel-test.yml`; legacy tests are in `test.yml`. Tagged releases run validation before creating amd64 and arm64 packages through `scripts/build.sh` and `scripts/package.py`. Cross-compiled arm64 binaries are packaged rather than executed on amd64 runners. Lint, TypeScript checks and production build errors fail validation.

These checks establish reproducible behavior in the tested environments. They do not establish provider spoof acceptance, censorship resistance, sustained production throughput, every browser/device, an independent cryptographic audit, or infinite-duration stability. Test the actual VPS pair before relying on it.
