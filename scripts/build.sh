#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
command -v go >/dev/null
command -v npm >/dev/null
test "$(go env GOOS)" = linux || { echo 'Build the Linux service on Linux/WSL.' >&2; exit 1; }
(cd panel/frontend && npm ci --no-audit --no-fund && npm run build)
mkdir -p panel/backend/cmd/panel/web dist
cp -a panel/frontend/out/. panel/backend/cmd/panel/web/
CGO_ENABLED=0 go build -trimpath -o dist/spoof-l3 ./cmd/spoof-l3
(cd panel/backend && CGO_ENABLED=0 go build -trimpath -o ../../dist/spoof-panel ./cmd/panel)
cp scripts/install.sh dist/install.sh
cp README.md README-fa.md LICENSE NOTICE dist/
cp -a docs dist/
(cd dist && sha256sum spoof-l3 spoof-panel > SHA256SUMS)
echo 'Built dist/. Run sudo bash dist/install.sh on each server.'
