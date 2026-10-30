# Validation record

Environment: Linux/WSL, two isolated network namespaces joined by private veth. Endpoints/spoof sources use documentation ranges; no public spoof packets were sent by the integration test.

| Outer send/receive | Inner ping | Exact TCP echo | UDP echo | Authenticated heartbeat |
|---|---|---|---|---|
| ICMP / ICMP | pass | 128 KiB | pass | pass |
| UDP / UDP | pass | 128 KiB | pass | pass |
| raw TCP / raw TCP | pass | 128 KiB | pass | pass |
| protocol 4 / protocol 4 | pass | 128 KiB | pass | pass |
| protocol 253 / protocol 253 | pass | 128 KiB | pass | pass |
| raw TCP / UDP | pass | 128 KiB | pass | pass |

`go test -race ./internal/l3` checks authentication, tampering, replay, reflection, wrong keys, reordering and sequence windows. Backend tests check IPv4/port validation and complementary pair construction. Production frontend build includes TypeScript validation and static export.

Run `scripts/integration_l3.py` as root after building `spoof-l3`, or set `EMAD_L3_BINARY`. It creates uniquely named namespaces and removes them in cleanup without modifying host firewall/routes.

These tests do not prove real provider spoof support, censorship behavior, long-running stability, sustained throughput, independent cryptographic review or every browser/device. A CI reference is supplied at `.github/emad-ci.reference.yml`. Activating it under `.github/workflows/` requires GitHub workflow permission. Existing inherited workflows remain unchanged; local results are distinct from their results.
