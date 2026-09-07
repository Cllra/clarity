// XP-Rangliste je Lifeskill.
//
// Oeffentlich, ohne Login: die Seite ist fuer Gildenmitglieder ohne
// Discord-Rolle gedacht. Deshalb wird dieser Router VOR app.use(requireAuth)
// eingehaengt. Der frueher davorstehende Passwortschutz ist raus; das
// Discord-Gate fuer den Rest der Seite bleibt unberuehrt.
//
// Gerechnet wird mit der Lifeskill-XP-Tabelle (flockenberger): je Skill eine
// eigene Spalte. Barter hat eine eigene Skala, Trading enthaelt nur Platzhalter
// und bleibt deshalb aussen vor.
const express = require('express');
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
// Anzeigename des laufenden Monats, englisch wie der Rest der Seite.
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const monthLabel = (date) => {
  const [y, m] = date.split('-');
  return `${MONTHS[parseInt(m, 10) - 1]} ${y}`;
};
const specToNumber = (spec) => {
  if (!spec) return 0;
  const p = String(spec).toLowerCase().trim().split(/\s+/);
  return (RANK_OFFSETS[p[0]] ?? 0) + (parseInt(p[1], 10) || 0);
};

module.exports = function xpRouter(db) {
  const router = express.Router();

  router.get('/ranking', (req, res) => {
    const year = /^\d{4}$/.test(req.query.year || '') ? req.query.year : '2026';
    const monthly = req.query.period === 'month';

    // Der laufende Monat haengt am letzten Snapshot, nicht an der Serveruhr:
    // sonst steht die Seite am Monatsersten vor dem Scrape leer da.
    const latest = db.prepare('SELECT MAX(date) AS date FROM snapshots').get()?.date;
    const monthStart = `${(latest || `${year}-01-01`).substring(0, 7)}-01`;
    const fromDate = monthly ? monthStart : `${year}-01-01`;
    const toDate = monthly ? (latest || monthStart) : `${year}-12-31`;

    const rows = db.prepare(
      'SELECT * FROM snapshots WHERE date >= ? AND date <= ? ORDER BY date'
    ).all(fromDate, toDate);

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
      period: monthly ? 'month' : 'year',
      label: monthly ? monthLabel(fromDate) : year,
      from: rows.length ? rows[0].date : null,
      to: rows.length ? rows[rows.length - 1].date : null,
      skills: SKILLS,
      perSkill,
      overall,
      note: 'Trading is excluded: the XP table only holds placeholder values there.',
    });
  });

  return router;
};
