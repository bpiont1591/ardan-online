'use strict';
// Server-authoritative world. Every connected character runs a headless copy of the game
// engine (same rules as the client); monsters are one shared set per region.
// Clients only send intents ({mx,my} + actions); the server simulates and broadcasts state.
const { createArdan } = require('./engine');
const chars = require('./characters');
const { createChat } = require('./chat');
const { createParties } = require('./party');
const { createGear } = require('./gear');
const { createBattles } = require('./battle');
const { createMarket } = require('./market');
const { createTrade } = require('./trade');
const { createGuilds } = require('./guild');
const { createGather } = require('./gather');
const { createDungeons } = require('./dungeon');
const { createCraft } = require('./craft');
const { createDaily } = require('./daily');
const { createAch } = require('./ach');
const cfg = require('./config');

const stub = new Proxy(function () {}, { get: (t, k) => (k === 'canvas' ? {} : stub), apply: () => stub, set: () => true });
const STUB_CANVAS = { getContext: () => stub };
const ACTS = new Set(['atk', 'sk', 'pot', 'mpot', 'talk', 'npc', 'target', 'untarget', 'buy', 'sell', 'junk', 'equip', 'unequip', 'use', 'track', 'dlg', 'dlgx', 'intro']);
const ID_RE = /^[A-Za-z0-9_$]{0,24}$/;
const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
const dir1 = (v) => (v === 1 || v === -1 ? v : 0);

function sanitizeAct(a) {
  if (!a || typeof a !== 'object' || !ACTS.has(a.a)) return null;
  const o = { a: a.a };
  if (a.i !== undefined) { if (!Number.isInteger(a.i) || a.i < 0 || a.i > 99) return null; o.i = a.i; }
  if (a.id !== undefined) { if (typeof a.id !== 'string' || !ID_RE.test(a.id)) return null; o.id = a.id; }
  if (a.area !== undefined) { if (typeof a.area !== 'string' || !/^[a-z]{1,12}$/.test(a.area)) return null; o.area = a.area; }
  return o;
}

// Test-only hooks (enabled only by ARDAN_TEST_HOOKS=1 outside production) used by the automated e2e test.
const MAX_GOLD = 2000000000; // fits in int32, far above anything legit
const TEST_HOOKS = typeof process !== 'undefined' && process.env && process.env.ARDAN_TEST_HOOKS === '1' && process.env.NODE_ENV !== 'production';
function testHook(world, p, m) {
  const P = p.api.P();
  if (Number.isInteger(m.lvl)) { P.lvl = Math.max(1, Math.min(60, m.lvl)); P.xp = 0; }
  if (Number.isInteger(m.gold)) P.gold = m.gold;
  if (m.mats) world.gear.give(p, Object.keys(m.mats).map((k) => require('./items').mat(k, m.mats[k])));
  if (m.tp) { P.area = m.tp.area; P.x = m.tp.x; P.y = m.tp.y; }
  if (m.near) { // stand on a free tile next to a gathering node / gate / NPC
    const area = m.near.area || P.area; let t = null;
    if (m.near.npc) { const n = p.api.npcs[m.near.npc]; if (n) t = { a: n.area, x: n.x, y: n.y }; }
    else if (m.near.mob) { const mb = (world.mobs[area] || []).find((x) => x.k === m.near.mob && !x.dead && !x.inB); if (mb) t = { a: area, x: Math.round(mb.x), y: Math.round(mb.y) }; }
    else { const o = (world.gather.objs[area] || []).find((x) => x.k === m.near.k && !x.rt); if (o) t = { a: area, x: o.x, y: o.y }; }
    if (t) for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1]]) if (!p.api.solid(t.a, t.x + dx, t.y + dy)) { P.area = t.a; P.x = t.x + dx; P.y = t.y + dy; break; }
  }
  if (Array.isArray(m.items)) for (const [id, n] of m.items) p.api.addItem(id, n);
  if (Number.isInteger(m.loot) && m.loot > 0) { const I = require('./items'); world.gear.give(p, Array.from({ length: Math.min(12, m.loot) }, () => I.randomItem(P.lvl, 2))); }
  if (typeof m.leg === 'string') { const I = require('./items'); if (I.PXD.LEG.some((d) => d.id === m.leg)) world.gear.give(p, [I.makeLeg(m.leg)]); }
  if (m.heal) { P.hp = p.api.maxHp(); P.mp = 9999; }
  if (m.dqdone && P.daily) { const q = P.daily.q[0]; q.have = q.need; q.done = true; p.dqDirty = true; }
  p.srv.dirty = true; world.gear.changed(p);
}

