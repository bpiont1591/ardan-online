'use strict';
// Turn-based battles (Margonem style), PvE and PvP. Server-authoritative: clients only send their choice for the round.
const I = require('./items');
const store = require('./store');
const START_RANGE = 3;          // tiles: attack key next to a monster
const CLICK_RANGE = 7;          // tiles: clicking/tapping a visible monster starts the fight
const PARTY_RANGE = 12;         // party members this close join the fight
const DUEL_RANGE = 8;
const PVP_MIN_LVL = 10, PVP_LVL_GAP = 10, PK_CD = 180000; // lethal PvP: newbie protection, level gap, same-victim cooldown
const pkCd = new Map();
const CHOOSE_MS = 20000;        // time to pick an action, then the round is played automatically
const STEP_MS = { 1: 650, 2: 330, 3: 120 };
const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
// skills on the battle screen: cost (mana/energia) and cooldown in rounds
const TSK = {
  war: [{ cost: 25, cd: 2 }, { cost: 35, cd: 3 }, { cost: 40, cd: 5 }],
  arc: [{ cost: 25, cd: 2 }, { cost: 40, cd: 3 }, { cost: 35, cd: 5 }],
  mag: [{ cost: 18, cd: 1 }, { cost: 30, cd: 3 }, { cost: 35, cd: 4 }],
};
// round 4: high-level skills unlocked at 15 / 30 / 45 (names from engine SKX)
TSK.war.push({ cost: 45, cd: 3 }, { cost: 55, cd: 4 }, { cost: 70, cd: 6 });
TSK.arc.push({ cost: 40, cd: 3 }, { cost: 55, cd: 4 }, { cost: 70, cd: 6 });
TSK.mag.push({ cost: 40, cd: 3 }, { cost: 60, cd: 4 }, { cost: 75, cd: 6 });
const SK_LV = [1, 3, 5, 15, 30, 45];
const HEAL_POTS = ['pot', 'bigpot', 'elix', 'gpot', 'selix', 'spot', 'dpot'];
const MANA_POTS = ['mpot', 'gmpot'];

