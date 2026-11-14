'use strict';
const path = require('path');
const http = require('http');
const express = require('express');
const helmet = require('helmet');
const { WebSocketServer } = require('ws');
const cfg = require('./config');
const auth = require('./auth');
const characters = require('./characters');
const { World } = require('./game');
const news = require('./news');
const mail = require('./mail');
const { ranking } = require('./ranking');
const db = require('./db');
const { createMod } = require('./mod');
const admin = require('./admin');
const backup = require('./backup');
const qTop = db.prepare('SELECT nick, cls, lvl FROM characters ORDER BY lvl DESC, updated ASC LIMIT 20');

const app = express();
const wsOrigin = (() => { try { const u = new URL(cfg.baseUrl); return (u.protocol === 'https:' ? 'wss://' : 'ws://') + u.host; } catch (e) { return null; } })();
const world = new World();
world.mod = createMod(world);
app.disable('x-powered-by');
if (cfg.trustProxy) app.set('trust proxy', cfg.trustProxy);
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src': ["'self'"], 'script-src': ["'self'"], 'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'blob:'], 'font-src': ["'self'"],
      // same-origin WebSocket only (CSP3 'self' covers ws/wss; the explicit origin is for older Safari). Dev keeps ws: for localhost ports.
      'connect-src': cfg.isProd ? ["'self'"].concat(wsOrigin ? [wsOrigin] : []) : ["'self'", 'ws:', 'wss:'],
      'object-src': ["'none'"], 'base-uri': ["'self'"], 'script-src-attr': ["'none'"], 'worker-src': ["'self'", 'blob:'], 'manifest-src': ["'self'"],
      'frame-ancestors': ["'none'"], 'form-action': ["'self'"], 'upgrade-insecure-requests': cfg.isProd ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: cfg.isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
}));
app.use((req, res, next) => { res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()'); next(); });
app.use(express.json({ limit: '16kb' }));
app.use(auth.attachUser);

const api = express.Router();
api.use(auth.apiLimiter);
api.use((req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
api.use(auth.csrfGuard);
api.use('/', auth.router());
api.use('/characters', characters.router((id) => world.isOnline(id)));
api.use('/admin', admin.router(() => world.mod));
api.get('/stats', (req, res) => { res.setHeader('Cache-Control', 'no-store'); res.json({ online: world.online() }); });
api.get('/news', (req, res) => res.json(news));
let rkCache = null, rkAt = 0;
api.get('/ranking', (req, res) => { if (!rkCache || Date.now() - rkAt > 10000) { rkCache = ranking(qTop.all()); rkAt = Date.now(); } res.setHeader('Cache-Control', 'no-store'); res.json(rkCache); });
api.use((req, res) => res.status(404).json({ error: 'Nie znaleziono.' }));
app.use('/api', api);

app.get('/healthz', (req, res) => res.json({ ok: true, online: world.online() }));
const pub = path.join(__dirname, '..', 'public');
// moderation panel: the HTML itself is only served to logged-in moderators/admins (data routes check the role again)
app.get(['/admin', '/admin/'], (req, res) => {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Robots-Tag', 'noindex');
  if (!req.user) return res.redirect(302, '/logowanie?next=/admin');
  if (world.mod.rankOf(req.user.role) < 1) return res.status(403).sendFile(path.join(pub, '404.html'));
  res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});
app.use(express.static(pub, { extensions: ['html'], maxAge: cfg.isProd ? '1h' : 0 }));
app.use((req, res) => res.status(404).sendFile(path.join(pub, '404.html')));
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Nieprawidłowe dane.' });
  if (err && (err.type === 'entity.too.large' || err.status === 413)) return res.status(413).json({ error: 'Za duże żądanie.' });
  console.error('[ARDAN]', err); if (res.headersSent) return; res.status(500).json({ error: 'Błąd serwera.' }); // never leak stack traces
});

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 });
// per-IP WebSocket caps: concurrent connections and connection attempts per minute
const wsConn = new Map(), wsHits = new Map();
const ipOf = (req) => (cfg.trustProxy && req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : req.socket.remoteAddress) || '?';
setInterval(() => wsHits.clear(), 60e3).unref();
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname !== '/ws') return socket.destroy();
  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  let ok = false; try { ok = !!origin && new URL(origin).host === host; } catch (e) { ok = false; }
  const user = auth.userFromCookieHeader(req.headers.cookie);
  const charId = Number(url.searchParams.get('postac'));
  const ip = ipOf(req), hits = (wsHits.get(ip) || 0) + 1; wsHits.set(ip, hits);
  if (hits > cfg.wsPerMin || (wsConn.get(ip) || 0) >= cfg.wsPerIp) { socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n'); return socket.destroy(); }
  if (!ok || !user || !Number.isInteger(charId) || charId <= 0) { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); return socket.destroy(); }
  wss.handleUpgrade(req, socket, head, (ws) => {
    const p = world.join(ws, user, charId);
    if (!p) return;
    p.role = user.role; world.mod.onJoin(p);
    p.sid = user.sid; wsConn.set(ip, (wsConn.get(ip) || 0) + 1);
    let gone = false; const bye = () => { if (gone) return; gone = true; const n = (wsConn.get(ip) || 1) - 1; if (n > 0) wsConn.set(ip, n); else wsConn.delete(ip); };
    ws.on('message', (data, isBinary) => { if (!isBinary) world.onMessage(p, data.toString()); });
    ws.on('close', () => { bye(); world.leave(p); });
    ws.on('error', () => world.leave(p));
  });
});

world.start();
backup.start(db);
setInterval(() => { try { auth.cleanup(); } catch (e) { console.error(e); } }, 3600e3).unref();
// sessions are re-validated for live game connections (logout elsewhere / password reset kicks the socket)
setInterval(() => { for (const p of world.players.values()) if (p.sid && !auth.sessionValid(p.sid)) try { p.ws.close(4001, 'session'); } catch (e) { /* ignore */ } }, 30e3).unref();
process.on('unhandledRejection', (e) => console.error('[ARDAN] unhandled', e));
server.listen(cfg.port, cfg.host, () => {
  console.log(`[ARDAN] Serwer działa: ${cfg.baseUrl} (port ${cfg.port}, tryb: ${cfg.isProd ? 'produkcja' : 'deweloperski'})`);
  if (!mail.configured()) console.log('[ARDAN] SMTP nieskonfigurowane – linki resetu hasła będą wypisywane w konsoli (tylko tryb deweloperski).');
});
let closing = false;
async function shutdown() {
  if (closing) return; closing = true;
  console.log('[ARDAN] Zamykanie – zapisywanie postaci...'); world.stop(); server.close();
  try { await backup.finalSnapshot(db); } catch (e) { console.error('[ARDAN] snapshot przy zamykaniu', e.message); }
  setTimeout(() => process.exit(0), 300);
}
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
module.exports = { app, server, world };
