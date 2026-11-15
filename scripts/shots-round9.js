'use strict';
// Screenshots of the round-9 update: bags (Margonem-style), stat points, the merchant's bag shop,
// full-bag loot on the ground, and a battle without the potion action. Desktop + phone.
// Usage: node scripts/shots-round9.js  (starts its own server with a temp DB on port 3116)
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');
const PORT = 3116, BASE = `http://localhost:${PORT}`;
const OUT = path.join(__dirname, '..', 'shots');
fs.mkdirSync(OUT, { recursive: true });
const W = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], { env: { ...process.env, PORT: String(PORT), DATABASE_PATH: `/tmp/ardan-shots9-${Date.now()}.db`, BASE_URL: BASE, NODE_ENV: 'development', BCRYPT_COST: '4', SMTP_HOST: '', ARDAN_TEST_HOOKS: '1', API_PER_MIN: '5000' } });
  let log = ''; srv.stdout.on('data', (d) => { log += d; }); srv.stderr.on('data', (d) => process.stderr.write(d));
  for (let i = 0; i < 50 && !log.includes('Serwer działa'); i++) await W(100);
  const br = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const errs = [];
  async function session(tag, vp, cls) {
    const ctx = await br.createBrowserContext();
    const pg = await ctx.newPage(); await pg.setViewport(vp);
    pg.on('pageerror', (e) => errs.push(`${tag}: ${e}`));
    pg.on('console', (m) => { if (m.type() === 'error') errs.push(`${tag} console: ${m.text()}`); });
    await pg.goto(BASE + '/', { waitUntil: 'networkidle0' });
    const sfx = String(Date.now()).slice(-5);
    const api = (p, body) => pg.evaluate(async (p, body) => { const c = (document.cookie.match(/ardan_csrf=([^;]+)/) || [])[1] || ''; const r = await fetch('/api' + p, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': decodeURIComponent(c) }, body: JSON.stringify(body) }); return r.json(); }, p, body);
    await api('/register', { login: 'plecak' + sfx, email: `plecak${sfx}@example.com`, password: 'Mgla-Ardanu-2026', password2: 'Mgla-Ardanu-2026', terms: true });
    const ch = await api('/characters', { nick: 'Torba' + sfx.slice(-3), cls });
    const id = ch.id || (ch.character && ch.character.id);
    await pg.goto(`${BASE}/graj?postac=${id}`, { waitUntil: 'networkidle0' });
    await pg.waitForFunction(() => window.ARDAN_DEBUG && window.ARDAN_DEBUG.last, { timeout: 10000 });
    for (let i = 0; i < 4; i++) { await pg.keyboard.press('Escape'); await W(150); }
    const TH = (m) => pg.evaluate((m) => window.ARDAN_UI.h.send(Object.assign({ t: '__test' }, m)), m);
    const send = (m) => pg.evaluate((m) => window.ARDAN_UI.h.send(m), m);
    const shot = async (name) => { await pg.screenshot({ path: `${OUT}/${name}` }); console.log('shot', name); };
    return { pg, TH, send, shot, ctx };
  }
  try {
    // ---- desktop ----
    const d = await session('desk', { width: 1280, height: 800 }, 'war');
    await d.TH({ lvl: 12, gold: 3000, heal: true }); await W(4000);
    await d.TH({ loot: 8, items: [['pot', 6], ['tp_town', 1]] }); await W(1500);
    await d.pg.evaluate(() => window.ARDAN_UI.panel('eq')); await W(900); await d.shot('r9_bags_eq_desk.png');
    await d.pg.evaluate(() => window.ARDAN_UI.close()); await W(300);
    await d.TH({ near: { npc: 'handvil' } }); await W(6000);
    await d.send({ t: 'npc', a: 'open', k: 'skup' }); await W(1200);
    await d.pg.evaluate(() => { const el = [...document.querySelectorAll('[data-buybag]')][0]; if (el) el.scrollIntoView({ block: 'center' }); }); await W(300);
    await d.shot('r9_merchant_bags.png');
    await d.send({ t: 'npc', a: 'buybag', k: 'm' }); await W(1000);
    await d.pg.evaluate(() => window.ARDAN_UI.close()); await W(300);
    // fill the bags → loot stays on the ground
    await d.TH({ loot: 12 }); await d.TH({ loot: 12 }); await d.TH({ loot: 12 }); await W(1500);
    await d.pg.evaluate(() => window.ARDAN_UI.panel('eq')); await W(900); await d.shot('r9_bags_full_ground_desk.png');
    await d.pg.evaluate(() => { const b = document.querySelector('.ui-panel .ui-body, .ui-panel'); if (b) b.scrollTop = 0; }); 
    await d.pg.evaluate(() => window.ARDAN_UI.close()); await W(300);
    // battle without a potion action
    await d.TH({ heal: true, tp: { area: 'forest', x: 20, y: 20 } }); await W(2500);
    await d.TH({ heal: true, near: { mob: 'wolf' } }); await W(6000);
    await d.send({ t: 'in', mx: 0, my: 0, acts: [{ a: 'atk' }] }); await W(2500);
    await d.pg.keyboard.press('KeyH'); await W(600);
    await d.shot('r9_battle_no_potion_desk.png');
    // chat closes with Escape (bug fix)
    for (let i = 0; i < 12; i++) { const inBt = await d.pg.evaluate(() => { const r = document.getElementById('btRound'); return !!(r && r.offsetParent && !/Koniec/.test(r.textContent)); }); if (!inBt) break; await d.send({ t: 'bt', a: 'act', c: { a: 'flee' } }); await W(3000); }
    for (let i = 0; i < 3; i++) { await d.pg.keyboard.press('Escape'); await W(300); }
    await d.pg.click('canvas').catch(() => {}); await d.pg.keyboard.press('KeyC'); await W(500);
    const chatOpen1 = await d.pg.evaluate(() => document.getElementById('chat').classList.contains('open'));
    await d.pg.evaluate(() => document.activeElement && document.activeElement.blur()); await d.pg.keyboard.press('Escape'); await W(400);
    const chatOpen2 = await d.pg.evaluate(() => document.getElementById('chat').classList.contains('open'));
    console.log('chat open after C:', chatOpen1, 'after Escape (input not focused):', chatOpen2);
    await d.shot('r9_fix_chat_escape_desk.png');
    await d.ctx.close();
    // ---- phone ----
    const p = await session('phone', { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, 'mag');
    await p.TH({ lvl: 9, gold: 2000, heal: true }); await W(4000);
    await p.TH({ loot: 6, items: [['pot', 4], ['mpot', 3]] }); await W(1500);
    await p.pg.evaluate(() => window.ARDAN_UI.panel('eq')); await W(900); await p.shot('r9_bags_eq_phone.png');
    await p.pg.evaluate(() => { const s = document.querySelector('.bagslots'); if (s) s.scrollIntoView({ block: 'start' }); }); await W(400); await p.shot('r9_bags_eq_phone_slots.png');
    await p.pg.evaluate(() => window.ARDAN_UI.close()); await W(300);
    await p.TH({ heal: true, tp: { area: 'forest', x: 20, y: 20 } }); await W(2500);
    await p.TH({ heal: true, near: { mob: 'wolf' } }); await W(6000);
    await p.send({ t: 'in', mx: 0, my: 0, acts: [{ a: 'atk' }] }); await W(2500);
    await p.shot('r9_battle_no_potion_phone.png');
    await p.ctx.close();
    console.log('errors:', errs.length ? errs.join('\n') : 'none');
  } catch (e) { console.log('ERR', e); }
  await br.close(); srv.kill();
})();
