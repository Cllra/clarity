const axios = require('axios');

const BDO_API    = process.env.BDO_API_URL        || 'http://localhost:8001';
const GUILD      = process.env.GUILD_NAME          || 'clarity';
const REGION     = process.env.REGION              || 'EU';
const SERVER_URL = process.env.CLARITY_SERVER_URL  || 'https://clarity-guild.live';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const TARGET_DATE = process.env.TARGET_DATE        || null;
// Nach dieser Laufzeit aufhören und senden, was da ist — ein vom Workflow-Timeout
// abgebrochener Lauf verliert sonst alle bis dahin gesammelten Snapshots.
const MAX_RUNTIME_MS = (parseInt(process.env.MAX_RUNTIME_MIN) || 35) * 60000;

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
  throw new Error(`Kein Ergebnis nach ${retries} Versuchen`);
}

async function fetchMembers() {
  const guild = await fetchWithRetry(`${BDO_API}/v1/guild`, { guildName: GUILD, region: REGION });
  const members = guild?.members || [];
  if (members.length === 0) throw new Error('Keine Guild-Mitglieder gefunden');
  console.log(`${members.length} Mitglieder`);

  // Clarity-Mitglieder in globalen Pool einspeisen (silent, kein Fehler wenn schon drin)
  for (const member of members) {
    if (!member.profileTarget) continue;
    axios.post(`${SERVER_URL}/api/global/player/add`,
      { profileTarget: member.profileTarget, region: REGION, source: 'clarity' },
      { headers: { 'x-admin-token': ADMIN_TOKEN }, timeout: 5000 }
    ).catch(() => {});
  }

  return members;
}

// Holt die Profile der übergebenen Mitglieder. Was bis zur Deadline nicht
// drankommt, landet in failed und wird beim nächsten Versuch/Lauf geholt.
async function scrape(members, deadline) {
  const snapshots = [];
  const failed = [];

  for (const member of members) {
    if (Date.now() > deadline) {
      failed.push(member);
      continue;
    }
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
      failed.push(member);
    }
  }

  return { snapshots, failed };
}

async function main() {
  if (!ADMIN_TOKEN) throw new Error('ADMIN_TOKEN nicht gesetzt');

  const targetDate = TARGET_DATE || new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // Warte kurz, damit bdo-api vollständig gestartet ist
  console.log('Warte 8s auf bdo-api...');
  await sleep(8000);

  const deadline = Date.now() + MAX_RUNTIME_MS;
  console.log(`\nStarte Scrape für ${targetDate}`);
  let members;
  for (let attempt = 1; !members; attempt++) {
    try {
      members = await fetchMembers();
    } catch (e) {
      console.error(`Mitgliederliste, Versuch ${attempt}/3: ${e.message}`);
      if (attempt >= 3 || Date.now() + 3 * 60 * 1000 > deadline) throw e;
      console.log('Warte 3 Minuten...');
      await sleep(3 * 60 * 1000);
    }
  }

  // Weitere Versuche holen nur die fehlgeschlagenen Mitglieder nach — alle
  // erneut abzufragen verdoppelt die Requests und provoziert 429er.
  const MAX_ATTEMPTS = 3;
  const snapshots = [];
  let pending = members;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS && pending.length > 0; attempt++) {
    if (Date.now() > deadline) break;
    console.log(`\n--- Versuch ${attempt}/${MAX_ATTEMPTS}: ${pending.length} Mitglieder ---`);
    const result = await scrape(pending, deadline);
    snapshots.push(...result.snapshots);
    pending = result.failed;

    if (pending.length > 0 && attempt < MAX_ATTEMPTS) {
      console.log(`⚠️ ${pending.length} fehlgeschlagen: ${pending.map(m => m.familyName).join(', ')}`);
      if (Date.now() + 3 * 60 * 1000 > deadline) break;
      console.log('Warte 3 Minuten...');
      await sleep(3 * 60 * 1000);
    }
  }
  if (Date.now() > deadline) console.log(`⏱  Laufzeit-Budget von ${MAX_RUNTIME_MS / 60000} min erreicht — sende, was da ist.`);

  const failed = pending.map(m => m.familyName);
  const total = members.length;
  if (snapshots.length === 0) throw new Error('Keine Daten gesammelt');

  console.log(`\nSende ${snapshots.length}/${total} Snapshots an Server...`);
  const res = await axios.post(
    `${SERVER_URL}/api/admin/bulk-snapshot`,
    { date: targetDate, snapshots, failed },
    { headers: { 'x-admin-token': ADMIN_TOKEN }, timeout: 30000 }
  );
  console.log(`✅ ${res.data.saved} Snapshots gespeichert für ${targetDate}`);

  if (failed.length > 0) {
    console.log(`⚠️ Fehlende Spieler (${failed.length}): ${failed.join(', ')}`);
    process.exit(1);
  }
}

main().catch(e => {
  console.error('Kritischer Fehler:', e.message);
  process.exit(1);
});
