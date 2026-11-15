'use strict';
// Admin / moderator API (/api/admin/*). Mounted under the CSRF guard; every route checks the role server-side.
const express = require('express');
const { needRole } = require('./auth');

function router(getMod, logs) {
  const r = express.Router();
  r.use(needRole('moderator'));
  const actor = (req) => ({ id: req.user.id, login: req.user.login });
  const target = (b) => { const id = Number(b && b.userId); return Number.isSafeInteger(id) && id > 0 ? getMod().user(id) : null; };
  const reply = (res, out) => (out.error ? res.status(out.error === 'Brak uprawnień.' ? 403 : 400).json(out) : res.json(out));
  const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');

  r.get('/me', (req, res) => res.json({ login: req.user.login, role: req.user.role, durations: Object.keys(getMod().DUR), durN: getMod().DUR_N, roles: getMod().ROLE_N }));
  r.get('/search', (req, res) => res.json({ users: getMod().search(str(req.query.q, 40)) }));
  r.get('/active', (req, res) => res.json(getMod().active()));
  r.get('/chat', (req, res) => res.json({ lines: getMod().chat(str(req.query.q, 40), Number(req.query.limit) || 150) }));
  // round 10: admin logs (trades, battles, logins, suspicious behaviour) – administrators only
  const day = (v, end) => { if (typeof v === 'string' && /^\d{10,14}$/.test(v)) return Number(v); if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return 0; const t = Date.parse(v + (end ? 'T23:59:59.999' : 'T00:00:00')); return Number.isFinite(t) ? t : 0; };
  r.get('/logs', needRole('admin'), (req, res) => {
    if (!logs) return res.json({ rows: [], total: 0, page: 1, pages: 1 });
    const uid = Number(req.query.uid);
    const out = logs.query({ type: str(req.query.type, 10), sub: str(req.query.sub, 16), nick: str(req.query.nick, 40).trim(), q: str(req.query.q, 60).trim(), uid: Number.isSafeInteger(uid) ? uid : 0,
      from: day(req.query.from), to: day(req.query.to, true), page: Number(req.query.page) || 1, per: Number(req.query.per) || 50 });
    res.json(Object.assign(out, { types: logs.TYPES, subs: logs.SUB_N }));
  });
  r.get('/logs/stats', needRole('admin'), (req, res) => res.json(logs ? logs.stats() : {}));
  r.get('/audit', needRole('admin'), (req, res) => res.json({ entries: getMod().audit(300) }));
  r.post('/mute', (req, res) => reply(res, getMod().mute(actor(req), target(req.body), str(req.body.dur, 8), str(req.body.reason, 300))));
  r.post('/unmute', (req, res) => reply(res, getMod().unmute(actor(req), target(req.body))));
  r.post('/ban', (req, res) => reply(res, getMod().ban(actor(req), target(req.body), str(req.body.dur, 8), str(req.body.reason, 300))));
  r.post('/unban', (req, res) => reply(res, getMod().unban(actor(req), target(req.body))));
  r.post('/kick', (req, res) => reply(res, getMod().kick(actor(req), target(req.body), str(req.body.reason, 300))));
  r.post('/role', needRole('admin'), (req, res) => reply(res, getMod().setRole(actor(req), target(req.body), str(req.body.role, 12))));
  return r;
}
module.exports = { router };
