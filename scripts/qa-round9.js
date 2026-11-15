'use strict';
// Round 9 QA walk-through: every page + game panels + admin panel at 1280x800 and on a phone (390x844).
// Collects console errors / warnings, page errors, failed requests, horizontal overflow and clipped text, and saves screenshots.
// Usage: node scripts/qa-round9.js [tag]   (own server, temp DB, port 3115) → shots/qa/<tag>_*.png + report on stdout
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');
const PORT = 3115, BASE = `http://localhost:${PORT}`;
const TAG = process.argv[2] || 'qa';
const OUT = path.join(__dirname, '..', 'shots', 'qa');
fs.mkdirSync(OUT, { recursive: true });
const W = (ms) => new Promise((r) => setTimeout(r, ms));
const issues = [];
const add = (where, what) => { issues.push(`[${where}] ${what}`); };
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'start.js')], { env: { ...process.env, PORT: String(PORT), DATABASE_PATH: `/tmp/ardan-qa9-${Date.now()}.db`, BASE_URL: BASE, NODE_ENV: 'development', BCRYPT_COST: '4', SMTP_HOST: '', ARDAN_TEST_HOOKS: '1', API_PER_MIN: '5000', WS_PER_MIN: '500', ADMIN_LOGIN: 'wladca', ADMIN_EMAIL: 'wladca@example.com', ADMIN_PASSWORD: 'Korona-Ardanu-77' } });
  let log = ''; srv.stdout.on('data', (d) => { log += d; }); srv.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < 60 && !log.includes('Serwer działa'); i++) await W(100);
  const br = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const VPS = [['desk', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]];
  try {
    for (const [vp, view] of VPS) {
      const ctx = await br.createBrowserContext();
      const pg = await ctx.newPage(); await pg.setViewport(view);
      if (vp === 'phone') await pg.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
      let where = vp + ':start';
      pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') { const t = m.text(); if (!/favicon|Download the React/.test(t)) add(where, `console.${m.type()}: ${t.slice(0, 200)}`); } });
      pg.on('pageerror', (e) => add(where, 'pageerror: ' + String(e).slice(0, 300)));
      pg.on('requestfailed', (r) => { const u = r.url(); if (!/\/ws|socket/.test(u)) add(where, `requestfailed ${u} ${r.failure() && r.failure().errorText}`); });
      pg.on('response', (r) => { const s = r.status(); const u = r.url(); if (s >= 400 && !/does-not-exist|\/api\/(login|password|reset|me)|nowe-haslo/.test(u)) add(where, `HTTP ${s} ${u}`); });
      const layout = async (name) => {
        const res = await pg.evaluate(() => {
          const out = []; const vw = document.documentElement.clientWidth;
          if (document.documentElement.scrollWidth > vw + 2) out.push(`poziomy scroll: ${document.documentElement.scrollWidth}px > ${vw}px`);
          const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
          for (const e of document.querySelectorAll('button, a, h1, h2, h3, h4, label, .st span, .li span, small, b')) {
            if (!vis(e)) continue;
            const cs = getComputedStyle(e);
            if ((e.scrollWidth > e.clientWidth + 2 && /hidden|clip/.test(cs.overflow + cs.overflowX) && e.clientWidth > 0) || (cs.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1)) out.push(`ucięty tekst <${e.tagName.toLowerCase()} class="${e.className}">: "${(e.textContent || '').trim().slice(0, 60)}"`);
            const r = e.getBoundingClientRect();
            if (r.right > vw + 2 && !e.closest('.scroll, [style*="overflow"], .bt-log, .mrows, table')) out.push(`wystaje poza ekran <${e.tagName.toLowerCase()}>: "${(e.textContent || '').trim().slice(0, 40)}" (${Math.round(r.right)} > ${vw})`);
          }
          for (const a of document.querySelectorAll('a[href]')) { const h = a.getAttribute('href'); if (!h || h === '#') out.push(`pusty link: "${a.textContent.trim().slice(0, 40)}"`); }
          return out.slice(0, 25);
        });
        for (const r of res) add(`${vp}:${name}`, r);
      };
      const shot = async (name) => { await pg.screenshot({ path: `${OUT}/${TAG}_${vp}_${name}.png` }); };
      const visit = async (p, name) => { where = `${vp}:${name}`; await pg.goto(BASE + p, { waitUntil: 'networkidle0' }); await W(400); await layout(name); await shot(name); };
      // public pages
      for (const [p, n] of [['/', 'home'], ['/rejestracja', 'register'], ['/logowanie', 'login'], ['/nie-pamietam-hasla', 'forgot'], ['/nowe-haslo?token=abc', 'reset'], ['/regulamin', 'terms'], ['/prywatnosc', 'privacy'], ['/does-not-exist', '404']]) await visit(p, n);
      // links on the home page
      where = `${vp}:links`;
      const links = await pg.evaluate(() => [...new Set([...document.querySelectorAll('a[href]')].map((a) => a.href))]);
      for (const u of links) if (u.startsWith('http://localhost')) { const r = await pg.evaluate(async (u) => (await fetch(u, { redirect: 'manual' })).status, u).catch(() => 0); if (r >= 400 && !/does-not-exist/.test(u)) add(where, `link ${u} → ${r}`); }
      // forgot password flow (dev: link printed in the console)
      where = `${vp}:forgot-flow`;
      await pg.goto(BASE + '/nie-pamietam-hasla', { waitUntil: 'networkidle0' }); await pg.type('#email', 'nikt@example.com'); await pg.click('#f button[type="submit"], #f button'); await W(1200); await shot('forgot_sent');
      // register through the real form
      where = `${vp}:register-flow`;
      const sfx = (vp === 'desk' ? 'd' : 'p') + String(Date.now()).slice(-5);
      await pg.goto(BASE + '/rejestracja', { waitUntil: 'networkidle0' });
      await pg.type('#login', 'qa' + sfx); await pg.type('#email', `qa${sfx}@example.com`); await pg.type('#password', 'Mgla-Ardanu-2026'); await pg.type('#password2', 'Mgla-Ardanu-2026');
      await pg.$eval('#terms', (c) => { if (!c.checked) c.click(); });
      await Promise.all([pg.waitForNavigation({ waitUntil: 'networkidle0', timeout: 8000 }).catch(() => add(where, 'brak przekierowania po rejestracji')), pg.click('#f button[type="submit"], #f button')]);
      await W(500); await layout('characters'); await shot('characters');
      // create a character through the form
      where = `${vp}:create-char`;
      await pg.click('#c_war').catch(() => {}); await pg.type('#nick', 'Qa' + sfx.slice(-4));
      await Promise.all([pg.waitForNavigation({ waitUntil: 'networkidle0', timeout: 8000 }).catch(() => {}), pg.$eval('#f', (f) => f.requestSubmit())]);
      await W(800); await shot('after_create');
      if (!/graj/.test(pg.url())) { const a = await pg.$('a[href*="graj"]'); if (a) { await Promise.all([pg.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {}), a.click()]); } }
      where = `${vp}:game`;
      await pg.waitForFunction(() => window.ARDAN_DEBUG && window.ARDAN_DEBUG.last, { timeout: 15000 }).catch(() => add(where, 'gra się nie wczytała'));
      await W(2500); await shot('game_intro'); await layout('game_intro');
      for (let i = 0; i < 4; i++) { await pg.keyboard.press('Escape'); await W(200); }
      await pg.evaluate(() => { document.querySelectorAll('#uiToasts [data-lt="get"]').forEach((b) => b.click()); }); await W(600);
      await shot('game'); await layout('game');
      const TH = (m) => pg.evaluate((m) => window.ARDAN_UI.h.send(Object.assign({ t: '__test' }, m)), m);
      await TH({ lvl: 12, gold: 3000, loot: 6, items: [['pot', 5], ['tp_town', 2]] }); await W(1500);
      // every menu panel
      where = `${vp}:menu`; await pg.evaluate(() => window.ARDAN_UI.panel('menu')); await W(700); await shot('menu'); await layout('menu'); await pg.evaluate(() => window.ARDAN_UI.close());
      for (const k of ['eq', 'mk', 'gd', 'pvp', 'tr', 'dq', 'ach', 'dgi']) {
        where = `${vp}:panel-${k}`;
        await pg.keyboard.press('Escape'); await W(200);
        const ok = await pg.evaluate((k) => { const ui = window.ARDAN_UI; if (!ui) return 'no ARDAN_UI'; ui.close(); ui.panel(k); return document.querySelector('.ui-back') ? 'ok' : 'panel nie otwarty'; }, k);
        if (ok !== 'ok') { add(where, 'nie można otworzyć panelu: ' + ok); continue; }
        await W(900); await layout('panel-' + k); await shot('panel_' + k);
      }
      await pg.keyboard.press('Escape'); await W(300);
      // canvas panels: map / quests / skills etc. via keys
      for (const [key, n] of [['m', 'map'], ['q', 'quests'], ['k', 'skills'], ['c', 'chat']]) { where = `${vp}:key-${n}`; await pg.keyboard.press(key); await W(900); await shot('key_' + n); await layout('key-' + n); await pg.keyboard.press('Escape'); await W(300); for (let i = 0; i < 2; i++) { await pg.keyboard.press('Escape'); await W(150); } }
      // battle → flee / win, then make sure the overlay closes
      where = `${vp}:battle`;
      await TH({ heal: true, tp: { area: 'forest', x: 20, y: 20 } }); await W(3500);
      await TH({ near: { mob: 'wolf' } }); await W(1500);
      await pg.evaluate(() => window.ARDAN_UI.h.send({ t: 'in', mx: 0, my: 0, acts: [{ a: 'atk' }] })); await W(2500);
      await shot('battle'); await layout('battle');
      await pg.evaluate(() => window.ARDAN_UI.h.send({ t: 'bt', a: 'auto', on: true })); await W(9000);
      await shot('battle_end'); await layout('battle_end');
      await pg.evaluate(() => { const b = document.querySelector('[data-ba="close"]'); if (b) b.click(); }); await W(800);
      const stillOpen = await pg.evaluate(() => !!document.getElementById('battle'));
      if (stillOpen) add(where, 'okno walki nie zamknęło się po „Zamknij”');
      await shot('after_battle');
      await pg.evaluate(() => window.ARDAN_UI.h.send({ t: 'bt', a: 'auto', on: false }));
      await ctx.close();
    }
    // admin panel
    for (const [vp, view] of VPS) {
      const ctx = await br.createBrowserContext(); const pg = await ctx.newPage(); await pg.setViewport(view);
      let where = `${vp}:admin`;
      pg.on('console', (m) => { if (m.type() === 'error') add(where, 'console.error: ' + m.text().slice(0, 200)); });
      pg.on('pageerror', (e) => add(where, 'pageerror: ' + String(e).slice(0, 300)));
      await pg.goto(BASE + '/logowanie', { waitUntil: 'networkidle0' });
      await pg.type('#login', 'wladca'); await pg.type('#password', 'Korona-Ardanu-77');
      await Promise.all([pg.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {}), pg.click('#f button[type="submit"], #f button')]);
      await pg.goto(BASE + '/admin', { waitUntil: 'networkidle0' }); await W(1200);
      await pg.screenshot({ path: `${OUT}/${TAG}_${vp}_admin.png`, fullPage: true });
      const ov = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (ov > 2) add(where, `poziomy scroll ${ov}px`);
      const tabs = await pg.$$('[data-tab]');
      for (let i = 0; i < tabs.length; i++) { where = `${vp}:admin-tab${i}`; await tabs[i].click().catch(() => {}); await W(700); await pg.screenshot({ path: `${OUT}/${TAG}_${vp}_admin_tab${i}.png` }); const o2 = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); if (o2 > 2) add(where, `poziomy scroll ${o2}px`); }
      await ctx.close();
    }
  } catch (e) { add('script', 'wyjątek: ' + (e.stack || e).toString().slice(0, 400)); }
  finally { await br.close(); srv.kill(); }
  const srvErr = log.split('\n').filter((l) => /error|Error|TypeError|wyjątek/.test(l) && !/SMTP|Poczta/.test(l));
  for (const l of srvErr.slice(0, 20)) add('server-log', l.slice(0, 200));
  console.log(`\n=== QA ${TAG}: ${issues.length} problemów ===`);
  for (const i of issues) console.log(i);
})();
