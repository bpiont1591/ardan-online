'use strict';
// Direct trade window between two players: both add items and gold, both accept, then the exchange happens atomically.
const MAX_ITEMS = 6;
const U_RE = /^[a-z0-9]{6,24}$/;

function createTrade(world) {
  const sys = (p, t) => world.chat.sys(p, t);
  const peer = (p) => (p.trade ? world.players.get(p.trade.peer) : null);
  function state(p) {
    const q = peer(p); if (!p.trade || !q) return world.send(p, { t: 'tr', open: false });
    const side = (x) => ({ items: x.trade.items.map((u) => world.gear.find(x, u)).filter(Boolean), gold: x.trade.gold, ok: x.trade.ok });
    world.send(p, { t: 'tr', open: true, me: side(p), them: Object.assign({ n: q.nick }, side(q)) });
  }
  function close(p, why) {
    const q = peer(p);
    for (const x of [p, q]) if (x && x.trade) { x.trade = null; if (why) sys(x, why); state(x); }
  }
  function request(p, q) {
    if (!q || q === p) return;
    if (p.battle || q.battle) return sys(p, 'Nie można handlować podczas walki.');
    if (p.trade || q.trade) return sys(p, `${q.nick} już z kimś handluje.`);
    if (p.api.P().area !== q.api.P().area) return sys(p, 'Musicie być w tej samej krainie.');
    q.tradeInv = { from: p.pid, exp: Date.now() + 60e3 };
    sys(p, `Wysłano propozycję wymiany do ${q.nick}.`);
    if (q.bot && q.bot.onTrade) return q.bot.onTrade(p);
    world.send(q, { t: 'tr', inv: p.nick }); sys(q, `${p.nick} proponuje wymianę. Otwórz okno handlu, by przyjąć.`);
  }
  function accept(q) {
    const iv = q.tradeInv; q.tradeInv = null;
    const p = iv && iv.exp > Date.now() ? world.players.get(iv.from) : null;
    if (!p) return sys(q, 'Propozycja wymiany wygasła.');
    if (p.trade || q.trade || p.battle || q.battle) return sys(q, 'Nie można teraz rozpocząć wymiany.');
    p.trade = { peer: q.pid, items: [], gold: 0, ok: false }; q.trade = { peer: p.pid, items: [], gold: 0, ok: false };
    state(p); state(q);
  }
  function reset(p) { const q = peer(p); p.trade.ok = false; if (q && q.trade) q.trade.ok = false; }
  function execute(p, q) {
    const A = p.api.P(), B = q.api.P();
    const ia = p.trade.items.map((u) => world.gear.find(p, u)), ib = q.trade.items.map((u) => world.gear.find(q, u));
    if (ia.some((x) => !x) || ib.some((x) => !x) || A.gold < p.trade.gold || B.gold < q.trade.gold) return close(p, 'Wymiana przerwana – oferta się zmieniła.');
    if (ib.length - ia.length > world.gear.space(p) || ia.length - ib.length > world.gear.space(q)) return close(p, 'Wymiana przerwana – brak miejsca w torbie.');
    const ga = p.trade.gold, gb = q.trade.gold;
    if (!(ga >= 0 && gb >= 0)) return close(p, 'Wymiana przerwana.');
    world.atomic([p, q], () => {
      for (const it of ia) world.gear.take(p, it.u); for (const it of ib) world.gear.take(q, it.u);
      world.gear.give(p, ib); world.gear.give(q, ia);
      A.gold += gb - ga; B.gold += ga - gb; p.srv.dirty = q.srv.dirty = true;
    });
    close(p, `Wymiana zakończona: ${q.nick} ⇄ ${p.nick}.`);
  }
  return {
    name: 'trade', request,
    onLeave(p) { if (p.trade) close(p, 'Wymiana przerwana – gracz wyszedł z gry.'); },
    onTick() { for (const p of world.players.values()) if (p.trade && (p.battle || !peer(p) || peer(p).api.P().area !== p.api.P().area)) close(p, 'Wymiana przerwana.'); },
    onMsg(p, msg) {
      if (msg.t !== 'tr') return false;
      if (msg.a === 'req' && typeof msg.id === 'string') request(p, world.players.get(msg.id));
      else if (msg.a === 'accept') accept(p);
      else if (msg.a === 'decline') { const iv = p.tradeInv; p.tradeInv = null; const q = iv && world.players.get(iv.from); if (q) sys(q, `${p.nick} odrzuca wymianę.`); }
      else if (!p.trade) state(p);
      else if (msg.a === 'add' && typeof msg.u === 'string' && U_RE.test(msg.u) && world.gear.find(p, msg.u) && p.trade.items.indexOf(msg.u) < 0 && p.trade.items.length < MAX_ITEMS) { p.trade.items.push(msg.u); reset(p); }
      else if (msg.a === 'rem' && typeof msg.u === 'string') { p.trade.items = p.trade.items.filter((u) => u !== msg.u); reset(p); }
      else if (msg.a === 'gold') { const g = Math.floor(Number(msg.v)); if (Number.isSafeInteger(g) && g >= 0 && g <= p.api.P().gold) { p.trade.gold = g; reset(p); } else sys(p, 'Nie masz tyle złota.'); }
      else if (msg.a === 'ok') { p.trade.ok = true; const q = peer(p); if (q && q.trade && q.trade.ok) { execute(p, q); return true; } }
      else if (msg.a === 'cancel') { close(p, 'Wymiana anulowana.'); return true; }
      if (p.trade) { state(p); const q = peer(p); if (q) state(q); }
      return true;
    },
  };
}
module.exports = { createTrade };
