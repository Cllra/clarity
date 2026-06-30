const axios = require('axios');

const SERVER_URL  = process.env.CLARITY_SERVER_URL || 'https://clarity-guild.live';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const TARGET_DATE = process.env.TARGET_DATE || null;

const BASE         = 'https://www.timestorm.de/';
const ASIAN_REGIONS = process.env.ALL_REGIONS === '1'
  ? null  // null = alle Regionen
  : new Set(['KR', 'JP', 'TW', 'AS', 'TR']);
const REGION_MAP   = { AS: 'ASIA' };

const SKILL_PAGES = [
  { url: '?mode=lifefame',       field: 'life_fame',       numeric: true  },
  { url: '?mode=lifegathering',  field: 'spec_gathering',  numeric: false },
  { url: '?mode=lifefishing',    field: 'spec_fishing',    numeric: false },
  { url: '?mode=lifehunting',    field: 'spec_hunting',    numeric: false },
  { url: '?mode=lifecooking',    field: 'spec_cooking',    numeric: false },
  { url: '?mode=lifealchemy',    field: 'spec_alchemy',    numeric: false },
  { url: '?mode=lifeprocessing', field: 'spec_processing', numeric: false },
  { url: '?mode=lifetraining',   field: 'spec_training',   numeric: false },
  { url: '?mode=lifetrade',      field: 'spec_trading',    numeric: false },
  { url: '?mode=lifefarming',    field: 'spec_farming',    numeric: false },
  { url: '?mode=lifesailing',    field: 'spec_sailing',    numeric: false },
  { url: '?mode=lifebarter',     field: 'spec_barter',     numeric: false },
];

const EMPTY_SKILLS = {
  spec_gathering: '', spec_fishing: '', spec_hunting: '',
  spec_cooking:   '', spec_alchemy:  '', spec_processing: '',
  spec_training:  '', spec_trading:  '', spec_farming: '',
  spec_sailing:   '', spec_barter:   '',
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function parseRows(html) {
  const results = [];
  // Trifft auf:  <td>RANK</td><td><img title="JP"></td><td><a>Name</a></td><td>SCORE</td>
  const regex = /<td>\d+<\/td>\s*<td><img[^>]+title="([A-Z]{2,4})"[^>]*><\/td>\s*<td><a[^>]*>([^<]+)<\/a><\/td>\s*<td>([^<]*)<\/td>/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const rawRegion  = m[1].toUpperCase();
    const familyName = m[2].trim();
    const score      = m[3].trim();
    if ((!ASIAN_REGIONS || ASIAN_REGIONS.has(rawRegion)) && familyName) {
      const region = REGION_MAP[rawRegion] || rawRegion;
      results.push({ familyName, region, score });
    }
  }
  return results;
}

async function main() {
  if (!ADMIN_TOKEN) throw new Error('ADMIN_TOKEN nicht gesetzt');

  const date = TARGET_DATE || new Date(Date.now() - 86400000).toISOString().split('T')[0];
  console.log(`Timestorm Asian Scrape für ${date}`);

  const players = new Map(); // "${region}:${name}" → player obj

  for (const { url, field, numeric } of SKILL_PAGES) {
    console.log(`Lade ${url}...`);
    try {
      const res = await axios.get(BASE + url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; clarity-seed/1.0; +https://clarity-guild.live)' },
        timeout: 15000
      });

      const rows = parseRows(res.data);
      console.log(`  ${rows.length} asiatische Einträge`);

      for (const { familyName, region, score } of rows) {
        const key = `${region}:${familyName}`;
        if (!players.has(key)) {
          players.set(key, { familyName, region, life_fame: 0, contribution_points: 0, energy: 0, ...EMPTY_SKILLS });
        }
        const p = players.get(key);
        p[field] = numeric ? (parseInt(score) || 0) : score;
      }

      await sleep(2000);
    } catch (e) {
      console.error(`  Fehler bei ${url}: ${e.message}`);
    }
  }

  if (players.size === 0) {
    console.log('Keine asiatischen Spieler gefunden.');
    return;
  }

  const playerList = Array.from(players.values());
  console.log(`\nSende ${playerList.length} Spieler in Batches...`);

  const BATCH = 50;
  let totalSaved = 0;
  for (let i = 0; i < playerList.length; i += BATCH) {
    const batch = playerList.slice(i, i + BATCH);
    const res = await axios.post(
      `${SERVER_URL}/api/global/admin/timestorm-snapshot`,
      { date, players: batch },
      { headers: { 'x-admin-token': ADMIN_TOKEN }, timeout: 30000 }
    );
    totalSaved += res.data.saved;
    process.stdout.write(`  ${i + batch.length}/${playerList.length} (${res.data.saved} neu, ${res.data.skipped} übersprungen)\n`);
  }

  console.log(`✅ ${totalSaved} Spieler gespeichert für ${date}`);
}

main().catch(e => {
  console.error('Kritischer Fehler:', e.message);
  process.exit(1);
});
