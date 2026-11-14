'use strict';
// Moderation: roles (gracz < moderator < admin), chat mutes, account bans, kicks, audit log, chat log.
// Every check is server-side; the admin panel and chat commands both call these functions.
const db = require('./db');

const ROLES = ['gracz', 'moderator', 'admin'];
const RANK = { gracz: 0, moderator: 1, admin: 2 };
const ROLE_N = { gracz: 'Gracz', moderator: 'Moderator', admin: 'Administrator' };
const DUR = { '15m': 15 * 60e3, '1h': 3600e3, '24h': 86400e3, '7d': 7 * 86400e3, perm: null };
const DUR_N = { '15m': '15 minut', '1h': '1 godzinę', '24h': '24 godziny', '7d': '7 dni', perm: 'na stałe' };
const now = () => Date.now();
const rankOf = (role) => RANK[role] || 0;
const cleanReason = (s) => String(s || '').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim().slice(0, 200);

const q = {
  user: db.prepare('SELECT id, login, email, role, created, last_login FROM users WHERE id = ?'),
  userByLogin: db.prepare('SELECT id, login, email, role FROM users WHERE login = ?'),
  userByNick: db.prepare('SELECT u.id, u.login, u.email, u.role, c.nick FROM characters c JOIN users u ON u.id = c.user_id WHERE c.nick = ?'),
  role: db.prepare('SELECT role FROM users WHERE id = ?'),
  setRole: db.prepare('UPDATE users SET role = ? WHERE id = ?'),
  muteActive: db.prepare('SELECT * FROM mutes WHERE user_id = ? AND lifted IS NULL AND (until IS NULL OR until > ?) ORDER BY until IS NULL DESC, until DESC LIMIT 1'),
  banActive: db.prepare('SELECT * FROM bans WHERE user_id = ? AND lifted IS NULL AND (until IS NULL OR until > ?) ORDER BY until IS NULL DESC, until DESC LIMIT 1'),
  muteIns: db.prepare('INSERT INTO mutes (user_id, by_id, by_login, reason, created, until) VALUES (?, ?, ?, ?, ?, ?)'),
  banIns: db.prepare('INSERT INTO bans (user_id, by_id, by_login, reason, created, until) VALUES (?, ?, ?, ?, ?, ?)'),
  muteLift: db.prepare('UPDATE mutes SET lifted = ?, lifted_by = ? WHERE user_id = ? AND lifted IS NULL'),
  banLift: db.prepare('UPDATE bans SET lifted = ?, lifted_by = ? WHERE user_id = ? AND lifted IS NULL'),
  sessKill: db.prepare('DELETE FROM sessions WHERE user_id = ?'),
  auditIns: db.prepare('INSERT INTO audit (ts, actor_id, actor_login, action, target_id, target_login, detail, via) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
  auditList: db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT ?'),
  chatIns: db.prepare('INSERT INTO chatlog (ts, user_id, nick, ch, area, target, text) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  chatPrune: db.prepare('DELETE FROM chatlog WHERE id <= (SELECT MAX(id) FROM chatlog) - ?'),
  chatList: db.prepare('SELECT * FROM chatlog ORDER BY id DESC LIMIT ?'),
  chatSearch: db.prepare("SELECT * FROM chatlog WHERE nick LIKE ? ESCAPE '\\' OR text LIKE ? ESCAPE '\\' ORDER BY id DESC LIMIT ?"),
  search: db.prepare(`SELECT DISTINCT u.id, u.login, u.email, u.role, u.created, u.last_login FROM users u LEFT JOIN characters c ON c.user_id = u.id
    WHERE u.login LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\' OR c.nick LIKE ? ESCAPE '\\' ORDER BY u.last_login DESC NULLS LAST, u.id DESC LIMIT 50`),
  charsOf: db.prepare('SELECT id, nick, cls, lvl, area FROM characters WHERE user_id = ? ORDER BY id'),
  activeMutes: db.prepare('SELECT m.*, u.login, u.role FROM mutes m JOIN users u ON u.id = m.user_id WHERE m.lifted IS NULL AND (m.until IS NULL OR m.until > ?) ORDER BY m.id DESC'),
  activeBans: db.prepare('SELECT b.*, u.login, u.role FROM bans b JOIN users u ON u.id = b.user_id WHERE b.lifted IS NULL AND (b.until IS NULL OR b.until > ?) ORDER BY b.id DESC'),
  countAdmins: db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'"),
};
const like = (s) => '%' + String(s).replace(/[\\%_]/g, (c) => '\\' + c) + '%';

function fmtLeft(until) {
  if (until === null || until === undefined) return 'na stałe';
  const ms = Math.max(0, until - now()), m = Math.ceil(ms / 60e3);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  if (h < 48) return `${h} h${r ? ` ${r} min` : ''}`;
  return `${Math.floor(h / 24)} dni ${h % 24} h`;
}
const muteOf = (userId) => q.muteActive.get(userId, now()) || null;
const banOf = (userId) => q.banActive.get(userId, now()) || null;
const roleOf = (userId) => { const r = q.role.get(userId); return r && RANK[r.role] !== undefined ? r.role : 'gracz'; };
function banMessage(b) {
  return b.until === null ? `Konto zostało zablokowane na stałe. Powód: ${b.reason || 'brak'}.`
    : `Konto jest zablokowane do ${new Date(b.until).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })} (jeszcze ${fmtLeft(b.until)}). Powód: ${b.reason || 'brak'}.`;
}
function muteMessage(m) {
  return `Jesteś wyciszony na czacie ${m.until === null ? 'na stałe' : `jeszcze ${fmtLeft(m.until)}`}. Powód: ${m.reason || 'brak'}.`;
}

function createMod(world) {
  const audit = (actor, action, target, detail, via) => q.auditIns.run(now(), actor.id || null, actor.login, action, target ? target.id : null, target ? target.login : null, String(detail || '').slice(0, 300), via || 'panel');
  const livePlayers = (userId) => [...world.players.values()].filter((p) => p.userId === userId && !p.bot);
  const sys = (p, t) => world.chat.sys(p, t);
  // actor may only act on accounts with a LOWER role (moderator -> gracz, admin -> gracz/moderator)
  function guard(actor, target, minRole) {
    if (!target) return 'Nie znaleziono konta.';
    const ar = rankOf(roleOf(actor.id));
    if (ar < RANK[minRole || 'moderator']) return 'Brak uprawnień.';
    if (target.id === actor.id) return 'Nie możesz tego zrobić na własnym koncie.';
    if (rankOf(roleOf(target.id)) >= ar) return 'Nie możesz moderować konta z taką samą lub wyższą rolą.';
    return null;
  }
  function refreshLive(userId) {
    const m = muteOf(userId), role = roleOf(userId);
    for (const p of livePlayers(userId)) { p.mute = m ? { until: m.until, reason: m.reason } : null; p.role = role; }
  }
  const api = {
    ROLES, ROLE_N, DUR, DUR_N, muteOf, banOf, roleOf, banMessage, muteMessage, fmtLeft, rankOf,
    findTarget(s) { s = String(s || '').trim().slice(0, 40); if (!s) return null; return q.userByNick.get(s) || q.userByLogin.get(s) || null; },
    user: (id) => q.user.get(id) || null,
    onJoin(p) { refreshLive(p.userId); },
    mute(actor, target, dur, reason, via) {
      const e = guard(actor, target); if (e) return { error: e };
      if (!(dur in DUR)) return { error: 'Nieprawidłowy czas wyciszenia.' };
      reason = cleanReason(reason); if (!reason) return { error: 'Podaj powód.' };
      const until = DUR[dur] === null ? null : now() + DUR[dur];
      db.transaction(() => { q.muteLift.run(now(), actor.login, target.id); q.muteIns.run(target.id, actor.id, actor.login, reason, now(), until); audit(actor, 'mute', target, `${DUR_N[dur]} – ${reason}`, via); })();
      refreshLive(target.id);
      for (const p of livePlayers(target.id)) sys(p, `Moderator ${actor.login} wyciszył cię na czacie (${DUR_N[dur]}). Powód: ${reason}.`);
      return { ok: true, txt: `Wyciszono ${target.login} (${DUR_N[dur]}).` };
    },
    unmute(actor, target, via) {
      const e = guard(actor, target); if (e) return { error: e };
      const n = q.muteLift.run(now(), actor.login, target.id).changes;
      audit(actor, 'unmute', target, n ? '' : 'nie było aktywnego wyciszenia', via);
      refreshLive(target.id);
      for (const p of livePlayers(target.id)) sys(p, 'Wyciszenie na czacie zostało zdjęte.');
      return { ok: true, txt: `Zdjęto wyciszenie: ${target.login}.` };
    },
    ban(actor, target, dur, reason, via) {
      const e = guard(actor, target); if (e) return { error: e };
      if (!(dur in DUR)) return { error: 'Nieprawidłowy czas blokady.' };
      if (dur === 'perm' && rankOf(roleOf(actor.id)) < RANK.admin) return { error: 'Blokadę na stałe może nałożyć tylko administrator.' };
      reason = cleanReason(reason); if (!reason) return { error: 'Podaj powód.' };
      const until = DUR[dur] === null ? null : now() + DUR[dur];
      db.transaction(() => { q.banLift.run(now(), actor.login, target.id); q.banIns.run(target.id, actor.id, actor.login, reason, now(), until); q.sessKill.run(target.id); audit(actor, 'ban', target, `${DUR_N[dur]} – ${reason}`, via); })();
      api.kickUser(target.id, banMessage(banOf(target.id)));
      return { ok: true, txt: `Zablokowano konto ${target.login} (${DUR_N[dur]}).` };
    },
    unban(actor, target, via) {
      const e = guard(actor, target); if (e) return { error: e };
      const n = q.banLift.run(now(), actor.login, target.id).changes;
      audit(actor, 'unban', target, n ? '' : 'nie było aktywnej blokady', via);
      return { ok: true, txt: `Odblokowano konto ${target.login}.` };
    },
    kick(actor, target, reason, via) {
      const e = guard(actor, target); if (e) return { error: e };
      reason = cleanReason(reason) || 'decyzja moderatora';
      const n = api.kickUser(target.id, `Zostałeś wyrzucony z gry przez moderatora. Powód: ${reason}.`);
      audit(actor, 'kick', target, reason + (n ? '' : ' (gracz offline)'), via);
      return { ok: true, txt: n ? `Wyrzucono ${target.login} z gry.` : `${target.login} nie jest teraz w grze.` };
    },
    setRole(actor, target, role) {
      if (roleOf(actor.id) !== 'admin') return { error: 'Tylko administrator może zmieniać role.' };
      if (!target) return { error: 'Nie znaleziono konta.' };
      if (!(role in RANK)) return { error: 'Nieznana rola.' };
      if (target.id === actor.id) return { error: 'Nie możesz zmienić własnej roli.' };
      if (roleOf(target.id) === 'admin' && role !== 'admin' && q.countAdmins.get().n <= 1) return { error: 'Musi zostać co najmniej jeden administrator.' };
      const old = roleOf(target.id); q.setRole.run(role, target.id); audit(actor, 'role', target, `${ROLE_N[old]} → ${ROLE_N[role]}`, 'panel');
      refreshLive(target.id);
      return { ok: true, txt: `${target.login}: rola ${ROLE_N[role]}.` };
    },
    kickUser(userId, msg) {
      let n = 0;
      for (const p of livePlayers(userId)) { n++; try { world.send(p, { t: 'kick', reason: msg }); } catch (e) { /* */ } world.leave(p); try { p.ws.close(4003, 'kick'); } catch (e) { /* */ } }
      return n;
    },
    logChat(p, ch, text, target) {
      try { q.chatIns.run(now(), p.userId || null, p.nick, ch, ch === 'r' ? p.area : null, target || null, text); } catch (e) { console.error('[ARDAN] chatlog', e.message); }
    },
    pruneChat() { q.chatPrune.run(20000); },
    search(s) {
      s = String(s || '').trim().slice(0, 40);
      const rows = q.search.all(like(s), like(s), like(s));
      return rows.map((u) => {
        const m = muteOf(u.id), b = banOf(u.id);
        return { id: u.id, login: u.login, email: u.email, role: u.role, created: u.created, last: u.last_login,
          chars: q.charsOf.all(u.id).map((c) => ({ ...c, online: world.isOnline(c.id) })),
          mute: m && { until: m.until, reason: m.reason, by: m.by_login }, ban: b && { until: b.until, reason: b.reason, by: b.by_login } };
      });
    },
    active() { const t = now(); return { mutes: q.activeMutes.all(t), bans: q.activeBans.all(t) }; },
    chat(s, limit) { limit = Math.min(300, Math.max(10, limit | 0 || 100)); s = String(s || '').trim().slice(0, 40); return s ? q.chatSearch.all(like(s), like(s), limit) : q.chatList.all(limit); },
    audit: (limit) => q.auditList.all(Math.min(500, Math.max(10, limit | 0 || 200))),
    // in-game chat commands for moderators: /mute nick 1h powód, /unmute nick, /ban nick 7d powód, /unban nick, /kick nick powód
    command(p, cmd, rest) {
      const role = roleOf(p.userId); p.role = role;
      if (rankOf(role) < RANK.moderator) return false; // looks like an unknown command to normal players
      const actor = { id: p.userId, login: (q.user.get(p.userId) || {}).login || p.nick };
      const m = /^(\S+)\s*(\S*)\s*([\s\S]*)$/.exec(String(rest || '').trim());
      const usage = { mute: '/mute nick 15m|1h|24h|7d|perm powód', unmute: '/unmute nick', ban: '/ban nick 15m|1h|24h|7d|perm powód', unban: '/unban nick', kick: '/kick nick powód' };
      if (!m) { sys(p, 'Użycie: ' + usage[cmd]); return true; }
      const target = api.findTarget(m[1]);
      let r;
      if (cmd === 'mute') r = api.mute(actor, target, m[2], m[3], 'czat');
      else if (cmd === 'ban') r = api.ban(actor, target, m[2], m[3], 'czat');
      else if (cmd === 'unmute') r = api.unmute(actor, target, 'czat');
      else if (cmd === 'unban') r = api.unban(actor, target, 'czat');
      else if (cmd === 'kick') r = api.kick(actor, target, [m[2], m[3]].filter(Boolean).join(' '), 'czat');
      sys(p, r.error ? `${r.error} Użycie: ${usage[cmd]}` : r.txt);
      return true;
    },
  };
  setInterval(() => { try { api.pruneChat(); } catch (e) { /* */ } }, 3600e3).unref();
  return api;
}
module.exports = { createMod, ROLES, RANK, ROLE_N, DUR, DUR_N, muteOf, banOf, roleOf, banMessage, muteMessage, fmtLeft, rankOf };
