'use strict';
// Daily quests (3 random per day, reset at midnight Europe/Warsaw) and the 7-day login reward calendar.
const I = require('./items');
const { dayKey, msToMidnight } = require('./dungeon');
const LOGIN = [
  { d: 1, n: '30 zł i 2 małe mikstury', gold: 30, items: [['pot', 2]] },
  { d: 2, n: '3× ziele, 3× ruda', mats: [['herb', 3], ['ore', 3]] },
  { d: 3, n: '60 zł', gold: 60 },
  { d: 4, n: '2 duże mikstury', items: [['bigpot', 2]] },
  { d: 5, n: 'Kryształ mgły', mats: [['crystal', 1]] },
  { d: 6, n: '100 zł i 3 mikstury many', gold: 100, items: [['mpot', 3]] },
  { d: 7, n: 'Unikatowy przedmiot i 150 zł', gold: 150, gear: true },
];
function rng(seed) { let h = 2166136261; for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const yesterday = () => dayKey(new Date(Date.now() - 864e5));

function createDaily(world) {
  const sys = (p, t) => world.chat.sys(p, t);
  function gen(p, day) {
    const P = p.api.P(), L = P.lvl, R = rng(p.ckey + ':' + day), mon = p.api.mon;
    const kinds = Object.keys(mon).filter((k) => !mon[k].boss && mon[k].lvl >= L - 3 && mon[k].lvl <= L + 2);
    const T = [
      () => ({ k: 'kill', need: 5 + Math.floor(L / 3), min: Math.max(1, L - 4), txt: `Pokonaj ${5 + Math.floor(L / 3)} potworów (poziom ${Math.max(1, L - 4)}+)` }),
      () => { const m = kinds.length ? kinds[Math.floor(R() * kinds.length)] : 'rat'; const n = 3 + Math.floor(R() * 3); return { k: 'hunt', m, need: n, txt: `Upoluj ${n}× ${mon[m].n}` }; },
      () => { const m = ['herb', 'ore', 'wood'][Math.floor(R() * 3)]; const n = 4 + Math.floor(R() * 3); return { k: 'gather', m, need: n, txt: `Zbierz ${n}× ${I.MATS[m].n}` }; },
      () => ({ k: 'craft', need: 2, txt: 'Wytwórz lub ulepsz 2 rzeczy u kowala albo alchemika' }),
      () => ({ k: 'win', need: 4, txt: 'Wygraj 4 walki' }),
      () => ({ k: 'pvp', need: 1, txt: 'Stocz pojedynek na arenie PvP' }),
      () => ({ k: 'market', need: 1, txt: 'Wystaw przedmiot na rynku' }),
    ];
    if (L >= 4) T.push(() => ({ k: 'elite', need: 2, txt: 'Pokonaj 2 elitarne potwory (np. w lochach)' }));
    const pick = []; const idx = T.map((_, i) => i);
    while (pick.length < 3 && idx.length) pick.push(idx.splice(Math.floor(R() * idx.length), 1)[0]);
    return pick.map((i, n) => Object.assign(T[i](), { i: n, have: 0, done: false, got: false, xp: Math.round(20 + 14 * L + L * L * 1.6), gold: 10 + 5 * L }));
  }
  function ensure(p) {
    const P = p.api.P(), d = dayKey();
    if (!P.daily || P.daily.d !== d) { P.daily = { d, q: gen(p, d) }; p.srv.dirty = true; p.dqDirty = true; }
    const L = P.login = P.login && typeof P.login === 'object' ? P.login : { last: '', streak: 0, got: '' };
    if (L.last !== d) { L.streak = L.last === yesterday() ? (L.streak % 7) + 1 : 1; L.last = d; p.srv.dirty = true; p.dqDirty = true; world.emit('onEvent', p, 'login', { streak: L.streak }); }
  }
  function view(p) {
    const P = p.api.P();
    return { t: 'dq', d: P.daily.d, q: P.daily.q, reset: msToMidnight(), login: { streak: P.login.streak, got: P.login.got === P.daily.d, days: LOGIN } };
  }
  function progress(p, k, f, n) {
    const P = p.api.P(); if (!P.daily) return;
    for (const q of P.daily.q) { if (q.done || q.k !== k || !f(q)) continue; q.have = Math.min(q.need, q.have + (n || 1)); if (q.have >= q.need) { q.done = true; sys(p, `✔ Zadanie dzienne wykonane: ${q.txt}. Odbierz nagrodę w oknie zadań (J).`); } p.dqDirty = true; p.srv.dirty = true; }
  }
  return {
    name: 'daily', LOGIN, ensure,
    onJoin(p) { ensure(p); p.dqDirty = true; },
    onEvent(p, type, d) {
      if (p.bot) return;
      if (type === 'kill') { progress(p, 'kill', (q) => d.lvl >= q.min); progress(p, 'hunt', (q) => q.m === d.k); if (d.elite || d.boss) progress(p, 'elite', () => true); }
      else if (type === 'win') progress(p, 'win', () => true);
      else if (type === 'gather') progress(p, 'gather', (q) => q.m === d.k, d.q);
      else if (type === 'craft') progress(p, 'craft', () => true, d.n || 1);
      else if (type === 'pvp') progress(p, 'pvp', () => true);
      else if (type === 'list') progress(p, 'market', () => true);
    },
    onTick() {
      for (const p of world.players.values()) {
        if (p.bot) continue;
        if (!p.dqT || Date.now() - p.dqT > 15000) { p.dqT = Date.now(); ensure(p); }
        if (p.dqDirty) { p.dqDirty = false; world.send(p, view(p)); }
      }
    },
    onMsg(p, msg) {
      if (msg.t !== 'dq') return false;
      ensure(p);
      const P = p.api.P();
      if (msg.a === 'claim' && Number.isInteger(msg.i)) {
        const q = P.daily.q[msg.i];
        if (q && q.done && !q.got) {
          q.got = true; P.gold += q.gold; p.api.gainXp(q.xp); world.gear.give(p, [I.mat(['herb', 'ore', 'wood'][msg.i % 3], 2)]);
          sys(p, `Nagroda za zadanie dzienne: +${q.xp} PD, +${q.gold} zł i materiały.`); world.emit('onEvent', p, 'daily', {}); p.srv.dirty = true;
        }
      } else if (msg.a === 'login') {
        if (P.login.got !== P.daily.d) {
          const r = LOGIN[(P.login.streak - 1) % 7]; P.login.got = P.daily.d;
          if (r.gold) P.gold += r.gold;
          for (const [id, n] of r.items || []) p.api.addItem(id, n);
          if (r.mats) world.gear.give(p, r.mats.map(([k, n]) => I.mat(k, n)));
          if (r.gear) { const it = I.randomItem(P.lvl, 1); if (it.r < 1) { it.r = 1; } world.gear.give(p, [it]); }
          sys(p, `🎁 Nagroda za ${P.login.streak}. dzień logowania: ${r.n}.`); p.srv.dirty = true; world.gear.changed(p);
        }
      }
      p.dqDirty = true;
      return true;
    },
  };
}
module.exports = { createDaily, LOGIN };
