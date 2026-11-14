# Round 4: level cap 60, high-level skills, three new towns + regions, new tiles and monsters.
s = open('engine.ts').read()
def ed(a, b, cnt=1):
    global s
    n = s.count(a)
    assert n == cnt, (a[:90], n)
    s = s.replace(a, b)

# ---- tiles: ash ground + lava
ed('RFLOOR = 33, PILLAR = 34;', 'RFLOOR = 33, PILLAR = 34, ASH = 35, LAVA = 36;')
ed('CACTUS, RUINW, PILLAR].forEach((v: number) => { BLOCK[v] = true; });', 'CACTUS, RUINW, PILLAR, LAVA].forEach((v: number) => { BLOCK[v] = true; });')
ed('  MINI[GRASS] = "#4b8d3b";', '  MINI[ASH] = "#3a3236"; MINI[LAVA] = "#e0541c";\n  MINI[GRASS] = "#4b8d3b";')
ed('''    else if (a.base === COBBLE) cobT(g, px, py, h);
    else grass''', '''    else if (a.base === COBBLE) cobT(g, px, py, h);
    else if (a.base === ASH) ashT(g, px, py, h);
    else grass''')
ed('  function baseOf(g: CanvasRenderingContext2D', '''  function ashT(g: CanvasRenderingContext2D, px: number, py: number, h: () => number): void {
    g.fillStyle = "#3a3236"; g.fillRect(px, py, TS, TS);
    for (let i = 0; i < 7; i++) { g.fillStyle = h() < 0.5 ? "#2c2629" : "#4a4044"; g.fillRect(px + Math.floor(h() * 29), py + Math.floor(h() * 29), 2 + Math.floor(h() * 3), 2); }
    if (h() < 0.18) { g.fillStyle = "rgba(255,110,40,0.55)"; g.fillRect(px + Math.floor(h() * 26), py + Math.floor(h() * 26), 4, 1); }
  }
  function baseOf(g: CanvasRenderingContext2D''')
ed('      case BOG: {', '''      case ASH: ashT(g, px, py, h); break;
      case LAVA: {
        g.fillStyle = "#c4380e"; g.fillRect(px, py, TS, TS);
        for (let i = 0; i < 5; i++) { g.fillStyle = h() < 0.5 ? "#ff8a1e" : "#ffcf4a"; g.beginPath(); g.ellipse(px + 4 + h() * 24, py + 4 + h() * 24, 2 + h() * 4, 1.5 + h() * 2, 0, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = "#2a2226";
        const land = (v: number): boolean => v !== LAVA && v !== -1;
        if (land(nb(0, -1))) g.fillRect(px, py, TS, 2);
        if (land(nb(0, 1))) g.fillRect(px, py + TS - 2, TS, 2);
        if (land(nb(-1, 0))) g.fillRect(px, py, 2, TS);
        if (land(nb(1, 0))) g.fillRect(px + TS - 2, py, 2, TS);
        break;
      }
      case BOG: {''')

