'use strict';
const express = require('express');
const db = require('./db');
const cfg = require('./config');
const { needUser, NICK_RE } = require('./auth');

const CLASSES = { war: 'Wojownik', arc: 'Łucznik', mag: 'Mag' };
const START_WEAPON = { war: 'club', arc: 'sbow', mag: 'wand' };
const AREA_NAMES = { village: 'Osada Brzozowa', forest: 'Mroczny Bór', cave: 'Jaskinia Cieni', swamp: 'Bagna Żałoby', town: 'Srebrnogród', mount: 'Szczyty Szronu', desert: 'Ruiny Piasków' };
const RESERVED = /^(admin|administrator|moderator|mod|gm|system|ardan|serwer|support)$/i;

const qList = db.prepare('SELECT id, nick, cls, lvl, area, updated FROM characters WHERE user_id = ? ORDER BY id');
const qCount = db.prepare('SELECT COUNT(*) AS n FROM characters WHERE user_id = ?');
const qNick = db.prepare('SELECT id FROM characters WHERE nick = ?');
const qIns = db.prepare('INSERT INTO characters (user_id, nick, cls, lvl, area, data, created, updated) VALUES (?, ?, ?, 1, ?, ?, ?, ?)');
const qGet = db.prepare('SELECT * FROM characters WHERE id = ? AND user_id = ?');
const qSave = db.prepare('UPDATE characters SET data = ?, lvl = ?, area = ?, updated = ? WHERE id = ?');

function newState(cls) {
  return { v: 2, cls, lvl: 1, xp: 0, hp: 9999, mp: 9999, gold: Math.max(0, Math.min(100000, Number(process.env.START_GOLD) || 20)), area: 'village', x: 18, y: 17, inv: [{ id: 'pot', n: 3 }], eq: { w: START_WEAPON[cls], a: 'shirt' }, q: {}, kills: 0, intro: false, track: '', seen: { village: 1 }, mmz: 1 };
}

function router(isOnline) {
  const r = express.Router();
  r.get('/', needUser, (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ max: cfg.maxCharacters, characters: qList.all(req.user.id).map((c) => ({ ...c, clsName: CLASSES[c.cls] || c.cls, areaName: AREA_NAMES[c.area] || c.area, online: isOnline(c.id) })) });
  });
  r.post('/', needUser, (req, res) => {
    const b = req.body || {};
    const nick = String(b.nick || '').trim(), cls = String(b.cls || '');
    if (!NICK_RE.test(nick)) return res.status(400).json({ error: 'Nick: 3–16 znaków (litery, także polskie, cyfry, podkreślnik).', field: 'nick' });
    if (RESERVED.test(nick)) return res.status(400).json({ error: 'Ten nick jest zarezerwowany.', field: 'nick' });
    if (!CLASSES[cls]) return res.status(400).json({ error: 'Wybierz klasę postaci.', field: 'cls' });
    if (qCount.get(req.user.id).n >= cfg.maxCharacters) return res.status(400).json({ error: `Możesz mieć maksymalnie ${cfg.maxCharacters} postacie.` });
    if (qNick.get(nick)) return res.status(409).json({ error: 'Ten nick jest już zajęty.', field: 'nick' });
    const t = Date.now();
    try {
      const info = qIns.run(req.user.id, nick, cls, 'village', JSON.stringify(newState(cls)), t, t);
      res.json({ ok: true, id: Number(info.lastInsertRowid) });
    } catch (e) { res.status(409).json({ error: 'Ten nick jest już zajęty.', field: 'nick' }); }
  });
  return r;
}

function load(charId, userId) {
  const row = qGet.get(charId, userId); if (!row) return null;
  let data = null; try { data = JSON.parse(row.data || 'null'); } catch (e) { data = null; }
  if (!data || typeof data !== 'object') data = newState(row.cls);
  data.cls = row.cls; // class is fixed at creation
  return { id: row.id, nick: row.nick, cls: row.cls, data };
}
function save(charId, P) {
  qSave.run(JSON.stringify(P), P.lvl | 0, String(P.area), Date.now(), charId);
}
module.exports = { router, load, save, CLASSES };
