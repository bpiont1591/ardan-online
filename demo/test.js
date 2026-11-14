'use strict';
const puppeteer = require('/workspace/ardan-online/node_modules/puppeteer-core');
const URL = process.env.URL || 'http://127.0.0.1:8765/ardan-demo.html';
const W = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0; const errors = [];
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  PASS ' : '  FAIL ') + m); return c; };
async function flow(browser, label, vp, shots) {
  const ctx = await browser.createBrowserContext();
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => errors.push(`${label}: ${e}`));
  pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${label} ${m.type()}: ${m.text()}`); });
  await pg.setViewport(vp);
  const t0 = Date.now();
  await pg.goto(URL, { waitUntil: 'load' });
  await pg.waitForSelector('#rankBody table, #rankBody p.muted');
  ok(!(await pg.$('#krainy')) && !(await pg.$('#regions')), `${label}: bez sekcji mapy świata`);
  ok(true, `${label}: strona główna (${Date.now() - t0} ms)`);
  ok(await pg.$eval('h1.logo', (e) => e.textContent) === 'ARDAN', `${label}: logo ARDAN`);
  ok(await pg.$eval('#demoBadge', (e) => e.textContent) === 'WERSJA DEMO', `${label}: odznaka demo`);
  if (shots) await pg.screenshot({ path: `shots/${shots}_1_home.png` });
  const sfx = String(Date.now()).slice(-4);
  const acc = { login: 'piotr' + sfx, email: `piotr${sfx}@example.com`, pass: 'Mgla-Ardanu-2026', nick: 'Bundy' + sfx };
  // register
  await pg.goto(URL + '#/rejestracja'); await pg.waitForSelector('body[data-page=register] #f');
  await pg.type('#login', acc.login); await pg.type('#email', acc.email); await pg.type('#password', acc.pass); await pg.type('#password2', acc.pass);
  await pg.click('#terms'); await pg.click('#f button[type=submit]');
  await pg.waitForSelector('body[data-page=chars] #f', { timeout: 8000 });
  ok(true, `${label}: rejestracja -> postacie`);
  // logout, forgot password, reset, login
  await pg.evaluate(() => document.querySelector('[data-logout]').click());
  await pg.waitForFunction(() => document.body.dataset.page === 'home');
  await pg.goto(URL + '#/nie-pamietam-hasla'); await pg.waitForSelector('body[data-page=forgot] #f');
  await pg.type('#email', acc.email); await pg.click('#f button[type=submit]');
  await pg.waitForSelector('#demoMail a');
  ok(/zamiast maila/.test(await pg.$eval('#demoMail', (e) => e.textContent)), `${label}: link resetu na ekranie`);
  if (shots === 'phone') await pg.screenshot({ path: `shots/${shots}_2_reset_link.png` });
  await pg.click('#demoMail a'); await pg.waitForSelector('body[data-page=reset] #f');
  const np = 'Nowe-Haslo#2026';
  await pg.type('#password', np); await pg.type('#password2', np); await pg.click('#f button[type=submit]');
  await pg.waitForSelector('body[data-page=login] #f', { timeout: 8000 });
  await pg.type('#login', acc.login); await pg.type('#password', acc.pass); await pg.click('#f button[type=submit]');
  await pg.waitForSelector('.alert.err.show'); ok(true, `${label}: stare hasło odrzucone`);
  await pg.$eval('#password', (e) => { e.value = ''; }); await pg.type('#password', np); await pg.click('#f button[type=submit]');
  await pg.waitForSelector('body[data-page=chars] #f', { timeout: 8000 }); ok(true, `${label}: logowanie nowym hasłem`);
  // create character
  await pg.click('label[for=c_mag]'); await pg.type('#nick', acc.nick);
  if (shots === 'desktop') await pg.screenshot({ path: `shots/${shots}_2_create_character.png` });
  await pg.click('#f button[type=submit]');
  await pg.waitForFunction(() => location.hash.startsWith('#/graj'), { timeout: 8000 });
  await pg.waitForFunction(() => window.ARDAN_DEBUG && window.ARDAN_DEBUG.last && !document.getElementById('overlay').classList.contains('show'), { timeout: 15000 });
  ok(true, `${label}: wejście do świata`);
  await W(2500);
  await pg.keyboard.press('Enter').catch(() => {});
  // close intro dialog if present
  for (let i = 0; i < 6; i++) { await pg.keyboard.press('Escape'); await W(150); }
  { const lt = await pg.waitForSelector('#uiToasts [data-lt="get"]', { timeout: 10000 }).catch(() => null);
    ok(!!lt, `${label}: okno nagrody za logowanie`); if (shots === 'phone' && lt) await pg.screenshot({ path: `shots/${shots}_2b_login_reward.png` });
    if (lt) { await pg.$eval('#uiToasts [data-lt="get"]', (b) => b.click()); await W(500); } }
  const p0 = await pg.evaluate(() => ({ ...window.ARDAN_DEBUG.last.p }));
  for (const k of ['ArrowDown', 'KeyS', 'ArrowRight', 'KeyD']) { await pg.keyboard.down(k); await W(900); await pg.keyboard.up(k); }
  const p1 = await pg.evaluate(() => ({ ...window.ARDAN_DEBUG.last.p }));
  ok(p0.x !== p1.x || p0.y !== p1.y, `${label}: ruch klawiszami (${p0.x},${p0.y}) -> (${p1.x},${p1.y})`);
  await W(9000);
  const st = await pg.evaluate(() => ({ others: window.ARDAN_DEBUG.last.o.map((o) => o.n), mobs: window.ARDAN_DEBUG.last.m.length, chat: [...document.querySelectorAll('#msgs .m')].map((e) => e.textContent), party: document.getElementById('party').textContent }));
  ok(st.others.length >= 3, `${label}: inni gracze: ${st.others.join(', ')}`);
  ok(st.chat.length >= 2, `${label}: czat: ${st.chat.length} wiadomości`);
  console.log('    czat:', st.chat.slice(-4).join(' | '));
  await pg.evaluate(() => { const c = document.getElementById('chat'); if (!c.classList.contains('open')) document.getElementById('chatIn') && c.classList.add('open'); });
  await pg.type('#chatIn', 'Cześć wszystkim!'); await pg.click('#chatForm button');
  await W(600);
  ok(await pg.evaluate(() => [...document.querySelectorAll('#msgs .m')].some((e) => e.textContent.includes('Cześć wszystkim!'))), `${label}: własna wiadomość na czacie`);
  if (shots) await pg.screenshot({ path: `shots/${shots}_3_chat.png` });
  await pg.evaluate(() => document.getElementById('chat').classList.remove('open'));
  await pg.waitForFunction(() => document.querySelector('#party .inv'), { timeout: 25000 }).then(() => ok(true, `${label}: zaproszenie do drużyny od bota`)).catch(() => ok(false, `${label}: zaproszenie do drużyny`));
  if (shots) await pg.screenshot({ path: `shots/${shots}_4_party_invite.png` });
  await pg.click('#party [data-pcmd="/akceptuj"]').catch(() => {});
  await pg.waitForFunction(() => document.querySelectorAll('#party .pm').length >= 2, { timeout: 5000 }).then(() => ok(true, `${label}: dołączono do drużyny`)).catch(() => ok(false, `${label}: drużyna`));
  await W(4000);
  if (shots) await pg.screenshot({ path: `shots/${shots}_5_party.png` });
  // ---------- nowa runda: walka turowa, ekwipunek, rynek, gildia, PvP ----------
  const snap = () => pg.evaluate(() => JSON.parse(JSON.stringify(window.ARDAN_DEBUG.last)));
  const ui = () => pg.evaluate(() => JSON.parse(JSON.stringify(window.ARDAN_UI_STATE)));
  const tap = async (sel) => { if (vp.hasTouch) await pg.tap(sel); else await pg.click(sel); };
  async function walkExact(tx, ty, maxMs, tol) {
    const t0 = Date.now(); tol = tol || 1; let side = 0;
    while (Date.now() - t0 < maxMs) {
      const s = await snap(); const dx = tx - s.p.x, dy = ty - s.p.y;
      if (Math.abs(dx) <= tol && Math.abs(dy) <= tol) return true;
      const before = [s.p.x, s.p.y];
      const ks = [];
      if (Math.abs(dx) > tol) ks.push(dx < 0 ? 'ArrowLeft' : 'ArrowRight');
      if (Math.abs(dy) > tol) ks.push(dy < 0 ? 'ArrowUp' : 'ArrowDown');
      const k = ks[side % ks.length]; await pg.keyboard.down(k); await W(260); await pg.keyboard.up(k); await W(60);
      const s2 = await snap(); if (s2.p.x === before[0] && s2.p.y === before[1]) side++;
    }
    return false;
  }
  { const m1 = (await snap()).m.map((r) => r[0] + ',' + r[1]).join(';'); await W(3000); const m2 = (await snap()).m.map((r) => r[0] + ',' + r[1]).join(';');
    ok(m1 === m2, `${label}: potwory stoją w miejscu`); }
  let s0 = await snap();
  const alive = s0.m.map((r, i) => ({ i, x: r[0], y: r[1], dead: r[3] & 1 })).filter((m) => !m.dead).sort((a, b) => Math.hypot(a.x - s0.p.x, a.y - s0.p.y) - Math.hypot(b.x - s0.p.x, b.y - s0.p.y));
  const tg = alive[0];
  for (let k = 0; k < 6; k++) { const s1 = await snap(); if (Math.max(Math.abs(tg.x - s1.p.x), Math.abs(tg.y - s1.p.y)) <= 1) break; await walkExact(tg.x, tg.y, 12000, k < 3 ? 2 : 1); }
  await pg.keyboard.press('f');
  if (!(await pg.waitForSelector('#battle', { timeout: 5000 }).then(() => true).catch(() => false))) { const s = await snap(); console.log('    DEBUG', JSON.stringify(s.p), JSON.stringify(tg), JSON.stringify(s.m[tg.i]), await pg.evaluate(() => window.ARDAN_UI_STATE.open), await pg.evaluate(() => [...document.querySelectorAll('#msgs .m')].slice(-3).map((e) => e.textContent).join(' | '))); await pg.screenshot({ path: 'shots/debug_f.png' }); }
  ok(await pg.$('#battle').then((e) => !!e), `${label}: walka turowa otwarta`);
  await W(700);
  ok((await pg.$$('#battle .bf.al')).length >= 2, `${label}: członek drużyny (bot) dołącza do walki`);
  if (shots) await pg.screenshot({ path: `shots/${shots}_6_combat.png` });
  await tap('#battle [data-ba="atk"]').catch(() => {});
  await pg.waitForFunction(() => document.querySelectorAll('#btLog .l').length >= 3, { timeout: 25000 }).catch(() => {});
  ok((await pg.$$('#btLog .l')).length >= 3, `${label}: runda rozegrana (dziennik walki)`);
  await tap('#btAuto'); await tap('#battle [data-spd="3"]');
  await pg.waitForSelector('#btEnd:not([hidden])', { timeout: 60000 }).catch(() => {});
  ok(/Zwycięstwo/.test(await pg.$eval('#btEnd', (e) => e.textContent).catch(() => '')), `${label}: zwycięstwo w walce automatycznej`);
  if (shots) await pg.screenshot({ path: `shots/${shots}_7_combat_win.png` });
  await tap('#btEnd [data-ba="close"]'); await W(300);
  // equipment
  await pg.evaluate(() => window.ARDAN_UI.panel('menu')); await W(300);
  await tap('[data-open="eq"]'); await W(700);
  ok((await pg.$$('.doll .slot')).length === 9, `${label}: panel postaci z 9 miejscami`);
  let G = (await ui()).gear;
  ok(G && G.gear.weapon && G.gear.weapon.c === 'mag', `${label}: broń maga w slocie (${G && G.gear.weapon && G.gear.weapon.n})`);
  if (shots) await pg.screenshot({ path: `shots/${shots}_8_equipment.png` });
  await tap('.slot[data-slot="weapon"]'); await W(300);
  if (shots) await pg.screenshot({ path: `shots/${shots}_8b_item_card.png` });
  await tap('.ui-detail [data-ia="unequip"]'); await W(1300);
  G = (await ui()).gear;
  const wp = G.bag.find((x) => x.s === 'weapon');
  ok(!!wp, `${label}: broń zdjęta do torby`);
  // selling happens only at NPCs: walk up to the auctioneer in Srebrnogród and list the weapon there
  ok(!(await pg.$(`.bi[data-bag="${wp.u}"]`).then(async (e) => { if (!e) return null; await e.click(); await W(300); return pg.$('.ui-detail [data-ia="list"], .ui-detail [data-ia="sell"]'); })), `${label}: w ekwipunku brak sprzedaży`);
  await pg.evaluate(() => { const d = document.querySelector('.ui-detail [data-dclose]'); if (d) d.click(); }); await W(200);
  await tap('.ui-x[data-close]'); await W(200);
  const back0 = await snap();
  await pg.evaluate(() => window.ARDAN_UI.h.send({ t: '__test', near: { npc: 'auktown' } })); await W(2500);
  await pg.evaluate(() => window.ARDAN_UI.panel('mk'));
  await pg.waitForFunction(() => window.ARDAN_UI_STATE.open === 'mk', { timeout: 8000 }).catch(() => {}); await W(400);
  await tap('[data-mtab="sell"]'); await W(600);
  await pg.waitForSelector(`.ui-panel .bi[data-bag="${wp.u}"]`, { timeout: 5000 }).catch(() => {});
  await tap(`.ui-panel .bi[data-bag="${wp.u}"]`); await W(300);
  await pg.$eval('#mkPrice', (e) => { e.value = '9'; });
  await tap('.ui-detail [data-ia="list"]'); await W(1500);
  await tap('[data-mtab="all"]'); await W(200);
  await pg.evaluate(() => window.ARDAN_UI.h.send({ t: 'mk', a: 'browse', f: {} })); await W(900);
  let M = (await ui()).mk;
  ok(M && M.list.length >= 4, `${label}: rynek – oferty botów: ${M && M.list.length}`);
  ok(M && M.mine.some((x) => x.it.u === wp.u), `${label}: moja oferta na rynku`);
  if (shots) await pg.screenshot({ path: `shots/${shots}_9_market.png` });
  const cheap = M.list.filter((x) => x.pr <= M.gold).sort((a, b) => a.pr - b.pr)[0];
  if (cheap) { await tap(`[data-mk="${cheap.id}"]`); await W(300); await tap('.ui-detail [data-ia="buy"]'); await W(1500); }
  G = (await ui()).gear;
  ok(cheap && G.bag.some((x) => x.u === cheap.it.u), `${label}: kupiono ${cheap && cheap.it.n} za ${cheap && cheap.pr} zł`);
  await tap('.ui-x[data-close]'); await W(200);
  // guild
  await pg.evaluate(() => window.ARDAN_UI.panel('gd')); await W(600);
  await pg.type('#gdCreate input[name=name]', 'Bractwo Burzy'); await pg.type('#gdCreate input[name=tag]', 'BB');
  await tap('#gdCreate button[type=submit]'); await W(900);
  ok(((await ui()).gd || {}).g && (await ui()).gd.g.tag === 'BB', `${label}: założono gildię [BB]`);
  await pg.type('#gdInv input[name=n]', 'Wilczyca'); await tap('#gdInv button[type=submit]');
  await pg.waitForFunction(() => window.ARDAN_UI_STATE.gd && window.ARDAN_UI_STATE.gd.g && window.ARDAN_UI_STATE.gd.g.members.length >= 2, { timeout: 9000 }).catch(() => {});
  ok(((await ui()).gd.g.members || []).length >= 2, `${label}: bot Wilczyca dołącza do gildii`);
  await W(1200);
  if (shots) await pg.screenshot({ path: `shots/${shots}_10_guild.png` });
  await tap('.ui-x[data-close]'); await W(200);
  // PvP (back to the village after the visit at the auctioneer)
  await pg.evaluate((b) => window.ARDAN_UI.h.send({ t: '__test', tp: { area: b.a, x: b.p.x, y: b.p.y } }), back0); await W(2500);
  await pg.evaluate(() => { const c = document.getElementById('chatIn'); c.value = '/opusc'; document.getElementById('chatForm').requestSubmit(); });
  ok(await walkExact(19, 22, 30000, 1), `${label}: na Arenie Osady`);
  await W(600);
  await pg.evaluate(() => window.ARDAN_UI.panel('pvp')); await W(900);
  ok(await pg.$eval('#uiZone', (e) => !e.hidden), `${label}: oznaczenie strefy PvP`);
  const pv = (await ui()).pvp;
  ok(pv && pv.rank.length >= 5, `${label}: ranking PvP (${pv && pv.rank.length} graczy)`);
  let duel = await pg.$('[data-duel]');
  ok(!!duel, `${label}: bot do wyzwania na arenie`);
  if (duel) {
    let started = false;
    for (let k = 0; k < 4 && !started; k++) {
      if (k) { await pg.evaluate(() => window.ARDAN_UI.close()); await W(1500); await pg.evaluate(() => window.ARDAN_UI.panel('pvp')); await W(700); }
      if (await pg.$('[data-duel]')) await tap('[data-duel]');
      started = await pg.waitForSelector('#battle', { timeout: 3000 }).then(() => true).catch(() => false);
    }
    ok(started, `${label}: pojedynek PvP z botem`);
    await W(500); if (!(await pg.$eval('#btAuto', (e) => e.checked).catch(() => true))) await tap('#btAuto').catch(() => {});
    await pg.waitForSelector('#btEnd:not([hidden])', { timeout: 90000 }).catch(() => {});
    ok(/pkt rankingu/.test(await pg.$eval('#btEnd', (e) => e.textContent).catch(() => '')), `${label}: wynik pojedynku i punkty rankingu`);
    if (shots) await pg.screenshot({ path: `shots/${shots}_11_pvp_result.png` });
    await tap('#btEnd [data-ba="close"]').catch(() => {});
  }
  // ---------- runda 3: zbieractwo, rzemiosło, zadania, osiągnięcia, lochy z Jagienką ----------
  const TH = (m) => pg.evaluate((m) => window.ARDAN_UI.h.send(Object.assign({ t: '__test' }, m)), m);
  const X3 = async () => (await ui()).x;
  const matQ = (g, k) => ((g && g.bag) || []).filter((x) => x.s === 'mat' && x.m === k).reduce((a, x) => a + (x.q || 1), 0);
  await pg.evaluate(() => window.ARDAN_UI.close()); await W(300);
  await pg.evaluate(() => window.ARDAN_UI.panel('menu')); await W(300);
  await tap('[data-open="boost"]'); await W(1500);
  ok(((await ui()).gear || {}).lvl >= 14, `${label}: demo – postać przygotowana (poz. ${((await ui()).gear || {}).lvl})`);
  await TH({ near: { area: 'forest', k: 'herb' } }); await W(2500);
  await pg.waitForSelector('#uiCtx:not([hidden])', { timeout: 5000 }).catch(() => {});
  const h0 = matQ((await ui()).gear, 'herb');
  if (shots) await pg.screenshot({ path: `shots/${shots}_12_gather.png` });
  await tap('#uiCtx').catch(() => {}); await W(1200);
  ok(matQ((await ui()).gear, 'herb') > h0, `${label}: zbieranie ziół (${h0} → ${matQ((await ui()).gear, 'herb')})`);
  await TH({ near: { npc: 'kowal' } }); await W(2500);
  await pg.waitForSelector('#uiCtx:not([hidden])', { timeout: 5000 }).catch(() => {});
  await tap('#uiCtx').catch(() => {}); await W(900);
  ok((await ui()).open === 'cr', `${label}: kuźnia kowala otwarta`);
  await tap('[data-forge="helm"]').catch(() => {}); await W(900);
  const hm = ((await ui()).gear.bag || []).find((x) => x.s === 'helm');
  ok(!!hm, `${label}: wykuto ${hm && hm.n}`);
  await tap('[data-crtab="up"]'); await W(300);
  if (hm) { await tap(`[data-up="${hm.u}"]`).catch(() => {}); await W(900); }
  ok(/Udało się/.test(await pg.$eval('#crRes', (e) => e.textContent).catch(() => '')), `${label}: ulepszenie +1 udane`);
  if (shots) await pg.screenshot({ path: `shots/${shots}_13_craft_upgrade.png` });
  await pg.evaluate(() => window.ARDAN_UI.close()); await W(200);
  await pg.evaluate(() => window.ARDAN_UI.panel('dq')); await W(800);
  let x3 = await X3();
  ok(x3.dq && x3.dq.q.length === 3 && x3.dq.login.got, `${label}: 3 zadania dzienne + nagroda za logowanie odebrana`);
  if (shots) await pg.screenshot({ path: `shots/${shots}_14_daily_login.png` });
  await pg.evaluate(() => window.ARDAN_UI.close()); await W(200);
  await pg.evaluate(() => window.ARDAN_UI.panel('ach')); await W(800);
  x3 = await X3();
  const gotA = x3.ach ? x3.ach.list.filter((a) => a.got) : [];
  ok(gotA.length >= 2, `${label}: osiągnięcia (${gotA.map((a) => a.t).join(', ')})`);
  if (gotA[0]) { await tap(`[data-ti="${gotA[0].id}"]`); await W(900); }
  ok((await X3()).ach.title === (gotA[0] || {}).id, `${label}: wybrano tytuł «${(gotA[0] || {}).t}»`);
  if (shots) await pg.screenshot({ path: `shots/${shots}_15_achievements.png` });
  await pg.evaluate(() => window.ARDAN_UI.close()); await W(200);
  // dungeon with bot Jagienka
  await pg.evaluate(() => { const c = document.getElementById('chatIn'); c.value = '/zapros Jagienka'; document.getElementById('chatForm').requestSubmit(); });
  await pg.waitForFunction(() => document.querySelectorAll('#party .pm').length >= 2, { timeout: 8000 }).catch(() => {});
  ok((await pg.$$('#party .pm')).length >= 2, `${label}: Jagienka przyjmuje zaproszenie do drużyny`);
  await TH({ near: { area: 'forest', k: 'gate' }, heal: true }); await W(3500);
  await pg.waitForSelector('#uiCtx:not([hidden])', { timeout: 5000 }).catch(() => {});
  await tap('#uiCtx').catch(() => {}); await W(900);
  ok((await ui()).open === 'dgg', `${label}: brama lochu – okno wejścia`);
  ok(await pg.$eval('.dg-gate', (e) => /Jagienka/.test(e.textContent)).catch(() => false), `${label}: Jagienka na liście drużyny przy wejściu`);
  if (shots) await pg.screenshot({ path: `shots/${shots}_16_dungeon_gate.png` });
  await tap('[data-dge]'); await W(1500);
  let D = (await X3()).dg;
  ok(D && D.party.some((m) => m.n === 'Jagienka'), `${label}: Jagienka wchodzi z graczem do lochu`);
  let bossShot = false, fin = false;
  for (let guard = 0; guard < 14 && !fin; guard++) {
    D = (await X3()).dg; if (!D) break;
    if (D.fin) { fin = true; break; }
    const g = D.groups.find((x) => !x.done && !x.busy);
    if (!g) { if (D.cleared) { await tap('[data-dg="next"]').catch(() => {}); await W(900); continue; } await W(800); continue; }
    await tap(`[data-dgf="${g.i}"]`).catch(() => {}); await W(900);
    await pg.waitForSelector('#battle', { timeout: 4000 }).catch(() => {});
    if (await pg.$('#btAuto:not(:checked)')) await tap('#btAuto').catch(() => {});
    await tap('#battle [data-spd="3"]').catch(() => {});
    if (D.boss && !bossShot && shots) { await W(4500); await pg.screenshot({ path: `shots/${shots}_17_dungeon_boss.png` }); bossShot = true; }
    await pg.waitForSelector('#btEnd:not([hidden])', { timeout: 150000 }).catch(() => {});
    await tap('#btEnd [data-ba="close"]').catch(() => {}); await W(900);
  }
  D = (await X3()).dg;
  ok(fin && D && D.fin, `${label}: loch ukończony razem z Jagienką`);
  await W(2500);
  if (shots) await pg.screenshot({ path: `shots/${shots}_18_dungeon_done.png` });
  await tap('[data-dg="leave"]').catch(() => {}); await W(1000);
  for (let k = 0; k < 3 && (await pg.$('#dungeon')); k++) { await pg.evaluate(() => window.ARDAN_UI.h.send({ t: 'dg', a: 'leave' })); await W(1200); }
  ok(!(await pg.$('#dungeon')), `${label}: wyjście z lochu`);
  if (vp.isMobile) {
    const bd = await pg.$eval('#demoBadge', (e) => { const r = e.getBoundingClientRect(); return { r: r.right, w: innerWidth, wm: getComputedStyle(e).writingMode, top: r.top, h: innerHeight }; });
    ok(bd.r >= bd.w - 1 && /vertical/.test(bd.wm) && bd.top > bd.h * 0.25, `${label}: odznaka WERSJA DEMO pionowo przy prawej krawędzi (nie zasłania HUD)`);
    await pg.screenshot({ path: `shots/${shots}_19_badge.png` });
  }
  // ---------- runda 4: poziom 60, nowe miasta, podgląd przedmiotów ----------
  await pg.evaluate(() => window.ARDAN_UI.close()); await W(200);
  await pg.evaluate(() => { const c = document.getElementById('chatIn'); c.value = '/opusc'; document.getElementById('chatForm').requestSubmit(); }); await W(600);
  await pg.evaluate(() => window.ARDAN_UI.panel('menu')); await W(300);
  await tap('[data-open="boost50"]'); await W(2500);
  ok(((await ui()).gear || {}).lvl >= 50 && (await pg.evaluate(() => window.ARDAN_DEBUG.last.a)) === 'port', `${label}: demo – poziom 50 w Mewiej Przystani`);
  if (shots) await pg.screenshot({ path: `shots/${shots}_22_new_city.png` });
  await pg.evaluate(() => window.ARDAN_UI.panel('eq')); await W(800);
  await pg.waitForSelector('.ui-panel .bag .bi[data-bag]', { timeout: 4000 }).catch(() => {});
  const sel4 = await pg.evaluate(() => { const b = (window.ARDAN_UI_STATE.gear || {}).bag || []; const it = b.find((x) => x.s !== 'mat') || b[0]; return it ? `.ui-panel .bag .bi[data-bag="${it.u}"]` : '.ui-panel .bag .bi[data-bag]'; });
  const bi4 = await pg.$(sel4);
  let tip4 = null;
  if (bi4) {
    const bb = await bi4.boundingBox();
    if (vp.isMobile) { await pg.touchscreen.touchStart(bb.x + bb.width / 2, bb.y + bb.height / 2); await W(750); }
    else { await pg.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await W(300); }
    tip4 = await pg.evaluate(() => { const t = document.getElementById('uiTip'); if (!t || t.hidden) return null; const r = t.getBoundingClientRect(); return { txt: t.textContent, in: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }; });
    if (shots) await pg.screenshot({ path: `shots/${shots}_23_tooltip.png` });
    if (vp.isMobile) { await pg.touchscreen.touchEnd(); await W(300); }
  }
  ok(!!tip4 && tip4.in && /Wymagany poziom|Materiał/.test(tip4.txt), `${label}: ${vp.isMobile ? 'przytrzymanie' : 'najechanie'} pokazuje kartę przedmiotu w granicach ekranu`);
  ok(!(await pg.$('.ui-detail')), `${label}: podgląd nie otwiera okna akcji`);
  await pg.evaluate(() => window.ARDAN_UI.close()); await W(200);
  await TH({ lvl: 60, heal: true, near: { area: 'volcano', mob: 'imp' } }); await W(2500);
  await pg.evaluate(() => { try { localStorage.setItem('ardan_auto', '0'); } catch (e) {} window.ARDAN_UI.h.send({ t: 'bt', a: 'auto', on: false }); window.ARDAN_UI.h.send({ t: 'bt', a: 'speed', v: 1 }); }); await W(300);
  let b60 = false;
  for (let k = 0; k < 3 && !b60; k++) { if (k) { await TH({ heal: true, near: { area: 'volcano', mob: 'imp' } }); await W(2500); } await pg.keyboard.press('f'); b60 = await pg.waitForSelector('#battle', { timeout: 6000 }).then(() => true).catch(() => false); }
  ok(b60, `${label}: walka w Wulkanie Ignara na 60. poziomie`);
  if (b60) {
    if (await pg.$('#btAuto:checked')) { await tap('#btAuto'); await W(300); }
    await pg.waitForSelector('#battle [data-ba="sk"][data-i="5"]:not([disabled])', { timeout: 8000 }).catch(() => {});
    ok((await pg.$$('#battle [data-ba="sk"]')).length === 6, `${label}: 6 umiejętności (nowe od poz. 15/30/45)`);
    for (let k = 0; k < 5; k++) {
      if (await pg.$$eval('#btLog .l', (e) => e.some((l) => /Zatrzymanie czasu/.test(l.textContent)))) break;
      if (await pg.$('#btAuto:checked')) await tap('#btAuto').catch(() => {});
      await pg.waitForSelector('#battle [data-ba="sk"][data-i="5"]:not([disabled])', { timeout: 8000 }).catch(() => {});
      await tap('#battle [data-ba="sk"][data-i="5"]').catch(() => {}); await W(2500);
    }
    await pg.waitForFunction(() => [...document.querySelectorAll('#btLog .l')].some((l) => /Zatrzymanie czasu/.test(l.textContent)), { timeout: 15000 }).catch(() => {});
    ok(await pg.$$eval('#btLog .l', (e) => e.some((l) => /Zatrzymanie czasu/.test(l.textContent))), `${label}: użyto „Zatrzymanie czasu” (poz. 45)`);
    if (shots) await pg.screenshot({ path: `shots/${shots}_24_high_skill.png` });
    await tap('#btAuto').catch(() => {}); await tap('#battle [data-spd="3"]').catch(() => {});
    await pg.waitForSelector('#btEnd:not([hidden])', { timeout: 90000 }).catch(() => {});
    ok(/Zwycięstwo/.test(await pg.$eval('#btEnd', (e) => e.textContent).catch(() => '')), `${label}: Ognisty chochlik pokonany`);
    await tap('#btEnd [data-ba="close"]').catch(() => {}); await W(500);
  }
  // reload keeps character saved
  await pg.evaluate(() => { location.hash = '#/postacie'; });
  await pg.waitForSelector('body[data-page=chars] .char', { timeout: 10000 });
  ok(true, `${label}: powrót do listy postaci: ${await pg.$eval('.char .muted', (e) => e.textContent)}`);
  await pg.evaluate(() => { location.hash = '#/'; });
  await pg.waitForSelector('#rankBody table', { timeout: 10000 }).catch(() => {});
  ok((await pg.$$('#rankBody tbody tr')).length >= 5, `${label}: ranking graczy na stronie głównej`);
  ok(await pg.$eval('#rankBody', (e) => e.textContent.includes('Zbyszko')), `${label}: boty w rankingu`);
  ok(await pg.$eval('#news', (e) => /poziom 60/.test(e.textContent) && /Lochy drużynowe/.test(e.textContent) && /Osiągnięcia i tytuły/.test(e.textContent)), `${label}: Nowości z funkcjami rund 3 i 4`);
  if (shots) { await pg.$eval('#ranking', (e) => e.scrollIntoView()); await W(400); await pg.screenshot({ path: `shots/${shots}_20_home_ranking.png` }); }
  await pg.$eval('[data-rk="ach"]', (b) => b.click()); await W(200);
  ok(await pg.$eval('#rankBody', (e) => /Osiągnięcia/.test(e.textContent)), `${label}: zakładka osiągnięć w rankingu`);
  if (shots) { await pg.$eval('#nowosci', (e) => e.scrollIntoView()); await W(400); await pg.screenshot({ path: `shots/${shots}_21_news.png` }); }
  await ctx.close();
}
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    await flow(browser, 'desktop', { width: 1366, height: 800 }, 'desktop');
    await flow(browser, 'phone', { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, 'phone');
  } catch (e) { fail++; console.log('  FAIL wyjątek: ' + e.stack); }
  await browser.close();
  console.log('Błędy konsoli:', errors.length ? errors : 'brak');
  console.log(`${pass} OK, ${fail} błędów`);
  process.exit(fail || errors.length ? 1 : 0);
})();
