'use strict';
// Publiczny ranking graczy: poziom, PvP (Elo) i osiągnięcia.
const store = require('./store');
function ranking(levels) {
  const pvp = store.get('pvp', {}), ach = store.get('achc', {});
  const lv = {};
  for (const r of levels || []) lv[r.nick.toLowerCase()] = { n: r.nick, cls: r.cls, lvl: r.lvl };
  for (const k of Object.keys(ach)) { const a = ach[k], key = String(a.n || '').toLowerCase(); if (key && (!lv[key] || lv[key].lvl < a.lvl)) lv[key] = { n: a.n, cls: a.cls, lvl: a.lvl }; }
  const level = Object.values(lv).sort((a, b) => b.lvl - a.lvl || a.n.localeCompare(b.n)).slice(0, 10);
  const pv = Object.values(pvp).filter((e) => e.w + e.l > 0).sort((a, b) => b.pts - a.pts).slice(0, 10).map((e) => ({ n: e.n, cls: e.cls, lvl: e.lvl || 0, pts: e.pts, w: e.w, l: e.l }));
  const ac = Object.values(ach).filter((e) => e.a > 0).sort((a, b) => b.a - a.a || b.lvl - a.lvl).slice(0, 10).map((e) => ({ n: e.n, cls: e.cls, lvl: e.lvl, a: e.a }));
  return { level, pvp: pv, ach: ac, total: 23 };
}
// Ranking na stronie głównej jest liczony po stronie serwera i odświeżany co 12 godzin.
// Wynik (z czasem obliczenia) trzymamy w magazynie kv, więc przetrwa restart/deploy serwera.
const EVERY = 12 * 3600e3;
function createRankingCache(opts) {
  const every = opts.every > 0 ? opts.every : EVERY;
  const now = opts.now || Date.now;
  const key = opts.key || 'rankCache';
  function refresh() { const v = { at: now(), data: opts.compute() }; store.set(key, v); return v; }
  function get() {
    let c = store.get(key, null);
    if (!c || !c.data || typeof c.at !== 'number' || now() - c.at >= every || c.at > now() + 60e3) c = refresh();
    return Object.assign({}, c.data, { at: c.at, every, next: c.at + every });
  }
  return { get, refresh, every };
}
module.exports = { ranking, createRankingCache, EVERY };
