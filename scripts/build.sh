#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
command -v go >/dev/null
command -v npm >/dev/null
test "$(go env GOOS)" = linux || { echo 'Build the Linux service on Linux/WSL.' >&2; exit 1; }
(cd panel/frontend && npm ci --no-audit --no-fund && npm run build)
rm -rf panel/backend/cmd/panel/web && mkdir -p panel/backend/cmd/panel/web dist
cp -a panel/frontend/out/. panel/backend/cmd/panel/web/
CGO_ENABLED=0 go build -trimpath -o dist/spoof-l3 ./cmd/spoof-l3
# Stamp the panel release version into the binary (see panelVersion in
# panel/backend/cmd/panel/main.go). SPOOF_VERSION wins; otherwise use
# the current git tag, so a release build always reports its own tag
# in --version, the startup banner and the panel header.
VERSION="${SPOOF_VERSION:-$(git describe --tags --exact-match 2>/dev/null || git describe --tags --always 2>/dev/null || echo dev)}"
(cd panel/backend && CGO_ENABLED=0 go build -trimpath -ldflags "-X main.panelVersion=$VERSION" -o ../../dist/spoof-panel ./cmd/panel)
echo "Panel version stamped: $VERSION"
# Packaging writes LF-only checksums and normalizes text files for Linux.
python3 scripts/package.py
echo 'Built dist/. Run sudo bash dist/install.sh on each server.'
