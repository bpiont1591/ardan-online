# Round 6: level cap 80, ten new areas (9 hunting lands + 1 city), 9 bosses, 34 quests,
# merchant / auction NPCs (trading only at NPCs), dynamic world map grid.
import json
s = open('engine.ts').read()
def ed(a, b, cnt=1):
    global s
    n = s.count(a)
    assert n == cnt, (a[:90], n)
    s = s.replace(a, b)
J = lambda v: json.dumps(v, ensure_ascii=False)

def xp_next(l):
    return int(40 * l ** 1.65 * (1 + min(0.35, max(0, l - 4) * 0.025)) * (1 + (l - 30) * 0.05 if l > 30 else 1))

# ---------------------------------------------------------------- areas
WILD = r'''
  // round 6: data-driven hunting land: scattered obstacles, clearings (nodes) joined by paths, edge exits
  function genWild(o: any): Area {
    const a = mkArea(o.id, o.name, o.w, o.h, o.base, !!o.dark, o.base);
    const r = mkRng(o.seed);
    for (const b of o.blobs || []) for (let i = 0; i < b[1]; i++) disc(3 + r() * (a.w - 6), 3 + r() * (a.h - 6), b[2] + r() * b[3], (x: number, y: number) => st(a, x, y, b[0]));
    for (let i = 0; i < a.t.length; i++) { if (a.t[i] !== o.base) continue; let q = r(); for (const s0 of o.scat) { if (q < s0[1]) { a.t[i] = s0[0]; break; } q -= s0[1]; } }
    borderFill(a, r, o.border, 0.6);
    const inner = (x: number, y: number): boolean => x > 0 && y > 0 && x < a.w - 1 && y < a.h - 1;
    const clrN = (x: number, y: number): void => { if (inner(x, y) && BLOCK[gt(a, x, y)]) st(a, x, y, o.base); };
    const clrL = (x: number, y: number): void => { if (!inner(x, y)) return; const t = gt(a, x, y); if (BLOCK[t] && t !== WATER && t !== BOG) st(a, x, y, o.base); };
    for (const c of o.nodes) disc(c[0], c[1], c[2], clrN);
    for (const s0 of o.segs) line4(s0[0], s0[1], s0[2], s0[3], (x: number, y: number) => { disc(x, y, 1.2, clrL); const t = gt(a, x, y); st(a, x, y, t === WATER || t === BOG ? BRIDGE : PATH); });
    for (const e of o.edges) for (let c = e[1]; c <= e[2]; c++) {
      for (let d = 0; d <= 1; d++) { const x = e[0] === "w" ? d : e[0] === "e" ? a.w - 1 - d : c, y = e[0] === "n" ? d : e[0] === "s" ? a.h - 1 - d : c; st(a, x, y, PATH); }
      const ex = e[0] === "w" ? 0 : e[0] === "e" ? a.w - 1 : c, ey = e[0] === "n" ? 0 : e[0] === "s" ? a.h - 1 : c;
      a.exits.push(e[0] === "w" || e[0] === "e" ? { x: ex, y: ey, to: e[3], tx: e[4], ty: c + e[5] } : { x: ex, y: ey, to: e[3], tx: c + e[5], ty: e[4] });
    }
    for (const p of o.free || []) disc(p[0], p[1], 1.5, (x: number, y: number) => { if (inner(x, y) && BLOCK[gt(a, x, y)]) st(a, x, y, o.base); });
    const e0 = a.exits[0];
    spawnIn(a, r, e0.x, e0.y, o.spawns, o.avoid);
    a.spawns.push([o.boss[0], o.boss[1], o.boss[2]]);
    return a;
  }
  // carve a corridor from the map edge inwards until it meets the walkable part of an existing area
  function openEdge(a: Area, side: string, c0: number, c1: number, tile: number, to: string, fixed: number, off: number): void {
    const e0 = a.exits[0]; const seen = reach(a, e0.x, e0.y);
    for (let c = c0; c <= c1; c++) {
      for (let d = 0; d < Math.max(a.w, a.h); d++) {
        const x = side === "w" ? d : side === "e" ? a.w - 1 - d : c, y = side === "n" ? d : side === "s" ? a.h - 1 - d : c;
        if (d > 1 && seen[y * a.w + x]) break;
        st(a, x, y, tile);
      }
      const ex = side === "w" ? 0 : side === "e" ? a.w - 1 : c, ey = side === "n" ? 0 : side === "s" ? a.h - 1 : c;
      a.exits.push(side === "w" || side === "e" ? { x: ex, y: ey, to, tx: fixed, ty: c + off } : { x: ex, y: ey, to, tx: c + off, ty: fixed });
    }
  }
  function genStar(): Area {
    const a = genCity("star", "Gwiezdna Strażnica", 461, COBBLE, ROOF2, ROOF, "wse");
    for (const p of [[13, 9], [22, 9], [13, 18], [22, 18]]) st(a, p[0], p[1], PILLAR);
    for (let y = 13; y <= 14; y++) { a.exits.push({ x: 0, y, to: "citadel", tx: 34, ty: y }); a.exits.push({ x: 35, y, to: "crystal", tx: 1, ty: y + 6 }); }
    for (let x = 17; x <= 18; x++) a.exits.push({ x, y: 27, to: "necro", tx: x + 7, ty: 1 });
    return a;
  }
'''
T = lambda name: name  # tile constants are emitted verbatim

def fn(expr):  # spawn predicate
    return '(x: number, y: number): boolean => ' + expr

