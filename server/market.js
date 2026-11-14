'use strict';
// Rynek (auction house): list an item for gold, buy, cancel, browse with filters. Sellers who are offline get their gold on next login.
const I = require('./items');
const store = require('./store');
const MAX_OWN = 10, TAX = 0.05, MAX_PRICE = 10000000;
const U_RE = /^[a-z0-9]{6,24}$/;

function createMarket(world) {
  const sys = (p, t) => world.chat.sys(p, t);
  const data = () => store.get('market', { next: 1, list: [] });
  const mail = () => store.get('mail', {});
  const save = (d) => store.set('market', d);
  function pay(key, nick, amount, what) {
    for (const q of world.players.values()) if (q.ckey === key) { q.api.P().gold += amount; q.srv.dirty = true; if (!q.bot) sys(q, `Rynek: ${what} kupił(a) ${nick}. Otrzymujesz ${amount} zł.`); return; }
    const m = mail(); m[key] = m[key] || { gold: 0, n: 0 }; m[key].gold += amount; m[key].n++; store.set('mail', m);
  }
  function list(p, it, price) {
    const d = data();
    if (d.list.filter((x) => x.s === p.ckey).length >= MAX_OWN) { sys(p, `Możesz mieć najwyżej ${MAX_OWN} ofert na rynku.`); return null; }
    const L = { id: d.next++, s: p.ckey, sn: p.nick, it, pr: price, t: Date.now() };
    d.list.push(L); save(d);
    return L;
  }
  function browse(p, f) {
    f = f || {};
    const q = typeof f.q === 'string' ? f.q.toLowerCase().slice(0, 30) : '';
    let l = data().list.filter((x) => x.s !== p.ckey);
    if (f.slot) l = l.filter((x) => x.it.s === f.slot);
    if (f.cls === 'all') l = l.filter((x) => !x.it.c); else if (f.cls) l = l.filter((x) => !x.it.c || x.it.c === f.cls);
    if (f.rar !== undefined && f.rar !== '' && f.rar !== null) l = l.filter((x) => x.it.r === Number(f.rar));
    if (f.lvl) l = l.filter((x) => x.it.l <= p.api.P().lvl);
    if (q) l = l.filter((x) => x.it.n.toLowerCase().indexOf(q) >= 0);
    l.sort((a, b) => (f.sort === 'price' || f.sort === 'cheap' ? a.pr - b.pr : f.sort === 'lvl' ? b.it.l - a.it.l || b.it.r - a.it.r : b.t - a.t));
    const mine = data().list.filter((x) => x.s === p.ckey);
    world.send(p, { t: 'mk', list: l.slice(0, 80), total: l.length, mine, tax: TAX, gold: p.api.P().gold });
  }
  function buy(p, id) {
    const d = data(), i = d.list.findIndex((x) => x.id === id); if (i < 0) return sys(p, 'Ta oferta jest już nieaktualna.');
    const L = d.list[i], P = p.api.P();
    if (L.s === p.ckey) return sys(p, 'To twoja oferta.');
    if (P.gold < L.pr) return sys(p, 'Za mało złota.');
    if (world.gear.space(p) <= 0) return sys(p, 'Torba jest pełna!');
    d.list.splice(i, 1); save(d);
    P.gold -= L.pr; world.gear.give(p, [L.it]);
    sys(p, `Kupiono na rynku: ${L.it.n} za ${L.pr} zł.`);
    pay(L.s, p.nick, L.pr - Math.floor(L.pr * TAX), L.it.n);
    return true;
  }
  return {
    name: 'market', list, buy, data,
    onJoin(p) {
      const m = mail(); const e = m[p.ckey];
      if (e && e.gold) { p.api.P().gold += e.gold; p.srv.dirty = true; delete m[p.ckey]; store.set('mail', m); sys(p, `Rynek: podczas twojej nieobecności sprzedano przedmioty (${e.n}). Otrzymujesz ${e.gold} zł.`); }
    },
    onMsg(p, msg) {
      if (msg.t !== 'mk') return false;
      if (p.battle) return true;
      if (msg.a === 'sell') {
        const pr = Math.floor(Number(msg.pr));
        if (!(pr >= 1 && pr <= MAX_PRICE)) sys(p, 'Podaj cenę od 1 do 10 000 000 zł.');
        else if (typeof msg.u === 'string' && U_RE.test(msg.u) && world.gear.find(p, msg.u)) {
          const it = world.gear.take(p, msg.u);
          if (!list(p, it, pr)) world.gear.give(p, [it]); else sys(p, `Wystawiono na rynku: ${it.n} za ${pr} zł.`);
        }
      } else if (msg.a === 'cancel' && Number.isInteger(msg.id)) {
        const d = data(), i = d.list.findIndex((x) => x.id === msg.id && x.s === p.ckey);
        if (i >= 0) { if (world.gear.space(p) <= 0) sys(p, 'Torba jest pełna!'); else { const L = d.list.splice(i, 1)[0]; save(d); world.gear.give(p, [L.it]); sys(p, `Wycofano z rynku: ${L.it.n}.`); } }
      } else if (msg.a === 'buy' && Number.isInteger(msg.id)) buy(p, msg.id);
      browse(p, msg.f);
      return true;
    },
  };
}
module.exports = { createMarket, TAX };
