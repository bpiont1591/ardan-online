'use strict';
// Security regression tests: headers/CSP, cookies, CSRF, validation, rate limits/lockout, WebSocket auth + flood caps,
// XSS-safe chat, error handling (no stack traces), gold clamping and passive/legendary data sanity.
// Runs its own server with DEFAULT abuse limits on a separate port.
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const PORT = Number(process.env.SEC_PORT) || 3101, BASE = `http://localhost:${PORT}`;
const W = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? '  PASS ' : '  FAIL ') + m); return c; };

function jar() {
  const c = {};
  return {
    c,
    hdr() { return Object.entries(c).map(([k, v]) => `${k}=${v}`).join('; '); },
    take(res) { for (const s of res.headers.getSetCookie ? res.headers.getSetCookie() : []) { const [kv] = s.split(';'); const i = kv.indexOf('='); c[kv.slice(0, i)] = kv.slice(i + 1); } },
  };
}
async function req(j, method, p, body, extra) {
  const h = Object.assign({ cookie: j.hdr() }, extra || {});
  if (body !== undefined) h['content-type'] = 'application/json';
  if (method !== 'GET' && j.c.ardan_csrf && !('x-csrf-token' in h)) h['x-csrf-token'] = decodeURIComponent(j.c.ardan_csrf);
  const r = await fetch(BASE + p, { method, headers: h, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body), redirect: 'manual' });
  j.take(r); const txt = await r.text(); let data = null; try { data = JSON.parse(txt); } catch (e) { data = txt; }
  return { status: r.status, headers: r.headers, data, raw: r };
}
function wsOpen(j, charId, origin) {
  return new Promise((res) => {
    const ws = new WebSocket(`ws://localhost:${PORT}/ws?postac=${charId}`, { headers: { cookie: j.hdr(), origin: origin === undefined ? BASE : origin } });
    const msgs = []; let done = false;
    ws.on('message', (d) => { try { msgs.push(JSON.parse(d.toString())); } catch (e) { /* */ } });
    ws.on('open', () => { if (!done) { done = true; res({ ws, msgs, open: true }); } });
    ws.on('unexpected-response', (rq, r) => { if (!done) { done = true; res({ ws, msgs, open: false, status: r.statusCode }); } });
    ws.on('error', () => { if (!done) { done = true; res({ ws, msgs, open: false, status: 0 }); } });
  });
}

