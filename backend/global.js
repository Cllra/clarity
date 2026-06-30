const { Router } = require('express');
const axios = require('axios');

const LIFESKILLS = [
  'gathering','fishing','hunting','cooking','alchemy',
  'processing','training','trading','farming','sailing','barter'
];

const RANK_OFFSETS = {
  beginner: 0, apprentice: 10, skilled: 20, professional: 30,
  artisan: 40, master: 50, guru: 80
};

function specLevelToNumber(s) {
  if (!s) return 0;
  const parts = s.toLowerCase().split(' ');
  return (RANK_OFFSETS[parts[0]] ?? 0) + (parseInt(parts[1]) || 0);
}

function snapshotChanged(prev, curr) {
  if (!prev) return true;
  if (prev.life_fame !== curr.life_fame) return true;
  if (prev.contribution_points !== curr.contribution_points) return true;
  if (prev.energy !== curr.energy) return true;
  for (const s of LIFESKILLS) {
    if (prev[`spec_${s}`] !== curr[`spec_${s}`]) return true;
  }
  return false;
}

const REGION_EMOJI = {
  EU: '🇪🇺', NA: '🇺🇸', SA: '🇧🇷', KR: '🇰🇷',
  JP: '🇯🇵', RU: '🇷🇺', TR: '🇹🇷', TW: '🇹🇼', ASIA: '🌏'
};