LANDS = [
  dict(id='wolfhills', name='Wilcze Wzgórza', w=50, h=40, base='GRASS', seed=501, dark=False,
       blobs=[['WATER', 3, 1.4, 1.4]], scat=[['TREE', 0.15], ['DGRASS', 0.1], ['ROCK', 0.03], ['FLOWER', 0.05]], border=['TREE', 'TREE', 'ROCK'],
       nodes=[[25, 4, 3.4], [14, 12, 4], [36, 12, 4], [24, 22, 4], [12, 30, 4], [38, 31, 4.5], [25, 34, 3.5]],
       segs=[[24, 0, 25, 4], [25, 4, 14, 12], [25, 4, 36, 12], [14, 12, 24, 22], [36, 12, 24, 22], [24, 22, 12, 30], [24, 22, 38, 31], [12, 30, 25, 34], [25, 34, 38, 31]],
       edges=[['n', 24, 25, 'village', 28, -5]],
       spawns=[['bandit', 9, 'y > 8'], ['bwolf', 8, 'true'], ['bear', 5, 'y > 18']], avoid=[[25, 4, 6], [38, 31, 4]], boss=['kiel', 38, 31],
       free=[[27, 4], [22, 3], [23, 6]]),
  dict(id='mine', name='Kopalnia Krasnoludów', w=44, h=34, base='FLOOR', seed=511, dark=True,
       blobs=[['WATER', 2, 1.2, 1]], scat=[['CWALL', 0.15], ['ROCK', 0.05], ['CRYSTAL', 0.015]], border=['CWALL', 'CWALL', 'ROCK'],
       nodes=[[38, 21, 3.6], [28, 14, 4], [30, 27, 4], [16, 8, 4], [16, 22, 4.5], [8, 27, 4.5], [6, 12, 3]],
       segs=[[43, 21, 38, 21], [38, 21, 28, 14], [38, 21, 30, 27], [28, 14, 16, 8], [28, 14, 16, 22], [30, 27, 16, 22], [16, 22, 8, 27], [16, 8, 6, 12]],
       edges=[['e', 20, 22, 'cave', 1, 1]],
       spawns=[['kobold', 9, 'true'], ['crawler', 7, 'true'], ['dghost', 5, 'x < 24']], avoid=[[38, 21, 5], [8, 27, 4]], boss=['grimgor', 8, 27],
       free=[[38, 19], [37, 23]]),
  dict(id='glacier', name='Lodowiec Wichrów', w=50, h=40, base='SNOW', seed=521, dark=False,
       blobs=[['ICE', 6, 2, 2.5]], scat=[['SPINE', 0.2], ['CLIFF', 0.06], ['ROCK', 0.03]], border=['CLIFF', 'SPINE', 'CLIFF'],
       nodes=[[25, 34, 3.6], [14, 26, 4], [36, 26, 4], [24, 17, 4.5], [10, 10, 4], [38, 9, 5], [24, 6, 3.5]],
       segs=[[25, 39, 25, 34], [25, 34, 14, 26], [25, 34, 36, 26], [14, 26, 24, 17], [36, 26, 24, 17], [24, 17, 10, 10], [24, 17, 24, 6], [24, 6, 38, 9], [36, 26, 38, 9]],
       edges=[['s', 24, 26, 'mount', 1, 17]],
       spawns=[['frwraith', 9, 'true'], ['icetroll', 7, 'y < 30'], ['mammoth', 5, 'y < 22']], avoid=[[25, 34, 6], [38, 9, 5]], boss=['szronia', 38, 8],
       free=[[27, 34], [22, 33], [23, 36]]),
  dict(id='steppe', name='Spalone Stepy', w=50, h=40, base='SAND', seed=531, dark=False,
       blobs=[['ASH', 8, 2, 3]], scat=[['DUNE', 0.08], ['ROCK', 0.04], ['CACTUS', 0.03], ['DEADT', 0.03]], border=['CLIFF', 'ROCK', 'CLIFF'],
       nodes=[[24, 34, 3.6], [12, 27, 4], [37, 27, 4], [24, 19, 4.5], [10, 11, 4], [39, 10, 4.5], [24, 5, 3]],
       segs=[[24, 39, 24, 34], [24, 34, 12, 27], [24, 34, 37, 27], [12, 27, 24, 19], [37, 27, 24, 19], [24, 19, 10, 11], [24, 19, 39, 10], [24, 19, 24, 5], [24, 5, 24, 0], [25, 5, 25, 0]],
       edges=[['s', 23, 25, 'desert', 1, 0], ['n', 24, 25, 'elfwood', 38, 0]],
       spawns=[['hyena', 9, 'true'], ['nomad', 7, 'true'], ['basil', 5, 'y < 24']], avoid=[[24, 34, 6], [39, 10, 4]], boss=['burzan', 40, 9],
       free=[[26, 34], [21, 33], [22, 36]]),
  dict(id='elfwood', name='Szmaragdowa Puszcza', w=50, h=40, base='DGRASS', seed=541, dark=False,
       blobs=[['WATER', 4, 1.5, 2]], scat=[['TREE', 0.24], ['FLOWER', 0.05], ['ROCK', 0.02]], border=['TREE', 'TREE', 'TREE'],
       nodes=[[25, 34, 3.6], [13, 27, 4], [37, 26, 4], [25, 18, 4.5], [11, 8, 5], [38, 10, 4], [25, 7, 3.5]],
       segs=[[24, 39, 25, 34], [25, 39, 25, 34], [25, 34, 13, 27], [25, 34, 37, 26], [13, 27, 25, 18], [37, 26, 25, 18], [25, 18, 25, 7], [25, 7, 11, 8], [25, 7, 38, 10], [37, 26, 38, 10]],
       edges=[['s', 24, 25, 'steppe', 1, 0]],
       spawns=[['delf', 9, 'true'], ['wwolf', 7, 'y < 30'], ['treant', 5, 'y < 24']], avoid=[[25, 34, 6], [11, 8, 5]], boss=['morana', 11, 7],
       free=[[27, 34], [22, 33], [23, 36]]),
  dict(id='sunken', name='Zatopione Miasto', w=50, h=40, base='RFLOOR', seed=551, dark=True,
       blobs=[['WATER', 14, 1.5, 2.5]], scat=[['RUINW', 0.06], ['PILLAR', 0.03], ['REED', 0.03]], border=['WATER', 'RUINW', 'WATER'],
       nodes=[[25, 5, 3.6], [13, 12, 4], [37, 12, 4], [25, 21, 4.5], [12, 30, 4], [38, 30, 4], [25, 33, 5]],
       segs=[[24, 0, 24, 5], [25, 0, 25, 5], [25, 5, 13, 12], [25, 5, 37, 12], [13, 12, 25, 21], [37, 12, 25, 21], [25, 21, 12, 30], [25, 21, 38, 30], [12, 30, 25, 33], [38, 30, 25, 33]],
       edges=[['n', 24, 25, 'coast', 38, 0]],
       spawns=[['naga', 9, 'true'], ['drowned', 7, 'true'], ['tentacle', 5, 'y > 16']], avoid=[[25, 5, 6], [25, 33, 5]], boss=['thalassor', 25, 34],
       free=[[27, 5], [22, 4]]),
  dict(id='crystal', name='Kryształowe Pustkowia', w=50, h=40, base='SNOW', seed=561, dark=False,
       blobs=[['ICE', 8, 2, 3]], scat=[['CRYSTAL', 0.12], ['ROCK', 0.05], ['CLIFF', 0.05]], border=['CRYSTAL', 'CLIFF', 'CRYSTAL'],
       nodes=[[5, 19.5, 3], [15, 12, 4], [15, 28, 4], [27, 20, 4.5], [37, 10, 4.5], [37, 30, 4], [44, 20, 5]],
       segs=[[0, 19, 5, 19], [0, 20, 5, 20], [5, 19, 15, 12], [5, 19, 15, 28], [15, 12, 27, 20], [15, 28, 27, 20], [27, 20, 37, 10], [27, 20, 37, 30], [37, 10, 44, 20], [37, 30, 44, 20]],
       edges=[['w', 19, 20, 'star', 34, -6]],
       spawns=[['cspider', 9, 'true'], ['starw', 7, 'true'], ['cgolem', 5, 'x > 20']], avoid=[[5, 19, 6], [44, 20, 5]], boss=['kolos', 44, 20], free=[]),
  dict(id='necro', name='Nekropolia Valgaru', w=50, h=40, base='FLOOR', seed=571, dark=True,
       blobs=[['BOG', 5, 1.5, 2]], scat=[['RUINW', 0.06], ['DEADT', 0.05], ['PILLAR', 0.02], ['CWALL', 0.06]], border=['CWALL', 'RUINW', 'CWALL'],
       nodes=[[24.5, 5, 3.5], [12, 12, 4], [37, 12, 4], [24, 21, 5], [10, 30, 4.5], [37, 30, 4], [44, 20, 3.5]],
       segs=[[24, 0, 24, 5], [25, 0, 25, 5], [24, 5, 12, 12], [24, 5, 37, 12], [12, 12, 24, 21], [37, 12, 24, 21], [24, 21, 10, 30], [24, 21, 37, 30], [37, 30, 44, 20], [37, 12, 44, 20], [44, 20, 49, 19], [44, 20, 49, 20]],
       edges=[['n', 24, 25, 'star', 26, -7], ['e', 19, 20, 'dragon', 1, 0]],
       spawns=[['bmage', 9, 'true'], ['specter', 7, 'true'], ['bdrake', 5, 'y > 14']], avoid=[[24, 5, 6], [10, 30, 5]], boss=['valgar', 10, 31], free=[]),
  dict(id='dragon', name='Smocze Gniazdo', w=50, h=40, base='ASH', seed=581, dark=False,
       blobs=[['LAVA', 14, 1.2, 2.4]], scat=[['ROCK', 0.05], ['CLIFF', 0.07], ['DEADT', 0.02]], border=['CLIFF', 'CLIFF', 'ROCK'],
       nodes=[[5, 19.5, 3], [15, 10, 4], [16, 30, 4], [27, 20, 4.5], [37, 30, 4], [36, 9, 4], [43, 18, 5.5]],
       segs=[[0, 19, 5, 19], [0, 20, 5, 20], [5, 19, 15, 10], [5, 19, 16, 30], [15, 10, 27, 20], [16, 30, 27, 20], [27, 20, 36, 9], [27, 20, 37, 30], [36, 9, 43, 18], [37, 30, 43, 18]],
       edges=[['w', 19, 20, 'necro', 48, 0]],
       spawns=[['drakon', 9, 'true'], ['dkin', 7, 'true'], ['wyrm', 5, 'x > 20']], avoid=[[5, 19, 6], [43, 18, 6]], boss=['valdrak', 44, 18], free=[]),
]
def land_ts(L):
    o = ['id: ' + J(L['id']), 'name: ' + J(L['name']), 'w: %d' % L['w'], 'h: %d' % L['h'], 'base: ' + L['base'], 'seed: %d' % L['seed'], 'dark: ' + ('true' if L['dark'] else 'false')]
    o.append('blobs: [' + ', '.join('[%s, %s, %s, %s]' % (b[0], b[1], b[2], b[3]) for b in L['blobs']) + ']')
    o.append('scat: [' + ', '.join('[%s, %s]' % (x[0], x[1]) for x in L['scat']) + ']')
    o.append('border: [' + ', '.join(L['border']) + ']')
    o.append('nodes: ' + J(L['nodes']))
    o.append('segs: ' + J(L['segs']))
    o.append('edges: ' + J(L['edges']))
    o.append('spawns: [' + ', '.join('[%s, %d, %s]' % (J(sp[0]), sp[1], fn(sp[2])) for sp in L['spawns']) + ']')
    o.append('avoid: ' + J(L['avoid']))
    o.append('boss: ' + J(L['boss']))
    o.append('free: ' + J(L['free']))
    return 'genWild({ ' + ', '.join(o) + ' })'
LAND_CALLS = ', '.join(land_ts(L) for L in LANDS)

