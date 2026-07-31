// ONE-TIME USE: bypasses /v1/guild by pulling member list from our own backend.
// Delete this file after use. scrape.js and daily-scrape.yml are unchanged.

const axios = require('axios');

const BDO_API     = process.env.BDO_API_URL        || 'http://localhost:8001';
const REGION      = process.env.REGION             || 'EU';
const SERVER_URL  = process.env.CLARITY_SERVER_URL || 'https://clarity-guild.live';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const TARGET_DATE = process.env.TARGET_DATE        || null;

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

async function main() {
  if (!ADMIN_TOKEN) throw new Error('ADMIN_TOKEN not set');
  const targetDate = TARGET_DATE || new Date(Date.now() - 86400000).toISOString().split('T')[0];
  console.log(`Target date: ${targetDate}`);

  console.log('Waiting 8s for bdo-api...');
  await sleep(8000);

  // Step 1: get family names from our own leaderboard (skips /v1/guild entirely)
  console.log('\nFetching member list from backend DB...');
  const lbRes = await axios.get(`${SERVER_URL}/api/leaderboard/life_fame`, {
    headers: { 'x-admin-token': ADMIN_TOKEN }
  });
  const familyNames = lbRes.data.map(p => p.name);
  console.log(`${familyNames.length} members found`);

  // Step 2: resolve profileTarget for each member from the global pool
  console.log('\nResolving profile targets from global pool...');
  const members = [];
  for (const name of familyNames) {
    try {
      const r = await axios.get(`${SERVER_URL}/api/global/player/check`, {
        params: { name, region: REGION }
      });
      members.push({ familyName: name, profileTarget: r.data.profile_target || null });
    } catch {
      members.push({ familyName: name, profileTarget: null });
    }
  }
  const withPT = members.filter(m => m.profileTarget).length;
  console.log(`${withPT}/${members.length} members have a profileTarget`);

  // Step 3: fetch individual profiles via bdo-api
  console.log('\nScraping profiles...');
  const snapshots = [];
  const failed = [];

  for (const member of members) {
    if (!member.profileTarget) {
      console.log(`⚠ ${member.familyName}: no profileTarget — skipped`);
      failed.push(member.familyName);
      continue;
    }
    try {
      const profile = await fetchWithRetry(`${BDO_API}/v1/adventurer`, {
        profileTarget: member.profileTarget, region: REGION
      });
      const spec = profile.specLevels || {};
      const row = {
        family_name:         profile.familyName || member.familyName,
        life_fame:           profile.lifeFame || 0,
        contribution_points: profile.contributionPoints || 0,
        energy:              profile.energy || 0,
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

  if (snapshots.length === 0) throw new Error('No data collected');

  // Step 4: submit
  console.log(`\nSending ${snapshots.length}/${members.length} snapshots for ${targetDate}...`);
  const res = await axios.post(
    `${SERVER_URL}/api/admin/bulk-snapshot`,
    { date: targetDate, snapshots, failed },
    { headers: { 'x-admin-token': ADMIN_TOKEN }, timeout: 30000 }
  );
  console.log(`✅ ${res.data.saved} snapshots saved for ${targetDate}`);

  if (failed.length > 0)
    console.log(`⚠️  Failed (${failed.length}): ${failed.join(', ')}`);
}

main().catch(e => {
  console.error('Critical error:', e.message);
  process.exit(1);
});
