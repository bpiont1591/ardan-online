'use strict';
// Round 9: Margonem-like bags (starter large bag, capacity = sum of bags, overflow allowed but blocks pickups, loot on the
// ground), no potions in battle (only before / after), stat points, XP death penalty, teleport scrolls, healing after battle.
const path = require('path');
process.env.DATABASE_PATH = path.join('/tmp', `ardan-r9-${Date.now()}.db`);
process.env.ARDAN_TEST_HOOKS = '';
const db = require('../server/db');
const { World } = require('../server/game');
const I = require('../server/items');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? '  PASS ' : '  FAIL ') + m); };

const world = new World();
let n0 = 0;
function mkPlayer(nick, cls, data) {
  const u = db.prepare('INSERT INTO users (login, email, pass, created) VALUES (?, ?, ?, ?)').run('u' + nick, nick + '@example.com', 'x', Date.now());
  const c = db.prepare("INSERT INTO characters (user_id, nick, cls, lvl, area, data, created, updated) VALUES (?, ?, ?, 1, 'village', ?, ?, ?)").run(u.lastInsertRowid, nick, cls || 'war', data ? JSON.stringify(data) : null, Date.now(), Date.now());
  const msgs = [];
  const ws = { readyState: 1, send: (s) => msgs.push(JSON.parse(s)), close() {} };
  const p = world.join(ws, { id: u.lastInsertRowid }, c.lastInsertRowid);
  p.msgs = msgs; n0++;
  return p;
}
const place = (p, area, x, y) => { const P = p.api.P(); P.area = area; P.x = x; P.y = y; p.area = area; p.api.pl.fx = x; p.api.pl.fy = y; };
const tick = (n) => { for (let i = 0; i < (n || 1); i++) world.tick(0.1); };
const send = (p, acts) => { p.msgT = 0; world.onMessage(p, JSON.stringify({ t: 'in', mx: 0, my: 0, acts })); tick(2); };
const gmsg = (p, m) => { p.msgT = 0; world.onMessage(p, JSON.stringify(Object.assign({ t: 'gear' }, m))); tick(1); };
const sysText = (p) => p.msgs.filter((m) => m.t === 'chat' || m.t === 'sys' || m.t === 'msg').map((m) => JSON.stringify(m)).join('\n');
const lastGear = (p) => { for (let i = p.msgs.length - 1; i >= 0; i--) if (p.msgs[i].t === 'gear') return p.msgs[i]; return null; };
const fill = (p, n) => { const P = p.api.P(); for (let i = 0; i < n; i++) P.gbag.push(I.make('sword', 1, 0)); world.gear.changed(p); };

