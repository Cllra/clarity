const axios = require('axios');

const SERVER_URL  = process.env.CLARITY_SERVER_URL || 'https://clarity-guild.live';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const TARGET_DATE = process.env.TARGET_DATE || null;

const BASE       = 'https://www.timestorm.de/';
const REGION_MAP = { AS: 'ASIA' };
const ASIAN_REGIONS = new Set(['KR', 'JP', 'TW', 'ASIA', 'TR']);

const SKILL_PAGES = [
  { url: '?mode=lifefame',       field: 'life_fame',           numeric: true  },
  { url: '?mode=cp',             field: 'contribution_points', numeric: true  },
  { url: '?mode=energy',         field: 'energy',              numeric: true  },
  { url: '?mode=lifegathering',  field: 'spec_gathering',      numeric: false },
  { url: '?mode=lifefishing',    field: 'spec_fishing',        numeric: false },
  { url: '?mode=lifehunting',    field: 'spec_hunting',        numeric: false },
  { url: '?mode=lifecooking',    field: 'spec_cooking',        numeric: false },
  { url: '?mode=lifealchemy',    field: 'spec_alchemy',        numeric: false },
  { url: '?mode=lifeprocessing', field: 'spec_processing',     numeric: false },
  { url: '?mode=lifetraining',   field: 'spec_training',       numeric: false },
  { url: '?mode=lifetrade',      field: 'spec_trading',        numeric: false },
  { url: '?mode=lifefarming',    field: 'spec_farming',        numeric: false },
  { url: '?mode=lifesailing',    field: 'spec_sailing',        numeric: false },
  { url: '?mode=lifebarter',     field: 'spec_barter',         numeric: false },
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
  const regex = /<td>\d+<\/td>\s*<td><img[^>]+title="([A-Z]{2,4})"[^>]*><\/td>\s*<td><a[^>]*>([^<]+)<\/a><\/td>\s*<td>([^<]*)<\/td>/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const rawRegion  = m[1].toUpperCase();
    const familyName = m[2].trim();
    const score      = m[3].trim();
    if (familyName) {
      const region = REGION_MAP[rawRegion] || rawRegion;
      results.push({ familyName, region, score });
    }
  }
  return results;
}

async function main() {
  if (!ADMIN_TOKEN) throw new Error('ADMIN_TOKEN not set');

  const date = TARGET_DATE || new Date(Date.now() - 86400000).toISOString().split('T')[0];
  console.log(`Timestorm scrape for ${date} (all regions)`);

  const asian   = new Map(); // Asian players — get full snapshot from timestorm
  const western = new Map(); // EU/NA/SA — seed into tracked_players for bdo-api scrape

  for (const { url, field, numeric } of SKILL_PAGES) {
    console.log(`Fetching ${url}...`);
    try {
      const res = await axios.get(BASE + url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; clarity-seed/1.0; +https://clarity-guild.live)' },
        timeout: 15000
      });

      const rows = parseRows(res.data);
      let asianCount = 0, westernCount = 0;

      for (const { familyName, region, score } of rows) {
        const key = `${region}:${familyName}`;
        if (ASIAN_REGIONS.has(region)) {
          if (!asian.has(key)) {
            asian.set(key, { familyName, region, life_fame: 0, contribution_points: 0, energy: 0, ...EMPTY_SKILLS });
          }
          asian.get(key)[field] = numeric ? (parseInt(score) || 0) : score;
          asianCount++;
        } else {
          western.set(key, { familyName, region });
          westernCount++;
        }
      }
      console.log(`  ${asianCount} Asian, ${westernCount} Western`);
      await sleep(2000);
    } catch (e) {
      console.error(`  Error on ${url}: ${e.message}`);
    }
  }

  // Asian players: full snapshot via timestorm-snapshot
  if (asian.size > 0) {
    const playerList = Array.from(asian.values());
    console.log(`\nSending ${playerList.length} Asian players...`);
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
      console.log(`  ${i + batch.length}/${playerList.length} (${res.data.saved} saved, ${res.data.skipped} skipped)`);
    }
    console.log(`✅ ${totalSaved} Asian players saved for ${date}`);
  }

  // Western players (EU/NA/SA): seed into tracked_players — bdo-api scraper handles the rest
  if (western.size > 0) {
    const playerList = Array.from(western.values()).map(p => ({ familyName: p.familyName, region: p.region }));
    console.log(`\nSeeding ${playerList.length} Western players into scrape queue...`);
    const BATCH = 50;
    let totalAdded = 0;
    for (let i = 0; i < playerList.length; i += BATCH) {
      const batch = playerList.slice(i, i + BATCH);
      const res = await axios.post(
        `${SERVER_URL}/api/global/admin/seed-players`,
        { players: batch },
        { headers: { 'x-admin-token': ADMIN_TOKEN }, timeout: 30000 }
      );
      totalAdded += res.data.added;
      console.log(`  ${i + batch.length}/${playerList.length} (${res.data.added} new, ${res.data.skipped} already tracked)`);
    }
    console.log(`✅ ${totalAdded} new Western players added to scrape queue`);
  }
}

main().catch(e => {
  console.error('Critical error:', e.message);
  process.exit(1);
});
