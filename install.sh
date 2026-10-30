#!/usr/bin/env bash
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run with sudo bash install.sh' >&2; exit 1; }
[[ $(uname -s) == Linux && $(uname -m) == x86_64 ]] || { echo 'This package requires Linux amd64; build from source for another Linux architecture.' >&2; exit 1; }
for cmd in curl tar sha256sum; do command -v "$cmd" >/dev/null || { echo "Install $cmd first." >&2; exit 1; }; done

printf '\n  ╔══════════════════════════════════════════════════╗\n'
printf '  ║          EMAD · SPOOF TUNNEL INSTALLER           ║\n'
printf '  ╚══════════════════════════════════════════════════╝\n\n'

version=${EMAD_RELEASE:-emad-v0.2.0}
[[ "$version" =~ ^emad-v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'Invalid release version.' >&2; exit 1; }

echo "  [1/3] Downloading package $version..."
work=$(mktemp -d -t emad-install.XXXXXX)
trap 'rm -rf -- "$work"' EXIT

curl -fsSL --retry 3 --proto '=https' \
 "https://github.com/emad1381/spoof-tunnel/releases/download/$version/spoof-tunnel-linux-amd64.tar.gz" \
 -o "$work/package.tar.gz"

echo "  [2/3] Extracting files..."
tar -xzf "$work/package.tar.gz" -C "$work"

echo "  [3/3] Setting up service..."
bash "$work/spoof-tunnel-linux-amd64/install.sh"
