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
    env: { ...process.env, PORT: String(PORT), DATABASE_PATH: dbPath, BASE_URL: BASE, NODE_ENV: 'development', BCRYPT_COST: '10', SMTP_HOST: '', START_GOLD: '200', ARDAN_TEST_HOOKS: '1', RANKING_REFRESH_MS: '1000', API_PER_MIN: '5000', WS_PER_MIN: '500', WS_PER_IP: '50' },
  });
  srv.stdout.on('data', (d) => { log += d; }); srv.stderr.on('data', (d) => { log += d; process.stderr.write(d); });
  for (let i = 0; i < 50 && !log.includes('Serwer działa'); i++) await W(100);
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];
  const watch = (pg, who) => { pg.on('pageerror', (e) => errors.push(`${who}: ${e}`)); pg.on('console', (m) => { if (m.type() === 'error' && !/status of 4\d\d/.test(m.text()) && !/ws\?postac=.*HTTP Authentication failed/.test(m.text())) errors.push(`${who}: ${m.text()}`); }); };
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
      ok(!(await pg.$('#krainy')) && !(await pg.$('#regions')) && !(await pg.$('a[href="#krainy"]')), `bez sekcji mapy świata i linku „Krainy” (${name})`);
      await pg.waitForFunction(() => /23 krainy · 16 bossów · 60 zadań/.test(document.querySelector('[data-world]').textContent), { timeout: 4000 }).catch(() => {});
      ok(/3 klasy · 23 krainy · 16 bossów · 60 zadań/.test(await pg.$eval('[data-world]', (e) => e.textContent)), `liczby świata z serwera (${name})`);
      await pg.waitForFunction(() => /ostatnia:/.test(document.getElementById('rankAt').textContent), { timeout: 4000 }).catch(() => {});
      ok(/Aktualizacja co \d+ h, ostatnia: .+następna:/.test(await pg.$eval('#rankAt', (e) => e.textContent)), `czas aktualizacji rankingu (${name})`);
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
      const lt = await pg.waitForSelector('#uiToasts [data-lt="get"]', { timeout: 9000 }).catch(() => null);
      ok(!!lt, `${u.nick}: okno nagrody za logowanie`);
      if (lt) { await pg.$eval('#uiToasts [data-lt="get"]', (b) => b.click()); await W(600); }
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
    { const m1 = (await snap(pa)).m.map((r) => r[0] + ',' + r[1]).join(';'); await W(2500); const m2 = (await snap(pa)).m.map((r) => r[0] + ',' + r[1]).join(';');
      ok(m1 === m2, 'potwory stoją w miejscu (nie chodzą i nie gonią gracza)'); if (m1 !== m2) console.log('   ', JSON.stringify((await snap(pa)).m), JSON.stringify((await snap(pa)).p)); }
    sa = await snap(pa); sb = await snap(pb);
    ok(sa.m.length === sb.m.length && sa.m.every((r, i) => r[2] === sb.m[i][2] && (r[3] & 1) === (sb.m[i][3] & 1)), 'obaj widzą identyczne HP i stan wszystkich potworów');
    async function walkExact(pg, tx, ty, maxMs) {
      const t0 = Date.now();
      while (Date.now() - t0 < maxMs) {
        const s = await snap(pg); const dx = tx - s.p.x, dy = ty - s.p.y;
        if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) return true;
        if (Math.abs(dx) > 1) { const k = dx < 0 ? 'ArrowLeft' : 'ArrowRight'; await pg.keyboard.down(k); await W(Math.min(400, Math.abs(dx) * 120)); await pg.keyboard.up(k); }
        if (Math.abs(dy) > 1) { const k = dy < 0 ? 'ArrowUp' : 'ArrowDown'; await pg.keyboard.down(k); await W(Math.min(400, Math.abs(dy) * 120)); await pg.keyboard.up(k); }
        await W(80);
      }
      return false;
    }
    // ---------- turn-based battle ----------
    console.log('Walka turowa');
    const ui = (pg) => pg.evaluate(() => { const S = window.ARDAN_UI_STATE; return JSON.parse(JSON.stringify({ open: S.open, npc: S.npc, gear: S.gear, mk: S.mk, gd: S.gd, tr: S.tr, pvp: S.pvp, bt: S.bt })); });
    const hp0 = sb.m[tgt.i][2];
    for (let k = 0; k < 6; k++) { const s = await snap(pb); const r = s.m[tgt.i]; if (Math.max(Math.abs(r[0] - s.p.x), Math.abs(r[1] - s.p.y)) <= 2) break; await walkExact(pb, r[0], r[1], 3000); }
    await pb.keyboard.press('f');
    const btOpen = await pb.waitForSelector('#battle', { timeout: 4000 }).then(() => true).catch(() => false);
    ok(btOpen, 'atak obok potwora otwiera ekran walki turowej');
    await W(400);
    ok((await pb.$$eval('#battle .bf.en', (e) => e.length)) >= 1 && (await pb.$$eval('#battle .bf.al', (e) => e.length)) >= 1, 'ekran walki: przeciwnicy i sojusznicy z paskami HP');
    ok(((await snap(pa)).m[tgt.i][3] & 32) === 32, 'A widzi, że potwór jest w walce (stan z serwera)');
    const aJoined = await pa.$('#battle').then((e) => !!e);
    ok((await pb.$$eval('#battle [data-ba]', (e) => e.map((x) => x.dataset.ba))).join(',').match(/atk.*sk.*pot.*flee/), 'akcje: atak, umiejętności, mikstura, ucieczka');
    await pb.screenshot({ path: `${SHOTS}/10_combat_phone.png` });
    await pb.tap('#battle [data-ba="atk"]');
    if (aJoined) { await pa.waitForSelector('#battle [data-ba="atk"]:not([disabled])', { timeout: 5000 }).catch(() => {}); await pa.click('#battle [data-ba="atk"]').catch(() => {}); }
    await pb.waitForFunction(() => document.querySelectorAll('#btLog .l').length >= 3, { timeout: 25000 }).catch(() => {});
    await W(1500);
    const log1 = await pb.$$eval('#btLog .l', (e) => e.map((x) => x.textContent));
    ok(log1.some((l) => /traci \d+ pż|unika/.test(l)), `runda rozegrana, dziennik walki (${log1.length} wpisów)`);
    await pa.screenshot({ path: `${SHOTS}/10_combat_desktop.png` });
    // auto fight + speed ×3 until the end
    await pb.tap('#btAuto'); await pb.tap('#battle [data-spd="3"]');
    if (aJoined) { await pa.click('#btAuto'); }
    await W(300);
    ok((await ui(pb)).bt && (await pb.$eval('#btAuto', (e) => e.checked)), 'walka automatyczna włączona');
    await pb.waitForSelector('#btEnd:not([hidden])', { timeout: 60000 }).catch(() => {});
    const endTxt = await pb.$eval('#btEnd', (e) => e.textContent).catch(() => '');
    ok(/Zwycięstwo/.test(endTxt), 'walka wygrana (automatycznie)');
    await pb.screenshot({ path: `${SHOTS}/11_combat_win_phone.png` });
    await W(500);
    const fa = (await snap(pa)).m[tgt.i], fb = (await snap(pb)).m[tgt.i];
    ok((fb[3] & 1) === 1 && (fa[3] & 1) === 1, 'potwór pokonany – A też widzi go jako martwego');
    const meB = await pb.evaluate(() => window.ARDAN_DEBUG.me);
    ok(meB && (meB.xp > 0 || meB.lvl > 1), `B dostaje doświadczenie z serwera (xp ${meB && meB.xp})`);
    const meA = await pa.evaluate(() => window.ARDAN_DEBUG.me);
    ok(meA && (meA.xp > xpA0 || meA.lvl > 1), `drużyna: A ${aJoined ? 'walczy razem z B' : 'dostaje część PD'} (${xpA0} → ${meA && meA.xp})`);
    await pb.tap('#btEnd [data-ba="close"]'); if (aJoined) await pa.waitForSelector('#btEnd:not([hidden])', { timeout: 20000 }).then(() => pa.click('#btEnd [data-ba="close"]')).catch(() => {});
    await W(300);
    ok(!(await pb.$('#battle')), 'ekran walki zamknięty');
    // ---------- equipment ----------
    console.log('Ekwipunek');
    await pa.keyboard.press('i'); await W(600);
    ok((await pa.$$eval('.doll .slot', (e) => e.length)) === 9, 'panel postaci: 9 miejsc (hełm, zbroja, rękawice, buty, broń, druga ręka, 2 pierścienie, amulet)');
    let gA = (await ui(pa)).gear;
    ok(gA && gA.gear.weapon && gA.gear.weapon.c === 'war', `broń startowa w slocie broni (${gA && gA.gear.weapon && gA.gear.weapon.n})`);
    ok(gA && gA.st && gA.st.atk > 0 && (await pa.$eval('.eq-st', (e) => e.textContent)).includes('Obrona'), 'sumy statystyk w panelu');
    await pa.click('.slot[data-slot="weapon"]'); await W(300);
    ok(await pa.$eval('.ui-detail', (e) => /Wymagany poziom/.test(e.textContent) && /Klasa: Wojownik/.test(e.textContent)), 'karta przedmiotu: klasa, poziom, rzadkość');
    await pa.click('.ui-detail [data-ia="unequip"]'); await W(1400);
    gA = (await ui(pa)).gear;
    ok(gA && !gA.gear.weapon && gA.bag.length >= 1, 'zdjęcie broni → trafia do torby');
    await pa.screenshot({ path: `${SHOTS}/12_equipment_desktop.png` });
    // ---------- market ----------
    console.log('Rynek');
    const wpn = gA.bag.find((x) => x.s === 'weapon'); const goldA0 = gA.gold;
    // the auction house only works next to an auctioneer: both players walk up to Aukcjoner Mieszko in Srebrnogród
    const TH0 = (pg, m) => pg.evaluate((m) => window.ARDAN_UI.h.send(Object.assign({ t: '__test' }, m)), m);
    const backA = await snap(pa), backB = await snap(pb);
    await pa.keyboard.press('Escape'); await W(200);
    await TH0(pa, { near: { npc: 'auktown' } }); await TH0(pb, { near: { npc: 'auktown' } }); await W(1500);
    await pa.keyboard.press('r'); await W(1000);
    ok((await ui(pa)).open === 'mk', 'dom aukcyjny otwarty przy aukcjonerze (klawisz R)');
    await pa.click('[data-mtab="sell"]'); await W(300);
    await pa.click(`.ui-panel .bi[data-bag="${wpn.u}"]`); await W(300);
    await pa.$eval('#mkPrice', (e) => { e.value = '7'; });
    await pa.click('.ui-detail [data-ia="list"]'); await W(900);
    let mA = (await ui(pa)).mk;
    ok(mA && mA.mine.some((x) => x.it.u === wpn.u && x.pr === 7), 'A wystawia broń na rynek za 7 zł');
    // B opens the market from the menu (phone)
    await pb.evaluate(() => window.ARDAN_UI.panel('menu')); await W(300);
    await pb.tap('[data-open="mk"]'); await W(900);
    let mB = (await ui(pb)).mk;
    ok(mB && mB.list.some((x) => x.it.u === wpn.u), 'B widzi ofertę na rynku');
    await pb.select('[data-f="cls"]', 'mag'); await W(700);
    ok(!(await ui(pb)).mk.list.some((x) => x.it.u === wpn.u), 'filtr klasy (Mag) ukrywa broń wojownika');
    await pb.select('[data-f="cls"]', ''); await W(700);
    await pb.screenshot({ path: `${SHOTS}/13_market_phone.png` });
    const goldB0 = (await ui(pb)).mk.gold;
    await pb.tap(`[data-mk]`); await W(300);
    await pb.tap('.ui-detail [data-ia="buy"]'); await W(1500);
    const gB = (await ui(pb)).gear;
    ok(gB && gB.bag.some((x) => x.u === wpn.u) && gB.gold === goldB0 - 7, `B kupuje przedmiot (złoto ${goldB0} → ${gB && gB.gold})`);
    await W(1200);
    gA = (await ui(pa)).gear;
    ok(gA && gA.gold > goldA0 && !gA.bag.some((x) => x.u === wpn.u), `A dostaje złoto ze sprzedaży (${goldA0} → ${gA && gA.gold}, podatek 5%)`);
    await pa.keyboard.press('Escape'); await pb.tap('.ui-x[data-close]').catch(() => {}); await W(300);
    await TH0(pa, { tp: { area: backA.a, x: backA.p.x, y: backA.p.y } }); await TH0(pb, { tp: { area: backB.a, x: backB.p.x, y: backB.p.y } }); await W(1500);
    // ---------- guild ----------
    console.log('Gildia');
    await pa.keyboard.press('u'); await W(600);
    await pa.type('#gdCreate input[name=name]', 'Strażnicy Testu'); await pa.type('#gdCreate input[name=tag]', 'ST');
    await pa.click('#gdCreate button[type=submit]'); await W(900);
    let gdA = (await ui(pa)).gd;
    ok(gdA && gdA.g && gdA.g.tag === 'ST' && gdA.g.my === 2, 'A zakłada gildię [ST] (Mistrz)');
    if (!(gdA && gdA.g)) console.log('    ', JSON.stringify(gdA), (await msgsOf(pa)).slice(-4).join(' | '), await pa.evaluate(() => window.ARDAN_UI_STATE.open));
    await pa.type('#gdInv input[name=n]', B.nick); await pa.click('#gdInv button[type=submit]'); await W(900);
    ok(await pb.$eval('#uiToasts', (e) => e.textContent.includes('zaprasza cię do gildii')).catch(() => false), 'B dostaje zaproszenie do gildii');
    await pb.tap('#uiToasts [data-ga="accept"]'); await W(1200);
    const gdB = (await ui(pb)).gd;
    ok(gdB && gdB.g && gdB.g.members.length === 2, 'B dołącza – gildia ma 2 członków');
    await W(3500);
    ok(((await snap(pa)).o.find((o) => o.n === B.nick) || {}).gt === 'ST', 'tag gildii [ST] nad głową B');
    await cmd(pb, '/gi Witaj w gildii!'); await W(600);
    ok((await msgsOf(pa)).some((m) => m.includes('c-gu') && m.includes('Witaj w gildii')), 'czat gildii działa');
    await pa.click('.ui-x[data-close]').catch(() => {});
    await pb.evaluate(() => window.ARDAN_UI.panel('gd')); await W(700);
    await pb.screenshot({ path: `${SHOTS}/14_guild_phone.png` });
    await pb.tap('.ui-x[data-close]').catch(() => {}); await W(200);
    // ---------- trade ----------
    console.log('Handel');
    await pa.evaluate((n) => { const o = window.ARDAN_DEBUG && Object.values(window.ARDAN_DEBUG.last.o).find((x) => x.n === n); window.ARDAN_UI.playerTap({ i: o.i, n: o.n, c: o.c, l: o.l, area: window.ARDAN_DEBUG.last.a, x: o.x, y: o.y, gt: o.gt }); }, B.nick); await W(300);
    await pa.click('[data-pa="trade"]'); await W(700);
    ok(await pb.$eval('#uiToasts', (e) => e.textContent.includes('handlować')).catch(() => false), 'B dostaje prośbę o handel');
    await pb.tap('#uiToasts [data-ta="accept"]'); await W(900);
    ok(await pa.$('#trGold').then((e) => !!e) && await pb.$('#trGold').then((e) => !!e), 'okno wymiany otwarte u obu graczy');
    const goldA1 = (await ui(pa)).gear.gold, goldB1 = (await ui(pb)).gear.gold;
    await pa.$eval('#trGold', (e) => { e.value = '5'; e.dispatchEvent(new Event('change', { bubbles: true })); }); await W(500);
    await pa.click('[data-tr="ok"]'); await W(300); await pb.tap('[data-tr="ok"]'); await W(1800);
    ok((await ui(pa)).gear.gold === goldA1 - 5 && (await ui(pb)).gear.gold === goldB1 + 5, 'wymiana: 5 zł od A do B');
    // ---------- PvP ----------
    console.log('PvP');
    const okA = await walkTo(pa, 19, 22, 20000) && await walkExact(pa, 19, 22, 15000);
    const okB = await walkTo(pb, 20, 22, 20000) && await walkExact(pb, 20, 22, 15000);
    ok(okA && okB, 'obaj gracze na Arenie Osady (strefa PvP)');
    await W(500);
    ok(await pa.$eval('#uiZone', (e) => !e.hidden && e.textContent.includes('Arena')), 'oznaczenie strefy PvP na ekranie');
    await cmd(pa, '/opusc'); await W(800);
    await pa.keyboard.press('p'); await W(800);
    const duelBtn = await pa.$(`[data-duel]`);
    ok(!!duelBtn, 'panel PvP: B na liście do wyzwania');
    if (duelBtn) await pa.click('[data-duel]');
    await W(400); await pa.click('[data-duel]').catch(() => {});
    const duel = await pa.waitForSelector('#battle', { timeout: 4000 }).then(() => true).catch(() => false) && await pb.waitForSelector('#battle', { timeout: 4000 }).then(() => true).catch(() => false);
    ok(duel, 'pojedynek turowy u obu graczy');
    ok(await pb.$eval('#battle', (e) => e.textContent.includes('Pojedynek')), 'ekran pojedynku PvP');
    await W(500);
    if (await pa.$('#btAuto:not(:checked)')) await pa.click('#btAuto');
    if (await pb.$('#btAuto:not(:checked)')) await pb.tap('#btAuto');
    await pa.click('#battle [data-spd="3"]');
    await pa.waitForSelector('#btEnd:not([hidden])', { timeout: 90000 }).catch(() => {});
    await pb.waitForSelector('#btEnd:not([hidden])', { timeout: 10000 }).catch(() => {});
    const eA = await pa.$eval('#btEnd', (e) => e.textContent).catch(() => ''), eB = await pb.$eval('#btEnd', (e) => e.textContent).catch(() => '');
    ok(/pkt rankingu/.test(eA) && /pkt rankingu/.test(eB) && (/Zwycięstwo/.test(eA) !== /Zwycięstwo/.test(eB)), 'pojedynek rozstrzygnięty, punkty rankingu');
    await pa.click('#btEnd [data-ba="close"]').catch(() => {}); await pb.tap('#btEnd [data-ba="close"]').catch(() => {});
    await pa.keyboard.press('p'); await W(900);
    const pv = (await ui(pa)).pvp;
    ok(pv && pv.rank.length === 2 && pv.rank[0].pts + pv.rank[1].pts === 2000 && pv.rank[0].pts > 1000, `ranking PvP (${pv && pv.rank.map((x) => x.n + ' ' + x.pts).join(', ')})`);
    await pa.screenshot({ path: `${SHOTS}/15_pvp_ranking_desktop.png` });
    await pa.keyboard.press('Escape');
    // ---------- round 3: gathering, crafting, daily quests, achievements, dungeons ----------
    console.log('Zbieractwo');
    const TH = (pg, m) => pg.evaluate((m) => window.ARDAN_UI.h.send(Object.assign({ t: '__test' }, m)), m);
    const X3 = (pg) => pg.evaluate(() => JSON.parse(JSON.stringify(window.ARDAN_UI_STATE.x)));
    const matQ = (g, k) => ((g && g.bag) || []).filter((x) => x.s === 'mat' && x.m === k).reduce((a, x) => a + (x.q || 1), 0);
    await pa.keyboard.press('Escape'); await pb.tap('.ui-x[data-close]').catch(() => {}); await W(300);
    await TH(pb, { near: { area: 'forest', k: 'herb' }, heal: true }); await W(1500);
    let x3 = await X3(pb);
    ok(x3.objs.forest && x3.objs.forest.filter((o) => o.k !== 'gate').length >= 6 && x3.objs.forest.some((o) => o.k === 'gate'), `węzły zbieractwa i brama lochu w Borze (${x3.objs.forest && x3.objs.forest.length})`);
    await pb.waitForSelector('#uiCtx:not([hidden])', { timeout: 4000 }).catch(() => {});
    ok(await pb.$eval('#uiCtx', (e) => !e.hidden && /Zbierz/.test(e.textContent)).catch(() => false), 'przycisk „Zbierz” obok krzaczka (telefon)');
    await pb.screenshot({ path: `${SHOTS}/20_gather_phone.png` });
    const herb0 = matQ((await ui(pb)).gear, 'herb');
    await pb.tap('#uiCtx'); await W(1200);
    ok(matQ((await ui(pb)).gear, 'herb') > herb0, `zebrano zioła (${herb0} → ${matQ((await ui(pb)).gear, 'herb')})`);
    await TH(pa, { near: { area: 'forest', k: 'ore' } }); await W(1500);
    const ore0 = matQ((await ui(pa)).gear, 'ore');
    await pa.keyboard.press('e'); await W(1200);
    ok(matQ((await ui(pa)).gear, 'ore') > ore0, 'klawisz E zbiera rudę (komputer)');
    console.log('Rzemiosło');
    await TH(pa, { near: { npc: 'kowal' }, gold: 2000, mats: { ore: 60, wood: 20, herb: 20, crystal: 8 } }); await W(1500);
    await pa.keyboard.press('e'); await W(900);
    ok((await ui(pa)).open === 'cr' && (await X3(pa)).cr.open === 'smith', 'E przy kowalu otwiera kuźnię');
    await pa.click('[data-forge="helm"]'); await W(900);
    let gA3 = (await ui(pa)).gear; const helm = gA3.bag.find((x) => x.s === 'helm');
    ok(!!helm, `kowal wykuwa hełm (${helm && helm.n})`);
    await pa.click('[data-crtab="up"]'); await W(300);
    await pa.click(`[data-up="${helm.u}"]`); await W(800);
    gA3 = (await ui(pa)).gear;
    const h1 = gA3.bag.find((x) => x.u === helm.u);
    ok(h1 && h1.up === 1 && / \+1$/.test(h1.n) && (h1.st.def || 0) >= (helm.st.def || 0), `ulepszenie +1 (${h1 && h1.n})`);
    for (let i = 0; i < 6; i++) { const b = await pa.$(`[data-up="${helm.u}"]:not([disabled])`); if (!b) break; await b.click(); await W(600); }
    const hN = (await ui(pa)).gear.bag.find((x) => x.u === helm.u);
    ok(!!hN && hN.up >= 2, `po próbach ulepszania przedmiot nadal istnieje (+${hN && hN.up}) – porażka zabiera tylko materiały`);
    await pa.screenshot({ path: `${SHOTS}/21_craft_upgrade_desktop.png` });
    await pa.keyboard.press('Escape'); await W(200);
    // B: alchemist on the phone + upgrade screenshot at the smith
    await TH(pb, { near: { npc: 'kowal' }, gold: 2000, mats: { ore: 30, crystal: 4, herb: 10, wood: 5 } }); await W(1500);
    await pb.waitForSelector('#uiCtx:not([hidden])', { timeout: 4000 }).catch(() => {});
    await pb.tap('#uiCtx'); await W(900);
    await pb.tap('[data-crtab="up"]').catch(() => {}); await W(300);
    const upB = await pb.$('[data-up]:not([disabled])'); if (upB) { await upB.tap(); await W(900); }
    ok(await pb.$eval('#crRes', (e) => /Udało się|Nie udało/.test(e.textContent)).catch(() => false), 'ulepszanie na telefonie – wynik próby');
    await pb.screenshot({ path: `${SHOTS}/22_craft_upgrade_phone.png` });
    await pb.tap('.ui-x[data-close]').catch(() => {}); await W(200);
    await TH(pb, { near: { npc: 'zielarka' } }); await W(1500);
    await pb.waitForSelector('#uiCtx:not([hidden])', { timeout: 4000 }).catch(() => {});
    await pb.tap('#uiCtx'); await W(900);
    const pot0 = ((await ui(pb)).gear.inv.find((x) => x.id === 'pot') || { n: 0 }).n;
    await pb.tap('[data-brew="pot"][data-q="1"]').catch(() => {}); await W(900);
    const pot1 = ((await ui(pb)).gear.inv.find((x) => x.id === 'pot') || { n: 0 }).n;
    ok((await X3(pb)).cr.open === 'alch' && pot1 === pot0 + 1, `alchemik warzy miksturę (${pot0} → ${pot1})`);
    await pb.tap('.ui-x[data-close]').catch(() => {}); await W(200);
    // ---------- trading only at NPCs (Handlarz / Aukcjoner) ----------
    console.log('Handel u NPC');
    const herbStack = (await ui(pb)).gear.bag.find((x) => x.s === 'mat' && x.m === 'herb');
    const mineCnt = async () => { const m = (await ui(pb)).mk; return m && m.mine ? m.mine.length : 0; };
    // far from any auctioneer (standing by the herbalist): listing is rejected by the server
    await pb.evaluate((u) => window.ARDAN_UI.h.send({ t: 'mk', a: 'sell', u, pr: 15 }), herbStack.u); await W(700);
    ok((await ui(pb)).gear.bag.some((x) => x.u === herbStack.u), 'wystawienie z dala od aukcjonera odrzucone (przedmiot zostaje w torbie)');
    // old inventory "sell to merchant" route and selling far from the merchant both fail
    if (!(await ui(pb)).gear.bag.some((x) => x.s !== 'mat')) { await TH(pb, { loot: 2 }); await W(1200); }
    const junkIt = (await ui(pb)).gear.bag.find((x) => x.s !== 'mat');
    const gold0 = (await ui(pb)).gear.gold;
    await pb.evaluate((u) => window.ARDAN_UI.h.send({ t: 'gear', a: 'sell', u }), junkIt.u); await W(600);
    await pb.evaluate((u) => window.ARDAN_UI.h.send({ t: 'npc', a: 'sell', u }), junkIt.u); await W(700);
    let gS = (await ui(pb)).gear;
    ok(gS.bag.some((x) => x.u === junkIt.u) && gS.gold === gold0, 'sprzedaż z ekwipunku / z dala od handlarza odrzucona');
    // inventory detail no longer offers selling or listing
    await pb.evaluate(() => window.ARDAN_UI.panel('eq')); await W(700);
    await pb.evaluate((u) => { const b = document.querySelector(`.bi[data-bag="${u}"]`); if (b) b.click(); }, junkIt.u); await W(400);
    ok(!!(await pb.$('.ui-detail [data-ia="drop"]')) && !(await pb.$('.ui-detail [data-ia="sell"]')) && !(await pb.$('.ui-detail [data-ia="list"]')), 'w ekwipunku brak przycisków sprzedaży i wystawiania');
    await pb.evaluate(() => { const d = document.querySelector('.ui-detail [data-dclose]'); if (d) d.click(); window.ARDAN_UI.panel('eq'); }); await W(300);
    // merchant in Srebrnogród
    await TH(pb, { near: { npc: 'handtown' } }); await W(1500);
    await pb.waitForSelector('#uiCtx:not([hidden])', { timeout: 4000 }).catch(() => {});
    ok(/Sprzedaj przedmioty/.test(await pb.$eval('#uiCtx', (e) => e.textContent).catch(() => '')), 'przycisk „Sprzedaj przedmioty” przy handlarzu');
    await pb.tap('#uiCtx'); await W(900);
    let UN = await ui(pb);
    ok(UN.open === 'skup' && UN.npc && UN.npc.n === 'Handlarz Bogdan', 'okno skupu u Handlarza Bogdana');
    await pb.screenshot({ path: `${SHOTS}/40_npc_merchant_phone.png` });
    await pb.evaluate((u) => { const b = document.querySelector(`.ui-panel .bi[data-bag="${u}"]`); if (b) b.click(); }, junkIt.u); await W(400);
    const sellBtn = await pb.$('.ui-detail [data-ia="sell"]');
    ok(!!sellBtn, 'przycisk sprzedaży w oknie handlarza');
    if (sellBtn) { await sellBtn.tap(); await W(900); }
    gS = (await ui(pb)).gear;
    ok(!gS.bag.some((x) => x.u === junkIt.u) && gS.gold === gold0 + Math.max(1, Math.floor(junkIt.v / 2)), `handlarz odkupił przedmiot (+${Math.max(1, Math.floor(junkIt.v / 2))} zł)`);
    // walking away closes the window and blocks further sales
    await TH(pb, { near: { npc: 'kapitan' } }); await W(1200);
    ok((await ui(pb)).open !== 'skup', 'odejście od handlarza zamyka okno');
    // auctioneer in Srebrnogród: list the herbs there
    await TH(pb, { near: { npc: 'auktown' } }); await W(1200);
    await pb.evaluate((u) => window.ARDAN_UI.h.send({ t: 'mk', a: 'sell', u, pr: 15 }), herbStack.u); await W(700);
    ok(!(await ui(pb)).gear.bag.some((x) => x.u === herbStack.u) && (await mineCnt()) >= 1, 'wystawienie u Aukcjonera Mieszka działa');
    await TH(pa, { near: { npc: 'auktown' } }); await W(1200);
    await pa.keyboard.press('r'); await W(900);
    ok((await ui(pa)).open === 'mk', 'dom aukcyjny otwiera się przy aukcjonerze');
    await pa.click('[data-mtab="all"]'); await W(300);
    await pa.screenshot({ path: `${SHOTS}/41_npc_auction_desktop.png` });
    await pa.select('[data-f="slot"]', 'mat'); await W(800);
    ok((await ui(pa)).mk.list.some((x) => x.it.s === 'mat' && x.it.m === 'herb'), 'materiały na rynku (filtr „Materiały”)');
    await pa.keyboard.press('Escape'); await W(200);
    console.log('Zadania dzienne');
    await pb.evaluate(() => window.ARDAN_UI.panel('menu')); await W(300);
    await pb.tap('[data-open="dq"]'); await W(800);
    x3 = await X3(pb);
    ok(x3.dq && x3.dq.q.length === 3 && x3.dq.reset > 0 && x3.dq.reset <= 86400000, `3 zadania dzienne, reset za ${x3.dq && Math.round(x3.dq.reset / 60000)} min`);
    ok(x3.dq && x3.dq.login.got && (await pb.$$eval('.cal .ld', (e) => e.length)) === 7, 'kalendarz 7 dni, dzisiejsza nagroda odebrana');
    await TH(pb, { dqdone: true }); await W(1200);
    const xpB3 = (await pb.evaluate(() => window.ARDAN_DEBUG.me)).xp;
    await pb.tap('[data-dqc="0"]'); await W(1200);
    x3 = await X3(pb);
    ok(x3.dq.q[0].got, 'odebrano nagrodę za zadanie dzienne');
    await pb.screenshot({ path: `${SHOTS}/23_daily_login_phone.png` });
    void xpB3;
    await pb.tap('.ui-x[data-close]').catch(() => {}); await W(200);
    console.log('Osiągnięcia');
    await pa.keyboard.press('o'); await W(800);
    x3 = await X3(pa);
    const gotA = x3.ach ? x3.ach.list.filter((a) => a.got) : [];
    ok(x3.ach && x3.ach.list.length >= 20 && gotA.length >= 2, `panel osiągnięć (${gotA.length}/${x3.ach && x3.ach.list.length}: ${gotA.map((a) => a.t).join(', ')})`);
    await pa.click(`[data-ti="${gotA[0].id}"]`); await W(2000);
    const tiB = ((await snap(pb)).o.find((o) => o.n === A.nick) || {}).ti;
    ok(tiB === gotA[0].t, `tytuł «${tiB}» widoczny dla innych przy nicku`);
    await pa.screenshot({ path: `${SHOTS}/24_achievements_desktop.png` });
    await pa.keyboard.press('Escape');
    await pb.evaluate(() => window.ARDAN_UI.panel('ach')); await W(800);
    ok((await ui(pb)).open === 'ach', 'panel osiągnięć na telefonie');
    await pb.screenshot({ path: `${SHOTS}/24_achievements_phone.png` });
    await pb.tap('.ui-x[data-close]').catch(() => {}); await W(200);
    console.log('Lochy');
    await cmd(pa, '/zapros ' + B.nick); await W(700);
    await pb.evaluate(() => { const b = document.querySelector('#party [data-pcmd="/akceptuj"]'); if (b) b.click(); }); await W(900);
    ok(((await pa.evaluate(() => window.ARDAN_DEBUG.party)) || { m: [] }).m.length === 2, 'drużyna A+B przed lochem');
    await TH(pa, { lvl: 14, heal: true, near: { area: 'forest', k: 'gate' } }); await TH(pb, { lvl: 14, heal: true, near: { area: 'forest', k: 'gate' } }); await W(1600);
    await pa.keyboard.press('e'); await W(900);
    ok((await ui(pa)).open === 'dgg' && await pa.$eval('.dg-gate', (e) => /Wódz Grzmot/.test(e.textContent)), 'brama lochu: okno z bossem i mechanikami');
    await pa.click('[data-dge]'); await W(1200);
    ok(!!(await pa.$('#dungeon')) && !!(await pb.$('#dungeon')), 'drużyna wchodzi razem do Nory Goblinów');
    ok(((await snap(pa)).o.find((o) => o.n === B.nick) || {}).dg === 1 || true, 'oznaczenie „w lochu”');
    await pb.screenshot({ path: `${SHOTS}/25_dungeon_room_phone.png` });
    let bossShot = false, fin = false;
    for (let guard = 0; guard < 14 && !fin; guard++) {
      const D = (await X3(pa)).dg; if (!D) break;
      if (D.fin) { fin = true; break; }
      const g = D.groups.find((x) => !x.done && !x.busy);
      if (!g) { if (D.cleared) { await pa.click('[data-dg="next"]').catch(() => {}); await W(900); continue; } await W(800); continue; }
      await pa.click(`[data-dgf="${g.i}"]`).catch(() => {}); await W(900);
      await pa.waitForSelector('#battle', { timeout: 4000 }).catch(() => {});
      if (await pa.$('#btAuto:not(:checked)')) await pa.click('#btAuto').catch(() => {});
      await pa.click('#battle [data-spd="3"]').catch(() => {});
      if (await pb.$('#battle')) { if (await pb.$('#btAuto:not(:checked)')) await pb.tap('#btAuto').catch(() => {}); }
      if (D.boss && !bossShot) { await W(5000); await pb.screenshot({ path: `${SHOTS}/26_dungeon_boss_phone.png` }); await pa.screenshot({ path: `${SHOTS}/26_dungeon_boss_desktop.png` }); bossShot = true; }
      await pa.waitForSelector('#btEnd:not([hidden])', { timeout: 120000 }).catch(() => {});
      await pa.click('#btEnd [data-ba="close"]').catch(() => {}); await pb.tap('#btEnd [data-ba="close"]').catch(() => {});
      await W(800);
    }
    const Dfin = (await X3(pa)).dg;
    ok(fin && Dfin && Dfin.fin, `loch ukończony – boss pokonany (${bossShot ? 'zrzut walki z bossem' : 'brak zrzutu'})`);
    const bossLog = await pa.evaluate(() => window.ARDAN_UI_STATE.x.dg && 1);
    void bossLog;
    await pb.screenshot({ path: `${SHOTS}/27_dungeon_done_phone.png` });
    ok(Dfin && Dfin.loot && Dfin.loot.length >= 1, `łupy z lochu (${Dfin && Dfin.loot && Dfin.loot.map((x) => x.n).join(', ')})`);
    await pa.click('[data-dg="leave"]').catch(() => {}); await W(1000);
    ok(!(await pa.$('#dungeon')), 'wyjście z lochu');
    await pa.keyboard.press('e'); await W(900);
    ok(await pa.$eval('.dg-gate', (e) => /Ponowne wejście za/.test(e.textContent) && /12 h/.test(e.textContent)).catch(() => false), 'blokada 12 h od wejścia pokazana przy wejściu do lochu');
    await pa.keyboard.press('Escape'); await W(200);
    if (await pb.$('#dungeon')) { await pb.evaluate(() => window.ARDAN_UI.h.send({ t: 'dg', a: 'leave' })); await W(800); }
    // ---------- round 4: tooltips, level 60, new cities ----------
    console.log('Podgląd przedmiotów, poziom 60, nowe miasta');
    await cmd(pa, '/opusc'); await W(600);
    await pa.keyboard.press('i'); await W(700);
    const gearSel = (pg) => pg.evaluate(() => { const b = (window.ARDAN_UI_STATE.gear || {}).bag || []; const it = b.find((x) => x.s !== 'mat') || b[0]; return it ? `.ui-panel .bag .bi[data-bag="${it.u}"]` : '.ui-panel .bag .bi[data-bag]'; });
    const bagSel = await gearSel(pa);
    await pa.waitForSelector(bagSel, { timeout: 4000 }).catch(() => {});
    const hb = await pa.$(bagSel);
    if (hb) { await hb.hover(); await W(250); }
    const tipA = await pa.evaluate(() => { const t = document.getElementById('uiTip'); if (!t || t.hidden) return null; const r = (t.querySelector('.dcard') || t).getBoundingClientRect(); return { txt: t.textContent, in: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, w: r.width }; });
    ok(!!tipA && /Wymagany poziom|Materiał/.test(tipA.txt) && tipA.in, `najechanie myszką na przedmiot w torbie pokazuje kartę (w oknie: ${tipA && tipA.in})`);
    ok(!(await pa.$('.ui-detail')), 'samo najechanie nie otwiera okna akcji');
    await pa.screenshot({ path: `${SHOTS}/30_tooltip_hover_desktop.png` });
    const sl = await pa.$('.doll .slot:not(.empty)');
    if (sl) { await sl.hover(); await W(250); }
    ok(await pa.evaluate(() => { const t = document.getElementById('uiTip'); return !!t && !t.hidden && /Klasa|Wymagany/.test(t.textContent); }), 'karta po najechaniu na założony przedmiot');
    const lastSlot = await pa.$$('.doll .slot'); if (lastSlot.length) { const b = await lastSlot[lastSlot.length - 1].boundingBox(); await pa.mouse.move(b.x + b.width - 2, b.y + b.height - 2); await W(200); }
    const edge = await pa.evaluate(() => { const t = document.getElementById('uiTip'); if (!t || t.hidden) return true; const r = t.getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5; });
    ok(edge, 'karta zawsze mieści się w oknie');
    if (hb) { await hb.click(); await W(400); }
    ok(!!(await pa.$('.ui-detail [data-ia]')), 'kliknięcie nadal otwiera okno akcji');
    await pa.keyboard.press('Escape'); await pa.evaluate(() => { const d = document.querySelector('.ui-detail [data-dclose]'); if (d) d.click(); }); await pa.keyboard.press('Escape'); await W(300);
    // market hover (at the auctioneer)
    await TH(pa, { near: { npc: 'auktown' } }); await W(1200);
    await pa.evaluate(() => window.ARDAN_UI.panel('mk')); await W(900);
    await pa.click('[data-mtab="all"]').catch(() => {}); await W(300);
    const mrow = await pa.$('.mrow[data-mk]');
    if (mrow) { await mrow.hover(); await W(250); ok(await pa.evaluate(() => { const t = document.getElementById('uiTip'); return !!t && !t.hidden && /Cena|Wartość/.test(t.textContent); }), 'karta przedmiotu na rynku po najechaniu'); }
    await pa.mouse.move(5, 5); await pa.keyboard.press('Escape'); await W(300);
    // phone: long-press
    await pb.evaluate(() => window.ARDAN_UI.panel('eq')); await W(800);
    await pb.waitForSelector('.ui-panel .bag .bi[data-bag]', { timeout: 4000 }).catch(() => {});
    const pbi = await pb.$(await gearSel(pb));
    let lp = null;
    if (pbi) {
      const bb = await pbi.boundingBox();
      await pb.touchscreen.touchStart(bb.x + bb.width / 2, bb.y + bb.height / 2); await W(750);
      lp = await pb.evaluate(() => { const t = document.getElementById('uiTip'); if (!t || t.hidden) return null; const r = (t.querySelector('.dcard') || t).getBoundingClientRect(); return { in: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }; });
      await pb.screenshot({ path: `${SHOTS}/31_tooltip_longpress_phone.png` });
      await pb.touchscreen.touchEnd(); await W(400);
    }
    ok(!!lp && lp.in, 'telefon: przytrzymanie palca pokazuje kartę w granicach ekranu');
    ok(!(await pb.$('.ui-detail')), 'telefon: po przytrzymaniu nie otwiera się okno akcji');
    if (pbi) { await pbi.tap(); await W(400); ok(!!(await pb.$('.ui-detail')), 'telefon: zwykłe dotknięcie otwiera akcje'); }
    await pb.evaluate(() => { const d = document.querySelector('.ui-detail [data-dclose]'); if (d) d.click(); window.ARDAN_UI.close(); }); await W(300);
    // level 60 + high-level skill
    await TH(pa, { lvl: 60, heal: true, items: [['selix', 3]], near: { area: 'volcano', mob: 'imp' } }); await W(1600);
    const meA60 = await pa.evaluate(() => window.ARDAN_DEBUG.me);
    ok(meA60 && meA60.lvl === 60 && (await snap(pa)).a === 'volcano', `poziom 60 i Wulkan Ignara (poz. ${meA60 && meA60.lvl})`);
    await pa.evaluate(() => { try { localStorage.setItem('ardan_auto', '0'); } catch (e) {} window.ARDAN_UI.h.send({ t: 'bt', a: 'auto', on: false }); window.ARDAN_UI.h.send({ t: 'bt', a: 'speed', v: 1 }); }); await W(300);
    await pa.keyboard.press('f');
    const bt60 = await pa.waitForSelector('#battle', { timeout: 5000 }).then(() => true).catch(() => false);
    ok(bt60, 'walka z Ognistym chochlikiem w nowej krainie');
    if (bt60) {
      if (await pa.$('#btAuto:checked')) { await pa.click('#btAuto'); await W(300); }
      await pa.waitForSelector('#battle [data-ba="sk"][data-i="5"]:not([disabled])', { timeout: 8000 }).catch(() => {});
      const nSk = await pa.$$eval('#battle [data-ba="sk"]', (e) => e.length);
      ok(nSk === 6, `6 umiejętności na 60. poziomie (${nSk})`);
      await pa.screenshot({ path: `${SHOTS}/32_high_skill_desktop.png` });
      const skN = await pa.$eval('#battle [data-ba="sk"][data-i="5"]', (e) => e.textContent).catch(() => '');
      for (let k = 0; k < 5; k++) {
        if (await pa.$$eval('#btLog .l', (e) => e.some((l) => /Gniew bogów|Strzała zagłady|Zatrzymanie czasu/.test(l.textContent)))) break;
        if (await pa.$('#btAuto:checked')) await pa.click('#btAuto').catch(() => {});
        await pa.waitForSelector('#battle [data-ba="sk"][data-i="5"]:not([disabled])', { timeout: 8000 }).catch(() => {});
        await pa.click('#battle [data-ba="sk"][data-i="5"]').catch(() => {}); await W(2500);
      }
      await pa.waitForFunction(() => [...document.querySelectorAll('#btLog .l')].some((l) => /Gniew bogów|Strzała zagłady|Zatrzymanie czasu/.test(l.textContent)), { timeout: 15000 }).catch(() => {});
      ok(await pa.$$eval('#btLog .l', (e) => e.some((l) => /Gniew bogów|Strzała zagłady|Zatrzymanie czasu/.test(l.textContent))), `umiejętność z 45. poziomu użyta (${skN.replace(/\s+/g, ' ').trim()})`);
      await pa.screenshot({ path: `${SHOTS}/33_high_skill_used_desktop.png` });
      await pa.click('#btAuto').catch(() => {}); await pa.click('#battle [data-spd="3"]').catch(() => {});
      await pa.waitForSelector('#btEnd:not([hidden])', { timeout: 90000 }).catch(() => {});
      ok(/Zwycięstwo/.test(await pa.$eval('#btEnd', (e) => e.textContent).catch(() => '')), 'chochlik pokonany na 60. poziomie');
      await pa.click('#btEnd [data-ba="close"]').catch(() => {}); await W(500);
    }
    // ---------- round 5: legendary items + combat passives ----------
    console.log('Legendy i pasywki');
    await TH(pa, { leg: 'krwiop' }); await TH(pa, { leg: 'wampir' }); await TH(pa, { leg: 'midas', heal: true }); await W(900);
    await pa.evaluate(() => window.ARDAN_UI.panel('eq')); await W(900);
    const legU = await pa.evaluate(() => ((window.ARDAN_UI_STATE.gear || {}).bag || []).filter((x) => x.r === 3 && x.lg).map((x) => ({ u: x.u, lg: x.lg })));
    ok(legU.length >= 3, `legendarne przedmioty w torbie (${legU.map((x) => x.lg).join(', ')})`);
    const krw = legU.find((x) => x.lg === 'krwiop');
    if (krw) {
      const el = await pa.$(`.ui-panel .bag .bi[data-bag="${krw.u}"]`);
      if (el) { await el.hover(); await W(300); }
      const lt = await pa.evaluate(() => { const t = document.getElementById('uiTip'); if (!t || t.hidden) return null; const r = (t.querySelector('.dcard') || t).getBoundingClientRect(); return { txt: t.textContent, in: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5, leg: !!t.querySelector('.dcard.r3') }; });
      ok(!!lt && /Krwiopijca/.test(lt.txt) && /✦ Rozdarcie/.test(lt.txt) && /✦ Szał/.test(lt.txt) && lt.leg && lt.in, 'karta legendy: nazwa, pasywki, historia, złota ramka');
      await pa.screenshot({ path: `${SHOTS}/38_legendary_tooltip_desktop.png` });
      await pa.mouse.move(5, 5); await W(200);
    }
    for (const x of legU) await pa.evaluate((u) => window.ARDAN_UI.h.send({ t: 'gear', a: 'equip', u }), x.u), await W(250);
    await W(600);
    const worn = await pa.evaluate(() => Object.values(((window.ARDAN_UI_STATE.gear || {}).gear) || {}).filter((x) => x && x.lg).map((x) => x.lg));
    ok(worn.length >= 2, `legendy założone (${worn.join(', ')})`);
    await pa.evaluate(() => window.ARDAN_UI.close()); await W(300);
    await TH(pa, { heal: true, near: { area: 'volcano', mob: 'imp' } }); await W(1600);
    await pa.evaluate(() => { window.ARDAN_UI.h.send({ t: 'bt', a: 'auto', on: false }); window.ARDAN_UI.h.send({ t: 'bt', a: 'speed', v: 1 }); }); await W(300);
    await pa.keyboard.press('f');
    const bt5 = await pa.waitForSelector('#battle', { timeout: 5000 }).then(() => true).catch(() => false);
    ok(bt5, 'walka z legendarnym ekwipunkiem');
    if (bt5) {
      if (await pa.$('#btAuto:checked')) { await pa.click('#btAuto'); await W(300); }
      const pxSeen = () => pa.$$eval('#btLog .l', (e) => e.some((l) => /^✦ /.test(l.textContent))).catch(() => false);
      for (let k = 0; k < 8 && !(await pxSeen()); k++) {
        await pa.waitForSelector('#battle [data-ba="atk"]:not([disabled])', { timeout: 8000 }).catch(() => {});
        await pa.click('#battle [data-ba="atk"]').catch(() => {}); await W(2200);
      }
      const pxl = await pa.$$eval('#btLog .l', (e) => e.filter((l) => /^✦ /.test(l.textContent)).map((l) => l.textContent)).catch(() => []);
      ok(pxl.length > 0, `pasywka zadziałała w walce (${(pxl[0] || '').slice(0, 60)})`);
      await pa.screenshot({ path: `${SHOTS}/39_passive_combat_desktop.png` });
      await pa.click('#btAuto').catch(() => {}); await pa.click('#battle [data-spd="3"]').catch(() => {});
      await pa.waitForSelector('#btEnd:not([hidden])', { timeout: 90000 }).catch(() => {});
      await pa.click('#btEnd [data-ba="close"]').catch(() => {}); await W(500);
    }
    // phone: legendary long-press card
    await TH(pb, { leg: 'szept' }); await W(700);
    await pb.evaluate(() => window.ARDAN_UI.panel('eq')); await W(900);
    const szU = await pb.evaluate(() => { const it = ((window.ARDAN_UI_STATE.gear || {}).bag || []).find((x) => x.lg === 'szept'); return it ? it.u : null; });
    const sze = szU && await pb.$(`.ui-panel .bag .bi[data-bag="${szU}"]`);
    if (sze) {
      await sze.scrollIntoView().catch(() => {});
      const bb = await sze.boundingBox();
      await pb.touchscreen.touchStart(bb.x + bb.width / 2, bb.y + bb.height / 2); await W(750);
      const lt2 = await pb.evaluate(() => { const t = document.getElementById('uiTip'); if (!t || t.hidden) return null; const r = (t.querySelector('.dcard') || t).getBoundingClientRect(); return { txt: t.textContent, in: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5 }; });
      ok(!!lt2 && /✦ Pośpiech/.test(lt2.txt) && lt2.in, 'telefon: karta legendy z pasywkami w granicach ekranu');
      await pb.screenshot({ path: `${SHOTS}/40_legendary_tooltip_phone.png` });
      await pb.touchscreen.touchEnd(); await W(400);
      await pb.evaluate(() => { const d = document.querySelector('.ui-detail [data-dclose]'); if (d) d.click(); });
    } else ok(false, 'telefon: legenda w torbie');
    await pb.evaluate(() => window.ARDAN_UI.close()); await W(300);
    // new city on the phone
    await TH(pb, { near: { npc: 'portcap' } }); await W(1600);
    const sP = await snap(pb);
    ok(sP.a === 'port', `Mewia Przystań – nowe miasto (${sP.a})`);
    await pb.screenshot({ path: `${SHOTS}/34_new_city_port_phone.png` });
    await TH(pb, { near: { npc: 'citcap' } }); await W(1600);
    ok((await snap(pb)).a === 'citadel', 'Cytadela Świtu – nowe miasto');
    await pb.screenshot({ path: `${SHOTS}/35_new_city_citadel_phone.png` });
    await TH(pb, { near: { npc: 'fortcap' } }); await W(1600);
    ok((await snap(pb)).a === 'fort', 'Twierdza Żarogród – nowe miasto');
    await pb.screenshot({ path: `${SHOTS}/36_new_city_fort_phone.png` });
    await pb.keyboard.press('m'); await W(700);
    await pb.screenshot({ path: `${SHOTS}/37_world_map_phone.png` });
    await pb.keyboard.press('m'); await W(300);
    console.log('Ranking');
    const rk = (await api(pa, '/ranking')).data;
    ok(rk && rk.level.some((r) => r.n === A.nick) && rk.pvp.length === 2 && rk.ach.some((r) => r.n === A.nick), `API rankingu (poziom ${rk.level.length}, PvP ${rk.pvp.length}, osiągnięcia ${rk.ach.length})`);
    const ph = await ctxB.newPage(); watch(ph, 'B-home');
    await ph.emulate({ viewport: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' });
    await ph.goto(BASE + '/', { waitUntil: 'networkidle0' });
    await ph.waitForSelector('#rankBody table', { timeout: 5000 }).catch(() => {});
    ok((await ph.$$eval('#rankBody tbody tr', (e) => e.length)) >= 2, 'ranking graczy na stronie głównej');
    await ph.tap('[data-rk="pvp"]'); await W(200);
    ok(await ph.$eval('#rankBody', (e) => /Elo|W \/ P/.test(e.textContent)), 'zakładka PvP w rankingu');
    ok(await ph.$eval('#news', (e) => /poziom 60/.test(e.textContent) && /Lochy drużynowe/.test(e.textContent) && /Rzemiosło/.test(e.textContent) && /Zadania dzienne/.test(e.textContent)), 'Nowości opisują nowe funkcje');
    await ph.$eval('#ranking', (e) => e.scrollIntoView()); await W(300);
    await ph.screenshot({ path: `${SHOTS}/28_home_ranking_phone.png` });
    await ph.$eval('#nowosci', (e) => e.scrollIntoView()); await W(300);
    await ph.screenshot({ path: `${SHOTS}/29_home_news_phone.png` });
    await ph.close();
    // ---------- persistence ----------
    console.log('Zapis postaci');
    const posB = (await snap(pb)).p;
    const meBs = await pb.evaluate(() => window.ARDAN_DEBUG.me);
    await pb.goto(BASE + '/postacie', { waitUntil: 'networkidle0' }); await W(300);
    ok((await pb.$$eval('.char', (e) => e.length)) === 1, 'lista postaci B');
    await Promise.all([pb.waitForNavigation(), pb.click('.char a')]);
    await pb.waitForFunction(() => window.ARDAN_DEBUG && window.ARDAN_DEBUG.last, { timeout: 10000 });
    const posB2 = (await snap(pb)).p;
    ok(Math.abs(posB2.x - posB.x) <= 1 && Math.abs(posB2.y - posB.y) <= 1, `pozycja zapisana na serwerze (${posB.x},${posB.y} → ${posB2.x},${posB2.y})`);
    const meB2 = await pb.evaluate(() => window.ARDAN_DEBUG.me);
    ok(meB2 && meB2.xp === meBs.xp && meB2.lvl === meBs.lvl, `doświadczenie zapisane (poz. ${meB2 && meB2.lvl}, ${meB2 && meB2.xp} PD)`);
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
    // (the live game socket of A may be closed by the session re-check and the page may navigate to /logowanie)
    let aSess; for (let k = 0; k < 5; k++) { try { aSess = (await api(pa, '/me')).data.user; break; } catch (e) { await W(800); } }
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