ed('  const AREAS: { [k: string]: Area } = {};', WILD + '  const AREAS: { [k: string]: Area } = {};')
ed('genCitadel(), genAbyss()].forEach((a: Area) => { AREAS[a.id] = a; });',
   'genCitadel(), genAbyss(), genStar(), ' + LAND_CALLS + '''].forEach((a: Area) => { AREAS[a.id] = a; });
  // round 6: roads from the old world into the new lands
  openEdge(AREAS.village, "s", 19, 20, PATH, "wolfhills", 1, 5);
  openEdge(AREAS.cave, "w", 21, 23, FLOOR, "mine", 42, -1);
  openEdge(AREAS.mount, "n", 41, 43, PATH, "glacier", 38, -17);
  openEdge(AREAS.desert, "n", 23, 25, PATH, "steppe", 38, 0);
  openEdge(AREAS.coast, "s", 24, 25, PATH, "sunken", 1, 0);
  openEdge(AREAS.citadel, "e", 13, 14, COBBLE, "star", 1, 0);''')

AINFO = '''
    wolfhills: { lv: "Potwory poz. 4–10", amb: "fly", dark: 0, bg: "#24401c", gx: 0, gy: 2 },
    mine: { lv: "Potwory poz. 11–18", amb: "", dark: 0.82, bg: "#0c0a0e", gx: 0, gy: 0 },
    glacier: { lv: "Potwory poz. 20–28", amb: "snow", dark: 0, bg: "#7a8494", gx: 2, gy: 0 },
    steppe: { lv: "Potwory poz. 25–33", amb: "sand", dark: 0, bg: "#8a6a40", gx: 3, gy: 1 },
    elfwood: { lv: "Potwory poz. 31–39", amb: "fly", dark: 0.15, bg: "#14301a", gx: 3, gy: 0 },
    sunken: { lv: "Potwory poz. 42–50", amb: "fog", dark: 0.4, bg: "#0e2026", gx: 5, gy: 3 },
    star: { lv: "Bezpieczne miasto · poz. 60+", amb: "", dark: 0, bg: "#1c2236", gx: 6, gy: 0 },
    crystal: { lv: "Potwory poz. 60–68", amb: "snow", dark: 0.15, bg: "#5a7088", gx: 7, gy: 0 },
    necro: { lv: "Potwory poz. 66–74", amb: "fog", dark: 0.55, bg: "#0e0c12", gx: 6, gy: 1 },
    dragon: { lv: "Potwory poz. 72–80", amb: "", dark: 0.25, bg: "#1a0c0a", gx: 7, gy: 1 },'''
ed('    abyss: { lv: "Potwory poz. 49–60", amb: "fog", dark: 0.6, bg: "#0b0812", gx: 4, gy: 0 },',
   '    abyss: { lv: "Potwory poz. 49–60", amb: "fog", dark: 0.6, bg: "#0b0812", gx: 4, gy: 0 },' + AINFO)
ed('    while (c !== to && g++ < 10) {', '    while (c !== to && g++ < 40) {')
# world map: grid sized from AINFO; on tall screens the grid is transposed so names stay readable
ed('      const cw = iw / 6, ch = ih / 3;\n      const nb2 = (id: string): number[] => [ix + (AINFO[id].gx + 0.5) * cw, iy + (AINFO[id].gy + 0.5) * ch];',
   '''      let gxm = 0, gym = 0; for (const k of Object.keys(AINFO)) { gxm = Math.max(gxm, AINFO[k].gx); gym = Math.max(gym, AINFO[k].gy); }
      const trp = ih > iw * 1.1;
      const cw = iw / ((trp ? gym : gxm) + 1), ch = ih / ((trp ? gxm : gym) + 1);
      const nb2 = (id: string): number[] => [ix + ((trp ? AINFO[id].gy : AINFO[id].gx) + 0.5) * cw, iy + ((trp ? AINFO[id].gx : AINFO[id].gy) + 0.5) * ch];''')

# ---------------------------------------------------------------- items (legacy bag items: trophies, quest items, potions)
ITEMS = [
  ('spot', dict(n='Mikstura Gwiazd', t='p', heal=2600, price=520, c='#9fd8ff', ic='pot')),
  ('dpot', dict(n='Smocza mikstura', t='p', heal=4200, price=860, c='#ff4a3a', ic='pot')),
  ('gmpot', dict(n='Wielka mikstura many', t='m', mana=180, price=70, c='#2a5bff', ic='pot')),
  ('bandana', dict(n='Chusta zbója', t='j', price=8, c='#a0302a', ic='silk')),
  ('bearpaw', dict(n='Niedźwiedzia łapa', t='q', price=14, c='#7a4a2a', ic='pelt')),
  ('fang', dict(n='Kieł Herszta', t='j', price=180, c='#e8e0c8', ic='tusk')),
  ('kcrys', dict(n='Kryształ kobolda', t='j', price=22, c='#5fe3ff', ic='gem')),
  ('dwarfr', dict(n='Krasnoludzka runa', t='q', price=30, c='#c9a45c', ic='relic')),
  ('mtusk', dict(n='Kieł mamuta', t='q', price=48, c='#f0f0e0', ic='tusk')),
  ('frostc', dict(n='Rdzeń zamieci', t='j', price=55, c='#bfefff', ic='orb')),
  ('hyhide', dict(n='Skóra hieny', t='j', price=50, c='#b08a50', ic='pelt')),
  ('bscale', dict(n='Łuska bazyliszka', t='q', price=70, c='#5aa040', ic='scarab')),
  ('bark', dict(n='Kora pradrzewa', t='q', price=85, c='#6a8a3a', ic='bone')),
  ('elfar', dict(n='Elfi grot', t='j', price=80, c='#9fe08a', ic='ear')),
  ('coral', dict(n='Czarny koral', t='q', price=150, c='#3a2a4a', ic='gem')),
  ('nscale', dict(n='Łuska nagi', t='j', price=140, c='#3ac8a8', ic='scarab')),
  ('starsh', dict(n='Gwiezdny odłamek', t='q', price=260, c='#e8f4ff', ic='gem')),
  ('prism', dict(n='Pryzmat', t='j', price=240, c='#9fe8ff', ic='orb')),
  ('soulg', dict(n='Klejnot duszy', t='q', price=300, c='#8aff9a', ic='orb')),
  ('bdust', dict(n='Proch kości', t='j', price=260, c='#d8d2c0', ic='bone')),
  ('dscale', dict(n='Łuska ognistego wyrma', t='q', price=360, c='#ff5a2a', ic='scarab')),
  ('dheart', dict(n='Smocze serce', t='j', price=1200, c='#ff2a2a', ic='relic')),
  ('vcrown', dict(n='Korona Valgara', t='j', price=4200, c='#9aff9a', ic='relic')),
  ('vscale', dict(n='Łuska Valdraka', t='j', price=6000, c='#ffb347', ic='relic')),
]
def obj(d):
    return '{ ' + ', '.join('%s: %s' % (k, J(v)) for k, v in d.items()) + ' }'
ed('    crown: { n: "Korona Morgatha", t: "j", price: 3000, c: "#c58cff", ic: "relic" },',
   '    crown: { n: "Korona Morgatha", t: "j", price: 3000, c: "#c58cff", ic: "relic" },\n' + '\n'.join('    %s: %s,' % (k, obj(d)) for k, d in ITEMS))

# ---------------------------------------------------------------- monsters
def mob(n, lvl, hp, atk, dfn, xp, gold, drops, **kw):
    d = dict(n=n, lvl=lvl, hp=hp, atk=atk, **{'def': dfn}, xp=xp, gold=gold)
    d.update(dict(spd=kw.pop('spd', 3), aggro=kw.pop('aggro', 5), cd=kw.pop('cd', 1.4), resp=kw.pop('resp', 34 if lvl > 20 else 22)))
    d.update(kw); d['drops'] = drops
    return d