# ---- new areas
GENS = r'''
  function genCity(id: string, name: string, seed: number, base: number, roofA: number, roofB: number, ex: string): Area {
    const a = mkArea(id, name, 36, 28, base, false, base);
    const r = mkRng(seed);
    if (base === GRASS) for (let i = 0; i < a.t.length; i++) if (r() < 0.05) a.t[i] = FLOWER;
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) if (Math.min(x, y, a.w - 1 - x, a.h - 1 - y) <= 1) st(a, x, y, SWALL);
    for (let x = 2; x < 34; x++) { st(a, x, 13, COBBLE); st(a, x, 14, COBBLE); }
    for (let y = 2; y < 26; y++) { st(a, 17, y, COBBLE); st(a, 18, y, COBBLE); }
    disc(17.5, 13.5, 3.6, (x: number, y: number) => st(a, x, y, COBBLE));
    st(a, 17, 13, FOUNT); st(a, 18, 13, FOUNT); st(a, 17, 14, FOUNT); st(a, 18, 14, FOUNT);
    houseT(a, 4, 3, 7, 6, roofA); houseT(a, 25, 3, 7, 6, roofB); houseT(a, 4, 18, 7, 5, roofB); houseT(a, 25, 18, 7, 5, roofA);
    for (let y = 9; y <= 12; y++) { st(a, 7, y, COBBLE); st(a, 28, y, COBBLE); }
    for (let x = 7; x <= 28; x++) st(a, x, 24, COBBLE);
    st(a, 7, 23, COBBLE); st(a, 28, 23, COBBLE); st(a, 7, 22, DOOR); st(a, 28, 22, DOOR);
    for (let y = 2; y < a.h - 2; y++) for (let x = 2; x < a.w - 2; x++) {
      const t = gt(a, x, y);
      if ((t === base || t === FLOWER) && r() < 0.045 && cheb(x, y, 17.5, 13.5) > 5 && (y < 11 || y > 16)) st(a, x, y, TREE);
    }
    if (ex.indexOf("w") >= 0) for (let y = 13; y <= 14; y++) { st(a, 0, y, COBBLE); st(a, 1, y, COBBLE); }
    if (ex.indexOf("e") >= 0) for (let y = 13; y <= 14; y++) { st(a, 34, y, COBBLE); st(a, 35, y, COBBLE); }
    if (ex.indexOf("n") >= 0) for (let x = 17; x <= 18; x++) { st(a, x, 0, COBBLE); st(a, x, 1, COBBLE); }
    if (ex.indexOf("s") >= 0) for (let x = 17; x <= 18; x++) { st(a, x, 26, COBBLE); st(a, x, 27, COBBLE); }
    return a;
  }
  function genPort(): Area {
    const a = genCity("port", "Mewia Przystań", 401, GRASS, ROOF, ROOF2, "we");
    for (let x = 2; x < 34; x++) { st(a, x, 26, WATER); st(a, x, 27, WATER); if (x !== 17 && x !== 18) st(a, x, 25, x % 5 === 0 ? FENCE : COBBLE); }
    for (let y = 25; y <= 27; y++) { st(a, 17, y, BRIDGE); st(a, 18, y, BRIDGE); }
    for (let y = 13; y <= 14; y++) { a.exits.push({ x: 0, y, to: "desert", tx: 50, ty: y - 6 }); a.exits.push({ x: 35, y, to: "coast", tx: 1, ty: y + 6 }); }
    return a;
  }
  function genCoast(): Area {
    const a = mkArea("coast", "Wybrzeże Wraków", 50, 40, SAND, false, SAND);
    const r = mkRng(411);
    for (let y = 0; y < a.h; y++) { const shore = 37 + Math.round(Math.sin(y * 0.35) * 2 + r() * 1.5); for (let x = shore; x < a.w; x++) st(a, x, y, WATER); }
    for (let i = 0; i < a.t.length; i++) { const q = r(); if (a.t[i] === SAND) { if (q < 0.035) a.t[i] = TREE; else if (q < 0.06) a.t[i] = ROCK; else if (q < 0.1) a.t[i] = DUNE; } }
    borderFill(a, r, [CLIFF, ROCK, TREE], 0.55);
    for (let y = 0; y < a.h; y++) for (let x = 36; x < a.w; x++) if (gt(a, x, y) === CLIFF || gt(a, x, y) === ROCK || gt(a, x, y) === TREE) { if (x > 39) st(a, x, y, WATER); }
    const clr = (x: number, y: number): void => { if (x > 0 && y > 0 && x < a.w - 1 && y < a.h - 1) { const t = gt(a, x, y); if (t === TREE || t === ROCK || t === CLIFF) st(a, x, y, SAND); } };
    disc(33, 8, 4.2, (x: number, y: number) => { if (x > 1 && y > 1 && x < 48) st(a, x, y, SAND); });
    const segs = [[0, 19, 12, 20], [12, 20, 24, 20], [24, 20, 24, 0], [24, 20, 30, 31], [12, 20, 10, 32], [24, 12, 33, 8]];
    for (const s0 of segs) line4(s0[0], s0[1], s0[2], s0[3], (x: number, y: number) => { disc(x, y, 1, clr); if (gt(a, x, y) !== WATER) st(a, x, y, PATH); });
    for (let y = 19; y <= 20; y++) { st(a, 0, y, PATH); st(a, 1, y, PATH); }
    for (let x = 24; x <= 25; x++) { st(a, x, 0, PATH); st(a, x, 1, PATH); }
    for (let i = 0; i < 6; i++) { const x = 6 + Math.floor(r() * 26), y = 4 + Math.floor(r() * 32); if (gt(a, x, y) === SAND) st(a, x, y, RUINW); }
    for (let y = 19; y <= 20; y++) a.exits.push({ x: 0, y, to: "port", tx: 34, ty: y - 6 });
    for (let x = 24; x <= 25; x++) a.exits.push({ x, y: 0, to: "fort", tx: x - 7, ty: 26 });
    spawnIn(a, r, 1, 19, [["crab", 9, (x: number, y: number) => x > 6], ["pirate", 8, (x: number, y: number) => y > 14], ["siren", 6, (x: number) => x > 22]], [[33, 8, 5], [24, 2, 4]]);
    a.spawns.push(["leviathan", 34, 7]);
    return a;
  }
  function genFort(): Area {
    const a = genCity("fort", "Twierdza Żarogród", 421, DGRASS, ROOF, ROOF, "wns");
    for (const p of [[14, 10], [21, 10], [14, 17], [21, 17]]) st(a, p[0], p[1], PILLAR);
    for (let y = 13; y <= 14; y++) a.exits.push({ x: 0, y, to: "volcano", tx: 48, ty: y + 6 });
    for (let x = 17; x <= 18; x++) { a.exits.push({ x, y: 27, to: "coast", tx: x + 7, ty: 1 }); a.exits.push({ x, y: 0, to: "citadel", tx: x, ty: 26 }); }
    return a;
  }
  function genVolcano(): Area {
    const a = mkArea("volcano", "Wulkan Ignara", 50, 40, ASH, false, ASH);
    const r = mkRng(431);
    for (let i = 0; i < 16; i++) disc(4 + r() * 42, 4 + r() * 32, 1.2 + r() * 2.6, (x: number, y: number) => st(a, x, y, LAVA));
    for (let i = 0; i < a.t.length; i++) { const q = r(); if (a.t[i] === ASH) { if (q < 0.05) a.t[i] = ROCK; else if (q < 0.08) a.t[i] = CLIFF; else if (q < 0.095) a.t[i] = DEADT; } }
    borderFill(a, r, [CLIFF, CLIFF, ROCK], 0.65);
    const clr = (x: number, y: number): void => { if (x > 0 && y > 0 && x < a.w - 1 && y < a.h - 1) { const t = gt(a, x, y); if (t === ROCK || t === CLIFF || t === DEADT || t === LAVA) st(a, x, y, ASH); } };
    disc(9, 8, 4.5, clr);
    disc(9, 8, 6.5, (x: number, y: number) => { if (cheb(x, y, 9, 8) >= 5 && gt(a, x, y) === ASH && r() < 0.5) st(a, x, y, LAVA); });
    const segs = [[49, 19, 36, 20], [36, 20, 24, 14], [24, 14, 12, 10], [36, 20, 30, 32], [24, 14, 22, 30], [30, 32, 14, 30], [12, 10, 9, 8]];
    for (const s0 of segs) line4(s0[0], s0[1], s0[2], s0[3], (x: number, y: number) => { disc(x, y, 1.2, clr); st(a, x, y, PATH); });
    for (let y = 19; y <= 20; y++) { st(a, 49, y, PATH); st(a, 48, y, PATH); }
    for (let y = 19; y <= 20; y++) a.exits.push({ x: 49, y, to: "fort", tx: 1, ty: y - 6 });
    spawnIn(a, r, 48, 19, [["imp", 9, (): boolean => true], ["salam", 8, (x: number, y: number) => x < 40], ["lgolem", 5, (x: number, y: number) => x < 30]], [[9, 8, 6], [44, 30, 3]]);
    a.spawns.push(["ignar", 9, 8]);
    return a;
  }
  function genCitadel(): Area {
    const a = genCity("citadel", "Cytadela Świtu", 441, COBBLE, ROOF2, ROOF2, "ws");
    for (const p of [[13, 9], [22, 9], [13, 18], [22, 18]]) st(a, p[0], p[1], PILLAR);
    for (let y = 13; y <= 14; y++) a.exits.push({ x: 0, y, to: "abyss", tx: 48, ty: y + 6 });
    for (let x = 17; x <= 18; x++) a.exits.push({ x, y: 27, to: "fort", tx: x, ty: 1 });
    return a;
  }
  function genAbyss(): Area {
    const a = mkArea("abyss", "Otchłań Zmierzchu", 50, 40, FLOOR, true, FLOOR);
    const r = mkRng(451);
    for (let i = 0; i < a.t.length; i++) { const q = r(); if (q < 0.1) a.t[i] = CWALL; else if (q < 0.125) a.t[i] = CRYSTAL; else if (q < 0.14) a.t[i] = DEADT; }
    borderFill(a, r, [CWALL, CWALL, CRYSTAL], 0.7);
    const clr = (x: number, y: number): void => { if (x > 0 && y > 0 && x < a.w - 1 && y < a.h - 1) { const t = gt(a, x, y); if (t === CWALL || t === CRYSTAL || t === DEADT) st(a, x, y, FLOOR); } };
    const cl = [[42, 20, 4], [30, 12, 4], [40, 8, 5], [18, 10, 4], [10, 22, 4], [20, 32, 4], [38, 32, 4], [28, 24, 3.5]];
    for (const c of cl) disc(c[0], c[1], c[2], clr);
    const segs = [[49, 19, 42, 20], [42, 20, 30, 12], [30, 12, 40, 8], [30, 12, 18, 10], [18, 10, 10, 22], [10, 22, 20, 32], [20, 32, 38, 32], [38, 32, 42, 20], [28, 24, 20, 32], [28, 24, 30, 12]];
    for (const s0 of segs) line4(s0[0], s0[1], s0[2], s0[3], (x: number, y: number) => { disc(x, y, 1.2, clr); st(a, x, y, PATH); });
    for (let y = 19; y <= 20; y++) { st(a, 49, y, PATH); st(a, 48, y, PATH); }
    for (let y = 19; y <= 20; y++) a.exits.push({ x: 49, y, to: "citadel", tx: 1, ty: y - 6 });
    spawnIn(a, r, 48, 19, [["shade", 9, (): boolean => true], ["voidb", 7, (x: number) => x < 40], ["dknight", 5, (x: number, y: number) => x < 32]], [[40, 8, 6], [38, 32, 3]]);
    a.spawns.push(["morgath", 40, 7]);
    return a;
  }
'''
ed('  const AREAS: { [k: string]: Area } = {};', GENS + '  const AREAS: { [k: string]: Area } = {};')
ed('genMount(), genDesert()].forEach', 'genMount(), genDesert(), genPort(), genCoast(), genFort(), genVolcano(), genCitadel(), genAbyss()].forEach')
# desert east road to the port
ed('''    st(a, 43, 23, RFLOOR);
    for (let y = 19; y <= 20; y++) a.exits.push({ x: 0, y, to: "town", tx: 38, ty: y - 4 });''',
'''    st(a, 43, 23, RFLOOR);
    for (const s0 of [[15, 15, 22, 8], [22, 8, 51, 8]]) line4(s0[0], s0[1], s0[2], s0[3], (x: number, y: number) => { disc(x, y, 1, clr); const t = gt(a, x, y); if (t !== RFLOOR && t !== WATER && t !== RUINW && t !== PILLAR) st(a, x, y, PATH); });
    for (let x = 48; x <= 51; x++) { st(a, x, 7, PATH); st(a, x, 8, PATH); }
    for (let y = 7; y <= 8; y++) a.exits.push({ x: 51, y, to: "port", tx: 1, ty: y + 6 });
    for (let y = 19; y <= 20; y++) a.exits.push({ x: 0, y, to: "town", tx: 38, ty: y - 4 });''')
