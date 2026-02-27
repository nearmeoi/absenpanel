#!/bin/bash
# ═══════════════════════════════════════
# Webhook Listener for Auto-Deploy
# Listens on port 9000 for GitHub push events
# ═══════════════════════════════════════
#
# SETUP (run once on VPS):
#   1. Install webhook: sudo apt install webhook
#      OR: go install github.com/adnanh/webhook@latest
#
#   2. Create webhook config:
#      Save this as /home/ubuntu/webhook.json:
#
#      [
#        {
#          "id": "absenpanel-deploy",
#          "execute-command": "/home/ubuntu/absenpanel/scripts/deploy.sh",
#          "command-working-directory": "/home/ubuntu/absenpanel",
#          "response-message": "Deploying...",
#          "trigger-rule": {
#            "match": {
#              "type": "payload-hmac-sha256",
#              "secret": "YOUR_WEBHOOK_SECRET",
#              "parameter": {
#                "source": "header",
#                "name": "X-Hub-Signature-256"
#              }
#            }
#          }
#        }
#      ]
#
#   3. Start webhook listener:
#      webhook -hooks /home/ubuntu/webhook.json -port 9000 &
#      OR via PM2: pm2 start "webhook -hooks /home/ubuntu/webhook.json -port 9000" --name webhook
#
#   4. On GitHub repo → Settings → Webhooks → Add webhook:
#      Payload URL: http://YOUR_VPS_IP:9000/hooks/absenpanel-deploy
#      Content type: application/json
#      Secret: YOUR_WEBHOOK_SECRET
#      Events: Just the push event
#
# ═══════════════════════════════════════
#
# ALTERNATIVE (simpler, no webhook needed):
# Just use a cron job that polls every minute:
#
#   crontab -e
#   * * * * * cd /home/ubuntu/absenpanel && git fetch origin main && [ $(git rev-parse HEAD) != $(git rev-parse origin/main) ] && /home/ubuntu/absenpanel/scripts/deploy.sh
#
# ═══════════════════════════════════════

echo "See comments in this file for setup instructions."
