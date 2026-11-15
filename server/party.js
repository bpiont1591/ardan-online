'use strict';
// Parties (phase 2). A World feature: chat commands, party chat, shared kill credit and a member list for the HUD.
// Same plug-in shape (onJoin/onLeave/onTick + chat commands) is meant for trade, guilds and PvP later.
const MAX_SIZE = 5;
const SHARE_RANGE = 20;      // tiles: members this close (same region) get kill credit
const INVITE_MS = 60e3;
const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

function createParties(world) {
  const chat = world.chat;
  const parties = new Map();   // id -> { id, leader: pid, members: [pid] }
  const invites = new Map();   // invitee pid -> { from: pid, party: id|null, exp }
  let nextId = 1;
  const sys = (p, t) => chat.sys(p, t);
  const P = (pid) => world.players.get(pid);
  const partyOf = (p) => (p.partyId ? parties.get(p.partyId) : null);
  const members = (party) => party.members.map(P).filter(Boolean);

  function notify(party, text) { for (const m of members(party)) sys(m, text); }
  function push(party) { for (const m of members(party)) m.partyDirty = true; }
  function removeMember(p, reason) {
    const party = partyOf(p); if (!party) return;
    party.members = party.members.filter((id) => id !== p.pid); p.partyId = null; p.partyDirty = true;
    if (party.members.length < 2) {
      for (const m of members(party)) { m.partyId = null; m.partyDirty = true; sys(m, 'Drużyna została rozwiązana.'); }
      parties.delete(party.id); return;
    }
    if (party.leader === p.pid) { party.leader = party.members[0]; const L = P(party.leader); notify(party, `${p.nick} ${reason}. Nowym liderem jest ${L ? L.nick : '?'}.`); }
    else notify(party, `${p.nick} ${reason}.`);
    push(party);
  }

  const cmds = {
    zapros(p, rest) {
      const nick = rest.trim().split(/\s+/)[0];
      if (!nick) return sys(p, 'Użycie: /zapros nick');
      const to = world.byNick(nick);
      if (!to) return sys(p, `Gracz „${nick}” nie jest teraz w grze.`);
      if (to === p) return sys(p, 'Nie możesz zaprosić samego siebie.');
      if (to.partyId) return sys(p, `${to.nick} jest już w drużynie.`);
      if (world.friends && world.friends.blocks(p, to)) return sys(p, `Zablokowałeś gracza ${to.nick} – odblokuj go, aby zaprosić.`);
      if (world.friends && world.friends.blocks(to, p)) return sys(p, `${to.nick} nie przyjmuje od ciebie zaproszeń.`);
      const party = partyOf(p);
      if (party && party.leader !== p.pid) return sys(p, 'Tylko lider może zapraszać do drużyny.');
      if (party && party.members.length >= MAX_SIZE) return sys(p, `Drużyna jest pełna (maks. ${MAX_SIZE}).`);
      const ex = invites.get(to.pid); if (ex && ex.exp > Date.now() && ex.from !== p.pid) return sys(p, `${to.nick} ma już oczekujące zaproszenie.`);
      invites.set(to.pid, { from: p.pid, exp: Date.now() + INVITE_MS });
      to.partyDirty = true;
      sys(p, `Wysłano zaproszenie do drużyny dla ${to.nick}.`);
      sys(to, `${p.nick} zaprasza cię do drużyny. Wpisz /akceptuj lub /odrzuc (ważne 60 s).`);
    },
    akceptuj(p) {
      const inv = invites.get(p.pid); invites.delete(p.pid); p.partyDirty = true;
      if (!inv || inv.exp < Date.now()) return sys(p, 'Nie masz aktualnego zaproszenia do drużyny.');
      if (p.partyId) return sys(p, 'Najpierw opuść obecną drużynę (/opusc).');
      const from = P(inv.from); if (!from) return sys(p, 'Zapraszający gracz wyszedł z gry.');
      let party = partyOf(from);
      if (party && party.leader !== from.pid) return sys(p, 'Zaproszenie jest już nieaktualne.');
      if (!party) { party = { id: nextId++, leader: from.pid, members: [from.pid] }; parties.set(party.id, party); from.partyId = party.id; }
      if (party.members.length >= MAX_SIZE) return sys(p, 'Drużyna jest już pełna.');
      party.members.push(p.pid); p.partyId = party.id;
      notify(party, `${p.nick} dołącza do drużyny! (${party.members.length}/${MAX_SIZE})`);
      push(party);
    },
    odrzuc(p) {
      const inv = invites.get(p.pid); invites.delete(p.pid); p.partyDirty = true;
      if (!inv) return sys(p, 'Nie masz zaproszenia do drużyny.');
      sys(p, 'Odrzucono zaproszenie.'); const f = P(inv.from); if (f) sys(f, `${p.nick} odrzuca zaproszenie do drużyny.`);
    },
    opusc(p) { if (!p.partyId) return sys(p, 'Nie jesteś w drużynie.'); sys(p, 'Opuszczasz drużynę.'); removeMember(p, 'opuszcza drużynę'); },
    wyrzuc(p, rest) {
      const party = partyOf(p); if (!party) return sys(p, 'Nie jesteś w drużynie.');
      if (party.leader !== p.pid) return sys(p, 'Tylko lider może wyrzucać z drużyny.');
      const to = world.byNick(rest.trim().split(/\s+/)[0] || '');
      if (!to || to.partyId !== party.id || to === p) return sys(p, 'Nie ma takiego członka drużyny.');
      sys(to, 'Zostałeś usunięty z drużyny.'); removeMember(to, 'został usunięty z drużyny');
    },
    druzyna(p) {
      const party = partyOf(p); if (!party) return sys(p, 'Nie jesteś w drużynie. Zaproś kogoś: /zapros nick');
      sys(p, 'Drużyna: ' + members(party).map((m) => `${m.nick}${m.pid === party.leader ? ' (lider)' : ''} – poz. ${m.api.P().lvl}`).join(', '));
    },
    p(p, rest) {
      const party = partyOf(p); if (!party) return sys(p, 'Nie jesteś w drużynie.');
      const text = String(rest || '').trim(); if (!text) return;
      const msg = { t: 'chat', ch: 'p', from: p.nick, text: chat.esc(chat.filter(text.slice(0, chat.MAX_LEN))), ts: Date.now(), role: p.role === 'admin' || p.role === 'moderator' ? p.role : undefined };
      for (const m of members(party)) if (!(world.friends && world.friends.blocks(m, p))) world.send(m, msg);
    },
  };
  // Polish-diacritic and English aliases
  Object.assign(cmds, { 'zaproś': cmds.zapros, zapro: cmds.zapros, invite: cmds.zapros, 'odrzuć': cmds.odrzuc, 'opuść': cmds.opusc, 'wyrzuć': cmds.wyrzuc, 'drużyna': cmds.druzyna, d: cmds.p });
  Object.assign(chat.commands, cmds);

  return {
    name: 'party',
    onJoin(p) {
      p.partyId = null; p.partyDirty = true;
      // shared kill credit: the killer's engine reports kills, nearby members get quest progress + 50% XP
      p.srv.onKill = (mk, mlvl, xp, x, y) => {
        const party = partyOf(p); if (!party) return;
        const KP = p.api.P();
        for (const m of members(party)) {
          if (m === p) continue; const MP = m.api.P();
          if (MP.area === KP.area && cheb(MP.x, MP.y, x, y) <= SHARE_RANGE) m.api.partyKill(mk, mlvl, xp, p.nick);
        }
      };
    },
    onLeave(p) { invites.delete(p.pid); for (const [k, v] of invites) if (v.from === p.pid) invites.delete(k); removeMember(p, 'wychodzi z gry'); },
    onTick() {
      const now = Date.now();
      for (const p of world.players.values()) {
        const party = partyOf(p);
        const inv = invites.get(p.pid); if (inv && inv.exp < now) { invites.delete(p.pid); p.partyDirty = true; }
        // member HP/area refresh twice a second
        if (party && (!p.partyT || now - p.partyT > 500)) p.partyDirty = true;
        if (!p.partyDirty) continue;
        p.partyDirty = false; p.partyT = now;
        const iv = invites.get(p.pid); const from = iv && P(iv.from);
        const view = {
          t: 'party',
          inv: from ? from.nick : null,
          lead: party ? (P(party.leader) || {}).nick || null : null,
          m: party ? members(party).map((m) => { const MP = m.api.P(); return { i: m.pid, n: m.nick, c: MP.cls, l: MP.lvl, hp: Math.max(0, Math.round(MP.hp)), mh: m.api.maxHp(), a: MP.area }; }) : [],
        };
        const js = JSON.stringify(view); if (js !== p.lastParty) { p.lastParty = js; world.send(p, view); }
      }
    },
    parties,
  };
}
module.exports = { createParties, MAX_SIZE };