ed('    desert: { lv: "Potwory poz. 18–26", amb: "sand", dark: 0, bg: "#9a7448", gx: 3, gy: 2 },', '''    desert: { lv: "Potwory poz. 18–26", amb: "sand", dark: 0, bg: "#9a7448", gx: 3, gy: 2 },
    port: { lv: "Bezpieczne miasto · poz. 26+", amb: "", dark: 0, bg: "#24343a", gx: 4, gy: 2 },
    coast: { lv: "Potwory poz. 27–36", amb: "", dark: 0, bg: "#7a6a48", gx: 5, gy: 2 },
    fort: { lv: "Bezpieczne miasto · poz. 36+", amb: "", dark: 0, bg: "#2a2622", gx: 5, gy: 1 },
    volcano: { lv: "Potwory poz. 37–48", amb: "", dark: 0.25, bg: "#1a1012", gx: 4, gy: 1 },
    citadel: { lv: "Bezpieczne miasto · poz. 46+", amb: "", dark: 0, bg: "#2a2a38", gx: 5, gy: 0 },
    abyss: { lv: "Potwory poz. 49–60", amb: "fog", dark: 0.6, bg: "#0b0812", gx: 4, gy: 0 },''')
ed('      const cw = iw / 4, ch = ih / 3;', '      const cw = iw / 6, ch = ih / 3;')

