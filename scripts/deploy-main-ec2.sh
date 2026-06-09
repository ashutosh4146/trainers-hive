#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/trainers-hive}"
WEB_ROOT="${WEB_ROOT:-/var/www/html}"
NODE_HEAP_MB="${NODE_HEAP_MB:-6144}"
API_PM2_NAME="${API_PM2_NAME:-api-server}"

cd "$APP_DIR"

echo "==> Updating main"
git fetch origin
git checkout main
git reset --hard origin/main

echo "==> Current commit"
git log --oneline -1

echo "==> Installing dependencies"
pnpm install

echo "==> Building API"
pnpm --filter @workspace/api-server run build

echo "==> Building frontend with heap ${NODE_HEAP_MB}MB"
export NODE_OPTIONS="--max-old-space-size=${NODE_HEAP_MB}"
PORT=3000 BASE_PATH="/" pnpm --filter @workspace/trainers-hive run build

echo "==> Publishing frontend to ${WEB_ROOT}"
sudo rm -rf "${WEB_ROOT:?}"/*
sudo cp -a "$APP_DIR/artifacts/trainers-hive/dist/public/." "$WEB_ROOT/"
sudo chown -R www-data:www-data "$WEB_ROOT"
sudo find "$WEB_ROOT" -type d -exec chmod 755 {} \;
sudo find "$WEB_ROOT" -type f -exec chmod 644 {} \;

echo "==> Reloading Nginx"
sudo nginx -t
sudo systemctl reload nginx

echo "==> Restarting API PM2 process"
pm2 restart "$API_PM2_NAME" --update-env
pm2 status

echo "==> Health check"
if command -v curl >/dev/null 2>&1; then
  curl -fsS http://localhost:8080/api/healthz || true
  echo
fi

echo "==> Deploy complete"