class World {
  constructor() {
    this.mobs = {};             // shared monsters: area -> [mob]
    this.players = new Map();   // pid -> player session
    this.features = [];         // pluggable systems (chat now; parties/trade/guilds/PvP later)
    this.chat = createChat(this);
    this.use(this.chat);
    this.parties = this.use(createParties(this));
    this.gear = this.use(createGear(this));
    this.battle = this.use(createBattles(this));
    this.market = this.use(createMarket(this));
    this.trade = this.use(createTrade(this));
    this.guilds = this.use(createGuilds(this));
    this.gather = this.use(createGather(this));
    this.dungeons = this.use(createDungeons(this));
    this.craft = this.use(createCraft(this));
    this.daily = this.use(createDaily(this));
    this.ach = this.use(createAch(this));
    this.lastSave = Date.now();
    this.timer = null;
  }
  use(feature) { this.features.push(feature); return feature; }
  emit(hook, ...args) { for (const f of this.features) if (typeof f[hook] === 'function') { try { f[hook](...args); } catch (e) { console.error(`[ARDAN] ${f.name}.${hook}:`, e); } } }
  start() { this.timer = setInterval(() => { try { this.tick(cfg.tickMs / 1000); } catch (e) { console.error('[ARDAN] tick error', e); } }, cfg.tickMs); }
  stop() { clearInterval(this.timer); for (const p of this.players.values()) this.persist(p); }

  send(p, msg) { if (p.ws.readyState === 1) p.ws.send(JSON.stringify(msg)); }
  broadcast(msg) { const s = JSON.stringify(msg); for (const p of this.players.values()) if (p.ws.readyState === 1) p.ws.send(s); }
  inArea(area) { return [...this.players.values()].filter((p) => p.area === area); }
  byNick(n) { n = String(n).toLowerCase(); for (const p of this.players.values()) if (p.nick.toLowerCase() === n) return p; return null; }
  isOnline(charId) { return this.players.has('p' + charId); }
  online() { return this.players.size; }

  join(ws, user, charId) {
    // a still-connected session of the same character is kicked and saved first, so we load fresh data
    const old = this.players.get('p' + charId);
    if (old && old.userId === user.id) { this.send(old, { t: 'kick', reason: 'Zalogowano tą postacią z innego miejsca.' }); this.leave(old); try { old.ws.close(4001, 'replaced'); } catch (e) { /* ignore */ } }
    const ch = chars.load(charId, user.id);
    if (!ch) { ws.close(4004, 'Nie znaleziono postaci'); return null; }
    const pid = 'p' + ch.id;
    const srv = { id: pid, mobs: this.mobs, state: ch.data, dirty: false };
    createArdan(STUB_CANVAS, { server: srv });
    const api = srv.api;
    const P = api.P();
    const p = {
      pid, charId: ch.id, ckey: typeof ch.id === 'string' ? ch.id : 'c' + ch.id, userId: user.id, nick: ch.nick, cls: ch.cls, ws, srv, api, area: P.area,
      mx: 0, my: 0, acts: [], actBudget: 20, msgN: 0, msgT: Date.now(), lastMe: '', lastDlg: 'null', lastBags: '', saveT: Date.now(),
    };
    this.players.set(pid, p);
    this.send(p, { t: 'init', id: pid, nick: p.nick, me: P, online: this.players.size });
    this.chat.sys(p, `Witaj w świecie ARDAN, ${p.nick}! Graczy online: ${this.players.size}. Wpisz /pomoc, aby poznać komendy czatu.`);
    this.emit('onJoin', p);
    return p;
  }
  leave(p) {
    if (this.players.get(p.pid) !== p) return;
    this.persist(p);
    this.players.delete(p.pid);
    for (const area of Object.keys(this.mobs)) for (const m of this.mobs[area]) if (m.own === p.pid) m.own = null;
    this.emit('onLeave', p);
  }
  // state-changing economy ops: mutate + persist every involved character (and kv store writes) atomically
  atomic(ps, fn) {
    const run = () => { const r = fn(); for (const p of ps) if (p && !p.bot && p.charId && this.players.has(p.pid)) { chars.save(p.charId, p.api.P()); p.srv.dirty = false; p.saveT = Date.now(); } return r; };
    return typeof chars.atomic === 'function' ? chars.atomic(run) : run();
  }
  persist(p) { try { chars.save(p.charId, p.api.P()); p.srv.dirty = false; p.saveT = Date.now(); } catch (e) { console.error('[ARDAN] save error', e); } }

