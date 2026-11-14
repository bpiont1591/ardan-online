'use strict';
// Central configuration (all values come from environment variables, see README).
const path = require('path');
const env = process.env;
const isProd = env.NODE_ENV === 'production';
module.exports = {
  isProd,
  port: Number(env.PORT) || 3000,
  host: env.HOST || '0.0.0.0',
  baseUrl: (env.BASE_URL || `http://localhost:${Number(env.PORT) || 3000}`).replace(/\/+$/, ''),
  dbPath: env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'ardan.db'),
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
