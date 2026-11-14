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

const app = express();
const world = new World();
app.disable('x-powered-by');
if (cfg.trustProxy) app.set('trust proxy', cfg.trustProxy);
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src': ["'self'"], 'script-src': ["'self'"], 'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'blob:'], 'font-src': ["'self'"], 'connect-src': ["'self'", 'ws:', 'wss:'],
      'frame-ancestors': ["'none'"], 'form-action': ["'self'"], 'upgrade-insecure-requests': cfg.isProd ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(express.json({ limit: '16kb' }));
app.use(auth.attachUser);

const api = express.Router();
api.use(auth.csrfGuard);
api.use('/', auth.router());
api.use('/characters', characters.router((id) => world.isOnline(id)));
api.get('/stats', (req, res) => { res.setHeader('Cache-Control', 'no-store'); res.json({ online: world.online() }); });
api.get('/news', (req, res) => res.json(news));
api.use((req, res) => res.status(404).json({ error: 'Nie znaleziono.' }));
app.use('/api', api);

app.get('/healthz', (req, res) => res.json({ ok: true, online: world.online() }));
const pub = path.join(__dirname, '..', 'public');
app.use(express.static(pub, { extensions: ['html'], maxAge: cfg.isProd ? '1h' : 0 }));
app.use((req, res) => res.status(404).sendFile(path.join(pub, '404.html')));
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Nieprawidłowe dane.' });
  console.error('[ARDAN]', err); res.status(500).json({ error: 'Błąd serwera.' });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 });
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname !== '/ws') return socket.destroy();
  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  let ok = false; try { ok = !!origin && new URL(origin).host === host; } catch (e) { ok = false; }
  const user = auth.userFromCookieHeader(req.headers.cookie);
  const charId = Number(url.searchParams.get('postac'));
  if (!ok || !user || !Number.isInteger(charId)) { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); return socket.destroy(); }
  wss.handleUpgrade(req, socket, head, (ws) => {
    const p = world.join(ws, user, charId);
    if (!p) return;
    ws.on('message', (data) => world.onMessage(p, data.toString()));
    ws.on('close', () => world.leave(p));
    ws.on('error', () => world.leave(p));
  });
});

world.start();
setInterval(() => { try { auth.cleanup(); } catch (e) { console.error(e); } }, 3600e3).unref();
server.listen(cfg.port, cfg.host, () => {
  console.log(`[ARDAN] Serwer działa: ${cfg.baseUrl} (port ${cfg.port}, tryb: ${cfg.isProd ? 'produkcja' : 'deweloperski'})`);
  if (!mail.configured()) console.log('[ARDAN] SMTP nieskonfigurowane – linki resetu hasła będą wypisywane w konsoli (tylko tryb deweloperski).');
});
function shutdown() { console.log('[ARDAN] Zamykanie – zapisywanie postaci...'); world.stop(); server.close(); setTimeout(() => process.exit(0), 300); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
module.exports = { app, server, world };
