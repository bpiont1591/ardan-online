'use strict';
// Round 7: item durability (death wear, repair only at a blacksmith), 12 h dungeon cooldown from entry,
// no level gates on map exits, and PvP allowed only on PvP maps / arenas (lethal on PvP maps, with protections).
const path = require('path');
process.env.DATABASE_PATH = path.join('/tmp', `ardan-r7-${Date.now()}.db`);
process.env.ARDAN_TEST_HOOKS = '';
const db = require('../server/db');
const { World } = require('../server/game');
const I = require('../server/items');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? '  PASS ' : '  FAIL ') + m); };

const world = new World();
let seq = 0;
function mkPlayer(nick, cls) {
  const u = db.prepare('INSERT INTO users (login, email, pass, created) VALUES (?, ?, ?, ?)').run('u' + nick, nick + '@example.com', 'x', Date.now());
  const c = db.prepare("INSERT INTO characters (user_id, nick, cls, lvl, area, data, created, updated) VALUES (?, ?, ?, 1, 'village', NULL, ?, ?)").run(u.lastInsertRowid, nick, cls || 'war', Date.now(), Date.now());
  const msgs = [];
  const ws = { readyState: 1, send: (s) => msgs.push(JSON.parse(s)), close() {} };
  const p = world.join(ws, { id: u.lastInsertRowid }, c.lastInsertRowid);
  p.msgs = msgs; p.seq = ++seq;
  return p;
}
const sysText = (p) => p.msgs.filter((m) => m.t === 'chat' || m.t === 'sys' || m.t === 'msg').map((m) => JSON.stringify(m)).join('\n');
const last = (p, t, k) => { for (let i = p.msgs.length - 1; i >= 0; i--) if (p.msgs[i].t === t && (!k || p.msgs[i].k === k)) return p.msgs[i]; return null; };
const place = (p, area, x, y) => { const P = p.api.P(); P.area = area; P.x = x; P.y = y; p.area = area; p.api.pl.fx = x; p.api.pl.fy = y; };
const freeNear = (p, area, x, y) => { for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1]]) if (!p.api.solid(area, x + dx, y + dy)) return [x + dx, y + dy]; return [x, y]; };
const tick = (n) => { for (let i = 0; i < (n || 1); i++) world.tick(0.1); };
function runBattles(maxIt) {
  for (let i = 0; i < (maxIt || 3000) && world.battle.battles.size; i++) {
    for (const b of world.battle.battles.values()) { b.deadline = 0; b.next = 0; for (const f of b.f) if (f.kind === 'p') f.auto = true; }
    world.battle.onTick();
  }
  return world.battle.battles.size === 0;
}

const A = mkPlayer('Kowalik', 'war'), B = mkPlayer('Zbojnik', 'war'), C = mkPlayer('Nowicjusz', 'mag');
tick(2);

