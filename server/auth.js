'use strict';
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('./db');
const cfg = require('./config');
const mail = require('./mail');

const SID = 'ardan_sid', CSRF = 'ardan_csrf';
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const token = () => crypto.randomBytes(32).toString('base64url');
const now = () => Date.now();

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach((p) => {
    const i = p.indexOf('='); if (i < 0) return;
    const k = p.slice(0, i).trim(); if (!k) return;
    try { out[k] = decodeURIComponent(p.slice(i + 1).trim()); } catch (e) { /* ignore */ }
  });
  return out;
}
function cookie(res, name, value, opts) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'SameSite=Lax'];
  if (opts.httpOnly) parts.push('HttpOnly');
  if (cfg.cookieSecure) parts.push('Secure');
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(opts.maxAge)}`);
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', (Array.isArray(prev) ? prev : prev ? [prev] : []).concat(parts.join('; ')));
}

// ---------- sessions ----------
const qSessGet = db.prepare('SELECT s.user_id, s.expires, u.login, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?');
const qSessIns = db.prepare('INSERT INTO sessions (id, user_id, created, expires) VALUES (?, ?, ?, ?)');
const qSessDel = db.prepare('DELETE FROM sessions WHERE id = ?');
const qSessDelUser = db.prepare('DELETE FROM sessions WHERE user_id = ?');
function userFromCookieHeader(header) {
  const c = parseCookies(header);
  const t = c[SID]; if (!t || t.length > 100) return null;
  const row = qSessGet.get(sha(t));
  if (!row || row.expires < now()) return null;
  return { id: row.user_id, login: row.login, email: row.email };
}
function startSession(res, userId) {
  const t = token();
  qSessIns.run(sha(t), userId, now(), now() + cfg.sessionDays * 864e5);
  cookie(res, SID, t, { httpOnly: true, maxAge: cfg.sessionDays * 86400 });
}

// ---------- middleware ----------
function attachUser(req, res, next) {
  req.user = userFromCookieHeader(req.headers.cookie);
  const c = parseCookies(req.headers.cookie);
  req.csrf = c[CSRF];
  if (!req.csrf || req.csrf.length < 20) { req.csrf = token(); cookie(res, CSRF, req.csrf, { httpOnly: false, maxAge: 365 * 86400 }); }
  next();
}
// CSRF: double-submit token (header must equal cookie) + same-origin check + JSON-only bodies.
function csrfGuard(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const origin = req.headers.origin;
  if (origin) {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    let ok = false; try { ok = new URL(origin).host === host; } catch (e) { ok = false; }
    if (!ok) return res.status(403).json({ error: 'Niedozwolone źródło żądania.' });
  }
  const c = parseCookies(req.headers.cookie)[CSRF];
  const h = req.headers['x-csrf-token'];
  if (!c || !h || c.length !== h.length || !crypto.timingSafeEqual(Buffer.from(c), Buffer.from(h))) return res.status(403).json({ error: 'Nieprawidłowy token bezpieczeństwa. Odśwież stronę.' });
  if (!req.is('application/json')) return res.status(415).json({ error: 'Nieobsługiwany format.' });
  next();
}
const needUser = (req, res, next) => (req.user ? next() : res.status(401).json({ error: 'Zaloguj się.' }));

// ---------- validation ----------
const LOGIN_RE = /^[A-Za-z0-9_]{3,20}$/;
const EMAIL_RE = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[A-Za-z]{2,24}$/;
const NICK_RE = /^[A-Za-z0-9_ĄĆĘŁŃÓŚŹŻąćęłńóśźż]{3,16}$/;
function passwordProblem(p, login, email) {
  if (typeof p !== 'string' || p.length < 8) return 'Hasło musi mieć co najmniej 8 znaków.';
  if (p.length > 128) return 'Hasło jest za długie (maks. 128 znaków).';
  let kinds = 0;
  if (/[a-ząćęłńóśźż]/.test(p)) kinds++;
  if (/[A-ZĄĆĘŁŃÓŚŹŻ]/.test(p)) kinds++;
  if (/[0-9]/.test(p)) kinds++;
  if (/[^A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż]/.test(p)) kinds++;
  if (kinds < 3) return 'Hasło jest za słabe: użyj co najmniej trzech rodzajów znaków (małe i wielkie litery, cyfry, symbole).';
  const low = p.toLowerCase();
  if (login && low.includes(String(login).toLowerCase())) return 'Hasło nie może zawierać loginu.';
  if (email && low.includes(String(email).split('@')[0].toLowerCase()) && String(email).split('@')[0].length >= 4) return 'Hasło nie może zawierać nazwy z adresu e-mail.';
  if (/^(.)\1+$/.test(p) || ['password1!', 'qwerty123!', 'haslo123!'].includes(low)) return 'To hasło jest zbyt popularne.';
  return null;
}

const limiter = (windowMin, max, msg) => rateLimit({
  windowMs: windowMin * 60e3, max, standardHeaders: true, legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ error: msg }),
});
const loginLimiter = limiter(15, 10, 'Zbyt wiele prób logowania. Spróbuj ponownie za kilkanaście minut.');
const registerLimiter = limiter(60, 8, 'Zbyt wiele rejestracji z tego adresu. Spróbuj później.');
const forgotLimiter = limiter(60, 5, 'Zbyt wiele próśb o reset hasła. Spróbuj za godzinę.');
const resetLimiter = limiter(15, 10, 'Zbyt wiele prób. Spróbuj ponownie później.');
// extra per-account throttle for login (independent of IP)
const failByLogin = new Map();
function loginThrottled(key) { const f = failByLogin.get(key); return f && f.n >= 8 && now() - f.t < 15 * 60e3; }
function loginFailed(key) { const f = failByLogin.get(key) || { n: 0, t: now() }; if (now() - f.t > 15 * 60e3) { f.n = 0; f.t = now(); } f.n++; failByLogin.set(key, f); }

const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

// ---------- routes ----------
const qUserByLogin = db.prepare('SELECT * FROM users WHERE login = ? OR email = ?');
const qUserExists = db.prepare('SELECT login, email FROM users WHERE login = ? OR email = ?');
const qUserIns = db.prepare('INSERT INTO users (login, email, pass, created) VALUES (?, ?, ?, ?)');
const qUserByEmail = db.prepare('SELECT * FROM users WHERE email = ?');
const qUserLast = db.prepare('UPDATE users SET last_login = ? WHERE id = ?');
const qUserPass = db.prepare('UPDATE users SET pass = ? WHERE id = ?');
const qResetIns = db.prepare('INSERT INTO resets (id, user_id, created, expires) VALUES (?, ?, ?, ?)');
const qResetKill = db.prepare('UPDATE resets SET used = 1 WHERE user_id = ? AND used = 0');
const qResetGet = db.prepare('SELECT * FROM resets WHERE id = ?');
const qResetUse = db.prepare('UPDATE resets SET used = 1 WHERE id = ? AND used = 0');

function router() {
  const r = express.Router();
  r.get('/me', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!req.user) return res.json({ user: null, csrf: req.csrf });
    res.json({ user: { login: req.user.login, email: req.user.email }, csrf: req.csrf });
  });

  r.post('/register', registerLimiter, async (req, res) => {
    const b = req.body || {};
    const login = String(b.login || '').trim(), email = String(b.email || '').trim().toLowerCase();
    const pass = b.password, pass2 = b.password2;
    if (!LOGIN_RE.test(login)) return res.status(400).json({ error: 'Login: 3–20 znaków, tylko litery bez polskich znaków, cyfry i podkreślnik.', field: 'login' });
    if (!EMAIL_RE.test(email) || email.length > 254) return res.status(400).json({ error: 'Podaj poprawny adres e-mail.', field: 'email' });
    const pp = passwordProblem(pass, login, email); if (pp) return res.status(400).json({ error: pp, field: 'password' });
    if (pass !== pass2) return res.status(400).json({ error: 'Hasła nie są takie same.', field: 'password2' });
    if (b.terms !== true) return res.status(400).json({ error: 'Musisz zaakceptować regulamin.', field: 'terms' });
    const ex = qUserExists.get(login, email);
    if (ex) return res.status(409).json(ex.login.toLowerCase() === login.toLowerCase() ? { error: 'Ten login jest już zajęty.', field: 'login' } : { error: 'Konto z tym adresem e-mail już istnieje.', field: 'email' });
    const hash = await bcrypt.hash(pass, cfg.bcryptCost);
    let info;
    try { info = qUserIns.run(login, email, hash, now()); } catch (e) { return res.status(409).json({ error: 'Login lub e-mail jest już zajęty.' }); }
    startSession(res, info.lastInsertRowid);
    res.json({ ok: true });
  });

  r.post('/login', loginLimiter, async (req, res) => {
    const b = req.body || {};
    const id = String(b.login || '').trim().slice(0, 254), pass = String(b.password || '');
    const key = id.toLowerCase();
    if (!id || !pass) return res.status(400).json({ error: 'Podaj login i hasło.' });
    if (loginThrottled(key)) return res.status(429).json({ error: 'Zbyt wiele nieudanych prób dla tego konta. Spróbuj za 15 minut lub zresetuj hasło.' });
    const u = qUserByLogin.get(id, id.toLowerCase());
    const ok = await bcrypt.compare(pass.slice(0, 128), u ? u.pass : DUMMY_HASH);
    if (!u || !ok) { loginFailed(key); return res.status(401).json({ error: 'Nieprawidłowy login lub hasło.' }); }
    failByLogin.delete(key);
    qUserLast.run(now(), u.id);
    startSession(res, u.id);
    res.json({ ok: true });
  });

  r.post('/logout', (req, res) => {
    const t = parseCookies(req.headers.cookie)[SID];
    if (t) qSessDel.run(sha(t));
    cookie(res, SID, '', { httpOnly: true, maxAge: 0 });
    res.json({ ok: true });
  });

  r.post('/forgot', forgotLimiter, async (req, res) => {
    const email = String((req.body || {}).email || '').trim().toLowerCase();
    const generic = { ok: true, message: 'Jeśli konto z tym adresem istnieje, wysłaliśmy na nie link do ustawienia nowego hasła. Sprawdź skrzynkę (także SPAM).' };
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Podaj poprawny adres e-mail.' });
    const u = qUserByEmail.get(email);
    if (!u) return res.json(generic);
    const t = token();
    qResetKill.run(u.id);
    qResetIns.run(sha(t), u.id, now(), now() + cfg.resetMinutes * 60e3);
    const link = `${cfg.baseUrl}/nowe-haslo?token=${encodeURIComponent(t)}`;
    try { await mail.sendResetMail(u.email, u.login, link); } catch (e) { console.error('[ARDAN] Błąd wysyłki e-maila:', e.message); }
    res.json(generic);
  });

  r.post('/reset', resetLimiter, async (req, res) => {
    const b = req.body || {};
    const t = String(b.token || '');
    if (!t || t.length > 100) return res.status(400).json({ error: 'Link jest nieprawidłowy.' });
    const row = qResetGet.get(sha(t));
    if (!row || row.used || row.expires < now()) return res.status(400).json({ error: 'Link wygasł lub został już użyty. Poproś o nowy.' });
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id);
    if (!u) return res.status(400).json({ error: 'Link jest nieprawidłowy.' });
    const pp = passwordProblem(b.password, u.login, u.email); if (pp) return res.status(400).json({ error: pp, field: 'password' });
    if (b.password !== b.password2) return res.status(400).json({ error: 'Hasła nie są takie same.', field: 'password2' });
    if (qResetUse.run(row.id).changes !== 1) return res.status(400).json({ error: 'Link został już użyty.' });
    qUserPass.run(await bcrypt.hash(b.password, cfg.bcryptCost), u.id);
    qSessDelUser.run(u.id); // log out everywhere
    res.json({ ok: true });
  });
  return r;
}

function cleanup() {
  db.prepare('DELETE FROM sessions WHERE expires < ?').run(now());
  db.prepare('DELETE FROM resets WHERE expires < ? OR used = 1').run(now() - 864e5);
}

module.exports = { router, attachUser, csrfGuard, needUser, userFromCookieHeader, parseCookies, passwordProblem, NICK_RE, cleanup };
