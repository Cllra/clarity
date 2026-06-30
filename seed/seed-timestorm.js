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
 *   - Extrahiert profile_target-Hashes aus den Seiten-URLs (?mode=<REGION><hash>)
 *   - Fügt alle neuen Spieler per POST /api/global/player/add zum Pool hinzu
 *
 * Vor Ausführung: SEED_PAGES unten mit den echten timestorm.de-URLs befüllen.
 * Die URL-Struktur auf timestorm.de prüfen – Hashes stehen in hrefs als ?mode=<REGION><hash>.
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

// Format auf timestorm.de: <REGION><32 hex chars>, z.B. EU2add931a82368b07c890a4cca74777f8
// "AS" ist ihre Abkürzung für ASIA
const REGION_MAP = { AS: 'ASIA' };

function extractTargets(html) {
  const results = [];
  const seen = new Set();
  const regex = /\b([A-Z]{2,4})([0-9a-f]{32})\b/g;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const rawRegion = m[1];
    const hash      = m[2];
    const region    = REGION_MAP[rawRegion] || rawRegion;
    const key       = hash;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({ profileTarget: hash, region });
    }
  }
  return results;
}

async function main() {
  if (!ADMIN_TOKEN) throw new Error('ADMIN_TOKEN nicht gesetzt');
  const allTargets = new Map(); // profileTarget → region
  let added = 0;

  for (const { url, label } of SEED_PAGES) {
    console.log(`Lade ${label} von ${url}...`);
    try {
      const res = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; clarity-seed/1.0; +https://clarity-guild.live)' },
        timeout: 30000
      });
      const targets = extractTargets(res.data);
      console.log(`  ${targets.length} Profile-Hashes gefunden`);
      for (const t of targets) allTargets.set(t.profileTarget, t.region);
    } catch (e) {
      console.error(`  Fehler beim Laden von ${url}: ${e.message}`);
    }
  }

  console.log(`\nInsgesamt ${allTargets.size} einzigartige Profile — füge zum Pool hinzu...`);

  for (const [profileTarget, region] of allTargets) {
    try {
      const res = await axios.post(
        `${SERVER_URL}/api/global/player/add`,
        { profileTarget, region, source: 'seed' },
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
}

main().catch(e => {
  console.error('Fehler:', e.message);
  process.exit(1);
});
