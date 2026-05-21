#!/usr/bin/env bash
set -euo pipefail

HA_HOST="test-assistant.fritz.box"
HA_USER="root"
HA_WWW_PATH="/config/www/tabularizer"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_FILE="$REPO_ROOT/frontend/dist/tabularizer-card.js"

echo "==> Building frontend..."
. "$HOME/.nvm/nvm.sh"
BUILD_TMP=$(mktemp -d /tmp/tabularizer-frontend-XXXXXX)
trap 'rm -rf "$BUILD_TMP"' EXIT
rsync -a --exclude='node_modules' --exclude='dist' "$REPO_ROOT/frontend/" "$BUILD_TMP/"
cd "$BUILD_TMP"
npm ci
npm run build
rsync -a "$BUILD_TMP/dist/" "$REPO_ROOT/frontend/dist/"

echo "==> Deploying to $HA_USER@$HA_HOST:$HA_WWW_PATH..."
ssh "$HA_USER@$HA_HOST" "mkdir -p $HA_WWW_PATH"
scp "$DIST_FILE" "$HA_USER@$HA_HOST:$HA_WWW_PATH/tabularizer-card.js"

echo ""
echo "Done. Reload browser or clear Lovelace cache to pick up changes."