console.log('Torby (jak w Margonem)');
const A = mkPlayer('Plecakowy', 'war'); tick(2);
let P = A.api.P();
ok(Array.isArray(P.bags) && P.bags.length === 4 && P.bags[0] && P.bags[0].bk === 'l' && P.bags[0].cap === 25 && !P.bags[1], 'nowa postać nosi duży plecak (25) w 1. z 4 miejsc na torby');
ok(I.BAGS.l.cap === 25 && I.BAGS.m.cap === 12 && I.BAGS.s.cap === 6, 'duży 25, średni 12, mały 6 miejsc');
ok(world.gear.cap(A) === 25 && P.cap === 25, 'pojemność = suma toreb (25)');
const used0 = P.gbag.length + P.inv.length;
ok(world.gear.space(A) === 25 - used0, `mikstury i przedmioty zajmują miejsce (${used0} zajęte, ${world.gear.space(A)} wolne)`);
fill(A, world.gear.space(A));
ok(world.gear.space(A) === 0, 'plecak zapełniony');
const g1 = world.gear.give(A, [I.make('axe', 1, 1)]);
ok(g1.length === 0 && A.ground && A.ground.length === 1 && /Plecak pełny/.test(sysText(A)), 'pełny plecak: łup nie przepada – leży na ziemi z komunikatem „Plecak pełny”');
// legacy item (potion stack absent → new slot) is refused
P.inv = P.inv.filter((s) => s.id !== 'elix'); world.gear.changed(A);
ok(A.api.addItem('elix', 1) === false, 'nowy rodzaj mikstury nie wejdzie do pełnego plecaka');
const potN = A.api.countItem('pot');
ok(potN === 0 || A.api.addItem('pot', 1) === true, 'mikstura dokłada się do istniejącego stosu nawet przy pełnym plecaku');
// make room → picked up automatically
const sw = P.gbag.find((x) => x.b === 'sword' || x.n); world.gear.take(A, P.gbag[0].u); tick(8);
ok(A.ground.length === 0 && P.gbag.some((x) => x.b === g1 || x.n === 'Topór' || /Topór/.test(x.n)), 'po zrobieniu miejsca łup z ziemi trafia do plecaka automatycznie');
// bag item: buy a bag at a merchant, equip, capacity grows
const merch = Object.keys(A.api.npcs).find((k) => A.api.npcs[k].trade === 'skup' && A.api.npcs[k].area === 'village') || Object.keys(A.api.npcs).find((k) => A.api.npcs[k].trade === 'skup');
const mn = A.api.npcs[merch];
P.gold = 5000; place(A, mn.area, mn.x, mn.y + 1); tick(2);
A.msgs.length = 0; A.msgT = 0; world.onMessage(A, JSON.stringify({ t: 'npc', a: 'buybag', k: 'm' })); tick(2);
ok(P.bags.filter(Boolean).length === 2 && world.gear.cap(A) === 37 && P.gold === 5000 - 320, `u handlarza (${mn.n}) kupiona średnia torba zakłada się sama: pojemność 25 + 12 = 37`);
place(A, 'forest', 5, 5); tick(1); const gb = P.gold;
A.msgT = 0; world.onMessage(A, JSON.stringify({ t: 'npc', a: 'buybag', k: 's' })); tick(1);
ok(P.gold === gb && P.bags.filter(Boolean).length === 2, 'z dala od handlarza nie można kupić torby (serwer)');
// unequip a bag only if the contents fit
gmsg(A, { a: 'unequip', slot: 'bag1' });
ok(P.bags[1] && P.bags[1].bk === 'm', 'nie można zdjąć torby, gdy zawartość się nie zmieści');
gmsg(A, { a: 'unequip', slot: 'bag0' });
ok(P.bags[0], 'pierwsza torba zostaje (za mało miejsca bez niej)');
// bag dropped by monsters / tooltip data
const dropped = []; for (let i = 0; i < 4000; i++) { const b = I.rollBag(1, Math.random); if (b) dropped.push(b); }
ok(dropped.length > 40 && dropped.every((b) => I.isBag(b) && b.cap > 0), `potwory upuszczają torby (elita: ${dropped.length}/4000 losowań)`);
const gv = lastGear(A) || {}; gmsg(A, { a: 'get' }); const gv2 = lastGear(A);
ok(gv2 && Array.isArray(gv2.bags) && gv2.max === 37 && gv2.used === P.gbag.length + P.inv.length, 'okno ekwipunku dostaje torby, pojemność i zajęte miejsca');

