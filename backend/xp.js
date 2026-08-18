// XP-Rangliste je Lifeskill.
//
// Eigener Zugang per Passwort, unabhaengig vom Discord-Login: die Seite ist
// fuer Gildenmitglieder ohne Discord-Rolle gedacht. Deshalb wird dieser Router
// VOR app.use(requireAuth) eingehaengt.
//
// Gerechnet wird mit der Lifeskill-XP-Tabelle (flockenberger): je Skill eine
// eigene Spalte. Barter hat eine eigene Skala, Trading enthaelt nur Platzhalter
// und bleibt deshalb aussen vor.
const express = require('express');
const crypto = require('crypto');
const XP = require('./lifeskill_xp.json');

const RANK_OFFSETS = {
  beginner: 0, apprentice: 10, skilled: 20, professional: 30,
  artisan: 40, master: 50, guru: 80,
};
const SKILLS = ['cooking', 'processing', 'gathering', 'hunting', 'alchemy',
  'farming', 'training', 'fishing', 'sailing', 'barter'];

const LEVEL_INDEX = new Map(XP.levels.map((l, i) => [l, i]));
const xpTotal = (spec, skill) => {
  const i = LEVEL_INDEX.get((spec || '').trim());
  return i == null ? null : XP.xpTotal[skill]?.[i] ?? null;
};
const specToNumber = (spec) => {
  if (!spec) return 0;
  const p = String(spec).toLowerCase().trim().split(/\s+/);
  return (RANK_OFFSETS[p[0]] ?? 0) + (parseInt(p[1], 10) || 0);
};

module.exports = function xpRouter(db, { password, sessionSecret }) {
  const router = express.Router();
  const COOKIE = 'cgxp';
  const MAX_AGE = 30 * 24 * 60 * 60 * 1000;

  const sign = (exp) => {
    const data = Buffer.from(JSON.stringify({ xp: true, exp })).toString('base64url');
    const sig = crypto.createHmac('sha256', sessionSecret).update(data).digest('base64url');
    return `${data}.${sig}`;
  };
  const valid = (token) => {
    if (!token) return false;
    const dot = token.lastIndexOf('.');
    if (dot < 0) return false;
    const data = token.slice(0, dot);
    const expected = crypto.createHmac('sha256', sessionSecret).update(data).digest('base64url');
    const given = Buffer.from(token.slice(dot + 1));
    if (given.length !== Buffer.from(expected).length) return false;
    if (!crypto.timingSafeEqual(given, Buffer.from(expected))) return false;
    try { return JSON.parse(Buffer.from(data, 'base64url').toString()).exp > Date.now(); }
    catch { return false; }
  };

  router.get('/session', (req, res) => res.json({ ok: valid(req.cookies?.[COOKIE]) }));

  router.post('/login', (req, res) => {
    const given = String(req.body?.password || '');
    const ok = given.length === password.length
      && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(password));
    if (!ok) return res.status(401).json({ error: 'Falsches Passwort' });
    res.cookie(COOKIE, sign(Date.now() + MAX_AGE), {
      httpOnly: true, secure: true, sameSite: 'lax', maxAge: MAX_AGE,
    });
    res.json({ ok: true });
  });

  router.get('/ranking', (req, res) => {
    if (!valid(req.cookies?.[COOKIE])) return res.status(401).json({ error: 'Login required' });
    const year = /^\d{4}$/.test(req.query.year || '') ? req.query.year : '2026';

    const rows = db.prepare(
      'SELECT * FROM snapshots WHERE date >= ? AND date <= ? ORDER BY date'
    ).all(`${year}-01-01`, `${year}-12-31`);

    const first = new Map(); const last = new Map();
    for (const r of rows) {
      if (!first.has(r.family_name)) first.set(r.family_name, r);
      last.set(r.family_name, r);
    }

    const perSkill = {};
    const totals = new Map();
    for (const skill of SKILLS) {
      const list = [];
      for (const [name, a] of first) {
        const b = last.get(name);
        if (a.date === b.date) continue;
        const from = (a[`spec_${skill}`] || '').trim();
        const to = (b[`spec_${skill}`] || '').trim();
        // Leerer Startwert heisst: der Spieler wurde erst spaeter erfasst. Dann
        // ist der Zuwachs unbekannt — mitzaehlen waere frei erfunden.
        if (!from || !to) continue;
        const ta = xpTotal(from, skill); const tb = xpTotal(to, skill);
        if (ta == null || tb == null) continue;
        const xp = Math.max(0, tb - ta);
        const levels = specToNumber(to) - specToNumber(from);
        if (xp > 0) {
          list.push({ name, xp, levels, from, to });
          totals.set(name, (totals.get(name) || 0) + xp);
        }
      }
      list.sort((x, y) => y.xp - x.xp);
      perSkill[skill] = {
        total: list.reduce((s, x) => s + x.xp, 0),
        players: list.length,
        rows: list.map((r, i) => ({ rank: i + 1, ...r })),
      };
    }

    const overall = [...totals.entries()]
      .map(([name, xp]) => ({ name, xp }))
      .sort((a, b) => b.xp - a.xp)
      .map((r, i) => ({ rank: i + 1, ...r }));

    res.json({
      year,
      from: rows.length ? rows[0].date : null,
      to: rows.length ? rows[rows.length - 1].date : null,
      skills: SKILLS,
      perSkill,
      overall,
      note: 'Trading fehlt: die XP-Tabelle enthaelt dort nur Platzhalter.',
    });
  });

  return router;
};
