'use strict';
// Znajomi i blokowanie (round 10). Friend requests must be accepted; the list shows online/offline status and the land,
// friends coming online are announced. A block hides the blocked player's chat and whispers and rejects their trade,
// party, guild, friend and duel invitations (attacks on lethal PvP maps still follow the zone rules).
// Everything is decided here on the server. Data per character in the kv store: fr:<ckey> = { f, in, out, b } (ckey -> nick).
const store = require('./store');
const MAX_FRIENDS = 100, MAX_BLOCKS = 100, MAX_PENDING = 30;

function createFriends(world) {
  const sys = (p, t) => world.chat.sys(p, t);
  const key = (ck) => 'fr:' + ck;
  const data = (ck) => { const d = store.get(key(ck), null) || { f: {}, in: {}, out: {}, b: {} }; for (const k of ['f', 'in', 'out', 'b']) d[k] = d[k] || {}; return d; };
  const save = (ck, d) => store.set(key(ck), d);
  const online = (ck) => { for (const q of world.players.values()) if (q.ckey === ck) return q; return null; };
  // true when `recv` has blocked `sender` (sessions or ckeys)
  function blocks(recv, sender) {
    const r = recv && (recv.ckey || recv), s = sender && (sender.ckey || sender);
    if (!r || !s || r === s) return false;
    return !!data(r).b[s];
  }
  // either side blocked the other – used for invitations of any kind
  const either = (a, b) => blocks(a, b) || blocks(b, a);
  // resolve a nick to { ckey, nick } – online players first, then the database hook (real server only)
  function resolve(nick) {
    nick = String(nick || '').trim().slice(0, 20); if (!nick) return null;
    const q = world.byNick(nick); if (q) return { ckey: q.ckey, nick: q.nick };
    const r = typeof world.findChar === 'function' ? world.findChar(nick) : null;
    return r ? { ckey: 'c' + r.id, nick: r.nick } : null;
  }
  function view(p) {
    const d = data(p.ckey);
    const row = (ck) => { const q = online(ck); const P = q && q.api.P(); return { k: ck, n: (q && q.nick) || d.f[ck] || d.in[ck] || d.out[ck] || d.b[ck], on: !!q, area: P ? P.area : null, lvl: P ? P.lvl : undefined, cls: P ? P.cls : undefined, fb: q && q.battle ? 1 : undefined }; };
    const f = Object.keys(d.f).map(row).sort((a, b) => (b.on - a.on) || a.n.localeCompare(b.n, 'pl'));
    return { t: 'fr', f, in: Object.keys(d.in).map((k) => ({ k, n: d.in[k] })), out: Object.keys(d.out).map((k) => ({ k, n: d.out[k] })), b: Object.keys(d.b).map((k) => ({ k, n: d.b[k] })), max: MAX_FRIENDS };
  }
  const push = (p) => { if (p && !p.bot) world.send(p, view(p)); };
  const pushCk = (ck) => push(online(ck));

  function add(p, nick) {
    const t = resolve(nick); if (!t) return sys(p, `Nie znaleziono postaci „${String(nick || '').slice(0, 20)}”.`);
    if (t.ckey === p.ckey) return sys(p, 'Nie możesz dodać samego siebie.');
    const d = data(p.ckey), e = data(t.ckey);
    if (d.f[t.ckey]) return sys(p, `${t.nick} jest już na twojej liście znajomych.`);
    if (d.b[t.ckey]) return sys(p, `Najpierw odblokuj gracza ${t.nick}.`);
    if (e.b[p.ckey]) return sys(p, `${t.nick} nie przyjmuje od ciebie zaproszeń.`);
    if (Object.keys(d.f).length >= MAX_FRIENDS) return sys(p, `Możesz mieć najwyżej ${MAX_FRIENDS} znajomych.`);
    if (d.in[t.ckey]) return accept(p, t.ckey); // they already asked us – adding them accepts
    if (Object.keys(d.out).length >= MAX_PENDING || Object.keys(e.in).length >= MAX_PENDING) return sys(p, 'Zbyt wiele oczekujących zaproszeń.');
    d.out[t.ckey] = t.nick; e.in[p.ckey] = p.nick; save(p.ckey, d); save(t.ckey, e);
    sys(p, `Wysłano zaproszenie do znajomych: ${t.nick}.`);
    const q = online(t.ckey);
    if (q) { if (q.bot && q.bot.onFriend) q.bot.onFriend(p); else { world.send(q, { t: 'fr', req: p.nick, k: p.ckey }); sys(q, `${p.nick} zaprasza cię do znajomych. Otwórz listę znajomych (L), aby przyjąć.`); push(q); } }
    push(p);
  }
  function accept(p, ck) {
    const d = data(p.ckey); if (!d.in[ck]) return push(p);
    const e = data(ck), n = d.in[ck];
    delete d.in[ck]; delete e.out[p.ckey];
    if (d.b[ck] || e.b[p.ckey]) { save(p.ckey, d); save(ck, e); return push(p); }
    d.f[ck] = n; e.f[p.ckey] = p.nick; save(p.ckey, d); save(ck, e);
    sys(p, `${n} jest teraz twoim znajomym.`);
    const q = online(ck); if (q) { sys(q, `${p.nick} przyjmuje twoje zaproszenie do znajomych.`); push(q); }
    push(p);
  }
  function drop(p, ck, list, otherList) {
    const d = data(p.ckey); if (!d[list][ck]) return push(p);
    const e = data(ck); delete d[list][ck]; if (otherList) delete e[otherList][p.ckey];
    save(p.ckey, d); save(ck, e); pushCk(ck); push(p);
  }
  function block(p, ck, nick) {
    let t = ck && /^[a-z0-9_$:]{1,40}$/i.test(ck) ? { ckey: ck, nick: null } : resolve(nick);
    if (!t) return sys(p, `Nie znaleziono postaci „${String(nick || '').slice(0, 20)}”.`);
    if (t.ckey === p.ckey) return sys(p, 'Nie możesz zablokować samego siebie.');
    const d = data(p.ckey), e = data(t.ckey);
    const n = t.nick || d.f[t.ckey] || d.in[t.ckey] || d.out[t.ckey] || (online(t.ckey) || {}).nick; if (!n) return sys(p, 'Nie znaleziono tej postaci.');
    if (Object.keys(d.b).length >= MAX_BLOCKS && !d.b[t.ckey]) return sys(p, `Możesz zablokować najwyżej ${MAX_BLOCKS} graczy.`);
    d.b[t.ckey] = n; delete d.f[t.ckey]; delete d.in[t.ckey]; delete d.out[t.ckey];
    delete e.f[p.ckey]; delete e.in[p.ckey]; delete e.out[p.ckey];
    save(p.ckey, d); save(t.ckey, e);
    sys(p, `🚫 Zablokowano: ${n}. Nie zobaczysz jego wiadomości, a jego zaproszenia (handel, drużyna, gildia, znajomi, pojedynki) będą odrzucane.`);
    pushCk(t.ckey); push(p);
  }
  function unblock(p, ck) { const d = data(p.ckey); if (!d.b[ck]) return push(p); const n = d.b[ck]; delete d.b[ck]; save(p.ckey, d); sys(p, `Odblokowano: ${n}.`); push(p); }

  // chat commands: /znajomy nick, /blokuj nick, /odblokuj nick
  Object.assign(world.chat.commands, {
    znajomy: (p, r) => add(p, r.trim().split(/\s+/)[0]),
    blokuj: (p, r) => block(p, null, r.trim().split(/\s+/)[0]),
    odblokuj: (p, r) => { const n = r.trim().toLowerCase(); const d = data(p.ckey); const ck = Object.keys(d.b).find((k) => String(d.b[k]).toLowerCase() === n); if (ck) unblock(p, ck); else sys(p, 'Ten gracz nie jest zablokowany.'); },
  });
  return {
    name: 'friends', blocks, either, view, data, add, accept, block, unblock,
    onJoin(p) {
      if (p.bot) return;
      const d = data(p.ckey);
      // a friend changed their nick? keep the stored one fresh for the other side
      for (const ck of Object.keys(d.f)) {
        const q = online(ck); if (!q || q.bot) continue;
        world.send(q, { t: 'fr', on: p.nick, area: p.api.P().area }); push(q);
      }
      push(p);
      const n = Object.keys(d.in).length; if (n) sys(p, `Masz ${n} zaproszeń do znajomych – otwórz listę (L).`);
    },
    onLeave(p) { if (p.bot) return; const d = data(p.ckey); for (const ck of Object.keys(d.f)) pushCk(ck); },
    onMsg(p, msg) {
      if (msg.t !== 'fr') return false;
      const ck = typeof msg.k === 'string' && msg.k.length <= 40 ? msg.k : null;
      if (msg.a === 'get') push(p);
      else if (msg.a === 'add' && typeof msg.n === 'string') add(p, msg.n);
      else if (msg.a === 'accept' && ck) accept(p, ck);
      else if (msg.a === 'decline' && ck) drop(p, ck, 'in', 'out');
      else if (msg.a === 'cancel' && ck) drop(p, ck, 'out', 'in');
      else if (msg.a === 'remove' && ck) { const n = data(p.ckey).f[ck]; drop(p, ck, 'f', 'f'); if (n) sys(p, `Usunięto ze znajomych: ${n}.`); }
      else if (msg.a === 'block') block(p, ck, typeof msg.n === 'string' ? msg.n : null);
      else if (msg.a === 'unblock' && ck) unblock(p, ck);
      return true;
    },
  };
}
module.exports = { createFriends };
