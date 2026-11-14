'use strict';
// Party dungeons (lochy): instanced per party, several rooms with stationary elite groups and a final boss
// with special turn-based mechanics. Entrance gates stand on the world map. One clear per day per character.
const I = require('./items');
const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
const PULL_RANGE = 12;
function dayKey(d) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d || new Date()); }
function msToMidnight() {
  const now = new Date(), k = dayKey(now);
  let lo = 0, hi = 26 * 3600e3;
  while (hi - lo > 1000) { const mid = (lo + hi) / 2; if (dayKey(new Date(now.getTime() + mid)) === k) lo = mid; else hi = mid; }
  return Math.round(hi);
}
// rooms: list of groups; each group: list of [monster key, count]; positions on the room grid (11 x 7)
const DUNGEONS = {
  goblin: {
    id: 'goblin', n: 'Nora Goblinów', area: 'forest', at: [38, 20], lv: [4, 8], lvl: 6,
    rooms: [
      { n: 'Wilcze legowisko', g: [{ m: [['wolf', 2]], x: 3, y: 2 }, { m: [['boar', 1]], x: 7, y: 4 }] },
      { n: 'Skład łupów', g: [{ m: [['goblin', 1], ['wolf', 1]], x: 3, y: 3 }, { m: [['boar', 2]], x: 7, y: 2 }] },
      { n: 'Sala wodza', boss: true, g: [{ m: [['B', 1]], x: 5, y: 2 }] },
    ],
    boss: { base: 'goblin', n: 'Wódz Grzmot', lvl: 9, hp: 820, atk: 18, def: 7, xp: 800, gold: [120, 200], mech: ['summon', 'enrage'], summon: 'goblin', sc: 1.5 },
  },
  crypt: {
    id: 'crypt', n: 'Zatopiona Krypta', area: 'swamp', at: [24, 30], lv: [10, 15], lvl: 12,
    rooms: [
      { n: 'Zalany przedsionek', g: [{ m: [['drowner', 2]], x: 3, y: 2 }, { m: [['wisp', 2]], x: 7, y: 4 }] },
      { n: 'Kaplica ogników', g: [{ m: [['wisp', 1], ['drowner', 1]], x: 2, y: 4 }, { m: [['troll', 1]], x: 8, y: 2 }] },
      { n: 'Ossuarium', g: [{ m: [['skel', 2], ['wisp', 1]], x: 5, y: 3 }] },
      { n: 'Tron Topieli', boss: true, g: [{ m: [['B', 1]], x: 5, y: 2 }] },
    ],
    boss: { base: 'drowner', n: 'Pani Topieli', lvl: 16, hp: 2600, atk: 38, def: 15, xp: 2600, gold: [300, 450], mech: ['drain', 'shield'], sc: 1.5 },
  },
  tomb: {
    id: 'tomb', n: 'Grobowiec Sethara', area: 'desert', at: [36, 20], lv: [18, 24], lvl: 21,
    rooms: [
      { n: 'Korytarz skorpionów', g: [{ m: [['scorp', 2]], x: 3, y: 3 }, { m: [['scorp', 1], ['mummy', 1]], x: 8, y: 2 }] },
      { n: 'Komnata balsamistów', g: [{ m: [['mummy', 2]], x: 3, y: 2 }, { m: [['golem', 1]], x: 7, y: 4 }] },
      { n: 'Skarbiec strażników', g: [{ m: [['golem', 1], ['mummy', 1]], x: 5, y: 3 }] },
      { n: 'Sanktuarium Anubheta', boss: true, g: [{ m: [['B', 1]], x: 5, y: 2 }] },
    ],
    boss: { base: 'mummy', n: 'Arcykapłan Anubhet', lvl: 25, hp: 5600, atk: 60, def: 27, xp: 7000, gold: [800, 1200], mech: ['summon', 'curse', 'enrage'], summon: 'mummy', sc: 1.6 },
  },
};
const MECH_N = { summon: 'przyzywa posiłki co 3 tury', enrage: 'poniżej 35% życia wpada w szał', drain: 'wysysa życie co 2 tury', shield: 'przy 60% i 30% życia osłania się tarczą', curse: 'rzuca klątwę płomieni na całą drużynę' };