console.log('Migracja starych postaci');
const old = { v: 2, cls: 'war', lvl: 20, xp: 0, hp: 100, mp: 100, gold: 50, area: 'village', x: 18, y: 17, inv: [{ id: 'pot', n: 3 }, { id: 'mpot', n: 1 }, { id: 'mpot', n: 1 }], eq: { w: null, a: 'shirt' }, q: {}, gear: {}, gbag: Array.from({ length: 34 }, () => I.make('sword', 2, 0)) };
const B = mkPlayer('Weteran', 'war', old); tick(2);
const PB = B.api.P();
ok(PB.gbag.length === 34 && PB.bags[0] && PB.bags[0].cap === 25, 'stara postać dostaje duży plecak i nie traci żadnego z 34 przedmiotów');
ok(PB.inv.filter((s) => s.id === 'mpot').length === 1 && B.api.countItem('mpot') === 2, 'rozbite stosy mikstur many łączą się w jeden (mniej zajętych miejsc)');
ok(world.gear.space(B) < 0, `przepełnienie dozwolone (${PB.gbag.length + PB.inv.length}/${world.gear.cap(B)})`);
const before = PB.gbag.length; world.gear.give(B, [I.make('axe', 2, 0)]);
ok(PB.gbag.length === before && B.ground.length === 1, 'przy przepełnieniu nowe przedmioty nie wchodzą (czekają na ziemi)');
ok(B.api.addItem('elix', 1) === false, 'przy przepełnieniu nowe mikstury też nie wchodzą');

console.log('Brak mikstur w walce');
const C = mkPlayer('Bitny', 'war'); tick(2);
const PC = C.api.P(); PC.lvl = 30; PC.hp = Math.round(C.api.maxHp() / 2); C.api.addItem('bigpot', 5);
const ml = world.mobs.forest.filter((m) => !m.dead); const m = ml[0];
place(C, 'forest', m.x, m.y + 1); tick(1);
world.battle.startPve(C, m);
const b = C.battle; const f = b.f.find((x) => x.kind === 'p');
for (const e of b.f) if (e.kind !== 'p') { e.mhp = e.hp = 100000; e.atk = 1; }
const hp0 = f.hp, pots0 = C.api.countItem('bigpot');
send(C, [{ a: 'pot' }]); // world act (H key) during battle
b.deadline = 0; b.next = 0; f.auto = false;
C.msgT = 0; world.onMessage(C, JSON.stringify({ t: 'bt', a: 'act', c: { a: 'pot' } }));
for (let i = 0; i < 20; i++) { b.deadline = 0; b.next = 0; world.battle.onTick(); }
ok(C.api.countItem('bigpot') === pots0 && f.hp <= hp0, `w walce mikstura nie działa ani przez akcję tury, ani klawiszem H (pż ${hp0} → ${f.hp}, mikstur ${pots0} → ${C.api.countItem('bigpot')})`);
// auto-fight never drinks
f.auto = true; f.hp = Math.round(f.mhp * 0.1); const p1 = C.api.countItem('bigpot');
for (let i = 0; i < 30; i++) { b.deadline = 0; b.next = 0; if (b.phase === 'choose' && !f.choice) f.choice = null; world.battle.onTick(); if (!C.battle) break; }
ok(C.api.countItem('bigpot') === p1, 'walka automatyczna nie pije mikstur, nawet przy 10% życia');
if (C.battle) { b.f.filter((x) => x.kind !== 'p').forEach((x) => { x.hp = 0; x.alive = false; }); for (let i = 0; i < 5 && C.battle; i++) { b.deadline = 0; b.next = 0; world.battle.onTick(); } }
tick(2);
PC.hp = Math.round(C.api.maxHp() / 3); const hpB = PC.hp; const p2 = C.api.countItem('bigpot');
send(C, [{ a: 'pot' }]);
ok(C.api.countItem('bigpot') === p2 - 1 && PC.hp === hpB + 120, 'poza walką mikstura leczy (klawisz H)');

