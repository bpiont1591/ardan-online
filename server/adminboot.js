'use strict';
// First administrator from environment variables (ADMIN_LOGIN, ADMIN_EMAIL, ADMIN_PASSWORD).
// Creates the account if it doesn't exist, or gives an existing account the admin role. Never changes an existing password.
const bcrypt = require('bcryptjs');
const db = require('./db');
const cfg = require('./config');
function ensureAdmin(env, opts) {
  env = env || process.env; opts = opts || {}; const role = opts.role || 'admin', via = opts.via || 'start';
  const login = String(env.ADMIN_LOGIN || '').trim(), email = String(env.ADMIN_EMAIL || '').trim().toLowerCase(), pass = env.ADMIN_PASSWORD || '';
  if (!login) return null;
  const { LOGIN_RE, EMAIL_RE, passwordProblem } = require('./auth');
  const u = db.prepare('SELECT id, role FROM users WHERE login = ?').get(login);
  if (u) {
    if (u.role !== 'admin') { db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(u.id); console.log(`[ARDAN] Konto ${login} otrzymało rolę administratora (ADMIN_LOGIN).`); }
    return u.id;
  }
  if (!LOGIN_RE.test(login)) { console.error('[ARDAN] ADMIN_LOGIN: 3–20 znaków (litery bez polskich znaków, cyfry, _). Pomijam.'); return null; }
  if (!EMAIL_RE.test(email)) { console.error('[ARDAN] ADMIN_EMAIL jest nieprawidłowy. Pomijam tworzenie administratora.'); return null; }
  const pp = passwordProblem(pass, login, email); if (pp) { console.error('[ARDAN] ADMIN_PASSWORD: ' + pp + ' Pomijam tworzenie administratora.'); return null; }
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) { console.error('[ARDAN] ADMIN_EMAIL jest już używany przez inne konto. Pomijam.'); return null; }
  const info = db.prepare("INSERT INTO users (login, email, pass, created, role) VALUES (?, ?, ?, ?, ?)").run(login, email, bcrypt.hashSync(pass, cfg.bcryptCost), Date.now(), role);
  db.prepare("INSERT INTO audit (ts, actor_id, actor_login, action, target_id, target_login, detail, via) VALUES (?, NULL, ?, 'role', ?, ?, ?, ?)").run(Date.now(), via === 'cli' ? 'konsola' : 'system', info.lastInsertRowid, login, via === 'cli' ? `nowe konto z rolą: ${role}` : 'pierwszy administrator (zmienne środowiskowe)', via);
  console.log(`[ARDAN] Utworzono konto (${role}): ${login}. Zaloguj się i wejdź na /admin.`);
  return Number(info.lastInsertRowid);
}
module.exports = { ensureAdmin };
