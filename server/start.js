'use strict';
// Production entry point: (1) restore the DB from Postgres if configured and the local file is missing,
// (2) run migrations, (3) create the first admin from env vars, (4) start the game server.
const cfg = require('./config');
(async () => {
  if (cfg.databaseUrl) {
    try { await require('./pgsnap').restoreIfNeeded(cfg.dbPath); }
    catch (e) { console.error('[ARDAN] Nie udało się połączyć z Postgresem (DATABASE_URL):', e.message); if (cfg.isProd) { console.error('[ARDAN] Przerywam start, żeby nie nadpisać danych pustą bazą.'); process.exit(1); } }
  }
  require('./db');
  try { require('./adminboot').ensureAdmin(); } catch (e) { console.error('[ARDAN] Administrator:', e.message); }
  require('./index');
})();
