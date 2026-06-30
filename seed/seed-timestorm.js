/**
 * Einmaliger Seed-Import von timestorm.de
 *
 * Nutzung (im /seed Verzeichnis):
 *   npm install axios
 *   ADMIN_TOKEN=... CLARITY_SERVER_URL=https://clarity-guild.live node seed-timestorm.js
 *
 * !! Nur einmalig zum Bootstrappen – nicht automatisieren !!
 * !! Vorher timestorm.de-Betreiber kontaktieren             !!
 *
 * Was es tut:
 *   - Ruft timestorm.de Life-Fame- und Lifeskill-Ranglisten ab
 *   - Extrahiert profile_target-Hashes aus den Seiten-URLs (?mode=<REGION><hash>)
 *   - Fügt alle neuen Spieler per POST /api/global/player/add zum Pool hinzu
 *
 * Vor Ausführung: SEED_PAGES unten mit den echten timestorm.de-URLs befüllen.
 * Die URL-Struktur auf timestorm.de prüfen – Hashes stehen in hrefs als ?mode=<REGION><hash>.
 */

const axios = require('axios');

const SERVER_URL  = process.env.CLARITY_SERVER_URL || 'https://clarity-guild.live';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

// ── Anpassen: echte timestorm.de-URLs eintragen ──────────────────────────────
const SEED_PAGES = [
  { url: 'https://www.timestorm.de/', label: 'Life Fame EU', region: 'EU' },
  // { url: 'https://www.timestorm.de/lifeskills?skill=cooking', label: 'Cooking EU', region: 'EU' },
  // weitere Seiten hier...
];
// ─────────────────────────────────────────────────────────────────────────────

// Extrahiert { profileTarget, region } aus HTML
// Passe den Regex an die tatsächliche timestorm.de URL-Struktur an
function extractTargets(html, fallbackRegion) {
  const results = [];
  const seen = new Set();
  // Beispiel-Pattern: ?mode=EU1a2b3c4d...  oder  ?mode=eu1a2b3c4d
  const regex = /[?&]mode=([A-Za-z]{2,4})([A-Za-z0-9_\-]{10,})/g;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const region = m[1].toUpperCase();
    const hash   = m[2];
    const key    = `${region}:${hash}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({ profileTarget: hash, region: region || fallbackRegion });
    }
  }
  return results;
}

async function main() {
  if (!ADMIN_TOKEN) throw new Error('ADMIN_TOKEN nicht gesetzt');
  if (SEED_PAGES.every(p => p.url.includes('timestorm.de/'))) {
    console.warn('⚠ Hinweis: Echte timestorm.de-URLs noch nicht eingetragen. SEED_PAGES anpassen.');
  }

  const allTargets = new Map(); // profileTarget → region
  let added = 0;

  for (const { url, label, region } of SEED_PAGES) {
    console.log(`Lade ${label} von ${url}...`);
    try {
      const res = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; clarity-seed/1.0; +https://clarity-guild.live)' },
        timeout: 30000
      });
      const targets = extractTargets(res.data, region);
      console.log(`  ${targets.length} Profile-Hashes gefunden`);
      for (const t of targets) allTargets.set(t.profileTarget, t.region);
    } catch (e) {
      console.error(`  Fehler beim Laden von ${url}: ${e.message}`);
    }
  }

  console.log(`\nInsgesamt ${allTargets.size} einzigartige Profile — füge zum Pool hinzu...`);

  for (const [profileTarget, region] of allTargets) {
    try {
      const res = await axios.post(
        `${SERVER_URL}/api/global/player/add`,
        { profileTarget, region, source: 'seed' },
        { headers: { 'x-admin-token': ADMIN_TOKEN }, timeout: 10000 }
      );
      if (res.data.added) {
        added++;
        process.stdout.write(`+`);
      } else {
        process.stdout.write(`.`);
      }
    } catch (e) {
      process.stdout.write(`!`);
    }
  }

  console.log(`\n\n✅ Seed abgeschlossen: ${added} neue Spieler hinzugefügt`);
}

main().catch(e => {
  console.error('Fehler:', e.message);
  process.exit(1);
});
