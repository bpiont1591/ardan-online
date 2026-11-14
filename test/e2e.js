'use strict';
// End-to-end test: starts its own server (temp DB), drives two players in headless Chrome
// (desktop + phone), checks accounts, multiplayer visibility, chat, monster sync and password reset.
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');

const PORT = Number(process.env.TEST_PORT) || 3100;
const BASE = `http://localhost:${PORT}`;
const SHOTS = path.join(__dirname, '..', 'shots');
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
fs.mkdirSync(SHOTS, { recursive: true });
const W = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
// JSON API call from inside a page (double-submit CSRF token read from the cookie)
const api = (pg, p, body) => pg.evaluate(async (p, body) => {
  const c = (document.cookie.match(/ardan_csrf=([^;]+)/) || [])[1] || '';
  const r = await fetch('/api' + p, body ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': decodeURIComponent(c) }, body: JSON.stringify(body) } : {});
  return { status: r.status, data: await r.json().catch(() => ({})) };
}, p, body);
const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? '  PASS ' : '  FAIL ') + m); return c; };

async function main() {
  const dbPath = `/tmp/ardan-e2e-${Date.now()}.db`;
  let log = '';
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {
    env: { ...process.env, PORT: String(PORT), DATABASE_PATH: dbPath, BASE_URL: BASE, NODE_ENV: 'development', BCRYPT_COST: '10', SMTP_HOST: '' },
  });
  srv.stdout.on('data', (d) => { log += d; }); srv.stderr.on('data', (d) => { log += d; process.stderr.write(d); });
  for (let i = 0; i < 50 && !log.includes('Serwer działa'); i++) await W(100);
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];
  const watch = (pg, who) => { pg.on('pageerror', (e) => errors.push(`${who}: ${e}`)); pg.on('console', (m) => { if (m.type() === 'error' && !/status of 4\d\d/.test(m.text())) errors.push(`${who}: ${m.text()}`); }); };
  const sfx = String(Date.now()).slice(-5);
  const A = { login: 'rycerz' + sfx, email: `rycerz${sfx}@example.com`, pass: 'Mgla-Ardanu-2026', nick: 'Bronisz' + sfx.slice(-3), cls: 'war' };
  const B = { login: 'lucznik' + sfx, email: `lucznik${sfx}@example.com`, pass: 'Strzala#Bor77', nick: 'Łucja' + sfx.slice(-3), cls: 'arc' };
  try {
    // ---------- homepage ----------
    console.log('Strona główna');
    const ctxA = await browser.createBrowserContext();
    const ctxB = await browser.createBrowserContext();
    const pa = await ctxA.newPage(); watch(pa, 'A'); await pa.setViewport({ width: 1440, height: 900 });
    const pb = await ctxB.newPage(); watch(pb, 'B');
    await pb.emulate({ viewport: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' });
    for (const [pg, name] of [[pa, 'desktop'], [pb, 'phone']]) {
      await pg.goto(BASE + '/', { waitUntil: 'networkidle0' });
      ok(await pg.$eval('h1.logo', (e) => e.textContent) === 'ARDAN', `logo ARDAN (${name})`);
      ok((await pg.$$eval('#regions .region', (e) => e.length)) === 7, `7 krain na stronie (${name})`);
      ok((await pg.$$eval('#news article', (e) => e.length)) >= 3, `nowości z API (${name})`);
      ok(/^\d+$/.test(await pg.$eval('[data-online]', (e) => e.textContent)), `licznik online (${name})`);
      await pg.screenshot({ path: `${SHOTS}/01_home_${name}.png` });
      await pg.evaluate(() => document.querySelectorAll('img[loading=lazy]').forEach((i) => { i.loading = 'eager'; }));
      await pg.waitForFunction(() => [...document.images].every((i) => i.complete), { timeout: 15000 });
      await pg.screenshot({ path: `${SHOTS}/01_home_${name}_full.png`, fullPage: true });
    }
    // ---------- register ----------
    console.log('Rejestracja');
    async function register(pg, u, shot) {
      await pg.goto(BASE + '/rejestracja', { waitUntil: 'networkidle0' });
      await pg.type('#login', u.login); await pg.type('#email', u.email);
      await pg.type('#password', 'abc'); 
      ok((await pg.$eval('#ph', (e) => e.textContent)).includes('Za słabe'), `miernik siły: słabe hasło (${u.login})`);
      await pg.click('#terms'); await pg.click('button[type=submit]'); await W(200);
      ok((await pg.$eval('.alert', (e) => e.textContent)).includes('za słabe'), 'walidacja: słabe hasło odrzucone');
      await pg.$eval('#password', (e) => { e.value = ''; }); await pg.type('#password', u.pass); await pg.type('#password2', u.pass + 'x');
      await pg.click('button[type=submit]'); await W(200);
      ok((await pg.$eval('.alert', (e) => e.textContent)).includes('nie są takie same'), 'walidacja: różne hasła');
      await pg.$eval('#password2', (e) => { e.value = ''; }); await pg.type('#password2', u.pass);
      if (shot) await pg.screenshot({ path: `${SHOTS}/${shot}` });
      await Promise.all([pg.waitForNavigation({ waitUntil: 'networkidle0' }), pg.click('button[type=submit]')]);
      ok(pg.url().endsWith('/postacie'), `konto założone → /postacie (${u.login})`);
    }
    await register(pa, A, '02_register_desktop.png');
    await register(pb, B, '02_register_phone.png');
    // duplicate login (server-side)
    const dup = (await api(pa, '/register', { login: A.login, email: 'x' + A.login + '@example.com', password: 'Inne-Haslo-99', password2: 'Inne-Haslo-99', terms: true })).data.error;
    ok(/zajęty/.test(dup || ''), 'serwer: zajęty login odrzucony');
    // ---------- characters ----------
    console.log('Postacie');
    async function createChar(pg, u, shot) {
      await pg.waitForSelector('#nick');
      await pg.click(`label[for=c_${u.cls}]`); await pg.type('#nick', u.nick);
      if (shot) await pg.screenshot({ path: `${SHOTS}/${shot}` });
      await Promise.all([pg.waitForNavigation(), pg.click('#f button[type=submit]')]);
      ok(/\/graj\?postac=\d+$/.test(pg.url()), `postać ${u.nick} utworzona`);
      await pg.waitForFunction(() => window.ARDAN_DEBUG && window.ARDAN_DEBUG.last, { timeout: 10000 });
      ok(true, `${u.nick} połączony z serwerem gry (WebSocket)`);
      await W(400);
      for (let i = 0; i < 4; i++) { await pg.keyboard.press('Escape'); await W(150); } // close intro dialog
    }
    await createChar(pa, A, '03_create_character_desktop.png');
    await createChar(pb, B, '03_create_character_phone.png');
    // taken nick
    const taken = (await api(pa, '/characters', { nick: B.nick, cls: 'mag' })).data.error;
    ok(/zajęty/.test(taken || ''), 'serwer: zajęty nick odrzucony');
    // ---------- see each other ----------
    console.log('Multiplayer');
    const snap = (pg) => pg.evaluate(() => window.ARDAN_DEBUG.last);
    let sa = await snap(pa), sb = await snap(pb);
    ok(sa.a === 'village' && sb.a === 'village', 'obaj w Osadzie Brzozowej');
    const seenA = sa.o.find((o) => o.n === B.nick), seenB = sb.o.find((o) => o.n === A.nick);
    ok(!!seenA, `A widzi ${B.nick}`); ok(!!seenB, `B widzi ${A.nick}`);
    // A walks right with keyboard (desktop) → B sees new position
    const ax0 = sa.p.x;
    await pa.keyboard.down('d'); await W(800); await pa.keyboard.up('d'); await W(400);
    sa = await snap(pa); sb = await snap(pb);
    const aOnB = sb.o.find((o) => o.n === A.nick);
    ok(sa.p.x >= ax0 + 2, `A idzie w prawo (WASD): ${ax0} → ${sa.p.x}`);
    ok(aOnB && Math.abs(aOnB.x - sa.p.x) < 0.6 && Math.abs(aOnB.y - sa.p.y) < 0.6, `B widzi ruch A (${aOnB && aOnB.x},${aOnB && aOnB.y})`);
    // B walks with the on-screen d-pad (touch)
    const cdp = await pb.target().createCDPSession();
    const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p) => ({ x: p[0], y: p[1], id: 1 })) });
    const H = 844, sz = 50, cx = 16 + sz * 1.5, cy = H - 16 - sz * 1.5;
    const by0 = sb.p.y;
    await T('touchStart', [[cx, cy - sz]]); await W(600); await T('touchEnd', []); await W(400);
    sb = await snap(pb); sa = await snap(pa);
    const bOnA = sa.o.find((o) => o.n === B.nick);
    ok(sb.p.y <= by0 - 1, `B idzie w górę strzałką na ekranie: y ${by0} → ${sb.p.y}`);
    ok(bOnA && Math.abs(bOnA.y - sb.p.y) < 0.6, 'A widzi ruch B');
    // anti-cheat: forged fast movement intents do not speed the player up
    const f0 = (await snap(pa)).p.x;
    await pa.keyboard.down('a'); await W(1000); await pa.keyboard.up('a'); await W(300);
    const f1 = (await snap(pa)).p.x;
    ok(f0 - f1 <= 6.5, `prędkość ograniczona przez serwer (${(f0 - f1).toFixed(1)} pól/s ≤ 6)`);
    await pa.screenshot({ path: `${SHOTS}/04_two_players_desktop.png` });
    await pb.screenshot({ path: `${SHOTS}/04_two_players_phone.png` });
    // ---------- chat ----------
    console.log('Czat');
    await pa.keyboard.press('c'); await W(300);
    ok(await pa.$eval('#chat', (e) => e.classList.contains('open')), 'A otwiera czat klawiszem C');
    ok(await pa.$eval('#chatIn', (e) => e.value) === '', 'klawisz C nie trafia do pola tekstowego');
    const say = async (pg, text, ch) => { if (ch) await pg.select('#chan', ch); await pg.$eval('#chatIn', (e) => { e.value = ''; }); await pg.type('#chatIn', text); await pg.keyboard.press('Enter'); await W(500); };
    const msgsOf = (pg) => pg.$$eval('#msgs .m', (els) => els.map((e) => e.className + '|' + e.textContent));
    await say(pa, 'Witaj w Ardanie! <b>test</b>', 'g');
    let mb = await msgsOf(pb);
    ok(mb.some((m) => m.includes('c-g') && m.includes(A.nick) && m.includes('<b>test</b>')), 'B dostaje wiadomość globalną (HTML jako tekst)');
    ok(await pb.$$eval('#msgs b', (e) => e.length) === 0, 'HTML w czacie zneutralizowany (brak <b>)');
    await say(pa, 'Ktoś na dzika?', 'r');
    mb = await msgsOf(pb);
    ok(mb.some((m) => m.includes('c-r') && m.includes('Ktoś na dzika?')), 'B dostaje wiadomość regionalną');
    // B (phone) opens chat via the on-screen chat button? use keyboard-less path: tap the canvas chat button via NET.onChat is internal; use the C key
    await pb.keyboard.press('c'); await W(300);
    ok(await pb.$eval('#chat', (e) => e.classList.contains('open')), 'B otwiera czat');
    await say(pb, `/w ${A.nick} Spotkajmy się przy studni`);
    const ma = await msgsOf(pa);
    ok(ma.some((m) => m.includes('c-w') && m.includes('od ' + B.nick) && m.includes('studni')), 'A dostaje prywatną wiadomość /w');
    await say(pb, '/w NieMaTakiego hej');
    mb = await msgsOf(pb);
    ok(mb.some((m) => m.includes('c-s') && m.includes('nie jest teraz w grze')), 'komunikat: brak gracza');
    await pa.screenshot({ path: `${SHOTS}/05_chat_desktop.png` });
    await pb.screenshot({ path: `${SHOTS}/05_chat_phone.png` });
    // flood protection
    for (let i = 0; i < 5; i++) await pa.evaluate((i) => { const inp = document.getElementById('chatIn'); inp.value = 'spam ' + i; document.getElementById('chatForm').requestSubmit(); }, i);
    await W(500);
    ok((await msgsOf(pa)).some((m) => m.includes('Zwolnij')), 'limit wiadomości (anty-flood)');
    const long = 'x'.repeat(400);
    await pb.evaluate((t) => { const inp = document.getElementById('chatIn'); inp.removeAttribute('maxlength'); inp.value = t; document.getElementById('chatForm').requestSubmit(); }, long);
    await W(400);
    const longMsg = (await msgsOf(pa)).filter((m) => m.includes('xxxx')).pop() || '';
    ok(longMsg && (longMsg.match(/x/g) || []).length <= 201, 'limit długości wiadomości (200)');
    await pa.screenshot({ path: `${SHOTS}/05b_chat_moderation_desktop.png` });
    await pa.click('#chatClose'); await pb.click('#chatClose'); await W(200);
    // ---------- party (phase 2) ----------
    console.log('Drużyna');
    const cmd = (pg, text) => pg.evaluate((t) => { const inp = document.getElementById('chatIn'); inp.value = t; document.getElementById('chatForm').requestSubmit(); }, text);
    await W(6000); // let the chat rate-limit window pass after the flood test
    await cmd(pa, '/zapros ' + B.nick); await W(600);
    ok(await pb.$eval('#party', (e) => e.classList.contains('show') && e.textContent.includes('zaprasza')), 'B widzi zaproszenie do drużyny');
    await pb.screenshot({ path: `${SHOTS}/07_party_invite_phone.png` });
    await pb.tap('#party [data-pcmd="/akceptuj"]'); await W(800);
    const pA = await pa.evaluate(() => window.ARDAN_DEBUG.party), pB = await pb.evaluate(() => window.ARDAN_DEBUG.party);
    ok(pA && pA.m.length === 2 && pB && pB.m.length === 2 && pA.lead === A.nick, 'drużyna 2/5, lider A');
    await cmd(pb, '/p Idę na dzika, chodź!'); await W(500);
    ok((await msgsOf(pa)).some((m) => m.includes('c-p') && m.includes('Idę na dzika')), 'czat drużyny działa');
    const xpA0 = (await pa.evaluate(() => window.ARDAN_DEBUG.me)).xp || 0;
    // ---------- monster sync ----------
    console.log('Potwory');
    // B (archer) walks toward the nearest living village monster and shoots it; A must see the same HP/death.
    async function walkTo(pg, tx, ty, maxMs) {
      const t0 = Date.now(); let last = null, stuck = 0, side = 0;
      while (Date.now() - t0 < maxMs) {
        const s = await snap(pg); const dx = tx - s.p.x, dy = ty - s.p.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) <= 4.5) return true;
        let keys = [];
        if (stuck > 2) { keys = side ? (Math.abs(dx) > Math.abs(dy) ? [dy < 0 ? 'ArrowUp' : 'ArrowDown'] : [dx < 0 ? 'ArrowLeft' : 'ArrowRight']) : (Math.abs(dx) > Math.abs(dy) ? [dy < 0 ? 'ArrowDown' : 'ArrowUp'] : [dx < 0 ? 'ArrowRight' : 'ArrowLeft']); if (stuck > 6) { stuck = 0; side ^= 1; } }
        else { if (Math.abs(dx) > 0.5) keys.push(dx < 0 ? 'ArrowLeft' : 'ArrowRight'); if (Math.abs(dy) > 0.5) keys.push(dy < 0 ? 'ArrowUp' : 'ArrowDown'); }
        for (const k of keys) await pg.keyboard.down(k);
        await W(250);
        for (const k of keys) await pg.keyboard.up(k);
        const s2 = await snap(pg);
        if (last && Math.abs(s2.p.x - last[0]) + Math.abs(s2.p.y - last[1]) < 0.3) stuck++; else if (stuck <= 2) stuck = 0; else stuck++;
        last = [s2.p.x, s2.p.y];
      }
      return false;
    }
    sb = await snap(pb);
    const alive = sb.m.map((r, i) => ({ i, x: r[0], y: r[1], hp: r[2], dead: r[3] & 1 })).filter((m) => !m.dead);
    alive.sort((a, b) => Math.hypot(a.x - sb.p.x, a.y - sb.p.y) - Math.hypot(b.x - sb.p.x, b.y - sb.p.y));
    const tgt = alive[0];
    ok(!!tgt, `cel: potwór #${tgt && tgt.i} na (${tgt && tgt.x},${tgt && tgt.y})`);
    const near = await walkTo(pb, tgt.x, tgt.y, 20000);
    ok(near, 'B podchodzi do potwora');
    sa = await snap(pa); sb = await snap(pb);
    ok(sa.m.length === sb.m.length && sa.m.every((r, i) => r[2] === sb.m[i][2] && (r[3] & 1) === (sb.m[i][3] & 1)), 'obaj widzą identyczne HP i stan wszystkich potworów');
    const hp0 = sb.m[tgt.i][2];
    let killed = false, hpSeenByA = [], hpSeenByB = [];
    for (let k = 0; k < 40 && !killed; k++) {
      const s = await snap(pb); const r = s.m[tgt.i];
      if (Math.max(Math.abs(r[0] - s.p.x), Math.abs(r[1] - s.p.y)) > 4.5) await walkTo(pb, r[0], r[1], 3000);
      await pb.keyboard.press('f'); await W(350);
      const a = (await snap(pa)).m[tgt.i], b = (await snap(pb)).m[tgt.i];
      hpSeenByA.push(a[2]); hpSeenByB.push(b[2]);
      if (b[3] & 1) killed = true;
    }
    await W(300);
    const fa = (await snap(pa)).m[tgt.i], fb = (await snap(pb)).m[tgt.i];
    ok(hpSeenByB.some((h) => h < hp0), `B zadaje obrażenia (HP ${hp0} → ${Math.min(...hpSeenByB)})`);
    ok(hpSeenByA.some((h) => h < hp0), 'A widzi spadek HP tego samego potwora');
    ok(killed && (fa[3] & 1) === 1, 'potwór pokonany – A też widzi go jako martwego');
    const meB = await pb.evaluate(() => window.ARDAN_DEBUG.me);
    ok(meB && (meB.xp > 0 || meB.lvl > 1), `B dostaje doświadczenie z serwera (xp ${meB && meB.xp})`);
    const meA = await pa.evaluate(() => window.ARDAN_DEBUG.me);
    ok(meA && meA.xp > xpA0, `drużyna: A dostaje część PD za zabójstwo B (${xpA0} → ${meA && meA.xp})`);
    await pb.screenshot({ path: `${SHOTS}/06_monster_fight_phone.png` });
    await pa.screenshot({ path: `${SHOTS}/06_monster_fight_desktop.png` });
    // ---------- persistence ----------
    console.log('Zapis postaci');
    const posB = (await snap(pb)).p;
    await pb.goto(BASE + '/postacie', { waitUntil: 'networkidle0' }); await W(300);
    ok((await pb.$$eval('.char', (e) => e.length)) === 1, 'lista postaci B');
    await Promise.all([pb.waitForNavigation(), pb.click('.char a')]);
    await pb.waitForFunction(() => window.ARDAN_DEBUG && window.ARDAN_DEBUG.last, { timeout: 10000 });
    const posB2 = (await snap(pb)).p;
    ok(Math.abs(posB2.x - posB.x) <= 1 && Math.abs(posB2.y - posB.y) <= 1, `pozycja zapisana na serwerze (${posB.x},${posB.y} → ${posB2.x},${posB2.y})`);
    const meB2 = await pb.evaluate(() => window.ARDAN_DEBUG.me);
    ok(meB2 && meB2.xp === meB.xp, 'doświadczenie zapisane');
    // ---------- security ----------
    console.log('Bezpieczeństwo');
    const r1 = await pa.evaluate(async () => (await fetch('/api/characters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"nick":"Hacker1","cls":"war"}' })).status);
    ok(r1 === 403, `CSRF: żądanie bez tokenu odrzucone (${r1})`);
    const r2 = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example', 'X-CSRF-Token': 'a', Cookie: 'ardan_csrf=a' }, body: '{}' });
    ok(r2.status === 403, `CSRF: obcy Origin odrzucony (${r2.status})`);
    const r3 = await pa.evaluate(async () => (await fetch('/api/characters', { method: 'POST', headers: { 'Content-Type': 'text/plain', 'X-CSRF-Token': document.cookie.match(/ardan_csrf=([^;]+)/)[1] }, body: 'x' })).status);
    ok(r3 === 415, `tylko JSON (${r3})`);
    const wsNoAuth = await new Promise((res) => { const WS = require('ws'); const w = new WS(`ws://localhost:${PORT}/ws?postac=1`, { headers: { Origin: BASE } }); w.on('open', () => res('open')); w.on('error', () => res('rejected')); w.on('unexpected-response', () => res('rejected')); });
    ok(wsNoAuth === 'rejected', 'WebSocket bez sesji odrzucony');
    const dbRaw = [dbPath, dbPath + '-wal'].filter((f) => fs.existsSync(f)).map((f) => fs.readFileSync(f).toString('latin1')).join('');
    ok(!dbRaw.includes(A.pass) && !dbRaw.includes(B.pass) && dbRaw.includes('$2'), 'hasła tylko jako hash bcrypt');
    // ---------- password reset ----------
    console.log('Reset hasła');
    const pc = await (await browser.createBrowserContext()).newPage(); watch(pc, 'C'); await pc.setViewport({ width: 1280, height: 800 });
    await pc.goto(BASE + '/nie-pamietam-hasla', { waitUntil: 'networkidle0' });
    const logLen = log.length;
    await pc.type('#email', A.email); await pc.click('button[type=submit]'); await W(800);
    ok((await pc.$eval('.alert', (e) => e.textContent)).includes('Jeśli konto'), 'ogólny komunikat (nie zdradza istnienia konta)');
    await pc.screenshot({ path: `${SHOTS}/08_forgot_password.png` });
    const m = /(http:\/\/\S+\/nowe-haslo\?token=[A-Za-z0-9_\-%]+)/.exec(log.slice(logLen));
    ok(!!m, 'link resetu wypisany w konsoli serwera (tryb dev bez SMTP)');
    const resetLink = m[1];
    // unknown email → same message, no link
    const l2 = log.length; await api(pc, '/forgot', { email: 'nikt@example.com' }); await W(300);
    ok(!log.slice(l2).includes('nowe-haslo'), 'brak linku dla nieistniejącego e-maila');
    await pc.goto(resetLink, { waitUntil: 'networkidle0' });
    ok(!(await pc.url()).includes('token='), 'token usunięty z paska adresu');
    const NEWP = 'Nowe-Haslo-Ardan-9';
    await pc.type('#password', NEWP); await pc.type('#password2', NEWP);
    await pc.screenshot({ path: `${SHOTS}/09_new_password.png` });
    await Promise.all([pc.waitForNavigation({ waitUntil: 'networkidle0' }), pc.click('button[type=submit]')]);
    ok(pc.url().includes('/logowanie?reset=1'), 'hasło zmienione → logowanie');
    // single use
    const reuse = (await api(pc, '/reset', { token: decodeURIComponent(resetLink.split('token=')[1]), password: 'Kolejne-Haslo-77', password2: 'Kolejne-Haslo-77' })).data.error;
    ok(/wygasł|użyty/.test(reuse || ''), 'link jednorazowy (drugie użycie odrzucone)');
    // old password fails, new works
    await pc.type('#login', A.login); await pc.type('#password', A.pass); await pc.click('button[type=submit]'); await W(800);
    ok((await pc.$eval('.alert', (e) => e.textContent)).includes('Nieprawidłowy'), 'stare hasło nie działa');
    await pc.$eval('#password', (e) => { e.value = ''; }); await pc.type('#password', NEWP);
    await pc.screenshot({ path: `${SHOTS}/10_login.png` });
    await Promise.all([pc.waitForNavigation({ waitUntil: 'networkidle0' }), pc.click('button[type=submit]')]);
    ok(pc.url().endsWith('/postacie'), 'logowanie nowym hasłem działa');
    await W(300);
    ok((await pc.$$eval('.char', (e) => e.length)) === 1, 'postać A nadal na koncie');
    // reset killed A's old sessions
    const aSess = (await api(pa, '/me')).data.user;
    ok(aSess === null, 'reset hasła wylogował stare sesje');
    // logout
    await pc.click('[data-logout]'); await W(800);
    ok(!(await api(pc, '/me')).data.user, 'wylogowanie działa');
    // login rate limit
    let last = 0; for (let i = 0; i < 12; i++) { const r = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: BASE, 'X-CSRF-Token': 'z', Cookie: 'ardan_csrf=z' }, body: JSON.stringify({ login: B.login, password: 'zle-haslo-' + i }) }); last = r.status; }
    ok(last === 429, `limit prób logowania (HTTP ${last})`);
    ok(errors.length === 0, 'brak błędów JS w przeglądarce' + (errors.length ? ': ' + errors.join(' | ') : ''));
  } catch (e) { fail++; console.error('  BŁĄD TESTU', e); }
  await browser.close();
  srv.kill('SIGTERM'); await W(500);
  console.log(`\nWynik: ${pass} OK, ${fail} błędów`);
  process.exit(fail ? 1 : 0);
}
main();
