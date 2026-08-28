#!/bin/sh
set -eu

REPO="B-Divyesh/sf-document-history-bridge"
MANIFEST_URL="https://github.com/$REPO/releases/latest/download/latest.json"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT INT TERM

case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) PLATFORM="macos-arm64" ;;
  Darwin-x86_64) PLATFORM="macos-x64" ;;
  Linux-x86_64) PLATFORM="linux-x64" ;;
  *) printf '%s\n' "Unsupported platform: $(uname -s) $(uname -m)" >&2; exit 1 ;;
esac

curl -fsSL "$MANIFEST_URL" -o "$TMP_DIR/latest.json"
LINE="$(tr -d '\n' < "$TMP_DIR/latest.json" | sed -n "s/.*\"$PLATFORM\"[[:space:]]*:[[:space:]]*{\([^}]*\)}.*/\1/p")"
URL="$(printf '%s' "$LINE" | sed -n 's/.*"url"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
EXPECTED="$(printf '%s' "$LINE" | sed -n 's/.*"sha256"[[:space:]]*:[[:space:]]*"\([a-fA-F0-9]*\)".*/\1/p')"
[ -n "$URL" ] && [ -n "$EXPECTED" ] || { printf '%s\n' "Installer metadata is incomplete." >&2; exit 1; }

ASSET="$TMP_DIR/$(basename "$URL")"
curl -fL "$URL" -o "$ASSET"
if command -v sha256sum >/dev/null 2>&1; then ACTUAL="$(sha256sum "$ASSET" | awk '{print $1}')"; else ACTUAL="$(shasum -a 256 "$ASSET" | awk '{print $1}')"; fi
[ "$ACTUAL" = "$EXPECTED" ] || { printf '%s\n' "Checksum verification failed. Nothing was installed." >&2; exit 1; }

if [ "$PLATFORM" = "linux-x64" ]; then
  mkdir -p "$HOME/.local/bin"
  cp "$ASSET" "$HOME/.local/bin/document-history-bridge"
  chmod 755 "$HOME/.local/bin/document-history-bridge"
  printf '%s\n' "Verified and installed Document History Bridge at $HOME/.local/bin/document-history-bridge"
else
  DEST="$HOME/Downloads/Document-History-Bridge.dmg"
  cp "$ASSET" "$DEST"
  open "$DEST"
  printf '%s\n' "Verified the download and opened $DEST. Drag the app to Applications. The build is unsigned; Control-click and choose Open on first launch."
fi
