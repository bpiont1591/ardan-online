'use strict';
// Gildie: create (costs gold), invite, ranks (Mistrz / Oficer / Członek), guild chat, tag over the head.
const store = require('./store');
const COST = 50;
const RANKS = ['Członek', 'Oficer', 'Mistrz'];
const NAME_RE = /^[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż0-9][A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż0-9 ]{1,22}[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż0-9]$/;
const TAG_RE = /^[A-Z0-9]{2,4}$/;
const KEY_RE = /^[a-z0-9]{1,16}$/;

function createGuilds(world) {
  const chat = world.chat, sys = (p, t) => chat.sys(p, t);
  const data = () => store.get('guilds', { next: 1, g: {} });
  const save = () => store.set('guilds', data());
  const byKey = (k) => { const g = data().g; for (const id of Object.keys(g)) if (g[id].m[k]) return g[id]; return null; };
  const guildOf = (p) => (p.guildId ? data().g[p.guildId] || null : null);
  const online = (g) => [...world.players.values()].filter((q) => q.guildId === g.id);
  function attach(p) { const g = byKey(p.ckey); p.guildId = g ? g.id : null; p.guildTag = g ? g.tag : null; p.gdDirty = true; }
  function touch(g) { for (const q of online(g)) { q.guildTag = g.tag; q.gdDirty = true; } }
  function view(p) {
    const g = guildOf(p); const inv = p.guildInv && p.guildInv.exp > Date.now() ? p.guildInv : null;
    if (!g) return { t: 'gd', g: null, inv: inv ? { name: inv.name, tag: inv.tag, from: inv.fromN } : null, cost: COST };
    const on = {}; for (const q of online(g)) on[q.ckey] = q.api.P().lvl;
    const members = Object.keys(g.m).map((k) => ({ k, n: g.m[k].n, r: g.m[k].r, c: g.m[k].c, on: k in on, l: on[k] || g.m[k].l || 1 })).sort((a, b) => b.r - a.r || (b.on - a.on) || a.n.localeCompare(b.n));
    return { t: 'gd', g: { id: g.id, name: g.name, tag: g.tag, motd: g.motd || '', my: g.m[p.ckey] ? g.m[p.ckey].r : 0, members, ranks: RANKS }, inv: null, cost: COST };
  }
  function create(p, name, tag, free) {
    name = String(name || '').trim().replace(/\s+/g, ' '); tag = String(tag || '').trim().toUpperCase();
    if (guildOf(p)) return sys(p, 'Należysz już do gildii.');
    if (!NAME_RE.test(name)) return sys(p, 'Nazwa gildii: 3–24 znaki (litery, cyfry, spacje).');
    if (!TAG_RE.test(tag)) return sys(p, 'Skrót gildii: 2–4 wielkie litery lub cyfry.');
    const d = data();
    for (const id of Object.keys(d.g)) { const g = d.g[id]; if (g.name.toLowerCase() === name.toLowerCase()) return sys(p, 'Gildia o tej nazwie już istnieje.'); if (g.tag === tag) return sys(p, 'Ten skrót jest już zajęty.'); }
    const P = p.api.P();
    if (!free) { if (P.gold < COST) return sys(p, `Założenie gildii kosztuje ${COST} zł.`); P.gold -= COST; p.srv.dirty = true; }
    const g = { id: String(d.next++), name, tag, leader: p.ckey, m: {}, motd: 'Witajcie w gildii!', t: Date.now() };
    g.m[p.ckey] = { n: p.nick, r: 2, c: P.cls, l: P.lvl };
    d.g[g.id] = g; save(); attach(p); world.emit('onEvent', p, 'guild', {});
    sys(p, `Założono gildię ${name} [${tag}]${free ? '' : ` (–${COST} zł)`}. Zapraszaj graczy w oknie gildii lub komendą /gzapros nick.`);
    return g;
  }
  function add(q, g, r) { const Q = q.api.P(); g.m[q.ckey] = { n: q.nick, r: r || 0, c: Q.cls, l: Q.lvl }; save(); attach(q); touch(g); }
  function invite(p, nick) {
    const g = guildOf(p); if (!g) return sys(p, 'Nie należysz do gildii.');
    if ((g.m[p.ckey] || {}).r < 1) return sys(p, 'Tylko Mistrz i Oficerowie mogą zapraszać.');
    const q = world.byNick(String(nick || '').trim()); if (!q || q === p) return sys(p, `Gracz „${nick}” nie jest teraz w grze.`);
    if (guildOf(q)) return sys(p, `${q.nick} należy już do gildii.`);
    q.guildInv = { id: g.id, name: g.name, tag: g.tag, from: p.ckey, fromN: p.nick, exp: Date.now() + 120e3 }; q.gdDirty = true;
    sys(p, `Zaproszono ${q.nick} do gildii.`);
    if (q.bot && q.bot.onGuildInvite) return q.bot.onGuildInvite(p, g);
    sys(q, `${p.nick} zaprasza cię do gildii ${g.name} [${g.tag}]. Otwórz okno gildii (U), aby dołączyć.`);
  }
  function accept(q) {
    const iv = q.guildInv; q.guildInv = null; q.gdDirty = true;
    const g = iv && iv.exp > Date.now() ? data().g[iv.id] : null;
    if (!g) return sys(q, 'Zaproszenie do gildii wygasło.');
    if (guildOf(q)) return sys(q, 'Należysz już do gildii.');
    if (Object.keys(g.m).length >= 50) return sys(q, 'Gildia jest pełna.');
    add(q, g, 0); world.emit('onEvent', q, 'guild', {});
    for (const o of online(g)) sys(o, `${q.nick} dołącza do gildii ${g.name}!`);
  }
  function leave(p) {
    const g = guildOf(p); if (!g) return;
    const me = g.m[p.ckey]; delete g.m[p.ckey];
    const rest = Object.keys(g.m);
    if (!rest.length) { delete data().g[g.id]; save(); attach(p); return sys(p, `Gildia ${g.name} została rozwiązana.`); }
    if (me && me.r === 2) { const nk = rest.sort((a, b) => g.m[b].r - g.m[a].r)[0]; g.m[nk].r = 2; g.leader = nk; }
    save(); attach(p); touch(g);
    sys(p, `Opuszczasz gildię ${g.name}.`); for (const o of online(g)) sys(o, `${p.nick} opuszcza gildię.`);
  }
  function manage(p, a, k) {
    const g = guildOf(p); if (!g || !KEY_RE.test(k) || !g.m[k] || k === p.ckey) return;
    const me = g.m[p.ckey].r, t = g.m[k];
    if (a === 'kick') {
      if (me < 1 || t.r >= me) return sys(p, 'Nie możesz wyrzucić tego członka.');
      delete g.m[k]; save();
      for (const q of world.players.values()) if (q.ckey === k) { attach(q); sys(q, `Zostajesz usunięty z gildii ${g.name}.`); }
      for (const o of online(g)) sys(o, `${t.n} zostaje usunięty z gildii.`);
    } else if (a === 'promote' || a === 'demote') {
      if (me < 2) return sys(p, 'Tylko Mistrz może zmieniać rangi.');
      t.r = a === 'promote' ? 1 : 0; save();
      for (const o of online(g)) sys(o, `${t.n} ma teraz rangę: ${RANKS[t.r]}.`);
    } else if (a === 'lead') {
      if (me < 2) return; t.r = 2; g.m[p.ckey].r = 1; g.leader = k; save();
      for (const o of online(g)) sys(o, `Nowym Mistrzem gildii jest ${t.n}.`);
    }
    touch(g);
  }
  function gchat(p, text) {
    const g = guildOf(p); if (!g) return sys(p, 'Nie należysz do gildii.');
    text = String(text || '').trim(); if (!text) return;
    const msg = { t: 'chat', ch: 'gu', from: p.nick, text: chat.esc(chat.filter(text.slice(0, chat.MAX_LEN))), ts: Date.now(), role: p.role === 'admin' || p.role === 'moderator' ? p.role : undefined };
    for (const o of online(g)) world.send(o, msg);
  }
  Object.assign(chat.commands, { gi: gchat, gzapros: (p, r) => invite(p, r.trim().split(/\s+/)[0]), 'gzaproś': (p, r) => invite(p, r.trim().split(/\s+/)[0]) });
  return {
    name: 'guild', create, add, invite, accept, byKey, data, COST,
    onJoin(p) { attach(p); },
    onLeave(p) { const g = guildOf(p); if (g) setTimeout(() => touch(g), 0); },
    onTick() {
      for (const p of world.players.values()) {
        if (p.bot || !(p.gdDirty || (p.guildId && (!p.gdT || Date.now() - p.gdT > 3000)))) continue;
        p.gdDirty = false; p.gdT = Date.now();
        const v = view(p); const s = JSON.stringify(v); if (s !== p.lastGd) { p.lastGd = s; world.send(p, v); }
      }
    },
    onMsg(p, msg) {
      if (msg.t !== 'gd') return false;
      const g = guildOf(p);
      if (msg.a === 'create') create(p, msg.name, msg.tag);
      else if (msg.a === 'invite') invite(p, msg.n);
      else if (msg.a === 'accept') accept(p);
      else if (msg.a === 'decline') { p.guildInv = null; }
      else if (msg.a === 'leave') leave(p);
      else if (['kick', 'promote', 'demote', 'lead'].indexOf(msg.a) >= 0 && typeof msg.k === 'string') manage(p, msg.a, msg.k);
      else if (msg.a === 'motd' && g && g.m[p.ckey].r >= 1) { g.motd = String(msg.text || '').slice(0, 140); save(); touch(g); }
      p.lastGd = ''; p.gdDirty = true;
      return true;
    },
  };
}
module.exports = { createGuilds, COST, RANKS };
