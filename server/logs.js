'use strict';
// Admin logs (round 10): trades, battles, logins and suspicious behaviour, stored in SQLite.
// Writes are buffered and flushed in one transaction every 2 s. Retention: LOG_DAYS (default 30) and a row cap per type
// (LOG_MAX_<TYPE>), so the database – and the gzip snapshot stored in Postgres – stays small.
// Only the admin API (/api/admin/logs, role admin) reads this table; nothing here is ever sent to players.
const db = require('./db');

const TYPES = { trade: 'Handel', battle: 'Walki', login: 'Logowania', sus: 'Podejrzane' };
const SUB_N = {
  p2p: 'Wymiana między graczami', list: 'Wystawienie na rynku', buy: 'Zakup na rynku', cancel: 'Wycofanie z rynku', mail: 'Złoto z rynku (offline)',
  npc_buy: 'Zakup u NPC', npc_sell: 'Sprzedaż u NPC', npc_repair: 'Naprawa u NPC', gold: 'Przekazanie złota',
  kill: 'Zabicie elity / bossa', kills: 'Zabite potwory (zbiorczo)', death: 'Śmierć (PvE)', pvp: 'PvP', dungeon: 'Loch',
  ok: 'Logowanie', fail: 'Nieudane logowanie', game: 'Wejście do gry', out: 'Wyjście z gry',
  rate: 'Limit żądań', flood: 'Zalewanie serwera', packet: 'Błędny pakiet', range: 'Akcja poza zasięgiem', speed: 'Za szybki ruch',
  goldfix: 'Anomalia złota', wealth: 'Skok majątku', skin: 'Niedozwolony wygląd', throttle: 'Blokada konta (próby)',
};
const DAYS = Math.max(1, Number(process.env.LOG_DAYS) || 30);
const CAPS = {
  trade: Number(process.env.LOG_MAX_TRADE) || 25000, battle: Number(process.env.LOG_MAX_BATTLE) || 25000,
  login: Number(process.env.LOG_MAX_LOGIN) || 15000, sus: Number(process.env.LOG_MAX_SUS) || 15000,
};
const q = {
  ins: db.prepare('INSERT INTO logs (ts, type, sub, user_id, char_id, nick, ip, other, amount, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  old: db.prepare('DELETE FROM logs WHERE ts < ?'),
  nth: db.prepare('SELECT id FROM logs WHERE type = ? ORDER BY id DESC LIMIT 1 OFFSET ?'),
  cut: db.prepare('DELETE FROM logs WHERE type = ? AND id <= ?'),
  count: db.prepare('SELECT type, COUNT(*) AS n FROM logs GROUP BY type'),
};
let buf = [], timer = null;
const recent = new Map(); // throttle key -> { t, n } (suspicious events are logged at most once per 30 s per key)
const str = (v, n) => (v === undefined || v === null ? null : String(v).slice(0, n));
const int = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.round(Number(v)) : null);

function write(type, sub, who, o) {
  if (!TYPES[type]) return;
  who = who || {}; o = o || {};
  let detail = str(o.detail, 400) || '';
  if (o.throttle) {
    const k = type + '|' + sub + '|' + (who.charId || who.userId || who.ip || '') + '|' + o.throttle, now = Date.now(), r = recent.get(k);
    if (r && now - r.t < 30e3) { r.n++; return; }
    if (r && r.n) detail += ` (+${r.n} pominiętych w ciągu 30 s)`;
    recent.set(k, { t: now, n: 0 });
    if (recent.size > 5000) for (const [kk, v] of recent) if (now - v.t > 60e3) recent.delete(kk);
  }
  buf.push([Date.now(), type, String(sub).slice(0, 16), int(who.userId), int(who.charId), str(who.nick, 40), str(who.ip, 64), str(o.other, 40), int(o.amount), detail]);
  if (buf.length >= 500) flush(); else if (!timer) { timer = setTimeout(flush, 2000); if (timer.unref) timer.unref(); }
}
// a game session (world player) -> who
const whoOf = (p) => (p ? { userId: p.userId, charId: typeof p.charId === 'number' ? p.charId : null, nick: p.nick, ip: p.ip } : {});
function player(type, sub, p, o) { if (p && p.bot) return; write(type, sub, whoOf(p), o); }
function flush() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!buf.length) return;
  const rows = buf; buf = [];
  try { db.transaction(() => { for (const r of rows) q.ins.run(...r); })(); } catch (e) { console.error('[ARDAN] logi:', e.message); }
}
function prune() {
  flush();
  let n = q.old.run(Date.now() - DAYS * 86400e3).changes;
  for (const t of Object.keys(CAPS)) { const r = q.nth.get(t, CAPS[t]); if (r) n += q.cut.run(t, r.id).changes; }
  return n;
}
// admin query: filters (type, sub, player nick / user id, date range, free text), newest first, paginated
function query(f) {
  flush();
  f = f || {};
  const w = [], a = [];
  if (TYPES[f.type]) { w.push('type = ?'); a.push(f.type); }
  if (f.sub && SUB_N[f.sub]) { w.push('sub = ?'); a.push(f.sub); }
  if (Number.isSafeInteger(f.uid) && f.uid > 0) { w.push('user_id = ?'); a.push(f.uid); }
  if (f.nick) { w.push('(nick = ? COLLATE NOCASE OR other = ? COLLATE NOCASE)'); a.push(f.nick, f.nick); }
  if (Number.isFinite(f.from) && f.from > 0) { w.push('ts >= ?'); a.push(f.from); }
  if (Number.isFinite(f.to) && f.to > 0) { w.push('ts <= ?'); a.push(f.to); }
  if (f.q) { const like = '%' + String(f.q).replace(/[\\%_]/g, (c) => '\\' + c) + '%'; w.push("(detail LIKE ? ESCAPE '\\' OR nick LIKE ? ESCAPE '\\' OR other LIKE ? ESCAPE '\\' OR ip LIKE ? ESCAPE '\\')"); a.push(like, like, like, like); }
  const where = w.length ? 'WHERE ' + w.join(' AND ') : '';
  const per = Math.max(10, Math.min(200, Number(f.per) || 50));
  const total = db.prepare(`SELECT COUNT(*) AS n FROM (SELECT 1 FROM logs ${where} LIMIT 100000)`).get(...a).n;
  const pages = Math.max(1, Math.ceil(total / per));
  const page = Math.max(1, Math.min(pages, Number(f.page) || 1));
  const rows = db.prepare(`SELECT id, ts, type, sub, user_id, char_id, nick, ip, other, amount, detail FROM logs ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...a, per, (page - 1) * per);
  return { rows, total, page, pages, per };
}
function stats() {
  flush();
  const by = {}; let total = 0; for (const r of q.count.all()) { by[r.type] = r.n; total += r.n; }
  const pc = db.pragma('page_count', { simple: true }), ps = db.pragma('page_size', { simple: true }), fl = db.pragma('freelist_count', { simple: true });
  return { by, total, days: DAYS, caps: CAPS, dbBytes: pc * ps, freeBytes: fl * ps };
}
function start() {
  try { prune(); } catch (e) { console.error('[ARDAN] logi (czyszczenie):', e.message); }
  const t = setInterval(() => { try { prune(); } catch (e) { console.error('[ARDAN] logi (czyszczenie):', e.message); } }, 3600e3); if (t.unref) t.unref();
}
module.exports = { write, player, flush, prune, query, stats, start, TYPES, SUB_N, CAPS, DAYS };
