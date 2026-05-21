#!/usr/bin/env bash
set -euo pipefail

HA_HOST="test-assistant.local"
HA_USER="root"
HA_WWW_PATH="/config/www/tabularizer"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_FILE="$REPO_ROOT/frontend/dist/tabularizer-card.js"

echo "==> Building frontend..."
# shellcheck source=/dev/null
[ -f "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"
BUILD_TMP=$(mktemp -d /tmp/tabularizer-frontend-XXXXXX)
trap 'rm -rf "$BUILD_TMP"' EXIT
find "$REPO_ROOT/frontend" -mindepth 1 -maxdepth 1 \
  ! -name 'node_modules' ! -name 'dist' \
  -exec cp -r {} "$BUILD_TMP/" \;
cd "$BUILD_TMP"
npm ci
npm run build
cp -r "$BUILD_TMP/dist/." "$REPO_ROOT/frontend/dist/"

echo "==> Deploying to $HA_USER@$HA_HOST:$HA_WWW_PATH..."
ssh "$HA_USER@$HA_HOST" "mkdir -p $HA_WWW_PATH"
scp "$DIST_FILE" "$HA_USER@$HA_HOST:$HA_WWW_PATH/tabularizer-card.js"

echo ""
echo "Done. Reload browser or clear Lovelace cache to pick up changes."
