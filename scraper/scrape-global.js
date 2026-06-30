const axios = require('axios');

const BDO_API     = process.env.BDO_API_URL        || 'http://localhost:8001';
const SERVER_URL  = process.env.CLARITY_SERVER_URL  || 'https://clarity-guild.live';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const TARGET_DATE = process.env.TARGET_DATE         || null;

const LIFESKILLS = [
  'gathering','fishing','hunting','cooking','alchemy',
  'processing','training','trading','farming','sailing','barter'
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchWithRetry(url, params, retries = 10, delay = 8000) {
  for (let i = 0; i < retries; i++) {
    const res = await axios.get(url, { params, timeout: 30000 });
    if (res.data?.status === 'started' || res.data?.status === 'pending') {
      console.log(`  polling ${i + 1}/${retries}...`);
      await sleep(delay);
      continue;
    }
    return res.data;
  }
  throw new Error(`Kein Ergebnis nach ${retries} Versuchen`);
}

async function main() {
  if (!ADMIN_TOKEN) throw new Error('ADMIN_TOKEN nicht gesetzt');

  const date = TARGET_DATE || new Date(Date.now() - 86400000).toISOString().split('T')[0];
  console.log(`Global Scrape für ${date}`);
  console.log('Warte 8s auf bdo-api...');
  await sleep(8000);

  const { data: { players } } = await axios.get(
    `${SERVER_URL}/api/global/admin/pending`,
    { headers: { 'x-admin-token': ADMIN_TOKEN }, timeout: 30000 }
  );
  console.log(`${players.length} Spieler ausstehend`);

  if (players.length === 0) {
    console.log('Pool leer oder alle heute bereits gescrapt.');
    return;
  }

  const snapshots = [];
  const failed    = [];

  for (const player of players) {
    try {
      const profile = await fetchWithRetry(`${BDO_API}/v1/adventurer`, {
        profileTarget: player.profile_target,
        region: player.region
      });

      const spec = profile.specLevels || {};
      const snap = {
        profile_target:       player.profile_target,
        family_name:          profile.familyName || player.family_name || '',
        region:               player.region,
        life_fame:            profile.lifeFame || 0,
        contribution_points:  profile.contributionPoints || 0,
        energy:               profile.energy || 0,
      };
      for (const s of LIFESKILLS) snap[`spec_${s}`] = spec[s] || '';

      snapshots.push(snap);
      console.log(`✓ [${player.region}] ${snap.family_name}`);
      await sleep(5000);
    } catch (e) {
      console.error(`✗ [${player.region}] ${player.profile_target}: ${e.message}`);
      failed.push(player.profile_target);
    }
  }

  if (snapshots.length === 0) {
    throw new Error('Keine Daten gesammelt — alle Spieler fehlgeschlagen');
  }

  console.log(`\nSende ${snapshots.length}/${players.length} Snapshots...`);
  const res = await axios.post(
    `${SERVER_URL}/api/global/admin/bulk-snapshot`,
    { date, snapshots, failed },
    { headers: { 'x-admin-token': ADMIN_TOKEN }, timeout: 60000 }
  );
  console.log(`✅ ${res.data.saved} gespeichert, ${res.data.failed} fehlgeschlagen für ${date}`);

  if (failed.length > 0) {
    console.log(`Fehlgeschlagen: ${failed.join(', ')}`);
    process.exit(1);
  }
}

main().catch(e => {
  console.error('Kritischer Fehler:', e.message);
  process.exit(1);
});
