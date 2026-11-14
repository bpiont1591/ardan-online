'use strict';
// Admin / moderator API (/api/admin/*). Mounted under the CSRF guard; every route checks the role server-side.
const express = require('express');
const { needRole } = require('./auth');

function router(getMod) {
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
