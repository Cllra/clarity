// Holt die Profile eines Shards der Mitgliederliste und schreibt sie nach
// OUT_FILE. Jeder Shard läuft auf einem eigenen Runner (eigene IP), weil BDO
// eine IP nach ~50 Profilen drosselt. Gesendet wird gesammelt in send-snapshots.js.
const fs = require('fs');
const { BDO_API, REGION, sleep, BlockedError, fetchWithRetry } = require('./bdo');

const MEMBERS     = JSON.parse(process.env.MEMBERS_JSON || '[]');
const SHARD_INDEX = parseInt(process.env.SHARD_INDEX) || 0;
const SHARD_COUNT = parseInt(process.env.SHARD_COUNT) || 1;
const OUT_FILE    = process.env.OUT_FILE || 'result.json';
// Nach dieser Laufzeit aufhören und schreiben, was da ist — ein vom Workflow-Timeout
// abgebrochener Lauf verliert sonst alle bis dahin gesammelten Snapshots.
const MAX_RUNTIME_MS = (parseInt(process.env.MAX_RUNTIME_MIN) || 35) * 60000;
// Löst so oft hintereinander kein Profil auf, ist der Runner gedrosselt.
const MAX_CONSECUTIVE_FAILS = 2;

const LIFESKILLS = [
  'gathering','fishing','hunting','cooking','alchemy',
  'processing','training','trading','farming','sailing','barter'
];

// Holt die Profile der übergebenen Mitglieder. Was bis zur Deadline nicht
// drankommt oder nach einer Drosselung übrig bleibt, landet in failed.
async function scrape(members, deadline) {
  const snapshots = [];
  const failed = [];
  let blocked = false;
  let consecutiveFails = 0;

  for (const member of members) {
    if (blocked || Date.now() > deadline) {
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

      snapshots.push({ profileTarget: member.profileTarget, row });
      consecutiveFails = 0;
      console.log(`✓ ${row.family_name}`);
      await sleep(5000);
    } catch (e) {
      console.error(`✗ ${member.familyName}: ${e.message}`);
      failed.push(member);
      if (e instanceof BlockedError || ++consecutiveFails >= MAX_CONSECUTIVE_FAILS) {
        console.log('🛑 Runner gedrosselt — Rest wird im Nachhol-Lauf geholt.');
        blocked = true;
      }
    }
  }

  return { snapshots, failed, blocked };
}

async function main() {
  const members = MEMBERS.filter((_, i) => i % SHARD_COUNT === SHARD_INDEX);
  const deadline = Date.now() + MAX_RUNTIME_MS;
  console.log(`Shard ${SHARD_INDEX + 1}/${SHARD_COUNT}: ${members.length} Mitglieder`);

  // Warte kurz, damit bdo-api vollständig gestartet ist
  console.log('Warte 8s auf bdo-api...');
  await sleep(8000);

  // Weitere Versuche holen nur die fehlgeschlagenen Mitglieder nach, und nur
  // solange der Runner nicht gedrosselt ist — sonst schlagen sie sicher fehl.
  const MAX_ATTEMPTS = 3;
  const snapshots = [];
  let pending = members;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS && pending.length > 0; attempt++) {
    if (Date.now() > deadline) break;
    console.log(`\n--- Versuch ${attempt}/${MAX_ATTEMPTS}: ${pending.length} Mitglieder ---`);
    const result = await scrape(pending, deadline);
    snapshots.push(...result.snapshots);
    pending = result.failed;
    if (result.blocked) break;

    if (pending.length > 0 && attempt < MAX_ATTEMPTS) {
      console.log(`⚠️ ${pending.length} fehlgeschlagen: ${pending.map(m => m.familyName).join(', ')}`);
      if (Date.now() + 60 * 1000 > deadline) break;
      console.log('Warte 1 Minute...');
      await sleep(60 * 1000);
    }
  }
  if (Date.now() > deadline) console.log(`⏱  Laufzeit-Budget von ${MAX_RUNTIME_MS / 60000} min erreicht.`);

  fs.writeFileSync(OUT_FILE, JSON.stringify({ snapshots }));
  console.log(`\n${snapshots.length}/${members.length} Profile geholt`);
  if (pending.length > 0) console.log(`⚠️ Fehlend (${pending.length}): ${pending.map(m => m.familyName).join(', ')}`);
}

main().catch(e => {
  console.error('Kritischer Fehler:', e.message);
  process.exit(1);
});