function createBattles(world) {
  const battles = new Map(); let nextId = 1;
  const R = Math.random;
  const sys = (p, t) => world.chat.sys(p, t);
  const dmgCalc = (a, d) => Math.max(1, Math.round(a * (0.85 + R() * 0.3) - d * 0.6));
  // must match xpNext in engine-src/r4.py (round 5: ~+35% mid-game, ~+50% at the cap; levels 1-4 unchanged)
  const xpNext = (l) => Math.floor(40 * Math.pow(l, 1.65) * (1 + Math.min(0.35, Math.max(0, l - 4) * 0.025)) * (l > 30 ? 1 + (l - 30) * 0.05 : 1));
  const xpTotal = (lvl, xp) => { let s = xp; for (let l = 1; l < lvl; l++) s += xpNext(l); return s; };
  const rank = () => store.get('pvp', {});
  const ckey = (p) => p.ckey;

  // item passives (round 5): summed per kind from worn gear, capped
  function gearPx(P) {
    const out = {}, g = P.gear || {};
    for (const sl of Object.keys(g)) { const it = g[sl]; if (it && it.d !== 0 && Array.isArray(it.px)) for (const [k, v] of it.px) if (I.PXD.PX[k] && Number.isFinite(v)) out[k] = Math.min(I.PXD.PX[k].cap, (out[k] || 0) + v); }
    return out;
  }
  const pxEv = (ev, f, txt, extra) => ev.push(Object.assign({ a: f.id, k: 'px', txt: '✦ ' + txt }, extra || {}));
  function fPlayer(p, side) {
    const P = p.api.P(), st = p.api.stats(), px = gearPx(P);
    return { id: p.pid, kind: 'p', side, p, n: p.nick, cls: P.cls, lvl: P.lvl, hp: Math.max(1, Math.round(P.hp)), mhp: st.hp, mp: Math.round(P.mp), mmp: st.mp,
      atk: st.atk, def: st.def, crit: st.crit / 100, dodge: st.dodge / 100, res: st.res, w: P.eq.w, a: P.eq.a, gt: p.guildTag || null,
      cds: [0, 0, 0, 0, 0, 0], buf: {}, stun: 0, frz: 0, burn: 0, burnD: 0, alive: true, fled: false, choice: null, auto: !!p.autoFight || !!p.bot, bot: !!p.bot, px, absorb: px.shield || 0, phx: false, poison: 0, poisonD: 0 };
  }
  function fMob(m, idx) {
    const d = m.d;
    return { id: 'm' + idx, kind: 'm', side: 1, m, k: m.k, n: d.n, lvl: d.lvl, hp: Math.max(1, Math.round(m.hp)), mhp: d.hp, mp: 0, mmp: 0, atk: d.atk, def: d.def,
      crit: d.boss ? 0.1 : 0.05, dodge: 0.04, boss: !!d.boss, elite: !!I.ELITE[m.k] || !!m.elite, mech: m.mech || null, summon: m.summon || null, buf: {}, stun: 0, frz: 0, burn: 0, burnD: 0, alive: true, fled: false, px: {}, absorb: 0, poison: 0, poisonD: 0 };
  }
  const players = (b) => b.f.filter((f) => f.kind === 'p');
  const active = (f) => f.alive && !f.fled;
  const enemiesOf = (b, f) => b.f.filter((x) => x.side !== f.side && active(x));
  const alliesOf = (b, f) => b.f.filter((x) => x.side === f.side && active(x));

  function view(b, f) {
    return {
      t: 'bt', id: b.id, kind: b.kind, round: b.round, phase: b.phase, dl: b.phase === 'choose' ? Math.max(0, b.deadline - Date.now()) : 0, speed: b.speed, me: f.id, title: b.title || undefined, mech: b.mech || undefined,
      f: b.f.map((x) => ({ id: x.id, side: x.side, kind: x.kind, n: x.n, lvl: x.lvl, cls: x.cls, k: x.k, hp: Math.max(0, Math.round(x.hp)), mhp: x.mhp, mp: Math.round(x.mp), mmp: x.mmp,
        alive: x.alive, fled: x.fled, stun: x.stun, frz: x.frz, burn: x.burn, buf: x.buf, boss: x.boss, elite: x.elite, w: x.w, a: x.a, gt: x.gt, ready: !!x.choice, auto: !!x.auto, cds: x.cds, res: x.res })),
    };
  }
  function pushAll(b, extra) {
    for (const f of players(b)) {
      if (!f.p || f.left) continue;
      const v = view(b, f); if (extra) Object.assign(v, extra);
      if (extra && extra.end) v.end = extra.end[f.id] || extra.end.all;
      world.send(f.p, v);
    }
  }

  // ---------- start ----------
  function canFight(p) {
    if (p.battle) return 'Już walczysz.';
    if (p.api.pl.dead > 0) return 'Nie możesz teraz walczyć.';
    return null;
  }
  function startPve(p, m, click) {
    const err = canFight(p); if (err) return sys(p, err);
    const P = p.api.P(), area = P.area, ml = world.mobs[area] || [];
    if (!m || m.dead || ml.indexOf(m) < 0) return;
    if (m.inB) {
      const b = battles.get(m.inB);
      if (b && b.kind === 'pve' && b.area === area && players(b).some((f) => f.p && f.p.partyId && f.p.partyId === p.partyId)) return joinBattle(b, p);
      return sys(p, 'Ten potwór już z kimś walczy.');
    }
    if (cheb(m.x, m.y, P.x, P.y) > (click ? CLICK_RANGE : START_RANGE)) return sys(p, 'Podejdź bliżej, aby rozpocząć walkę.');
    const b = { id: nextId++, kind: 'pve', area, f: [], round: 0, phase: 'choose', speed: p.fightSpeed || 1, lead: p.pid, deadline: 0, next: 0 };
    b.f.push(fPlayer(p, 0));
    const party = p.partyId && world.parties && world.parties.parties.get(p.partyId);
    if (party) for (const pid of party.members) {
      const q = world.players.get(pid); if (!q || q === p || canFight(q)) continue;
      const Q = q.api.P(); if (Q.area !== area || cheb(Q.x, Q.y, P.x, P.y) > PARTY_RANGE) continue;
      b.f.push(fPlayer(q, 0));
    }
    const mobs = [m];
    const extra = m.d.boss ? 0 : Math.min(2, players(b).length - 1);
    for (const o of ml) { if (mobs.length > extra) break; if (o !== m && !o.dead && !o.inB && o.k === m.k && cheb(o.x, o.y, m.x, m.y) <= 2) mobs.push(o); }
    for (const o of mobs) { b.f.push(fMob(o, ml.indexOf(o))); o.inB = b.id; o.aggro = false; }
    begin(b);
    const names = mobs.map((o) => o.d.n).join(', ');
    for (const f of players(b)) sys(f.p, `⚔ Walka: ${names}${players(b).length > 1 ? ' (drużyna: ' + players(b).map((x) => x.n).join(', ') + ')' : ''}.`);
  }
  function joinBattle(b, p) {
    const f = fPlayer(p, 0); b.f.push(f); p.battle = b; p.mx = p.my = 0;
    for (const x of players(b)) sys(x.p, `${p.nick} dołącza do walki!`);
    pushAll(b);
  }
  function startPvp(p, q) {
    const err = canFight(p); if (err) return sys(p, err);
    if (!q || q === p) return;
    if (canFight(q)) return sys(p, `${q.nick} nie może teraz walczyć.`);
    const P = p.api.P(), Q = q.api.P();
    if (P.area !== Q.area || cheb(P.x, P.y, Q.x, Q.y) > DUEL_RANGE) return sys(p, 'Podejdź bliżej do przeciwnika.');
    const z1 = p.api.pvpAt(P.area, P.x, P.y), z2 = p.api.pvpAt(Q.area, Q.x, Q.y);
    if (!z1 || !z2) return sys(p, 'To bezpieczna strefa – walczyć z graczami można tylko na mapach PvP i na arenach.');
    if (p.partyId && p.partyId === q.partyId) return sys(p, 'Nie możesz walczyć z członkiem swojej drużyny.');
    // whole PvP maps: a real (lethal) fight; arenas: a friendly duel for ranking points
    const lethal = !!(z1.lethal && z2.lethal);
    if (lethal) {
      if (Q.lvl < PVP_MIN_LVL) return sys(p, `Gracze poniżej ${PVP_MIN_LVL}. poziomu są chronieni przed atakami.`);
      if (P.lvl < PVP_MIN_LVL) return sys(p, `Atakować innych graczy możesz od ${PVP_MIN_LVL}. poziomu.`);
      if (P.lvl - Q.lvl > PVP_LVL_GAP) return sys(p, `Nie możesz atakować graczy słabszych od ciebie o więcej niż ${PVP_LVL_GAP} poziomów.`);
      const k = ckey(p) + '>' + ckey(q), t = pkCd.get(k);
      if (t && Date.now() < t) return sys(p, `Niedawno walczyłeś z ${q.nick}. Spróbuj ponownie za ${Math.ceil((t - Date.now()) / 1000)} s.`);
    }
    const b = { id: nextId++, kind: 'pvp', lethal, area: P.area, zone: z1.n, f: [fPlayer(p, 0), fPlayer(q, 1)], round: 0, phase: 'choose', speed: p.fightSpeed || 1, lead: p.pid };
    begin(b);
    if (lethal) { pkCd.set(ckey(p) + '>' + ckey(q), Date.now() + PK_CD); sys(q, `⚔ ${p.nick} atakuje cię! To strefa PvP – walcz albo zginiesz.`); for (const o of world.inArea(P.area)) if (o !== q) sys(o, `⚔ ${p.nick} atakuje ${q.nick}! (${z1.n} – strefa PvP)`); }
    else for (const o of world.inArea(P.area)) sys(o, `⚔ ${p.nick} wyzywa ${q.nick} na pojedynek! (${z1.n})`);
  }
  // fight against monsters that do not live on the world map (dungeon rooms); ps = players, foes = pseudo monsters
  function startCustom(ps, foes, opts) {
    ps = ps.filter((p) => !canFight(p)); if (!ps.length) return null;
    const P = ps[0].api.P();
    const b = { id: nextId++, kind: 'pve', dg: opts.dg || null, area: P.area, f: [], round: 0, phase: 'choose', speed: ps[0].fightSpeed || 1, lead: ps[0].pid, deadline: 0, next: 0, onEnd: opts.onEnd || null, loot: opts.loot || null, title: opts.title || '', mech: opts.mech || null };
    for (const p of ps) b.f.push(fPlayer(p, 0));
    foes.forEach((o, i) => { b.f.push(fMob(o, i)); o.inB = b.id; });
    begin(b);
    for (const f of players(b)) sys(f.p, `⚔ ${opts.title || 'Walka'}: ${foes.map((o) => o.d.n).join(', ')}.`);
    return b;
  }
  function begin(b) {
    battles.set(b.id, b);
    for (const f of players(b)) { f.p.battle = b; f.p.mx = f.p.my = 0; f.p.api.pl.target = null; }
    newRound(b);
  }

  // ---------- rounds ----------
  function newRound(b) {
    b.round++; b.phase = 'choose'; b.deadline = Date.now() + CHOOSE_MS;
    for (const f of b.f) { f.choice = null; if (f.kind === 'p' && active(f) && (f.auto || f.stun > 0 || f.frz > 0)) f.choice = ai(b, f); }
    pushAll(b);
  }
  function potHave(f) { if (!f.p) return null; for (const id of HEAL_POTS.slice().reverse()) if (f.p.api.countItem(id) > 0) return id; return null; }
  function ai(b, f) {
    const en = enemiesOf(b, f); if (!en.length) return { a: 'atk' };
    const tgt = en.slice().sort((x, y) => x.hp - y.hp)[0].id;
    const hpk = f.hp / f.mhp, sk = TSK[f.cls] || TSK.war, lvl = f.lvl;
    const ok = (i) => !!sk[i] && lvl >= SK_LV[i] && (f.cds[i] | 0) <= 0 && f.mp >= sk[i].cost;
    if (hpk < 0.35 && !f.bot && potHave(f)) return { a: 'pot', t: tgt };
    if (hpk < 0.5 && f.cls !== 'arc' && ok(5)) return { a: 'sk', i: 5, t: tgt };
    if (f.cls === 'arc' && ok(5)) return { a: 'sk', i: 5, t: tgt };
    if (en.length >= 2 && ok(4)) return { a: 'sk', i: 4, t: tgt };
    if (en.length >= 2 && ok(3)) return { a: 'sk', i: 3, t: tgt };
    if (ok(3) && !ok(0)) return { a: 'sk', i: 3, t: tgt };
    if (hpk < 0.5 && (f.cls === 'war' || f.cls === 'mag') && ok(2)) return { a: 'sk', i: 2, t: tgt };
    if (f.cls === 'arc' && ok(2) && !f.buf.crit) return { a: 'sk', i: 2, t: tgt };
    if (en.length >= 2 && ok(1)) return { a: 'sk', i: 1, t: tgt };
    if (ok(0)) return { a: 'sk', i: 0, t: tgt };
    return { a: 'atk', t: tgt };
  }
  // death with the legendary "Feniks" passive (once per fight)
  function down(f, ev) {
    if (f.hp > 0) return;
    if (f.px && f.px.phoenix && !f.phx) { f.phx = true; f.hp = Math.max(1, Math.round(f.mhp * f.px.phoenix / 100)); pxEv(ev, f, `Feniks: ${f.n} powstaje z popiołów (${Math.round(f.hp)} pż)!`, { t: f.id, hp: Math.round(f.hp) }); return; }
    f.hp = 0; f.alive = false; ev.push({ t: f.id, k: 'die', txt: `${f.n} pada!` });
  }
  function hit(b, a, t, mult, ev, how, noProc) {
    if (!active(t)) return 0;
    if (R() < t.dodge) { ev.push({ a: a.id, t: t.id, k: 'miss', txt: `${t.n} unika ciosu (${how}).` }); return 0; }
    const A = a.px || {}, T = t.px || {};
    if (T.mirror && R() < T.mirror / 100) { // whole blow reflected
      const d0 = Math.round(dmgCalc(a.atk, a.def) * mult); a.hp -= d0;
      pxEv(ev, t, `Lustro: ${t.n} odbija cios – ${a.n} traci ${d0} pż.`, { t: a.id, v: d0, hp: Math.max(0, Math.round(a.hp)) }); down(a, ev); return 0;
    }
    let m = mult;
    if (A.boss && (t.boss || t.elite)) m *= 1 + A.boss / 100;
    if (A.exec && t.hp < t.mhp * 0.3) m *= 1 + A.exec / 100;
    if (A.first && b.round === 1) m *= 1 + A.first / 100;
    if (A.berserk && a.mhp) m *= 1 + Math.min(A.berserk, (1 - a.hp / a.mhp) * 50) / 100;
    const crit = R() < a.crit + (a.buf.crit ? 0.25 : 0);
    let d = Math.round(dmgCalc(a.atk, t.def * (t.buf.def ? 1.6 : 1)) * m);
    if (crit) d = Math.round(d * (1.7 + (A.critd || 0) / 100));
    if (t.buf.shield) d = Math.max(1, Math.round(d * 0.25));
    let note = '';
    if (T.block && R() < T.block / 100) { d = Math.max(1, Math.round(d / 2)); note += ' (blok)'; }
    if (t.absorb > 0) { const ab = Math.min(t.absorb, d); t.absorb -= ab; d -= ab; note += ` (bariera -${ab})`; }
    t.hp -= d;
    ev.push({ a: a.id, t: t.id, k: crit ? 'crit' : 'hit', v: d, txt: `${a.n} – ${how}: ${t.n} traci ${d} pż${crit ? ' (KRYTYK!)' : ''}${note}.`, hp: Math.max(0, Math.round(t.hp)) });
    down(t, ev);
    if (d > 0 && T.thorns && active(a)) { const r = Math.max(1, Math.round(d * T.thorns / 100)); a.hp -= r; pxEv(ev, t, `Ciernie: ${a.n} traci ${r} pż.`, { t: a.id, v: r, hp: Math.max(0, Math.round(a.hp)) }); down(a, ev); }
    if (!noProc && d > 0) {
      if (A.ls && active(a) && a.hp < a.mhp) { const h = Math.max(1, Math.round(d * A.ls / 100)); a.hp = Math.min(a.mhp, a.hp + h); pxEv(ev, a, `Wampiryzm: ${a.n} +${h} pż.`, { t: a.id, hp: Math.round(a.hp) }); }
      if (t.alive) {
        if (A.stun && R() < A.stun / 100 * (t.boss ? 0.5 : 1)) { t.stun = 1; pxEv(ev, a, `Ogłuszenie: ${t.n} jest ogłuszony!`); }
        if (A.frost && !t.boss && R() < A.frost / 100) { t.frz = 1; pxEv(ev, a, `Lodowy dotyk: ${t.n} zamarza!`); }
        if (A.poison && R() < A.poison / 100) { t.poison = 3; t.poisonD = Math.max(1, Math.round(a.atk * 0.15)); pxEv(ev, a, `Trucizna: ${t.n} jest zatruty.`); }
      } else if (A.soul && active(a)) { const h = Math.round(a.mhp * A.soul / 100); a.hp = Math.min(a.mhp, a.hp + h); pxEv(ev, a, `Żniwiarz dusz: ${a.n} +${h} pż.`, { t: a.id, hp: Math.round(a.hp) }); }
    }
    return d;
  }
  // basic attack + "Łańcuch" (second target) for players
  function basic(b, f, t, mult, ev, how) {
    hit(b, f, t, mult, ev, how);
    const A = f.px || {};
    if (A.chain && R() < A.chain / 100) { const o = enemiesOf(b, f).filter((x) => x !== t); if (o.length) { pxEv(ev, f, `Łańcuch: atak przeskakuje na ${o[0].n}!`); hit(b, f, o[Math.floor(R() * o.length)], mult * 0.6, ev, how, true); } }
  }
  function heal(f, amount, ev, how) {
    const before = f.hp; f.hp = Math.min(f.mhp, f.hp + Math.round(amount));
    ev.push({ a: f.id, t: f.id, k: 'heal', v: Math.round(f.hp - before), txt: `${f.n} – ${how}: +${Math.round(f.hp - before)} pż.`, hp: Math.round(f.hp) });
  }
  function doPlayer(b, f, ch, ev) {
    const en = enemiesOf(b, f); if (!en.length) return;
    ch = ch || { a: 'atk' };
    let t = en.find((x) => x.id === ch.t) || en.slice().sort((x, y) => x.hp - y.hp)[0];
    const SKN = f.p ? (f.p.api.sk[f.cls] || []).concat((f.p.api.skx && f.p.api.skx[f.cls]) || []) : [];
    if (ch.a === 'flee') {
      if (b.kind === 'pvp') { ev.push({ a: f.id, k: 'info', txt: `${f.n} nie może uciec z pojedynku!` }); ch = { a: 'atk' }; }
      else {
        const boss = en.some((x) => x.boss);
        if (R() < (boss ? 0.3 : 0.65)) { f.fled = true; ev.push({ a: f.id, k: 'flee', txt: `${f.n} ucieka z walki!` }); return; }
        ev.push({ a: f.id, k: 'info', txt: `${f.n} próbuje uciec, ale się nie udaje!` }); return;
      }
    }
    if (ch.a === 'pot' || ch.a === 'mpot') {
      const ids = ch.a === 'pot' ? HEAL_POTS : MANA_POTS;
      const id = ch.a === 'pot' ? potHave(f) : (f.p ? MANA_POTS.slice().reverse().find((m) => f.p.api.countItem(m) > 0) || null : null);
      if (!id || ids.indexOf(id) < 0) { ev.push({ a: f.id, k: 'info', txt: `${f.n} szuka mikstury, ale torba jest pusta!` }); return; }
      f.p.api.removeItem(id, 1); f.p.srv.dirty = true;
      const def = f.p.api.items[id];
      if (MANA_POTS.indexOf(id) >= 0) { const b0 = f.mp; f.mp = Math.min(f.mmp, f.mp + def.mana); ev.push({ a: f.id, t: f.id, k: 'mana', v: Math.round(f.mp - b0), txt: `${f.n} pije miksturę many: +${Math.round(f.mp - b0)}.` }); }
      else heal(f, def.heal, ev, def.n);
      return;
    }
    if (ch.a === 'sk') {
      const i = ch.i | 0, sk = (TSK[f.cls] || TSK.war)[i], nm = SKN[i] ? SKN[i].n : 'Umiejętność';
      if (!sk || f.lvl < SK_LV[i] || (f.cds[i] | 0) > 0 || f.mp < sk.cost) { ch = { a: 'atk' }; }
      else {
        if (f.px && f.px.echo && R() < f.px.echo / 100) pxEv(ev, f, `Echo mocy: ${nm} bez kosztu!`); else f.mp -= sk.cost;
        f.cds[i] = sk.cd + 1;
        ev.push({ a: f.id, k: 'skill', txt: `${f.n} używa: ${nm}!` });
        const k = f.cls + i;
        if (k === 'war0') { hit(b, f, t, 2.2, ev, nm); if (t.alive && (!t.boss || R() < 0.4)) { t.stun = 1; ev.push({ t: t.id, k: 'info', txt: `${t.n} jest ogłuszony!` }); } }
        else if (k === 'war1') for (const e of en) hit(b, f, e, 1.6, ev, nm);
        else if (k === 'war2') { heal(f, f.mhp * 0.25, ev, nm); f.buf.def = 3; }
        else if (k === 'arc0') hit(b, f, t, 2.6, ev, nm);
        else if (k === 'arc1') for (const e of en) hit(b, f, e, 1.3, ev, nm);
        else if (k === 'arc2') { f.buf.crit = 3; hit(b, f, t, 1, ev, 'strzał'); }
        else if (k === 'mag0') { hit(b, f, t, 2.4, ev, nm); if (t.alive) { t.burn = 2; t.burnD = Math.max(1, Math.round(f.atk * 0.3)); } for (const e of en) if (e !== t) hit(b, f, e, 0.5, ev, 'odłamki ognia'); }
        else if (k === 'mag1') for (const e of en) { hit(b, f, e, 1.3, ev, nm); if (e.alive && !e.boss) e.frz = 1; }
        else if (k === 'mag2') heal(f, f.mhp * 0.4, ev, nm);
        else if (k === 'war3') { hit(b, f, t, 3, ev, nm); if (t.alive && (!t.boss || R() < 0.35)) { t.stun = 1; ev.push({ t: t.id, k: 'info', txt: `${t.n} jest ogłuszony!` }); } }
        else if (k === 'war4') for (const e of en) { hit(b, f, e, 2, ev, nm); if (e.alive) { e.burn = 2; e.burnD = Math.max(1, Math.round(f.atk * 0.35)); } }
        else if (k === 'war5') { hit(b, f, t, 3.5, ev, nm); if (f.hp < f.mhp) heal(f, f.mhp * 0.3, ev, nm); f.buf.def = 3; }
        else if (k === 'arc3') for (const e of en) hit(b, f, e, 1.9, ev, nm);
        else if (k === 'arc4') for (let n = 0; n < 5; n++) { const al = en.filter((e) => e.alive); if (!al.length) break; hit(b, f, al[Math.floor(R() * al.length)], 1.3, ev, nm); }
        else if (k === 'arc5') { const c0 = f.crit; f.crit = 1; hit(b, f, t, 4.2, ev, nm); f.crit = c0; }
        else if (k === 'mag3') for (const e of en) hit(b, f, e, 1.9, ev, nm);
        else if (k === 'mag4') { hit(b, f, t, 3.8, ev, nm); if (t.alive) { t.burn = 3; t.burnD = Math.max(1, Math.round(f.atk * 0.4)); } for (const e of en) if (e !== t) hit(b, f, e, 1.5, ev, nm); }
        else if (k === 'mag5') { for (const e of en) { hit(b, f, e, 2.2, ev, nm); if (e.alive && !e.boss) e.frz = 1; } if (f.hp < f.mhp) heal(f, f.mhp * 0.35, ev, nm); }
        return;
      }
    }
    if (f.cls === 'mag') {
      if (f.mp >= 2) { f.mp -= 2; basic(b, f, t, 1, ev, 'magiczny pocisk'); }
      else basic(b, f, t, 0.5, ev, 'cios kosturem');
    } else basic(b, f, t, 1, ev, f.cls === 'arc' ? 'strzał' : 'cios');
  }
  // special boss mechanics (dungeons): summon adds, enrage, life drain, bone shield, curse
  function mechanics(b, f, en, ev) {
    const M = f.mech || [];
    if (M.indexOf('enrage') >= 0 && !f.enraged && f.hp < f.mhp * 0.35) { f.enraged = true; f.atk = Math.round(f.atk * 1.45); ev.push({ a: f.id, k: 'skill', txt: `${f.n} wpada w szał! Atakuje mocniej i dwa razy na turę.` }); }
    if (M.indexOf('shield') >= 0) {
      const th = !f.sh1 && f.hp < f.mhp * 0.6 ? 'sh1' : !f.sh2 && f.hp < f.mhp * 0.3 ? 'sh2' : null;
      if (th) { f[th] = true; f.buf.shield = 3; heal(f, f.mhp * 0.08, ev, 'tarcza'); ev.push({ a: f.id, k: 'skill', txt: `${f.n} otacza się tarczą – przez 2 tury obrażenia są mniejsze o 75%!` }); return true; }
    }
    if (M.indexOf('summon') >= 0 && f.summon && b.round > 1 && b.round % 3 === 1) {
      const adds = b.f.filter((x) => x.kind === 'm' && x.side === 1 && x.add && active(x)).length;
      if (adds < 2) {
        const n = Math.min(2 - adds, 1 + Math.floor(players(b).length / 2));
        const names = [];
        for (let i = 0; i < n; i++) { const o = f.summon(); const fx = fMob(o, 'a' + (b.addN = (b.addN || 0) + 1)); fx.add = true; b.f.push(fx); o.inB = b.id; names.push(fx.n); }
        ev.push({ a: f.id, k: 'skill', txt: `${f.n} przyzywa posiłki: ${names.join(', ')}!` });
        return true;
      }
    }
    if (M.indexOf('drain') >= 0 && b.round % 2 === 0) {
      const t = en.slice().sort((x, y) => y.hp - x.hp)[0], before = t.hp;
      hit(b, f, t, 1.25, ev, 'wysysanie życia');
      const got = Math.max(0, Math.round(before - t.hp));
      if (got) heal(f, got, ev, 'wysysanie życia');
      return true;
    }
    if (M.indexOf('curse') >= 0 && b.round % 4 === 2) {
      ev.push({ a: f.id, k: 'skill', txt: `${f.n} rzuca klątwę na całą drużynę – płoniecie przez 3 tury!` });
      for (const e of en) { e.burn = 3; e.burnD = Math.max(1, Math.round(f.atk * 0.22)); }
      return true;
    }
    return false;
  }
  function doMob(b, f, ev) {
    const en = enemiesOf(b, f); if (!en.length) return;
    if (f.mech && mechanics(b, f, en, ev)) return;
    if (f.enraged) { const t2 = en[Math.floor(R() * en.length)]; hit(b, f, t2, 0.8, ev, 'szał'); if (!enemiesOf(b, f).length) return; }
    if (f.boss && b.round % 3 === 0) {
      ev.push({ a: f.id, k: 'skill', txt: `${f.n} wyprowadza potężny atak obszarowy!` });
      for (const e of en) hit(b, f, e, 1.35, ev, 'atak obszarowy');
      return;
    }
    const t = R() < 0.3 ? en.slice().sort((x, y) => x.hp - y.hp)[0] : en[Math.floor(R() * en.length)];
    hit(b, f, t, 1, ev, f.m && f.m.d.rng ? 'pocisk' : 'atak');
  }
  function sideDone(b, side) { return !b.f.some((x) => x.side === side && active(x)); }
  function resolve(b) {
    const ev = [];
    const order = b.f.filter((f) => f.kind === 'p').concat(b.f.filter((f) => f.kind === 'm'));
    for (const f of order) {
      if (!active(f)) continue;
      if (sideDone(b, 0) || sideDone(b, 1)) break;
      if (f.stun > 0) { f.stun--; ev.push({ a: f.id, k: 'info', txt: `${f.n} jest ogłuszony i traci turę.` }); continue; }
      if (f.frz > 0) { f.frz--; ev.push({ a: f.id, k: 'info', txt: `${f.n} jest zamrożony i traci turę.` }); continue; }
      if (f.kind === 'p') {
        doPlayer(b, f, f.choice || ai(b, f), ev);
        if (f.px && f.px.xturn && active(f) && !sideDone(b, 1 - f.side) && R() < f.px.xturn / 100) { const en = enemiesOf(b, f); const t = en.slice().sort((x, y) => x.hp - y.hp)[0]; pxEv(ev, f, `Pośpiech: ${f.n} atakuje jeszcze raz!`); basic(b, f, t, 0.8, ev, 'szybki atak'); }
      } else doMob(b, f, ev);
    }
    for (const f of b.f) {
      if (!active(f)) continue;
      if (f.burn > 0) { f.burn--; f.hp -= f.burnD; ev.push({ t: f.id, k: 'burn', v: f.burnD, txt: `${f.n} płonie: -${f.burnD} pż.`, hp: Math.max(0, Math.round(f.hp)) }); down(f, ev); if (!f.alive) continue; }
      if (f.poison > 0) { f.poison--; f.hp -= f.poisonD; ev.push({ t: f.id, k: 'burn', v: f.poisonD, txt: `${f.n} – trucizna: -${f.poisonD} pż.`, hp: Math.max(0, Math.round(f.hp)) }); down(f, ev); if (!f.alive) continue; }
      if (f.px && f.px.hregen && f.hp < f.mhp) { const h = Math.max(1, Math.round(f.mhp * f.px.hregen / 100)); f.hp = Math.min(f.mhp, f.hp + h); pxEv(ev, f, `Odnowa: ${f.n} +${h} pż.`, { t: f.id, hp: Math.round(f.hp) }); }
      if (f.px && f.px.regen) f.mp = Math.min(f.mmp, f.mp + f.px.regen);
      for (const k of Object.keys(f.buf)) { f.buf[k]--; if (f.buf[k] <= 0) delete f.buf[k]; }
      if (f.cds) f.cds = f.cds.map((c) => Math.max(0, c - 1));
      if (f.kind === 'p') f.mp = Math.min(f.mmp, f.mp + (f.cls === 'mag' ? 3 + f.lvl * 0.15 : 12));
    }
    for (const f of b.f) if (f.kind === 'm' && f.m) f.m.hp = Math.max(1, f.hp);
    b.phase = 'anim'; b.next = Date.now() + Math.max(400, ev.length * STEP_MS[b.speed] + 250);
    pushAll(b, { ev });
  }

  // ---------- end ----------
  function finish(b, why) {
    battles.delete(b.id);
    const won0 = !sideDone(b, 0) && sideDone(b, 1);
    const end = {};
    if (b.kind === 'pve') {
      const mobsF = b.f.filter((f) => f.kind === 'm');
      const winners = players(b).filter((f) => active(f) && !f.left);
      const before = {};
      for (const f of players(b)) { const P = f.p.api.P(); before[f.id] = { xp: xpTotal(P.lvl, P.xp), gold: P.gold, lvl: P.lvl }; }
      for (const f of players(b)) { if (f.left) continue; const P = f.p.api.P(); P.mp = Math.max(0, Math.round(f.mp)); if (!f.alive) { P.hp = 0; } else P.hp = Math.max(1, Math.round(f.hp)); }
      if (won0 && winners.length) {
        const killer = winners.find((f) => f.id === b.lead) || winners[0];
        for (const mf of mobsF) { mf.m.inB = 0; killer.p.api.kill(mf.m); }
        for (const f of winners) {
          const loot = [];
          for (const mf of mobsF) loot.push(...(b.loot ? b.loot(mf, f.cls) : I.rollDrops(mf.k, mf.m.d, f.cls)));
          for (const mf of mobsF) world.emit('onEvent', f.p, 'kill', { k: mf.k, lvl: mf.lvl, elite: !!mf.elite, boss: !!mf.boss, dg: b.dg ? b.dg.id : null });
          world.emit('onEvent', f.p, 'win', { dg: b.dg ? b.dg.id : null });
          const got = world.gear ? world.gear.give(f.p, loot) : [];
          const P = f.p.api.P(), bf = before[f.id];
          end[f.id] = { win: true, xp: Math.max(0, xpTotal(P.lvl, P.xp) - bf.xp), gold: P.gold - bf.gold, lvlUp: P.lvl > bf.lvl ? P.lvl : 0, loot: got };
          if (got.length) sys(f.p, 'Łup z walki: ' + got.map((x) => `${x.n} (${I.RAR[x.r].n})`).join(', ') + '.');
        }
      } else {
        for (const mf of mobsF) { mf.m.inB = 0; if (mf.alive) { mf.m.hp = sideDone(b, 0) && !players(b).some((f) => f.fled) ? mf.m.d.hp : Math.max(1, mf.hp); } else if (!mf.m.dead) { const k = players(b).find((f) => !f.left); if (k) k.p.api.kill(mf.m); else mf.m.inB = 0; } }
      }
      if (b.onEnd) { try { b.onEnd(b, won0 && winners.length > 0, winners.map((f) => f.p), end); } catch (e) { console.error('[ARDAN] battle onEnd', e); } }
      for (const f of players(b)) {
        if (f.left) continue;
        if (!f.alive) { f.p.api.die(); end[f.id] = { win: false, dead: true }; }
        else if (!end[f.id]) end[f.id] = { win: false, fled: f.fled };
      }
    } else {
      const [a, c] = players(b);
      const winner = active(a) ? a : c, loser = winner === a ? c : a;
      for (const f of [a, c]) { if (f.left) continue; const P = f.p.api.P(); P.hp = Math.max(1, Math.round(f.hp)); P.mp = Math.max(0, Math.round(f.mp)); f.p.srv.dirty = true; }
      if (why !== 'abort' && b.lethal) {
        // lethal PvP: the loser dies (gold loss + durability loss like any death). No item stealing.
        if (!loser.left) loser.p.api.die();
        end[winner.id] = { win: true, pvp: true, lethal: true, vs: loser.n };
        end[loser.id] = { win: false, pvp: true, lethal: true, dead: true, vs: winner.n };
        world.emit('onEvent', winner.p, 'pvp', { win: true, lethal: true });
        for (const o of world.inArea(b.area)) sys(o, `☠ ${winner.n} zabija ${loser.n} w strefie PvP (${b.zone}).`);
      } else if (why !== 'abort') {
        const rk = rank();
        const ent = (f) => { const P = f.p.api.P(); const e = rk[ckey(f.p)] = rk[ckey(f.p)] || { n: f.n, cls: f.cls, pts: 1000, w: 0, l: 0 }; e.n = f.n; e.cls = f.cls; e.lvl = P.lvl; return e; };
        const ew = ent(winner), el = ent(loser);
        const exp = 1 / (1 + Math.pow(10, (el.pts - ew.pts) / 400));
        const gain = Math.max(4, Math.round(32 * (1 - exp)));
        ew.pts += gain; ew.w++; el.pts = Math.max(0, el.pts - gain); el.l++;
        store.set('pvp', rk);
        end[winner.id] = { win: true, pvp: true, pts: gain, total: ew.pts, vs: loser.n };
        world.emit('onEvent', winner.p, 'pvp', { win: true }); world.emit('onEvent', loser.p, 'pvp', { win: false });
        end[loser.id] = { win: false, pvp: true, pts: -gain, total: el.pts, vs: winner.n };
        for (const o of world.inArea(b.area)) sys(o, `⚔ ${winner.n} pokonuje ${loser.n} w pojedynku! (+${gain} pkt rankingu)`);
      }
    }
    for (const f of players(b)) if (f.p && f.p.battle === b) f.p.battle = null;
    pushAll(b, { phase: 'end', end });
  }

  return {
    name: 'battle', battles, TSK, startPve, startPvp, startCustom,
    intercept(p, a) {
      if (p.battle) return true;
      const P = p.api.P(), ml = world.mobs[P.area] || [];
      const nearest = (r) => { let best = null, bd = 1e9; for (const m of ml) { if (m.dead) continue; const d = cheb(m.x, m.y, P.x, P.y); if (d <= r && d < bd) { bd = d; best = m; } } return best; };
      if (a.a === 'atk' || a.a === 'sk') {
        const t = p.api.pl.target;
        const m = t && !t.dead && cheb(t.x, t.y, P.x, P.y) <= START_RANGE ? t : nearest(START_RANGE);
        if (m) startPve(p, m);
        else if (nearest(9)) sys(p, 'Podejdź bliżej do potwora, aby rozpocząć walkę.');
        else sys(p, 'W pobliżu nie ma przeciwników.');
        return true;
      }
      if (a.a === 'target' && a.area === P.area && a.i !== undefined) {
        const m = ml[a.i]; if (!m || m.dead) return true;
        if (cheb(m.x, m.y, P.x, P.y) <= CLICK_RANGE) { startPve(p, m, true); return true; }
        sys(p, `${m.d.n} (poz. ${m.d.lvl}) – podejdź bliżej, aby walczyć.`);
        return false;
      }
      if (a.a === 'talk') {
        const npcNear = Object.keys(p.api.npcs).some((k) => { const n = p.api.npcs[k]; return n.area === P.area && cheb(n.x, n.y, P.x, P.y) <= 1; });
        if (npcNear) return false;
        const m = nearest(2); if (m) { startPve(p, m); return true; }
      }
      return false;
    },
    onTick() {
      const now = Date.now();
      for (const b of [...battles.values()]) {
        if (b.phase === 'choose') {
          const ps = players(b).filter(active);
          if (!ps.length) { finish(b, 'abort'); continue; }
          if (ps.every((f) => f.choice) || now >= b.deadline) resolve(b);
        } else if (b.phase === 'anim' && now >= b.next) {
          if (sideDone(b, 0) || sideDone(b, 1) || !players(b).some((f) => active(f) && !f.left)) finish(b);
          else newRound(b);
        }
      }
    },
    onLeave(p) {
      const b = p.battle; if (!b) return;
      const f = b.f.find((x) => x.id === p.pid); if (f) { f.fled = true; f.left = true; }
      p.battle = null;
      if (!players(b).some((x) => active(x) && !x.left)) finish(b, 'abort');
      else if (b.kind === 'pvp') {
        f.alive = false; f.fled = false;
        // logging out during a lethal fight counts as a death (no escaping by disconnecting)
        if (b.lethal) { try { const P = p.api.P(); p.api.die(); const r = p.api.pl.resp; if (r) { P.area = r[0]; P.x = r[1]; P.y = r[2]; } P.hp = p.api.maxHp(); world.gear.deathWear(p); world.persist(p); } catch (e) { console.error('[ARDAN] pvp leave', e); } }
        finish(b);
      }
    },
    onMsg(p, msg) {
      if (msg.t === 'pvp') {
        if (msg.a === 'rank') {
          const rk = rank(); const list = Object.keys(rk).map((k) => Object.assign({ k }, rk[k])).sort((x, y) => y.pts - x.pts);
          const me = list.findIndex((x) => x.k === p.ckey);
          world.send(p, { t: 'pvp', rank: list.slice(0, 20).map((x, i) => ({ i: i + 1, n: x.n, cls: x.cls, lvl: x.lvl, pts: x.pts, w: x.w, l: x.l, me: x.k === p.ckey })), mine: me >= 0 ? Object.assign({ i: me + 1 }, list[me]) : null });
        } else if (msg.a === 'duel' && typeof msg.id === 'string') startPvp(p, world.players.get(msg.id));
        return true;
      }
      if (msg.t !== 'bt') return false;
      if (msg.a === 'auto') { p.autoFight = !!msg.on; }
      if (msg.a === 'speed' && [1, 2, 3].indexOf(msg.v) >= 0) { p.fightSpeed = msg.v; if (p.battle) p.battle.speed = msg.v; }
      const b = p.battle; if (!b) { if (msg.a === 'act') world.send(p, { t: 'bt', phase: 'none' }); return true; }
      const f = b.f.find((x) => x.id === p.pid); if (!f) return true;
      if (msg.a === 'auto') { f.auto = !!msg.on; if (f.auto && b.phase === 'choose' && !f.choice && active(f)) f.choice = ai(b, f); pushAll(b); }
      else if (msg.a === 'speed') pushAll(b);
      else if (msg.a === 'act' && b.phase === 'choose' && active(f) && msg.c && typeof msg.c === 'object') {
        const c = msg.c, a = ['atk', 'sk', 'pot', 'mpot', 'flee'].indexOf(c.a) >= 0 ? c.a : 'atk';
        f.choice = { a, i: Number.isInteger(c.i) && c.i >= 0 && c.i < 6 ? c.i : 0, t: typeof c.t === 'string' && c.t.length < 30 ? c.t : null };
        pushAll(b);
      } else if (msg.a === 'get') world.send(p, view(b, f));
      return true;
    },
  };
}
module.exports = { createBattles, TSK };
