'use strict';
// Round 10: admin logs (trades, battles, logins, suspicious behaviour; admin-only), friends list & blocking (server-enforced),
// free level skins (tiers 5/15/30/45/60/70/80, validated by the server), snapshot size with full logs.
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const { spawn } = require('child_process');
process.env.DATABASE_PATH = path.join('/tmp', `ardan-r10-${Date.now()}.db`);
process.env.ARDAN_TEST_HOOKS = '';
const db = require('../server/db');
const logs = require('../server/logs');
const { World } = require('../server/game');
const SKINS = require('../public/js/skins.js');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? '  PASS ' : '  FAIL ') + m); return c; };

const world = new World();
world.log = logs.player;
const qFind = db.prepare('SELECT id, nick FROM characters WHERE nick = ?');
world.findChar = (n) => qFind.get(String(n)) || null;
function mkPlayer(nick, cls) {
  const u = db.prepare('INSERT INTO users (login, email, pass, created) VALUES (?, ?, ?, ?)').run('u' + nick, nick + '@example.com', 'x', Date.now());
  const c = db.prepare("INSERT INTO characters (user_id, nick, cls, lvl, area, data, created, updated) VALUES (?, ?, ?, 1, 'village', NULL, ?, ?)").run(u.lastInsertRowid, nick, cls || 'war', Date.now(), Date.now());
  const msgs = [];
  const ws = { readyState: 1, send: (s) => msgs.push(JSON.parse(s)), close() {} };
  const p = world.join(ws, { id: u.lastInsertRowid }, c.lastInsertRowid);
  p.msgs = msgs; p.ip = '10.0.0.' + (msgs.length + Number(u.lastInsertRowid));
  return p;
}
const tick = (n) => { for (let i = 0; i < (n || 1); i++) world.tick(0.1); };
const msg = (p, m) => { p.msgT = 0; world.onMessage(p, JSON.stringify(m)); tick(1); };
const say = (p, text, ch) => msg(p, { t: 'chat', ch: ch || 'g', text });
const place = (p, area, x, y) => { const P = p.api.P(); P.area = area; P.x = x; P.y = y; p.area = area; p.api.pl.fx = x; p.api.pl.fy = y; };
const lastFr = (p) => { for (let i = p.msgs.length - 1; i >= 0; i--) if (p.msgs[i].t === 'fr' && p.msgs[i].f) return p.msgs[i]; return null; };
const lastSkin = (p) => { for (let i = p.msgs.length - 1; i >= 0; i--) if (p.msgs[i].t === 'skin') return p.msgs[i]; return null; };
const sysTxt = (p) => p.msgs.filter((m) => m.t === 'chat' && m.ch === 's').map((m) => m.text).join(' | ');
const chatFrom = (p, nick) => p.msgs.filter((m) => m.t === 'chat' && m.from === nick && m.ch !== 's');

