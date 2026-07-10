const axios = require('axios');

const BDO_API      = process.env.BDO_API_URL        || 'http://localhost:8001';
const SERVER_URL   = process.env.CLARITY_SERVER_URL  || 'https://clarity-guild.live';
const ADMIN_TOKEN  = process.env.ADMIN_TOKEN;
const TARGET_DATE  = process.env.TARGET_DATE         || null;
const PLAYER_LIMIT = process.env.PLAYER_LIMIT && parseInt(process.env.PLAYER_LIMIT) > 0
  ? parseInt(process.env.PLAYER_LIMIT)
  : null;

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
  throw new Error(`No result after ${retries} attempts`);
}

async function resolveProfileTarget(familyName, region) {
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const searchData = await fetchWithRetry(`${BDO_API}/v1/adventurer/search`, {
        query: familyName, region
      });

      const results = Array.isArray(searchData)
        ? searchData
        : (searchData?.results || searchData?.searchResults || []);

      if (!results.length) throw new Error('No search results');

      const exact = results.find(r =>
        (r.familyName || r.name || '').toLowerCase() === familyName.toLowerCase()
      );
      const match = exact || results[0];

      const pt = match?.profileTarget || match?.profile_target;
      if (!pt) throw new Error('No profileTarget in search result');
      return pt;
    } catch (e) {
      if (e.response?.status === 429 && attempt < MAX_RETRIES) {
        const wait = 30000 * (attempt + 1);
        console.log(`  429 rate limit on search, waiting ${wait / 1000}s...`);
        await sleep(wait);
      } else {
        throw e;
      }
    }
  }
}

async function main() {
  if (!ADMIN_TOKEN) throw new Error('ADMIN_TOKEN not set');

  const date = TARGET_DATE || new Date(Date.now() - 86400000).toISOString().split('T')[0];
  console.log(`Global scrape for ${date}`);
  console.log('Waiting 8s for bdo-api...');
  await sleep(8000);

  const pendingUrl = PLAYER_LIMIT
    ? `${SERVER_URL}/api/global/admin/pending?limit=${PLAYER_LIMIT}`
    : `${SERVER_URL}/api/global/admin/pending`;
  const { data: { players } } = await axios.get(
    pendingUrl,
    { headers: { 'x-admin-token': ADMIN_TOKEN }, timeout: 30000 }
  );
  if (PLAYER_LIMIT) console.log(`(limit: ${PLAYER_LIMIT} players per run)`);
  console.log(`${players.length} players pending`);

  if (players.length === 0) {
    console.log('Pool empty or all players already scraped today.');
    return;
  }

  const snapshots    = [];
  const failed       = [];  // profile_targets: transient failures (retried next run)
  const unresolvable = [];  // {familyName, region}: permanent 400 from search → deactivate

  for (const player of players) {
    let profileTarget = player.profile_target;

    // Step 1: Resolve profileTarget if not yet known
    if (!profileTarget) {
      if (!player.family_name) {
        console.error(`✗ No name and no profileTarget for entry — skipping`);
        continue;
      }
      try {
        profileTarget = await resolveProfileTarget(player.family_name, player.region);
        console.log(`  → [${player.region}] ${player.family_name} resolved`);
        await axios.post(
          `${SERVER_URL}/api/global/admin/resolve`,
          { familyName: player.family_name, region: player.region, profileTarget },
          { headers: { 'x-admin-token': ADMIN_TOKEN }, timeout: 10000 }
        );
        await sleep(3000);
      } catch (e) {
        if (e.response?.status === 400) {
          // Permanent: search endpoint doesn't support this region/character set
          console.error(`✗ [${player.region}] ${player.family_name} (resolve, permanent): ${e.message}`);
          unresolvable.push({ familyName: player.family_name, region: player.region });
        } else {
          // Transient (timeout, network, etc.)
          console.error(`✗ [${player.region}] ${player.family_name} (resolve): ${e.message}`);
        }
        continue;
      }
    }

    // Step 2: Fetch profile (with 429 backoff)
    const MAX_PROFILE_RETRIES = 3;
    for (let attempt = 0; attempt <= MAX_PROFILE_RETRIES; attempt++) {
      try {
        const profile = await fetchWithRetry(`${BDO_API}/v1/adventurer`, {
          profileTarget, region: player.region
        });

        const spec = profile.specLevels || {};
        const snap = {
          profile_target:       profileTarget,
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
        break;
      } catch (e) {
        if (e.response?.status === 429 && attempt < MAX_PROFILE_RETRIES) {
          const wait = 60000 * (attempt + 1);
          console.log(`  429 on profile fetch, waiting ${wait / 1000}s...`);
          await sleep(wait);
        } else {
          console.error(`✗ [${player.region}] ${profileTarget}: ${e.message}`);
          failed.push(profileTarget);
          break;
        }
      }
    }
  }

  if (snapshots.length === 0) {
    console.log(`⚠️  0/${players.length} collected — all players failed (will retry tomorrow)`);
    if (unresolvable.length > 0) {
      await axios.post(
        `${SERVER_URL}/api/global/admin/bulk-snapshot`,
        { date, snapshots: [], failed, unresolvable },
        { headers: { 'x-admin-token': ADMIN_TOKEN }, timeout: 30000 }
      ).catch(e => console.error('  deactivate call failed:', e.message));
    }
    return;
  }

  console.log(`\nSending ${snapshots.length}/${players.length} snapshots in batches...`);
  const BATCH = 50;
  let totalSaved = 0;
  let totalFailed = 0;
  let totalDeactivated = 0;

  for (let i = 0; i < snapshots.length; i += BATCH) {
    const batch = snapshots.slice(i, i + BATCH);
    const isLast = i + BATCH >= snapshots.length;
    const res = await axios.post(
      `${SERVER_URL}/api/global/admin/bulk-snapshot`,
      {
        date,
        snapshots: batch,
        failed:       isLast ? failed       : [],
        unresolvable: isLast ? unresolvable : [],
      },
      { headers: { 'x-admin-token': ADMIN_TOKEN }, timeout: 60000 }
    );
    totalSaved       += res.data.saved       || 0;
    totalFailed      += res.data.failed      || 0;
    totalDeactivated += res.data.deactivated || 0;
    console.log(`  Batch ${Math.floor(i / BATCH) + 1}: ${res.data.saved} saved`);
  }

  console.log(`✅ ${totalSaved} saved, ${totalFailed} failed, ${totalDeactivated} deactivated for ${date}`);

  if (failed.length > 0) {
    console.log(`${failed.length} players failed — will be retried in the next run.`);
  }
}

main().catch(e => {
  console.error('Critical error:', e.message);
  process.exit(1);
});