  onMessage(p, data) {
    const now = Date.now();
    if (now - p.msgT > 1000) { p.msgT = now; p.msgN = 0; p.actBudget = 20; }
    if (++p.msgN > 80) { if (p.msgN > 300) p.ws.close(4008, 'flood'); return; }
    if (data.length > 4096) return;
    let msg; try { msg = JSON.parse(data); } catch (e) { return; }
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === '__test') { if (TEST_HOOKS) testHook(this, p, msg); return; }
    if (msg.t === 'in') {
      const frozen = !!(p.battle || p.dg);
      p.mx = frozen ? 0 : dir1(msg.mx); p.my = frozen ? 0 : dir1(msg.my);
      if (Array.isArray(msg.acts)) for (const a of msg.acts.slice(0, 8)) {
        const s = sanitizeAct(a);
        if (!s || p.actBudget-- <= 0) continue;
        if (p.dg) continue;
        if (s.a === 'talk' && !p.battle && (this.craft.interceptTalk(p) || this.gather.useNear(p))) continue;
        if (this.battle.intercept(p, s)) continue;
        if (p.acts.length < 12) p.acts.push(s);
      }
    } else if (msg.t === 'chat') this.chat.handle(p, msg);
    else if (msg.t === 'ping') this.send(p, { t: 'pong', ts: msg.ts, online: this.players.size });
    else if (typeof msg.t === 'string') { for (const f of this.features) if (typeof f.onMsg === 'function' && f.onMsg(p, msg)) break; }
  }

  // Assign every monster to the player whose engine instance simulates it (nearest / current aggro target).
  mobOwnership(dt) {
    const byArea = {};
    for (const p of this.players.values()) { const P = p.api.P(); if (p.api.pl.dead > 0) continue; (byArea[P.area] = byArea[P.area] || []).push(p); }
    for (const area of Object.keys(this.mobs)) {
      const ps = byArea[area] || [];
      for (const m of this.mobs[area]) {
        const own = m.own ? this.players.get(m.own) : null;
        const oP = own && own.api.P();
        const ok = own && oP.area === area && !(own.api.pl.dead > 0) && cheb(m.x, m.y, oP.x, oP.y) <= 13;
        if (!(ok && m.aggro)) {
          let best = null, bd = 1e9;
          for (const p of ps) { const P = p.api.P(); const d = cheb(m.x, m.y, P.x, P.y); if (d < bd && d <= 14) { bd = d; best = p; } }
          if (best) m.own = best.pid; else { m.own = null; if (m.aggro && !m.dead) m.aggro = false; }
        }
        if (!m.own && !m.inB) {
          m.hit = Math.max(0, m.hit - dt); m.anim = Math.max(0, m.anim - dt);
          if (m.mt < 1) m.mt = Math.min(1, m.mt + dt * m.d.spd);
          if (m.dead) {
            m.rt -= dt;
            if (m.rt <= 0 && !ps.some((p) => { const P = p.api.P(); return cheb(m.hx, m.hy, P.x, P.y) <= 5; })) {
              m.dead = false; m.hp = m.d.hp; m.x = m.fx = m.hx; m.y = m.fy = m.hy; m.mt = 1; m.aggro = false; m.frz = 0; m.sl = m.d.slam || 0;
            }
          } else if (m.hp < m.d.hp) m.hp = Math.min(m.d.hp, m.hp + m.d.hp * 0.05 * dt);
        }
      }
    }
  }

  tick(dt) {
    for (const p of this.players.values()) {
      try { if (p.battle || p.dg) { p.acts.length = 0; p.api.tick(dt, { mx: 0, my: 0, acts: [] }); } else p.api.tick(dt, { mx: p.mx, my: p.my, acts: p.acts.splice(0, 6) }); }
      catch (e) { console.error('[ARDAN] player tick', p.nick, e); }
    }
    this.mobOwnership(dt);
    this.emit('onTick', dt);
    const areaEv = {}, groups = {};
    for (const p of this.players.values()) {
      const P = p.api.P(), a = P.area; p.area = a;
      // anti-cheat sanity: gold is always a finite integer in [0, MAX_GOLD]
      if (!Number.isFinite(P.gold) || P.gold < 0) P.gold = 0; else if (P.gold > MAX_GOLD) P.gold = MAX_GOLD; else if (P.gold % 1) P.gold = Math.floor(P.gold);
      (groups[a] = groups[a] || []).push(p);
      const ev = areaEv[a] = areaEv[a] || [];
      const d = p.api.drain();
      p.ownEv = []; p.logs = d.msgs.map((m) => ({ t: m.t, c: m.c }));
      for (const f of d.fx) {
        if (f.k === 'p') continue;
        const e = Object.assign({}, f); if (typeof e.x === 'number') e.x = r1(e.x); if (typeof e.y === 'number') e.y = r1(e.y);
        if (f.k === 'big') p.ownEv.push(e); else if (ev.length < 300) ev.push(e);
      }
      const ml = this.mobs[a] || [];
      for (const s of p.api.shots()) if (!s._s) { s._s = 1; ev.push({ k: 'shot', x: r1(s.x), y: r1(s.y), kind: s.kind, col: s.col || null, sp: s.sp, m: s.pl ? -1 : ml.indexOf(s.m), p: s.pl ? p.pid : null }); }
      for (const w of p.api.warns()) if (!w._s) { w._s = 1; ev.push({ k: 'warn', x: w.x, y: w.y, r: w.r, t: r2(w.t), max: w.max }); }
    }
    const nowMs = Date.now();
    for (const a of Object.keys(groups)) {
      const ml = this.mobs[a] || [];
      const mp = ml.map((m) => [m.x, m.y, Math.max(0, Math.round(m.hp)), (m.dead ? 1 : 0) | (m.aggro ? 2 : 0) | (m.frz > 0 ? 4 : 0) | (m.hit > 0 ? 8 : 0) | (m.anim > 0 ? 16 : 0) | (m.inB ? 32 : 0), m.dir | 0]);
      const plist = groups[a].map((p) => {
        const P = p.api.P(), pl = p.api.pl;
        return { i: p.pid, n: p.nick, c: P.cls, l: P.lvl, x: P.x, y: P.y, d: pl.dir | 0, hp: Math.max(0, Math.round(P.hp)), mh: p.api.maxHp(), w: P.eq.w, a: P.eq.a, an: r2(pl.anim), ht: r2(pl.hit), dd: pl.dead > 0 ? 1 : 0, bd: pl.buffDef > 0 ? 1 : 0, gt: p.guildTag || undefined, fb: p.battle ? 1 : undefined, dg: p.dg ? 1 : undefined, ti: p.title || undefined };
      });
      for (const p of groups[a]) {
        const P = p.api.P(), pl = p.api.pl;
        const own = { x: P.x, y: P.y, d: pl.dir | 0, hp: r1(P.hp), mp: r1(P.mp), dd: r2(pl.dead || 0), cd: r2(pl.cd), sk: pl.skcd.map(r2), bd: r2(pl.buffDef), hs: r2(pl.haste), au: pl.auto ? 1 : 0, cb: r1(pl.combat || 0), an: r2(pl.anim), ht: r2(pl.hit), tg: pl.target && !pl.target.dead ? ml.indexOf(pl.target) : -1 };
        const msg = { t: 's', a, p: own, m: mp, o: plist.filter((o) => o.i !== p.pid), e: (areaEv[a] || []).concat(p.ownEv), l: p.logs };
        const bags = p.api.bags().filter((b) => b.area === a && !b.taken).map((b) => [b.x, b.y]);
        const bs = JSON.stringify(bags); if (bs !== p.lastBags) { p.lastBags = bs; msg.b = bags; }
        this.send(p, msg);
        const meObj = Object.assign({}, P); delete meObj.x; delete meObj.y; delete meObj.hp; delete meObj.mp;
        const ms = JSON.stringify(meObj); if (ms !== p.lastMe) { p.lastMe = ms; this.send(p, { t: 'me', me: meObj }); }
        const dv = JSON.stringify(p.api.dlgView()); if (dv !== p.lastDlg) { p.lastDlg = dv; this.send(p, { t: 'dlg', d: JSON.parse(dv) }); }
        const sr = p.api.shopReq(); if (sr) this.send(p, { t: 'shop', shop: sr });
        if (p.srv.dirty && nowMs - p.saveT > 15000) this.persist(p);
      }
    }
  }
}
module.exports = { World, sanitizeAct };
