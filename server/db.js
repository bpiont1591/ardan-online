'use strict';
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const cfg = require('./config');

fs.mkdirSync(path.dirname(cfg.dbPath), { recursive: true });
const db = new Database(cfg.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  login TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass TEXT NOT NULL,
  created INTEGER NOT NULL,
  last_login INTEGER
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,               -- sha256 of the cookie token (raw token is never stored)
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created INTEGER NOT NULL,
  expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS resets (
  id TEXT PRIMARY KEY,               -- sha256 of the emailed token
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
`);

module.exports = db;
