# Clarity — BDO Guild Leaderboard

## Stack
- Backend: Node.js (server.js)
- DB: SQLite (/data/clarity.db)
- External API: man90/bdo-rest-api
- Proxy: Caddy (shared, /root/services/caddy/Caddyfile)
- Server: Hetzner VPS /root/services/clarity

## Docker Services
- clarity-backend — Node.js Server
- bdo-api — BDO REST API (man90/bdo-rest-api:latest, aktuell v1.19.2)
- clarity-redis — Redis 7 Alpine, Pflicht seit v1.19.2 (vorher optional/in-memory)

## Erreichbarkeit
- Prod: clarity-guild.live
- Staging: clarity.fuhrmann.dev

## Deploy
Nach jeder Änderung:
./deploy.sh "kurze Beschreibung der Änderung"

## Wichtige Regeln
- Caddyfile IMMER erst lesen bevor es geändert wird
- docker-compose.yml nur nach Rückfrage ändern
- .env Datei niemals committen (enthält ADMIN_TOKEN)
- data/ Ordner nicht anfassen (SQLite DB)

## Stand nach Update auf bdo-api v1.19.2 (2026-05-29)

### Bereits erledigt
- Redis-URL Fix: `command: ["-redis", "redis://redis:6379/0"]` (v1.19.2 erwartet vollständige URL)
- `isRunning`-Guard gegen parallele Scrape-Runs in server.js eingebaut
- Request-Delay zwischen Spielerprofilen: 2500ms → 5000ms erhöht

### Offenes Problem: Incapsula-Block
Die Server-IP ist von Incapsula (BDO Anti-Bot WAF) geblockt. Der `/v1/guild`-Endpoint der bdo-api antwortet dauerhaft mit `status: pending` und löst nie auf.

**Ursache:** v1.19.2 lief kurzzeitig mit falscher Redis-URL → kein Caching → alle Requests direkt an BDO-Server → IP-Block ausgelöst.

**Diagnose:** `docker exec clarity-backend wget -qO- "http://bdo-api:8001/v1/guild?guildName=clarity&region=EU"` liefert `status: pending` ohne je aufzulösen. BDO-Server liefern Incapsula-Challenge-Seite statt Daten.

**Lösung:** Residential Proxy einrichten. bdo-api unterstützt `-proxy` Flag:
```yaml
command: ["-redis", "redis://redis:6379/0", "-proxy", "http://<proxy-host>:<port>"]
```
Empfehlung: Webshare oder Smartproxy (~$3-5/mo). Tor funktioniert nicht (ausgehende Tor-Verbindungen am Hetzner-Server geblockt).

## Projektstruktur
- backend/server.js — Hauptanwendung
- backend/public/ — Frontend (statisches HTML)
- data/ — SQLite Datenbank (nicht in Git)
- docker-compose.yml — Service-Definitionen
- .env — Secrets (nicht in Git)
