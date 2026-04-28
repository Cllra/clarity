# Clarity — BDO Guild Leaderboard

## Stack
- Backend: Node.js (server.js)
- DB: SQLite (/data/clarity.db)
- External API: man90/bdo-rest-api
- Proxy: Caddy (shared, /root/services/caddy/Caddyfile)
- Server: Hetzner VPS /root/services/clarity

## Docker Services
- clarity-backend — Node.js Server
- bdo-api — BDO REST API

## Deploy
Nach jeder Änderung:
./deploy.sh "kurze Beschreibung der Änderung"

## Wichtige Regeln
- Caddyfile IMMER erst lesen bevor es geändert wird
- docker-compose.yml nur nach Rückfrage ändern
- .env Datei niemals committen (enthält ADMIN_TOKEN)
- data/ Ordner nicht anfassen (SQLite DB)

## Projektstruktur
- backend/server.js — Hauptanwendung
- backend/public/ — Frontend (statisches HTML)
- data/ — SQLite Datenbank (nicht in Git)
- docker-compose.yml — Service-Definitionen
- .env — Secrets (nicht in Git)
