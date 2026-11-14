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
    pomoc: (p) => sys(p, 'Komendy: /w nick wiadomość – prywatna, /r wiadomość – odpowiedz, /gracze – kto jest w tej krainie, /online – liczba graczy. Drużyna: /zapros nick, /akceptuj, /odrzuc, /opusc, /wyrzuc nick, /druzyna, /p wiadomość. Gildia: /gi wiadomość, /gzapros nick. Skróty: I – ekwipunek, R – rynek, U – gildia, P – PvP.'),
    gracze: (p) => { const list = world.inArea(p.area).map((o) => o.nick); sys(p, `W tej krainie (${list.length}): ${list.join(', ')}`); },
    online: (p) => sys(p, `Graczy online: ${world.players.size}.`),
    w: (p, rest) => {
      const m = /^(\S+)\s+([\s\S]+)$/.exec(rest);
      if (!m) return sys(p, 'Użycie: /w nick wiadomość');
      const to = world.byNick(m[1]);
      if (!to) return sys(p, `Gracz „${m[1]}” nie jest teraz w grze.`);
      if (to === p) return sys(p, 'Nie możesz pisać sam do siebie.');
      const text = esc(filter(m[2].slice(0, MAX_LEN)));
      const msg = { t: 'chat', ch: 'w', from: p.nick, to: to.nick, text, ts: Date.now() };
      world.send(to, msg); world.send(p, msg); to.lastWhisper = p.nick;
    },
    r: (p, rest) => { if (!p.lastWhisper) return sys(p, 'Nikt jeszcze do ciebie nie pisał.'); commands.w(p, p.lastWhisper + ' ' + rest); },
  };
  commands.kto = commands.gracze;

  function handle(p, msg) {
    let text = clean(msg.text);
    if (!text) return;
    if (text.length > MAX_LEN) text = text.slice(0, MAX_LEN);
    const now = Date.now();
    const isCmd = text[0] === '/' && !/^\/(w|r|p|d|gi)\s/i.test(text);
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
    if (text[0] === '/') {
      const m = /^\/(\S+)\s*([\s\S]*)$/.exec(text); const cmd = m && commands[m[1].toLowerCase()];
      if (!cmd) return sys(p, 'Nieznana komenda. Wpisz /pomoc.');
      return cmd(p, m[2] || '');
    }
    if (msg.ch === 'p' && commands.p) return commands.p(p, text);
    if (msg.ch === 'gu' && commands.gi) return commands.gi(p, text);
    const ch = msg.ch === 'r' ? 'r' : 'g';
    const out = { t: 'chat', ch, from: p.nick, cls: p.cls, text: esc(filter(text)), ts: now, area: ch === 'r' ? p.area : undefined };
    if (ch === 'g') world.broadcast(out); else for (const o of world.inArea(p.area)) world.send(o, out);
  }
  return { name: 'chat', handle, commands, sys, esc, filter, MAX_LEN };
}
module.exports = { createChat, esc, clean };
