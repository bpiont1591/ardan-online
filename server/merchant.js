'use strict';
// Kupcy i aukcjonerzy: przedmioty sprzedaje się wyłącznie u NPC w miastach.
//  - "skup"   (Handlarz)   – odkupuje ekwipunek za połowę wartości i łupy (trofea) z torby,
//  - "aukcja" (Aukcjoner)  – dom aukcyjny: wystawianie, kupowanie i wycofywanie ofert graczy.
//  - "naprawa" (Kowal / Płatnerz) – naprawa wytrzymałości ekwipunku za złoto (runda 7).
// Serwer zawsze sprawdza, czy gracz stoi przy właściwym NPC (ta sama kraina, odległość ≤ RANGE pól).
const RANGE = 2;
const BAG_PRICE = { s: 80, m: 320, l: 1200 };
const U_RE = /^[a-z0-9]{6,24}$/;
const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
const I = require('./items');

function createMerchant(world) {
  const sys = (p, t) => world.chat.sys(p, t);
  let list = null;
  // every trade NPC with its kind: skup / aukcja (from the NPC data) or naprawa (blacksmiths with rep: 1)
  const npcs = (api) => { if (!list) list = Object.keys(api.npcs).filter((k) => api.npcs[k].trade || api.npcs[k].rep).map((k) => Object.assign({ id: k }, api.npcs[k], { trade: api.npcs[k].trade || 'naprawa' })); return list; };
  // nearest trade NPC of the given type the player is standing next to (or null)
  function near(p, type) {
    const P = p.api.P();
    for (const n of npcs(p.api)) if ((!type || n.trade === type) && n.area === P.area && cheb(n.x, n.y, P.x, P.y) <= RANGE) return n;
    return null;
  }
  // human-readable list of where to find NPCs of a type, e.g. "Srebrnogród, Mewia Przystań"
  function where(api, type) {
    const seen = []; for (const n of npcs(api)) if (n.trade === type) { const nm = AREA_N[n.area] || n.area; if (seen.indexOf(nm) < 0) seen.push(nm); }
    return seen.join(', ');
  }
  const price = (it) => Math.max(1, Math.floor((it.v || 0) / 2));
  function junk(p) { const api = p.api, P = api.P(); let n = 0, sum = 0; for (const s of P.inv) { const d = api.items[s.id]; if (d && d.t === 'j') { n += s.n; sum += Math.max(1, Math.floor(d.price / 2)) * s.n; } } return { n, sum }; }
  function view(p, n) {
    const P = p.api.P(), j = junk(p);
    return { t: 'npcui', k: 'skup', npc: n.id, n: n.n, area: P.area, gold: P.gold, bag: P.gbag.map((it) => ({ u: it.u, pr: price(it) })), junk: j,
      bags: Object.keys(BAG_PRICE).map((k) => ({ k, n: I.BAGS[k].n, cap: I.BAGS[k].cap, pr: BAG_PRICE[k], r: I.BAGS[k].r })), free: world.gear.space(p), slots: (P.bags || []).filter((b) => !b).length };
  }
  // ---- repairs (Kowal / Płatnerz): every worn or carried item, cost = I.repairCost
  function repList(p) {
    const P = p.api.P(), out = [];
    for (const sl of Object.keys(P.gear || {})) { const it = P.gear[sl]; if (it && it.s !== 'mat') out.push({ it, sl }); }
    for (const it of P.gbag || []) if (it && it.s !== 'mat' && I.durOf(it) < I.durMax(it)) out.push({ it, sl: null });
    return out;
  }
  function repView(p, n) {
    const P = p.api.P();
    const items = repList(p).map(({ it, sl }) => ({ u: it.u, sl, n: it.n, r: it.r, d: I.durOf(it), dm: I.durMax(it), c: I.repairCost(it) }));
    return { t: 'npcui', k: 'naprawa', npc: n.id, n: n.n, area: P.area, gold: P.gold, items, all: items.reduce((s, x) => s + x.c, 0) };
  }
  function doRepair(p, n, u) {
    const P = p.api.P();
    const todo = repList(p).filter(({ it }) => I.repairCost(it) > 0 && (!u || it.u === u));
    if (!todo.length) return sys(p, u ? 'Ten przedmiot nie wymaga naprawy.' : 'Nic nie wymaga naprawy.');
    const cost = todo.reduce((s, x) => s + I.repairCost(x.it), 0);
    if (P.gold < cost) return sys(p, `Naprawa kosztuje ${cost} zł – masz tylko ${P.gold} zł.`);
    world.atomic([p], () => { P.gold -= cost; for (const { it } of todo) I.repair(it); });
    if (world.log) world.log('trade', 'npc_repair', p, { amount: -cost, detail: `naprawa ${todo.length} przedm.` });
    p.srv.dirty = true; world.gear.changed(p);
    sys(p, todo.length === 1 ? `⚒ ${n.n} naprawia: ${todo[0].it.n} (${cost} zł).` : `⚒ ${n.n} naprawia ${todo.length} przedmiotów za ${cost} zł.`);
  }
  const FAR = { aukcja: 'Dom aukcyjny prowadzą aukcjonerzy w miastach', skup: 'Przedmioty odkupują handlarze w miastach', naprawa: 'Ekwipunek naprawiają kowale i płatnerze w miastach' };
  function open(p, type, quiet) {
    const n = near(p, type);
    if (!n) { if (!quiet) sys(p, `${FAR[type] || FAR.skup}: ${where(p.api, type || 'skup')}. Podejdź do jednego z nich.`); return false; }
    p.npcOpen = n.trade; p.npcId = n.id;
    if (n.trade === 'aukcja') { world.market.open(p, n); return true; }
    if (n.trade === 'naprawa') { world.send(p, repView(p, n)); return true; }
    world.send(p, view(p, n)); return true;
  }
  function close(p, why) { if (!p.npcOpen) return; const k = p.npcOpen; p.npcOpen = null; p.npcId = null; world.send(p, { t: 'npcui', k, closed: true }); if (why) sys(p, why); }
  function sellGear(p, n, us) {
    let cnt = 0, sum = 0;
    world.atomic([p], () => {
      for (const u of us) { const it = world.gear.take(p, u); if (!it) continue; const pr = price(it); p.api.P().gold += pr; cnt++; sum += pr; }
    });
    if (cnt && world.log) world.log('trade', 'npc_sell', p, { amount: sum, detail: `${n.n} odkupuje ${cnt} przedm.` });
    if (cnt === 1) sys(p, `${n.n} odkupuje przedmiot za ${sum} zł.`); else if (cnt) sys(p, `${n.n} odkupuje ${cnt} przedmiotów za ${sum} zł.`);
    if (cnt) { p.srv.dirty = true; world.gear.changed(p); }
    return cnt;
  }
  // round 9: handlarze sprzedają torby (Margonem-like bags)
  function buyBag(p, n, k) {
    const P = p.api.P(); if (!BAG_PRICE[k]) return;
    const pr = BAG_PRICE[k];
    if (P.gold < pr) return sys(p, `${I.BAGS[k].n} kosztuje ${pr} zł – masz ${P.gold} zł.`);
    const slot = (P.bags || []).findIndex((b) => !b);
    if (slot < 0 && world.gear.space(p) <= 0) return sys(p, 'Nie masz wolnego miejsca na torbę ani w plecaku.');
    const it = I.bag(k);
    world.atomic([p], () => { P.gold -= pr; if (slot >= 0) P.bags[slot] = it; else P.gbag.push(it); });
    p.srv.dirty = true; world.gear.changed(p);
    if (world.log) world.log('trade', 'npc_buy', p, { amount: -pr, detail: `${n.n}: ${it.n}` });
    sys(p, slot >= 0 ? `🎒 Kupujesz i zakładasz: ${it.n} (+${it.cap} miejsc) za ${pr} zł.` : `🎒 Kupujesz: ${it.n} za ${pr} zł – leży w plecaku (wszystkie miejsca na torby są zajęte).`);
  }
  function sellJunk(p, n) {
    const api = p.api, P = api.P(); let sum = 0, cnt = 0;
    world.atomic([p], () => { for (let i = P.inv.length - 1; i >= 0; i--) { const s = P.inv[i], d = api.items[s.id]; if (d && d.t === 'j') { sum += Math.max(1, Math.floor(d.price / 2)) * s.n; cnt += s.n; P.inv.splice(i, 1); } } P.gold += sum; });
    if (cnt) { p.srv.dirty = true; sys(p, `${n.n} odkupuje łupy (${cnt} szt.) za ${sum} zł.`); if (world.log) world.log('trade', 'npc_sell', p, { amount: sum, detail: `${n.n}: łupy ×${cnt}` }); } else sys(p, 'Nie masz łupów na sprzedaż.');
  }
  return {
    name: 'merchant', RANGE, near, open, close, where, price, repView,
    list: (api) => npcs(api).map((n) => ({ id: n.id, n: n.n, k: n.trade, area: n.area, x: n.x, y: n.y })),
    onLeave(p) { p.npcOpen = null; },
    onTick() {
      // walking away from the NPC closes the window (and blocks further sales)
      for (const p of world.players.values()) {
        if (!p.npcOpen || p.bot) continue;
        if (p.battle || !near(p, p.npcOpen)) close(p, p.battle ? null : 'Odszedłeś od kupca.');
      }
    },
    onMsg(p, msg) {
      if (msg.t !== 'npc') return false;
      if (p.battle) return true;
      if (msg.a === 'open') { open(p, ['aukcja', 'skup', 'naprawa'].indexOf(msg.k) >= 0 ? msg.k : null); return true; }
      if (msg.a === 'close') { close(p); return true; }
      if (msg.a === 'repair') {
        // repairs only while standing next to a blacksmith (server-checked)
        const n = near(p, 'naprawa');
        if (!n) { if (world.log) world.log('sus', 'range', p, { detail: `naprawa bez kowala w pobliżu (${p.api.P().area})`, throttle: 'rep' }); close(p); sys(p, `Naprawiać ekwipunek możesz tylko u kowala lub płatnerza (${where(p.api, 'naprawa')}). Podejdź do niego.`); world.send(p, { t: 'npcui', k: 'naprawa', closed: true, err: 'far' }); return true; }
        p.npcOpen = 'naprawa'; p.npcId = n.id;
        doRepair(p, n, typeof msg.u === 'string' && U_RE.test(msg.u) ? msg.u : null);
        world.send(p, repView(p, n));
        return true;
      }
      const n = near(p, 'skup');
      if (!n) { if (world.log) world.log('sus', 'range', p, { detail: `${String(msg.a).slice(0, 12)} u handlarza spoza zasięgu (${p.api.P().area} ${p.api.P().x},${p.api.P().y})`, throttle: 'skup' }); close(p); sys(p, `Sprzedawać możesz tylko u handlarza (${where(p.api, 'skup')}). Podejdź do niego.`); world.send(p, { t: 'npcui', k: 'skup', closed: true, err: 'far' }); return true; }
      p.npcOpen = 'skup'; p.npcId = n.id;
      if (msg.a === 'sell' && typeof msg.u === 'string' && U_RE.test(msg.u)) sellGear(p, n, [msg.u]);
      else if (msg.a === 'sellmany' && Array.isArray(msg.us)) sellGear(p, n, msg.us.slice(0, 40).filter((u) => typeof u === 'string' && U_RE.test(u)));
      else if (msg.a === 'junk') sellJunk(p, n);
      else if (msg.a === 'buybag' && typeof msg.k === 'string') buyBag(p, n, msg.k);
      world.send(p, view(p, n));
      return true;
    },
  };
}
const AREA_N = { village: 'Osada Brzozowa', town: 'Srebrnogród', port: 'Mewia Przystań', fort: 'Twierdza Żarogród', citadel: 'Cytadela Świtu', star: 'Gwiezdna Strażnica' };
module.exports = { createMerchant, RANGE, BAG_PRICE };
