'use strict';
// Crafting at NPCs: blacksmiths forge gear and upgrade items (+1..+5), alchemists brew potions.
// Materials (zioła, ruda, drewno, kryształ mgły) come from gathering nodes and dungeons.
const I = require('./items');
const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
const NPC = { kowal: 'smith', platnerz: 'smith', alchemik: 'alch', zielarka: 'alch', portsmith: 'smith', fortsmith: 'smith', citsmith: 'smith', portalch: 'alch', fortalch: 'alch', citalch: 'alch', starsmith: 'smith', staralch: 'alch' };
const ALCH = [
  { id: 'pot', n: 'Mała mikstura', need: { herb: 2 }, gold: 3 },
  { id: 'mpot', n: 'Mikstura many', need: { herb: 2, wood: 1 }, gold: 5 },
  { id: 'bigpot', n: 'Duża mikstura', need: { herb: 4, ore: 1 }, gold: 12 },
  { id: 'elix', n: 'Eliksir życia', need: { herb: 5, crystal: 1 }, gold: 30 },
  { id: 'gpot', n: 'Wielka mikstura', need: { herb: 8, crystal: 1, ore: 2 }, gold: 60 },
  { id: 'selix', n: 'Eliksir Świtu', need: { herb: 12, crystal: 2 }, gold: 140 },
];
const FORGE = ['weapon', 'offhand', 'helm', 'armor', 'gloves', 'boots', 'ring', 'amulet'];
const U_RE = /^[a-z0-9]{6,24}$/;