# ---- items
ed('    mpot: { n: "Mikstura many", t: "m", mana: 60, price: 15, c: "#3a7bff", ic: "pot" },', '''    mpot: { n: "Mikstura many", t: "m", mana: 60, price: 15, c: "#3a7bff", ic: "pot" },
    gpot: { n: "Wielka mikstura", t: "p", heal: 700, price: 160, c: "#ff7a3a", ic: "pot" },
    selix: { n: "Eliksir Świtu", t: "p", heal: 1500, price: 340, c: "#ffd84a", ic: "pot" },
    shell: { n: "Pancerz kraba", t: "j", price: 70, c: "#e0603a", ic: "scarab" },
    pearl: { n: "Perła syreny", t: "q", price: 80, c: "#e8f4ff", ic: "gem" },
    ember: { n: "Żarzący się rdzeń", t: "q", price: 110, c: "#ff7a2a", ic: "orb" },
    obsid: { n: "Odłamek obsydianu", t: "j", price: 130, c: "#6a4a8a", ic: "gem" },
    voids: { n: "Esencja pustki", t: "j", price: 200, c: "#9a5aff", ic: "orb" },
    crown: { n: "Korona Morgatha", t: "j", price: 3000, c: "#c58cff", ic: "relic" },''')
# ---- monsters
ed('''    king: { n: "Sethar, Król Cieni",''', '''    crab: { n: "Olbrzymi krab", lvl: 27, hp: 880, atk: 72, def: 33, xp: 880, gold: [30, 60], spd: 2.6, aggro: 4, cd: 1.4, resp: 32, as: "scorp", tint: "hue-rotate(150deg) saturate(1.6)", drops: [["shell", 0.5], ["elix", 0.08]] },
    pirate: { n: "Pirat z wraków", lvl: 30, hp: 1080, atk: 80, def: 36, xp: 1080, gold: [40, 80], spd: 3, aggro: 5, cd: 1.3, resp: 32, hum: { body: "#7a2a2a", skin: "#d8a880", hair: "#1a1a1a", eye: "#ff4040", beard: true }, hw: "#c9d1d9", drops: [["elix", 0.1], ["gpot", 0.04]] },
    siren: { n: "Syrena Mgieł", lvl: 33, hp: 1300, atk: 88, def: 38, xp: 1300, gold: [45, 90], spd: 3, aggro: 6, cd: 1.6, rng: 4, pc: "#7fe9ff", resp: 36, hum: { body: "#2a6a7a", skin: "#a8d8d0", hair: "#3ad8c8", eye: "#e0ffff", long: true, robe: true }, hw: "#7fe9ff", hwk: "staff", glow: "rgba(120,230,255,0.35)", drops: [["pearl", 0.5], ["gpot", 0.06]] },
    leviathan: { n: "Lewiatan Głębin", lvl: 36, hp: 7200, atk: 98, def: 42, xp: 11000, gold: [1800, 2600], spd: 2.4, aggro: 7, cd: 1.8, rng: 5, pc: "#7fffd0", resp: 240, boss: true, slam: 6, sc: 1.6, as: "dragon", tint: "hue-rotate(-50deg) saturate(1.8)", drops: [["gpot", 1], ["relic", 1], ["shell", 1]] },
    imp: { n: "Ognisty chochlik", lvl: 38, hp: 1600, atk: 100, def: 44, xp: 1700, gold: [50, 100], spd: 3.4, aggro: 6, cd: 1.5, rng: 4, pc: "#ff8a3a", resp: 32, sc: 0.85, hum: { body: "#7a1a0a", skin: "#e8402a", hair: "#2a0a0a", eye: "#ffe04a", hood: true }, hw: "#ff8a3a", hwk: "staff", glow: "rgba(255,120,40,0.4)", drops: [["ember", 0.45], ["gpot", 0.06]] },
    salam: { n: "Salamandra magmy", lvl: 41, hp: 2000, atk: 108, def: 48, xp: 2000, gold: [55, 110], spd: 3.2, aggro: 5, cd: 1.3, resp: 34, as: "scorp", tint: "hue-rotate(-40deg) saturate(2.4)", drops: [["ember", 0.5], ["obsid", 0.2]] },
    lgolem: { n: "Lawowy golem", lvl: 44, hp: 2900, atk: 117, def: 56, xp: 2600, gold: [70, 130], spd: 2.1, aggro: 4, cd: 1.7, resp: 40, sc: 1.35, as: "golem", tint: "sepia(1) saturate(4) hue-rotate(-25deg)", drops: [["obsid", 0.5], ["selix", 0.04]] },
    ignar: { n: "Ignar, Władca Magmy", lvl: 48, hp: 14000, atk: 128, def: 58, xp: 26000, gold: [3000, 4200], spd: 2.4, aggro: 7, cd: 1.6, rng: 5, pc: "#ff7a2a", resp: 300, boss: true, slam: 5, sc: 1.5, hum: { body: "#5a1a0a", skin: "#e8603a", hair: "#ffb347", eye: "#fff06a", robe: true, crown: true }, hw: "#ff7a2a", hwk: "staff", glow: "rgba(255,120,40,0.45)", drops: [["selix", 1], ["obsid", 1], ["relic", 1]] },
    shade: { n: "Cień Otchłani", lvl: 50, hp: 3000, atk: 132, def: 60, xp: 3000, gold: [80, 150], spd: 3, aggro: 6, cd: 1.5, resp: 34, as: "boss", sc: 0.85, tint: "hue-rotate(60deg) saturate(1.5) brightness(0.8)", drops: [["voids", 0.4], ["selix", 0.05]] },
    voidb: { n: "Bestia Pustki", lvl: 53, hp: 3500, atk: 140, def: 64, xp: 3400, gold: [90, 170], spd: 2.8, aggro: 4, cd: 1.5, resp: 38, sc: 1.35, as: "yeti", tint: "hue-rotate(230deg) saturate(2) brightness(0.65)", drops: [["voids", 0.5], ["selix", 0.06]] },
    dknight: { n: "Rycerz Otchłani", lvl: 56, hp: 3900, atk: 148, def: 70, xp: 3800, gold: [100, 190], spd: 2.6, aggro: 5, cd: 1.4, resp: 40, hum: { body: "#2a2236", skin: "#5a4a6a", hair: "#1a1022", eye: "#c58cff", helmet: true }, hw: "#8a5aff", drops: [["voids", 0.5], ["selix", 0.08]] },
    morgath: { n: "Morgath, Pan Otchłani", lvl: 60, hp: 24000, atk: 168, def: 76, xp: 50000, gold: [6000, 8000], spd: 2.4, aggro: 7, cd: 1.6, rng: 5, pc: "#c58cff", resp: 360, boss: true, slam: 5, sc: 1.6, hum: { body: "#1a0a2a", skin: "#8a7aa8", hair: "#0a0012", eye: "#ff4fd8", robe: true, crown: true }, hw: "#c58cff", hwk: "staff", glow: "rgba(197,140,255,0.5)", drops: [["crown", 1], ["selix", 1], ["voids", 1]] },
    king: { n: "Sethar, Król Cieni",''')
