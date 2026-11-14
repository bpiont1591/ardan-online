'use strict';
// Static world validation: every exit, arrival tile, monster spawn and NPC is reachable and walkable.
const { createArdan } = require('../server/engine');
const srv = { id: 'x', mobs: {}, state: {}, dirty: false };
const stub = new Proxy(function () {}, { get: (t, k) => (k === 'canvas' ? {} : stub), apply: () => stub, set: () => true });
createArdan({ getContext: () => stub }, { server: srv });
const api = srv.api, A = api.areas;
let fail = 0, pass = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL ' + m); } };
function reach(id, sx, sy) {
  const a = A[id], seen = new Uint8Array(a.w * a.h), q = [[sx, sy]]; seen[sy * a.w + sx] = 1;
  while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= a.w || ny >= a.h || seen[ny * a.w + nx] || api.solid(id, nx, ny)) continue; seen[ny * a.w + nx] = 1; q.push([nx, ny]); } }
  return seen;
}
const exitAt = (id, x, y) => A[id].exits.some((e) => e.x === x && e.y === y);
for (const id of Object.keys(A)) {
  const a = A[id], e0 = a.exits[0];
  ok(!!e0, `${id}: has exits`); if (!e0) continue;
  const seen = reach(id, e0.x, e0.y);
  for (const e of a.exits) {
    ok(seen[e.y * a.w + e.x], `${id}: exit ${e.x},${e.y} → ${e.to} reachable`);
    ok(!!A[e.to], `${id}: exit target ${e.to} exists`);
    if (!A[e.to]) continue;
    ok(!api.solid(e.to, e.tx, e.ty), `${id} → ${e.to}: arrival ${e.tx},${e.ty} walkable`);
    ok(!exitAt(e.to, e.tx, e.ty), `${id} → ${e.to}: arrival ${e.tx},${e.ty} is not an exit tile`);
    ok(A[e.to].exits.some((b) => b.to === id), `${e.to} has a way back to ${id}`);
  }
  for (const s of a.spawns) ok(seen[s[2] * a.w + s[1]] && !api.solid(id, s[1], s[2]), `${id}: spawn ${s[0]} @${s[1]},${s[2]} reachable`);
  ok(!!api.ainfo[id] && typeof api.ainfo[id].gx === 'number', `${id}: world-map info`);
}
for (const k of Object.keys(api.npcs)) {
  const n = api.npcs[k], a = A[n.area]; if (!a) { ok(false, `npc ${k} area`); continue; }
  const seen = reach(n.area, a.exits[0].x, a.exits[0].y);
  ok(!api.solid(n.area, n.x, n.y), `npc ${k} stands on a walkable tile`);
  const near = [[0, 1], [1, 0], [-1, 0], [0, -1]].some(([dx, dy]) => seen[(n.y + dy) * a.w + n.x + dx]);
  ok(near, `npc ${k} can be reached`);
}
// map grid: no two areas share a cell
const cells = {}; for (const id of Object.keys(api.ainfo)) { const c = api.ainfo[id].gx + ',' + api.ainfo[id].gy; ok(!cells[c], `map cell ${c} free for ${id} (taken by ${cells[c]})`); cells[c] = id; }
// quests reference existing NPCs, monsters, items and areas
for (const q of api.qorder) {
  const Q = api.quests[q];
  ok(!!api.npcs[Q.giver], `quest ${q}: giver ${Q.giver}`);
  ok(!!A[Q.area], `quest ${q}: area ${Q.area}`);
  if (Q.kill) ok(!!api.mon[Q.kill] && A[Q.area].spawns.some((s) => s[0] === Q.kill), `quest ${q}: ${Q.kill} lives in ${Q.area}`);
  if (Q.item) ok(!!api.items[Q.item] && api.mon[Q.src] && api.mon[Q.src].drops.some((d) => d[0] === Q.item), `quest ${q}: ${Q.src} drops ${Q.item}`);
  if (Q.req) ok(!!api.quests[Q.req], `quest ${q}: req ${Q.req}`);
  for (const [it] of Q.rew.items || []) ok(it[0] === '$' || !!api.items[it], `quest ${q}: reward ${it}`);
}
for (const k of Object.keys(api.mon)) for (const [it] of api.mon[k].drops) ok(it[0] === '$' || !!api.items[it], `monster ${k}: drop ${it}`);
const bosses = Object.keys(api.mon).filter((k) => api.mon[k].boss);
for (const b of bosses) ok(Object.keys(A).some((id) => A[id].spawns.some((s) => s[0] === b)), `boss ${b} placed in the world`);
const lands = Object.keys(A).filter((id) => A[id].spawns.length > 0);
console.log(`Świat: ${Object.keys(A).length} krain (${lands.length} z potworami), ${bosses.length} bossów, ${api.qorder.length} zadań, poziom maks. ${api.maxLvl}`);
console.log(`Wynik: ${pass} OK, ${fail} błędów`);
process.exit(fail ? 1 : 0);
