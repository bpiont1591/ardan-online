'use strict';
// Screenshots of the round-7 update: properly drawn maps with monster level labels, the blacksmith repair window,
// durability in the item tooltip, the zone badge (safe / PvP), and the dungeon cooldown at the entrance.
// Usage: node scripts/shots-round7.js  (starts its own server with a temp DB on port 3112)
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');
const PORT = 3112, BASE = `http://localhost:${PORT}`;
const OUT = path.join(__dirname, '..', 'shots');
fs.mkdirSync(OUT, { recursive: true });
const W = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], { env: { ...process.env, PORT: String(PORT), DATABASE_PATH: `/tmp/ardan-shots7-${Date.now()}.db`, BASE_URL: BASE, NODE_ENV: 'development', BCRYPT_COST: '4', SMTP_HOST: '', ARDAN_TEST_HOOKS: '1', API_PER_MIN: '5000' } });
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
    // 1) maps drawn properly + monster level labels (colour by difficulty)
    await TH({ lvl: 7, heal: true, tp: { area: 'wolfhills', x: 24, y: 20 } }); await W(7000); await shot('r7_map_levels_wolfhills.png');
    await TH({ lvl: 40, heal: true, tp: { area: 'elfwood', x: 24, y: 20 } }); await W(7000); await shot('r7_map_levels_elfwood.png');
    await TH({ lvl: 70, heal: true, tp: { area: 'necro', x: 25, y: 12 } }); await W(7000); await shot('r7_map_necro_pvp_badge.png');
    // high-level map warning on entry (level 12 entering the dragon nest)
    await TH({ lvl: 12, heal: true, tp: { area: 'dragon', x: 24, y: 20 } }); await W(1500); await shot('r7_warning_high_level_pvp.png');
    await TH({ lvl: 30, heal: true, tp: { area: 'steppe', x: 24, y: 20 } }); await W(7000); await shot('r7_pvp_zone_badge.png');
    await TH({ lvl: 30, heal: true, near: { npc: 'handtown' } }); await W(2500); await shot('r7_safe_zone_badge.png');
    await pg.keyboard.press('m'); await W(900); await shot('r7_world_map.png'); await pg.keyboard.press('m'); await W(300);
    // 2) durability: worn gear after a few deaths, tooltip + blacksmith repair window
    await TH({ lvl: 30, gold: 5000, loot: 6 }); await W(1200);
    const bag = await pg.evaluate(() => (window.ARDAN_UI_STATE.gear || {}).bag || []);
    for (const it of bag.filter((x) => x.s !== 'mat' && (!x.c || x.c === 'war')).slice(0, 4)) { await send({ t: 'gear', a: 'equip', u: it.u }); await W(250); }
    await TH({ wear: 40 }); await W(400); await TH({ wear: 25 }); await W(400);
    await TH({ near: { npc: 'kowal' } }); await W(2500);
    await pg.keyboard.press('i'); await W(900);
    const sl = await pg.$('.doll .slot:not(.empty)'); if (sl) { await sl.hover(); await W(400); }
    await shot('r7_tooltip_durability.png');
    await pg.keyboard.press('Escape'); await W(300);
    await pg.keyboard.press('e'); await W(900); await shot('r7_repair_npc_dialog.png');
    await send({ t: 'npc', a: 'open', k: 'naprawa' }); await W(1200);
    await shot('r7_repair_npc_window.png');
    await pg.keyboard.press('Escape'); await W(300);
    // 3) dungeon cooldown at the entrance (entered 2 h 15 min ago)
    await TH({ lvl: 12, heal: true, near: { area: 'forest', k: 'gate' }, dgLock: { goblin: 8100000 } }); await W(2500);
    await pg.keyboard.press('e'); await W(1200);
    await shot('r7_dungeon_cooldown.png');
    console.log('errors:', errs.length ? errs.join('\n') : 'none');
  } finally { await br.close(); srv.kill(); }
})().catch((e) => { console.error(e); process.exit(1); });
