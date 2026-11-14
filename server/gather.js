'use strict';
// World objects: gathering nodes (zioła, ruda, drewno) and dungeon gates. Positions are fixed per map (seeded),
// nodes respawn after being harvested. Harvest with E / the "Zbierz" button when standing next to a node.
const I = require('./items');
const PLAN = {
  village: { herb: 3, wood: 2, ore: 1 }, forest: { herb: 4, wood: 4, ore: 2 }, cave: { ore: 5, herb: 1 },
  swamp: { herb: 5, wood: 2 }, town: { herb: 2, ore: 1 }, mount: { ore: 4, wood: 2, herb: 1 }, desert: { ore: 3, herb: 2 },
};
const KIND_N = { herb: 'Krzew ziół', ore: 'Żyła rudy', wood: 'Powalone drzewo', gate: 'Wejście do lochu' };
const RESPAWN = [45, 90]; // seconds
const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
function rng(seed) { let h = 2166136261; for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function createGather(world) {
  const objs = {}; const ver = {}; let built = false, nextId = 1;
  const sys = (p, t) => world.chat.sys(p, t);
  const taken = (a, x, y) => (objs[a] || []).some((o) => cheb(o.x, o.y, x, y) <= 1);
  function free(api, a, x, y, pvpOk) {
    const A = api.areas[a];
    if (x < 3 || y < 3 || x > A.w - 4 || y > A.h - 4) return false;
    if (api.solid(a, x, y)) return false;
    let n = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!api.solid(a, x + dx, y + dy)) n++;
    if (n < 4) return false;
    if (!pvpOk && api.pvpAt(a, x, y)) return false;
    for (const k of Object.keys(api.npcs)) { const q = api.npcs[k]; if (q.area === a && cheb(q.x, q.y, x, y) <= 2) return false; }
    return !taken(a, x, y);
  }
  // first free tile spiralling out from (x, y)
  function near(api, a, x, y) {
    for (let r = 0; r < 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      if (free(api, a, x + dx, y + dy, true)) return [x + dx, y + dy];
    }
    return null;
  }
  function build(api) {
    if (built) return; built = true;
    for (const a of Object.keys(PLAN)) {
      objs[a] = objs[a] || []; ver[a] = 1;
      const A = api.areas[a]; if (!A) continue;
      for (const k of Object.keys(PLAN[a])) {
        const R = rng(a + ':' + k);
        for (let n = 0, tries = 0; n < PLAN[a][k] && tries < 400; tries++) {
          const x = 3 + Math.floor(R() * (A.w - 6)), y = 3 + Math.floor(R() * (A.h - 6));
          if (!free(api, a, x, y)) continue;
          objs[a].push({ i: 'o' + nextId++, k, a, x, y, rt: 0 }); n++;
        }
      }
    }
  }
  function add(api, a, x, y, o) {
    build(api);
    const pos = near(api, a, x, y); if (!pos) return null;
    const ob = Object.assign({ i: 'o' + nextId++, a, x: pos[0], y: pos[1], rt: 0 }, o);
    (objs[a] = objs[a] || []).push(ob); ver[a] = (ver[a] || 0) + 1;
    return ob;
  }
  const view = (o, now) => ({ i: o.i, k: o.k, a: o.a, x: o.x, y: o.y, r: o.rt > now ? 0 : 1, n: o.n || KIND_N[o.k], dg: o.dg || undefined, lv: o.lv || undefined });
  function byId(id) { for (const a of Object.keys(objs)) for (const o of objs[a]) if (o.i === id) return o; return null; }
  function harvest(p, o) {
    const now = Date.now();
    if (o.rt > now) return sys(p, `${KIND_N[o.k]} jeszcze nie odrósł. Wróć za ${Math.ceil((o.rt - now) / 1000)} s.`);
    const P = p.api.P(), R = Math.random;
    const lvlBonus = P.lvl >= 10 ? 1 : 0;
    const q = 1 + (R() < 0.45 ? 1 : 0) + lvlBonus;
    const got = [I.mat(o.k, q)];
    if ((o.a === 'cave' || o.a === 'mount' || o.a === 'desert') && R() < 0.06) got.push(I.mat('crystal', 1));
    const ok = world.gear.give(p, got);
    if (!ok.length) return;
    o.rt = now + (RESPAWN[0] + R() * (RESPAWN[1] - RESPAWN[0])) * 1000; ver[o.a]++;
    sys(p, `Zebrano: ${ok.map((x) => `${x.n} ×${x.q}`).join(', ')}.`);
    world.emit('onEvent', p, 'gather', { k: o.k, q });
  }
  function use(p, o) {
    if (!o || p.battle || p.dg) return false;
    const P = p.api.P(); if (o.a !== P.area) return false;
    const d = cheb(o.x, o.y, P.x, P.y);
    if (o.k === 'gate') { if (d > 2) { sys(p, `Podejdź do wejścia: ${o.n}.`); return true; } if (world.dungeons) world.dungeons.atGate(p, o); return true; }
    if (d > 1) { sys(p, `Podejdź bliżej (${KIND_N[o.k]}).`); return true; }
    harvest(p, o); return true;
  }
  return {
    name: 'gather', objs, add, byId, use, KIND_N,
    // E / talk next to an object: harvest or open the dungeon entrance
    useNear(p) {
      const P = p.api.P(); let best = null, bd = 9;
      for (const o of objs[P.area] || []) { const d = cheb(o.x, o.y, P.x, P.y); if (d <= (o.k === 'gate' ? 2 : 1) && d < bd) { bd = d; best = o; } }
      return best ? use(p, best) : false;
    },
    onJoin(p) { build(p.api); p.obKey = ''; },
    onTick() {
      const now = Date.now();
      for (const a of Object.keys(objs)) for (const o of objs[a]) if (o.rt && o.rt <= now) { o.rt = 0; ver[a]++; }
      for (const p of world.players.values()) {
        if (p.bot) continue;
        const a = p.api.P().area, key = a + ':' + (ver[a] || 0);
        if (p.obKey === key) continue;
        p.obKey = key; world.send(p, { t: 'ob', a, l: (objs[a] || []).map((o) => view(o, now)) });
      }
    },
    onMsg(p, msg) {
      if (msg.t !== 'ob') return false;
      if (msg.a === 'use' && typeof msg.i === 'string') use(p, byId(msg.i));
      return true;
    },
  };
}
module.exports = { createGather };
