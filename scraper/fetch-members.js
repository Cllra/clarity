// Holt die Mitgliederliste und gibt sie als Job-Output "members" (JSON) aus.
// ONLY_MEMBERS (kommagetrennte Family Names) beschränkt die Liste — so holt
// ein Nachhol-Lauf nur die Spieler, die im ersten Lauf gefehlt haben.
const fs = require('fs');
const axios = require('axios');
const { BDO_API, REGION, sleep, fetchWithRetry } = require('./bdo');

const GUILD       = process.env.GUILD_NAME         || 'clarity';
const SERVER_URL  = process.env.CLARITY_SERVER_URL || 'https://clarity-guild.live';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const ONLY = (process.env.ONLY_MEMBERS || '').split(',').map(s => s.trim()).filter(Boolean);

async function fetchMembers() {
  const guild = await fetchWithRetry(`${BDO_API}/v1/guild`, { guildName: GUILD, region: REGION });
  const members = guild?.members || [];
  if (members.length === 0) throw new Error('Keine Guild-Mitglieder gefunden');
  return members;
}

async function main() {
  if (!ADMIN_TOKEN) throw new Error('ADMIN_TOKEN nicht gesetzt');

  // Warte kurz, damit bdo-api vollständig gestartet ist
  console.log('Warte 8s auf bdo-api...');
  await sleep(8000);

  let members;
  for (let attempt = 1; !members; attempt++) {
    try {
      members = await fetchMembers();
    } catch (e) {
      console.error(`Mitgliederliste, Versuch ${attempt}/3: ${e.message}`);
      if (attempt >= 3) throw e;
      console.log('Warte 3 Minuten...');
      await sleep(3 * 60 * 1000);
    }
  }
  console.log(`${members.length} Mitglieder`);

  if (ONLY.length > 0) {
    members = members.filter(m => ONLY.includes(m.familyName));
    console.log(`Nachhol-Lauf: ${members.length}/${ONLY.length} angefragte Mitglieder gefunden`);
  } else {
    // Clarity-Mitglieder in globalen Pool einspeisen (kein Fehler wenn schon drin)
    await Promise.all(members.filter(m => m.profileTarget).map(m =>
      axios.post(`${SERVER_URL}/api/global/player/add`,
        { profileTarget: m.profileTarget, region: REGION, source: 'clarity' },
        { headers: { 'x-admin-token': ADMIN_TOKEN }, timeout: 5000 }
      ).catch(() => {})
    ));
  }

  const list = members
    .filter(m => m.profileTarget)
    .map(m => ({ familyName: m.familyName, profileTarget: m.profileTarget }));
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `members=${JSON.stringify(list)}\n`);
}

main().catch(e => {
  console.error('Kritischer Fehler:', e.message);
  process.exit(1);
});