H = lambda body, skin, hair, eye, **k: dict(body=body, skin=skin, hair=hair, eye=eye, **k)
MON = [
  ('bandit', mob('Zbój z gościńca', 5, 66, 13, 4, 30, [4, 9], [['bandana', 0.5], ['pot', 0.12]], hum=H('#5a3a2a', '#e0b48a', '#2a1a10', '#ff5040', hood=True), hw='#9aa0a8', resp=18)),
  ('bwolf', mob('Czarny wilk', 6, 80, 15, 5, 38, [4, 10], [['pelt', 0.5], ['pot', 0.12]], as_='wolf', tint='brightness(0.45) saturate(0.6)', resp=18)),
  ('bear', mob('Niedźwiedź brunatny', 8, 150, 21, 8, 75, [8, 16], [['bearpaw', 0.55], ['bigpot', 0.06]], as_='yeti', tint='sepia(1) saturate(2.2) hue-rotate(-15deg) brightness(0.55)', sc=1.05, spd=2.4, resp=26)),
  ('kiel', mob('Kieł, Herszt Zbójców', 10, 720, 27, 11, 760, [140, 220], [['fang', 1], ['bigpot', 1], ['$w3', 0.25]], boss=True, slam=6, sc=1.25, rng=4, pc='#ffb347', resp=180, hum=H('#3a1a1a', '#d8a880', '#1a1a1a', '#ff3030', beard=True, helmet=True), hw='#c9d1d9', glow='rgba(255,90,60,0.3)')),
  ('kobold', mob('Kobold górnik', 12, 210, 31, 12, 160, [10, 20], [['kcrys', 0.5], ['bigpot', 0.08]], as_='goblin', tint='hue-rotate(160deg) saturate(1.4) brightness(0.8)', sc=0.9)),
  ('crawler', mob('Kamienny pełzacz', 14, 270, 37, 15, 220, [12, 24], [['kcrys', 0.35], ['mpot', 0.1]], as_='spider', tint='grayscale(1) brightness(1.2)', sc=1.2, spd=2.6)),
  ('dghost', mob('Duch krasnoluda', 16, 380, 43, 18, 320, [16, 30], [['dwarfr', 0.55], ['elix', 0.05]], hum=H('#4a5a7a', '#a8c0e0', '#e8e8ff', '#9fe8ff', beard=True, helmet=True), hw='#9fe8ff', glow='rgba(150,200,255,0.4)', sc=0.9)),
  ('grimgor', mob('Grimgor, Duch Kopalni', 18, 2100, 50, 21, 2500, [400, 650], [['dwarfr', 1], ['elix', 1], ['relic', 0.5]], boss=True, slam=6, sc=1.35, rng=4, pc='#9fe8ff', resp=200, hum=H('#2a3a5a', '#b8d0f0', '#ffffff', '#7fe9ff', beard=True, crown=True), hw='#9fe8ff', hwk='staff', glow='rgba(127,233,255,0.45)')),
  ('frwraith', mob('Upiór zamieci', 21, 500, 56, 25, 500, [20, 40], [['frostc', 0.45], ['elix', 0.05]], as_='wisp', tint='grayscale(1) brightness(1.5)', rng=4, pc='#e8f8ff')),
  ('icetroll', mob('Lodowy troll', 23, 600, 61, 28, 600, [24, 46], [['frostc', 0.3], ['elix', 0.06]], as_='troll', tint='hue-rotate(170deg) saturate(1.4) brightness(1.15)')),
  ('mammoth', mob('Mamut szronowy', 25, 850, 68, 31, 800, [30, 55], [['mtusk', 0.55], ['gpot', 0.04]], as_='yeti', tint='sepia(0.6) brightness(0.9)', sc=1.4, spd=2.2, resp=40)),
  ('szronia', mob('Szronia, Królowa Lodu', 28, 5200, 76, 34, 8500, [1100, 1700], [['frostc', 1], ['gpot', 1], ['relic', 1]], boss=True, slam=5, sc=1.4, rng=5, pc='#bfefff', resp=240, hum=H('#bfe0ff', '#e8f4ff', '#ffffff', '#5fd8ff', long=True, robe=True, crown=True), hw='#bfefff', hwk='staff', glow='rgba(190,240,255,0.5)')),
  ('hyena', mob('Hiena stepowa', 26, 820, 70, 32, 820, [28, 56], [['hyhide', 0.5], ['elix', 0.06]], as_='wolf', tint='sepia(1) saturate(1.6) brightness(0.95)')),
  ('nomad', mob('Koczownik-łupieżca', 28, 950, 75, 34, 950, [36, 70], [['hyhide', 0.25], ['gpot', 0.05]], hum=H('#8a5a2a', '#c89068', '#1a1a1a', '#ffb040', hood=True), hw='#c9d1d9')),
  ('basil', mob('Bazyliszek', 31, 1350, 84, 37, 1300, [44, 84], [['bscale', 0.55], ['gpot', 0.06]], as_='scorp', tint='hue-rotate(70deg) saturate(1.8)', sc=1.3, spd=2.4, resp=40)),
  ('burzan', mob('Chan Burzan', 33, 6500, 88, 39, 10000, [1400, 2100], [['gpot', 1], ['relic', 1], ['hyhide', 1]], boss=True, slam=5, sc=1.4, rng=4, pc='#ffb347', resp=240, hum=H('#7a3a1a', '#c89068', '#1a1a1a', '#ffd84a', beard=True, helmet=True), hw='#ffd84a', glow='rgba(255,180,60,0.35)')),
  ('delf', mob('Mroczny elf', 32, 1250, 86, 38, 1250, [42, 80], [['elfar', 0.5], ['gpot', 0.05]], hum=H('#1a3a2a', '#c8d8c0', '#e8e8e8', '#7dff8a', long=True, hood=True), hw='#9fe08a', hwk='staff', rng=4, pc='#7dff8a')),
  ('wwolf', mob('Wilkołak', 36, 1500, 96, 42, 1550, [48, 90], [['pelt', 0.6], ['gpot', 0.06]], as_='swolf', tint='brightness(0.5) sepia(0.6)', sc=1.25)),
  ('treant', mob('Pradrzewiec', 35, 1900, 94, 44, 1700, [50, 96], [['bark', 0.55], ['selix', 0.03]], as_='golem', tint='sepia(1) hue-rotate(50deg) saturate(2) brightness(0.8)', sc=1.35, spd=2, resp=40)),
  ('morana', mob('Morana, Driada Zagłady', 39, 9000, 104, 46, 16000, [2200, 3200], [['bark', 1], ['selix', 1], ['relic', 1]], boss=True, slam=5, sc=1.45, rng=5, pc='#7dff8a', resp=270, hum=H('#1a4a1a', '#a8d890', '#3a8a2a', '#e0ff60', long=True, robe=True, crown=True), hw='#7dff8a', hwk='staff', glow='rgba(125,255,138,0.45)')),
  ('naga', mob('Naga z głębin', 43, 2200, 113, 52, 2200, [62, 120], [['nscale', 0.5], ['selix', 0.04]], hum=H('#1a6a6a', '#7ad8c0', '#1a3a3a', '#e0ff60', long=True, robe=True), hw='#7fffd0', hwk='staff', rng=4, pc='#7fffd0', glow='rgba(120,255,208,0.3)')),
  ('drowned', mob('Utopiony rycerz', 46, 2600, 121, 56, 2500, [70, 130], [['nscale', 0.3], ['selix', 0.05]], hum=H('#2a4a4a', '#6a8a80', '#1a2a2a', '#c8ff60', helmet=True), hw='#7a9a90')),
  ('tentacle', mob('Macka Głębin', 48, 3300, 127, 60, 3000, [80, 150], [['coral', 0.55], ['selix', 0.06]], as_='drowner', tint='hue-rotate(200deg) saturate(1.8) brightness(0.8)', sc=1.35, spd=2.2, resp=40)),
  ('thalassor', mob('Thalassor, Kraken Głębin', 50, 17000, 136, 62, 32000, [3800, 5200], [['coral', 1], ['selix', 1], ['relic', 2]], boss=True, slam=5, sc=1.75, rng=5, pc='#7fffd0', resp=300, as_='dragon', tint='hue-rotate(120deg) saturate(1.6) brightness(0.8)')),
  ('cspider', mob('Pryzmatyczny pająk', 61, 4200, 158, 76, 4300, [120, 220], [['prism', 0.45], ['spot', 0.04]], as_='spider', tint='hue-rotate(170deg) saturate(2) brightness(1.4)', sc=1.25)),
  ('cgolem', mob('Kryształowy golem', 63, 5600, 164, 82, 5200, [140, 250], [['prism', 0.55], ['spot', 0.05]], as_='golem', tint='hue-rotate(160deg) saturate(2.4) brightness(1.3)', sc=1.4, spd=2, resp=42)),
  ('starw', mob('Gwiezdny strażnik', 66, 5000, 170, 80, 5200, [140, 260], [['starsh', 0.5], ['spot', 0.05]], hum=H('#2a3a6a', '#d8e0ff', '#ffffff', '#9fd8ff', helmet=True), hw='#bfe8ff', glow='rgba(160,210,255,0.35)')),
  ('kolos', mob('Lustrzany Kolos', 68, 32000, 176, 84, 70000, [7000, 9500], [['starsh', 1], ['spot', 2], ['relic', 2]], boss=True, slam=5, sc=1.8, rng=5, pc='#bfe8ff', resp=330, as_='golem', tint='hue-rotate(180deg) saturate(1.2) brightness(1.7)')),
  ('bmage', mob('Kościany mag', 67, 5300, 172, 82, 5400, [150, 270], [['bdust', 0.5], ['spot', 0.05]], hum=H('#2a2a2a', '#ece6d4', '#ece6d4', '#7dff8a', robe=True, hood=True), hw='#7dff8a', hwk='staff', rng=4, pc='#7dff8a', glow='rgba(125,255,138,0.3)')),
  ('specter', mob('Upiorna zjawa', 69, 5600, 177, 84, 5800, [160, 280], [['soulg', 0.5], ['spot', 0.05]], as_='boss', tint='hue-rotate(80deg) saturate(1.4)')),
  ('bdrake', mob('Kościany smok', 72, 7400, 185, 90, 7000, [190, 320], [['bdust', 0.6], ['dpot', 0.04]], as_='dragon', tint='grayscale(1) brightness(1.3)', sc=1.1, spd=2.4, resp=44)),
  ('valgar', mob('Valgar, Lisz Nekropolii', 74, 38000, 190, 90, 85000, [8000, 11000], [['vcrown', 1], ['dpot', 2], ['relic', 2]], boss=True, slam=5, sc=1.6, rng=5, pc='#9aff9a', resp=360, hum=H('#14201a', '#c8d0c0', '#0a120a', '#7dff8a', robe=True, crown=True), hw='#9aff9a', hwk='staff', glow='rgba(154,255,154,0.5)')),
  ('drakon', mob('Ognisty drakon', 73, 6400, 188, 90, 6600, [180, 320], [['dscale', 0.3], ['dpot', 0.04]], as_='dragon', tint='hue-rotate(-60deg) saturate(2)', sc=0.9)),
  ('dkin', mob('Smoczy kultysta', 75, 6800, 193, 92, 7000, [190, 340], [['dheart', 0.06], ['dpot', 0.05]], hum=H('#5a1a0a', '#d8a080', '#2a0a0a', '#ff6a2a', robe=True, hood=True), hw='#ff7a2a', hwk='staff', rng=4, pc='#ff7a2a', glow='rgba(255,120,40,0.35)')),
  ('wyrm', mob('Lawowy wyrm', 78, 8800, 200, 98, 8600, [220, 380], [['dscale', 0.55], ['dpot', 0.06]], as_='scorp', tint='hue-rotate(-30deg) saturate(3) brightness(0.9)', sc=1.5, spd=2.2, resp=46)),
  ('valdrak', mob('Valdrak, Pradawny Smok', 80, 52000, 210, 100, 120000, [12000, 16000], [['vscale', 1], ['dheart', 1], ['dpot', 3]], boss=True, slam=5, sc=2, rng=5, pc='#ff7a2a', resp=420, as_='dragon', tint='hue-rotate(-90deg) saturate(2.4) brightness(1.05)')),
]
def mobts(k, d):
    parts = []
    for kk, v in d.items():
        key = 'as' if kk == 'as_' else kk
        parts.append('%s: %s' % (key, J(v)))
    return '    %s: { %s },' % (k, ', '.join(parts))
