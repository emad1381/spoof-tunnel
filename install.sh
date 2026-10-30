#!/usr/bin/env bash
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run with sudo bash install.sh' >&2; exit 1; }
[[ $(uname -s) == Linux && $(uname -m) == x86_64 ]] || { echo 'This package requires Linux amd64; build from source for another Linux architecture.' >&2; exit 1; }
for cmd in curl tar sha256sum; do command -v "$cmd" >/dev/null || { echo "Install $cmd first." >&2; exit 1; }; done

printf '\n  ╔══════════════════════════════════════════════════╗\n'
printf '  ║             SPOOF TUNNEL INSTALLER               ║\n'
printf '  ╚══════════════════════════════════════════════════╝\n\n'

base=https://github.com/emad1381/spoof-tunnel/releases/download
asset=spoof-tunnel-linux-amd64.tar.gz

# Try the requested tag first, then the current and legacy tag names so the
# one-line installer keeps working during release transitions.
candidates=()
[[ -n "${SPOOF_RELEASE:-}" ]] && candidates+=("$SPOOF_RELEASE")
candidates+=("v0.2.0" "emad-v0.2.0")

work=$(mktemp -d -t spoof-install.XXXXXX)
trap 'rm -rf -- "$work"' EXIT

echo "  [1/3] Downloading package..."
downloaded=""
for tag in "${candidates[@]}"; do
  [[ "$tag" =~ ^(emad-)?v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Invalid release tag: $tag" >&2; exit 1; }
  if curl -fsSL --retry 2 --proto '=https' "$base/$tag/$asset" -o "$work/package.tar.gz" 2>/dev/null; then
    downloaded=$tag
    break
  fi
done
[[ -n "$downloaded" ]] || { echo 'Download failed: no release package available.' >&2; exit 1; }
echo "        using release $downloaded"

echo "  [2/3] Extracting files..."
tar -xzf "$work/package.tar.gz" -C "$work"

echo "  [3/3] Setting up service..."
bash "$work/spoof-tunnel-linux-amd64/install.sh"
