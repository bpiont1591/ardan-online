'use strict';
// Central configuration (all values come from environment variables, see README).
const path = require('path');
// optional .env file in the project root (local runs / VPS). Never overrides real environment variables.
try {
  const f = path.join(__dirname, '..', '.env');
  if (require('fs').existsSync(f)) for (const line of require('fs').readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line); if (!m || line.trim().startsWith('#')) continue;
    if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
} catch (e) { /* ignore */ }
const env = process.env;
const isProd = env.NODE_ENV === 'production';
module.exports = {
  isProd,
  port: Number(env.PORT) || 3000,
  host: env.HOST || '0.0.0.0',
  // Render sets RENDER_EXTERNAL_URL automatically, Fly sets FLY_APP_NAME – so BASE_URL is optional there
  baseUrl: (env.BASE_URL || env.RENDER_EXTERNAL_URL || (env.FLY_APP_NAME ? `https://${env.FLY_APP_NAME}.fly.dev` : '') || `http://localhost:${Number(env.PORT) || 3000}`).replace(/\/+$/, ''),
  // DATA_DIR = persistent folder (Render disk / Fly volume / Docker volume); DATABASE_PATH overrides the file itself
  dataDir: env.DATA_DIR || (env.DATABASE_PATH ? path.dirname(env.DATABASE_PATH) : path.join(__dirname, '..', 'data')),
  dbPath: env.DATABASE_PATH || path.join(env.DATA_DIR || path.join(__dirname, '..', 'data'), 'ardan.db'),
  backupKeep: Math.max(1, Number(env.BACKUP_KEEP) || 7),
  backupHours: Math.max(1, Number(env.BACKUP_HOURS) || 24),
  // optional Postgres "snapshot" persistence for hosts without a persistent disk (Render free + Neon free)
  databaseUrl: env.DATABASE_URL || '',
  snapshotMinutes: Math.max(1, Number(env.SNAPSHOT_MINUTES) || 10),
  sessionSecret: env.SESSION_SECRET || '',
  cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : isProd,
  trustProxy: env.TRUST_PROXY ? env.TRUST_PROXY : (isProd ? 1 : false),
  sessionDays: Number(env.SESSION_DAYS) || 30,
  resetMinutes: Number(env.RESET_TOKEN_MINUTES) || 30,
  bcryptCost: Math.min(15, Math.max(10, Number(env.BCRYPT_COST) || 12)), // never below 10
  maxCharacters: Number(env.MAX_CHARACTERS) || 3,
  smtp: {
    host: env.SMTP_HOST || '',
    port: Number(env.SMTP_PORT) || 587,
    secure: env.SMTP_SECURE === 'true',
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    from: env.MAIL_FROM || 'ARDAN <no-reply@localhost>',
  },
  // abuse limits (per IP); overridable for load tests
  apiPerMin: Number(env.API_PER_MIN) || 240,
  wsPerMin: Number(env.WS_PER_MIN) || 30,
  wsPerIp: Number(env.WS_PER_IP) || 8,
  tickMs: 50,
};