ed('    king: { n: "Sethar, Król Cieni",', '\n'.join(mobts(k, d) for k, d in MON) + '\n    king: { n: "Sethar, Król Cieni",')
ed('"ignar", "shade", "morgath"];', '"ignar", "shade", "morgath", "dghost", "grimgor", "frwraith", "szronia", "delf", "naga", "starw", "kolos", "bmage", "specter", "valgar", "dkin", "valdrak", "morana", "thalassor", "cspider", "cgolem"];')

# ---------------------------------------------------------------- NPCs (quest givers, merchants, auctioneers)
NPCS = [
  ('gajowy', dict(n='Gajowy Bartosz', area='wolfhills', x=27, y=4, c=dict(body='#3a5a2a', skin='#e0b48a', hair='#6a4a2a', beard=True), talk='Wilcze Wzgórza były kiedyś spokojne. Teraz rządzą tu zbóje Kła i wilki, które straciły strach przed ludźmi.')),
  ('borysl', dict(n='Krasnolud Borysław', area='mine', x=38, y=19, c=dict(body='#5a4a3a', skin='#e0b090', hair='#a0522d', beard=True, helmet=True), talk='Moi przodkowie kopali tu srebro. Teraz w chodnikach straszy duch naszego dawnego starszego, Grimgora.')),
  ('szronka', dict(n='Łowczyni Szronka', area='glacier', x=27, y=34, c=dict(body='#c8d8e8', skin='#f2cfa8', hair='#e8e8e8', long=True, hood=True), talk='Na lodowcu przeżyją tylko najtwardsi. Królowa Lodu zamraża każdego, kto zbliży się do jej tronu.')),
  ('radzim', dict(n='Zwiadowca Radzim', area='steppe', x=26, y=34, c=dict(body='#8a6a3a', skin='#c89068', hair='#2a1a10', hood=True), talk='Stepy płoną od lat. Chan Burzan i jego koczownicy palą wszystko, czego nie mogą zabrać.')),
  ('iwa', dict(n='Strażniczka Iwa', area='elfwood', x=27, y=34, c=dict(body='#2a5a3a', skin='#f2cfa8', hair='#d8c070', long=True), talk='Puszcza choruje. Driada Morana zatruła korzenie pradrzew i obróciła mój lud przeciw nam.')),
  ('wawrzyn', dict(n='Nurek Wawrzyn', area='sunken', x=27, y=5, c=dict(body='#2a4a6a', skin='#e0b48a', hair='#3a2a1a', beard=True), talk='Pod wodą leży stolica dawnego królestwa. Kraken Thalassor pilnuje jej skarbów od tysiąca lat.')),
  ('starcap', dict(n='Strażnik Gwiazd Aurelian', area='star', x=21, y=11, c=dict(body='#2a3a6a', skin='#e8bf98', hair='#e8e8e8', helmet=True), talk='Gwiezdna Strażnica pilnuje granic świata. Dalej na wschodzie jest już tylko kryształ, śmierć i smoki.')),
  ('astronom', dict(n='Astronom Gwidon', area='star', x=14, y=16, c=dict(body='#3a2a6a', skin='#f0c9a0', hair='#bbbbbb', beard=True, robe=True), talk='Gwiazdy spadają na Kryształowe Pustkowia. Każdy odłamek ma w sobie moc, której nie rozumiemy.')),
  ('inkwiz', dict(n='Inkwizytor Bożydar', area='star', x=26, y=15, c=dict(body='#1a1a2a', skin='#e0b890', hair='#2a2a2a', helmet=True), talk='Nekropolia Valgaru budzi się do życia. Lisz zbiera armię, której nie powstrzyma żaden mur.')),
  ('smokobojca', dict(n='Smokobójca Bolesław', area='star', x=9, y=15, c=dict(body='#6a2a1a', skin='#dfb088', hair='#7a2a1a', beard=True, helmet=True), talk='Valdrak, Pradawny Smok, był stary, gdy Ardan był młody. Kto go pokona, stanie się legendą.')),
  ('starsmith', dict(n='Mistrz kuźni gwiezdnej Ostoja', area='star', x=26, y=12, c=dict(body='#2a2a3a', skin='#dfb088', hair='#e8e8e8', apron=True, beard=True), shop='starm', talk='Kuję w ogniu spadających gwiazd. Pokaż, co masz, a zrobię z tego coś godnego bohatera.')),
  ('staralch', dict(n='Alchemiczka Gwiazdka', area='star', x=9, y=12, c=dict(body='#3a5a8a', skin='#f2cfa8', hair='#d8d8ff', long=True), shop='starm', talk='Mikstura Gwiazd uleczy rany, po których inni już by nie wstali.')),
  ('starpriest', dict(n='Kapłan Zorzy', area='star', x=21, y=16, c=dict(body='#f0e8d8', skin='#e8bf98', hair='#5a3a2a'), heal='Poproś o blask zorzy', talk='Blask zorzy przywraca siły każdemu, kto walczy z mrokiem.')),
  # merchants (buy gear and materials) and auctioneers (player market) – trading happens only next to them
  ('handvil', dict(n='Handlarz Jędrek', area='village', x=24, y=13, trade='skup', c=dict(body='#7a5a2a', skin='#f0c9a0', hair='#5a3a1a', beard=True), talk='Skupuję wszystko, co przyniesiesz z lasu: broń, zbroje, materiały. Płacę uczciwie, w złocie.')),
  ('handtown', dict(n='Handlarz Bogdan', area='town', x=16, y=12, trade='skup', c=dict(body='#6a4a2a', skin='#f0c9a0', hair='#2a1a10', beard=True), talk='Najlepsze ceny w Srebrnogrodzie! Sprzedaj mi to, czego nie potrzebujesz.')),
  ('auktown', dict(n='Aukcjoner Mieszko', area='town', x=25, y=13, trade='aukcja', c=dict(body='#5a2a6a', skin='#f0c9a0', hair='#8a8a8a', beard=True), talk='Dom aukcyjny Srebrnogrodu. U mnie wystawisz przedmioty dla innych graczy i kupisz to, co oni wystawili.')),
  ('handport', dict(n='Handlarz Ignacy', area='port', x=21, y=16, trade='skup', c=dict(body='#2a4a6a', skin='#e0b48a', hair='#5a3a1a'), talk='Statki zabierają wszystko. Skupię każdy przedmiot i każdy materiał.')),
  ('aukport', dict(n='Aukcjonerka Halina', area='port', x=14, y=11, trade='aukcja', c=dict(body='#6a2a3a', skin='#f2cfa8', hair='#c87a3a', long=True), talk='Dom aukcyjny Mewiej Przystani. Wystawiaj, kupuj, odbieraj złoto ze sprzedaży.')),
  ('handfort', dict(n='Handlarz Wojmir', area='fort', x=21, y=16, trade='skup', c=dict(body='#5a3a2a', skin='#e0b48a', hair='#1a1a1a', beard=True), talk='Twierdza potrzebuje stali. Skupię broń, zbroje i materiały.')),
  ('handcit', dict(n='Handlarz Świętosław', area='citadel', x=21, y=16, trade='skup', c=dict(body='#4a4a6a', skin='#f0c9a0', hair='#d8d8d8', beard=True), talk='Skup przedmiotów Cytadeli. Każdy łup ma swoją cenę.')),
  ('aukcit', dict(n='Aukcjonerka Dobrosława', area='citadel', x=14, y=11, trade='aukcja', c=dict(body='#2a2a5a', skin='#f2cfa8', hair='#ffd84a', long=True), talk='Dom aukcyjny Cytadeli Świtu. Najlepsze przedmioty Ardanu przechodzą przez moje ręce.')),
  ('handstar', dict(n='Handlarz Gwiezdny Lech', area='star', x=12, y=11, trade='skup', c=dict(body='#3a3a6a', skin='#e0b48a', hair='#2a1a10'), talk='Skupuję łupy z najdalszych krain. Płacę dobrze, bo wiem, ile kosztują.')),
  ('aukstar', dict(n='Aukcjoner Gwiezdny Radosław', area='star', x=23, y=17, trade='aukcja', c=dict(body='#5a3a7a', skin='#f0c9a0', hair='#e8e8e8', beard=True), talk='Dom aukcyjny Gwiezdnej Strażnicy. Tu handlują najpotężniejsi bohaterowie.')),
]
ed('''    citpriest: { n: "Kapłanka Jutrzenka", area: "citadel", x: 26, y: 15, c: { body: "#f0e8d8", skin: "#f2cfa8", hair: "#c87a3a", long: true }, heal: "Poproś o światło świtu", talk: "Światło świtu wyleczy każdą ranę." },
  };''', '''    citpriest: { n: "Kapłanka Jutrzenka", area: "citadel", x: 26, y: 15, c: { body: "#f0e8d8", skin: "#f2cfa8", hair: "#c87a3a", long: true }, heal: "Poproś o światło świtu", talk: "Światło świtu wyleczy każdą ranę." },
''' + '\n'.join('    %s: %s,' % (k, obj(d)) for k, d in NPCS) + '\n  };')
DECOR = [('wolfhills', 22, 3, 'tent'), ('wolfhills', 23, 6, 'fire'), ('mine', 37, 23, 'lamp'), ('mine', 29, 12, 'lamp'), ('mine', 15, 20, 'lamp'), ('mine', 40, 23, 'crate'),
  ('glacier', 22, 33, 'tent'), ('glacier', 23, 36, 'fire'), ('steppe', 21, 33, 'tent'), ('steppe', 22, 36, 'fire'), ('elfwood', 22, 33, 'tent'), ('elfwood', 23, 36, 'fire'),
  ('sunken', 22, 4, 'lamp'), ('sunken', 28, 3, 'crate'), ('star', 16, 2, 'banner'), ('star', 19, 2, 'banner'), ('star', 33, 12, 'banner'), ('star', 33, 15, 'banner'), ('star', 12, 16, 'shrine'),
  ('village', 25, 12, 'crate'), ('town', 15, 11, 'crate'), ('town', 26, 12, 'banner'), ('port', 13, 10, 'banner'), ('citadel', 13, 10, 'lamp'), ('star', 22, 18, 'lamp'),
  ('crystal', 6, 17, 'shrine'), ('necro', 22, 4, 'lamp'), ('necro', 27, 4, 'lamp'), ('dragon', 6, 17, 'shrine')]
