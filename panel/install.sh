#!/usr/bin/env bash
set -euo pipefail
# Compatibility entry point for older installation links.
work=$(mktemp -t spoof-installer.XXXXXX)
trap 'rm -f -- "$work"' EXIT
curl -fsSL --proto '=https' https://raw.githubusercontent.com/emad1381/spoof-tunnel/main/install.sh -o "$work"
bash "$work"
