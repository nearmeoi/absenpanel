#!/bin/bash
# ═══════════════════════════════════════
# AbsenPanel Auto-Deploy Script
# Runs on VPS — triggered by GitHub Webhook
# ═══════════════════════════════════════

APP_DIR="/home/ubuntu/absenpanel"
PM2_NAME="absenpanel"
LOG_FILE="/tmp/absenpanel-deploy.log"

echo "$(date) — Deploy triggered" >> "$LOG_FILE"

cd "$APP_DIR" || exit 1

# Pull latest changes
git pull origin main >> "$LOG_FILE" 2>&1

# Build
go build -o absenpanel . >> "$LOG_FILE" 2>&1

if [ $? -eq 0 ]; then
    echo "$(date) — Build successful, restarting..." >> "$LOG_FILE"
    pm2 restart "$PM2_NAME" >> "$LOG_FILE" 2>&1
    echo "$(date) — Deploy complete ✓" >> "$LOG_FILE"
else
    echo "$(date) — Build FAILED" >> "$LOG_FILE"
fi
