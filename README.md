# Clarity — BDO Guild Leaderboard

Lifeskill leaderboard for the Black Desert Online guild **Clarity**, live at [clarity-guild.live](https://clarity-guild.live).

It tracks daily lifeskill levels (gathering, fishing, hunting, cooking, alchemy, processing, training, trading, farming, sailing, barter) for guild members and a pool of players from other guilds, and shows gains over time.

## Pages

| Path | Access | Content |
|---|---|---|
| `/` | Guild members (Discord login) | Guild leaderboard per lifeskill with gains |
| `/world` | Guild members (Discord login) | Clarity compared to players from other guilds and regions |
| `/xp` | Public | XP ranking |

Login uses Discord OAuth. Only members of the guild's Discord server with the configured role get access.

## How it works

```
GitHub Actions (daily, triggered by cron on the server)
  └─ starts its own bdo-api + Redis on the runner
  └─ runs a scraper in scraper/
        └─ POSTs snapshots to clarity-guild.live  (x-admin-token)
                                   │
clarity-guild.live (Docker)        ▼
  clarity-backend  Express + SQLite, serves pages and API
  clarity-secret   small companion service
  bdo-api, redis   local BDO API instance
```

Player data comes from [man90/bdo-rest-api](https://github.com/man90/bdo-rest-api), which reads the official BDO adventurer profiles. The scrapers run on GitHub Actions because the server's IP is blocked by the BDO website. Asian players are read from timestorm.de, since bdo-api does not support those regions.

### Scrapers

| Workflow | Script | What it does |
|---|---|---|
| Daily Scrape | `scraper/scrape.js` | All Clarity guild members |
| Global Scrape — Run 1 / Run 2 | `scraper/scrape-global.js`, `scraper/scrape-timestorm-asian.js` | Players from other guilds and regions, in batches |
| Life Scrape | `scraper/scrape-life.js` | Lifeskill data of the guild `life` |

All workflows are started via `workflow_dispatch`. The server's crontab calls `trigger-scrape.sh` (02:00 UTC) and `trigger-scrape-global.sh` (03:00 UTC).

The BDO website rate-limits requests (HTTP 429). The global scraper therefore stops after a runtime budget (`MAX_RUNTIME_MIN`, default 40) or after several failed players in a row (`MAX_CONSECUTIVE_FAILS`, default 5) and sends what it has collected. Players it did not reach stay pending for the next run.

## Repository layout

```
backend/      Express server, SQLite access, static pages (public/)
scraper/      Scrapers run by GitHub Actions
seed/         One-off seeding scripts
.github/      Workflow definitions
docker-compose.yml
```

## Running it

Requirements: Docker with Compose, an external Docker network `proxy-net` (shared with the reverse proxy, Caddy).

```bash
cp .env.example .env      # fill in the values
docker compose up -d
```

The SQLite database lives in `data/` and is not part of the repository.

### Configuration

All secrets are read from `.env`, which is git-ignored. See `.env.example` for the full list.

| Variable | Used for |
|---|---|
| `ADMIN_TOKEN` | Authenticates the scrapers against the admin API (`x-admin-token` header). Also stored as GitHub Actions secret `ADMIN_TOKEN`. |
| `SESSION_SECRET` | Signs the login session cookie |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | Discord OAuth login |
| `DISCORD_GUILD_ID`, `DISCORD_ROLE_ID` | Which Discord server and role grant access |
| `DISCORD_WEBHOOK` | Notifications to a Discord channel |
| `GITHUB_PAT` | Used by the trigger scripts to start the workflows |

Generate a new admin token with `openssl rand -hex 32`. When you change it, update both `.env` and the GitHub secret, then run `docker compose up -d`.