ed('const LIGHTB = ["skel", "boss", "wisp", "ielem", "golem", "mummy", "king", "dragon"];', 'const LIGHTB = ["skel", "boss", "wisp", "ielem", "golem", "mummy", "king", "dragon", "siren", "imp", "lgolem", "ignar", "shade", "morgath"];')

# ---- drawMob: alias kinds, custom humanoids, tint
ed('    const g = ctx; const k = m.k; const flash = m.hit > 0;', '    const g = ctx; const k = m.d.as || m.k; const flash = m.hit > 0;\n    const tint = m.d.tint && "filter" in g ? m.d.tint : ""; if (tint) g.filter = tint;')
ed('    if (k === "goblin") drawHuman(x, y, m.dir, walk, { body: "#5a4a2a"', '''    if (m.d.hum) {
      if (m.d.glow) glow(x + 16, y + 14, 32, m.d.glow);
      drawHuman(x, y + (m.d.boss ? -3 + Math.sin(time * 2.2) * 2 : 0), m.dir, m.d.boss ? 0 : walk, m.d.hum, m.d.hw || null, null, flash, 0, m.d.hwk);
    } else if (k === "goblin") drawHuman(x, y, m.dir, walk, { body: "#5a4a2a"''')
ed('    if (sc !== 1) { g.restore(); x = bx0; y = by0; }\n    const tgt = pl.target === m', '    if (sc !== 1) { g.restore(); x = bx0; y = by0; }\n    if (tint) g.filter = "none";\n    const tgt = pl.target === m')