async function main() {
  const dbPath = `/tmp/ardan-sec-${Date.now()}.db`;
  let log = '';
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {
    env: { ...process.env, PORT: String(PORT), DATABASE_PATH: dbPath, BASE_URL: BASE, NODE_ENV: 'development', BCRYPT_COST: '4', SMTP_HOST: '', ARDAN_TEST_HOOKS: '1', API_PER_MIN: '', WS_PER_MIN: '', WS_PER_IP: '' },
  });
  srv.stdout.on('data', (d) => { log += d; }); srv.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < 50 && !log.includes('Serwer działa'); i++) await W(100);
  try {
    console.log('Nagłówki i ciasteczka');
    const j = jar();
    let r = await req(j, 'GET', '/');
    const csp = r.headers.get('content-security-policy') || '';
    ok(/default-src 'self'/.test(csp) && /script-src 'self'/.test(csp) && /object-src 'none'/.test(csp) && /frame-ancestors 'none'/.test(csp) && !/unsafe-eval/.test(csp), 'strict CSP: ' + csp.slice(0, 90) + '…');
    ok(r.headers.get('x-content-type-options') === 'nosniff', 'X-Content-Type-Options: nosniff');
    ok(/SAMEORIGIN|DENY/.test(r.headers.get('x-frame-options') || ''), 'X-Frame-Options set');
    ok(!r.headers.get('x-powered-by'), 'no X-Powered-By');
    ok(!!r.headers.get('permissions-policy') && !!r.headers.get('referrer-policy'), 'Permissions-Policy + Referrer-Policy');
    r = await req(j, 'GET', '/api/me');
    ok(r.data && r.data.csrf && j.c.ardan_csrf, 'CSRF cookie issued');
    ok(/no-store/.test(r.headers.get('cache-control') || ''), 'API responses are no-store');

    console.log('CSRF');
    const sfx = String(Date.now()).slice(-6);
    const U = { login: 'sec' + sfx, email: `sec${sfx}@example.com`, password: 'Bezpieczne-Haslo-9', password2: 'Bezpieczne-Haslo-9', terms: true };
    r = await req(j, 'POST', '/api/register', U, { 'x-csrf-token': 'zly-token-zly-token-zly-token' });
    ok(r.status === 403, 'register with wrong CSRF token -> 403');
    r = await req(j, 'POST', '/api/register', U, { origin: 'https://evil.example' });
    ok(r.status === 403, 'cross-origin POST -> 403');
    r = await fetch(BASE + '/api/register', { method: 'POST', headers: { cookie: j.hdr(), 'x-csrf-token': decodeURIComponent(j.c.ardan_csrf), 'content-type': 'application/x-www-form-urlencoded' }, body: 'login=a' });
    ok(r.status === 415, 'non-JSON body -> 415');

    console.log('Walidacja');
    r = await req(j, 'POST', '/api/register', Object.assign({}, U, { login: '<script>' }));
    ok(r.status === 400 && r.data.field === 'login', 'bad login rejected');
    r = await req(j, 'POST', '/api/register', Object.assign({}, U, { password: 'abc', password2: 'abc' }));
    ok(r.status === 400 && r.data.field === 'password', 'weak password rejected');
    r = await req(j, 'POST', '/api/register', Object.assign({}, U, { login: { $ne: 1 } }));
    ok(r.status === 400, 'object instead of string rejected');
    r = await req(j, 'POST', '/api/register', '{"login": "x", "pad": "' + 'A'.repeat(20000) + '"}');
    ok(r.status === 413 && !/at .*\.js/.test(JSON.stringify(r.data)), 'oversized body -> 413 without stack trace');
    r = await req(j, 'POST', '/api/register', '{"broken json');
    ok(r.status === 400 && !/SyntaxError|at /.test(JSON.stringify(r.data)), 'malformed JSON -> 400 without stack trace');
    r = await req(j, 'POST', '/api/register', U);
    ok(r.status === 200 && r.data.ok, 'valid registration');
    const sidCookie = (r.raw.headers.getSetCookie() || []).find((s) => s.startsWith('ardan_sid=')) || '';
    ok(/HttpOnly/i.test(sidCookie) && /SameSite=Lax/i.test(sidCookie) && /Path=\//.test(sidCookie), 'session cookie HttpOnly + SameSite');
    const sid1 = j.c.ardan_sid;
    r = await req(j, 'POST', '/api/login', { login: U.login, password: U.password });
    ok(r.status === 200 && j.c.ardan_sid !== sid1, 'login rotates the session id (fixation)');
    r = await req(j, 'GET', '/api/me');
    ok(r.data.user && r.data.user.login === U.login, 'new session works');
    r = await req(j, 'POST', '/api/characters', { nick: 'Sec' + sfx.slice(-4), cls: 'war' });
    ok(r.status === 200, 'character created'); const cid = r.data.id;
    r = await req(j, 'POST', '/api/characters', { nick: 'a<b>', cls: 'war' });
    ok(r.status === 400, 'HTML in nick rejected');

    console.log('Blokada logowania');
    const j2 = jar(); await req(j2, 'GET', '/api/me');
    let last = 0; for (let i = 0; i < 9; i++) last = (await req(j2, 'POST', '/api/login', { login: U.login, password: 'Zle-Haslo-' + i })).status;
    ok(last === 429, 'account lockout after repeated failures -> 429');

    console.log('WebSocket');
    let c = await wsOpen(jar(), cid);
    ok(!c.open && c.status === 401, 'WS without session -> 401');
    c = await wsOpen(j, cid, 'https://evil.example');
    ok(!c.open && c.status === 401, 'WS from foreign origin -> 401');
    const jOther = jar(); await req(jOther, 'GET', '/api/me');
    await req(jOther, 'POST', '/api/register', { login: 'oth' + sfx, email: `oth${sfx}@example.com`, password: 'Inne-Haslo-77x', password2: 'Inne-Haslo-77x', terms: true });
    c = await wsOpen(jOther, cid);
    await W(400);
    ok(!c.open || c.ws.readyState !== 1 || !c.msgs.some((m) => m.t === 'welcome' || m.t === 'snap'), "WS cannot join someone else's character");
    try { c.ws.close(); } catch (e) { /* */ }
    c = await wsOpen(j, cid);
    ok(c.open, 'WS with own session opens');
    await W(600);
    // XSS in chat is escaped server side
    c.ws.send(JSON.stringify({ t: 'chat', ch: 'r', text: '<img src=x onerror=alert(1)>' }));
    await W(500);
    const cm = c.msgs.filter((m) => m.t === 'chat' && /img/.test(m.text || ''));
    ok(cm.length > 0 && cm.every((m) => !/<img/.test(m.text) && /&lt;img/.test(m.text)), 'chat HTML is escaped');
    // oversized + malformed messages are ignored, socket survives
    c.ws.send('x'.repeat(5000)); c.ws.send('{bad'); c.ws.send(JSON.stringify({ t: 'in', mx: 1e9, my: 'a', acts: 'x' }));
    await W(300);
    ok(c.ws.readyState === 1, 'malformed / oversized messages ignored');
    // gold sanity clamp
    c.ws.send(JSON.stringify({ t: '__test', gold: -500 })); await W(300); c.ws.send(JSON.stringify({ t: '__test', heal: true })); await W(400);
    let g = c.msgs.filter((m) => m.t === 'gear').pop();
    ok(g && g.gold === 0, 'negative gold clamped to 0 (got ' + (g && g.gold) + ')');
    c.ws.send(JSON.stringify({ t: '__test', gold: 9e15 })); await W(300); c.ws.send(JSON.stringify({ t: '__test', heal: true })); await W(400);
    g = c.msgs.filter((m) => m.t === 'gear').pop();
    ok(g && g.gold === 2000000000, 'gold overflow clamped (got ' + (g && g.gold) + ')');
    c.ws.send(JSON.stringify({ t: 'mk', a: 'sell', u: 'abcdef12', pr: -5 })); await W(300);
    ok(c.msgs.some((m) => m.t === 'chat' && /Podaj cenę/.test(m.text || '')), 'negative market price rejected');
    // flood -> disconnect
    const closed = new Promise((res) => c.ws.on('close', (code) => res(code)));
    for (let i = 0; i < 400; i++) c.ws.send('{"t":"ping","ts":1}');
    const code = await Promise.race([closed, W(3000).then(() => -1)]);
    ok(code === 4008, 'WS flood -> connection closed (code ' + code + ')');
    // logout kills live sockets (session revalidation is periodic: just check session is invalid)
    r = await req(j, 'POST', '/api/logout', {});
    r = await req(j, 'GET', '/api/me');
    ok(r.data.user === null, 'logout invalidates the session');
    // connection caps per IP
    let refused = 0; for (let i = 0; i < 40; i++) { const x = await wsOpen(jar(), 1); if (x.status === 429) refused++; try { x.ws.terminate(); } catch (e) { /* */ } }
    ok(refused > 0, `WS connection attempts rate-limited per IP (${refused} refused)`);
    r = await req(j, 'GET', '/nie-ma-takiej-strony');
    ok(r.status === 404 && !/Error:|at /.test(String(r.data)), '404 page without stack trace');

    console.log('Dane gry');
    const P = require('../server/passives'), I = require('../server/items');
    ok(Object.keys(P.PX).length >= 20 && P.LEG.length >= 30, `${Object.keys(P.PX).length} passives, ${P.LEG.length} legendaries`);
    ok(P.LEG.every((d) => I.BASES[d.b] && d.px.every(([k]) => P.PX[k])), 'every legendary has a valid base and passives');
    const leg = I.makeLeg('berlo'); ok(leg && leg.r === 3 && leg.px.length >= 2 && leg.lore, 'makeLeg builds a legendary with passives + lore');
  } catch (e) { ok(false, 'exception: ' + (e && e.stack)); }
  srv.kill();
  console.log(`\nSecurity: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main();