console.log('Wytrzymałość przedmiotów');
const sword = I.make('sword', 2, 1); const plate = I.make('plate', 2, 1);
ok(sword && sword.d === I.DUR_MAX && sword.dm === I.DUR_MAX, `nowe przedmioty mają wytrzymałość ${I.DUR_MAX}/${I.DUR_MAX}`);
const PA = A.api.P(); PA.lvl = 30; PA.gear = PA.gear || {}; PA.gear.weapon = sword; PA.gear.armor = plate; PA.gold = 100000; world.gear.changed(A);
const atk0 = A.api.stats().atk;
A.api.die(); tick(1);
ok(sword.d === I.DUR_MAX - I.DUR_LOSS && plate.d === I.DUR_MAX - I.DUR_LOSS, `śmierć zabiera ${I.DUR_LOSS} pkt wytrzymałości każdemu założonemu przedmiotowi (${sword.d}/${sword.dm})`);
tick(40); // respawn
const gearMsg = last(A, 'gear');
ok(gearMsg && gearMsg.gear.weapon && gearMsg.gear.weapon.d === sword.d, 'wytrzymałość trafia do klienta (podgląd przedmiotu)');
ok(A.api.P().area !== undefined && A.api.pl.dead <= 0, `po śmierci odrodzenie w mieście (${A.api.P().area})`);
sword.d = 0; world.gear.changed(A);
const atkBroken = A.api.stats().atk;
ok(atkBroken < atk0, `zepsuty przedmiot (0) nie daje statystyk (atak ${atk0} → ${atkBroken})`);
const legacy = I.make('sword', 1, 0); delete legacy.d; delete legacy.dm;
ok(I.durOf(legacy) === I.DUR_MAX && I.repairCost(legacy) === 0, 'stare przedmioty bez pola wytrzymałości liczą się jako nowe');
const cost = I.repairCost(sword) + I.repairCost(plate);
ok(cost > 0 && I.repairCost(sword) <= Math.ceil(Math.max(10, sword.v) * I.REP_K), `koszt naprawy rośnie z brakującą wytrzymałością (pełna naprawa ≤ ${Math.round(I.REP_K * 100)}% wartości): ${cost} zł`);
// far from any blacksmith: repair refused, nothing changes
place(A, 'village', 30, 20); const g0 = A.api.P().gold;
world.merchant.onMsg(A, { t: 'npc', a: 'repair' });
ok(sword.d === 0 && A.api.P().gold === g0 && /kowala lub płatnerza/.test(sysText(A)), 'naprawa daleko od kowala – odrzucona (serwer sprawdza odległość)');
ok(!world.merchant.open(A, 'naprawa', true), 'okno naprawy nie otworzy się daleko od kowala');
// next to Kowal Bogumił
const K = A.api.npcs.kowal; ok(K && K.rep === 1, 'Kowal Bogumił naprawia ekwipunek');
const [kx, ky] = freeNear(A, K.area, K.x, K.y); place(A, K.area, kx, ky);
ok(world.merchant.open(A, 'naprawa'), 'przy kowalu okno naprawy się otwiera');
const rv = last(A, 'npcui', 'naprawa');
ok(rv && rv.items.length >= 2 && rv.all === cost, `okno naprawy: lista przedmiotów i koszt wszystkiego (${rv && rv.all} zł)`);
world.merchant.onMsg(A, { t: 'npc', a: 'repair', u: sword.u });
ok(sword.d === I.DUR_MAX && plate.d < I.DUR_MAX && A.api.P().gold === g0 - (cost - I.repairCost(plate)), 'naprawa jednego przedmiotu pobiera złoto');
const g1 = A.api.P().gold;
world.merchant.onMsg(A, { t: 'npc', a: 'repair' });
ok(plate.d === I.DUR_MAX && A.api.P().gold < g1, 'naprawa wszystkiego');
ok(A.api.stats().atk === atk0, 'po naprawie statystyki wracają');
A.api.P().gold = 0; sword.d = 50;
world.merchant.onMsg(A, { t: 'npc', a: 'repair' });
ok(sword.d === 50, 'bez złota nie ma naprawy');
sword.d = 100; A.api.P().gold = 100000;
const smiths = Object.keys(A.api.npcs).filter((k) => A.api.npcs[k].rep);
ok(smiths.length >= 5 && smiths.every((k) => ['village', 'town', 'port', 'fort', 'citadel', 'star'].indexOf(A.api.npcs[k].area) >= 0), `kowale w miastach: ${smiths.join(', ')}`);

console.log('Lochy – 12 h od wejścia');
const D = world.dungeons.DUNGEONS.goblin; const gate = (world.gather.objs[D.area] || []).find((o) => o.k === 'gate' && o.dg === 'goblin');
ok(!!gate && world.dungeons.DG_CD === 12 * 3600e3, 'odnowienie lochu: 12 godzin');
const [gx, gy] = freeNear(A, D.area, gate.x, gate.y); place(A, D.area, gx, gy);
const t0 = Date.now();
world.dungeons.enter(A, 'goblin');
ok(!!A.dg && typeof A.api.P().dgLock.goblin === 'number' && Math.abs(A.api.P().dgLock.goblin - t0) < 2000, 'wejście do lochu uruchamia odliczanie (od wejścia)');
world.dungeons.leave(A, 'test');
ok(!A.dg, 'wyjście (bez pokonania bossa)');
world.dungeons.enter(A, 'goblin');
ok(!A.dg && /12 h od wejścia/.test(sysText(A)), 'ponowne wejście zablokowane, choć boss nie został pokonany');
world.dungeons.atGate(A, gate);
const gv = last(A, 'dg');
ok(gv && gv.gate && gv.locked && gv.cd > 11.9 * 3600e3 && gv.cd <= 12 * 3600e3, `wejście pokazuje pozostały czas (${Math.round(gv && gv.cd / 60000)} min)`);
A.api.P().dgLock.goblin = Date.now() - 11 * 3600e3;
world.dungeons.enter(A, 'goblin'); ok(!A.dg, 'po 11 h nadal zablokowane');
A.api.P().dgLock.goblin = Date.now() - 12 * 3600e3 - 1000;
world.dungeons.enter(A, 'goblin'); ok(!!A.dg, 'po 12 h można wejść ponownie');
world.dungeons.leave(A);
A.api.P().dgLock.goblin = '2026-11-15';
world.dungeons.enter(A, 'goblin'); ok(!!A.dg, 'stara blokada dzienna (sprzed rundy 7) nie blokuje');
world.dungeons.leave(A);