# ---- NPCs, shops, quests
NPCS = '''
    portcap: { n: "Kapitan portu Rogwold", area: "port", x: 21, y: 11, c: { body: "#2a3a6a", skin: "#e0b48a", hair: "#5a3a1a", beard: true }, talk: "Mewia Przystań to brama na wschód. Na Wybrzeżu Wraków grasują piraci, a w głębinach śpi Lewiatan." },
    portm: { n: "Kupiec Wit", area: "port", x: 9, y: 12, c: { body: "#6a5a2a", skin: "#f0c9a0", hair: "#8a5a2a" }, shop: "portm", talk: "Towary z całego morza! Mikstury na każdą kieszeń." },
    portsmith: { n: "Kowal okrętowy Sambor", area: "port", x: 26, y: 12, c: { body: "#3a2a1a", skin: "#dfb088", hair: "#1a1a1a", apron: true }, shop: "portsmith", talk: "Stal hartowana w morskiej wodzie. Mogę też wykuć coś na twój poziom." },
    portalch: { n: "Alchemiczka Morwena", area: "port", x: 9, y: 15, c: { body: "#2a6a6a", skin: "#f2cfa8", hair: "#e8e8e8", long: true }, shop: "portm", talk: "Perły syren mają w sobie magię morza. Przynieś mi kilka, a zobaczysz." },
    latarnik: { n: "Latarnik Ziemowit", area: "port", x: 14, y: 16, c: { body: "#5a5a6a", skin: "#e0b890", hair: "#cfcfcf", beard: true }, talk: "Z mojej latarni widzę wszystko. Także cień czegoś ogromnego pod falami." },
    portpriest: { n: "Kapłan Bryzy", area: "port", x: 26, y: 15, c: { body: "#e8e0d0", skin: "#e8bf98", hair: "#3a2a1a" }, heal: "Poproś o błogosławieństwo", talk: "Niech morze będzie ci łaskawe." },
    fortcap: { n: "Komendant Żelisław", area: "fort", x: 21, y: 11, c: { body: "#7a2a1a", skin: "#e8bf98", hair: "#2a1a10", helmet: true }, talk: "Żarogród broni drogi na północ. Z wulkanu na zachodzie schodzi ognista plaga." },
    fortm: { n: "Kwatermistrz Bolko", area: "fort", x: 9, y: 12, c: { body: "#5a4a2a", skin: "#f0c9a0", hair: "#5a3a1a" }, shop: "fortm", talk: "Zaopatrzenie dla obrońców i śmiałków. Płacisz złotem, dostajesz życie." },
    fortsmith: { n: "Płatnerz Radogost", area: "fort", x: 26, y: 12, c: { body: "#2a2a2a", skin: "#dfb088", hair: "#7a2a1a", apron: true }, shop: "portsmith", talk: "Ogień wulkanu daje najlepszy żar do kucia. Przynieś rudę, a wykuję ci coś godnego." },
    fortalch: { n: "Alchemik Żar", area: "fort", x: 9, y: 15, c: { body: "#7a3a1a", skin: "#e0b48a", hair: "#ffb347" }, shop: "fortm", talk: "Rdzenie salamander płoną latami. Idealne do moich eliksirów." },
    kronikarka: { n: "Kronikarka Jarosława", area: "fort", x: 14, y: 16, c: { body: "#3a4a6a", skin: "#f2cfa8", hair: "#a0522d", long: true }, talk: "Ignar był kiedyś kowalem. Ogień go pochłonął i przemienił w coś strasznego." },
    fortpriest: { n: "Brat Ogniomir", area: "fort", x: 26, y: 15, c: { body: "#8a5a2a", skin: "#e0b890", hair: "#5a3a2a" }, heal: "Odpocznij w kaplicy", talk: "Odpocznij, zanim wejdziesz w żar." },
    citcap: { n: "Paladynka Świetlana", area: "citadel", x: 21, y: 11, c: { body: "#e8d8a0", skin: "#f2cfa8", hair: "#ffd84a", helmet: true }, talk: "Cytadela Świtu to ostatni bastion przed Otchłanią. Za zachodnią bramą zaczyna się mrok." },
    citm: { n: "Handlarz Świtu", area: "citadel", x: 9, y: 12, c: { body: "#5a3a7a", skin: "#f0c9a0", hair: "#2a1a10" }, shop: "citm", talk: "Najlepsze eliksiry w Ardanie. Drogie, bo Otchłań nie wybacza." },
    citsmith: { n: "Mistrz kuźni Światosław", area: "citadel", x: 26, y: 12, c: { body: "#3a3a4a", skin: "#dfb088", hair: "#e8e8e8", apron: true, beard: true }, shop: "portsmith", talk: "Wykuwam ekwipunek dla bohaterów. Pokaż, co masz w torbie." },
    citalch: { n: "Arcymagini Lumena", area: "citadel", x: 9, y: 15, c: { body: "#2a3a7a", skin: "#f2cfa8", hair: "#d8d8e8", long: true }, shop: "citm", talk: "Esencja pustki jest groźna, ale w dobrych rękach leczy rany, których nic innego nie uleczy." },
    wieszcz: { n: "Wieszcz Dobromir", area: "citadel", x: 14, y: 16, c: { body: "#4a3a6a", skin: "#e0b890", hair: "#bbbbbb", beard: true }, talk: "Morgath czeka w sercu Otchłani. Widziałem w snach jego koronę." },
    citpriest: { n: "Kapłanka Jutrzenka", area: "citadel", x: 26, y: 15, c: { body: "#f0e8d8", skin: "#f2cfa8", hair: "#c87a3a", long: true }, heal: "Poproś o światło świtu", talk: "Światło świtu wyleczy każdą ranę." },
  };'''
ed('''    nomada: { n: "Nomada Kazimir", area: "desert", x: 16, y: 13, c: { body: "#c8a060", skin: "#c89068", hair: "#2a1a10" }, shop: "nomad", talk: "Woda z oazy jest słodka, ale ruiny na wschodzie pełne są martwych. Handluję tym, co przetrwa upał." },
  };''', '''    nomada: { n: "Nomada Kazimir", area: "desert", x: 16, y: 13, c: { body: "#c8a060", skin: "#c89068", hair: "#2a1a10" }, shop: "nomad", talk: "Woda z oazy jest słodka, ale ruiny na wschodzie pełne są martwych. Handluję tym, co przetrwa upał. Na północnym wschodzie droga wiedzie do portu." },''' + NPCS)
ed('''{ area: "desert", x: 14, y: 15, k: "fire" }];''', '''{ area: "desert", x: 14, y: 15, k: "fire" },
    { area: "port", x: 16, y: 2, k: "banner" }, { area: "port", x: 19, y: 2, k: "banner" }, { area: "port", x: 12, y: 11, k: "crate" }, { area: "port", x: 23, y: 16, k: "barrel" }, { area: "port", x: 15, y: 23, k: "lamp" }, { area: "port", x: 20, y: 23, k: "lamp" },
    { area: "fort", x: 16, y: 2, k: "banner" }, { area: "fort", x: 19, y: 2, k: "banner" }, { area: "fort", x: 2, y: 12, k: "banner" }, { area: "fort", x: 2, y: 15, k: "banner" }, { area: "fort", x: 12, y: 16, k: "fire" },
    { area: "citadel", x: 16, y: 2, k: "banner" }, { area: "citadel", x: 19, y: 2, k: "banner" }, { area: "citadel", x: 2, y: 12, k: "banner" }, { area: "citadel", x: 2, y: 15, k: "banner" }, { area: "citadel", x: 12, y: 11, k: "shrine" },
    { area: "coast", x: 12, y: 18, k: "tent" }, { area: "coast", x: 13, y: 22, k: "fire" }, { area: "volcano", x: 44, y: 30, k: "shrine" }, { area: "abyss", x: 38, y: 32, k: "lamp" }, { area: "abyss", x: 42, y: 22, k: "lamp" }];''')
