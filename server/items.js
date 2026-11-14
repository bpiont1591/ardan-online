'use strict';
// Equipment: slots, rarities, item generation and loot tables. Pure logic shared by the server and the demo.
const SLOTS = ['helm', 'amulet', 'weapon', 'armor', 'offhand', 'gloves', 'ring1', 'ring2', 'boots'];
const SLOT_N = { helm: 'Hełm', armor: 'Zbroja', gloves: 'Rękawice', boots: 'Buty', weapon: 'Broń', offhand: 'Druga ręka', ring: 'Pierścień', ring1: 'Pierścień', ring2: 'Pierścień', amulet: 'Amulet' };
const CLS_N = { war: 'Wojownik', arc: 'Łucznik', mag: 'Mag' };
const CLASSES = ['war', 'arc', 'mag'];
const RAR = [
  { k: 'zwykly', n: 'zwykły', col: '#d9d2c3', m: 1, extra: 0 },
  { k: 'unikat', n: 'unikatowy', col: '#f2d04b', m: 1.22, extra: 1 },
  { k: 'hero', n: 'heroiczny', col: '#59a8ff', m: 1.5, extra: 2 },
  { k: 'legenda', n: 'legendarny', col: '#ff8a3d', m: 1.9, extra: 3 },
];
const TIERS = [
  { l: 1, n: 'nowicjusza', col: '#9a6b3c' }, { l: 4, n: 'wędrowca', col: '#b9c2cb' }, { l: 8, n: 'Mgieł', col: '#9fb2e8' },
  { l: 12, n: 'Moczarów', col: '#8fbf6a' }, { l: 17, n: 'Szronu', col: '#9fe6ff' }, { l: 22, n: 'Króla Cieni', col: '#ffb347' },
];
const STAT_N = { atk: 'Atak', def: 'Obrona', hp: 'Życie', mp: 'Mana / energia', crit: 'Cios krytyczny %', dodge: 'Unik %' };
const ELITE = { troll: 1, yeti: 1, golem: 1, mummy: 1, skel: 1 };
// legacy sprite ids used to draw the character (weapon colour / armour colour)
const SPR = {
  war: { w: ['club', 'sword', 'axe', 'blade', 'fsword', 'ssword'], a: ['leather', 'leather', 'chain', 'plate', 'wplate', 'dplate'] },
  arc: { w: ['sbow', 'hbow', 'lbow', 'dbow', 'fbow', 'sunbow'], a: ['leather', 'leather', 'rjack', 'rcloak', 'rmail', 'rdrag'] },
  mag: { w: ['wand', 'ostaff', 'rstaff', 'dstaff', 'fstaff', 'sstaff'], a: ['robe', 'robe', 'mrobe', 'arobe', 'srobe', 'drobe'] },
};
// base: [slot, class, name, icon, stats(L)]
const BASES = {
  sword: ['weapon', 'war', 'Miecz', 'sword', (L) => ({ atk: 2 + 1.7 * L, crit: 2 })],
  axe: ['weapon', 'war', 'Topór', 'axe', (L) => ({ atk: 2 + 1.95 * L })],
  bow: ['weapon', 'arc', 'Łuk', 'bow', (L) => ({ atk: 2 + 1.75 * L, crit: 2 })],
  staff: ['weapon', 'mag', 'Kostur', 'staff', (L) => ({ atk: 3 + 1.8 * L, mp: 2 * L })],
  wand: ['weapon', 'mag', 'Różdżka', 'wand', (L) => ({ atk: 2 + 1.65 * L, crit: 3 })],
  shield: ['offhand', 'war', 'Tarcza', 'shield', (L) => ({ def: 1 + 0.6 * L, hp: 2 * L })],
  quiver: ['offhand', 'arc', 'Kołczan', 'quiver', (L) => ({ atk: 1 + 0.55 * L, crit: 2 })],
  orb: ['offhand', 'mag', 'Kula mocy', 'orb', (L) => ({ atk: 1 + 0.5 * L, mp: 3 * L })],
  plate: ['armor', 'war', 'Zbroja', 'plate', (L) => ({ def: 2 + 1.05 * L, hp: 2 * L })],
  jerkin: ['armor', 'arc', 'Kurta', 'leather', (L) => ({ def: 1 + 0.8 * L, hp: 1.5 * L, dodge: 2 })],
  robe: ['armor', 'mag', 'Szata', 'robe', (L) => ({ def: 1 + 0.6 * L, mp: 3.5 * L, hp: L })],
  helm: ['helm', 'war', 'Hełm', 'helm', (L) => ({ def: 1 + 0.45 * L, hp: 1.5 * L })],
  hood: ['helm', 'arc', 'Kaptur', 'hood', (L) => ({ def: 1 + 0.35 * L, crit: 1 })],
  hat: ['helm', 'mag', 'Kapelusz', 'hat', (L) => ({ def: 1 + 0.3 * L, mp: 2 * L })],
  gaunt: ['gloves', 'war', 'Rękawice', 'gauntlet', (L) => ({ atk: 1 + 0.35 * L, def: 0.2 * L })],
  bracer: ['gloves', 'arc', 'Karwasze', 'bracer', (L) => ({ atk: 1 + 0.4 * L, crit: 1 })],
  glove: ['gloves', 'mag', 'Rękawiczki', 'glove', (L) => ({ atk: 1 + 0.45 * L, mp: L })],
  greave: ['boots', 'war', 'Nagolenniki', 'boots', (L) => ({ def: 1 + 0.35 * L, hp: L })],
  sboot: ['boots', 'arc', 'Buty', 'boots', (L) => ({ def: 1 + 0.3 * L, dodge: 3 })],
  slip: ['boots', 'mag', 'Trzewiki', 'boots', (L) => ({ def: 1 + 0.25 * L, mp: L, dodge: 1 })],
  ring: ['ring', null, 'Pierścień', 'ring', (L, R) => { const v = R(); return v < 0.34 ? { atk: 1 + 0.45 * L } : v < 0.67 ? { crit: 2 + L / 6 } : { hp: 2.5 * L }; }],
  amulet: ['amulet', null, 'Amulet', 'amulet', (L) => ({ hp: 2 * L, mp: 1.5 * L })],
};
const BY_SLOT = {};
for (const k of Object.keys(BASES)) { const b = BASES[k]; (BY_SLOT[b[0]] = BY_SLOT[b[0]] || []).push(k); }
const SLOT_W = [['weapon', 16], ['armor', 14], ['helm', 12], ['gloves', 11], ['boots', 11], ['offhand', 10], ['ring', 12], ['amulet', 8]];
const uid = () => Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 9);
const value = (it) => Math.round((5 + it.l * it.l * 0.9) * (1 + it.r * 1.2));