function createDungeons(world) {
  const inst = new Map(); let nextId = 1;
  const sys = (p, t) => world.chat.sys(p, t);
  const gates = {};
  function elite(api, k, weak) {
    const d0 = api.mon[k];
    const d = Object.assign({}, d0, { n: d0.n + (weak ? '' : ' – elita'), hp: Math.round(d0.hp * (weak ? 1.2 : 2.3)), atk: Math.round(d0.atk * (weak ? 1 : 1.25)), def: Math.round(d0.def * (weak ? 1 : 1.15)),
      lvl: d0.lvl + (weak ? 0 : 2), xp: Math.round(d0.xp * (weak ? 1 : 2.6)), gold: [Math.round(d0.gold[0] * 2), Math.round(d0.gold[1] * 2.5)], drops: [], resp: 0 });
    return { k, d, hp: d.hp, x: 0, y: 0, fx: 0, fy: 0, mt: 1, dir: 0, dead: false, elite: !weak };
  }
  function boss(api, D) {
    const B = D.boss, d0 = api.mon[B.base];
    const d = Object.assign({}, d0, { n: B.n, lvl: B.lvl, hp: B.hp, atk: B.atk, def: B.def, xp: B.xp, gold: B.gold, boss: true, drops: [], resp: 0, sc: B.sc });
    const o = { k: B.base, d, hp: d.hp, x: 0, y: 0, fx: 0, fy: 0, mt: 1, dir: 0, dead: false, mech: B.mech };
    if (B.summon) o.summon = () => elite(api, B.summon, true);
    return o;
  }
  const P = (p) => p.api.P();
  const locked = (p, id) => (P(p).dgLock || {})[id] === dayKey();
  function members(x) { return [...x.m].map((pid) => world.players.get(pid)).filter((q) => q && q.dg === x); }
  function state(x, p) {
    const D = x.D, R = D.rooms[x.room], api = p.api;
    const groups = R.g.map((g, gi) => ({ i: gi, x: g.x, y: g.y, done: !!x.done[x.room][gi], busy: !!x.busy[gi + ':' + x.room],
      foes: g.m.flatMap(([k, n]) => Array.from({ length: n }, () => (k === 'B' ? { k: D.boss.base, n: D.boss.n, lvl: D.boss.lvl, boss: true, sc: D.boss.sc } : { k, n: api.mon[k].n + ' – elita', lvl: api.mon[k].lvl + 2, elite: true }))) }));
    return { t: 'dg', in: true, id: D.id, n: D.n, lv: D.lv, room: x.room, rooms: D.rooms.map((r, i) => ({ n: r.n, boss: !!r.boss, done: x.done[i].every(Boolean) })), rn: R.n, boss: !!R.boss,
      groups, cleared: x.done[x.room].every(Boolean), last: x.room === D.rooms.length - 1, fin: x.fin, mech: D.boss.mech.map((m) => MECH_N[m]), bn: D.boss.n,
      party: members(x).map((q) => ({ n: q.nick, c: P(q).cls, l: P(q).lvl, hp: Math.round(P(q).hp), mh: q.api.maxHp(), bt: !!q.battle })), loot: x.loot[p.pid] || null };
  }
  function push(x) { for (const q of members(x)) world.send(q, state(x, q)); }
  function leave(p, why) {
    const x = p.dg; if (!x) return;
    p.dg = null; x.m.delete(p.pid);
    world.send(p, { t: 'dg', in: false });
    if (why) sys(p, why);
    if (!members(x).length) inst.delete(x.id); else { for (const q of members(x)) sys(q, `${p.nick} opuszcza loch.`); push(x); }
  }
  // standing at a gate: show the entry window
  function atGate(p, o) {
    const D = DUNGEONS[o.dg]; if (!D) return;
    const party = p.partyId && world.parties ? world.parties.parties.get(p.partyId) : null;
    const near = party ? [...party.members].map((pid) => world.players.get(pid)).filter((q) => q && P(q).area === P(p).area && cheb(P(q).x, P(q).y, o.x, o.y) <= PULL_RANGE) : [p];
    const active = [...inst.values()].find((x) => x.D === D && x.key === (p.partyId || p.pid));
    world.send(p, { t: 'dg', gate: true, id: D.id, n: D.n, lv: D.lv, rooms: D.rooms.length, bn: D.boss.n, mech: D.boss.mech.map((m) => MECH_N[m]), locked: locked(p, D.id), reset: msToMidnight(),
      party: near.map((q) => ({ n: q.nick, l: P(q).lvl, c: P(q).cls, locked: locked(q, D.id) })), solo: !party, active: !!active, lvl: P(p).lvl });
  }
  function enter(p, id) {
    const D = DUNGEONS[id]; if (!D || p.dg || p.battle) return;
    const g = gates[id]; if (!g || P(p).area !== g.a || cheb(P(p).x, P(p).y, g.x, g.y) > 2) return sys(p, 'Musisz stać przy wejściu do lochu.');
    if (locked(p, id)) return sys(p, `Ukończyłeś już dziś „${D.n}”. Loch odnowi się o północy.`);
    const key = p.partyId || p.pid;
    let x = [...inst.values()].find((y) => y.D === D && y.key === key);
    const party = p.partyId && world.parties ? world.parties.parties.get(p.partyId) : null;
    const pull = [p];
    if (!x) {
      x = { id: nextId++, D, key, m: new Set(), room: 0, done: D.rooms.map((r) => r.g.map(() => false)), busy: {}, fin: false, loot: {} };
      inst.set(x.id, x);
      if (party) for (const pid of party.members) { const q = world.players.get(pid); if (!q || q === p || q.dg || q.battle) continue; if (P(q).area !== g.a || cheb(P(q).x, P(q).y, g.x, g.y) > PULL_RANGE) continue; if (locked(q, id)) { sys(q, `Ukończyłeś już dziś „${D.n}” – nie wchodzisz z drużyną.`); continue; } pull.push(q); }
    }
    for (const q of pull) { q.dg = x; x.m.add(q.pid); q.mx = q.my = 0; q.api.pl.target = null; }
    const names = pull.map((q) => q.nick).join(', ');
    for (const q of members(x)) sys(q, `🕳 ${names} ${pull.length > 1 ? 'wchodzą' : 'wchodzi'} do lochu: ${D.n}.${members(x).length === 1 ? ' Samotna wyprawa będzie trudna!' : ''}`);
    push(x);
  }
  function fight(p, gi) {
    const x = p.dg; if (!x || p.battle) return;
    const D = x.D, R = D.rooms[x.room], g = R.g[gi];
    if (!g || x.done[x.room][gi] || x.busy[gi + ':' + x.room]) return;
    const ps = members(x).filter((q) => !q.battle && q.api.pl.dead <= 0);
    const foes = []; for (const [k, n] of g.m) for (let i = 0; i < n; i++) foes.push(k === 'B' ? boss(p.api, D) : elite(p.api, k));
    const room = x.room, isBoss = !!R.boss;
    x.busy[gi + ':' + room] = true;
    const b = world.battle.startCustom(ps, foes, {
      dg: { id: D.id }, mech: isBoss ? D.boss.mech.map((m) => MECH_N[m]) : null, title: isBoss ? `Walka z bossem – ${D.boss.n}` : `${D.n}, ${R.n}`,
      loot: (mf, cls) => I.rollDungeon(D.lvl + (mf.boss ? 3 : 0), mf.boss ? 4 : mf.add ? 0 : 3, cls),
      onEnd: (bt, won, winners, end) => {
        delete x.busy[gi + ':' + room];
        for (const f of bt.f) if (f.kind === 'p' && end && end[f.id] && end[f.id].loot && end[f.id].loot.length) x.loot[f.p.pid] = (x.loot[f.p.pid] || []).concat(end[f.id].loot).slice(-24);
        for (const f of bt.f) if (f.kind === 'p' && !f.alive && f.p.dg === x) setTimeout(() => leave(f.p, 'Polegasz w lochu – wracasz do świata.'), 0);
        if (won) {
          x.done[room][gi] = true;
          for (const q of winners) world.emit('onEvent', q, 'dgroom', { id: D.id });
          if (isBoss) {
            x.fin = true;
            for (const q of members(x)) { const Q = P(q); Q.dgLock = Q.dgLock || {}; Q.dgLock[D.id] = dayKey(); q.srv.dirty = true; world.emit('onEvent', q, 'dungeon', { id: D.id }); sys(q, `🏆 Loch „${D.n}” ukończony! Wróć jutro po kolejną wyprawę.`); }
          }
        }
        setTimeout(() => push(x), 50);
      },
    });
    if (!b) { delete x.busy[gi + ':' + room]; return; }
    push(x);
  }
  return {
    name: 'dungeons', DUNGEONS, inst, atGate, enter, leave, dayKey, msToMidnight,
    onJoin(p) {
      if (!Object.keys(gates).length && world.gather) for (const id of Object.keys(DUNGEONS)) { const D = DUNGEONS[id]; gates[id] = world.gather.add(p.api, D.area, D.at[0], D.at[1], { k: 'gate', dg: id, n: D.n, lv: D.lv[0] + '–' + D.lv[1] }); }
    },
    onLeave(p) { if (p.dg) leave(p); },
    onTick() {
      for (const x of inst.values()) {
        if (!members(x).length) { inst.delete(x.id); continue; }
        if (!x.t || Date.now() - x.t > 1500) { x.t = Date.now(); push(x); }
      }
    },
    onMsg(p, msg) {
      if (msg.t !== 'dg') return false;
      if (msg.a === 'enter' && typeof msg.id === 'string') enter(p, msg.id);
      else if (msg.a === 'leave') { if (!p.battle) leave(p, 'Opuszczasz loch.'); }
      else if (msg.a === 'fight' && Number.isInteger(msg.g)) fight(p, msg.g);
      else if (msg.a === 'next' && p.dg && !p.battle) { const x = p.dg; if (x.done[x.room].every(Boolean) && x.room < x.D.rooms.length - 1) { x.room++; for (const q of members(x)) { const Q = P(q), mh = q.api.maxHp(); if (q.api.pl.dead <= 0) { Q.hp = Math.min(mh, Math.round(Q.hp + (mh - Q.hp) * 0.6)); Q.mp = Math.max(Q.mp, 9999); q.srv.dirty = true; } sys(q, `Krótki odpoczynek przy pochodni (odzyskujesz siły). Wchodzicie do sali: ${x.D.rooms[x.room].n}.`); } push(x); } }
      else if (msg.a === 'get' && p.dg) world.send(p, state(p.dg, p));
      return true;
    },
  };
}
module.exports = { createDungeons, DUNGEONS, dayKey, msToMidnight };
