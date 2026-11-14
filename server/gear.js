'use strict';
// Equipment slots + item bag (P.gear / P.gbag). Stats of worn items feed the engine (atk/def/hp/mp/crit/dodge).
const I = require('./items');
const BAG = 40;
const U_RE = /^[a-z0-9]{6,24}$/;

function createGear(world) {
  const sys = (p, t) => world.chat.sys(p, t);
  function ensure(p) {
    const P = p.api.P(), items = p.api.items;
    if (!P.gear || typeof P.gear !== 'object' || Array.isArray(P.gear)) {
      P.gear = {};
      if (P.eq && P.eq.w && items[P.eq.w]) P.gear.weapon = I.fromLegacy(P.eq.w, items[P.eq.w], P.cls);
      if (P.eq && P.eq.a && items[P.eq.a]) P.gear.armor = I.fromLegacy(P.eq.a, items[P.eq.a], P.cls);
    }
    for (const k of Object.keys(P.gear)) if (I.SLOTS.indexOf(k) < 0 || !I.validItem(P.gear[k])) delete P.gear[k];
    if (!Array.isArray(P.gbag)) P.gbag = [];
    P.gbag = P.gbag.filter(I.validItem).slice(0, BAG);
    sprites(P);
  }
  function sprites(P) {
    P.eq = P.eq || {};
    P.eq.w = P.gear.weapon ? P.gear.weapon.spr || null : null;
    P.eq.a = P.gear.armor ? P.gear.armor.spr || 'shirt' : 'shirt';
  }
  function changed(p) { const P = p.api.P(); sprites(P); P.hp = Math.min(P.hp, p.api.maxHp()); P.mp = Math.min(P.mp, p.api.maxMp()); p.srv.dirty = true; p.gearDirty = true; }
  const bag = (p) => p.api.P().gbag;
  const space = (p) => BAG - bag(p).length;
  function give(p, list, why) {
    const P = p.api.P(), got = [], lost = [];
    for (const it of list) { if (P.gbag.length < BAG) { P.gbag.push(it); got.push(it); } else lost.push(it); }
    if (lost.length) sys(p, `Torba jest pełna – przepadło: ${lost.map((x) => x.n).join(', ')}.`);
    if (list.length) changed(p);
    return got;
  }
  function take(p, u) { const b = bag(p), i = b.findIndex((x) => x.u === u); if (i < 0) return null; const it = b.splice(i, 1)[0]; changed(p); return it; }
  const find = (p, u) => bag(p).find((x) => x.u === u) || null;

  function equip(p, u) {
    const P = p.api.P(), it = find(p, u); if (!it) return;
    const err = I.canEquip(it, P); if (err) return sys(p, err);
    let slot = it.s;
    if (slot === 'ring') slot = !P.gear.ring1 ? 'ring1' : !P.gear.ring2 ? 'ring2' : 'ring1';
    take(p, u);
    const old = P.gear[slot]; P.gear[slot] = it;
    if (old) P.gbag.push(old);
    changed(p);
  }
  function unequip(p, slot) {
    const P = p.api.P(); if (I.SLOTS.indexOf(slot) < 0 || !P.gear[slot]) return;
    if (space(p) <= 0) return sys(p, 'Torba jest pełna!');
    P.gbag.push(P.gear[slot]); delete P.gear[slot]; changed(p);
  }
  function sell(p, u) {
    const it = take(p, u); if (!it) return;
    const pr = Math.max(1, Math.floor(it.v / 2)); const P = p.api.P(); P.gold += pr;
    sys(p, `Sprzedano kupcowi: ${it.n} (+${pr} zł).`);
  }
  function view(p) {
    const P = p.api.P();
    return { t: 'gear', gear: P.gear, bag: P.gbag, max: BAG, st: p.api.stats(), gold: P.gold, lvl: P.lvl, cls: P.cls, inv: P.inv };
  }
  function push(p) { const v = view(p); const s = JSON.stringify(v); if (s !== p.lastGear) { p.lastGear = s; world.send(p, v); } }
  return {
    name: 'gear', BAG, give, take, find, space, ensure, changed,
    onJoin(p) { ensure(p); p.gearDirty = true; },
    onTick() {
      for (const p of world.players.values()) {
        if (p.bot) continue;
        const P = p.api.P();
        // shop / quest weapons and armour land in the old item list – move them into the equipment bag
        for (let i = P.inv.length - 1; i >= 0; i--) {
          const s = P.inv[i], def = p.api.items[s.id];
          if (def && (def.t === 'w' || def.t === 'a')) {
            if (space(p) <= 0) continue;
            s.n--; if (s.n <= 0) P.inv.splice(i, 1);
            const it = I.fromLegacy(s.id, def, P.cls); if (it) { P.gbag.push(it); changed(p); }
          }
        }
        if (P.eq && P.gear && (P.eq.w !== (P.gear.weapon ? P.gear.weapon.spr || null : null))) sprites(P);
        if (p.gearDirty || (p.gearT || 0) < Date.now() - 1000) { p.gearDirty = false; p.gearT = Date.now(); push(p); }
      }
    },
    onMsg(p, msg) {
      if (msg.t !== 'gear') return false;
      if (p.battle) return true;
      const u = typeof msg.u === 'string' && U_RE.test(msg.u) ? msg.u : null;
      if (msg.a === 'equip' && u) equip(p, u);
      else if (msg.a === 'unequip' && typeof msg.slot === 'string') unequip(p, msg.slot);
      else if (msg.a === 'sell' && u) sell(p, u);
      else if (msg.a === 'drop' && u) { const it = take(p, u); if (it) sys(p, `Wyrzucono: ${it.n}.`); }
      else if (msg.a === 'get') p.lastGear = '';
      push(p);
      return true;
    },
  };
}
module.exports = { createGear, BAG };
