/**
 * Einmaliger Seed-Import von timestorm.de
 *
 * Nutzung (im /seed Verzeichnis):
 *   npm install axios
 *   ADMIN_TOKEN=... CLARITY_SERVER_URL=https://clarity-guild.live node seed-timestorm.js
 *
 * !! Nur einmalig zum Bootstrappen – nicht automatisieren !!
 * !! Vorher timestorm.de-Betreiber kontaktieren             !!
 *
 * Was es tut:
 *   - Ruft timestorm.de Life-Fame- und Lifeskill-Ranglisten ab
 *   - Extrahiert Familiennamen + Regionen aus den Spielerlinks (?mode=<REGION><hash>)
 *   - Fügt alle neuen Spieler per POST /api/global/player/add zum Pool hinzu
 *   - Der globale Scraper löst die Namen später via bdo-api/search in profileTargets auf
 */

const axios = require('axios');

const SERVER_URL  = process.env.CLARITY_SERVER_URL || 'https://clarity-guild.live';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

// ── timestorm.de Ranglisten ───────────────────────────────────────────────────
const BASE = 'https://www.timestorm.de/';
const SEED_PAGES = [
  { url: BASE + '?mode=lifefame',       label: 'Life Fame'    },
  { url: BASE + '?mode=lifegathering',  label: 'Gathering'    },
  { url: BASE + '?mode=lifefishing',    label: 'Fishing'      },
  { url: BASE + '?mode=lifehunting',    label: 'Hunting'      },
  { url: BASE + '?mode=lifecooking',    label: 'Cooking'      },
  { url: BASE + '?mode=lifealchemy',    label: 'Alchemy'      },
  { url: BASE + '?mode=lifeprocessing', label: 'Processing'   },
  { url: BASE + '?mode=lifetraining',   label: 'Training'     },
  { url: BASE + '?mode=lifetrade',      label: 'Trading'      },
  { url: BASE + '?mode=lifefarming',    label: 'Farming'      },
  { url: BASE + '?mode=lifesailing',    label: 'Sailing'      },
  { url: BASE + '?mode=lifebarter',     label: 'Barter'       },
];
// ─────────────────────────────────────────────────────────────────────────────

// "AS" = timestorm-Abkürzung für ASIA
const REGION_MAP = { AS: 'ASIA' };

/**
 * Extrahiert Familienname + Region aus einem timestorm.de Ranking-HTML.
 * Links haben das Format:  href="?mode=EU2add931a82368b07c890a4cca74777f8"
 * und der Linktext ist der Familienname.
 */
function extractPlayers(html) {
  const results = [];
  const seen = new Set();
  // Treffe auf: href="?mode=EU<32 hex>"...>FamilyName</a>
  const regex = /href=["']?\?mode=([A-Z]{2,4})[0-9a-f]{32}["']?[^>]*>([^<\s][^<]*?)<\/a>/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const rawRegion  = m[1].toUpperCase();
    const familyName = m[2].trim();
    const region     = REGION_MAP[rawRegion] || rawRegion;
    const key        = `${familyName}@${region}`;
    if (!seen.has(key) && familyName) {
      seen.add(key);
      results.push({ familyName, region });
    }
  }
  return results;
}

async function main() {
  if (!ADMIN_TOKEN) throw new Error('ADMIN_TOKEN nicht gesetzt');

  const allPlayers = new Map(); // "Name@Region" → { familyName, region }
  let added = 0;

  for (const { url, label } of SEED_PAGES) {
    console.log(`Lade ${label} von ${url}...`);
    try {
      const res = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; clarity-seed/1.0; +https://clarity-guild.live)' },
        timeout: 30000
      });
      const players = extractPlayers(res.data);
      console.log(`  ${players.length} Spieler gefunden`);
      for (const p of players) allPlayers.set(`${p.familyName}@${p.region}`, p);
    } catch (e) {
      console.error(`  Fehler beim Laden von ${url}: ${e.message}`);
    }
  }

  console.log(`\nInsgesamt ${allPlayers.size} einzigartige Spieler — füge zum Pool hinzu...`);

  for (const { familyName, region } of allPlayers.values()) {
    try {
      const res = await axios.post(
        `${SERVER_URL}/api/global/player/add`,
        { familyName, region, source: 'seed' },
        { headers: { 'x-admin-token': ADMIN_TOKEN }, timeout: 10000 }
      );
      if (res.data.added) {
        added++;
        process.stdout.write(`+`);
      } else {
        process.stdout.write(`.`);
      }
    } catch (e) {
      process.stdout.write(`!`);
    }
  }

  console.log(`\n\n✅ Seed abgeschlossen: ${added} neue Spieler hinzugefügt`);
  console.log(`   Auflösung zu profileTargets erfolgt beim nächsten globalen Scrape-Lauf`);
}

main().catch(e => {
  console.error('Fehler:', e.message);
  process.exit(1);
});
