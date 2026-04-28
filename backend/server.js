const express = require('express');
const Database = require('better-sqlite3');
const cron = require('node-cron');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = new Database(process.env.DB_PATH || './clarity.db');
const BDO_API = process.env.BDO_API_URL || 'http://bdo-api:8001';
const GUILD = process.env.GUILD_NAME || 'clarity';
const REGION = process.env.REGION || 'EU';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'changeme';

const LIFESKILLS = [
  'gathering','fishing','hunting','cooking','alchemy',
  'processing','training','trading','farming','sailing','barter'
];

// Numerische Felder (keine specLevel, direkt sortierbar)
const NUMERIC_SKILLS = ['contribution_points', 'energy'];

const RANK_OFFSETS = {
  beginner: 0, apprentice: 10, skilled: 20, professional: 30,
  artisan: 40, master: 50, guru: 80
};

function specLevelToNumber(specLevel) {
  if (!specLevel) return 0;
  const parts = specLevel.toLowerCase().split(' ');
  const rank = parts[0];
  const num = parseInt(parts[1]) || 0;
  return (RANK_OFFSETS[rank] ?? 0) + num;
}

db.exec(`
  CREATE TABLE IF NOT EXISTS snapshots (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    date                TEXT NOT NULL,
    family_name         TEXT NOT NULL,
    life_fame           INTEGER DEFAULT 0,
    contribution_points INTEGER DEFAULT 0,
    energy              INTEGER DEFAULT 0,
    ${LIFESKILLS.map(s => `spec_${s} TEXT DEFAULT ''`).join(',\n    ')},
    UNIQUE(date, family_name)
  )
`);

async function fetchWithRetry(url, params, retries = 8, delay = 8000) {
  for (let i = 0; i < retries; i++) {
    const res = await axios.get(url, { params });
    if (res.data?.status === 'started' || res.data?.status === 'pending') {
      await new Promise(r => setTimeout(r, delay));
      continue;
    }
    return res.data;
  }
  throw new Error(`Kein Ergebnis nach ${retries} Versuchen`);
}

async function fetchAndStore(useYesterday = false) {
  const targetDate = useYesterday
    ? new Date(Date.now() - 86400000).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  console.log(`[${new Date().toISOString()}] Starte Datenabruf für ${targetDate}...`);

  try {
    const guild = await fetchWithRetry(`${BDO_API}/v1/guild`, {
      guildName: GUILD, region: REGION
    });

    const members = guild?.members || [];
    console.log(`Gefundene Mitglieder: ${members.length}`);

    const insert = db.prepare(`
      INSERT OR REPLACE INTO snapshots
        (date, family_name, life_fame, contribution_points, energy, ${LIFESKILLS.map(s => `spec_${s}`).join(', ')})
      VALUES
        (@date, @family_name, @life_fame, @contribution_points, @energy, ${LIFESKILLS.map(s => `@spec_${s}`).join(', ')})
    `);

    const insertMany = db.transaction((rows) => {
      for (const row of rows) insert.run(row);
    });

    const rows = [];
    for (const member of members) {
      try {
        const profile = await fetchWithRetry(`${BDO_API}/v1/adventurer`, {
          profileTarget: member.profileTarget, region: REGION
        });

        const spec = profile.specLevels || {};
        const row = {
          date: targetDate,
          family_name: profile.familyName || member.familyName,
          life_fame: profile.lifeFame || 0,
          contribution_points: profile.contributionPoints || 0,
          energy: profile.energy || 0,
        };
        for (const skill of LIFESKILLS) {
          row[`spec_${skill}`] = spec[skill] || '';
        }
        rows.push(row);
        console.log(`✓ ${row.family_name}`);
      } catch (e) {
        console.error(`✗ Fehler bei ${member.familyName}: ${e.message}`);
      }
    }

    insertMany(rows);
    console.log(`[${new Date().toISOString()}] ${rows.length} Spieler gespeichert für ${targetDate}.`);
  } catch (e) {
    console.error('Fehler beim Datenabruf:', e.message);
  }
}

cron.schedule('0 2 * * *', () => fetchAndStore(true));
fetchAndStore(false);

function calcGain(current, past) {
  if (past == null || past === '') return null;
  return specLevelToNumber(current) - specLevelToNumber(past);
}

