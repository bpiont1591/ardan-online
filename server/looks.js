'use strict';
// Wygląd postaci (round 10): free level skins. Tiers unlock at levels from the engine (SKIN_LV: 1, 5, 15, 30, 45, 60, 70, 80).
// P.skin = -1 / missing → automatically the highest unlocked tier; a number = the player's choice (kept until changed).
// The server validates every choice against the level; the effective tier is broadcast with the player (field "sk").
function createLooks(world) {
  const sys = (p, t) => world.chat.sys(p, t);
  const LV = (p) => p.api.skinLv;
  function view(p) {
    const P = p.api.P(), lv = LV(p);
    return { t: 'skin', lv, lvl: P.lvl, cls: P.cls, cur: Number.isInteger(P.skin) && P.skin >= 0 ? P.skin : -1, eff: p.api.skinTier() };
  }
  function set(p, k) {
    const P = p.api.P(), lv = LV(p);
    if (k === -1 || k === null) { delete P.skin; p.srv.dirty = true; sys(p, 'Wygląd: automatycznie najlepszy odblokowany.'); return world.send(p, view(p)); }
    if (!Number.isInteger(k) || k < 0 || k >= lv.length) { if (world.log) world.log('sus', 'skin', p, { detail: `nieprawidłowy wygląd: ${String(k).slice(0, 20)}`, throttle: 'skin' }); return world.send(p, view(p)); }
    if (P.lvl < lv[k]) { if (world.log) world.log('sus', 'skin', p, { detail: `wygląd ${k} wymaga poz. ${lv[k]}, postać ma ${P.lvl}`, throttle: 'skin' }); sys(p, `Ten wygląd odblokujesz na ${lv[k]}. poziomie.`); return world.send(p, view(p)); }
    P.skin = k; p.srv.dirty = true; world.send(p, view(p));
  }
  return {
    name: 'looks', view, set,
    onMsg(p, msg) {
      if (msg.t !== 'skin') return false;
      if (msg.a === 'set') set(p, msg.k); else world.send(p, view(p));
      return true;
    },
    onJoin(p) { p.skLvl = p.api.P().lvl; },
    onTick() {
      for (const p of world.players.values()) {
        const P = p.api.P(); if (p.skLvl === undefined) p.skLvl = P.lvl;
        if (P.lvl > p.skLvl) { const lv = LV(p); const got = lv.filter((l, i) => i > 0 && l > p.skLvl && l <= P.lvl); p.skLvl = P.lvl; if (got.length && !p.bot) { sys(p, `✨ Nowy wygląd odblokowany (poziom ${got[got.length - 1]})! Zmień go w oknie „Wygląd” (K).`); world.send(p, Object.assign(view(p), { unlocked: got[got.length - 1] })); } }
        else if (P.lvl < p.skLvl) p.skLvl = P.lvl;
      }
    },
  };
}
module.exports = { createLooks };
