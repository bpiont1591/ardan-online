'use strict';
// Round 8: no healing in combat (only potions), no natural HP regen (slow free rest only in cities, full heal on respawn),
// potion shops at an alchemist in every city (purchase only next to the NPC – checked by the server), e-mail transports.
const path = require('path');
process.env.DATABASE_PATH = path.join('/tmp', `ardan-r8-${Date.now()}.db`);
process.env.ARDAN_TEST_HOOKS = '';
const db = require('../server/db');
const { World } = require('../server/game');
const mail = require('../server/mail');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? '  PASS ' : '  FAIL ') + m); };

const world = new World();
function mkPlayer(nick, cls) {
  const u = db.prepare('INSERT INTO users (login, email, pass, created) VALUES (?, ?, ?, ?)').run('u' + nick, nick + '@example.com', 'x', Date.now());
  const c = db.prepare("INSERT INTO characters (user_id, nick, cls, lvl, area, data, created, updated) VALUES (?, ?, ?, 1, 'village', NULL, ?, ?)").run(u.lastInsertRowid, nick, cls || 'war', Date.now(), Date.now());
  const msgs = [];
  const ws = { readyState: 1, send: (s) => msgs.push(JSON.parse(s)), close() {} };
  const p = world.join(ws, { id: u.lastInsertRowid }, c.lastInsertRowid);
  p.msgs = msgs;
  return p;
}
const place = (p, area, x, y) => { const P = p.api.P(); P.area = area; P.x = x; P.y = y; p.area = area; p.api.pl.fx = x; p.api.pl.fy = y; };
const freeNear = (p, area, x, y) => { for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) if (!p.api.solid(area, x + dx, y + dy)) return [x + dx, y + dy]; return [x, y]; };
const tick = (n) => { for (let i = 0; i < (n || 1); i++) world.tick(0.1); };
const send = (p, acts) => { p.msgT = 0; world.onMessage(p, JSON.stringify({ t: 'in', mx: 0, my: 0, acts })); tick(2); };

