'use strict';
// SQLite (better-sqlite3): WAL, versioned migrations (PRAGMA user_version), safe defaults for a persistent volume.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const cfg = require('./config');

fs.mkdirSync(path.dirname(cfg.dbPath), { recursive: true });
const db = new Database(cfg.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');   // safe with WAL; a power cut can lose only the last transactions, never corrupt
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');    // CLI scripts (make-admin) may write while the server runs

// Each migration runs once, in order, inside a transaction. Never edit an applied migration – add a new one.
const MIGRATIONS = [
  // 1: base schema (accounts, sessions, password resets, characters)
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    login TEXT NOT NULL UNIQUE COLLATE NOCASE,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    pass TEXT NOT NULL,
    created INTEGER NOT NULL,
    last_login INTEGER
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,               -- hash of the cookie token (raw token is never stored)
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created INTEGER NOT NULL,
    expires INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
  CREATE TABLE IF NOT EXISTS resets (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created INTEGER NOT NULL,
    expires INTEGER NOT NULL,
    used INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nick TEXT NOT NULL UNIQUE COLLATE NOCASE,
    cls TEXT NOT NULL,
    lvl INTEGER NOT NULL DEFAULT 1,
    area TEXT NOT NULL DEFAULT 'village',
    data TEXT,
    created INTEGER NOT NULL,
    updated INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS characters_user ON characters(user_id);
  CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL);`,
  // 2: roles + moderation (mutes, bans, audit log, chat log)
  `ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'gracz';
  CREATE TABLE mutes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    by_id INTEGER, by_login TEXT, reason TEXT NOT NULL DEFAULT '',
    created INTEGER NOT NULL, until INTEGER,            -- NULL = permanent
    lifted INTEGER, lifted_by TEXT
  );
  CREATE INDEX mutes_user ON mutes(user_id);
  CREATE TABLE bans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    by_id INTEGER, by_login TEXT, reason TEXT NOT NULL DEFAULT '',
    created INTEGER NOT NULL, until INTEGER,
    lifted INTEGER, lifted_by TEXT
  );
  CREATE INDEX bans_user ON bans(user_id);
  CREATE TABLE audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL, actor_id INTEGER, actor_login TEXT NOT NULL,
    action TEXT NOT NULL, target_id INTEGER, target_login TEXT, detail TEXT NOT NULL DEFAULT '', via TEXT NOT NULL DEFAULT 'panel'
  );
  CREATE INDEX audit_ts ON audit(ts);
  CREATE TABLE chatlog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL, user_id INTEGER, nick TEXT NOT NULL, ch TEXT NOT NULL, area TEXT, target TEXT, text TEXT NOT NULL
  );
  CREATE INDEX chatlog_ts ON chatlog(ts);`,
  // 3: admin logs (trades, battles, logins, suspicious behaviour) – pruned by age and per-type row caps (server/logs.js)
  `CREATE TABLE logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL, type TEXT NOT NULL, sub TEXT NOT NULL,
    user_id INTEGER, char_id INTEGER, nick TEXT, ip TEXT, other TEXT, amount INTEGER, detail TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX logs_ts ON logs(ts);
  CREATE INDEX logs_type ON logs(type, id);
  CREATE INDEX logs_user ON logs(user_id, id);
  CREATE INDEX logs_nick ON logs(nick COLLATE NOCASE, id);
  CREATE INDEX logs_other ON logs(other COLLATE NOCASE, id);`,
];
function migrate() {
  const v = db.pragma('user_version', { simple: true });
  for (let i = v; i < MIGRATIONS.length; i++) {
    db.transaction(() => { db.exec(MIGRATIONS[i]); db.pragma(`user_version = ${i + 1}`); })();
    if (i + 1 > 1 || v > 0) console.log(`[ARDAN] Migracja bazy danych: wersja ${i + 1}`);
  }
}
// databases created before migrations existed already have the v1 tables (IF NOT EXISTS keeps that safe)
migrate();
db.SCHEMA_VERSION = MIGRATIONS.length;
module.exports = db;