function createCraft(world) {
  const sys = (p, t) => world.chat.sys(p, t);
  function nearNpc(p, type) {
    const P = p.api.P();
    for (const k of Object.keys(NPC)) { if (type && NPC[k] !== type) continue; const n = p.api.npcs[k]; if (n && n.area === P.area && cheb(n.x, n.y, P.x, P.y) <= 3) return k; }
    return null;
  }
  const mats = (p) => { const o = {}; for (const k of Object.keys(I.MATS)) o[k] = world.gear.countMat(p, k); return o; };
  const has = (p, need, gold) => { const m = mats(p); for (const k of Object.keys(need)) if ((need[k] || 0) > m[k]) return false; return p.api.P().gold >= (gold || 0); };
  function pay(p, need, gold) { for (const k of Object.keys(need)) if (need[k]) world.gear.useMat(p, k, need[k]); p.api.P().gold -= gold || 0; p.srv.dirty = true; }
  function view(p, type, npc) {
    const P = p.api.P();
    const v = { t: 'craft', open: type, npc: npc ? p.api.npcs[npc].n : '', gold: P.gold, mats: mats(p), matN: Object.fromEntries(Object.keys(I.MATS).map((k) => [k, I.MATS[k].n])) };
    if (type === 'alch') v.recipes = ALCH.map((r) => ({ id: r.id, n: r.n, need: r.need, gold: r.gold, can: has(p, r.need, r.gold), have: p.api.countItem(r.id) }));
    else {
      v.forge = FORGE.map((s) => { const c = I.forgeCost(s, P.lvl); const need = { ore: c.ore, wood: c.wood, herb: c.herb }; return { s, need, gold: c.gold, can: has(p, need, c.gold), tier: I.TIERS[I.tierFor(P.lvl, () => 1)].n }; });
      v.upChance = I.UP_CHANCE; v.upMax = I.UP_MAX;
      const all = Object.keys(P.gear).map((k) => P.gear[k]).concat(P.gbag.filter((x) => x.s !== 'mat'));
      v.up = all.filter(Boolean).map((it) => { const c = I.upCost(it); const need = { ore: c.ore, crystal: c.crystal }; return { u: it.u, up: it.up || 0, need, gold: c.gold, chance: I.UP_CHANCE[it.up || 0] || 0, can: (it.up || 0) < I.UP_MAX && has(p, need, c.gold) }; });
    }
    return v;
  }
  function open(p, type) { const npc = nearNpc(p, type); if (!npc) return false; p.craftOpen = type; world.send(p, view(p, type, npc)); return true; }
  function done(p, type, res) { world.gear.changed(p); world.send(p, Object.assign(view(p, type, nearNpc(p, type)), { res })); }
  return {
    name: 'craft', NPC, ALCH, nearNpc, open,
    // E next to a craft NPC opens the workshop first; "Porozmawiaj" in the window lets the old dialog/shop through
    interceptTalk(p) {
      if (p.craftTalk) { p.craftTalk = false; return false; }
      const npc = nearNpc(p, null); if (!npc) return false;
      const P = p.api.P(), n = p.api.npcs[npc]; if (cheb(n.x, n.y, P.x, P.y) > 1) return false;
      open(p, NPC[npc]); return true;
    },
    onMsg(p, msg) {
      if (msg.t !== 'craft') return false;
      if (p.battle) return true;
      const type = msg.a === 'brew' ? 'alch' : msg.a === 'forge' || msg.a === 'up' ? 'smith' : msg.type === 'alch' ? 'alch' : 'smith';
      if (msg.a === 'open') { if (!open(p, type)) sys(p, 'Podejdź do kowala lub alchemika.'); return true; }
      if (msg.a === 'talk') { p.acts.push({ a: 'talk' }); return true; }
      if (!nearNpc(p, type)) { sys(p, type === 'alch' ? 'Musisz stać przy alchemiku.' : 'Musisz stać przy kowalu.'); return true; }
      const P = p.api.P();
      if (msg.a === 'brew') {
        const r = ALCH.find((x) => x.id === msg.id); if (!r) return true;
        const q = Math.max(1, Math.min(10, msg.q | 0));
        let made = 0; for (let i = 0; i < q && has(p, r.need, r.gold); i++) { pay(p, r.need, r.gold); p.api.addItem(r.id, 1); made++; }
        if (!made) { sys(p, 'Brakuje składników lub złota.'); done(p, 'alch', { ok: false, txt: 'Brakuje składników lub złota.' }); return true; }
        sys(p, `Uwarzono: ${r.n} ×${made}.`); world.emit('onEvent', p, 'craft', { n: made });
        done(p, 'alch', { ok: true, txt: `${r.n} ×${made}` });
      } else if (msg.a === 'forge') {
        if (FORGE.indexOf(msg.s) < 0) return true;
        const c = I.forgeCost(msg.s, P.lvl), need = { ore: c.ore, wood: c.wood, herb: c.herb };
        if (!has(p, need, c.gold)) { sys(p, 'Brakuje materiałów lub złota.'); done(p, 'smith', { ok: false, txt: 'Brakuje materiałów lub złota.' }); return true; }
        if (world.gear.space(p) <= 0) { sys(p, 'Torba jest pełna!'); return true; }
        const it = I.forge(msg.s, P.cls, P.lvl); if (!it) return true;
        pay(p, need, c.gold); world.gear.give(p, [it]);
        sys(p, `Kowal wykuł: ${it.n} (${I.RAR[it.r].n}).`); world.emit('onEvent', p, 'craft', { n: 1 });
        done(p, 'smith', { ok: true, it, txt: 'Wykuto: ' + it.n });
      } else if (msg.a === 'up') {
        const u = typeof msg.u === 'string' && U_RE.test(msg.u) ? msg.u : null; const it = u && world.gear.findAny(p, u);
        if (!it || it.s === 'mat') return true;
        const n = it.up || 0; if (n >= I.UP_MAX) { sys(p, 'Ten przedmiot ma już maksymalne ulepszenie (+5).'); return true; }
        const c = I.upCost(it), need = { ore: c.ore, crystal: c.crystal };
        if (!has(p, need, c.gold)) { sys(p, 'Brakuje materiałów lub złota.'); done(p, 'smith', { ok: false, txt: 'Brakuje materiałów lub złota.' }); return true; }
        pay(p, need, c.gold);
        const ok = Math.random() < I.UP_CHANCE[n];
        if (ok) { I.applyUp(it, n + 1); sys(p, `✨ Ulepszenie udane: ${it.n}!`); world.emit('onEvent', p, 'craft', { n: 1, up: n + 1 }); }
        else sys(p, `Ulepszenie nieudane – materiały przepadły, ale ${it.n} jest cały.`);
        done(p, 'smith', { ok, up: true, it, txt: ok ? `Udało się! ${it.n}` : `Nie udało się (szansa ${Math.round(I.UP_CHANCE[n] * 100)}%). Przedmiot pozostaje +${n}.` });
      }
      return true;
    },
  };
}
module.exports = { createCraft, NPC, ALCH };