(async () => {
  const A = mkPlayer('Alchemista', 'war');
  tick(2);
  const api = A.api, P = api.P();
  const HEAL = ['pot', 'bigpot', 'elix', 'gpot', 'selix', 'spot', 'dpot'];

  console.log('Alchemicy i mikstury');
  const cities = Object.keys(api.city);
  for (const c of cities) {
    const alch = Object.keys(api.npcs).sort((x, y) => (/alch|zielar/.test(y) ? 1 : 0) - (/alch|zielar/.test(x) ? 1 : 0)).filter((k) => api.npcs[k].area === c && api.npcs[k].shop && (api.shops[api.npcs[k].shop] || []).filter((i) => HEAL.indexOf(i) >= 0).length >= 3);
    const tiers = alch.length ? api.shops[api.npcs[alch[0]].shop].filter((i) => HEAL.indexOf(i) >= 0) : [];
    ok(alch.length > 0, `${c}: alchemik ${alch[0] || '?'} sprzedaje ${tiers.length} rodzaje mikstur leczniczych (${tiers.join(', ')})`);
  }
  const priceOk = HEAL.every((id, i) => i === 0 || (api.items[id].price > api.items[HEAL[i - 1]].price && api.items[id].heal > api.items[HEAL[i - 1]].heal));
  ok(priceOk, 'silniejsze mikstury leczą więcej i kosztują więcej: ' + HEAL.map((id) => `${id} ${api.items[id].heal}pż/${api.items[id].price}zł`).join(', '));

  // open the alchemist's shop in Srebrnogród via the real dialog and buy next to her
  P.lvl = 20; P.gold = 1000;
  const npc = api.npcs.alchemik; const [nx, ny] = freeNear(A, npc.area, npc.x, npc.y); place(A, npc.area, nx, ny); tick(2);
  send(A, [{ a: 'npc', id: 'alchemik' }]);
  const dv = api.dlgView(); const si = dv ? dv.opts.indexOf('Pokaż towary') : -1;
  ok(si >= 0, 'rozmowa z alchemiczką oferuje „Pokaż towary”');
  send(A, [{ a: 'dlg', i: si }]);
  ok(A.msgs.some((m) => m.t === 'shop' && m.shop === 'alch'), 'serwer otwiera okno sklepu alchemiczki');
  const e0 = api.countItem('elix'), g0 = P.gold;
  send(A, [{ a: 'buy', id: 'elix' }]);
  ok(api.countItem('elix') === e0 + 1 && P.gold === g0 - api.items.elix.price, `zakup obok alchemiczki działa (eliksir −${api.items.elix.price} zł)`);
  const d0 = api.countItem('dpot'), g1 = P.gold;
  send(A, [{ a: 'buy', id: 'dpot' }]);
  ok(api.countItem('dpot') === d0 && P.gold === g1, 'nie da się kupić mikstury, której ten alchemik nie sprzedaje (fałszywe żądanie)');
  place(A, 'town', 20, 20); tick(2);
  const e1 = api.countItem('elix'), g2 = P.gold;
  send(A, [{ a: 'buy', id: 'elix' }]);
  ok(api.countItem('elix') === e1 && P.gold === g2, 'z daleka od alchemiczki zakup jest odrzucany przez serwer');
  place(A, 'swamp', 20, 20); tick(2);
  send(A, [{ a: 'buy', id: 'elix' }]);
  ok(api.countItem('elix') === e1 && P.gold === g2, 'w innej krainie zakup też jest odrzucany');

  console.log('Brak regeneracji życia');
  P.lvl = 30; P.hp = Math.round(api.maxHp() / 2); const hpOut = P.hp;
  place(A, 'forest', 5, 5); tick(60);
  ok(P.hp === hpOut, `poza miastem życie się nie odnawia (${hpOut} → ${Math.round(P.hp)} po 6 s)`);
  const cityArea = cities.find((c) => !api.pvpMap(c)) || 'village';
  place(A, 'village', 20, 18); tick(60);
  ok(P.hp > hpOut && P.hp < api.maxHp(), `w mieście powolny odpoczynek (${hpOut} → ${Math.round(P.hp)} po 6 s, ${cityArea})`);
  P.hp = 20; place(A, 'forest', 5, 5); api.die(); tick(60);
  ok(api.pl.dead <= 0 && P.hp === api.maxHp(), 'po śmierci odrodzenie z pełnym życiem');

  console.log('Brak leczenia w walce (tylko mikstury)');
  function fight(cls, skills, px) {
    const B = mkPlayer('Wojak' + cls + Math.floor(Math.random() * 1e6), cls); tick(2);
    const BP = B.api.P(); BP.lvl = 60; BP.hp = B.api.maxHp(); BP.mp = B.api.maxMp(); BP.inv = []; B.api.addItem('pot', 3);
    const area = 'mount'; const ml = world.mobs[area].filter((m) => !m.dead);
    const m = ml.sort((a, b) => b.d.hp - a.d.hp)[0];
    place(B, area, m.x, m.y + 1); tick(1);
    world.battle.startPve(B, m);
    const b = B.battle; if (!b) return { ok: false, why: 'brak walki' };
    const f = b.f.find((x) => x.kind === 'p');
    Object.assign(f.px = f.px || {}, px); f.mhp = Math.max(f.mhp, 6000); f.hp = Math.round(f.mhp * 0.5); f.mmp = 99999; f.mp = 99999;
    for (const e of b.f) if (e.kind !== 'p') { e.mhp = e.hp = 400000; }
    let prev = f.hp, pots = B.api.countItem('pot'), gains = [], potGains = 0, absorbSeen = 0, turn = 0;
    for (let i = 0; i < 400 && world.battle.battles.has(b.id || [...world.battle.battles.keys()][0]) && B.battle; i++) {
      b.deadline = 0; b.next = 0; f.auto = false;
      if (b.phase === 'choose' && !f.choice && f.alive) {
        turn++;
        f.choice = turn === 6 ? { a: 'pot' } : { a: 'sk', i: skills[turn % skills.length] };
      }
      world.battle.onTick();
      absorbSeen = Math.max(absorbSeen, f.absorb || 0);
      const nowPots = B.api.countItem('pot');
      if (f.hp > prev) { if (nowPots < pots) potGains++; else gains.push(`${prev}→${f.hp}`); }
      pots = nowPots; prev = f.hp;
      if (turn > 30) break;
    }
    if (B.battle) { B.ws.readyState = 3; world.leave(B); }
    return { ok: true, gains, potGains, absorbSeen, turn, mhp: f.mhp };
  }
  const w = fight('war', [2, 5, 0], { ls: 50, hregen: 10, soul: 30 });
  ok(w.ok && w.turn > 10, `walka wojownika trwała ${w.turn} tur`);
  ok(w.ok && w.gains.length === 0, `wojownik (Okrzyk, Gniew bogów, Rozdarcie, Runiczny pancerz) nie zyskuje życia bez mikstur ${w.gains.join(' ')}`);
  ok(w.ok && w.absorbSeen > 0 && w.absorbSeen <= w.mhp * 0.6 * 4 + 1, `zamiast leczenia – bariera (maks. ${Math.round(w.absorbSeen)} przy ${w.mhp} pż)`);
  ok(w.ok && w.potGains >= 1, 'mikstura w walce leczy (akcja tury)');
  const g = fight('mag', [2, 5, 1], { ls: 40, hregen: 8 });
  ok(g.ok && g.gains.length === 0, `mag (Lodowa bariera, Zatrzymanie czasu) nie zyskuje życia bez mikstur ${g.gains.join(' ')}`);

  console.log('Poczta (wybór transportu)');
  ok(mail.pickTransport({}) === null, 'bez zmiennych – brak poczty (tryb dev wypisuje link w konsoli)');
  ok(mail.pickTransport({ SMTP_HOST: 'smtp-relay.brevo.com' }) === 'smtp', 'SMTP_HOST → smtp');
  ok(mail.pickTransport({ BREVO_API_KEY: 'k', SMTP_HOST: 'h' }) === 'brevo', 'BREVO_API_KEY ma pierwszeństwo przed SMTP');
  ok(mail.pickTransport({ RESEND_API_KEY: 'k', BREVO_API_KEY: 'k' }) === 'resend', 'RESEND_API_KEY ma pierwszeństwo przed Brevo');
  ok(mail.pickTransport({ MAIL_TRANSPORT: 'smtp', RESEND_API_KEY: 'k', SMTP_HOST: 'h' }) === 'smtp', 'MAIL_TRANSPORT wymusza transport');
  ok(mail.pickTransport({ MAIL_TRANSPORT: 'brevo' }) === null, 'wymuszony transport bez klucza = brak poczty');
  const calls = [];
  const fakeFetch = async (url, o) => { calls.push({ url, o, body: JSON.parse(o.body) }); return { ok: true, status: 200, text: async () => '' }; };
  const mb = mail.createMailer({ env: { BREVO_API_KEY: 'xkeysib-test', MAIL_FROM: 'ARDAN <no-reply@ardan.pl>' }, fetch: fakeFetch });
  await mb.send({ to: 'gracz@example.com', subject: 'S', text: 'T', html: '<p>T</p>' });
  const cb = calls[0];
  ok(cb && cb.url === 'https://api.brevo.com/v3/smtp/email' && cb.o.headers['api-key'] === 'xkeysib-test' && cb.body.sender.email === 'no-reply@ardan.pl' && cb.body.sender.name === 'ARDAN' && cb.body.to[0].email === 'gracz@example.com' && cb.body.textContent === 'T', 'Brevo API: poprawny adres, nagłówek api-key i treść');
  const mr = mail.createMailer({ env: { RESEND_API_KEY: 're_test', MAIL_FROM: 'ARDAN <no-reply@ardan.pl>' }, fetch: fakeFetch });
  await mr.send({ to: 'gracz@example.com', subject: 'S', text: 'T' });
  const cr = calls[1];
  ok(cr && cr.url === 'https://api.resend.com/emails' && cr.o.headers.Authorization === 'Bearer re_test' && cr.body.from === 'ARDAN <no-reply@ardan.pl>' && cr.body.to[0] === 'gracz@example.com', 'Resend API: poprawny adres, Bearer i nadawca');
  const bad = mail.createMailer({ env: { RESEND_API_KEY: 'x' }, fetch: async () => ({ ok: false, status: 401, text: async () => 'unauthorized' }) });
  let err = null; try { await bad.send({ to: 'a@b.pl', subject: 's', text: 't' }); } catch (e) { err = e; }
  ok(err && /401/.test(err.message), 'błąd API (np. zły klucz) jest zgłaszany');
  const opts = [];
  const fakeNm = { createTransport: (o) => { opts.push(o); return { sendMail: async () => ({}) }; } };
  mail.createMailer({ env: { SMTP_HOST: 'smtp-relay.brevo.com', SMTP_PORT: '2525', SMTP_USER: 'u', SMTP_PASS: 'p' }, nodemailer: fakeNm });
  mail.createMailer({ env: { SMTP_HOST: 'smtp.example.com', SMTP_PORT: '465' }, nodemailer: fakeNm });
  ok(opts[0].port === 2525 && opts[0].secure === false && opts[0].auth.user === 'u' && opts[0].connectionTimeout > 0, 'SMTP Brevo na porcie 2525 (STARTTLS, z limitem czasu)');
  ok(opts[1].port === 465 && opts[1].secure === true, 'SMTP port 465 → TLS');
  ok(mail.parseFrom('no-reply@x.pl').email === 'no-reply@x.pl', 'MAIL_FROM bez nazwy też działa');

  console.log(`\nRunda 8: ${pass} OK, ${fail} błędów`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
