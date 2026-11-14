#!/usr/bin/env node
'use strict';
// npm run make-admin -- <login> [--role moderator|admin|gracz] [--email adres --create]
// Gives an existing account a role (default: admin). With --create and --email it creates a new account
// with a random strong password that is printed ONCE (or ADMIN_PASSWORD from the environment).
const crypto = require('crypto');
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : undefined; };
let login = null;
for (let i = 0; i < args.length; i++) { if (args[i] === '--role' || args[i] === '--email') i++; else if (!args[i].startsWith('--') && !login) login = args[i]; }
const role = opt('role') || 'admin';
if (!login || !['admin', 'moderator', 'gracz'].includes(role)) {
  console.log('Użycie: npm run make-admin -- <login> [--role admin|moderator|gracz] [--create --email adres@example.com]');
  process.exit(1);
}
const db = require('../server/db');
const u = db.prepare('SELECT id, login, role FROM users WHERE login = ?').get(login);
if (u) {
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, u.id);
  db.prepare("INSERT INTO audit (ts, actor_id, actor_login, action, target_id, target_login, detail, via) VALUES (?, NULL, 'konsola', 'role', ?, ?, ?, 'cli')").run(Date.now(), u.id, u.login, `${u.role} → ${role}`);
  console.log(`OK: konto „${u.login}” ma teraz rolę: ${role}.`);
  process.exit(0);
}
if (!args.includes('--create')) { console.error(`Nie ma konta „${login}”. Załóż je na stronie (/rejestracja) albo dodaj --create --email adres.`); process.exit(2); }
const email = String(opt('email') || '').toLowerCase();
const pass = process.env.ADMIN_PASSWORD || (crypto.randomBytes(12).toString('base64url') + 'aA1!');
const { ensureAdmin } = require('../server/adminboot');
const id = ensureAdmin({ ADMIN_LOGIN: login, ADMIN_EMAIL: email, ADMIN_PASSWORD: pass }, { role, via: 'cli' });
if (!id) process.exit(3);
if (!process.env.ADMIN_PASSWORD) console.log(`Hasło (zapisz je teraz, nie będzie pokazane ponownie): ${pass}`);
