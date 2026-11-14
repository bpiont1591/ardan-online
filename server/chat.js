'use strict';
// Chat feature: global, region and private (/w nick) channels with basic moderation.
const MAX_LEN = 200;
const BAD = [/k+u+r+w+\p{L}*/giu, /ch+u+j+\p{L}*/giu, /pierd[oa]l\p{L}*/giu, /pizd\p{L}*/giu, /skurw\p{L}*/giu, /\bjeb\p{L}*/giu, /\bwyjeb\p{L}*/giu];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clean = (s) => String(s || '').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim();
const filter = (s) => BAD.reduce((t, re) => t.replace(re, (m) => m[0] + '*'.repeat(Math.max(2, m.length - 1))), s);

function createChat(world) {
  const sys = (p, text) => world.send(p, { t: 'chat', ch: 's', text: esc(text), ts: Date.now() });
  const commands = {
    pomoc: (p) => sys(p, 'Komendy: /w nick wiadomość – prywatna, /r wiadomość – odpowiedz, /gracze – kto jest w tej krainie, /online – liczba graczy. Drużyna: /zapros nick, /akceptuj, /odrzuc, /opusc, /wyrzuc nick, /druzyna, /p wiadomość. Gildia: /gi wiadomość, /gzapros nick. Skróty: I – ekwipunek, R – rynek, U – gildia, P – PvP, J – zadania dzienne, O – osiągnięcia, E – rozmowa / zbieranie / kuźnia / wejście do lochu.'),
    gracze: (p) => { const list = world.inArea(p.area).map((o) => o.nick); sys(p, `W tej krainie (${list.length}): ${list.join(', ')}`); },
    online: (p) => sys(p, `Graczy online: ${world.players.size}.`),
    w: (p, rest) => {
      const m = /^(\S+)\s+([\s\S]+)$/.exec(rest);
      if (!m) return sys(p, 'Użycie: /w nick wiadomość');
      const to = world.byNick(m[1]);
      if (!to) return sys(p, `Gracz „${m[1]}” nie jest teraz w grze.`);
      if (to === p) return sys(p, 'Nie możesz pisać sam do siebie.');
      const text = esc(filter(m[2].slice(0, MAX_LEN)));
      const msg = { t: 'chat', ch: 'w', from: p.nick, to: to.nick, text, ts: Date.now(), role: badge(p) };
      world.send(to, msg); world.send(p, msg); to.lastWhisper = p.nick;
    },
    r: (p, rest) => { if (!p.lastWhisper) return sys(p, 'Nikt jeszcze do ciebie nie pisał.'); commands.w(p, p.lastWhisper + ' ' + rest); },
  };
  commands.kto = commands.gracze;
  // moderator commands (real server only – world.mod checks the role in the database on every use)
  for (const c of ['mute', 'unmute', 'ban', 'unban', 'kick']) commands[c] = (p, rest) => { if (!(world.mod && world.mod.command(p, c, rest))) sys(p, 'Nieznana komenda. Wpisz /pomoc.'); };
  const badge = (p) => (p.role === 'admin' || p.role === 'moderator' ? p.role : undefined);

  function handle(p, msg) {
    let text = clean(msg.text);
    if (!text) return;
    if (text.length > MAX_LEN) text = text.slice(0, MAX_LEN);
    const now = Date.now();
    const isCmd = text[0] === '/' && !/^\/(w|r|p|d|gi)\s/i.test(text);
    if (p.mute && (p.mute.until === null || p.mute.until > now) && !isCmd) return sys(p, world.mod ? world.mod.muteMessage(p.mute) : 'Jesteś wyciszony.');
    if (p.muteUntil > now && !isCmd) return sys(p, `Jesteś wyciszony jeszcze ${Math.ceil((p.muteUntil - now) / 1000)} s.`);
    p.chatT = (p.chatT || []).filter((t) => now - t < 6000);
    if (p.chatT.length >= 4) {
      p.flood = (p.flood || 0) + 1;
      if (p.flood >= 3) { p.muteUntil = now + 60e3; p.flood = 0; return sys(p, 'Zostałeś wyciszony na 60 s za zalewanie czatu.'); }
      return sys(p, 'Zwolnij! Za dużo wiadomości – odczekaj kilka sekund.');
    }
    p.chatT.push(now);
    if (!isCmd) {
      if (p.lastChat === text && now - (p.lastChatT || 0) < 15000) return sys(p, 'Nie powtarzaj tej samej wiadomości.');
      p.lastChat = text; p.lastChatT = now;
    }
    if (world.mod) { // chat log for moderators (public, party, guild and private messages)
      const pm = /^\/(w|r|p|d|gi)\s+([\s\S]*)$/i.exec(text), k = pm && pm[1].toLowerCase();
      if (k === 'w') { const sp = pm[2].indexOf(' '); world.mod.logChat(p, 'w', sp > 0 ? pm[2].slice(sp + 1) : pm[2], sp > 0 ? pm[2].slice(0, sp) : null); }
      else if (k === 'r') world.mod.logChat(p, 'w', pm[2], p.lastWhisper || null);
      else if (k) world.mod.logChat(p, k === 'gi' ? 'gu' : 'p', pm[2]);
      else if (text[0] !== '/') world.mod.logChat(p, msg.ch === 'p' ? 'p' : msg.ch === 'gu' ? 'gu' : msg.ch === 'r' ? 'r' : 'g', text);
    }
    if (text[0] === '/') {
      const m = /^\/(\S+)\s*([\s\S]*)$/.exec(text); const cmd = m && commands[m[1].toLowerCase()];
      if (!cmd) return sys(p, 'Nieznana komenda. Wpisz /pomoc.');
      return cmd(p, m[2] || '');
    }
    if (msg.ch === 'p' && commands.p) return commands.p(p, text);
    if (msg.ch === 'gu' && commands.gi) return commands.gi(p, text);
    const ch = msg.ch === 'r' ? 'r' : 'g';
    const out = { t: 'chat', ch, from: p.nick, cls: p.cls, text: esc(filter(text)), ts: now, area: ch === 'r' ? p.area : undefined, role: badge(p) };
    if (ch === 'g') world.broadcast(out); else for (const o of world.inArea(p.area)) world.send(o, out);
  }
  return { name: 'chat', handle, commands, sys, esc, filter, MAX_LEN };
}
module.exports = { createChat, esc, clean };
