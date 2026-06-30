#!/bin/bash
set -euo pipefail

source /root/services/clarity/.env

RESPONSE=$(curl -s -o /tmp/clarity-trigger-resp.json -w "%{http_code}" \
  -X POST \
  -H "Authorization: token ${GITHUB_PAT}" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/Cllra/clarity/actions/workflows/daily-scrape.yml/dispatches \
  -d '{"ref":"main"}')

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] trigger-scrape: HTTP $RESPONSE"
if [ "$RESPONSE" != "204" ]; then
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Fehler: $(cat /tmp/clarity-trigger-resp.json)"
  exit 1
fi
