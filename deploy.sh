#!/bin/bash
# =============================================================
# Runs on every boot (before gunicorn starts)
# Pulls latest code from GitHub and rebuilds if needed
# =============================================================

set -e

APP_DIR="/home/ec2-user/cv2"
LOG="/var/log/cv-deploy.log"

exec >> "$LOG" 2>&1
echo ""
echo "=== Deploy started: $(date) ==="

cd "$APP_DIR"

# Pull latest code
BEFORE=$(git rev-parse HEAD)
git pull origin main
AFTER=$(git rev-parse HEAD)

if [ "$BEFORE" = "$AFTER" ]; then
  echo "No changes. Skipping build."
  exit 0
fi

echo "New commits detected: $BEFORE → $AFTER"

# Check if frontend files changed
if git diff --name-only "$BEFORE" "$AFTER" | grep -q "^web/"; then
  echo "Frontend changed. Rebuilding..."
  cd "$APP_DIR/web"
  npm ci
  npm run build
  cd "$APP_DIR"
  echo "Frontend build done."
else
  echo "No frontend changes. Skipping npm build."
fi

echo "=== Deploy finished: $(date) ==="
