'use strict';
// Optional Postgres snapshot persistence (DATABASE_URL). For hosts WITHOUT a persistent disk (e.g. Render free):
// the game keeps running on fast local SQLite, and a compressed copy of the whole database is stored in Postgres
// every SNAPSHOT_MINUTES (only if something changed) and on shutdown. On start, a missing local DB is restored
// from the newest snapshot. Worst case after a crash: the last few minutes are lost (never corrupted).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const cfg = require('./config');
let pool = null;
function getPool() {
  if (!cfg.databaseUrl) return null;
  if (!pool) {
    const { Pool } = require('pg');
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(cfg.databaseUrl) || /sslmode=disable/.test(cfg.databaseUrl);
    pool = new Pool({ connectionString: cfg.databaseUrl, max: 2, ssl: local ? false : { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
    pool.on('error', (e) => console.error('[ARDAN] Postgres:', e.message));
  }
  return pool;
}
async function ensureTable() {
  await getPool().query('CREATE TABLE IF NOT EXISTS ardan_snapshots (id BIGSERIAL PRIMARY KEY, created TIMESTAMPTZ NOT NULL DEFAULT now(), bytes INTEGER NOT NULL, sha TEXT NOT NULL, data BYTEA NOT NULL)');
}
async function restoreIfNeeded(dbPath) {
  if (!getPool()) return false;
  await ensureTable();
  const exists = fs.existsSync(dbPath) && fs.statSync(dbPath).size > 0;
  if (exists && process.env.SNAPSHOT_RESTORE !== 'force') { console.log('[ARDAN] Lokalna baza istnieje – pomijam przywracanie z Postgresa.'); return false; }
  const r = await getPool().query('SELECT id, created, data FROM ardan_snapshots ORDER BY id DESC LIMIT 1');
  if (!r.rows.length) { console.log('[ARDAN] Postgres: brak kopii – start z pustą bazą.'); return false; }
  const buf = zlib.gunzipSync(r.rows[0].data);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  for (const f of [dbPath + '-wal', dbPath + '-shm']) try { fs.unlinkSync(f); } catch (e) { /* */ }
  fs.writeFileSync(dbPath, buf);
  console.log(`[ARDAN] Przywrócono bazę z Postgresa (kopia #${r.rows[0].id} z ${new Date(r.rows[0].created).toISOString()}, ${buf.length} B).`);
  return true;
}
let lastChanges = -1, lastSha = '', busy = false;
async function snapshot(db, force) {
  if (!getPool() || busy) return false;
  const ch = db.prepare('SELECT total_changes() AS c').get().c;
  if (!force && ch === lastChanges) return false;
  busy = true;
  try {
    const raw = db.serialize(), sha = crypto.createHash('sha256').update(raw).digest('hex');
    lastChanges = ch;
    if (sha === lastSha) return false;
    const gz = zlib.gzipSync(raw, { level: 6 });
    await ensureTable();
    await getPool().query('INSERT INTO ardan_snapshots (bytes, sha, data) VALUES ($1, $2, $3)', [raw.length, sha, gz]);
    await getPool().query('DELETE FROM ardan_snapshots WHERE id NOT IN (SELECT id FROM ardan_snapshots ORDER BY id DESC LIMIT $1)', [Math.max(3, cfg.backupKeep)]);
    lastSha = sha;
    return true;
  } finally { busy = false; }
}
async function close() { if (pool) { await pool.end().catch(() => {}); pool = null; } }
module.exports = { restoreIfNeeded, snapshot, close, enabled: () => !!cfg.databaseUrl };
