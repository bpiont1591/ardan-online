'use strict';
// Kupcy i aukcjonerzy: przedmioty sprzedaje się wyłącznie u NPC w miastach.
//  - "skup"   (Handlarz)   – odkupuje ekwipunek za połowę wartości i łupy (trofea) z torby,
//  - "aukcja" (Aukcjoner)  – dom aukcyjny: wystawianie, kupowanie i wycofywanie ofert graczy.
// Serwer zawsze sprawdza, czy gracz stoi przy właściwym NPC (ta sama kraina, odległość ≤ RANGE pól).
const RANGE = 2;
const U_RE = /^[a-z0-9]{6,24}$/;
const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

function createMerchant(world) {
  const sys = (p, t) => world.chat.sys(p, t);
  let list = null;
  const npcs = (api) => { if (!list) list = Object.keys(api.npcs).filter((k) => api.npcs[k].trade).map((k) => Object.assign({ id: k }, api.npcs[k])); return list; };
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
    return { t: 'npcui', k: 'skup', npc: n.id, n: n.n, area: P.area, gold: P.gold, bag: P.gbag.map((it) => ({ u: it.u, pr: price(it) })), junk: j };
  }
  function open(p, type, quiet) {
    const n = near(p, type);
    if (!n) { if (!quiet) sys(p, type === 'aukcja' ? `Dom aukcyjny prowadzą aukcjonerzy w miastach: ${where(p.api, 'aukcja')}. Podejdź do jednego z nich.` : `Przedmioty odkupują handlarze w miastach: ${where(p.api, 'skup')}. Podejdź do jednego z nich.`); return false; }
    p.npcOpen = n.trade; p.npcId = n.id;
    if (n.trade === 'aukcja') { world.market.open(p, n); return true; }
    world.send(p, view(p, n)); return true;
  }
  function close(p, why) { if (!p.npcOpen) return; const k = p.npcOpen; p.npcOpen = null; p.npcId = null; world.send(p, { t: 'npcui', k, closed: true }); if (why) sys(p, why); }
  function sellGear(p, n, us) {
    let cnt = 0, sum = 0;
    world.atomic([p], () => {
      for (const u of us) { const it = world.gear.take(p, u); if (!it) continue; const pr = price(it); p.api.P().gold += pr; cnt++; sum += pr; }
    });
    if (cnt === 1) sys(p, `${n.n} odkupuje przedmiot za ${sum} zł.`); else if (cnt) sys(p, `${n.n} odkupuje ${cnt} przedmiotów za ${sum} zł.`);
    if (cnt) { p.srv.dirty = true; world.gear.changed(p); }
    return cnt;
  }
  function sellJunk(p, n) {
    const api = p.api, P = api.P(); let sum = 0, cnt = 0;
    world.atomic([p], () => { for (let i = P.inv.length - 1; i >= 0; i--) { const s = P.inv[i], d = api.items[s.id]; if (d && d.t === 'j') { sum += Math.max(1, Math.floor(d.price / 2)) * s.n; cnt += s.n; P.inv.splice(i, 1); } } P.gold += sum; });
    if (cnt) { p.srv.dirty = true; sys(p, `${n.n} odkupuje łupy (${cnt} szt.) za ${sum} zł.`); } else sys(p, 'Nie masz łupów na sprzedaż.');
  }
  return {
    name: 'merchant', RANGE, near, open, close, where, price,
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
      if (msg.a === 'open') { open(p, msg.k === 'aukcja' ? 'aukcja' : msg.k === 'skup' ? 'skup' : null); return true; }
      if (msg.a === 'close') { close(p); return true; }
      const n = near(p, 'skup');
      if (!n) { close(p); sys(p, `Sprzedawać możesz tylko u handlarza (${where(p.api, 'skup')}). Podejdź do niego.`); world.send(p, { t: 'npcui', k: 'skup', closed: true, err: 'far' }); return true; }
      p.npcOpen = 'skup'; p.npcId = n.id;
      if (msg.a === 'sell' && typeof msg.u === 'string' && U_RE.test(msg.u)) sellGear(p, n, [msg.u]);
      else if (msg.a === 'sellmany' && Array.isArray(msg.us)) sellGear(p, n, msg.us.slice(0, 40).filter((u) => typeof u === 'string' && U_RE.test(u)));
      else if (msg.a === 'junk') sellJunk(p, n);
      world.send(p, view(p, n));
      return true;
    },
  };
}
const AREA_N = { village: 'Osada Brzozowa', town: 'Srebrnogród', port: 'Mewia Przystań', fort: 'Twierdza Żarogród', citadel: 'Cytadela Świtu', star: 'Gwiezdna Strażnica' };
module.exports = { createMerchant, RANGE };
