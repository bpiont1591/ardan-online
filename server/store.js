'use strict';
// Small JSON key-value store for shared world data (market, guilds, PvP ranking, offline mail).
// The demo build swaps this module for a localStorage version with the same interface.
const db = require('./db');
db.exec('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
const qGet = db.prepare('SELECT v FROM kv WHERE k = ?');
const qSet = db.prepare('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v');
const cache = {};
function get(k, def) {
  if (!(k in cache)) { const r = qGet.get(k); let v = def; if (r) { try { v = JSON.parse(r.v); } catch (e) { v = def; } } cache[k] = v; }
  return cache[k];
}
function set(k, v) { cache[k] = v; qSet.run(k, JSON.stringify(v)); }
module.exports = { get, set };
