// Führt die Ergebnisse aller Shards zusammen und sendet sie in einem Request.
// Wer in keinem Shard-Ergebnis steht (auch wenn ein Shard ganz ausgefallen
// ist), gilt als fehlend und wird als Job-Output "failed" weitergegeben.
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const SERVER_URL  = process.env.CLARITY_SERVER_URL || 'https://clarity-guild.live';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const MEMBERS     = JSON.parse(process.env.MEMBERS_JSON || '[]');
const RESULTS_DIR = process.env.RESULTS_DIR || 'results';
const TARGET_DATE = process.env.TARGET_DATE || new Date(Date.now() - 86400000).toISOString().split('T')[0];

async function main() {
  if (!ADMIN_TOKEN) throw new Error('ADMIN_TOKEN nicht gesetzt');

  const files = fs.existsSync(RESULTS_DIR) ? fs.readdirSync(RESULTS_DIR).filter(f => f.endsWith('.json')) : [];
  const byTarget = new Map();
  for (const f of files) {
    const { snapshots } = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, f), 'utf8'));
    for (const s of snapshots) byTarget.set(s.profileTarget, s.row);
  }
  console.log(`${files.length} Shard-Ergebnisse gelesen`);

  const snapshots = [...byTarget.values()];
  const failed = MEMBERS.filter(m => !byTarget.has(m.profileTarget)).map(m => m.familyName);

  fs.appendFileSync(process.env.GITHUB_OUTPUT, `date=${TARGET_DATE}\nfailed=${failed.join(',')}\n`);

  if (snapshots.length === 0) {
    console.error(`Keine Daten gesammelt (${MEMBERS.length} Mitglieder fehlen)`);
    return;
  }

  console.log(`Sende ${snapshots.length}/${MEMBERS.length} Snapshots für ${TARGET_DATE} an Server...`);
  const res = await axios.post(
    `${SERVER_URL}/api/admin/bulk-snapshot`,
    { date: TARGET_DATE, snapshots, failed },
    { headers: { 'x-admin-token': ADMIN_TOKEN }, timeout: 30000 }
  );
  console.log(`✅ ${res.data.saved} Snapshots gespeichert für ${TARGET_DATE}`);
  if (failed.length > 0) console.log(`⚠️ Fehlende Spieler (${failed.length}): ${failed.join(', ')}`);
}

main().catch(e => {
  console.error('Kritischer Fehler:', e.message);
  process.exit(1);
});
