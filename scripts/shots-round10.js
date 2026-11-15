'use strict';
// Screenshots of the round-10 update: admin logs tab (desktop + phone, player history), friends window (desktop + phone),
// blocking, free level skins (gallery of all tiers, Wygląd window, world, battle, character select).
// Usage: node scripts/shots-round10.js  (starts its own server with a temp data dir on port 3117)
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');
const PORT = 3117, BASE = `http://localhost:${PORT}`;
const OUT = path.join(__dirname, '..', 'shots');
fs.mkdirSync(OUT, { recursive: true });
const W = (ms) => new Promise((r) => setTimeout(r, ms));
const DESK = { width: 1280, height: 800 }, PHONE = { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
(async () => {
  const env = { ...process.env, PORT: String(PORT), DATA_DIR: `/tmp/ardan-shots10-${Date.now()}`, BASE_URL: BASE, NODE_ENV: 'development', BCRYPT_COST: '4', SMTP_HOST: '', ARDAN_TEST_HOOKS: '1', API_PER_MIN: '5000', WS_PER_IP: '50',
    ADMIN_LOGIN: 'wladca', ADMIN_EMAIL: 'wladca@example.com', ADMIN_PASSWORD: 'Korona-Ardanu-77', SESSION_SECRET: 'shots10' };
  delete env.DATABASE_PATH; delete env.DATABASE_URL;
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'start.js')], { env });
  let log = ''; srv.stdout.on('data', (d) => { log += d; }); srv.stderr.on('data', (d) => process.stderr.write(d));
  for (let i = 0; i < 80 && !log.includes('Serwer działa'); i++) await W(100);
  const br = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const errs = [];
  const shotOf = (pg) => async (name, full) => { await pg.screenshot({ path: `${OUT}/${name}`, fullPage: !!full }); console.log('shot', name); };
  async function page(tag, vp) {
    const ctx = await br.createBrowserContext(); const pg = await ctx.newPage(); await pg.setViewport(vp);
    pg.on('pageerror', (e) => errs.push(`${tag}: ${e}`));
    pg.on('console', (m) => { if (m.type() === 'error' && !/favicon|401|403/.test(m.text())) errs.push(`${tag} console: ${m.text()}`); });
    await pg.goto(BASE + '/', { waitUntil: 'networkidle0' });
    const api = (p, body) => pg.evaluate(async (p, body) => { const c = (document.cookie.match(/ardan_csrf=([^;]+)/) || [])[1] || ''; const r = await fetch('/api' + p, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': decodeURIComponent(c) }, body: JSON.stringify(body) }); return r.json(); }, p, body);
    return { ctx, pg, api, shot: shotOf(pg) };
  }
  async function player(tag, vp, login, nick, cls) {
    const s = await page(tag, vp);
    await s.api('/register', { login, email: `${login}@example.com`, password: 'Mgla-Ardanu-2026', password2: 'Mgla-Ardanu-2026', terms: true });
    const ch = await s.api('/characters', { nick, cls }); s.cid = ch.id || (ch.character && ch.character.id);
    await s.pg.goto(`${BASE}/graj?postac=${s.cid}`, { waitUntil: 'networkidle0' });
    await s.pg.waitForFunction(() => window.ARDAN_DEBUG && window.ARDAN_DEBUG.last, { timeout: 10000 });
    for (let i = 0; i < 4; i++) { await s.pg.keyboard.press('Escape'); await W(150); }
    s.TH = (m) => s.pg.evaluate((m) => window.ARDAN_UI.h.send(Object.assign({ t: '__test' }, m)), m);
    s.send = (m) => s.pg.evaluate((m) => window.ARDAN_UI.h.send(m), m);
    s.close = () => s.pg.evaluate(() => window.ARDAN_UI.close());
    s.nick = nick;
    return s;
  }
  try {
    const sfx = String(Date.now()).slice(-4);
    // ---- players ----
    const X = await player('X', DESK, 'rycerz' + sfx, 'Bolesław', 'war');
    const Y = await player('Y', DESK, 'lucznik' + sfx, 'Jaśmina', 'arc');
    const Z = await player('Z', DESK, 'mag' + sfx, 'Wawrzyn', 'mag');
    const V = await player('V', DESK, 'stary' + sfx, 'Zbyszko', 'war');
    const T = await player('T', DESK, 'troll' + sfx, 'Trollik', 'arc');
    await X.TH({ lvl: 80, gold: 90000, heal: true }); await Y.TH({ lvl: 47, heal: true, tp: { area: 'volcano', x: 22, y: 26 } }); await Z.TH({ lvl: 33, heal: true, tp: { area: 'swamp', x: 20, y: 20 } });
    await V.TH({ lvl: 62 }); await T.TH({ lvl: 12 }); await W(2500);
    // friend requests
    for (const o of [Y, Z, V]) { await X.send({ t: 'fr', a: 'add', n: o.nick }); await W(400); }
    await W(800);
    for (const o of [Y, V]) { await o.send({ t: 'fr', a: 'get' }); await W(300); const k = await o.pg.evaluate(() => { const n = window.ARDAN_UI && document.querySelector('[data-frt="accept"]'); return n ? n.dataset.k : null; }); await o.send({ t: 'fr', a: 'accept', k: k || ('c' + X.cid) }); await W(500); }
    await Z.send({ t: 'fr', a: 'add', n: 'Bolesław' }); await W(500); // Z had X's request → mutual add accepts
    const N = await player('N', DESK, 'nowy' + sfx, 'Mieszko', 'mag');
    await N.send({ t: 'fr', a: 'add', n: 'Bolesław' }); await W(600); // incoming request for X
    await X.send({ t: 'fr', a: 'block', n: 'Trollik' }); await W(400);
    // V goes offline
    await V.ctx.close(); await W(1500);
    // some logs: trade, whisper attempt from the blocked troll, invalid skin
    await T.send({ t: 'chat', ch: 'g', text: '/w Bolesław kup złoto tanio!!!' }); await W(300);
    await T.send({ t: 'skin', a: 'set', k: 7 }); await W(300);
    await X.TH({ tp: { area: 'village', x: 18, y: 17 } }); await Y.TH({ tp: { area: 'village', x: 19, y: 17 } }); await W(2500);
    const yPid = await X.pg.evaluate(() => { const o = ((window.ARDAN_DEBUG.last || {}).o || []).find((x) => x.n === 'Jaśmina'); return o ? o.i : null; });
    console.log('Y pid', yPid);
    if (yPid) { await X.send({ t: 'tr', a: 'req', id: yPid }); await W(500); await Y.send({ t: 'tr', a: 'accept' }); await W(500); await X.send({ t: 'tr', a: 'gold', v: 1500 }); await W(300); await X.send({ t: 'tr', a: 'ok' }); await W(300); await Y.send({ t: 'tr', a: 'ok' }); await W(800); }
    await Y.TH({ tp: { area: 'volcano', x: 22, y: 26 } }); await W(1500);
    // ---- friends window (desktop) ----
    await X.TH({ tp: { area: 'village', x: 18, y: 18 }, heal: true }); await W(2500);
    await X.pg.evaluate(() => window.ARDAN_UI.panel('fr')); await W(1500); await X.shot('r10_friends_desk.png');
    await X.close(); await W(300);
    // ---- skins: Wygląd window, world, battle ----
    await X.pg.keyboard.press('KeyK'); await W(1500); await X.shot('r10_skin_window_desk.png');
    await X.close(); await W(300);
    await Y.TH({ tp: { area: 'village', x: 20, y: 18 } }); await Z.TH({ tp: { area: 'village', x: 16, y: 18 } }); await N.TH({ lvl: 72, tp: { area: 'village', x: 18, y: 20 } }); await W(3000);
    await X.shot('r10_skins_world_desk.png');
    await X.TH({ heal: true, near: { area: 'forest', mob: 'wolf' } }); await W(5000);
    await X.send({ t: 'in', mx: 0, my: 0, acts: [{ a: 'atk' }] }); await W(3000);
    await X.shot('r10_skin_battle_desk.png');
    for (let i = 0; i < 10; i++) { const inBt = await X.pg.evaluate(() => !!document.getElementById('battle')); if (!inBt) break; await X.send({ t: 'bt', a: 'act', c: { a: 'atk' } }); await W(2000); await X.pg.evaluate(() => { const b = document.querySelector('#btEnd [data-ba="close"]'); if (b && b.offsetParent) b.click(); }); }
    // character select
    await X.pg.goto(BASE + '/postacie', { waitUntil: 'networkidle0' }); await W(1200); await X.shot('r10_charselect_skin_desk.png');
    // skins gallery
    const G = await page('gal', { width: 1440, height: 900 });
    await G.pg.goto(BASE + '/wyglady', { waitUntil: 'networkidle0' }); await W(1500); await G.shot('r10_skins_gallery.png', true);
    await G.pg.setViewport(PHONE); await W(800); await G.shot('r10_skins_gallery_phone.png');
    await G.ctx.close();
    // ---- phone: friends + Wygląd ----
    const P = await player('P', PHONE, 'telefon' + sfx, 'Dobrawa', 'arc');
    await P.TH({ lvl: 31, heal: true }); await W(1500);
    for (const o of ['Bolesław', 'Jaśmina', 'Wawrzyn']) { await P.send({ t: 'fr', a: 'add', n: o }); await W(300); }
    await W(500);
    for (const o of [Y, Z]) { await o.send({ t: 'fr', a: 'accept', k: 'c' + P.cid }); await W(400); }
    await P.send({ t: 'fr', a: 'block', n: 'Trollik' }); await W(600);
    await P.shot('r10_friends_phone_hud.png');
    await P.pg.evaluate(() => window.ARDAN_UI.panel('fr')); await W(1500); await P.shot('r10_friends_phone.png');
    await P.close(); await W(300);
    await P.pg.evaluate(() => window.ARDAN_UI.panel('skin')); await W(1500); await P.shot('r10_skin_window_phone.png');
    await P.close();
    // ---- admin logs ----
    const A = await page('adm', DESK);
    await A.api('/login', { login: 'wladca', password: 'Korona-Ardanu-77' });
    await A.pg.goto(BASE + '/admin', { waitUntil: 'networkidle0' }); await W(800);
    await A.pg.click('[data-tab="logs"]'); await W(1800); await A.shot('r10_admin_logs_desk.png');
    await A.pg.select('#logF [name="type"]', 'sus').catch(() => {}); await W(300);
    await A.pg.evaluate(() => { const f = document.getElementById('logF'); if (f.requestSubmit) f.requestSubmit(); else f.submit(); }); await W(1500); await A.shot('r10_admin_logs_sus_desk.png');
    await A.pg.evaluate(() => { const b = document.querySelector('[data-logclear]'); if (b) b.click(); }); await W(1200);
    await A.pg.evaluate(() => { const n = [...document.querySelectorAll('[data-lgnick]')].find((e) => e.dataset.lgnick === 'Bolesław'); if (n) n.click(); }); await W(1500); await A.shot('r10_admin_logs_player_desk.png');
    await A.pg.setViewport(PHONE); await W(1500); await A.pg.click('[data-tab="logs"]'); await W(1800); await A.shot('r10_admin_logs_phone.png');
    console.log('errors:', errs.length ? errs.join('\n') : 'none');
  } catch (e) { console.error(e); console.log('errors:', errs.join('\n')); } finally { await br.close(); srv.kill(); }
})();
