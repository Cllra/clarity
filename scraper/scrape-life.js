const axios = require('axios');

const BDO_API       = process.env.BDO_API_URL        || 'http://localhost:8001';
const GUILD         = 'life';
const REGION        = process.env.REGION              || 'EU';
const SERVER_URL    = process.env.SECRET_SERVER_URL   || process.env.CLARITY_SERVER_URL || 'https://clarity-guild.live';
const ADMIN_TOKEN   = process.env.ADMIN_TOKEN;
const TARGET_DATE   = process.env.TARGET_DATE         || null;

const LIFESKILLS = [
  'gathering','fishing','hunting','cooking','alchemy',
  'processing','training','trading','farming','sailing','barter'
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchWithRetry(url, params, retries = 12, delay = 8000) {
  for (let i = 0; i < retries; i++) {
    const res = await axios.get(url, { params, timeout: 30000 });
    if (res.data?.status === 'started' || res.data?.status === 'pending') {
      console.log(`  polling ${i + 1}/${retries}...`);
      await sleep(delay);
      continue;
    }
    return res.data;
  }
  throw new Error(`No result after ${retries} attempts`);
}

async function scrape(targetDate) {
  console.log(`\nScraping Life guild for ${targetDate}`);

  const guild = await fetchWithRetry(`${BDO_API}/v1/guild`, { guildName: GUILD, region: REGION });
  const members = guild?.members || [];
  if (members.length === 0) throw new Error('No guild members found');
  console.log(`${members.length} members`);

  const snapshots = [];
  const failed = [];

  for (const member of members) {
    try {
      const profile = await fetchWithRetry(`${BDO_API}/v1/adventurer`, {
        profileTarget: member.profileTarget, region: REGION
      });

      const spec = profile.specLevels || {};
      const row = {
        family_name:          profile.familyName || member.familyName,
        life_fame:            profile.lifeFame || 0,
        contribution_points:  profile.contributionPoints || 0,
        energy:               profile.energy || 0,
      };
      for (const skill of LIFESKILLS) row[`spec_${skill}`] = spec[skill] || '';

      snapshots.push(row);
      console.log(`✓ ${row.family_name}`);
      await sleep(5000);
    } catch (e) {
      console.error(`✗ ${member.familyName}: ${e.message}`);
      failed.push(member.familyName);
    }
  }

  return { snapshots, failed, total: members.length };
}

async function main() {
  if (!ADMIN_TOKEN) throw new Error('ADMIN_TOKEN not set');

  const targetDate = TARGET_DATE || new Date(Date.now() - 86400000).toISOString().split('T')[0];

  console.log('Waiting 8s for bdo-api...');
  await sleep(8000);

  const MAX_ATTEMPTS = 3;
  let lastResult = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`\n--- Attempt ${attempt}/${MAX_ATTEMPTS} ---`);
    try {
      lastResult = await scrape(targetDate);
      if (lastResult.failed.length === 0) break;
      console.log(`⚠️ ${lastResult.failed.length} failed: ${lastResult.failed.join(', ')}`);
      if (attempt < MAX_ATTEMPTS) { console.log('Waiting 3 min...'); await sleep(3 * 60 * 1000); }
    } catch (e) {
      console.error(`Error in attempt ${attempt}: ${e.message}`);
      if (attempt < MAX_ATTEMPTS) { console.log('Waiting 3 min...'); await sleep(3 * 60 * 1000); }
      else throw e;
    }
  }

  const { snapshots, failed, total } = lastResult;
  if (snapshots.length === 0) throw new Error('No data collected');

  console.log(`\nSending ${snapshots.length}/${total} snapshots to secret service...`);
  const res = await axios.post(
    `${SERVER_URL}/api/admin/life-snapshot`,
    { date: targetDate, snapshots },
    { headers: { 'x-admin-token': ADMIN_TOKEN }, timeout: 30000 }
  );
  console.log(`✅ ${res.data.saved} snapshots saved for ${targetDate}`);

  if (failed.length > 0) {
    console.log(`⚠️ Failed players (${failed.length}): ${failed.join(', ')}`);
    process.exit(1);
  }
}

main().catch(e => {
  console.error('Critical error:', e.message);
  process.exit(1);
});