module.exports = function createGlobalRouter({ db, BDO_API, ADMIN_TOKEN }) {

  // ── Schema-Migration: alte tracked_players (profile_target PRIMARY KEY) ersetzen
  {
    const cols = db.prepare("PRAGMA table_info(tracked_players)").all();
    const isOldSchema = cols.length > 0 && !cols.find(c => c.name === 'id');
    if (isOldSchema) {
      console.log('[global] Migriere tracked_players zu namensbasiertem Schema (alte Einträge gelöscht)');
      db.exec('DROP TABLE tracked_players');
    }
  }

  // ── Tabellen anlegen ──────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS tracked_players (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_target TEXT UNIQUE,
      family_name    TEXT,
      region         TEXT,
      last_scraped   TEXT,
      last_change    TEXT,
      scrape_tier    TEXT DEFAULT 'daily',
      active         INTEGER DEFAULT 1,
      added_on       TEXT,
      source         TEXT DEFAULT 'search'
    );

    CREATE TABLE IF NOT EXISTS global_snapshots (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      date                TEXT NOT NULL,
      profile_target      TEXT NOT NULL,
      family_name         TEXT,
      region              TEXT,
      life_fame           INTEGER DEFAULT 0,
      contribution_points INTEGER DEFAULT 0,
      energy              INTEGER DEFAULT 0,
      ${LIFESKILLS.map(s => `spec_${s} TEXT DEFAULT ''`).join(',\n      ')},
      UNIQUE(date, profile_target)
    );

    CREATE INDEX IF NOT EXISTS idx_gs_date ON global_snapshots(date);
    CREATE INDEX IF NOT EXISTS idx_gs_pt   ON global_snapshots(profile_target);
  `);

  const router = Router();

  // ── Hilfsfunktionen ───────────────────────────────────────────────────────────

  function getClarityMembers() {
    const row = db.prepare('SELECT MAX(date) as d FROM snapshots').get();
    if (!row?.d) return new Set();
    return new Set(
      db.prepare('SELECT family_name FROM snapshots WHERE date = ?').all(row.d).map(r => r.family_name)
    );
  }

  function getComparisonDates(latestDate) {
    const sevenAgo  = new Date(new Date(latestDate).getTime() - 7 * 86400000).toISOString().split('T')[0];
    const monthStart = latestDate.substring(0, 7) + '-01';

    const d7 = db.prepare(
      `SELECT date FROM global_snapshots WHERE date <= ? AND date < ? GROUP BY date ORDER BY date DESC LIMIT 1`
    ).get(sevenAgo, latestDate)?.date
    ?? db.prepare(
      `SELECT date FROM global_snapshots WHERE date < ? GROUP BY date ORDER BY date ASC LIMIT 1`
    ).get(latestDate)?.date;

    const dm = db.prepare(
      `SELECT date FROM global_snapshots WHERE date <= ? AND date < ? GROUP BY date ORDER BY date DESC LIMIT 1`
    ).get(monthStart, latestDate)?.date
    ?? db.prepare(
      `SELECT date FROM global_snapshots WHERE date < ? GROUP BY date ORDER BY date ASC LIMIT 1`
    ).get(latestDate)?.date;

    return { d7, dm };
  }

  // ── GET /leaderboard/:skill ───────────────────────────────────────────────────
  router.get('/leaderboard/:skill', (req, res) => {
    const skill  = req.params.skill;
    const region = req.query.region || 'all';
    const valid  = ['life_fame', 'contribution_points', 'energy', ...LIFESKILLS];
    if (!valid.includes(skill)) return res.status(400).json({ error: 'Unknown skill' });

    const latestDate = db.prepare('SELECT MAX(date) as d FROM global_snapshots').get()?.d;
    if (!latestDate) return res.json([]);

    const { d7, dm } = getComparisonDates(latestDate);
    const clarityMembers = getClarityMembers();

    const regionSql = region !== 'all' ? 'AND gs.region = ?' : '';
    const regionArg = region !== 'all' ? [region] : [];

    const isNumeric = ['life_fame','contribution_points','energy'].includes(skill);
    const col = isNumeric ? skill : `spec_${skill}`;

    const rows = db.prepare(`
      SELECT gs.profile_target, gs.family_name, gs.region,
             gs.${col}  AS cur,
             p7.${col}  AS v7,
             pm.${col}  AS vm
      FROM global_snapshots gs
      LEFT JOIN global_snapshots p7 ON p7.profile_target = gs.profile_target AND p7.date = ?
      LEFT JOIN global_snapshots pm ON pm.profile_target = gs.profile_target AND pm.date = ?
      WHERE gs.date = ? ${regionSql}
    `).all(d7 || latestDate, dm || latestDate, latestDate, ...regionArg);

    const sorted = isNumeric
      ? rows.sort((a, b) => (b.cur || 0) - (a.cur || 0))
      : rows.sort((a, b) => specLevelToNumber(b.cur) - specLevelToNumber(a.cur));

    const result = sorted.slice(0, 100).map((row, i) => {
      const isClarity = clarityMembers.has(row.family_name);
      if (isNumeric) {
        return {
          rank: i + 1,
          name: row.family_name || row.profile_target,
          region: row.region,
          region_emoji: REGION_EMOJI[row.region] || '🌍',
          display: String(row.cur || 0),
          gain_7d:    row.v7 != null ? (row.cur || 0) - (row.v7 || 0) : null,
          gain_month: row.vm != null ? (row.cur || 0) - (row.vm || 0) : null,
          is_clarity: isClarity,
        };
      }
      return {
        rank: i + 1,
        name: row.family_name || row.profile_target,
        region: row.region,
        region_emoji: REGION_EMOJI[row.region] || '🌍',
        display: row.cur || '–',
        gain_7d:    row.v7 != null ? specLevelToNumber(row.cur) - specLevelToNumber(row.v7) : null,
        gain_month: row.vm != null ? specLevelToNumber(row.cur) - specLevelToNumber(row.vm) : null,
        is_clarity: isClarity,
      };
    });

    res.json(result);
  });

  // ── GET /stats ────────────────────────────────────────────────────────────────
  router.get('/stats', (req, res) => {
    const total  = db.prepare("SELECT COUNT(*) as c FROM tracked_players WHERE active = 1").get()?.c || 0;
    const daily  = db.prepare("SELECT COUNT(*) as c FROM tracked_players WHERE active=1 AND scrape_tier='daily'").get()?.c || 0;
    const latest = db.prepare('SELECT MAX(date) as d FROM global_snapshots').get()?.d || null;
    res.json({ total_players: total, daily_players: daily, latest_date: latest });
  });

  // ── GET /player/search ────────────────────────────────────────────────────────
  router.get('/player/search', async (req, res) => {
    const { name, region = 'EU' } = req.query;
    if (!name) return res.status(400).json({ error: 'name required' });
    try {
      const r = await axios.get(`${BDO_API}/v1/adventurer/search`, {
        params: { query: name, region }, timeout: 15000
      });
      res.json(r.data);
    } catch (e) {
      res.status(502).json({ error: 'BDO API nicht erreichbar', detail: e.message });
    }
  });

  // ── POST /player/add ──────────────────────────────────────────────────────────
  router.post('/player/add', (req, res) => {
    const { profileTarget, familyName, region = 'EU', source = 'search' } = req.body;
    const today = new Date().toISOString().split('T')[0];

    if (profileTarget) {
      const existing = db.prepare('SELECT id FROM tracked_players WHERE profile_target = ?').get(profileTarget);
      if (existing) return res.json({ added: false, message: 'Bereits im Pool (profileTarget)' });
      db.prepare(`
        INSERT INTO tracked_players (profile_target, family_name, region, added_on, source, active)
        VALUES (?, ?, ?, ?, ?, 1)
      `).run(profileTarget, familyName || null, region, today, source);
      return res.json({ added: true });
    }

    if (familyName) {
      const existing = db.prepare('SELECT id FROM tracked_players WHERE family_name = ? AND region = ?').get(familyName, region);
      if (existing) return res.json({ added: false, message: 'Bereits im Pool (familyName+region)' });
      db.prepare(`
        INSERT INTO tracked_players (family_name, region, added_on, source, active)
        VALUES (?, ?, ?, ?, 1)
      `).run(familyName, region, today, source);
      return res.json({ added: true });
    }

    return res.status(400).json({ error: 'profileTarget oder familyName erforderlich' });
  });

  // ── POST /admin/resolve (Scraper → trägt aufgelösten profileTarget ein) ───────
  router.post('/admin/resolve', (req, res) => {
    const token = req.headers['x-admin-token'];
    if (!token || token !== ADMIN_TOKEN) return res.status(401).json({ error: 'Unauthorized' });

    const { familyName, region, profileTarget } = req.body;
    if (!familyName || !region || !profileTarget) {
      return res.status(400).json({ error: 'familyName, region, profileTarget erforderlich' });
    }

    // Falls profileTarget bereits in anderem Eintrag (z.B. aus Clarity-Pool): Duplikat bereinigen
    const ptRow = db.prepare('SELECT id FROM tracked_players WHERE profile_target = ?').get(profileTarget);
    if (ptRow) {
      db.prepare('DELETE FROM tracked_players WHERE family_name = ? AND region = ? AND profile_target IS NULL').run(familyName, region);
      db.prepare('UPDATE tracked_players SET family_name = ? WHERE profile_target = ? AND family_name IS NULL').run(familyName, profileTarget);
      return res.json({ resolved: true, merged: true });
    }

    const result = db.prepare(
      'UPDATE tracked_players SET profile_target = ? WHERE family_name = ? AND region = ? AND profile_target IS NULL'
    ).run(profileTarget, familyName, region);

    if (result.changes === 0) {
      db.prepare(`
        INSERT OR IGNORE INTO tracked_players (profile_target, family_name, region, added_on, source, active)
        VALUES (?, ?, ?, ?, 'resolved', 1)
      `).run(profileTarget, familyName, region, new Date().toISOString().split('T')[0]);
    }

    res.json({ resolved: true, merged: false });
  });

  // ── GET /admin/pending (für Scraper) ─────────────────────────────────────────
  router.get('/admin/pending', (req, res) => {
    const token = req.headers['x-admin-token'];
    if (!token || token !== ADMIN_TOKEN) return res.status(401).json({ error: 'Unauthorized' });

    const today   = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

    const players = db.prepare(`
      SELECT profile_target, region, family_name, scrape_tier
      FROM tracked_players
      WHERE active = 1
      AND (
        (scrape_tier = 'daily'  AND (last_scraped IS NULL OR last_scraped < ?))
        OR
        (scrape_tier = 'weekly' AND (last_scraped IS NULL OR last_scraped < ?))
      )
    `).all(today, weekAgo);

    res.json({ date: today, players });
  });

  // ── POST /admin/bulk-snapshot (für Scraper) ───────────────────────────────────
  router.post('/admin/bulk-snapshot', (req, res) => {
    const token = req.headers['x-admin-token'];
    if (!token || token !== ADMIN_TOKEN) return res.status(401).json({ error: 'Unauthorized' });

    const { date, snapshots = [], failed = [] } = req.body;
    if (!date) return res.status(400).json({ error: 'date required' });

    const insertSnap = db.prepare(`
      INSERT OR REPLACE INTO global_snapshots
        (date, profile_target, family_name, region,
         life_fame, contribution_points, energy,
         ${LIFESKILLS.map(s => `spec_${s}`).join(', ')})
      VALUES
        (@date, @profile_target, @family_name, @region,
         @life_fame, @contribution_points, @energy,
         ${LIFESKILLS.map(s => `@spec_${s}`).join(', ')})
    `);

    const updatePlayer = db.prepare(`
      UPDATE tracked_players
      SET last_scraped = @date,
          family_name  = @family_name,
          last_change  = CASE WHEN @changed = 1 THEN @date ELSE last_change END,
          scrape_tier  = @tier
      WHERE profile_target = @profile_target
    `);

    const markInactive = db.prepare(
      `UPDATE tracked_players SET active = 0 WHERE profile_target = ?`
    );

    db.transaction(() => {
      for (const snap of snapshots) {
        const prev = db.prepare(`
          SELECT * FROM global_snapshots WHERE profile_target = ? AND date < ?
          ORDER BY date DESC LIMIT 1
        `).get(snap.profile_target, date);

        const changed = snapshotChanged(prev, snap);

        const player = db.prepare('SELECT last_change FROM tracked_players WHERE profile_target = ?').get(snap.profile_target);
        const lastChange = changed ? date : (player?.last_change || date);
        const daysSince = (Date.now() - new Date(lastChange).getTime()) / 86400000;
        const tier = daysSince >= 7 ? 'weekly' : 'daily';

        insertSnap.run({ date, ...snap });
        updatePlayer.run({ date, family_name: snap.family_name, changed: changed ? 1 : 0, tier, profile_target: snap.profile_target });
      }

      for (const pt of failed) {
        const player = db.prepare('SELECT last_scraped FROM tracked_players WHERE profile_target = ?').get(pt);
        if (player?.last_scraped) {
          const days = (Date.now() - new Date(player.last_scraped).getTime()) / 86400000;
          if (days >= 3) markInactive.run(pt);
        }
      }
    })();

    console.log(`[${new Date().toISOString()}] global bulk-snapshot: ${snapshots.length} gespeichert, ${failed.length} fehlgeschlagen für ${date}`);
    res.json({ saved: snapshots.length, failed: failed.length, date });
  });

  return router;
};
