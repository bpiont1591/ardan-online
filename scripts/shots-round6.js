'use strict';
// Screenshots of the round-6 update: homepage, new lands, NPC merchant / auction windows, world map.
// Usage: node scripts/shots-round6.js  (starts its own server with a temp DB on port 3110)
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');
const PORT = 3110, BASE = `http://localhost:${PORT}`;
const OUT = path.join(__dirname, '..', 'shots');
fs.mkdirSync(OUT, { recursive: true });
const W = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], { env: { ...process.env, PORT: String(PORT), DATABASE_PATH: `/tmp/ardan-shots-${Date.now()}.db`, BASE_URL: BASE, NODE_ENV: 'development', BCRYPT_COST: '4', SMTP_HOST: '', ARDAN_TEST_HOOKS: '1', API_PER_MIN: '5000' } });
  let log = ''; srv.stdout.on('data', (d) => { log += d; }); srv.stderr.on('data', (d) => process.stderr.write(d));
  for (let i = 0; i < 50 && !log.includes('Serwer działa'); i++) await W(100);
  const br = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const errs = [];
  try {
    const pg = await br.newPage(); await pg.setViewport({ width: 1440, height: 900 });
    pg.on('pageerror', (e) => errs.push(String(e)));
    await pg.goto(BASE + '/', { waitUntil: 'networkidle0' }); await W(500);
    await pg.screenshot({ path: `${OUT}/r6_home_desktop.png` });
    await pg.screenshot({ path: `${OUT}/r6_home_desktop_full.png`, fullPage: true });
    await pg.$eval('#ranking', (e) => e.scrollIntoView()); await W(300);
    await pg.screenshot({ path: `${OUT}/r6_home_ranking.png` });
    const sfx = String(Date.now()).slice(-5);
    const api = (p, body) => pg.evaluate(async (p, body) => { const c = (document.cookie.match(/ardan_csrf=([^;]+)/) || [])[1] || ''; const r = await fetch('/api' + p, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': decodeURIComponent(c) }, body: JSON.stringify(body) }); return r.json(); }, p, body);
    await api('/register', { login: 'foto' + sfx, email: `foto${sfx}@example.com`, password: 'Mgla-Ardanu-2026', password2: 'Mgla-Ardanu-2026', terms: true });
    const ch = await api('/characters', { nick: 'Kronikarz' + sfx.slice(-2), cls: 'war' });
    const id = ch.id || (ch.character && ch.character.id);
    await pg.goto(`${BASE}/graj?postac=${id}`, { waitUntil: 'networkidle0' });
    await pg.waitForFunction(() => window.ARDAN_DEBUG && window.ARDAN_DEBUG.last, { timeout: 10000 });
    for (let i = 0; i < 4; i++) { await pg.keyboard.press('Escape'); await W(150); }
    await pg.evaluate(() => document.querySelectorAll('#uiToasts .toast, #uiToasts > *').forEach((t) => t.remove()));
    const TH = (m) => pg.evaluate((m) => window.ARDAN_UI.h.send(Object.assign({ t: '__test' }, m)), m);
    const shot = async (name) => { await pg.evaluate(() => document.querySelectorAll('#uiToasts > *').forEach((t) => t.remove())); await pg.screenshot({ path: `${OUT}/${name}` }); };
    for (const [lvl, npc, name] of [[8, 'gajowy', 'r6_land_wolfhills.png'], [14, 'borysl', 'r6_land_mine.png'], [45, 'wawrzyn', 'r6_land_sunken.png'], [62, 'starcap', 'r6_city_star.png'], [78, null, 'r6_land_dragon.png']]) {
      if (npc) await TH({ lvl, heal: true, near: { npc } }); else await TH({ lvl, heal: true, tp: { area: 'dragon', x: 24, y: 20 } });
      await W(2200); await shot(name);
    }
    await TH({ near: { npc: 'starcap' } }); await W(1500);
    await pg.keyboard.press('m'); await W(800); await shot('r6_world_map.png'); await pg.keyboard.press('m'); await W(300);
    await TH({ loot: 10, near: { npc: 'handtown' }, items: [['bearpaw', 3], ['fang', 4]] }); await W(2000);
    await pg.evaluate(() => window.ARDAN_UI.h.send({ t: 'npc', a: 'open', k: 'skup' })); await W(1200);
    await shot('r6_npc_merchant.png');
    const bi = await pg.$('.ui-panel .bi[data-bag]'); if (bi) { await bi.click(); await W(400); await shot('r6_npc_merchant_sell.png'); }
    await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape'); await W(300);
    await TH({ near: { npc: 'auktown' } }); await W(1800);
    await pg.keyboard.press('r'); await W(1200); await shot('r6_npc_auction.png');
    await pg.keyboard.press('Escape'); await W(300);
    await TH({ near: { npc: 'kapitan' } }); await W(1600);
    await pg.keyboard.press('r'); await W(900); await shot('r6_trade_info_far.png');
    await pg.keyboard.press('Escape'); await W(200);
    // talk to a merchant with E -> dialog with "Sprzedaj przedmioty"
    await TH({ near: { npc: 'handport' } }); await W(1800);
    await pg.keyboard.press('e'); await W(900); await shot('r6_npc_dialog.png');
    console.log('errors:', errs.length ? errs.join('\n') : 'none');
  } finally { await br.close(); srv.kill(); }
})().catch((e) => { console.error(e); process.exit(1); });