ed('{ area: "abyss", x: 42, y: 22, k: "lamp" }];', '{ area: "abyss", x: 42, y: 22, k: "lamp" },\n    ' + ', '.join('{ area: "%s", x: %d, y: %d, k: "%s" }' % d for d in DECOR) + '];')
ed('citm: "Skarbiec Świtu" };', 'citm: "Skarbiec Świtu", starm: "Gwiezdny skarbiec" };')
ed('citm: ["gpot", "selix", "mpot"] };', 'citm: ["gpot", "selix", "spot", "mpot", "gmpot"], starm: ["selix", "spot", "dpot", "mpot", "gmpot"] };')

# ---------------------------------------------------------------- quests
Q = []
def quest(id, n, giver, lvl, area, desc, offer, lock, mid, thx, kill=None, item=None, src=None, need=1, req=None, boss=False, items=None):
    base = xp_next(lvl)
    xp = int(round(base * (0.95 if boss else 0.45 if item else 0.38), -1))
    gold = int(round((lvl * lvl * 0.9 + 40) * (2.5 if boss else 1), -1))
    d = dict(n=n, giver=giver)
    if req: d['req'] = req
    d['lvl'] = lvl
    if kill: d['kill'] = kill
    if item: d['item'] = item; d['src'] = src
    d.update(need=need, area=area, desc=desc, offer=offer, lock=lock, mid=mid, thx=thx, rew=dict(xp=xp, gold=gold, items=items or []))
    Q.append((id, d))
