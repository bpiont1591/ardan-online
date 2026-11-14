'use strict';
// Moderation tests: roles & permissions (403 for non-admins), CSRF, mute/ban/kick enforcement (HTTP + WebSocket),
// in-game moderator commands, audit log, first admin from env vars, admin panel screenshots (desktop + phone).
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const PORT = Number(process.env.ADM_PORT) || 3104, BASE = `http://localhost:${PORT}`;
const SHOTS = path.join(__dirname, '..', 'shots');
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const W = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? '  PASS ' : '  FAIL ') + m); return c; };

function jar() { const c = {}; return { c, hdr: () => Object.entries(c).map(([k, v]) => `${k}=${v}`).join('; '), take(r) { for (const s of r.headers.getSetCookie()) { const kv = s.split(';')[0]; const i = kv.indexOf('='); c[kv.slice(0, i)] = kv.slice(i + 1); } } }; }
async function req(j, method, p, body, extra) {
  const h = Object.assign({ cookie: j.hdr() }, extra || {});
  if (body !== undefined) h['content-type'] = 'application/json';
  if (method !== 'GET' && j.c.ardan_csrf && !('x-csrf-token' in h)) h['x-csrf-token'] = decodeURIComponent(j.c.ardan_csrf);
  const r = await fetch(BASE + p, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  j.take(r); const t = await r.text(); let data; try { data = JSON.parse(t); } catch (e) { data = t; }
  return { status: r.status, data, headers: r.headers };
}
function wsOpen(j, cid) {
  return new Promise((res) => {
    const ws = new WebSocket(`ws://localhost:${PORT}/ws?postac=${cid}`, { headers: { cookie: j.hdr(), origin: BASE } });
    const o = { ws, msgs: [], closed: null }; ws.on('message', (d) => { try { o.msgs.push(JSON.parse(d.toString())); } catch (e) { /* */ } });
    ws.on('close', (code) => { o.closed = code; }); ws.on('open', () => res(o)); ws.on('unexpected-response', (q, r) => { o.status = r.statusCode; res(o); }); ws.on('error', () => res(o));
  });
}
const sysTxt = (o) => o.msgs.filter((m) => m.t === 'chat' && m.ch === 's').map((m) => m.text).join(' | ');
const chatSay = (o, text, ch) => o.ws.send(JSON.stringify({ t: 'chat', ch: ch || 'g', text }));

async function account(login, cls) {
  const j = jar(); await req(j, 'GET', '/api/me');
  const r = await req(j, 'POST', '/api/register', { login, email: `${login}@example.com`, password: 'Haslo-Testowe-91', password2: 'Haslo-Testowe-91', terms: true });
  const c = await req(j, 'POST', '/api/characters', { nick: login.slice(0, 1).toUpperCase() + login.slice(1, 14), cls: cls || 'war' });
  return { j, ok: r.status === 200, cid: c.data.id, nick: login.slice(0, 1).toUpperCase() + login.slice(1, 14), login };
}

async function main() {
  const dir = `/tmp/ardan-adm-${Date.now()}`;
  let log = '';
  const env = { ...process.env, PORT: String(PORT), DATA_DIR: dir, BASE_URL: BASE, NODE_ENV: 'development', BCRYPT_COST: '10', SMTP_HOST: '', ARDAN_TEST_HOOKS: '', API_PER_MIN: '5000', WS_PER_MIN: '500', WS_PER_IP: '50',
    ADMIN_LOGIN: 'wladca', ADMIN_EMAIL: 'wladca@example.com', ADMIN_PASSWORD: 'Korona-Ardanu-77', SESSION_SECRET: 'test-secret-' + Date.now() };
  delete env.DATABASE_PATH; delete env.DATABASE_URL;
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'start.js')], { env });
  srv.stdout.on('data', (d) => { log += d; }); srv.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < 60 && !log.includes('Serwer działa'); i++) await W(100);
  let browser = null;
  try {
    console.log('Pierwszy administrator i role');
    ok(/Utworzono konto \(admin\): wladca/.test(log), 'first admin created from ADMIN_* env vars');
    ok(fs.existsSync(path.join(dir, 'ardan.db')), 'database file in DATA_DIR');
    const adm = jar(); await req(adm, 'GET', '/api/me');
    let r = await req(adm, 'POST', '/api/login', { login: 'wladca', password: 'Korona-Ardanu-77' });
    ok(r.status === 200, 'admin can log in');
    r = await req(adm, 'GET', '/api/me'); ok(r.data.user && r.data.user.role === 'admin', 'role "admin" in /api/me');
    const sfx = String(Date.now()).slice(-5);
    const P1 = await account('gracz' + sfx), P2 = await account('drugi' + sfx, 'arc'), M = await account('modek' + sfx, 'mag');
    ok(P1.ok && P2.ok && M.ok && P1.cid && P2.cid && M.cid, 'three player accounts + characters');

    console.log('Uprawnienia');
    const anon = jar(); await req(anon, 'GET', '/api/me');
    r = await req(anon, 'GET', '/api/admin/search?q='); ok(r.status === 401, 'logged out: /api/admin/search -> 401');
    r = await req(P1.j, 'GET', '/api/admin/search?q='); ok(r.status === 403, 'player: /api/admin/search -> 403');
    r = await req(P1.j, 'GET', '/api/admin/chat'); ok(r.status === 403, 'player: /api/admin/chat -> 403');
    r = await req(P1.j, 'POST', '/api/admin/mute', { userId: 1, dur: '1h', reason: 'x' }); ok(r.status === 403, 'player: POST /api/admin/mute -> 403');
    r = await req(P1.j, 'POST', '/api/admin/role', { userId: 2, role: 'admin' }); ok(r.status === 403, 'player cannot grant roles -> 403');
    r = await req(P1.j, 'GET', '/admin'); ok(r.status === 403, 'player: /admin page -> 403');
    r = await req(anon, 'GET', '/admin'); ok(r.status === 302 && /logowanie/.test(r.headers.get('location') || ''), 'logged out: /admin redirects to login');
    r = await req(adm, 'GET', '/admin'); ok(r.status === 200 && /Panel moderacji/.test(r.data), 'admin: /admin page served');
    r = await req(adm, 'POST', '/api/admin/mute', { userId: 2, dur: '1h', reason: 'x' }, { 'x-csrf-token': 'zly-token-zly-token-zly-token-1' });
    ok(r.status === 403 && /token/i.test(r.data.error || ''), 'admin action without valid CSRF token -> 403');
    const find = async (j, q) => (await req(j, 'GET', '/api/admin/search?q=' + q)).data.users.find((u) => u.login === q);
    const uM = await find(adm, M.login), u1 = await find(adm, P1.login), u2 = await find(adm, P2.login), uA = await find(adm, 'wladca');
    ok(uM && u1 && u2 && u1.chars.length === 1, 'admin search finds accounts with characters');
    r = await req(adm, 'POST', '/api/admin/role', { userId: uM.id, role: 'moderator' }); ok(r.status === 200, 'admin promotes moderator');
    r = await req(M.j, 'GET', '/api/admin/search?q='); ok(r.status === 200, 'moderator: search allowed');
    r = await req(M.j, 'GET', '/api/admin/audit'); ok(r.status === 403, 'moderator: audit log -> 403 (admin only)');
    r = await req(M.j, 'POST', '/api/admin/role', { userId: u1.id, role: 'moderator' }); ok(r.status === 403, 'moderator cannot change roles -> 403');
    r = await req(M.j, 'POST', '/api/admin/ban', { userId: uA.id, dur: '1h', reason: 'bunt' }); ok(r.status === 400 && /wyższą/.test(r.data.error), 'moderator cannot ban an admin');
    r = await req(M.j, 'POST', '/api/admin/ban', { userId: u1.id, dur: 'perm', reason: 'x' }); ok(r.status === 400 && /administrator/.test(r.data.error), 'moderator cannot ban permanently');
    r = await req(adm, 'POST', '/api/admin/mute', { userId: u1.id, dur: '5y', reason: 'x' }); ok(r.status === 400, 'invalid duration rejected');
    r = await req(adm, 'POST', '/api/admin/mute', { userId: u1.id, dur: '1h', reason: '' }); ok(r.status === 400, 'reason required');

    console.log('Wyciszenie');
    const w1 = await wsOpen(P1.j, P1.cid), w2 = await wsOpen(P2.j, P2.cid), wm = await wsOpen(M.j, M.cid);
    await W(800);
    chatSay(w1, 'Witajcie, to ja ' + P1.nick); await W(400);
    ok(w2.msgs.some((m) => m.t === 'chat' && m.from === P1.nick), 'chat works before mute');
    r = await req(adm, 'GET', '/api/admin/chat?q=' + P1.nick); ok(r.data.lines.some((l) => /Witajcie/.test(l.text) && l.user_id === u1.id), 'message visible in moderator chat log');
    r = await req(adm, 'POST', '/api/admin/mute', { userId: u1.id, dur: '15m', reason: 'obraźliwe wiadomości' }); ok(r.status === 200, 'admin mutes player (15 min)');
    await W(300);
    ok(/wyciszył cię na czacie \(15 minut\)/.test(sysTxt(w1)), 'muted player is told immediately');
    const before = w2.msgs.length;
    chatSay(w1, 'czy ktoś mnie słyszy?'); chatSay(w1, '/w ' + P2.nick + ' psst'); await W(500);
    ok(/Jesteś wyciszony na czacie jeszcze 1[45] min\. Powód: obraźliwe wiadomości/.test(sysTxt(w1)), 'muted: message refused with remaining time + reason');
    ok(!w2.msgs.slice(before).some((m) => m.t === 'chat' && m.from === P1.nick), 'muted player\'s messages (global + private) reach nobody');
    r = await req(P1.j, 'GET', '/api/me'); ok(r.data.user, 'mute does not log the player out');
    r = await req(adm, 'GET', '/api/admin/active'); ok(r.data.mutes.some((m) => m.user_id === u1.id), 'active mutes list');
    r = await req(adm, 'POST', '/api/admin/unmute', { userId: u1.id }); ok(r.status === 200, 'unmute');
    await W(200); chatSay(w1, 'Dzięki, już mogę pisać!'); await W(400);
    ok(w2.msgs.some((m) => m.t === 'chat' && m.from === P1.nick && /już mogę/.test(m.text)), 'chat works after unmute');

    console.log('Komendy moderatora w grze');
    chatSay(w2, '/mute ' + P1.nick + ' 1h spam'); await W(400);
    ok(/Nieznana komenda/.test(sysTxt(w2)), 'player typing /mute gets "unknown command"');
    chatSay(wm, '/mute ' + P2.nick + ' 1h spam na czacie'); await W(500);
    ok(/Wyciszono drugi/.test(sysTxt(wm)) && /wyciszył cię/.test(sysTxt(w2)), 'moderator /mute in chat works');
    chatSay(w2, 'hej'); await W(400); ok(/Jesteś wyciszony na czacie jeszcze/.test(sysTxt(w2)), 'mute from chat command enforced');
    chatSay(wm, '/unmute ' + P2.nick); await W(400); ok(/Zdjęto wyciszenie/.test(sysTxt(wm)), 'moderator /unmute');
    chatSay(wm, '/ban wladca 1h test'); await W(400); ok(/wyższą/.test(sysTxt(wm)), 'moderator /ban on admin refused');
    chatSay(wm, 'Porządek musi być.'); await W(400);
    ok(w1.msgs.some((m) => m.t === 'chat' && m.from === M.nick && m.role === 'moderator'), 'moderator messages carry the MOD badge');
    chatSay(wm, '/kick ' + P2.nick + ' AFK w przejściu'); await W(700);
    ok(w2.msgs.some((m) => m.t === 'kick' && /wyrzucony/.test(m.reason)) && w2.closed !== null, 'moderator /kick disconnects the player');

    console.log('Blokada konta');
    r = await req(adm, 'POST', '/api/admin/ban', { userId: u1.id, dur: '24h', reason: 'oszustwo na rynku' }); ok(r.status === 200, 'admin bans account (24h)');
    await W(500);
    ok(w1.msgs.some((m) => m.t === 'kick' && /zablokowane/.test(m.reason)) && w1.closed !== null, 'ban kicks the live socket immediately');
    r = await req(P1.j, 'GET', '/api/me'); ok(r.data.user === null, 'ban ends existing sessions');
    r = await req(P1.j, 'POST', '/api/login', { login: P1.login, password: 'Haslo-Testowe-91' });
    ok(r.status === 403 && /zablokowane do .*Powód: oszustwo na rynku/.test(r.data.error), 'banned login refused with message: ' + String(r.data.error).slice(0, 70));
    const wb = await wsOpen(P1.j, P1.cid); ok(wb.status === 401 || wb.closed !== null, 'banned account cannot open game socket');
    r = await req(adm, 'POST', '/api/admin/unban', { userId: u1.id }); ok(r.status === 200, 'unban');
    r = await req(P1.j, 'POST', '/api/login', { login: P1.login, password: 'Haslo-Testowe-91' }); ok(r.status === 200, 'login works after unban');
    r = await req(adm, 'GET', '/api/admin/audit');
    const acts = r.data.entries.map((e) => e.action);
    ok(['mute', 'unmute', 'ban', 'unban', 'kick', 'role'].every((a) => acts.includes(a)) && r.data.entries.some((e) => e.via === 'czat'), `audit log records every action (${r.data.entries.length} entries)`);
    // admin chat badge
    const wa = await wsOpen(adm, (await req(adm, 'POST', '/api/characters', { nick: 'Wladca', cls: 'mag' })).data.id); await W(700);
    const wp = await wsOpen(P1.j, P1.cid); await W(700);
    chatSay(wa, 'Witajcie w Ardanie – jestem administratorem.'); await W(400);
    ok(wp.msgs.some((m) => m.t === 'chat' && m.from === 'Wladca' && m.role === 'admin'), 'admin messages carry the ADM badge');
    for (const o of [wm, wa, wp]) try { o.ws.close(); } catch (e) { /* */ }

    console.log('Panel w przeglądarce');
    const puppeteer = require('puppeteer-core');
    browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
    const errors = [];
    const setCookies = async (pg, j) => { await pg.setCookie(...Object.entries(j.c).map(([name, value]) => ({ name, value, url: BASE }))); };
    // prepare data for screenshots: one active mute + a ban
    r = await req(adm, 'POST', '/api/admin/mute', { userId: u2.id, dur: '1h', reason: 'spam linkami' });
    const pd = await browser.newPage(); pd.on('pageerror', (e) => errors.push('desk: ' + e)); pd.on('console', (m) => { if (m.type() === 'error') errors.push('desk: ' + m.text()); });
    await pd.setViewport({ width: 1366, height: 860 }); await setCookies(pd, adm);
    await pd.goto(BASE + '/admin', { waitUntil: 'networkidle0' });
    await pd.waitForSelector('.ucard', { timeout: 5000 }).catch(() => {});
    ok((await pd.$$('.ucard')).length >= 4, 'panel lists accounts');
    await pd.screenshot({ path: `${SHOTS}/50_admin_players_desktop.png` });
    await pd.click('[data-tab="chat"]'); await pd.waitForSelector('.cl', { timeout: 4000 }).catch(() => {});
    ok((await pd.$$('.cl')).length > 3, 'panel chat log');
    const muteBtn = await pd.$(`.cl button[data-login="${P1.nick}"]`);
    if (muteBtn) { await muteBtn.click(); await W(300); }
    ok(await pd.$eval('#modal', (e) => !e.hidden).catch(() => false), 'one-click mute from a chat message opens the mute dialog');
    await pd.type('#reason', 'wulgaryzmy'); await pd.screenshot({ path: `${SHOTS}/51_admin_chat_mute_desktop.png` });
    await pd.click('#actGo'); await W(700);
    ok(/Wyciszono/.test(await pd.$eval('#msg', (e) => e.textContent).catch(() => '')), 'mute from panel confirmed');
    await pd.click('[data-tab="active"]'); await W(600);
    await pd.screenshot({ path: `${SHOTS}/52_admin_active_desktop.png` });
    await pd.click('[data-tab="audit"]'); await W(600);
    ok((await pd.$$('#audit tbody tr')).length >= 6, 'audit tab shows entries');
    await pd.screenshot({ path: `${SHOTS}/53_admin_audit_desktop.png` });
    // phone
    const pp = await browser.newPage(); pp.on('pageerror', (e) => errors.push('phone: ' + e)); pp.on('console', (m) => { if (m.type() === 'error') errors.push('phone: ' + m.text()); });
    await pp.emulate({ viewport: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
    await setCookies(pp, adm);
    await pp.goto(BASE + '/admin', { waitUntil: 'networkidle0' }); await pp.waitForSelector('.ucard', { timeout: 5000 }).catch(() => {});
    const ovf = await pp.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
    ok(ovf, 'phone: panel fits the screen width');
    await pp.screenshot({ path: `${SHOTS}/54_admin_players_phone.png` });
    await pp.tap('[data-tab="chat"]'); await W(800);
    await pp.screenshot({ path: `${SHOTS}/55_admin_chat_phone.png` });
    const banBtn = await pp.$('[data-tab="players"]'); if (banBtn) { await banBtn.tap(); await W(600); }
    const b2 = await pp.$(`.ucard [data-act="ban"][data-login="${P2.login}"]`); if (b2) { await b2.tap(); await W(400); }
    ok(await pp.$eval('#modal', (e) => !e.hidden).catch(() => false), 'phone: ban dialog');
    await pp.screenshot({ path: `${SHOTS}/56_admin_ban_dialog_phone.png` });
    await pp.keyboard.press('Escape');
    // player page: non-admin sees no panel
    const pn = await browser.newPage(); await setCookies(pn, P2.j);
    const resp = await pn.goto(BASE + '/admin'); ok(resp.status() === 403, 'browser: player gets 403 on /admin');
    // muted chat message in the game (phone)
    const pg = await browser.newPage(); pg.on('pageerror', (e) => errors.push('game: ' + e));
    await pg.emulate({ viewport: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
    await setCookies(pg, P2.j);
    await pg.goto(`${BASE}/graj?postac=${P2.cid}`, { waitUntil: 'networkidle2' }); await W(2500);
    for (let i = 0; i < 4; i++) { await pg.keyboard.press('Escape'); await W(150); } // close intro dialog
    await pg.evaluate(() => { const b = document.querySelector('[data-lt="get"]'); if (b) b.click(); }); await W(400);
    await pg.keyboard.press('c'); await W(400);
    await pg.type('#chatIn', 'halo, czemu nie mogę pisać?'); await pg.keyboard.press('Enter'); await W(800);
    await pg.evaluate(() => { const i = document.getElementById('chatIn'); if (i) i.blur(); }); await W(200);
    const mutedShown = await pg.evaluate(() => [...document.querySelectorAll('#msgs .m')].some((e) => /wyciszony na czacie/.test(e.textContent)));
    ok(mutedShown, 'game chat shows the mute notice with remaining time');
    await pg.screenshot({ path: `${SHOTS}/57_muted_chat_phone.png` });
    ok(errors.length === 0, 'no JS errors in panel/game' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  } catch (e) { ok(false, 'exception: ' + (e && e.stack)); }
  if (browser) await browser.close();
  srv.kill('SIGTERM'); await W(800);
  ok(!/TypeError|ReferenceError|SyntaxError/.test(log), 'no server exceptions' + ((log.match(/.*(TypeError|ReferenceError).*/) || [''])[0]));
  console.log(`\nModeracja: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main();