ed('nomad: "Kram Nomady" };', 'nomad: "Kram Nomady", portm: "Kram Mewiej Przystani", portsmith: "Kuźnia mistrzów", fortm: "Zaopatrzenie Żarogrodu", citm: "Skarbiec Świtu" };')
ed('nomad: ["bigpot", "elix", "mpot"] };', 'nomad: ["bigpot", "elix", "mpot"], portm: ["bigpot", "elix", "gpot", "mpot"], portsmith: ["$w5", "$w6", "$a5", "$a6"], fortm: ["elix", "gpot", "selix", "mpot"], citm: ["gpot", "selix", "mpot"] };')
ed('"mummies", "kingq"];', '"mummies", "kingq", "crabs", "pirates", "pearls", "leviq", "imps", "embers", "golemsq", "ignarq", "shades", "voidq", "knights", "morgq"];')
QUESTS = '''
    crabs: { n: "Kleszcze na plaży", giver: "portcap", lvl: 26, kill: "crab", need: 8, area: "coast", desc: "Ubij 8 olbrzymich krabów na Wybrzeżu Wraków (wschodnia brama portu).",
      offer: "Kraby rozbijają łodzie rybaków. Ubij 8 z nich na Wybrzeżu Wraków.", lock: "Wybrzeże jest groźne. Wróć na 26. poziomie.",
      mid: "Krabów ubitych: {c}/{n}.", thx: "Rybacy znów wypływają! Bierz zapłatę.", rew: { xp: 9000, gold: 700, items: [["gpot", 3]] } },
    pirates: { n: "Piraci z wraków", giver: "portcap", req: "crabs", lvl: 28, kill: "pirate", need: 8, area: "coast", desc: "Ubij 8 piratów na Wybrzeżu Wraków.",
      offer: "Piraci plądrują wraki i napadają kupców. Rozpraw się z ośmioma.", lock: "Piraci nie żartują. Wróć na 28. poziomie.",
      mid: "Piratów pokonanych: {c}/{n}.", thx: "Szlak morski znów jest bezpieczny.", rew: { xp: 14000, gold: 900, items: [["gpot", 2], ["elix", 3]] } },
    pearls: { n: "Perły syren", giver: "portalch", lvl: 31, item: "pearl", src: "siren", need: 5, area: "coast", desc: "Przynieś Morwenie 5 pereł syren z Wybrzeża Wraków.",
      offer: "Syreny noszą perły pełne magii morza. Przynieś mi pięć.", lock: "Śpiew syren zgubi słabego. Wróć na 31. poziomie.",
      mid: "Masz {c}/{n} pereł.", thx: "Piękne! Uwarzę z nich eliksiry. Część jest dla ciebie.", rew: { xp: 18000, gold: 1100, items: [["gpot", 4]] } },
    leviq: { n: "Lewiatan Głębin", giver: "latarnik", req: "pirates", lvl: 33, kill: "leviathan", need: 1, area: "coast", desc: "Pokonaj Lewiatana w zatoce na północnym wschodzie Wybrzeża Wraków.",
      offer: "Coś ogromnego wynurza się nocą w zatoce. To Lewiatan Głębin. Pokonaj go.", lock: "Lewiatan zmiażdży cię jednym ruchem. Wróć na 33. poziomie.",
      mid: "Lewiatan wciąż czai się w zatoce.", thx: "Morze jest spokojne pierwszy raz od lat! Weź tę relikwię.", rew: { xp: 32000, gold: 2500, items: [["relic", 2], ["gpot", 3]] } },
    imps: { n: "Ognista plaga", giver: "fortcap", lvl: 36, kill: "imp", need: 10, area: "volcano", desc: "Ubij 10 ognistych chochlików w Wulkanie Ignara (zachodnia brama twierdzy).",
      offer: "Chochliki podpalają nasze magazyny. Ubij dziesięć.", lock: "Wulkan to piekło. Wróć na 36. poziomie.",
      mid: "Chochlików ubitych: {c}/{n}.", thx: "Magazyny ocalały. Dzięki, śmiałku.", rew: { xp: 26000, gold: 1500, items: [["gpot", 3]] } },
    embers: { n: "Żar dla kuźni", giver: "fortalch", lvl: 39, item: "ember", src: "salam", need: 6, area: "volcano", desc: "Przynieś 6 żarzących się rdzeni od salamander magmy.",
      offer: "Rdzenie salamander dają żar, który nie gaśnie. Przynieś mi sześć.", lock: "Salamandry spalą cię żywcem. Wróć na 39. poziomie.",
      mid: "Masz {c}/{n} rdzeni.", thx: "Wspaniały żar! Masz, eliksiry na drogę.", rew: { xp: 32000, gold: 1800, items: [["selix", 2]] } },
    golemsq: { n: "Lawowe kolosy", giver: "kronikarka", lvl: 41, kill: "lgolem", need: 6, area: "volcano", desc: "Rozbij 6 lawowych golemów w zachodniej części wulkanu.",
      offer: "Lawowe golemy strzegą drogi do Ignara. Rozbij sześć, a otworzysz szlak.", lock: "Golemy są twarde jak skała. Wróć na 41. poziomie.",
      mid: "Golemów rozbitych: {c}/{n}.", thx: "Droga do Ignara stoi otworem.", rew: { xp: 40000, gold: 2200, items: [["selix", 2], ["obsid", 2]] } },
    ignarq: { n: "Władca Magmy", giver: "fortcap", req: "golemsq", lvl: 44, kill: "ignar", need: 1, area: "volcano", desc: "Pokonaj Ignara, Władcę Magmy, w kraterze na północnym zachodzie wulkanu.",
      offer: "Ignar prowadzi ognistą plagę. Zgaś jego płomień raz na zawsze.", lock: "Ignar spopieli cię w mig. Wróć na 44. poziomie.",
      mid: "Ignar wciąż płonie w kraterze.", thx: "Ogień zgasł! Żarogród zapamięta twoje imię.", rew: { xp: 70000, gold: 5000, items: [["relic", 3], ["selix", 3]] } },
    shades: { n: "Cienie u bram", giver: "citcap", lvl: 46, kill: "shade", need: 10, area: "abyss", desc: "Ubij 10 cieni w Otchłani Zmierzchu (zachodnia brama Cytadeli).",
      offer: "Cienie Otchłani podchodzą pod mury. Rozprosz dziesięć.", lock: "Otchłań pożera słabych. Wróć na 46. poziomie.",
      mid: "Cieni rozproszonych: {c}/{n}.", thx: "Mury Cytadeli znów są bezpieczne.", rew: { xp: 48000, gold: 2600, items: [["selix", 3]] } },
    voidq: { n: "Bestie Pustki", giver: "citalch", lvl: 50, kill: "voidb", need: 8, area: "abyss", desc: "Ubij 8 bestii pustki w Otchłani Zmierzchu.",
      offer: "Bestie pustki wysysają światło. Ubij osiem, a uwarzę z ich esencji coś potężnego.", lock: "Bestie pustki są śmiertelne. Wróć na 50. poziomie.",
      mid: "Bestii ubitych: {c}/{n}.", thx: "Esencja jest moja, a eliksiry twoje.", rew: { xp: 60000, gold: 3200, items: [["selix", 4]] } },
    knights: { n: "Upadli rycerze", giver: "wieszcz", lvl: 53, kill: "dknight", need: 6, area: "abyss", desc: "Pokonaj 6 Rycerzy Otchłani w zachodniej części krainy.",
      offer: "Rycerze Otchłani byli kiedyś strażnikami Cytadeli. Uwolnij sześć dusz.", lock: "Ich ostrza tną jak mrok. Wróć na 53. poziomie.",
      mid: "Rycerzy pokonanych: {c}/{n}.", thx: "Ich dusze są wolne. Teraz został tylko on.", rew: { xp: 75000, gold: 4000, items: [["selix", 3], ["voids", 2]] } },
    morgq: { n: "Pan Otchłani", giver: "citcap", req: "knights", lvl: 56, kill: "morgath", need: 1, area: "abyss", desc: "Pokonaj Morgatha, Pana Otchłani, w sercu krainy na północy.",
      offer: "Morgath, Pan Otchłani, to źródło całego mroku. Pokonaj go, a Ardan zazna prawdziwego świtu.", lock: "Morgath to najpotężniejsza istota Ardanu. Wróć na 56. poziomie.",
      mid: "Morgath wciąż czeka w sercu Otchłani.", thx: "Świt nad Ardanem! Jesteś największym bohaterem tej krainy.", rew: { xp: 120000, gold: 10000, items: [["relic", 5], ["selix", 5]] } },
  };

  // ---------- CLASSES ----------'''