pot = lambda l: 'bigpot' if l < 20 else 'elix' if l < 28 else 'gpot' if l < 40 else 'selix' if l < 60 else 'spot' if l < 72 else 'dpot'
# Wilcze Wzgórza
quest('bandits', 'Zbóje na gościńcu', 'gajowy', 4, 'wolfhills', 'Ubij 8 zbójów na Wilczych Wzgórzach (południowa droga z Osady).', 'Zbóje Kła napadają na każdego, kto idzie gościńcem. Przegoń ośmiu.', 'Zbóje są groźni dla żółtodziobów. Wróć na 4. poziomie.', 'Zbójów pokonanych: {c}/{n}.', 'Gościniec znów jest bezpieczny. Należy ci się nagroda.', kill='bandit', need=8, items=[['pot', 4]])
quest('bwolves', 'Czarna wataha', 'gajowy', 5, 'wolfhills', 'Ubij 8 czarnych wilków na Wilczych Wzgórzach.', 'Czarne wilki porywają owce z Osady. Ubij osiem, zanim zaczną atakować ludzi.', 'Wataha jest zbyt silna. Wróć na 5. poziomie.', 'Wilków ubitych: {c}/{n}.', 'Wataha się przerzedziła. Pasterze ci dziękują.', kill='bwolf', need=8, items=[['pot', 3]])
quest('bearpaws', 'Łapy niedźwiedzia', 'gajowy', 7, 'wolfhills', 'Przynieś 4 niedźwiedzie łapy od niedźwiedzi brunatnych.', 'Z niedźwiedzich łap robię maść na rany. Przynieś mi cztery.', 'Niedźwiedź rozszarpie cię w mig. Wróć na 7. poziomie.', 'Masz {c}/{n} łap.', 'Doskonale! Maść wystarczy na całą zimę. Weź mikstury.', item='bearpaw', src='bear', need=4, items=[['bigpot', 2]])
quest('kielq', 'Herszt Kieł', 'gajowy', 8, 'wolfhills', 'Pokonaj Kła, Herszta Zbójców, w obozie na południowym wschodzie Wilczych Wzgórz.', 'Kieł dowodzi wszystkimi zbójami w okolicy. Pokonaj go, a wzgórza odetchną.', 'Kieł to doświadczony wojownik. Wróć na 8. poziomie.', 'Kieł wciąż rządzi w swoim obozie.', 'Kieł pokonany! Osada jest ci winna wdzięczność.', kill='kiel', req='bandits', boss=True, items=[['bigpot', 3]])
# Kopalnia Krasnoludów
quest('kobolds', 'Kobold w każdym chodniku', 'borysl', 11, 'mine', 'Ubij 10 koboldów w Kopalni Krasnoludów (zachodni tunel Jaskini Cieni).', 'Koboldy zajęły nasze chodniki i kradną rudę. Wyrzuć dziesięciu.', 'Koboldy chodzą stadami. Wróć na 11. poziomie.', 'Koboldów ubitych: {c}/{n}.', 'Chodniki znów są nasze. Dzięki, przyjacielu.', kill='kobold', need=10, items=[['bigpot', 3]])
quest('crawlers', 'Kamienne pełzacze', 'borysl', 13, 'mine', 'Rozbij 8 kamiennych pełzaczy w kopalni.', 'Pełzacze drążą skałę i zawalają stropy. Rozbij ośmiu.', 'Pełzacze mają skorupy twarde jak granit. Wróć na 13. poziomie.', 'Pełzaczy rozbitych: {c}/{n}.', 'Stropy przestały się sypać. Bierz zapłatę.', kill='crawler', need=8, items=[['bigpot', 3], ['mpot', 2]])
quest('runes', 'Runy przodków', 'borysl', 14, 'mine', 'Przynieś 5 krasnoludzkich run od duchów krasnoludów.', 'Duchy moich przodków noszą runy, które mogą je uspokoić. Przynieś pięć.', 'Duchy nie zniosą słabego. Wróć na 14. poziomie.', 'Masz {c}/{n} run.', 'Runy wróciły do rodu. Duchy wreszcie odpoczną.', item='dwarfr', src='dghost', need=5, items=[['elix', 2]])
quest('grimq', 'Duch Kopalni', 'borysl', 16, 'mine', 'Pokonaj Grimgora, Ducha Kopalni, w najgłębszej sali na południowym zachodzie.', 'Grimgor był naszym starszym. Jego duch oszalał. Uwolnij go.', 'Grimgor jest potężny nawet po śmierci. Wróć na 16. poziomie.', 'Grimgor wciąż krąży po najgłębszej sali.', 'Grimgor zaznał spokoju. Ród Borysława nigdy cię nie zapomni.', kill='grimgor', req='runes', boss=True, items=[['elix', 3], ['relic', 1]])
# Lodowiec Wichrów
quest('frwraiths', 'Upiory zamieci', 'szronka', 20, 'glacier', 'Rozprosz 10 upiorów zamieci na Lodowcu Wichrów (północna przełęcz Szczytów Szronu).', 'Upiory zamieci zamrażają podróżnych. Rozprosz dziesięć.', 'Mróz zabije cię szybciej niż upiór. Wróć na 20. poziomie.', 'Upiorów rozproszonych: {c}/{n}.', 'Zamieć słabnie. Dobra robota.', kill='frwraith', need=10, items=[['elix', 3]])
quest('mtusks', 'Kły mamutów', 'szronka', 23, 'glacier', 'Przynieś 5 kłów mamuta od szronowych mamutów.', 'Kły mamutów są cenne jak złoto. Przynieś mi pięć.', 'Mamut stratuje cię bez trudu. Wróć na 23. poziomie.', 'Masz {c}/{n} kłów.', 'Piękne kły! Część zysku jest twoja.', item='mtusk', src='mammoth', need=5, items=[['elix', 3]])
quest('szroniaq', 'Królowa Lodu', 'szronka', 26, 'glacier', 'Pokonaj Szronię, Królową Lodu, na lodowym tronie na północnym wschodzie.', 'Szronia zamroziła pół Ardanu. Roztop jej serce mieczem.', 'Szronia zamrozi cię jednym spojrzeniem. Wróć na 26. poziomie.', 'Szronia wciąż siedzi na lodowym tronie.', 'Lód pęka! Wiosna wraca na przełęcze.', kill='szronia', req='frwraiths', boss=True, items=[['gpot', 3], ['relic', 1]])
# Spalone Stepy
quest('hyenas', 'Hieny stepowe', 'radzim', 25, 'steppe', 'Ubij 10 hien na Spalonych Stepach (północna droga z Ruin Piasków).', 'Hieny idą za koczownikami i dobijają rannych. Ubij dziesięć.', 'Stepy nie wybaczają słabości. Wróć na 25. poziomie.', 'Hien ubitych: {c}/{n}.', 'Hieny uciekły na wschód. Dziękuję.', kill='hyena', need=10, items=[['elix', 3]])
quest('nomads', 'Łupieżcy Chana', 'radzim', 27, 'steppe', 'Pokonaj 8 koczowników-łupieżców.', 'Koczownicy Burzana palą osady. Rozpraw się z ośmioma.', 'Łupieżcy jeżdżą bandami. Wróć na 27. poziomie.', 'Łupieżców pokonanych: {c}/{n}.', 'Osady ocalały. Chan straci cierpliwość.', kill='nomad', need=8, items=[['gpot', 2]])
quest('bscales', 'Łuski bazyliszka', 'radzim', 29, 'steppe', 'Przynieś 5 łusek bazyliszka.', 'Łuski bazyliszka chronią przed ogniem. Przynieś mi pięć.', 'Spojrzenie bazyliszka paraliżuje. Wróć na 29. poziomie.', 'Masz {c}/{n} łusek.', 'Z tych łusek zrobimy tarcze dla zwiadowców.', item='bscale', src='basil', need=5, items=[['gpot', 3]])
quest('burzanq', 'Chan Burzan', 'radzim', 31, 'steppe', 'Pokonaj Chana Burzana w jego obozie na północnym wschodzie stepów.', 'Bez Chana koczownicy rozproszą się w tydzień. Pokonaj go.', 'Chan to najlepszy wojownik stepów. Wróć na 31. poziomie.', 'Chan wciąż rządzi z obozu.', 'Chan pokonany! Stepy mogą odrosnąć.', kill='burzan', req='nomads', boss=True, items=[['gpot', 3], ['relic', 1]])
# Szmaragdowa Puszcza
quest('delves', 'Mroczne elfy', 'iwa', 31, 'elfwood', 'Pokonaj 10 mrocznych elfów w Szmaragdowej Puszczy (północ Spalonych Stepów).', 'Morana obróciła mój lud przeciwko nam. Pokonaj dziesięciu, może reszta się opamięta.', 'Elfy strzelają z ukrycia. Wróć na 31. poziomie.', 'Elfów pokonanych: {c}/{n}.', 'Część elfów rzuciła łuki. Jest nadzieja.', kill='delf', need=10, items=[['gpot', 3]])
quest('bark', 'Kora pradrzew', 'iwa', 33, 'elfwood', 'Przynieś 6 kawałków kory pradrzewa od pradrzewców.', 'Z kory pradrzew uwarzę lek na zarazę korzeni. Przynieś sześć.', 'Pradrzewce miażdżą skały. Wróć na 33. poziomie.', 'Masz {c}/{n} kawałków kory.', 'Lek gotowy. Puszcza zaczyna zdrowieć.', item='bark', src='treant', need=6, items=[['gpot', 3]])
quest('wolfmen', 'Wilkołaki', 'iwa', 35, 'elfwood', 'Ubij 8 wilkołaków w Szmaragdowej Puszczy.', 'Wilkołaki strzegą drogi do Morany. Ubij ośmiu.', 'Wilkołaki rozszarpią cię przy pełni. Wróć na 35. poziomie.', 'Wilkołaków ubitych: {c}/{n}.', 'Droga do Morany stoi otworem.', kill='wwolf', need=8, items=[['gpot', 2], ['selix', 1]])
quest('moranaq', 'Driada Zagłady', 'iwa', 37, 'elfwood', 'Pokonaj Moranę, Driadę Zagłady, na polanie na północnym zachodzie puszczy.', 'Morana jest sercem zarazy. Pokonaj ją, a puszcza ożyje.', 'Morana włada samymi korzeniami świata. Wróć na 37. poziomie.', 'Morana wciąż truje korzenie.', 'Puszcza oddycha! Mój lud jest wolny.', kill='morana', req='wolfmen', boss=True, items=[['selix', 3], ['relic', 2]])
# Zatopione Miasto
quest('nagas', 'Nagi z głębin', 'wawrzyn', 42, 'sunken', 'Pokonaj 10 nag w Zatopionym Mieście (południowa droga z Wybrzeża Wraków).', 'Nagi wypływają na brzeg i porywają rybaków. Pokonaj dziesięć.', 'Nagi władają magią wody. Wróć na 42. poziomie.', 'Nag pokonanych: {c}/{n}.', 'Rybacy znów mogą łowić.', kill='naga', need=10, items=[['selix', 2]])
quest('drowned', 'Utopieni rycerze', 'wawrzyn', 44, 'sunken', 'Pokonaj 8 utopionych rycerzy.', 'Rycerze dawnej stolicy wciąż jej strzegą, choć dawno utonęli. Uwolnij ośmiu.', 'Ich zbroje pamiętają setki bitew. Wróć na 44. poziomie.', 'Rycerzy pokonanych: {c}/{n}.', 'Ich dusze odpłynęły w spokoju.', kill='drowned', need=8, items=[['selix', 2]])
quest('corals', 'Czarny koral', 'wawrzyn', 46, 'sunken', 'Przynieś 5 czarnych korali od macek głębin.', 'Czarny koral rośnie tylko na mackach Krakena. Przynieś pięć.', 'Macki wciągną cię pod wodę. Wróć na 46. poziomie.', 'Masz {c}/{n} korali.', 'Z tego koralu zrobię amulety oddechu.', item='coral', src='tentacle', need=5, items=[['selix', 3]])
quest('thalq', 'Kraken Głębin', 'wawrzyn', 48, 'sunken', 'Pokonaj Thalassora, Krakena Głębin, w zatopionej świątyni na południu.', 'Thalassor śpi w świątyni na dnie miasta. Obudź go i pokonaj.', 'Kraken zmiażdży cię mackami. Wróć na 48. poziomie.', 'Thalassor wciąż czai się w świątyni.', 'Kraken pokonany! Skarby stolicy są wolne.', kill='thalassor', req='drowned', boss=True, items=[['selix', 4], ['relic', 2]])
# Kryształowe Pustkowia
quest('cspiders', 'Pryzmatyczne pająki', 'astronom', 60, 'crystal', 'Ubij 10 pryzmatycznych pająków na Kryształowych Pustkowiach (wschodnia brama Strażnicy).', 'Pająki tkają sieci z kryształu i łapią moich zwiadowców. Ubij dziesięć.', 'Pustkowia to kraj dla legend. Wróć na 60. poziomie.', 'Pająków ubitych: {c}/{n}.', 'Moi zwiadowcy mogą wrócić do pracy.', kill='cspider', need=10, items=[['spot', 3]])
quest('starsh', 'Odłamki gwiazd', 'astronom', 62, 'crystal', 'Przynieś 6 gwiezdnych odłamków od gwiezdnych strażników.', 'Strażnicy noszą odłamki spadłych gwiazd. Przynieś mi sześć, chcę zbadać ich moc.', 'Strażnicy gwiazd nie znają litości. Wróć na 62. poziomie.', 'Masz {c}/{n} odłamków.', 'Niezwykłe! Gwiazdy mówią o czymś wielkim na wschodzie.', item='starsh', src='starw', need=6, req='cspiders', items=[['spot', 3]])
quest('kolosq', 'Lustrzany Kolos', 'astronom', 65, 'crystal', 'Pokonaj Lustrzanego Kolosa na wschodnim krańcu Kryształowych Pustkowi.', 'Kolos odbija każdy cios i każde zaklęcie. Znajdź sposób, by go rozbić.', 'Kolos to góra żywego kryształu. Wróć na 65. poziomie.', 'Kolos wciąż stoi na straży.', 'Kolos rozbity w drobny mak! Strażnica jest ci wdzięczna.', kill='kolos', req='starsh', boss=True, items=[['spot', 4], ['relic', 3]])
# Nekropolia Valgaru
quest('bmages', 'Kościani magowie', 'inkwiz', 66, 'necro', 'Pokonaj 10 kościanych magów w Nekropolii Valgaru (południowa brama Strażnicy).', 'Kościani magowie wskrzeszają poległych. Zniszcz dziesięciu.', 'Nekropolia pożre słabego. Wróć na 66. poziomie.', 'Magów pokonanych: {c}/{n}.', 'Martwi przestali wstawać. Dobrze.', kill='bmage', need=10, items=[['spot', 3]])
quest('souls', 'Klejnoty dusz', 'inkwiz', 68, 'necro', 'Przynieś 6 klejnotów duszy od upiornych zjaw.', 'Zjawy więzią dusze w klejnotach. Przynieś sześć, uwolnię je.', 'Zjawy wysysają życie. Wróć na 68. poziomie.', 'Masz {c}/{n} klejnotów.', 'Dusze są wolne. Valgar traci siłę.', item='soulg', src='specter', need=6, items=[['spot', 3]])
quest('bdrakes', 'Kościane smoki', 'inkwiz', 70, 'necro', 'Zniszcz 6 kościanych smoków w Nekropolii.', 'Valgar wskrzesił smoki z dawnych wojen. Zniszcz sześć.', 'Kościany smok to wciąż smok. Wróć na 70. poziomie.', 'Smoków zniszczonych: {c}/{n}.', 'Niebo nad Nekropolią jest czyste.', kill='bdrake', need=6, req='bmages', items=[['dpot', 2]])
quest('valgarq', 'Lisz Nekropolii', 'inkwiz', 71, 'necro', 'Pokonaj Valgara, Lisza Nekropolii, w krypcie na południowym zachodzie.', 'Valgar ukrył swoją duszę w koronie. Pokonaj go i zabierz ją.', 'Valgar to mistrz śmierci. Wróć na 71. poziomie.', 'Valgar wciąż rządzi w krypcie.', 'Lisz upadł! Korona Valgara już nikogo nie wskrzesi.', kill='valgar', req='bdrakes', boss=True, items=[['dpot', 4], ['relic', 3]])
# Smocze Gniazdo
quest('drakons', 'Ogniste drakony', 'smokobojca', 72, 'dragon', 'Ubij 10 ognistych drakonów w Smoczym Gnieździe (wschodnie wyjście z Nekropolii).', 'Drakony to młode Valdraka. Ubij dziesięć, zanim urosną.', 'Ogień drakonów topi stal. Wróć na 72. poziomie.', 'Drakonów ubitych: {c}/{n}.', 'Gniazdo się przerzedziło. Valdrak będzie wściekły.', kill='drakon', need=10, items=[['dpot', 3]])
quest('dkins', 'Smoczy kultyści', 'smokobojca', 74, 'dragon', 'Pokonaj 8 smoczych kultystów.', 'Kultyści karmią Valdraka i strzegą jego legowiska. Pokonaj ośmiu.', 'Kultyści władają smoczym ogniem. Wróć na 74. poziomie.', 'Kultystów pokonanych: {c}/{n}.', 'Kult rozbity. Droga do Valdraka stoi otworem.', kill='dkin', need=8, items=[['dpot', 3]])
quest('dscales', 'Łuski wyrmów', 'smokobojca', 76, 'dragon', 'Przynieś 5 łusek ognistego wyrma od lawowych wyrmów.', 'Z łusek wyrmów wykuję pancerz, który zniesie oddech Valdraka. Przynieś pięć.', 'Wyrmy pływają w lawie. Wróć na 76. poziomie.', 'Masz {c}/{n} łusek.', 'Pancerz będzie gotowy na czas. Teraz twój ruch.', item='dscale', src='wyrm', need=5, items=[['dpot', 3]])
quest('valdrakq', 'Pradawny Smok', 'smokobojca', 77, 'dragon', 'Pokonaj Valdraka, Pradawnego Smoka, na szczycie gniazda na wschodzie.', 'Valdrak był stary, gdy Ardan był młody. Pokonaj go i zostań legendą.', 'Valdrak to najpotężniejsza istota świata. Wróć na 77. poziomie.', 'Valdrak wciąż śpi na swoim złocie.', 'Pradawny Smok pokonany! Twoje imię zapisze się w Kronice Ardanu na zawsze.', kill='valdrak', req='dscales', boss=True, items=[['dpot', 5], ['relic', 5]])

