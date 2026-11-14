'use strict';
// Achievements with selectable titles shown next to the nickname.
const store = require('./store');
const A = [
  { id: 'first', n: 'Pierwsza krew', d: 'Wygraj pierwszą walkę.', t: 'Nowicjusz', c: 'wins', need: 1 },
  { id: 'rats', n: 'Plaga szczurów', d: 'Pokonaj 25 szczurów.', t: 'Pogromca Szczurów', c: 'rats', need: 25 },
  { id: 'k100', n: 'Łowca', d: 'Pokonaj 100 potworów.', t: 'Łowca Potworów', c: 'kills', need: 100 },
  { id: 'k500', n: 'Postrach', d: 'Pokonaj 500 potworów.', t: 'Postrach Ardanu', c: 'kills', need: 500 },
  { id: 'elite', n: 'Łamacz elit', d: 'Pokonaj 25 elitarnych potworów.', t: 'Łamacz Elit', c: 'elites', need: 25 },
  { id: 'lvl5', n: 'Wędrowiec', d: 'Osiągnij 5. poziom.', t: 'Wędrowiec', c: 'lvl', need: 5 },
  { id: 'lvl10', n: 'Weteran', d: 'Osiągnij 10. poziom.', t: 'Weteran', c: 'lvl', need: 10 },
  { id: 'lvl20', n: 'Bohater', d: 'Osiągnij 20. poziom.', t: 'Bohater Ardanu', c: 'lvl', need: 20 },
  { id: 'dg1', n: 'W głąb ciemności', d: 'Ukończ dowolny loch.', t: 'Poszukiwacz Lochów', c: 'dungeons', need: 1 },
  { id: 'dg_goblin', n: 'Upadek Grzmota', d: 'Pokonaj Wodza Grzmota w Norze Goblinów.', t: 'Pogromca Goblinów', c: 'dg_goblin', need: 1 },
  { id: 'dg_crypt', n: 'Cisza w krypcie', d: 'Pokonaj Panią Topieli w Zatopionej Krypcie.', t: 'Pogromca Topieli', c: 'dg_crypt', need: 1 },
  { id: 'dg_tomb', n: 'Koniec kultu', d: 'Pokonaj Arcykapłana Anubheta w Grobowcu Sethara.', t: 'Pogromca Kapłana', c: 'dg_tomb', need: 1 },
  { id: 'pvp1', n: 'Pierwszy pojedynek', d: 'Wygraj pojedynek PvP.', t: 'Gladiator', c: 'pvpw', need: 1 },
  { id: 'pvp10', n: 'Mistrz areny', d: 'Wygraj 10 pojedynków PvP.', t: 'Mistrz Areny', c: 'pvpw', need: 10 },
  { id: 'gather', n: 'Zbieracz', d: 'Zbierz 50 materiałów.', t: 'Zbieracz', c: 'gather', need: 50 },
  { id: 'craft1', n: 'Rzemieślnik', d: 'Wytwórz lub ulepsz pierwszą rzecz.', t: 'Rzemieślnik', c: 'craft', need: 1 },
  { id: 'craft25', n: 'Mistrz rzemiosła', d: 'Wytwórz lub ulepsz 25 rzeczy.', t: 'Mistrz Rzemiosła', c: 'craft', need: 25 },
  { id: 'up5', n: 'Kowal legend', d: 'Ulepsz przedmiot do +5.', t: 'Kowal Legend', c: 'upmax', need: 5 },
  { id: 'legend', n: 'Wybraniec losu', d: 'Zdobądź legendarny przedmiot.', t: 'Wybraniec Losu', c: 'legend', need: 1 },
  { id: 'sold', n: 'Kupiec', d: 'Sprzedaj przedmiot na rynku.', t: 'Kupiec', c: 'sold', need: 1 },
  { id: 'guild', n: 'Bractwo', d: 'Dołącz do gildii lub ją załóż.', t: 'Brat Gildii', c: 'guild', need: 1 },
  { id: 'daily10', n: 'Pracowity', d: 'Wykonaj 10 zadań dziennych.', t: 'Pracowity', c: 'daily', need: 10 },
  { id: 'streak7', n: 'Wierny Ardanowi', d: 'Loguj się 7 dni z rzędu.', t: 'Wierny', c: 'streak', need: 7 },
];
const BY = Object.fromEntries(A.map((a) => [a.id, a]));
function createAch(world) {
  const sys = (p, t) => world.chat.sys(p, t);
  const P = (p) => p.api.P();
  function ensure(p) { const Q = P(p); if (!Q.ach || typeof Q.ach !== 'object') Q.ach = {}; if (!Q.cnt || typeof Q.cnt !== 'object') Q.cnt = {}; if (Q.title && !Q.ach[Q.title]) Q.title = ''; p.title = Q.title && BY[Q.title] ? BY[Q.title].t : ''; }
  function val(p, c) { const Q = P(p); return c === 'lvl' ? Q.lvl : c === 'guild' ? (p.guildId ? 1 : Q.cnt.guild || 0) : Q.cnt[c] || 0; }
  function rank(p) { const k = store.get('achc', {}); k[p.ckey] = { n: p.nick, cls: P(p).cls, lvl: P(p).lvl, a: Object.keys(P(p).ach).length }; store.set('achc', k); }
  function check(p) {
    if (p.bot) return; const Q = P(p); let got = false;
    for (const a of A) {
      if (Q.ach[a.id]) continue;
      if (val(p, a.c) >= a.need) { Q.ach[a.id] = Date.now(); got = true; sys(p, `🏆 Osiągnięcie: ${a.n}! Nowy tytuł do wyboru: «${a.t}» (okno osiągnięć – O).`); world.send(p, { t: 'achnew', n: a.n, ti: a.t }); }
    }
    if (got) { if (Q.cnt.guild === undefined && p.guildId) Q.cnt.guild = 1; p.srv.dirty = true; p.achDirty = true; rank(p); }
  }
  const inc = (p, c, n) => { const Q = P(p); Q.cnt[c] = (Q.cnt[c] || 0) + (n || 1); };
  function view(p) { const Q = P(p); return { t: 'ach', title: Q.title || '', list: A.map((a) => ({ id: a.id, n: a.n, d: a.d, t: a.t, got: Q.ach[a.id] || 0, have: Math.min(a.need, val(p, a.c)), need: a.need })) }; }
  return {
    name: 'ach', A,
    onJoin(p) { if (p.bot) return; ensure(p); p.achDirty = true; rank(p); },
    onEvent(p, type, d) {
      if (p.bot) return; ensure(p);
      if (type === 'kill') { inc(p, 'kills'); if (d.k === 'rat') inc(p, 'rats'); if (d.elite || d.boss) inc(p, 'elites'); }
      else if (type === 'win') inc(p, 'wins');
      else if (type === 'dungeon') { inc(p, 'dungeons'); inc(p, 'dg_' + d.id); }
      else if (type === 'pvp') { inc(p, 'pvp'); if (d.win) inc(p, 'pvpw'); }
      else if (type === 'gather') inc(p, 'gather', d.q || 1);
      else if (type === 'craft') { inc(p, 'craft', d.n || 1); if (d.up) P(p).cnt.upmax = Math.max(P(p).cnt.upmax || 0, d.up); }
      else if (type === 'item') { if (d && d.r === 3) P(p).cnt.legend = 1; }
      else if (type === 'sold') inc(p, 'sold');
      else if (type === 'daily') inc(p, 'daily');
      else if (type === 'guild') P(p).cnt.guild = 1;
      else if (type === 'login') P(p).cnt.streak = Math.max(P(p).cnt.streak || 0, d.streak || 0);
      else return;
      p.achDirty = true; check(p);
    },
    onTick() {
      for (const p of world.players.values()) {
        if (p.bot) continue;
        if (!p.achT || Date.now() - p.achT > 2000) { p.achT = Date.now(); ensure(p); check(p); }
        if (p.achDirty) { p.achDirty = false; world.send(p, view(p)); }
      }
    },
    onMsg(p, msg) {
      if (msg.t !== 'ach') return false;
      ensure(p);
      if (msg.a === 'title' && typeof msg.id === 'string') {
        const Q = P(p);
        if (msg.id === '' || (BY[msg.id] && Q.ach[msg.id])) { Q.title = msg.id; p.title = msg.id ? BY[msg.id].t : ''; p.srv.dirty = true; sys(p, msg.id ? `Tytuł ustawiony: «${BY[msg.id].t}».` : 'Tytuł ukryty.'); }
      }
      p.achDirty = true;
      return true;
    },
  };
}
module.exports = { createAch, ACH: A };