console.log('Leczenie po walce (opcja)');
gmsg(C, { a: 'ah', on: true });
ok(PC.ah === true, 'opcja „lecz się po walce” zapisana');
const m2 = world.mobs.forest.filter((x) => !x.dead && !x.inB)[0]; place(C, 'forest', m2.x, m2.y + 1); tick(1);
PC.hp = Math.round(C.api.maxHp() * 0.3); world.battle.startPve(C, m2); const b2 = C.battle;
for (const e of b2.f) if (e.kind !== 'p') { e.hp = 1; e.mhp = Math.max(e.mhp, 1); e.atk = 0; }
const f2 = b2.f.find((x) => x.kind === 'p'); f2.auto = true; const p3 = C.api.countItem('bigpot');
for (let i = 0; i < 40 && C.battle; i++) { b2.deadline = 0; b2.next = 0; world.battle.onTick(); }
ok(!C.battle && C.api.countItem('bigpot') < p3 && PC.hp > C.api.maxHp() * 0.3, `po wygranej walce mikstury uzupełniają życie (${p3 - C.api.countItem('bigpot')} wypite)`);

console.log('Punkty statystyk');
const D = mkPlayer('Atrybuty', 'war'); tick(2); const PD = D.api.P(); PD.lvl = 11; world.gear.changed(D); gmsg(D, { a: 'get' });
ok(lastGear(D).pts === 10, '1 punkt za każdy poziom powyżej 1 (poz. 11 → 10 pkt)');
const atk0 = D.api.stats().atk, hp0b = D.api.maxHp();
for (let i = 0; i < 3; i++) gmsg(D, { a: 'attr', k: 'str', n: 1 });
ok(PD.attr.str === 3 && D.api.stats().atk === atk0 + 3 && D.api.maxHp() === hp0b + 9, `Siła +3 → atak +3, życie +9 (${atk0} → ${D.api.stats().atk})`);
gmsg(D, { a: 'attr', k: 'agi', n: 50 });
ok(PD.attr.agi === 7 && lastGear(D).pts === 0, 'nie można rozdać więcej punktów, niż się ma');
gmsg(D, { a: 'attr', k: 'hack', n: 1 }); gmsg(D, { a: 'attr', k: 'int', n: 1 });
ok(!PD.attr.hack && (PD.attr.int | 0) === 0, 'nieznany atrybut i brak punktów – odrzucone');
place(D, 'forest', 5, 5); PD.gold = 10000; gmsg(D, { a: 'attrReset' });
ok(PD.attr.str === 3, 'reset punktów tylko u kapłana');
const pr = Object.keys(D.api.npcs).find((k) => D.api.npcs[k].heal); const pn = D.api.npcs[pr];
place(D, pn.area, pn.x, pn.y + 1); tick(1); gmsg(D, { a: 'attrReset' });
ok(PD.attr.str === 0 && PD.gold < 10000, `u kapłana (${pn.n}) reset za złoto`);

console.log('Kara za śmierć i zwoje teleportacji');
const E = mkPlayer('Smiertelny', 'war'); tick(2); const PE = E.api.P(); PE.lvl = 10; PE.xp = 500; PE.gold = 1000;
const need = E.api.xpNext(10);
place(E, 'forest', 5, 5); E.api.die(); tick(1);
ok(PE.xp === 500 - Math.floor(need * 0.05) && PE.gold === 900, `śmierć: −10% złota i −5% PD do następnego poziomu (${500} → ${PE.xp} PD), poziom zostaje`);
tick(40);
PE.xp = 3; E.api.die(); tick(40);
ok(PE.xp === 0 && PE.lvl === 10, 'PD nie spadają poniżej zera, poziom się nie zmienia');
E.api.addItem('tp_town', 1); place(E, 'forest', 5, 5); tick(2);
send(E, [{ a: 'use', id: 'tp_town' }]); tick(10);
ok(PE.area === 'town' && E.api.countItem('tp_town') === 0, 'zwój teleportacji przenosi do Srebrnogrodu i znika');
ok(E.api.shops.alch.indexOf('tp_town') >= 0 && Object.keys(E.api.shops).filter((k) => E.api.shops[k].some((i) => /^tp_/.test(i))).length >= 6, 'zwoje teleportacji są w sklepach alchemików');

console.log(`\nRunda 9: ${pass} OK, ${fail} błędów`);
process.exit(fail ? 1 : 0);
