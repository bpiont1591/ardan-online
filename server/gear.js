'use strict';
// Equipment slots + bags + item bag (P.gear / P.bags / P.gbag). Stats of worn items feed the engine (atk/def/hp/mp/crit/dodge).
// Round 9 (Margonem-like bags): the inventory capacity is the sum of the worn bags (P.bags, up to 4 slots; every character
// starts with a large 25-slot bag). Equipment / materials (P.gbag) and potions / quest items (P.inv stacks) share it.
// Over capacity (e.g. old characters) nothing is deleted – new items just can't be picked up until there is room.
// Loot that doesn't fit stays "on the ground" for 2 minutes (p.ground) and is picked up automatically once there is room.
// Stat points (Margonem): 1 point per level above 1, spent on Siła / Zręczność / Intelekt (P.attr).
const I = require('./items');
const BAG = 25;            // capacity of the starter bag (kept for older callers)
const HARD_MAX = 400;      // sanity limit for corrupted saves
const GROUND_MS = 120000;
const U_RE = /^[a-z0-9]{6,24}$/;
const ATTR = { str: 'Siła', agi: 'Zręczność', int: 'Intelekt' };

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
    P.gbag = P.gbag.filter(I.validItem).slice(0, HARD_MAX);
    // bag slots: migration gives every character (old and new) the starter large bag
    if (!Array.isArray(P.bags)) P.bags = [I.bag('l')];
    P.bags = P.bags.slice(0, I.BAG_SLOTS).map((b) => (I.isBag(b) && I.validItem(b) ? b : null));
    while (P.bags.length < I.BAG_SLOTS) P.bags.push(null);
    if (!P.bags.some(Boolean)) P.bags[0] = I.bag('l');
    if (!P.attr || typeof P.attr !== 'object') P.attr = { str: 0, agi: 0, int: 0 };
    for (const k of Object.keys(ATTR)) P.attr[k] = Math.max(0, Math.floor(Number(P.attr[k]) || 0));
    for (const k of Object.keys(P.attr)) if (!ATTR[k]) delete P.attr[k];
    if (attrSpent(P) > attrTotal(P)) P.attr = { str: 0, agi: 0, int: 0 }; // corrupted save → refund
    P.cap = capOf(P);
    sprites(P);
  }
  const capOf = (P) => (P.bags || []).reduce((s, b) => s + I.bagCap(b), 0);
  const usedOf = (P) => (P.gbag ? P.gbag.length : 0) + (P.inv ? P.inv.length : 0);
  const attrTotal = (P) => Math.max(0, (P.lvl | 0) - 1);
  const attrSpent = (P) => Object.keys(ATTR).reduce((s, k) => s + ((P.attr && P.attr[k]) | 0), 0);
  function sprites(P) {
    P.eq = P.eq || {};
    P.eq.w = P.gear.weapon ? P.gear.weapon.spr || null : null;
    P.eq.a = P.gear.armor ? P.gear.armor.spr || 'shirt' : 'shirt';
  }
  function changed(p) { const P = p.api.P(); P.cap = capOf(P); sprites(P); P.hp = Math.min(P.hp, p.api.maxHp()); P.mp = Math.min(P.mp, p.api.maxMp()); p.srv.dirty = true; p.gearDirty = true; }
  const bag = (p) => p.api.P().gbag;
  const cap = (p) => capOf(p.api.P());
  const space = (p) => { const P = p.api.P(); return capOf(P) - usedOf(P); };
  function toGround(p, items) {
    if (!items.length) return;
    p.ground = (p.ground || []).concat(items.map((it) => ({ it, exp: Date.now() + GROUND_MS }))).slice(-30);
    sys(p, `🎒 Plecak pełny! ${items.map((x) => x.n).join(', ')} – leży na ziemi przez 2 min. Zrób miejsce (sprzedaj, wyrzuć lub załóż większą torbę), a podniesiesz to automatycznie.`);
    p.gearDirty = true;
  }
  function give(p, list, why) {
    const P = p.api.P(), got = [], over = [];
    for (const it of list) {
      if (it.s === 'mat') {
        const st = P.gbag.find((x) => x.s === 'mat' && x.m === it.m && (x.q || 1) + (it.q || 1) <= I.MAX_STACK);
        if (st) { st.q = (st.q || 1) + (it.q || 1); st.v = I.MATS[st.m].v * st.q; got.push(it); continue; }
      }
      if (space(p) > 0) { P.gbag.push(it); got.push(it); if (world.emit) world.emit('onEvent', p, 'item', it); } else over.push(it);
    }
    toGround(p, over);
    if (list.length) changed(p);
    return got;
  }
  function pickGround(p) {
    if (!p.ground || !p.ground.length) return;
    const now = Date.now(), P = p.api.P(), keep = [], got = [], gone = [];
    for (const g of p.ground) {
      if (g.exp < now) { gone.push(g.it); continue; }
      if (!p.battle && space(p) > 0) { P.gbag.push(g.it); got.push(g.it); if (world.emit) world.emit('onEvent', p, 'item', g.it); } else keep.push(g);
    }
    p.ground = keep;
    if (got.length) { sys(p, `🎒 Podnosisz z ziemi: ${got.map((x) => x.n).join(', ')}.`); changed(p); }
    if (gone.length) { sys(p, `Przepadło z ziemi: ${gone.map((x) => x.n).join(', ')}.`); p.gearDirty = true; }
  }
  function take(p, u) { const b = bag(p), i = b.findIndex((x) => x.u === u); if (i < 0) return null; const it = b.splice(i, 1)[0]; changed(p); return it; }
  const find = (p, u) => bag(p).find((x) => x.u === u) || null;
  const countMat = (p, k) => bag(p).reduce((a, x) => a + (x.s === 'mat' && x.m === k ? x.q || 1 : 0), 0);
  function useMat(p, k, n) {
    if (n <= 0) return true;
    if (countMat(p, k) < n) return false;
    const b = bag(p);
    for (let i = b.length - 1; i >= 0 && n > 0; i--) { const x = b[i]; if (x.s !== 'mat' || x.m !== k) continue; const d = Math.min(n, x.q || 1); x.q = (x.q || 1) - d; n -= d; if (x.q <= 0) b.splice(i, 1); else x.v = I.MATS[k].v * x.q; }
    changed(p); return true;
  }
  function findAny(p, u) { const P = p.api.P(); const it = find(p, u); if (it) return it; for (const k of Object.keys(P.gear)) if (P.gear[k] && P.gear[k].u === u) return P.gear[k]; return null; }

  function equipBag(p, it) {
    const P = p.api.P();
    const i = P.bags.findIndex((b) => !b);
    if (i < 0) return sys(p, `Masz już ${I.BAG_SLOTS} torby – zdejmij jedną (musi się zmieścić w pozostałych), aby założyć nową.`);
    take(p, it.u); P.bags[i] = it; changed(p);
    sys(p, `🎒 Zakładasz: ${it.n} (+${I.bagCap(it)} miejsc).`);
  }
  function unequipBag(p, i) {
    const P = p.api.P(), b = P.bags[i]; if (!b) return;
    if (P.bags.filter(Boolean).length <= 1) return sys(p, 'Musisz nosić przynajmniej jedną torbę.');
    // after taking it off, the bag itself goes into the remaining space
    if (capOf(P) - I.bagCap(b) < usedOf(P) + 1) return sys(p, 'Nie możesz zdjąć tej torby – jej zawartość nie zmieści się w pozostałych.');
    P.bags[i] = null; P.gbag.push(b); changed(p);
  }
  function equip(p, u) {
    const P = p.api.P(), it = find(p, u); if (!it) return;
    if (it.s === 'bag') return equipBag(p, it);
    const err = I.canEquip(it, P); if (err) return sys(p, err);
    let slot = it.s;
    if (slot === 'ring') slot = !P.gear.ring1 ? 'ring1' : !P.gear.ring2 ? 'ring2' : 'ring1';
    take(p, u);
    const old = P.gear[slot]; P.gear[slot] = it;
    if (old) P.gbag.push(old);
    changed(p);
  }
  function unequip(p, slot) {
    const P = p.api.P();
    const bm = /^bag([0-3])$/.exec(slot); if (bm) return unequipBag(p, +bm[1]);
    if (I.SLOTS.indexOf(slot) < 0 || !P.gear[slot]) return;
    if (space(p) <= 0) return sys(p, 'Plecak pełny – zrób miejsce, aby zdjąć przedmiot.');
    P.gbag.push(P.gear[slot]); delete P.gear[slot]; changed(p);
  }
  function spendAttr(p, k, n) {
    const P = p.api.P(); if (!ATTR[k]) return;
    n = Math.max(1, Math.min(10, n | 0));
    const free = attrTotal(P) - attrSpent(P);
    if (free <= 0) return sys(p, 'Nie masz wolnych punktów statystyk – dostaniesz kolejny przy awansie.');
    n = Math.min(n, free); P.attr[k] += n; changed(p);
    sys(p, `${ATTR[k]} +${n} (wolne punkty: ${free - n}).`);
  }
  // reset the stat points at a priest for gold (Margonem lets you redistribute too)
  const resetCost = (P) => Math.max(50, (P.lvl | 0) * 25);
  function resetAttr(p) {
    const P = p.api.P(); if (!attrSpent(P)) return sys(p, 'Nie masz rozdanych punktów.');
    const near = Object.keys(p.api.npcs).some((k) => { const n = p.api.npcs[k]; return n.heal && n.area === P.area && Math.max(Math.abs(n.x - P.x), Math.abs(n.y - P.y)) <= 2; });
    if (!near) return sys(p, 'Punkty statystyk zresetujesz u kapłana w mieście – podejdź do niego.');
    const c = resetCost(P); if (P.gold < c) return sys(p, `Reset punktów kosztuje ${c} zł – masz ${P.gold} zł.`);
    P.gold -= c; P.attr = { str: 0, agi: 0, int: 0 }; changed(p); sys(p, `Kapłan przywraca twoje punkty statystyk (${c} zł). Rozdaj je ponownie w oknie ekwipunku.`);
  }
  // death penalty: every worn item loses durability (broken items give no stats until repaired)
  function deathWear(p) {
    const P = p.api.P(); if (p.api.pl) p.api.pl.wear = 0; if (!P.gear) return [];
    const broke = [];
    for (const sl of Object.keys(P.gear)) { const it = P.gear[sl]; if (!it) continue; const was = I.durOf(it); I.wear(it, I.DUR_LOSS); if (was > 0 && it.d === 0) broke.push(it.n); }
    p.srv.dirty = true; changed(p);
    sys(p, broke.length ? `⚒ Twój ekwipunek traci wytrzymałość. Zepsute (nie dają statystyk): ${broke.join(', ')}. Napraw je u kowala.` : `⚒ Założony ekwipunek traci ${I.DUR_LOSS} pkt wytrzymałości. Napraw go u kowala w mieście.`);
    return broke;
  }
  function view(p) {
    const P = p.api.P(), now = Date.now();
    return { t: 'gear', gear: P.gear, bag: P.gbag, bags: P.bags, max: capOf(P), used: usedOf(P), st: p.api.stats(), gold: P.gold, lvl: P.lvl, cls: P.cls, inv: P.inv,
      attr: P.attr, pts: attrTotal(P) - attrSpent(P), rc: resetCost(P), ah: !!P.ah,
      ground: (p.ground || []).map((g) => ({ it: g.it, s: Math.max(0, Math.round((g.exp - now) / 1000)) })) };
  }
  function push(p) { const v = view(p); const s = JSON.stringify(Object.assign({}, v, { ground: v.ground.map((g) => g.it.u) })); if (s !== p.lastGear) { p.lastGear = s; world.send(p, v); } }
  return {
    name: 'gear', BAG, ATTR, deathWear, give, take, find, findAny, countMat, useMat, space, cap, ensure, changed, toGround, spendAttr,
    onJoin(p) { ensure(p); p.gearDirty = true; },
    onTick() {
      for (const p of world.players.values()) {
        if (p.bot) continue;
        const P = p.api.P();
        if (p.api.pl && p.api.pl.wear) deathWear(p); // set by the engine on every death
        if (p.ground && p.ground.length && (p.groundT || 0) < Date.now() - 500) { p.groundT = Date.now(); pickGround(p); }
        // shop / quest weapons and armour land in the old item list – move them into the equipment bag (same capacity)
        for (let i = P.inv.length - 1; i >= 0; i--) {
          const s = P.inv[i], def = p.api.items[s.id];
          if (def && (def.t === 'w' || def.t === 'a')) {
            const freesSlot = s.n <= 1;
            if (!freesSlot && space(p) <= 0) continue;
            s.n--; if (s.n <= 0) P.inv.splice(i, 1);
            const it = I.fromLegacy(s.id, def, P.cls); if (it) { P.gbag.push(it); changed(p); }
          }
        }
        if (P.eq && P.gear && (P.eq.w !== (P.gear.weapon ? P.gear.weapon.spr || null : null))) sprites(P);
        if (P.cap !== capOf(P)) P.cap = capOf(P);
        if (p.gearDirty || (p.gearT || 0) < Date.now() - 1000) { p.gearDirty = false; p.gearT = Date.now(); push(p); }
      }
    },
    onMsg(p, msg) {
      if (msg.t !== 'gear') return false;
      if (p.battle) { if (msg.a === 'get') { p.lastGear = ''; push(p); } else if (msg.a === 'ah') { p.api.P().ah = !!msg.on; p.srv.dirty = true; p.lastGear = ''; push(p); } return true; }
      const u = typeof msg.u === 'string' && U_RE.test(msg.u) ? msg.u : null;
      if (msg.a === 'equip' && u) equip(p, u);
      else if (msg.a === 'unequip' && typeof msg.slot === 'string') unequip(p, msg.slot);
      else if (msg.a === 'sell') sys(p, 'Przedmioty sprzedasz tylko u handlarza w mieście – poszukaj go i porozmawiaj z nim.');
      else if (msg.a === 'drop' && u) { const it = take(p, u); if (it) sys(p, `Wyrzucono: ${it.n}.`); }
      else if (msg.a === 'attr' && typeof msg.k === 'string') spendAttr(p, msg.k, msg.n);
      else if (msg.a === 'attrReset') resetAttr(p);
      else if (msg.a === 'ah') { p.api.P().ah = !!msg.on; p.srv.dirty = true; sys(p, msg.on ? 'Leczenie po walce włączone – po wygranej walce wypijesz mikstury, aby uzupełnić życie.' : 'Leczenie po walce wyłączone.'); }
      else if (msg.a === 'get') p.lastGear = '';
      p.lastGear = ''; push(p);
      return true;
    },
  };
}
module.exports = { createGear, BAG };
