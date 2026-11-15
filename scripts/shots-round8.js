'use strict';
// Screenshots of the round-8 update: the redesigned fire wisp (Błędny ognik) and ice elemental
// (Lodowy żywiołak) in the world and in the battle view, and the alchemist potion shop.
// Usage: node scripts/shots-round8.js  (starts its own server with a temp DB on port 3114)
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');
const PORT = 3114, BASE = `http://localhost:${PORT}`;
const OUT = path.join(__dirname, '..', 'shots');
fs.mkdirSync(OUT, { recursive: true });
const W = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], { env: { ...process.env, PORT: String(PORT), DATABASE_PATH: `/tmp/ardan-shots8-${Date.now()}.db`, BASE_URL: BASE, NODE_ENV: 'development', BCRYPT_COST: '4', SMTP_HOST: '', ARDAN_TEST_HOOKS: '1', API_PER_MIN: '5000' } });
  let log = ''; srv.stdout.on('data', (d) => { log += d; }); srv.stderr.on('data', (d) => process.stderr.write(d));
  for (let i = 0; i < 50 && !log.includes('Serwer działa'); i++) await W(100);
  const br = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const errs = [];
  try {
    const pg = await br.newPage(); await pg.setViewport({ width: 1440, height: 900 });
    pg.on('pageerror', (e) => errs.push(String(e)));
    await pg.goto(BASE + '/', { waitUntil: 'networkidle0' });
    const sfx = String(Date.now()).slice(-5);
    const api = (p, body) => pg.evaluate(async (p, body) => { const c = (document.cookie.match(/ardan_csrf=([^;]+)/) || [])[1] || ''; const r = await fetch('/api' + p, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': decodeURIComponent(c) }, body: JSON.stringify(body) }); return r.json(); }, p, body);
    await api('/register', { login: 'foto' + sfx, email: `foto${sfx}@example.com`, password: 'Mgla-Ardanu-2026', password2: 'Mgla-Ardanu-2026', terms: true });
    const ch = await api('/characters', { nick: 'Kronikarz' + sfx.slice(-2), cls: 'war' });
    const id = ch.id || (ch.character && ch.character.id);
    await pg.goto(`${BASE}/graj?postac=${id}`, { waitUntil: 'networkidle0' });
    await pg.waitForFunction(() => window.ARDAN_DEBUG && window.ARDAN_DEBUG.last, { timeout: 10000 });
    for (let i = 0; i < 4; i++) { await pg.keyboard.press('Escape'); await W(150); }
    const TH = (m) => pg.evaluate((m) => window.ARDAN_UI.h.send(Object.assign({ t: '__test' }, m)), m);
    const send = (m) => pg.evaluate((m) => window.ARDAN_UI.h.send(m), m);
    const clean = () => pg.evaluate(() => { document.querySelectorAll('#uiToasts > *').forEach((t) => t.remove()); });
    const shot = async (name) => { await clean(); await pg.screenshot({ path: `${OUT}/${name}` }); console.log('shot', name); };
    // claim the login reward / close dialogs so the view is clean
    await W(800); await clean();
    const inAct = (a) => send({ t: 'in', mx: 0, my: 0, acts: [a] });
    const monster = async (lvl, area, x, y, mob, name) => {
      await TH({ lvl, heal: true }); await W(4500);
      await TH({ heal: true, tp: { area, x, y } }); await W(2500);
      await TH({ heal: true, near: { mob } }); await W(6500); await shot(`r8_${name}_world.png`);
      await inAct({ a: 'atk' }); await W(2600); await shot(`r8_${name}_battle.png`);
      for (let i = 0; i < 12; i++) {
        const inBt = await pg.evaluate(() => { const r = document.getElementById('btRound'); return !!(r && r.offsetParent && !/Koniec/.test(r.textContent)); });
        if (!inBt) break;
        await send({ t: 'bt', a: 'act', c: { a: 'flee' } }); await W(3500);
      }
      for (let i = 0; i < 3; i++) { await pg.keyboard.press('Escape'); await W(300); }
    };
    await monster(14, 'swamp', 20, 18, 'wisp', 'wisp_swamp');
    await monster(24, 'mount', 20, 14, 'ielem', 'ielem_mount');
    // alchemist shop (Srebrnogród)
    await TH({ lvl: 20, gold: 2000, heal: true }); await W(4500);
    await TH({ near: { npc: 'alchemik' } }); await W(6500);
    await inAct({ a: 'npc', id: 'alchemik' }); await W(1200); await shot('r8_alchemist_dialog.png');
    const si = await pg.evaluate(() => { const d = window.ARDAN_DEBUG.dlg; return d && d.opts ? d.opts.indexOf('Pokaż towary') : -1; });
    console.log('shop option index', si);
    await inAct({ a: 'dlg', i: Math.max(0, si) }); await W(1500);
    await W(600); await shot('r8_alchemist_shop.png');
    console.log('errors:', errs.length ? errs.join('\n') : 'none');
  } finally { await br.close(); srv.kill(); }
})().catch((e) => { console.error(e); process.exit(1); });