function make(base, tier, r, R) {
  R = R || Math.random;
  const b = BASES[base], T = TIERS[tier], L = T.l, rar = RAR[r];
  const raw = b[4](L, R), st = {};
  for (const k of Object.keys(raw)) {
    const flat = k === 'crit' || k === 'dodge';
    st[k] = Math.max(1, Math.round(raw[k] * (flat ? 1 : rar.m) * (0.9 + R() * 0.2)));
  }
  const pool = ['atk', 'def', 'hp', 'mp', 'crit', 'dodge'];
  for (let i = 0; i < rar.extra; i++) {
    const k = pool[Math.floor(R() * pool.length)];
    const add = k === 'crit' || k === 'dodge' ? 1 + Math.floor(R() * 3) : k === 'hp' ? Math.round(3 + L * 1.5) : k === 'mp' ? Math.round(3 + L) : Math.round(1 + L * 0.3);
    st[k] = (st[k] || 0) + Math.max(1, Math.round(add * (0.8 + R() * 0.4)));
  }
  const cls = b[1];
  const it = { u: uid(), b: base, n: b[2] + ' ' + T.n, s: b[0], c: cls, l: L, r, t: tier, ic: b[3], st };
  if (b[0] === 'weapon') it.spr = SPR[cls].w[tier];
  if (b[0] === 'armor') it.spr = SPR[cls].a[tier];
  it.v = value(it);
  return it;
}
function tierFor(lvl, R) { let t = 0; for (let i = 0; i < TIERS.length; i++) if (TIERS[i].l <= lvl) t = i; if (t > 0 && R() < 0.25) t--; return t; }
function rollRar(rank, lvl, R) {
  // 0 normal monster, 1 elite, 2 world boss, 3 dungeon elite, 4 dungeon boss
  const W = rank === 4 ? [0, 30, 50, 20] : rank === 3 ? [18, 52, 25, 5] : rank === 2 ? [0, 50, 38, 12] : rank === 1 ? [55, 33, 10, 2] : [90, 9.5, 0.5, 0];
  const shift = Math.min(rank === 0 ? 6 : 12, lvl * 0.4); W[0] = Math.max(0, W[0] - shift); W[1] += shift;
  let v = R() * W.reduce((a, b) => a + b, 0);
  for (let i = 0; i < 4; i++) { v -= W[i]; if (v < 0) return i; }
  return 0;
}
function pickBase(cls, R) {
  let v = R() * SLOT_W.reduce((a, b) => a + b[1], 0), slot = 'weapon';
  for (const s of SLOT_W) { v -= s[1]; if (v < 0) { slot = s[0]; break; } }
  const c = R() < 0.55 && cls ? cls : CLASSES[Math.floor(R() * 3)];
  const opts = BY_SLOT[slot].filter((k) => BASES[k][1] === null || BASES[k][1] === c);
  return opts[Math.floor(R() * opts.length)];
}
const rankOf = (mk, d) => (d.boss ? 2 : ELITE[mk] ? 1 : 0);
// loot after a won fight: weaker monsters rarely drop, elites usually, bosses always (2-3 items)
function rollDrops(mk, d, cls, R) {
  R = R || Math.random;
  const rank = rankOf(mk, d);
  const n = rank === 2 ? 2 + (R() < 0.5 ? 1 : 0) : rank === 1 ? (R() < 0.85 ? 1 : 0) + (R() < 0.2 ? 1 : 0) : (R() < 0.08 + d.lvl * 0.008 ? 1 : 0);
  const out = [];
  for (let i = 0; i < n; i++) out.push(make(pickBase(cls, R), tierFor(d.lvl, R), rollRar(rank, d.lvl, R), R));
  return out;
}
// dungeon loot: rank 3 (elite) or 4 (boss); bosses always drop 2-3 items, elites often one, plus materials
function rollDungeon(lvl, rank, cls, R) {
  R = R || Math.random;
  const n = rank === 4 ? 2 + (R() < 0.5 ? 1 : 0) : (R() < 0.6 ? 1 : 0);
  const out = [];
  for (let i = 0; i < n; i++) { const t = tierFor(lvl, () => 1); out.push(make(pickBase(cls, R), t, rollRar(rank, lvl, R), R)); }
  if (rank === 4) out.push(mat('crystal', 1 + (R() < 0.4 ? 1 : 0)));
  else if (R() < 0.35) out.push(mat(['ore', 'herb', 'wood'][Math.floor(R() * 3)], 1 + Math.floor(R() * 3)));
  return out;
}
// ---------- crafting materials (stackable bag items, tradeable on the market) ----------
const MATS = {
  herb: { n: 'Ziele lecznicze', ic: 'herb', v: 3, r: 0 },
  ore: { n: 'Ruda żelaza', ic: 'ore', v: 4, r: 0 },
  wood: { n: 'Drewno dębowe', ic: 'wood', v: 3, r: 0 },
  crystal: { n: 'Kryształ mgły', ic: 'crystal', v: 30, r: 2 },
};
const MAX_STACK = 999;
function mat(k, q) { const M = MATS[k]; q = Math.max(1, Math.min(MAX_STACK, q | 0)); return { u: uid(), b: 'mat_' + k, m: k, n: M.n, s: 'mat', c: null, l: 1, r: M.r, t: 0, ic: M.ic, st: {}, q, v: M.v * q }; }
// ---------- item upgrade +1..+5 ----------
const UP_MAX = 5;
const UP_CHANCE = [1, 0.9, 0.75, 0.55, 0.35];   // chance for +1 .. +5
function upCost(it) { const n = it.up || 0, L = it.l || 1; return { ore: 2 + n * 2 + Math.floor(L / 6), crystal: n >= 2 ? n - 1 : 0, gold: Math.round(10 + L * 3 * (n + 1) + it.r * 15 * (n + 1)) }; }
function applyUp(it, n) {
  if (!it.st0) it.st0 = Object.assign({}, it.st);
  it.up = n; const st = {};
  for (const k of Object.keys(it.st0)) { const flat = k === 'crit' || k === 'dodge'; st[k] = flat ? it.st0[k] + Math.floor(n / 2) : Math.round(it.st0[k] * (1 + 0.1 * n) + n * 0.5); }
  it.st = st;
  it.n = it.n.replace(/ \+\d$/, '') + (n ? ' +' + n : '');
  it.v = Math.round(value(it) * (1 + 0.25 * n));
  return it;
}
// smithing: a new item of a chosen slot for the crafter's class, tier from level, rarity better than common drops
function forge(slot, cls, lvl, R) {
  R = R || Math.random;
  const opts = (BY_SLOT[slot] || []).filter((k) => BASES[k][1] === null || BASES[k][1] === cls);
  if (!opts.length) return null;
  return make(opts[Math.floor(R() * opts.length)], tierFor(lvl, () => 1), rollRar(1, lvl, R), R);
}
function forgeCost(slot, lvl) { const t = tierFor(lvl, () => 1); return { ore: 2 + t * 2, wood: 1 + t, herb: slot === 'amulet' || slot === 'ring' ? 2 + t : 0, gold: 10 + t * t * 18 + t * 10 }; }
function randomItem(lvl, rank, R) { R = R || Math.random; return make(pickBase(null, R), tierFor(lvl, R), rollRar(rank, lvl, R), R); }
// convert an old shop/quest weapon or armour (engine ITEMS) into a slot item
function fromLegacy(id, def, cls) {
  if (!def || (def.t !== 'w' && def.t !== 'a')) return null;
  const c = def.cls ? (def.cls.split(' ').indexOf(cls) >= 0 ? cls : def.cls.split(' ')[0]) : null;
  let tier = 0;
  if (def.t === 'w') { for (const k of CLASSES) { const i = SPR[k].w.indexOf(id); if (i >= 0) tier = i; } }
  else { tier = Math.max(0, [6, 50, 150, 380, 800, 1600].findIndex((p) => def.price <= p)); }
  const st = def.t === 'w' ? { atk: def.atk } : { def: def.def, hp: def.def * 2 };
  if (def.mp) st.mp = def.mp;
  const it = { u: uid(), b: def.t === 'w' ? (c === 'arc' ? 'bow' : c === 'mag' ? 'staff' : 'sword') : (c === 'mag' ? 'robe' : c === 'arc' ? 'jerkin' : 'plate'),
    n: def.n, s: def.t === 'w' ? 'weapon' : 'armor', c: def.t === 'a' && !def.cls ? null : c, l: tier === 0 ? 1 : TIERS[tier].l, r: 0, t: tier, ic: def.ic === 'staff' ? 'staff' : def.ic === 'bow' ? 'bow' : def.ic === 'axe' ? 'axe' : def.ic === 'club' ? 'club' : def.ic === 'robe' ? 'robe' : def.ic === 'shirt' ? 'shirt' : def.t === 'w' ? 'sword' : 'plate', st, spr: id, legacy: 1 };
  it.v = value(it);
  return it;
}
function canEquip(it, P) {
  if (!it || !it.s || it.s === 'mat') return 'To nie jest przedmiot do założenia.';
  if (it.c && it.c !== P.cls) return 'Ten przedmiot jest dla klasy: ' + CLS_N[it.c] + '.';
  if (it.l > P.lvl) return 'Wymagany poziom: ' + it.l + '.';
  return null;
}
const validItem = (it) => !!(it && typeof it === 'object' && typeof it.u === 'string' && it.st && typeof it.n === 'string' && typeof it.s === 'string');
module.exports = { SLOTS, SLOT_N, CLS_N, CLASSES, RAR, TIERS, STAT_N, BASES, SPR, ELITE, MATS, MAX_STACK, UP_MAX, UP_CHANCE, make, rollDrops, rollDungeon, randomItem, fromLegacy, canEquip, value, rankOf, validItem, mat, upCost, applyUp, forge, forgeCost, tierFor };
