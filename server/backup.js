'use strict';
// Backups: a rotated copy of the SQLite file in DATA_DIR/backups (daily by default, keeps BACKUP_KEEP files)
// + optional Postgres snapshots (see pgsnap.js).
const fs = require('fs');
const path = require('path');
const cfg = require('./config');
const pgsnap = require('./pgsnap');
const dir = () => path.join(cfg.dataDir, 'backups');
async function fileBackup(db) {
  fs.mkdirSync(dir(), { recursive: true });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const file = path.join(dir(), `ardan-${stamp}.db`);
  await db.backup(file); // online backup API: consistent copy while the game is running
  const all = fs.readdirSync(dir()).filter((f) => /^ardan-.*\.db$/.test(f)).sort();
  for (const f of all.slice(0, Math.max(0, all.length - cfg.backupKeep))) fs.unlinkSync(path.join(dir(), f));
  console.log(`[ARDAN] Kopia zapasowa: ${file}`);
  return file;
}
function lastBackupAge() {
  try { const all = fs.readdirSync(dir()).filter((f) => /^ardan-.*\.db$/.test(f)).sort(); if (!all.length) return Infinity; return Date.now() - fs.statSync(path.join(dir(), all[all.length - 1])).mtimeMs; } catch (e) { return Infinity; }
}
function start(db) {
  const every = cfg.backupHours * 3600e3;
  const tick = () => { if (lastBackupAge() >= every - 60e3) fileBackup(db).catch((e) => console.error('[ARDAN] Błąd kopii zapasowej:', e.message)); };
  setTimeout(tick, 30e3).unref(); setInterval(tick, Math.min(every, 3600e3)).unref();
  if (pgsnap.enabled()) {
    console.log(`[ARDAN] Zapis kopii bazy do Postgresa co ${cfg.snapshotMinutes} min (DATABASE_URL).`);
    setInterval(() => pgsnap.snapshot(db).catch((e) => console.error('[ARDAN] Postgres snapshot:', e.message)), cfg.snapshotMinutes * 60e3).unref();
  }
}
async function finalSnapshot(db) { if (pgsnap.enabled()) { await pgsnap.snapshot(db, true); await pgsnap.close(); } }
module.exports = { start, fileBackup, finalSnapshot };
