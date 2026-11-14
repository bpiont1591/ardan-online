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
  await pg.waitForSelector('#regions article');
  ok(true, `${label}: strona główna (${Date.now() - t0} ms)`);
  ok(await pg.$eval('h1.logo', (e) => e.textContent) === 'ARDAN', `${label}: logo ARDAN`);
  ok((await pg.$$('#gallery a')).length === 10, `${label}: galeria 10 zdjęć`);
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
  // reload keeps character saved
  await pg.evaluate(() => { location.hash = '#/postacie'; });
  await pg.waitForSelector('body[data-page=chars] .char', { timeout: 10000 });
  ok(true, `${label}: powrót do listy postaci: ${await pg.$eval('.char .muted', (e) => e.textContent)}`);
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