ed('''  };

  // ---------- CLASSES ----------''', QUESTS)

# ---- levels + high-level skills
ed('  const MAXLVL = 30;', '''  const MAXLVL = 60;
  const SKX: { [k: string]: any[] } = {
    war: [
      { n: "Szarża tytana", lvl: 15, cost: 45, cd: 3, ic: "smash", d: "Cios za 300% obrażeń, ogłusza (bossa rzadziej)." },
      { n: "Krwawy wir", lvl: 30, cost: 55, cd: 4, ic: "whirl", d: "Rani wszystkich wrogów za 200% i wywołuje krwawienie." },
      { n: "Gniew bogów", lvl: 45, cost: 70, cd: 6, ic: "shout", d: "Cios za 350%, leczy 30% życia i wzmacnia obronę." }],
    arc: [
      { n: "Strzała przebijająca", lvl: 15, cost: 40, cd: 3, ic: "aim", d: "Przebija wszystkich wrogów, każdy dostaje 190%." },
      { n: "Salwa burzy", lvl: 30, cost: 55, cd: 4, ic: "rain", d: "5 strzał w losowe cele, każda za 130%." },
      { n: "Strzała zagłady", lvl: 45, cost: 70, cd: 6, ic: "eye", d: "Pewny cios krytyczny za 420% obrażeń." }],
    mag: [
      { n: "Łańcuch błyskawic", lvl: 15, cost: 40, cd: 3, ic: "frost", d: "Błyskawica skacze po wszystkich wrogach (190%)." },
      { n: "Meteor", lvl: 30, cost: 60, cd: 4, ic: "fire", d: "Meteor za 380% w cel i 150% w pozostałych, podpala." },
      { n: "Zatrzymanie czasu", lvl: 45, cost: 75, cd: 6, ic: "frost", d: "Zamraża wrogów (poza bossami), rani za 220% i leczy 35%." }],
  };''')
ed('for (const s of SK[P.cls] || []) if (s.lvl === P.lvl)', 'for (const s of (SK[P.cls] || []).concat(SKX[P.cls] || [])) if (s.lvl === P.lvl)')
ed('sk: SK, cls: CLS, zones: PVPZ, pvpAt, npcs: NPCS, areas: AREAS,', 'sk: SK, skx: SKX, cls: CLS, zones: PVPZ, pvpAt, npcs: NPCS, areas: AREAS, ainfo: AINFO,')
ed('sk: SK, cls: CLS, zones: PVPZ, pvpAt, others: (): any => others, gearIds: GEAR, npcs: NPCS,', 'sk: SK, skx: SKX, cls: CLS, zones: PVPZ, pvpAt, others: (): any => others, gearIds: GEAR, npcs: NPCS, ainfo: AINFO,')
open('engine.ts', 'w').write(s)
print('r4 ok')
s = open('engine.ts').read()
ed('  const xpNext = (l: number): number => Math.floor(40 * Math.pow(l, 1.65));', '  const xpNext = (l: number): number => Math.floor(40 * Math.pow(l, 1.65) * (l > 30 ? 1 + (l - 30) * 0.04 : 1));')
open('engine.ts', 'w').write(s)