ed('"voidq", "knights", "morgq"];', '"voidq", "knights", "morgq", ' + ', '.join(J(q[0]) for q in Q) + '];')
QTS = '\n'.join('    %s: %s,' % (k, obj(d)) for k, d in Q)
ed('''  };

  // ---------- CLASSES ----------''', QTS + '''
  };

  // ---------- CLASSES ----------''')

# ---------------------------------------------------------------- level cap, merchants in the dialog
ed('  const MAXLVL = 60;', '  const MAXLVL = 80;')
ed('  function talk(id: string): void {', '  let uiReq = "";\n  function talk(id: string): void {')
ed('''    if (n.heal) extra.push({ l: n.heal,''', '''    if (n.trade) extra.push({ l: n.trade === "aukcja" ? "Otwórz dom aukcyjny" : "Sprzedaj przedmioty", fn: () => { dlg = null; uiReq = n.trade + ":" + id; } });
    if (n.heal) extra.push({ l: n.heal,''')
ed('    shopReq: (): string | null => { if (panel === "shop") { panel = ""; return shopId; } return null; },',
   '    shopReq: (): string | null => { if (panel === "shop") { panel = ""; return shopId; } return null; },\n    uiReq: (): string | null => { const u = uiReq; uiReq = ""; return u || null; },\n    quests: QUESTS, qorder: QORDER, maxLvl: MAXLVL,')
# potions: all healing / mana potions work out of battle and are counted on the HUD
ed('const have = ["pot", "bigpot", "elix"].filter((id: string) => countItem(id) > 0);', 'const have = ["pot", "bigpot", "elix", "gpot", "selix", "spot", "dpot"].filter((id: string) => countItem(id) > 0);')
ed('if (!countItem("mpot")) { log("Nie masz mikstur many.", "#9fb8ff"); return; }\n    useItem("mpot");', 'const mid = countItem("gmpot") ? "gmpot" : "mpot";\n    if (!countItem(mid)) { log("Nie masz mikstur many.", "#9fb8ff"); return; }\n    useItem(mid);')
ed('String(countItem("pot") + countItem("bigpot") + countItem("elix")));', 'String(["pot", "bigpot", "elix", "gpot", "selix", "spot", "dpot"].reduce((n: number, k: string) => n + countItem(k), 0)));')
ed('if (P.cls === "mag" || countItem("mpot") > 0) circleBtn(potX + 6, ayc - pr * 2 - 14, pr, "mpot", () => act({ a: "mpot" }), hintOn ? "G" : "", String(countItem("mpot")));', 'if (P.cls === "mag" || countItem("mpot") + countItem("gmpot") > 0) circleBtn(potX + 6, ayc - pr * 2 - 14, pr, "mpot", () => act({ a: "mpot" }), hintOn ? "G" : "", String(countItem("mpot") + countItem("gmpot")));')
ed('Menu (☰) otwiera ekwipunek, rynek, gildię i ranking PvP."', 'Menu (☰) otwiera ekwipunek, gildię i ranking PvP. Przedmioty sprzedasz u handlarzy, a wystawisz u aukcjonerów w miastach."')
open('engine.ts', 'w').write(s)
print('r5 ok', len(Q), 'quests', len(MON), 'mobs', len(NPCS), 'npcs')