app.get('/api/leaderboard/:skill', (req, res) => {
  const skill = req.params.skill;
  const validColumns = ['life_fame', ...NUMERIC_SKILLS, ...LIFESKILLS];
  if (!validColumns.includes(skill)) {
    return res.status(400).json({ error: 'Unbekannter Skill' });
  }

  const latestRow = db.prepare('SELECT MAX(date) as date FROM snapshots').get();
  const latestDate = latestRow?.date || null;
  if (!latestDate) return res.json([]);

  const sevenDaysAgo = new Date(new Date(latestDate).getTime() - 7 * 86400000).toISOString().split('T')[0];
  const monthStart = latestDate.substring(0, 7) + '-01';

  const best7d = db.prepare(`
    SELECT date FROM snapshots WHERE date <= ? AND date < ?
    GROUP BY date ORDER BY date DESC LIMIT 1
  `).get(sevenDaysAgo, latestDate) ||
  db.prepare(`
    SELECT date FROM snapshots WHERE date < ?
    GROUP BY date ORDER BY date ASC LIMIT 1
  `).get(latestDate);

  const bestMonth = db.prepare(`
    SELECT date FROM snapshots WHERE date <= ? AND date < ?
    GROUP BY date ORDER BY date DESC LIMIT 1
  `).get(monthStart, latestDate) ||
  db.prepare(`
    SELECT date FROM snapshots WHERE date < ?
    GROUP BY date ORDER BY date ASC LIMIT 1
  `).get(latestDate);

  const date7d = best7d?.date || null;
  const dateMonth = bestMonth?.date || null;

  // Numerische Felder: life_fame, contribution_points, energy
  if (skill === 'life_fame' || NUMERIC_SKILLS.includes(skill)) {
    const rows = db.prepare(`
      SELECT
        t.family_name,
        t.${skill}   AS current_value,
        w.${skill}   AS value_7d_ago,
        m.${skill}   AS value_month_ago
      FROM snapshots t
      LEFT JOIN snapshots w ON w.family_name = t.family_name AND w.date = ?
      LEFT JOIN snapshots m ON m.family_name = t.family_name AND m.date = ?
      WHERE t.date = ?
      ORDER BY t.${skill} DESC
    `).all(date7d, dateMonth, latestDate);

    return res.json(rows.map((row, i) => ({
      rank: i + 1,
      name: row.family_name,
      display: String(row.current_value),
      gain_7d: row.value_7d_ago != null ? row.current_value - row.value_7d_ago : null,
      gain_month: row.value_month_ago != null ? row.current_value - row.value_month_ago : null,
    })));
  }

  // Lifeskills: specLevel strings
  const rows = db.prepare(`
    SELECT
      t.family_name,
      t.spec_${skill}  AS current_spec,
      w.spec_${skill}  AS spec_7d_ago,
      m.spec_${skill}  AS spec_month_ago
    FROM snapshots t
    LEFT JOIN snapshots w ON w.family_name = t.family_name AND w.date = ?
    LEFT JOIN snapshots m ON m.family_name = t.family_name AND m.date = ?
    WHERE t.date = ?
  `).all(date7d, dateMonth, latestDate);

  const result = rows
    .map((row) => ({
      name: row.family_name,
      display: row.current_spec || '–',
      numeric: specLevelToNumber(row.current_spec),
      gain_7d: calcGain(row.current_spec, row.spec_7d_ago),
      gain_month: calcGain(row.current_spec, row.spec_month_ago),
    }))
    .sort((a, b) => b.numeric - a.numeric)
    .map((row, i) => ({ rank: i + 1, ...row }));

  res.json(result);
});

app.get('/api/lastupdate', (req, res) => {
  const row = db.prepare('SELECT MAX(date) as last FROM snapshots').get();
  res.json({ last: row?.last || null });
});

app.post('/api/admin/fetch', async (req, res) => {
  const token = req.headers['x-admin-token'];
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const useYesterday = req.query.yesterday === 'true';
  const targetDate = useYesterday
    ? new Date(Date.now() - 86400000).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  res.json({ message: `Scrape gestartet für ${targetDate}` });
  fetchAndStore(useYesterday);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(3001, () => console.log('Server läuft auf Port 3001'));
