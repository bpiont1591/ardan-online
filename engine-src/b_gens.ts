  function houseT(a: Area, x: number, y: number, w: number, h: number, roof: number): void {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) st(a, xx, yy, yy < y + h - 2 ? roof : WALL);
    st(a, x + Math.floor(w / 2), y + h - 1, DOOR);
  }
  function borderFill(a: Area, r: () => number, tiles: number[], p2: number): void {
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
      const e = Math.min(x, y, a.w - 1 - x, a.h - 1 - y);
      if (e <= 1 || (e === 2 && r() < p2)) st(a, x, y, tiles[Math.floor(r() * tiles.length)]);
    }
  }
  function spawnIn(a: Area, r: () => number, ex: number, ey: number, specs: any[], avoid: number[][]): void {
    const seen = reach(a, ex, ey); const cand: number[][] = [];
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
      const t = gt(a, x, y);
      if (!seen[y * a.w + x] || t === PATH || t === BRIDGE || BLOCK[t]) continue;
      if (Math.abs(x - ex) + Math.abs(y - ey) <= 9) continue;
      if (avoid.some((v: number[]) => cheb(x, y, v[0], v[1]) <= v[2])) continue;
      cand.push([x, y]);
    }
    const used: number[][] = [];
    for (const sp of specs) {
      let n = sp[1], tries = 0;
      while (n > 0 && tries++ < 4000 && cand.length) {
        const c = cand[Math.floor(r() * cand.length)];
        if (!sp[2](c[0], c[1])) continue;
        if (used.some((u: number[]) => cheb(u[0], u[1], c[0], c[1]) < 3)) continue;
        used.push(c); a.spawns.push([sp[0], c[0], c[1]]); n--;
      }
    }
  }
  function genSwamp(): Area {
    const a = mkArea("swamp", "Bagna Żałoby", 48, 40, MUD, false, MUD);
    const r = mkRng(51);
    for (let i = 0; i < a.t.length; i++) if (r() < 0.1) a.t[i] = REED;
    for (let i = 0; i < 26; i++) disc(3 + r() * 42, 3 + r() * 34, 1.5 + r() * 2.8, (x: number, y: number) => st(a, x, y, BOG));
    for (let i = 0; i < a.t.length; i++) if (a.t[i] !== BOG && r() < 0.09) a.t[i] = DEADT;
    borderFill(a, r, [DEADT, BOG, DEADT], 0.6);
    const isl = [[23, 5, 3.2], [13, 15, 3.5], [15, 27, 3.5], [27, 30, 3], [37, 22, 3.5], [37, 32, 4.5], [8, 34, 3], [33, 10, 3.5], [43, 12, 2.5]];
    for (const c of isl) disc(c[0], c[1], c[2], (x: number, y: number) => { if (x > 1 && y > 1 && x < a.w - 2 && y < a.h - 2) st(a, x, y, r() < 0.15 ? REED : MUD); });
    const clr = (x: number, y: number): void => { if (x > 0 && y > 0 && x < a.w - 1 && y < a.h - 1) { const t = gt(a, x, y); if (t === DEADT || t === REED) st(a, x, y, MUD); } };
    const segs = [[23, 0, 23, 6], [23, 6, 13, 15], [13, 15, 15, 27], [15, 27, 27, 30], [27, 30, 37, 22], [37, 22, 47, 20], [27, 30, 37, 32],
      [15, 27, 8, 34], [23, 6, 33, 10], [33, 10, 43, 12], [43, 12, 37, 22]];
    for (const s of segs) line4(s[0], s[1], s[2], s[3], (x: number, y: number) => { disc(x, y, 1, clr); const t = gt(a, x, y); st(a, x, y, t === BOG || t === WATER ? BRIDGE : PATH); });
    for (let x = 22; x <= 24; x++) { st(a, x, 0, PATH); st(a, x, 1, PATH); }
    for (let y = 19; y <= 21; y++) { st(a, 46, y, PATH); st(a, 47, y, PATH); }
    houseT(a, 17, 1, 5, 4, ROOF);
    for (let x = 19; x <= 22; x++) st(a, x, 5, PATH);
    houseT(a, 38, 28, 4, 3, ROOF);
    st(a, 37, 33, MUD);
    for (let x = 22; x <= 24; x++) a.exits.push({ x, y: 0, to: "forest", tx: x - 1, ty: 38 });
    for (let y = 19; y <= 21; y++) a.exits.push({ x: 47, y, to: "town", tx: 1, ty: y === 19 ? 15 : 16 });
    spawnIn(a, r, 23, 1, [["drowner", 8, (): boolean => true], ["wisp", 6, (x: number, y: number) => y > 12], ["troll", 5, (x: number, y: number) => x > 18 && y > 14]], [[25, 6, 5], [37, 33, 4]]);
    a.spawns.push(["witch", 37, 33]);
    return a;
  }
  function genTown(): Area {
    const a = mkArea("town", "Srebrnogród", 40, 32, GRASS, false, GRASS);
    const r = mkRng(63);
    for (let i = 0; i < a.t.length; i++) if (r() < 0.06) a.t[i] = FLOWER;
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) if (Math.min(x, y, a.w - 1 - x, a.h - 1 - y) <= 1) st(a, x, y, SWALL);
    for (let x = 0; x < 40; x++) { st(a, x, 15, COBBLE); st(a, x, 16, COBBLE); }
    for (let y = 0; y < 30; y++) { st(a, 19, y, COBBLE); st(a, 20, y, COBBLE); }
    disc(19.5, 15.5, 4.2, (x: number, y: number) => st(a, x, y, COBBLE));
    st(a, 19, 15, FOUNT); st(a, 20, 15, FOUNT); st(a, 19, 16, FOUNT); st(a, 20, 16, FOUNT);
    houseT(a, 4, 3, 7, 6, ROOF2); houseT(a, 27, 3, 8, 6, ROOF2); houseT(a, 4, 21, 7, 6, ROOF2); houseT(a, 28, 21, 7, 6, ROOF2); houseT(a, 12, 3, 5, 5, ROOF);
    for (let y = 9; y <= 14; y++) { st(a, 7, y, COBBLE); st(a, 31, y, COBBLE); }
    for (let y = 8; y <= 14; y++) st(a, 14, y, COBBLE);
    for (let y = 27; y <= 28; y++) { st(a, 7, y, COBBLE); st(a, 31, y, COBBLE); }
    for (let x = 7; x <= 31; x++) st(a, x, 28, COBBLE);
    for (let y = 2; y < a.h - 2; y++) for (let x = 2; x < a.w - 2; x++) {
      const t = gt(a, x, y);
      if ((t === GRASS || t === FLOWER) && r() < 0.05 && cheb(x, y, 19.5, 15.5) > 6) st(a, x, y, TREE);
    }
    for (let x = 0; x <= 1; x++) { st(a, x, 15, COBBLE); st(a, x, 16, COBBLE); st(a, 39 - x, 15, COBBLE); st(a, 39 - x, 16, COBBLE); }
    for (let y = 15; y <= 16; y++) { a.exits.push({ x: 0, y, to: "swamp", tx: 46, ty: y + 5 }); a.exits.push({ x: 39, y, to: "desert", tx: 1, ty: y + 4 }); }
    a.exits.push({ x: 19, y: 0, to: "mount", tx: 24, ty: 38 }, { x: 20, y: 0, to: "mount", tx: 25, ty: 38 });
    return a;
  }
  function genMount(): Area {
    const a = mkArea("mount", "Szczyty Szronu", 50, 40, SNOW, false, SNOW);
    const r = mkRng(77);
    for (let i = 0; i < a.t.length; i++) { const q = r(); if (q < 0.27) a.t[i] = SPINE; else if (q < 0.33) a.t[i] = CLIFF; }
    borderFill(a, r, [CLIFF, SPINE, CLIFF], 0.7);
    const clr = (x: number, y: number): void => { if (x > 0 && y > 0 && x < a.w - 1 && y < a.h - 1) { const t = gt(a, x, y); if (t === SPINE || t === CLIFF) st(a, x, y, SNOW); } };
    const cl = [[25, 33, 4], [12, 24, 4], [18, 12, 4], [30, 9, 3.5], [40, 16, 4], [38, 28, 4], [42, 6, 5.2], [8, 8, 3], [12, 32, 4.5]];
    for (const c of cl) disc(c[0], c[1], c[2], clr);
    disc(12.5, 32.5, 3.2, (x: number, y: number) => st(a, x, y, ICE));
    disc(34, 20, 2.2, (x: number, y: number) => st(a, x, y, ICE));
    const segs = [[24, 39, 25, 33], [25, 33, 12, 24], [12, 24, 18, 12], [18, 12, 30, 9], [30, 9, 40, 16], [40, 16, 38, 28], [38, 28, 25, 33], [30, 9, 42, 6], [18, 12, 8, 8], [12, 24, 12, 30]];
    for (const s of segs) line4(s[0], s[1], s[2], s[3], (x: number, y: number) => { disc(x, y, 1.2, clr); if (gt(a, x, y) !== ICE) st(a, x, y, PATH); });
    for (let y = 37; y <= 39; y++) { st(a, 24, y, PATH); st(a, 25, y, PATH); }
    houseT(a, 27, 34, 5, 4, ROOF);
    st(a, 42, 5, SNOW);
    for (let x = 24; x <= 25; x++) a.exits.push({ x, y: 39, to: "town", tx: x - 5, ty: 1 });
    spawnIn(a, r, 24, 38, [["swolf", 8, (x: number, y: number) => y > 16], ["ielem", 6, (x: number, y: number) => y < 26], ["yeti", 5, (x: number, y: number) => x > 26 || y < 14]], [[29, 33, 6], [42, 5, 5]]);
    a.spawns.push(["dragon", 42, 5]);
    return a;
  }
  function genDesert(): Area {
    const a = mkArea("desert", "Ruiny Piasków", 52, 40, SAND, false, SAND);
    const r = mkRng(91);
    for (let i = 0; i < 34; i++) disc(r() * 52, r() * 40, 1.5 + r() * 2.5, (x: number, y: number) => st(a, x, y, DUNE));
    for (let i = 0; i < a.t.length; i++) { const q = r(); if (q < 0.035) a.t[i] = CACTUS; else if (q < 0.05) a.t[i] = ROCK; }
    borderFill(a, r, [CLIFF, CLIFF, CACTUS], 0.6);
    const clr = (x: number, y: number): void => { if (x > 0 && y > 0 && x < a.w - 1 && y < a.h - 1) { const t = gt(a, x, y); if (t === CACTUS || t === ROCK || t === CLIFF) st(a, x, y, SAND); } };
    disc(15, 14, 3.4, clr);
    disc(12, 9, 3.8, (x: number, y: number) => { if (x > 1 && y > 1) st(a, x, y, r() < 0.4 ? TREE : SAND); });
    disc(12, 9, 2.6, (x: number, y: number) => st(a, x, y, WATER));
    for (let y = 13; y <= 33; y++) for (let x = 29; x <= 47; x++) st(a, x, y, (x === 29 || x === 47 || y === 13 || y === 33) ? RUINW : RFLOOR);
    for (let y = 13; y <= 33; y++) if (y < 22 || y > 24) st(a, 38, y, RUINW);
    for (let x = 29; x <= 38; x++) if (x !== 33 && x !== 34) st(a, x, 23, RUINW);
    for (const y of [17, 18, 28, 29]) st(a, 29, y, RFLOOR);
    const pil = [[32, 16], [35, 16], [32, 20], [35, 20], [32, 27], [35, 27], [32, 31], [35, 31], [41, 16], [44, 16], [41, 30], [44, 30], [41, 20], [44, 20], [41, 26], [44, 26]];
    for (const p of pil) st(a, p[0], p[1], PILLAR);
    for (let y = 14; y < 33; y++) for (let x = 30; x < 47; x++) if (gt(a, x, y) === RFLOOR && r() < 0.04 && cheb(x, y, 43, 23) > 2) st(a, x, y, DUNE);
    for (let i = 0; i < 10; i++) { const x = 4 + Math.floor(r() * 22), y = 18 + Math.floor(r() * 18); st(a, x, y, r() < 0.5 ? RUINW : PILLAR); }
    const segs = [[0, 19, 15, 15], [15, 15, 28, 17], [15, 15, 20, 30], [20, 30, 28, 28], [15, 15, 15, 6], [28, 17, 29, 17], [28, 28, 29, 28]];
    for (const s of segs) line4(s[0], s[1], s[2], s[3], (x: number, y: number) => { disc(x, y, 1, clr); const t = gt(a, x, y); if (t !== RFLOOR && t !== WATER) st(a, x, y, PATH); });
    for (let y = 19; y <= 20; y++) { st(a, 0, y, PATH); st(a, 1, y, PATH); }
    st(a, 43, 23, RFLOOR);
    for (let y = 19; y <= 20; y++) a.exits.push({ x: 0, y, to: "town", tx: 38, ty: y - 4 });
    const inT = (x: number, y: number): boolean => x > 29 && x < 47 && y > 13 && y < 33;
    spawnIn(a, r, 1, 19, [["scorp", 9, (x: number, y: number) => !inT(x, y)], ["mummy", 7, (x: number, y: number) => inT(x, y) && x < 38], ["golem", 4, (x: number, y: number) => inT(x, y) && x > 38]], [[16, 13, 6], [43, 23, 4]]);
    a.spawns.push(["king", 43, 23]);
    return a;
  }
  const AREAS: { [k: string]: Area } = {};
  [genVillage(), genForest(), genCave(), genSwamp(), genTown(), genMount(), genDesert()].forEach((a: Area) => { AREAS[a.id] = a; });
  Object.keys(AREAS).forEach((k: string) => {
    const a = AREAS[k]; const e0 = a.exits[0]; const seen = reach(a, e0.x, e0.y);
    for (const sp of a.spawns) {
      if (seen[sp[2] * a.w + sp[1]]) continue;
      let done = false;
      for (let r = 1; r < 8 && !done; r++) for (let dy = -r; dy <= r && !done; dy++) for (let dx = -r; dx <= r && !done; dx++) {
        const x = sp[1] + dx, y = sp[2] + dy;
        if (x > 0 && y > 0 && x < a.w && y < a.h && seen[y * a.w + x]) { sp[1] = x; sp[2] = y; done = true; }
      }
    }
  });
  const AINFO: { [k: string]: any } = {
    village: { lv: "Bezpieczna osada · potwory poz. 1", amb: "", dark: 0, bg: "#1d3a18", gx: 0, gy: 1 },
    forest: { lv: "Potwory poz. 3–6", amb: "fly", dark: 0, bg: "#1d3a18", gx: 1, gy: 1 },
    cave: { lv: "Potwory poz. 7–12", amb: "", dark: 0.88, bg: "#0b090e", gx: 1, gy: 0 },
    swamp: { lv: "Potwory poz. 10–16", amb: "fog", dark: 0.5, bg: "#1e2618", gx: 1, gy: 2 },
    town: { lv: "Bezpieczne miasto · sklepy i zadania", amb: "", dark: 0, bg: "#2a2830", gx: 2, gy: 2 },
    mount: { lv: "Potwory poz. 14–22", amb: "snow", dark: 0, bg: "#6f7480", gx: 2, gy: 1 },
    desert: { lv: "Potwory poz. 18–26", amb: "sand", dark: 0, bg: "#9a7448", gx: 3, gy: 2 },
  };
  const GRAPH: { [k: string]: { [k: string]: Exit[] } } = {};
  const EXG: { [k: string]: any[] } = {};
  Object.keys(AREAS).forEach((k: string) => {
    GRAPH[k] = {}; EXG[k] = [];
    for (const e of AREAS[k].exits) { (GRAPH[k][e.to] = GRAPH[k][e.to] || []).push(e); }
    for (const to of Object.keys(GRAPH[k])) { const es = GRAPH[k][to]; let sx = 0, sy = 0; for (const e of es) { sx += e.x; sy += e.y; } EXG[k].push({ to, x: sx / es.length, y: sy / es.length }); }
  });
  function routeNext(from: string, to: string): string | null {
    if (from === to) return to;
    const prev: { [k: string]: string } = {}; prev[from] = from; const q = [from];
    while (q.length) {
      const c = q.shift() as string;
      for (const n of Object.keys(GRAPH[c])) {
        if (prev[n]) continue; prev[n] = c;
        if (n === to) { let p = n; while (prev[p] !== from) p = prev[p]; return p; }
        q.push(n);
      }
    }
    return null;
  }
  function routeList(from: string, to: string): string[] {
    const out = [from]; let c = from, g = 0;
    while (c !== to && g++ < 10) { const n = routeNext(c, to); if (!n) break; out.push(n); c = n; }
    return out;
  }