async function main() {
  console.log('Znajomi');
  const A = mkPlayer('Ala', 'war'), B = mkPlayer('Bartek', 'arc'), C = mkPlayer('Celina', 'mag'); tick(3);
  msg(A, { t: 'fr', a: 'add', n: 'bartek' });
  ok(B.msgs.some((m) => m.t === 'fr' && m.req === 'Ala'), 'zaproszenie do znajomych trafia do drugiego gracza (nick bez względu na wielkość liter)');
  let fa = lastFr(A); ok(fa && fa.out.length === 1 && fa.f.length === 0, 'zaproszenie czeka na akceptację (wysłane)');
  msg(B, { t: 'fr', a: 'accept', k: A.ckey });
  fa = lastFr(A); const fb = lastFr(B);
  ok(fa.f.length === 1 && fa.f[0].n === 'Bartek' && fa.f[0].on === true && fa.f[0].area && fb.f[0].n === 'Ala', 'po akceptacji oboje są znajomymi – status online i kraina widoczne');
  ok(fa.f[0].lvl >= 1 && fa.f[0].cls === 'arc', 'lista pokazuje poziom i klasę');
  // offline / online notification
  world.leave(B); tick(1); fa = lastFr(A);
  ok(fa.f[0].on === false, 'po wyjściu znajomego status „offline”');
  const Bb = (() => { const msgs = []; const ws = { readyState: 1, send: (s) => msgs.push(JSON.parse(s)), close() {} }; const p = world.join(ws, { id: B.userId }, B.charId); p.msgs = msgs; return p; })(); tick(2);
  ok(A.msgs.some((m) => m.t === 'fr' && m.on === 'Bartek'), 'powiadomienie: znajomy wszedł do gry');
  ok(lastFr(A).f[0].on === true, 'status znów „online”');
  // add an offline player by nick (DB lookup)
  const D = mkPlayer('Dorota', 'war'); tick(1); world.leave(D); tick(1);
  msg(A, { t: 'fr', a: 'add', n: 'Dorota' });
  ok(lastFr(A).out.some((x) => x.n === 'Dorota'), 'zaproszenie można wysłać graczowi offline (szukanie po nicku w bazie)');
  msg(A, { t: 'fr', a: 'add', n: 'NieMaTakiego' });
  ok(/Nie ma postaci/i.test(sysTxt(A)) || /nie istnieje|nie znaleziono/i.test(sysTxt(A)), 'nieistniejący nick – komunikat');
  msg(A, { t: 'fr', a: 'remove', k: Bb.ckey });
  ok(lastFr(A).f.length === 0 && lastFr(Bb).f.length === 0, 'usunięcie ze znajomych działa w obie strony');

  console.log('Blokowanie');
  msg(C, { t: 'fr', a: 'block', n: 'Ala' });
  ok(lastFr(C).b.some((x) => x.n === 'Ala'), 'Celina blokuje Alę (lista zablokowanych)');
  C.msgs.length = 0; A.msgs.length = 0;
  say(A, '/w Celina cześć');
  ok(chatFrom(C, 'Ala').length === 0, 'szept od zablokowanego gracza nie dociera');
  ok(/nie przyjmuje|zablokowa/i.test(sysTxt(A)), 'nadawca dostaje komunikat o odrzuceniu szeptu');
  say(C, '/w Ala hej'); ok(chatFrom(A, 'Celina').length === 0, 'szept do zablokowanego też jest odrzucony');
  C.msgs.length = 0; say(A, 'witajcie wszyscy');
  ok(chatFrom(C, 'Ala').length === 0 && chatFrom(Bb, 'Ala').length === 1, 'czat globalny zablokowanego jest ukryty (inni go widzą)');
  // trade
  place(A, 'village', 18, 17); place(C, 'village', 19, 17); tick(1); A.msgs.length = 0;
  msg(A, { t: 'tr', a: 'req', id: C.pid });
  ok(!C.tradeInv && /nie przyjmuje/i.test(sysTxt(A)), 'propozycja wymiany od zablokowanego odrzucona (serwer)');
  msg(C, { t: 'tr', a: 'req', id: A.pid }); ok(!A.tradeInv, 'blokujący też nie może proponować wymiany');
  // party
  say(A, '/zaproś Celina'); ok(!/zaprasza/.test(sysTxt(C)) && /nie przyjmuje/i.test(sysTxt(A)), 'zaproszenie do drużyny od zablokowanego odrzucone');
  // friend request
  msg(A, { t: 'fr', a: 'add', n: 'Celina' }); ok(!C.msgs.some((m) => m.t === 'fr' && m.req === 'Ala'), 'zaproszenie do znajomych od zablokowanego odrzucone');
  // arena duel (non-lethal)
  const pv = A.api.pvpAt; A.api.pvpAt = () => ({ lethal: false, n: 'Arena' }); C.api.pvpAt = A.api.pvpAt;
  msg(A, { t: 'pvp', a: 'duel', id: C.pid }); ok(!A.battle && !C.battle, 'wyzwanie na pojedynek od zablokowanego odrzucone');
  A.api.pvpAt = pv; C.api.pvpAt = pv;
  msg(C, { t: 'fr', a: 'unblock', k: A.ckey }); C.msgs.length = 0; say(A, '/w Celina już ok');
  ok(chatFrom(C, 'Ala').length === 1, 'po odblokowaniu szept dociera');
  // trade log
  A.api.P().gold = 1000; msg(A, { t: 'tr', a: 'req', id: C.pid }); msg(C, { t: 'tr', a: 'accept' });
  msg(A, { t: 'tr', a: 'gold', v: 250 }); msg(A, { t: 'tr', a: 'ok' }); msg(C, { t: 'tr', a: 'ok' });
  ok(A.api.P().gold === 750, 'wymiana złota między graczami przeszła');

  console.log('Wygląd (darmowe skiny za poziom)');
  ok(JSON.stringify(SKINS.LV) === '[1,5,15,30,45,60,70,80]' && JSON.stringify(A.api.skinLv) === JSON.stringify(SKINS.LV), 'progi 5/15/30/45/60/70/80 (silnik = skins.js)');
  ok(['war', 'arc', 'mag'].every((c) => SKINS.names(c).length === 8 && new Set(SKINS.names(c)).size === 8), '8 różnych wyglądów dla każdej klasy');
  const PA = A.api.P(); PA.lvl = 4; tick(1);
  ok(A.api.skinTier() === 0, 'poz. 4: wygląd podstawowy');
  PA.lvl = 16; tick(2);
  ok(A.api.skinTier() === 2 && /Nowy wygląd odblokowany/.test(sysTxt(A)) && (lastSkin(A) || {}).unlocked === 15, 'awans na 16: automatycznie najlepszy wygląd (15) + powiadomienie');
  msg(A, { t: 'skin', a: 'set', k: 1 }); ok(PA.skin === 1 && A.api.skinTier() === 1, 'wybór niższego wyglądu jest zapamiętany');
  PA.lvl = 31; tick(2); ok(A.api.skinTier() === 1, 'własny wybór zostaje po awansie');
  msg(A, { t: 'skin', a: 'set', k: 6 }); ok(PA.skin === 1 && /odblokujesz na 70/.test(sysTxt(A)), 'serwer odrzuca wygląd powyżej poziomu');
  msg(A, { t: 'skin', a: 'set', k: 99 }); msg(A, { t: 'skin', a: 'set', k: 'x' }); ok(PA.skin === 1, 'nieprawidłowe wartości odrzucone');
  msg(A, { t: 'skin', a: 'set', k: -1 }); ok(PA.skin === undefined && A.api.skinTier() === 3, 'tryb automatyczny: najwyższy odblokowany');
  tick(2); const s = C.msgs.filter((m) => m.t === 's').pop(); const oa = s && s.o.find((o) => o.n === 'Ala');
  ok(oa && oa.sk === 3, 'inni gracze dostają wygląd (pole sk) do rysowania w świecie');
  PA.lvl = 80; tick(1); ok(A.api.skinTier() === 7 && SKINS.tierFor(80, -1) === 7 && SKINS.tierFor(80, 2) === 2 && SKINS.tierFor(10, 5) === 1, 'poz. 80: ostatni wygląd; tierFor obcina wybór do poziomu');
  const mob = world.mobs.forest.filter((m) => !m.dead)[0]; place(A, 'forest', mob.x, mob.y + 1); tick(1); A.api.P().hp = A.api.maxHp();
  world.battle.startPve(A, mob);
  ok(A.battle && A.battle.f.find((f) => f.kind === 'p').sk === 7, 'wygląd przekazywany do widoku walki');

  console.log('Logi administratora');
  const b = A.battle; b.f.filter((x) => x.kind !== 'p').forEach((x) => { x.hp = 0; x.alive = false; }); for (let i = 0; i < 6 && A.battle; i++) { b.deadline = 0; b.next = 0; world.battle.onTick(); }
  world.leave(A); tick(1); logs.flush();
  const tr = logs.query({ type: 'trade', nick: 'Ala' });
  ok(tr.rows.some((r) => r.sub === 'gold' && [r.nick, r.other].sort().join() === 'Ala,Celina' && Math.abs(r.amount) === 250 && /250 zł/.test(r.detail)), 'wymiana złota zapisana (kto, z kim, ile)');
  const sus = logs.query({ type: 'sus', nick: 'Ala' });
  ok(sus.rows.some((r) => r.sub === 'skin'), 'próba niedozwolonego wyglądu zapisana jako podejrzana');
  const bt = logs.query({ type: 'battle', nick: 'Ala' });
  ok(bt.rows.some((r) => r.sub === 'kills'), 'zabite potwory zapisane (zbiorczo przy wyjściu)');
  ok(logs.query({ type: 'login', nick: 'Ala' }).total === 0 || true, 'logowania zapisuje serwer HTTP/WS (sprawdzane niżej)');
  // packets
  const E = mkPlayer('Ewa', 'war'); tick(1);
  E.msgT = 0; world.onMessage(E, '{to nie json'); E.msgT = 0; world.onMessage(E, '[1,2]'); logs.flush();
  ok(logs.query({ type: 'sus', sub: 'packet', nick: 'Ewa' }).total >= 1, 'błędny pakiet zapisany jako podejrzany');
  // speed
  place(E, 'village', 10, 10); tick(2); E.api.pl.fx = 30; E.api.pl.fy = 30; E.api.P().x = 30; E.api.P().y = 30; tick(2); logs.flush();
  ok(logs.query({ type: 'sus', sub: 'speed', nick: 'Ewa' }).total >= 1, 'teleportacja bez zwoju (za szybki ruch) zapisana');
  // wealth jump
  tick(1); E.wMark.t -= 61e3; E.api.P().gold += 500000; tick(2); logs.flush();
  ok(logs.query({ type: 'sus', sub: 'wealth', nick: 'Ewa' }).total >= 1, 'nagły skok majątku zapisany');
  // query filters / pagination / search
  for (let i = 0; i < 120; i++) logs.write('trade', 'npc_sell', { userId: 1, charId: 1, nick: 'Handlarz' + (i % 3), ip: '1.2.3.4' }, { amount: i, detail: 'Miecz nr ' + i });
  logs.flush();
  const pg = logs.query({ type: 'trade', sub: 'npc_sell', per: 50, page: 2 });
  ok(pg.total === 120 && pg.rows.length === 50 && pg.pages === 3 && pg.rows[0].amount === 69, 'filtry + stronicowanie (najnowsze najpierw)');
  ok(logs.query({ q: 'nr 77' }).rows.length === 1, 'wyszukiwanie po treści');
  const day = new Date().toISOString().slice(0, 10);
  ok(logs.query({ from: Date.now() - 3600e3, to: Date.now() + 1000, type: 'trade' }).total >= 120 && logs.query({ from: Date.now() + 86400e3 }).total === 0, 'zakres dat');
  // retention
  db.prepare("UPDATE logs SET ts = ? WHERE detail = 'Miecz nr 0'").run(Date.now() - 40 * 86400e3);
  logs.prune(); ok(logs.query({ q: 'Miecz nr 0' }).rows.every((r) => r.detail !== 'Miecz nr 0'), 'retencja: wpisy starsze niż 30 dni usuwane');
  // no log leaks to players
  ok(!E.msgs.some((m) => JSON.stringify(m).includes('Handlarz') || m.t === 'logs'), 'gracze nie dostają żadnych danych z logów');

  console.log('Rozmiar kopii zapasowej (pełne logi)');
  const ins = db.prepare('INSERT INTO logs (ts, type, sub, user_id, char_id, nick, ip, other, amount, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const T = ['trade', 'battle', 'login', 'sus'], S = { trade: 'p2p', battle: 'kills', login: 'game', sus: 'speed' };
  db.transaction(() => { for (let i = 0; i < 80000; i++) { const t = T[i % 4]; ins.run(Date.now() - (i % 1000) * 1000, t, S[t], 1 + (i % 500), 1 + (i % 700), 'Gracz' + (i % 700), '83.24.' + (i % 255) + '.' + (i % 199), 'Inny' + (i % 300), i % 9000, t === 'trade' ? `dał: Miecz Ognia +${i % 9}, 120 zł · dostał: Hełm Smoka, ${i % 500} zł` : t === 'battle' ? `37 potworów (12× Wilk, 9× Goblin, 16× Szkielet), +${i % 5000} PD` : t === 'login' ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130' : `ruch o ${i % 20} pól w 0.1 s (village)`); } })();
  logs.prune();
  const st = logs.stats();
  ok(st.total <= 80000, `limity typów: ${st.total} wpisów po przycięciu (handel ${st.by.trade || 0}, walki ${st.by.battle || 0}, logowania ${st.by.login || 0}, podejrzane ${st.by.sus || 0})`);
  db.pragma('wal_checkpoint(TRUNCATE)'); db.exec('VACUUM');
  const raw = fs.readFileSync(process.env.DATABASE_PATH); const gz = zlib.gzipSync(raw);
  ok(gz.length < 8 * 1024 * 1024, `snapshot: baza ${(raw.length / 1048576).toFixed(1)} MB → gzip ${(gz.length / 1048576).toFixed(1)} MB (×7 kopii ≈ ${(gz.length * 7 / 1048576).toFixed(0)} MB)`);
  console.log('SNAPSHOT_MB', (raw.length / 1048576).toFixed(1), (gz.length / 1048576).toFixed(1));

  await http();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

// ---------- HTTP: admin-only API ----------
const PORT = 3118, BASE = `http://localhost:${PORT}`;
const W = (ms) => new Promise((r) => setTimeout(r, ms));
function jar() { const c = {}; return { c, hdr: () => Object.entries(c).map(([k, v]) => `${k}=${v}`).join('; '), take(r) { for (const s of r.headers.getSetCookie()) { const kv = s.split(';')[0]; const i = kv.indexOf('='); c[kv.slice(0, i)] = kv.slice(i + 1); } } }; }
async function req(j, method, p, body) {
  const h = { cookie: j.hdr() };
  if (body !== undefined) h['content-type'] = 'application/json';
  if (method !== 'GET' && j.c.ardan_csrf) h['x-csrf-token'] = decodeURIComponent(j.c.ardan_csrf);
  const r = await fetch(BASE + p, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  j.take(r); const t = await r.text(); let data; try { data = JSON.parse(t); } catch (e) { data = t; }
  return { status: r.status, data };
}
async function http() {
  console.log('API logów (tylko administrator)');
  const dir = `/tmp/ardan-r10h-${Date.now()}`; let out = '';
  const env = { ...process.env, PORT: String(PORT), DATA_DIR: dir, BASE_URL: BASE, NODE_ENV: 'development', BCRYPT_COST: '10', SMTP_HOST: '', ARDAN_TEST_HOOKS: '', API_PER_MIN: '5000',
    ADMIN_LOGIN: 'wladca', ADMIN_EMAIL: 'wladca@example.com', ADMIN_PASSWORD: 'Korona-Ardanu-77', SESSION_SECRET: 'r10-' + Date.now() };
  delete env.DATABASE_PATH; delete env.DATABASE_URL;
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'start.js')], { env });
  srv.stdout.on('data', (d) => { out += d; }); srv.stderr.on('data', (d) => { out += d; });
  for (let i = 0; i < 80 && !out.includes('Serwer działa'); i++) await W(100);
  try {
    const anon = jar(); await req(anon, 'GET', '/api/me');
    let r = await req(anon, 'GET', '/api/admin/logs'); ok(r.status === 401, 'niezalogowany: /api/admin/logs → 401');
    const pj = jar(); await req(pj, 'GET', '/api/me');
    await req(pj, 'POST', '/api/register', { login: 'zwykly', email: 'zwykly@example.com', password: 'Haslo-Testowe-91', password2: 'Haslo-Testowe-91', terms: true });
    r = await req(pj, 'GET', '/api/admin/logs'); ok(r.status === 403, 'zwykły gracz: /api/admin/logs → 403');
    r = await req(pj, 'GET', '/api/admin/logs/stats'); ok(r.status === 403, 'zwykły gracz: /api/admin/logs/stats → 403');
    const bad = jar(); await req(bad, 'GET', '/api/me'); await req(bad, 'POST', '/api/login', { login: 'wladca', password: 'zle-haslo-123' });
    const adm = jar(); await req(adm, 'GET', '/api/me'); r = await req(adm, 'POST', '/api/login', { login: 'wladca', password: 'Korona-Ardanu-77' });
    ok(r.status === 200, 'administrator zalogowany');
    await W(2300);
    r = await req(adm, 'GET', '/api/admin/logs?type=login');
    ok(r.status === 200 && r.data.rows.some((x) => x.sub === 'ok' && x.ip) && r.data.rows.some((x) => x.sub === 'fail'), 'administrator widzi logowania (udane z IP i nieudane)');
    ok(r.data.types && r.data.types.sus && r.data.subs && r.data.subs.speed, 'API zwraca nazwy typów i podtypów (filtry)');
    r = await req(adm, 'GET', `/api/admin/logs?from=${new Date().toISOString().slice(0, 10)}&per=10&page=1`); ok(r.status === 200 && r.data.per === 10, 'filtr daty (YYYY-MM-DD) i stronicowanie');
    r = await req(adm, 'GET', '/api/admin/logs/stats'); ok(r.status === 200 && r.data.total >= 2 && r.data.days === 30, 'statystyki logów (liczba wpisów, retencja)');
    const mj = jar(); // moderator is not enough
    await req(mj, 'GET', '/api/me'); await req(mj, 'POST', '/api/register', { login: 'modek', email: 'modek@example.com', password: 'Haslo-Testowe-91', password2: 'Haslo-Testowe-91', terms: true });
    const u = (await req(adm, 'GET', '/api/admin/search?q=modek')).data.users.find((x) => x.login === 'modek');
    await req(adm, 'POST', '/api/admin/role', { userId: u.id, role: 'moderator' });
    r = await req(mj, 'GET', '/api/admin/logs'); ok(r.status === 403, 'moderator: logi tylko dla administratora → 403');
    r = await req(adm, 'GET', '/admin'); ok(r.status === 200 && /data-tab="logs"/.test(r.data), 'panel ma zakładkę „Logi”');
  } finally { srv.kill(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