console.log('Brak blokad poziomu');
// a level-1 character walks through every exit of every map (no level gate anywhere)
const Cp = C.api.P(); let gates = 0, tried = 0;
for (const id of Object.keys(C.api.areas)) for (const e of C.api.areas[id].exits) {
  if (tried > 400) break; tried++;
  let went = false;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const sx = e.x + dx, sy = e.y + dy; const a = C.api.areas[id];
    if (sx < 0 || sy < 0 || sx >= a.w || sy >= a.h || C.api.solid(id, sx, sy) || a.exits.some((q) => q.x === sx && q.y === sy)) continue;
    Cp.lvl = 1; place(C, id, sx, sy); C.api.pl.dead = 0; C.api.pl.path = []; C.api.pl.target = null; Cp.hp = C.api.maxHp();
    for (let i = 0; i < 40 && Cp.area === id; i++) C.api.tick(0.1, { mx: -dx, my: -dy, acts: [] });
    for (let i = 0; i < 10; i++) C.api.tick(0.1, { mx: 0, my: 0, acts: [] });
    if (Cp.area === e.to) { went = true; break; }
  }
  if (!went) { gates++; if (gates < 4) console.log('    blocked:', id, e.x, e.y, '→', e.to); }
}
ok(tried > 50 && gates === 0, `postać 1. poziomu przechodzi przez każde wyjście (${tried} przejść, zablokowanych: ${gates})`);
place(C, 'village', 18, 17);

