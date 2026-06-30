#!/bin/bash
echo "🚀 Deploying Clarity..."
git add .
git commit -m "${1:-update}"
git push
docker compose up -d --build
docker compose restart clarity-backend
echo "✅ Done"
