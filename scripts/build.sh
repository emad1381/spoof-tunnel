#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
command -v go >/dev/null
command -v npm >/dev/null
test "$(go env GOOS)" = linux || { echo 'Build the Linux service on Linux/WSL.' >&2; exit 1; }
(cd panel/frontend && npm ci --no-audit --no-fund && npm run lint && npm run typecheck && npm run build)
rm -rf panel/backend/cmd/panel/web && mkdir -p panel/backend/cmd/panel/web dist
cp -a panel/frontend/out/. panel/backend/cmd/panel/web/
# Resolve the release version once and stamp it into both binaries, so
# the panel header and `spoof-l3 --version` can never disagree again.
VERSION="${SPOOF_VERSION:-$(git describe --tags --exact-match 2>/dev/null || git describe --tags --always 2>/dev/null || echo dev)}"
VERSION="${VERSION#panel-}"
CGO_ENABLED=0 go build -trimpath -ldflags "-X github.com/ParsaKSH/spoof-tunnel/internal/l3.Version=$VERSION" -o dist/spoof-l3 ./cmd/spoof-l3
(cd panel/backend && CGO_ENABLED=0 go build -trimpath -ldflags "-X main.panelVersion=$VERSION" -o ../../dist/spoof-panel ./cmd/panel)
echo "Panel version stamped: $VERSION"
# Packaging writes LF-only checksums and normalizes text files for Linux.
SPOOF_ARCH="$(go env GOARCH)" python3 scripts/package.py
echo 'Built dist/. Run sudo bash dist/install.sh on each server.'