console.log('PvP tylko na mapach PvP');
const PB = B.api.P(), PC = C.api.P();
ok(A.api.pvpMap('steppe') && A.api.pvpMap('necro') && !A.api.pvpMap('village') && !A.api.pvpMap('town') && !A.api.pvpMap('forest'), 'mapy PvP: m.in. Spalone Stepy i Nekropolia; miasta i las – bezpieczne');
const cities = Object.keys(A.api.city); ok(cities.length >= 6 && cities.every((c) => !A.api.pvpMap(c)), 'wszystkie miasta są strefami bezpiecznymi');
PA.lvl = 30; PB.lvl = 30; PA.hp = A.api.maxHp(); PB.hp = B.api.maxHp();
place(A, 'forest', 20, 20); place(B, 'forest', 21, 20); A.msgs.length = 0;
world.battle.onMsg(A, { t: 'pvp', a: 'duel', id: B.pid });
ok(!A.battle && /bezpieczna strefa/.test(sysText(A)), 'atak w bezpiecznej krainie (Las) – odrzucony');
place(A, 'town', 19, 13); place(B, 'town', 20, 13);
world.battle.onMsg(A, { t: 'pvp', a: 'duel', id: B.pid });
ok(!A.battle, 'atak w mieście – odrzucony');
// find two free tiles on the steppe
const st = []; for (let y = 5; y < 35 && st.length < 2; y++) for (let x = 5; x < 45 && st.length < 2; x++) if (!A.api.solid('steppe', x, y) && !A.api.solid('steppe', x + 1, y)) { st.push([x, y], [x + 1, y]); }
place(A, 'steppe', st[0][0], st[0][1]); place(B, 'steppe', st[1][0], st[1][1]);
PC.lvl = 5; place(C, 'steppe', st[1][0], st[1][1] + 0); A.msgs.length = 0;
world.battle.onMsg(A, { t: 'pvp', a: 'duel', id: C.pid });
ok(!A.battle && /poniżej 10/.test(sysText(A)), 'ochrona nowych graczy (poniżej 10. poziomu)');
PC.lvl = 15; A.msgs.length = 0;
world.battle.onMsg(A, { t: 'pvp', a: 'duel', id: C.pid });
ok(!A.battle && /więcej niż 10 poziomów/.test(sysText(A)), 'ochrona przed atakiem na dużo słabszego gracza (różnica > 10 poziomów)');
place(C, 'village', 18, 17);
const goldB = PB.gold = 1000; const wB = I.make('sword', 2, 1); PB.gear = PB.gear || {}; PB.gear.weapon = wB; const bagB = PB.gbag.length;
world.battle.onMsg(A, { t: 'pvp', a: 'duel', id: B.pid });
ok(!!A.battle && A.battle === B.battle && A.battle.lethal, 'na mapie PvP gracz może zaatakować innego gracza (walka turowa na śmierć)');
const bt = A.battle; for (const f of bt.f) if (f.id === B.pid) { f.hp = 1; }
ok(runBattles(), 'walka rozstrzygnięta (auto)');
tick(2);
const endA = last(A, 'bt'), endB = last(B, 'bt');
ok(endB && endB.end && endB.end.dead && endB.end.lethal, 'przegrany ginie');
ok(B.api.pl.dead > 0 || PB.area !== 'steppe', 'przegrany odradza się w mieście');
ok(PB.gold === goldB - Math.floor(goldB * 0.1), `kara: 10% złota (${goldB} → ${PB.gold})`);
ok(wB.d === I.DUR_MAX - I.DUR_LOSS, 'kara: utrata wytrzymałości założonego ekwipunku');
ok(PB.gear.weapon === wB && PB.gbag.length === bagB, 'brak kradzieży przedmiotów (ekwipunek zostaje u przegranego)');
ok(endA && endA.end && endA.end.win, 'zwycięzca dostaje informację o wygranej');
tick(40); PB.hp = B.api.maxHp(); place(B, 'steppe', st[1][0], st[1][1]); A.msgs.length = 0;
world.battle.onMsg(A, { t: 'pvp', a: 'duel', id: B.pid });
ok(!A.battle && /Spróbuj ponownie za/.test(sysText(A)), 'tego samego gracza nie można od razu atakować ponownie (3 min)');
// arena in the village: friendly duel, nobody dies
const ar = A.api.zones.find((z) => !z.lethal && z.area === 'village');
ok(!!ar, 'areny pozostają (pojedynki bez śmierci)');
place(A, 'village', ar.x0 + 1, ar.y0 + 1); place(B, 'village', ar.x0 + 2, ar.y0 + 1); PA.hp = A.api.maxHp(); PB.hp = B.api.maxHp();
const wB0 = wB.d, gB0 = PB.gold;
world.battle.onMsg(A, { t: 'pvp', a: 'duel', id: B.pid });
ok(!!A.battle && !A.battle.lethal, 'pojedynek na arenie');
for (const f of A.battle.f) if (f.id === B.pid) f.hp = 1;
runBattles(); tick(1);
ok(B.api.pl.dead <= 0 && wB.d === wB0 && PB.gold === gB0, 'na arenie przegrany nie ginie i nic nie traci');
// combat logging in a lethal fight counts as death
place(A, 'necro', 0, 0); { const a = A.api.areas.necro; let s = null; for (let y = 3; y < a.h - 3 && !s; y++) for (let x = 3; x < a.w - 3 && !s; x++) if (!A.api.solid('necro', x, y) && !A.api.solid('necro', x + 1, y)) s = [x, y]; place(A, 'necro', s[0], s[1]); place(B, 'necro', s[0] + 1, s[1]); }
world.battle.onMsg(B, { t: 'pvp', a: 'duel', id: A.pid });
ok(!!B.battle && B.battle.lethal, 'walka w Nekropolii (mapa PvP)');
const dA = sword.d; A.ws.readyState = 3; world.leave(A);
ok(sword.d === dA - I.DUR_LOSS && A.api.P().area !== 'necro', 'wylogowanie w trakcie walki PvP liczy się jako śmierć');

console.log(`\nRunda 7: ${pass} OK, ${fail} błędów`);
process.exit(fail ? 1 : 0);
