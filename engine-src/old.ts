function createArdan(canvas: HTMLCanvasElement, opts: { font?: string }): () => void {
  const FONT: string = opts.font || "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
  const c2 = canvas.getContext("2d");
  if (!c2) return () => {};
  const ctx: CanvasRenderingContext2D = c2;
  const TS = 32;
  let destroyed = false;
  let raf = 0;
  const R = Math.random;
  const ri = (a: number, b: number): number => a + Math.floor(R() * (b - a + 1));
  const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
  const cheb = (ax: number, ay: number, bx: number, by: number): number => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
  function mkRng(seed: number): () => number {
    let s = seed >>> 0;
    return function (): number {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- TILES ----------
  const GRASS = 0, PATH = 1, WATER = 2, TREE = 3, WALL = 4, ROOF = 5, DOOR = 6, FLOOR = 7, CWALL = 8, BRIDGE = 9,
    FLOWER = 10, FENCE = 11, SAND = 12, ROCK = 13, PORTAL = 14, DGRASS = 15, WELL = 16, CRYSTAL = 17;
  const BLOCK: boolean[] = [];
  [WATER, TREE, WALL, ROOF, DOOR, CWALL, FENCE, ROCK, WELL, CRYSTAL].forEach((v: number) => { BLOCK[v] = true; });
  const MINI: string[] = [];
  MINI[GRASS] = "#4b8d3b"; MINI[DGRASS] = "#3f7a33"; MINI[FLOWER] = "#5a9a45"; MINI[PATH] = "#c09a60"; MINI[SAND] = "#d6c07c";
  MINI[WATER] = "#2d6db0"; MINI[TREE] = "#1f4a1c"; MINI[WALL] = "#d9c39a"; MINI[ROOF] = "#a8432f"; MINI[DOOR] = "#5a3a1e";
  MINI[FLOOR] = "#5a5463"; MINI[CWALL] = "#1d1922"; MINI[BRIDGE] = "#8b5e34"; MINI[FENCE] = "#8a6238"; MINI[ROCK] = "#8a8a8a";
  MINI[PORTAL] = "#c58cff"; MINI[WELL] = "#8d8d95"; MINI[CRYSTAL] = "#5fe3ff";

  interface Exit { x: number; y: number; to: string; tx: number; ty: number }
  interface Area {
    id: string; name: string; w: number; h: number; t: number[]; exits: Exit[]; spawns: any[];
    dark: boolean; base: number; img: HTMLCanvasElement | null; mini: HTMLCanvasElement | null;
  }
  function mkArea(id: string, name: string, w: number, h: number, fill: number, dark: boolean, base: number): Area {
    return { id, name, w, h, t: new Array(w * h).fill(fill), exits: [], spawns: [], dark, base, img: null, mini: null };
  }
  const gt = (a: Area, x: number, y: number): number => (x < 0 || y < 0 || x >= a.w || y >= a.h ? -1 : a.t[y * a.w + x]);
  const st = (a: Area, x: number, y: number, v: number): void => { if (x >= 0 && y >= 0 && x < a.w && y < a.h) a.t[y * a.w + x] = v; };
  const solidT = (a: Area, x: number, y: number): boolean => { const t = gt(a, x, y); return t < 0 || !!BLOCK[t]; };
  function line4(x0: number, y0: number, x1: number, y1: number, fn: (x: number, y: number) => void): void {
    let x = x0, y = y0; fn(x, y);
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = Math.sign(x1 - x0), sy = Math.sign(y1 - y0);
    let ix = 0, iy = 0;
    while (ix < dx || iy < dy) {
      if ((0.5 + ix) / dx < (0.5 + iy) / dy) { x += sx; ix++; } else { y += sy; iy++; }
      fn(x, y);
    }
  }
  function disc(cx: number, cy: number, r: number, fn: (x: number, y: number) => void): void {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) fn(x, y);
  }
  function reach(a: Area, sx: number, sy: number): Uint8Array {
    const seen = new Uint8Array(a.w * a.h); const q: number[] = [sy * a.w + sx]; seen[q[0]] = 1; let qi = 0;
    while (qi < q.length) {
      const c = q[qi++]; const x = c % a.w, y = (c - x) / a.w;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const d of nb) {
        const nx = x + d[0], ny = y + d[1];
        if (solidT(a, nx, ny)) continue;
        const k = ny * a.w + nx; if (seen[k]) continue; seen[k] = 1; q.push(k);
      }
    }
    return seen;
  }

  function genVillage(): Area {
    const a = mkArea("village", "Osada Brzozowa", 40, 30, GRASS, false, GRASS);
    const r = mkRng(11);
    for (let i = 0; i < a.t.length; i++) if (r() < 0.07) a.t[i] = FLOWER;
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
      const e = Math.min(x, y, a.w - 1 - x, a.h - 1 - y);
      if (e === 0 || (e === 1 && r() < 0.75) || (e === 2 && r() < 0.25)) st(a, x, y, TREE);
    }
    for (let x = 1; x < 40; x++) { st(a, x, 14, PATH); st(a, x, 15, PATH); }
    for (let y = 4; y <= 26; y++) { st(a, 19, y, PATH); st(a, 20, y, PATH); }
    disc(19.5, 14.5, 3.2, (x: number, y: number) => st(a, x, y, PATH));
    const house = (x: number, y: number, w: number, h: number): void => {
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) st(a, xx, yy, yy < y + h - 2 ? ROOF : WALL);
      st(a, x + Math.floor(w / 2), y + h - 1, DOOR);
    };
    house(6, 6, 7, 6); st(a, 9, 12, PATH); st(a, 9, 13, PATH);
    house(25, 5, 8, 7); st(a, 29, 12, PATH); st(a, 29, 13, PATH);
    house(6, 18, 7, 6); house(26, 18, 7, 6);
    for (let y = 24; y <= 25; y++) { st(a, 9, y, PATH); st(a, 29, y, PATH); }
    for (let x = 9; x <= 29; x++) st(a, x, 25, PATH);
    for (let x = 34; x <= 38; x++) for (let y = 3; y <= 8; y++) {
      const edge = x === 34 || x === 38 || y === 3 || y === 8;
      st(a, x, y, edge ? FENCE : FLOWER);
    }
    st(a, 36, 8, PATH); for (let y = 9; y <= 13; y++) st(a, 36, y, PATH);
    for (let y = 20; y < 30; y++) for (let x = 29; x < 40; x++) {
      const v = ((x - 34.5) / 3) ** 2 + ((y - 25.5) / 2.2) ** 2;
      const t = gt(a, x, y);
      if (t === GRASS || t === FLOWER || t === TREE) {
        if (v <= 1) st(a, x, y, WATER); else if (v <= 1.7 && t !== TREE) st(a, x, y, SAND);
      }
    }
    st(a, 17, 11, WELL);
    st(a, 39, 14, PATH); st(a, 39, 15, PATH);
    a.exits.push({ x: 39, y: 14, to: "forest", tx: 1, ty: 20 }, { x: 39, y: 15, to: "forest", tx: 1, ty: 21 });
    a.spawns = [["rat", 4, 27], ["rat", 13, 27], ["rat", 23, 27], ["rat", 5, 4], ["rat", 14, 4], ["rat", 26, 14]];
    return a;
  }

  function genForest(): Area {
    const a = mkArea("forest", "Mroczny Bór", 50, 40, GRASS, false, DGRASS);
    const r = mkRng(23);
    for (let i = 0; i < a.t.length; i++) if (r() < 0.4) a.t[i] = DGRASS;
    for (let i = 0; i < a.t.length; i++) if (r() < 0.36) a.t[i] = TREE;
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
      const e = Math.min(x, y, a.w - 1 - x, a.h - 1 - y);
      if (e <= 1 || (e === 2 && r() < 0.7)) st(a, x, y, TREE);
    }
    const clear = (x: number, y: number): void => { if (gt(a, x, y) === TREE && x > 0 && y > 0 && x < a.w - 1 && y < a.h - 1) st(a, x, y, r() < 0.5 ? GRASS : DGRASS); };
    const clearings = [[15, 14, 4], [22, 30, 4], [12, 33, 3.6], [40, 32, 4], [38, 18, 3.2], [8, 20, 2.6], [26, 8, 3.5], [44, 24, 3]];
    for (const c of clearings) disc(c[0], c[1], c[2], clear);
    for (let y = 0; y < a.h; y++) {
      const x0 = Math.round(31 + Math.sin(y * 0.28) * 2.2);
      st(a, x0, y, WATER); st(a, x0 + 1, y, WATER);
      if (gt(a, x0 - 1, y) !== TREE && r() < 0.6) st(a, x0 - 1, y, SAND);
      if (gt(a, x0 + 2, y) !== TREE && r() < 0.6) st(a, x0 + 2, y, SAND);
    }
    const segs = [[0, 20, 8, 20], [8, 20, 15, 14], [15, 14, 24, 16], [24, 16, 30, 22], [30, 22, 38, 18], [38, 18, 42, 8], [42, 8, 44, 3],
      [24, 16, 22, 30], [22, 30, 12, 33], [30, 22, 40, 32], [40, 32, 44, 24], [15, 14, 26, 8]];
    for (const s of segs) {
      line4(s[0], s[1], s[2], s[3], (x: number, y: number) => {
        disc(x, y, 1.2, clear);
        const t = gt(a, x, y);
        if (t === WATER) st(a, x, y, BRIDGE); else if (t !== BRIDGE) st(a, x, y, PATH);
      });
    }
    for (let y = 19; y <= 21; y++) { st(a, 0, y, PATH); st(a, 1, y, PATH); }
    for (let i = 0; i < a.t.length; i++) {
      const t = a.t[i];
      if ((t === GRASS || t === DGRASS)) { const q = r(); if (q < 0.018) a.t[i] = ROCK; else if (q < 0.06) a.t[i] = FLOWER; }
    }
    for (let y = 3; y <= 5; y++) for (let x = 43; x <= 45; x++) st(a, x, y, PATH);
    st(a, 43, 1, ROCK); st(a, 44, 1, ROCK); st(a, 45, 1, ROCK); st(a, 43, 2, ROCK); st(a, 45, 2, ROCK); st(a, 44, 2, PORTAL);
    for (let y = 19; y <= 21; y++) a.exits.push({ x: 0, y, to: "village", tx: 38, ty: y === 21 ? 15 : 14 });
    a.exits.push({ x: 44, y: 2, to: "cave", tx: 6, ty: 23 });
    const seen = reach(a, 1, 20);
    const cand: number[][] = [];
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
      const t = gt(a, x, y);
      if (seen[y * a.w + x] && t !== PATH && t !== BRIDGE && t !== PORTAL && Math.abs(x - 1) + Math.abs(y - 20) > 10 && cheb(x, y, 13, 33) > 3) cand.push([x, y]);
    }
    const used: number[][] = [];
    const pick = (kind: string, n: number, f: (x: number, y: number) => boolean): void => {
      let tries = 0;
      while (n > 0 && tries++ < 3000) {
        const c = cand[Math.floor(r() * cand.length)];
        if (!f(c[0], c[1])) continue;
        if (used.some((u: number[]) => cheb(u[0], u[1], c[0], c[1]) < 3)) continue;
        used.push(c); a.spawns.push([kind, c[0], c[1]]); n--;
      }
    };
    pick("wolf", 8, (x: number) => x < 29);
    pick("boar", 7, (x: number, y: number) => x < 30 || y > 26);
    pick("goblin", 7, (x: number) => x > 34);
    return a;
  }

  function genCave(): Area {
    const a = mkArea("cave", "Jaskinia Cieni", 36, 28, CWALL, true, FLOOR);
    const r = mkRng(37);
    const rooms = [[2, 21, 8, 5], [13, 17, 8, 7], [3, 3, 9, 8], [16, 3, 10, 8], [25, 13, 9, 11]];
    for (const m of rooms) for (let y = m[1]; y < m[1] + m[3]; y++) for (let x = m[0]; x < m[0] + m[2]; x++) st(a, x, y, FLOOR);
    const cen = rooms.map((m: number[]) => [m[0] + Math.floor(m[2] / 2), m[1] + Math.floor(m[3] / 2)]);
    const links = [[0, 1], [1, 2], [2, 3], [3, 4], [1, 3]];
    for (const l of links) {
      const A1 = cen[l[0]], B1 = cen[l[1]];
      line4(A1[0], A1[1], B1[0], A1[1], (x: number, y: number) => { st(a, x, y, FLOOR); st(a, x, y + 1, FLOOR); });
      line4(B1[0], A1[1], B1[0], B1[1], (x: number, y: number) => { st(a, x, y, FLOOR); st(a, x + 1, y, FLOOR); });
    }
    for (let y = 1; y < a.h - 1; y++) for (let x = 1; x < a.w - 1; x++) {
      if (gt(a, x, y) !== FLOOR) continue;
      let all = true;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (gt(a, x + dx, y + dy) !== FLOOR) all = false;
      if (all && r() < 0.035) st(a, x, y, ROCK);
    }
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
      if (gt(a, x, y) !== CWALL) continue;
      if ((gt(a, x, y + 1) === FLOOR || gt(a, x + 1, y) === FLOOR || gt(a, x - 1, y) === FLOOR) && r() < 0.06) st(a, x, y, CRYSTAL);
    }
    st(a, 3, 23, PORTAL); st(a, 4, 23, FLOOR); st(a, 5, 23, FLOOR); st(a, 6, 23, FLOOR);
    a.exits.push({ x: 3, y: 23, to: "forest", tx: 44, ty: 4 });
    const inRoom = (k: number, kind: string, n: number): void => {
      const m = rooms[k]; let tries = 0;
      while (n > 0 && tries++ < 200) {
        const x = m[0] + 1 + Math.floor(r() * (m[2] - 2)), y = m[1] + 1 + Math.floor(r() * (m[3] - 2));
        if (gt(a, x, y) !== FLOOR || a.spawns.some((s: any[]) => s[1] === x && s[2] === y)) continue;
        a.spawns.push([kind, x, y]); n--;
      }
    };
    inRoom(1, "spider", 3); inRoom(2, "spider", 2); inRoom(2, "skel", 1); inRoom(3, "skel", 3); inRoom(4, "skel", 2);
    a.spawns.push(["boss", 29, 18]);
    st(a, 29, 18, FLOOR);
    return a;
  }

  const AREAS: { [k: string]: Area } = {};
  [genVillage(), genForest(), genCave()].forEach((a: Area) => { AREAS[a.id] = a; });

  // ---------- TILE ART ----------
  function grass(g: CanvasRenderingContext2D, px: number, py: number, h: () => number, dark: boolean): void {
    g.fillStyle = dark ? "#3f7a33" : "#4b8d3b"; g.fillRect(px, py, TS, TS);
    for (let i = 0; i < 7; i++) {
      g.fillStyle = h() < 0.5 ? (dark ? "#4c8a3e" : "#5ca34a") : (dark ? "#336a2a" : "#3e7a31");
      g.fillRect(px + Math.floor(h() * 30), py + Math.floor(h() * 30), 2, h() < 0.3 ? 4 : 2);
    }
  }
  function floorT(g: CanvasRenderingContext2D, px: number, py: number, h: () => number): void {
    g.fillStyle = "#4b4552"; g.fillRect(px, py, TS, TS);
    for (let i = 0; i < 6; i++) { g.fillStyle = h() < 0.5 ? "#56505e" : "#403a47"; g.fillRect(px + Math.floor(h() * 29), py + Math.floor(h() * 29), 3, 3); }
    if (h() < 0.25) { g.fillStyle = "#35303d"; const x = px + 4 + Math.floor(h() * 20), y = py + 4 + Math.floor(h() * 20); g.fillRect(x, y, 6, 1); g.fillRect(x + 5, y + 1, 1, 5); }
    if (h() < 0.04) { g.fillStyle = "#d8d2c0"; const x = px + 8 + Math.floor(h() * 12), y = py + 10 + Math.floor(h() * 12); g.fillRect(x, y, 8, 2); g.fillRect(x - 1, y - 1, 2, 4); g.fillRect(x + 7, y - 1, 2, 4); }
  }
  function baseOf(g: CanvasRenderingContext2D, a: Area, px: number, py: number, h: () => number): void {
    if (a.base === FLOOR) floorT(g, px, py, h); else grass(g, px, py, h, a.base === DGRASS);
  }
  function drawTile(g: CanvasRenderingContext2D, a: Area, x: number, y: number): void {
    const t = gt(a, x, y), px = x * TS, py = y * TS;
    const h = mkRng(((x * 73856093) ^ (y * 19349663) ^ (a.w * 83492791)) >>> 0);
    const nb = (dx: number, dy: number): number => gt(a, x + dx, y + dy);
    switch (t) {
      case GRASS: grass(g, px, py, h, false); break;
      case DGRASS: grass(g, px, py, h, true); break;
      case FLOWER: {
        grass(g, px, py, h, a.base === DGRASS);
        const cols = ["#e8505b", "#f5d547", "#ffffff", "#b46cf0", "#ff9a3c"];
        for (let i = 0; i < 4; i++) {
          const fx = px + 3 + Math.floor(h() * 24), fy = py + 3 + Math.floor(h() * 24);
          g.fillStyle = "#2f6a2a"; g.fillRect(fx + 1, fy + 3, 1, 3);
          g.fillStyle = cols[Math.floor(h() * cols.length)]; g.fillRect(fx, fy, 3, 3);
          g.fillStyle = "#fff6a0"; g.fillRect(fx + 1, fy + 1, 1, 1);
        }
        break;
      }
      case PATH: case SAND: {
        g.fillStyle = t === PATH ? "#b7925b" : "#d6c07c"; g.fillRect(px, py, TS, TS);
        for (let i = 0; i < 8; i++) { g.fillStyle = h() < 0.5 ? (t === PATH ? "#a3804c" : "#c4ad6a") : (t === PATH ? "#c9a56d" : "#e2cf92"); g.fillRect(px + Math.floor(h() * 30), py + Math.floor(h() * 30), 2, 2); }
        if (t === PATH && h() < 0.5) { g.fillStyle = "#8c7048"; g.fillRect(px + Math.floor(h() * 26) + 2, py + Math.floor(h() * 26) + 2, 3, 2); }
        const soft = (v: number): boolean => v === GRASS || v === DGRASS || v === FLOWER || v === TREE || v === ROCK;
        g.fillStyle = "rgba(60,110,40,0.45)";
        if (soft(nb(0, -1))) for (let i = 0; i < 8; i++) g.fillRect(px + i * 4, py, 4, 2 + Math.floor(h() * 3));
        if (soft(nb(0, 1))) for (let i = 0; i < 8; i++) { const k = 2 + Math.floor(h() * 3); g.fillRect(px + i * 4, py + TS - k, 4, k); }
        if (soft(nb(-1, 0))) for (let i = 0; i < 8; i++) g.fillRect(px, py + i * 4, 2 + Math.floor(h() * 3), 4);
        if (soft(nb(1, 0))) for (let i = 0; i < 8; i++) { const k = 2 + Math.floor(h() * 3); g.fillRect(px + TS - k, py + i * 4, k, 4); }
        break;
      }
      case WATER: {
        g.fillStyle = "#2d6db0"; g.fillRect(px, py, TS, TS);
        g.fillStyle = "#3a7fc4"; for (let i = 0; i < 3; i++) g.fillRect(px + Math.floor(h() * 24), py + 4 + Math.floor(h() * 24), 8, 2);
        g.fillStyle = "#a9d8f2";
        const land = (v: number): boolean => v !== WATER && v !== BRIDGE && v !== -1;
        if (land(nb(0, -1))) g.fillRect(px, py, TS, 2);
        if (land(nb(0, 1))) g.fillRect(px, py + TS - 2, TS, 2);
        if (land(nb(-1, 0))) g.fillRect(px, py, 2, TS);
        if (land(nb(1, 0))) g.fillRect(px + TS - 2, py, 2, TS);
        break;
      }
      case BRIDGE: {
        g.fillStyle = "#2d6db0"; g.fillRect(px, py, TS, TS);
        g.fillStyle = "#8b5e34"; g.fillRect(px, py + 2, TS, TS - 4);
        g.fillStyle = "#6e4826"; for (let i = 0; i < TS; i += 6) g.fillRect(px + i, py + 2, 1, TS - 4);
        g.fillStyle = "#4e3119";
        if (nb(0, -1) === WATER) g.fillRect(px, py + 2, TS, 3);
        if (nb(0, 1) === WATER) g.fillRect(px, py + TS - 5, TS, 3);
        break;
      }
      case TREE: {
        baseOf(g, a, px, py, h);
        const ox = Math.floor(h() * 5) - 2, oy = Math.floor(h() * 3) - 1;
        const pine = a.base === DGRASS && h() < 0.45;
        g.fillStyle = "rgba(0,0,0,0.25)"; g.beginPath(); g.ellipse(px + 16, py + 28, 12, 4, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#6b4423"; g.fillRect(px + 13 + ox, py + 19, 6, 11);
        if (pine) {
          const layers: [string, number, number][] = [["#1f4d22", 14, 18], ["#2a6230", 11, 11], ["#367a3a", 7, 5]];
          for (const L of layers) {
            g.fillStyle = L[0]; g.beginPath();
            const w = L[1], ty = L[2];
            g.moveTo(px + 16 + ox, py + ty - 4 + oy); g.lineTo(px + 16 + ox - w, py + ty + 10 + oy); g.lineTo(px + 16 + ox + w, py + ty + 10 + oy); g.closePath(); g.fill();
          }
        } else {
          const dark = a.base === DGRASS;
          g.fillStyle = dark ? "#24561f" : "#2f6b2a"; g.beginPath(); g.arc(px + 16 + ox, py + 13 + oy, 13, 0, Math.PI * 2); g.fill();
          g.fillStyle = dark ? "#2f6d29" : "#3d8a35"; g.beginPath(); g.arc(px + 12 + ox, py + 10 + oy, 8, 0, Math.PI * 2); g.fill();
          g.beginPath(); g.arc(px + 21 + ox, py + 12 + oy, 7, 0, Math.PI * 2); g.fill();
          g.fillStyle = dark ? "#418a37" : "#58a84a"; g.beginPath(); g.arc(px + 10 + ox, py + 7 + oy, 3, 0, Math.PI * 2); g.fill();
          if (!dark && h() < 0.2) { g.fillStyle = "#d8403a"; g.fillRect(px + 18 + ox, py + 9, 3, 3); g.fillRect(px + 9 + ox, py + 15, 3, 3); }
        }
        break;
      }
      case ROOF: {
        g.fillStyle = "#a8432f"; g.fillRect(px, py, TS, TS);
        g.fillStyle = "#8a3424";
        for (let r = 0; r < 4; r++) { g.fillRect(px, py + r * 8 + 7, TS, 1); for (let i = (r % 2) * 4; i < TS; i += 8) g.fillRect(px + i, py + r * 8, 1, 8); }
        g.fillStyle = "#c2563f"; for (let r = 0; r < 4; r++) g.fillRect(px, py + r * 8, TS, 1);
        if (nb(0, -1) !== ROOF) { g.fillStyle = "#6a261b"; g.fillRect(px, py, TS, 4); }
        if (nb(-1, 0) !== ROOF) { g.fillStyle = "#7a2d20"; g.fillRect(px, py, 3, TS); }
        if (nb(1, 0) !== ROOF) { g.fillStyle = "#7a2d20"; g.fillRect(px + TS - 3, py, 3, TS); }
        if (nb(0, 1) !== ROOF) { g.fillStyle = "#5a2016"; g.fillRect(px, py + TS - 4, TS, 4); }
        break;
      }
      case WALL: case DOOR: {
        g.fillStyle = "#dcc79d"; g.fillRect(px, py, TS, TS);
        g.fillStyle = "#6b4a2b";
        if (nb(-1, 0) !== WALL && nb(-1, 0) !== DOOR) g.fillRect(px, py, 4, TS);
        if (nb(1, 0) !== WALL && nb(1, 0) !== DOOR) g.fillRect(px + TS - 4, py, 4, TS);
        if (nb(0, -1) === ROOF) { g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(px, py, TS, 4); }
        g.fillStyle = "#6b4a2b"; if (nb(0, 1) !== WALL && nb(0, 1) !== DOOR) g.fillRect(px, py + TS - 3, TS, 3);
        if (t === DOOR) {
          g.fillStyle = "#4a2e17"; g.fillRect(px + 7, py + 4, 18, 28);
          g.fillStyle = "#6a4423"; g.fillRect(px + 9, py + 6, 14, 26);
          g.fillStyle = "#553519"; g.fillRect(px + 15, py + 6, 2, 26);
          g.fillStyle = "#f2c94c"; g.fillRect(px + 19, py + 19, 2, 2);
        } else if (nb(0, 1) !== WALL && nb(0, 1) !== DOOR && h() < 0.55) {
          g.fillStyle = "#6b4a2b"; g.fillRect(px + 8, py + 6, 16, 14);
          g.fillStyle = "#7fb2d8"; g.fillRect(px + 10, py + 8, 12, 10);
          g.fillStyle = "#c8e4f5"; g.fillRect(px + 11, py + 9, 4, 3);
          g.fillStyle = "#6b4a2b"; g.fillRect(px + 15, py + 8, 2, 10); g.fillRect(px + 10, py + 12, 12, 2);
          g.fillStyle = "#e26f6f"; g.fillRect(px + 9, py + 20, 14, 3);
        }
        break;
      }
      case FLOOR: floorT(g, px, py, h); break;
      case CWALL: case CRYSTAL: {
        g.fillStyle = "#211d27"; g.fillRect(px, py, TS, TS);
        for (let i = 0; i < 4; i++) { g.fillStyle = "#2b2631"; g.fillRect(px + Math.floor(h() * 26), py + Math.floor(h() * 26), 5, 4); }
        if (nb(0, 1) === FLOOR || nb(0, 1) === ROCK || nb(0, 1) === PORTAL) {
          g.fillStyle = "#3b3445"; g.fillRect(px, py + 16, TS, 16);
          g.fillStyle = "#2d2836"; for (let r = 0; r < 2; r++) { g.fillRect(px, py + 16 + r * 8, TS, 1); for (let i = (r % 2) * 6; i < TS; i += 12) g.fillRect(px + i, py + 16 + r * 8, 1, 8); }
          g.fillStyle = "#4a4256"; g.fillRect(px, py + 16, TS, 2);
        }
        if (t === CRYSTAL) {
          g.fillStyle = "#2aa6d6"; g.beginPath(); g.moveTo(px + 10, py + 30); g.lineTo(px + 14, py + 12); g.lineTo(px + 18, py + 30); g.fill();
          g.fillStyle = "#5fe3ff"; g.beginPath(); g.moveTo(px + 16, py + 30); g.lineTo(px + 21, py + 16); g.lineTo(px + 25, py + 30); g.fill();
          g.fillStyle = "#c9f6ff"; g.fillRect(px + 13, py + 16, 1, 6);
        }
        break;
      }
      case FENCE: {
        grass(g, px, py, h, false);
        g.fillStyle = "#8a6238";
        const f = (v: number): boolean => v === FENCE;
        if (f(nb(-1, 0)) || f(nb(1, 0))) { const x0 = f(nb(-1, 0)) ? 0 : 13, x1 = f(nb(1, 0)) ? TS : 19; g.fillRect(px + x0, py + 12, x1 - x0, 3); g.fillRect(px + x0, py + 20, x1 - x0, 3); }
        if (f(nb(0, -1)) || f(nb(0, 1))) { const y0 = f(nb(0, -1)) ? 0 : 10, y1 = f(nb(0, 1)) ? TS : 26; g.fillRect(px + 14, py + y0, 4, y1 - y0); }
        g.fillStyle = "#6e4a26"; g.fillRect(px + 13, py + 8, 6, 20); g.fillStyle = "#a57a4a"; g.fillRect(px + 13, py + 8, 6, 2);
        break;
      }
      case ROCK: {
        baseOf(g, a, px, py, h);
        g.fillStyle = "rgba(0,0,0,0.3)"; g.beginPath(); g.ellipse(px + 16, py + 26, 12, 4, 0, 0, Math.PI * 2); g.fill();
        const cave = a.base === FLOOR;
        g.fillStyle = cave ? "#6a6276" : "#7f8186"; g.beginPath(); g.ellipse(px + 16, py + 18, 12, 10, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = cave ? "#8a8296" : "#a5a7ad"; g.beginPath(); g.ellipse(px + 12, py + 14, 6, 4, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = cave ? "#4c4556" : "#5d6066"; g.fillRect(px + 16, py + 20, 8, 2);
        break;
      }
      case PORTAL: {
        if (a.base === FLOOR) {
          floorT(g, px, py, h);
          for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? "#7a7088" : "#958aa5"; g.fillRect(px + 4, py + 4 + i * 7, 24, 6); }
          g.fillStyle = "#e8d9a0"; g.fillRect(px + 4, py + 4, 24, 2);
        } else {
          grass(g, px, py, h, true);
          g.fillStyle = "#3a3440"; g.beginPath(); g.ellipse(px + 16, py + 20, 15, 14, 0, Math.PI, 0); g.lineTo(px + 31, py + 32); g.lineTo(px + 1, py + 32); g.fill();
          g.fillStyle = "#0d0a12"; g.beginPath(); g.ellipse(px + 16, py + 22, 10, 10, 0, Math.PI, 0); g.lineTo(px + 26, py + 32); g.lineTo(px + 6, py + 32); g.fill();
        }
        break;
      }
      case WELL: {
        grass(g, px, py, h, false);
        g.fillStyle = "rgba(0,0,0,0.25)"; g.beginPath(); g.ellipse(px + 16, py + 27, 13, 4, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#8d8d95"; g.beginPath(); g.ellipse(px + 16, py + 21, 12, 8, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#2d5f9a"; g.beginPath(); g.ellipse(px + 16, py + 20, 7, 4, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#6b4a2b"; g.fillRect(px + 4, py + 4, 3, 18); g.fillRect(px + 25, py + 4, 3, 18); g.fillRect(px + 4, py + 6, 24, 2);
        g.fillStyle = "#8a3a2a"; g.beginPath(); g.moveTo(px + 1, py + 7); g.lineTo(px + 16, py); g.lineTo(px + 31, py + 7); g.fill();
        break;
      }
      default: grass(g, px, py, h, false);
    }
  }
  function renderArea(a: Area): void {
    const c = document.createElement("canvas"); c.width = a.w * TS; c.height = a.h * TS;
    const g = c.getContext("2d") as CanvasRenderingContext2D;
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) drawTile(g, a, x, y);
    a.img = c;
    const m = document.createElement("canvas"); m.width = a.w; m.height = a.h;
    const mg = m.getContext("2d") as CanvasRenderingContext2D;
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) { mg.fillStyle = MINI[gt(a, x, y)] || "#000"; mg.fillRect(x, y, 1, 1); }
    a.mini = m;
  }

  // ---------- DATA ----------
  const ITEMS: { [k: string]: any } = {
    club: { n: "Drewniana pałka", t: "w", atk: 2, price: 6, c: "#9a6b3c", ic: "club" },
    sword: { n: "Żelazny miecz", t: "w", atk: 6, price: 60, c: "#c9d1d9", ic: "sword" },
    axe: { n: "Stalowy topór", t: "w", atk: 11, price: 170, c: "#aab4be", ic: "axe" },
    blade: { n: "Ostrze Świtu", t: "w", atk: 19, price: 450, c: "#ffd25a", ic: "sword" },
    shirt: { n: "Lniana koszula", t: "a", def: 1, price: 6, c: "#c9b89a", ic: "shirt" },
    leather: { n: "Skórzany kaftan", t: "a", def: 4, price: 50, c: "#8a5a2b", ic: "armor" },
    chain: { n: "Kolczuga", t: "a", def: 8, price: 150, c: "#9aa4ad", ic: "armor" },
    plate: { n: "Zbroja płytowa", t: "a", def: 13, price: 380, c: "#d8dee6", ic: "armor" },
    pot: { n: "Mała mikstura", t: "p", heal: 45, price: 12, c: "#e0413a", ic: "pot" },
    bigpot: { n: "Duża mikstura", t: "p", heal: 120, price: 35, c: "#b03ad0", ic: "pot" },
    tail: { n: "Szczurzy ogon", t: "j", price: 3, c: "#d89a9a", ic: "tail" },
    pelt: { n: "Wilcza skóra", t: "j", price: 9, c: "#8d8f94", ic: "pelt" },
    tusk: { n: "Kieł dzika", t: "q", price: 7, c: "#f1ead6", ic: "tusk" },
    ear: { n: "Ucho goblina", t: "j", price: 11, c: "#6aa84f", ic: "ear" },
    silk: { n: "Pajęczy jedwab", t: "j", price: 14, c: "#e8e8f0", ic: "silk" },
    bone: { n: "Stara kość", t: "j", price: 10, c: "#e6dfc8", ic: "bone" },
    gem: { n: "Kryształ Mgieł", t: "j", price: 90, c: "#7fe9ff", ic: "gem" },
  };
  const MON: { [k: string]: any } = {
    rat: { n: "Szczur", lvl: 1, hp: 16, atk: 4, def: 0, xp: 7, gold: [0, 3], spd: 2.6, aggro: 0, cd: 1.3, resp: 14, drops: [["tail", 0.6], ["pot", 0.06]] },
    wolf: { n: "Szary wilk", lvl: 3, hp: 38, atk: 9, def: 2, xp: 17, gold: [2, 6], spd: 3.6, aggro: 4, cd: 1.2, resp: 22, drops: [["pelt", 0.5], ["pot", 0.1]] },
    boar: { n: "Dzik", lvl: 4, hp: 55, atk: 10, def: 4, xp: 23, gold: [3, 8], spd: 3, aggro: 2, cd: 1.3, resp: 22, drops: [["tusk", 0.6], ["pot", 0.1]] },
    goblin: { n: "Leśny goblin", lvl: 6, hp: 78, atk: 15, def: 5, xp: 38, gold: [6, 15], spd: 3.1, aggro: 5, cd: 1.2, resp: 28, drops: [["ear", 0.5], ["pot", 0.15], ["sword", 0.05], ["leather", 0.05]] },
    spider: { n: "Jaskiniowy pająk", lvl: 7, hp: 88, atk: 18, def: 6, xp: 50, gold: [5, 14], spd: 3.8, aggro: 5, cd: 1.1, resp: 30, drops: [["silk", 0.5], ["bigpot", 0.08]] },
    skel: { n: "Szkielet", lvl: 9, hp: 125, atk: 22, def: 9, xp: 72, gold: [10, 22], spd: 2.7, aggro: 5, cd: 1.3, resp: 34, drops: [["bone", 0.6], ["bigpot", 0.1], ["chain", 0.04], ["axe", 0.03]] },
    boss: { n: "Upiór Mgieł", lvl: 12, hp: 560, atk: 30, def: 12, xp: 420, gold: [150, 250], spd: 2.5, aggro: 6, cd: 1.5, resp: 120, boss: true, drops: [["gem", 1], ["bigpot", 0.7], ["plate", 0.2]] },
  };
  const NPCS: { [k: string]: any } = {
    soltys: { n: "Sołtys Radomir", area: "village", x: 16, y: 17, c: { body: "#3c5aa6", skin: "#f0c9a0", hair: "#e8e8e8", beard: true }, talk: "Osada Brzozowa to spokojne miejsce... przynajmniej była, zanim z północy zeszła mgła." },
    kowal: { n: "Kowal Bogumił", area: "village", x: 11, y: 12, c: { body: "#5b3a24", skin: "#e2b48a", hair: "#2a1a10", apron: true }, shop: "smith", talk: "Dobra stal to podstawa przetrwania. Obejrzyj, co wykułem." },
    zielarka: { n: "Zielarka Wiesława", area: "village", x: 31, y: 12, c: { body: "#4f7a3a", skin: "#f2cfa8", hair: "#a0522d", long: true }, shop: "herbs", talk: "Mikstury z ziół Mrocznego Boru. Postawią cię na nogi po każdej walce." },
    straznik: { n: "Strażnik Mirek", area: "village", x: 37, y: 13, c: { body: "#7a7f88", skin: "#e8bf98", hair: "#5a3a1a", helmet: true }, talk: "Za bramą zaczyna się Mroczny Bór. Wilki tam nie żartują, uważaj na siebie." },
    pustelnik: { n: "Pustelnik Ignacy", area: "forest", x: 13, y: 33, c: { body: "#6a5a8a", skin: "#e0b890", hair: "#cfcfcf", beard: true }, heal: true, talk: "Mgła przyszła z jaskini na północnym wschodzie. Coś się tam obudziło. Ogrzej się przy moim ognisku." },
  };
  const DECOR: any[] = [{ area: "forest", x: 12, y: 34, k: "fire" }, { area: "village", x: 22, y: 12, k: "crate" }, { area: "village", x: 23, y: 12, k: "barrel" }];
  Object.keys(NPCS).forEach((k: string) => { const n = NPCS[k]; st(AREAS[n.area], n.x, n.y, GRASS); });
  DECOR.forEach((d: any) => { const a = AREAS[d.area]; if (solidT(a, d.x, d.y)) st(a, d.x, d.y, GRASS); });
  Object.keys(AREAS).forEach((k: string) => renderArea(AREAS[k]));
  const SHOPS: { [k: string]: string[] } = { smith: ["sword", "axe", "leather", "chain", "plate"], herbs: ["pot", "bigpot"] };
  const QORDER = ["rats", "wolves", "tusks", "wraith"];
  const QUESTS: { [k: string]: any } = {
    rats: { n: "Szczury w spiżarni", giver: "soltys", kill: "rat", need: 4, desc: "Ubij 4 szczury w Osadzie Brzozowej.",
      offer: "Witaj, wędrowcze! Szczury z piwnic rozpanoszyły się po całej osadzie. Ubij 4 z nich, a cię wynagrodzę.",
      mid: "Szczury wciąż harcują. Ubite: {c}/{n}.", thx: "Wspaniale! Spiżarnia ocalała. Przyjmij te mikstury i trochę grosza.",
      rew: { xp: 35, gold: 25, items: [["pot", 2]] } },
    wolves: { n: "Wilcza plaga", giver: "soltys", req: "rats", kill: "wolf", need: 6, desc: "Ubij 6 szarych wilków w Mrocznym Borze (wschodnia brama).",
      offer: "Z Mrocznego Boru za wschodnią bramą przychodzą wilki i porywają nam owce. Ubij 6 szarych wilków.",
      mid: "Wilków wciąż za dużo. Ubite: {c}/{n}.", thx: "Owce znów pasą się spokojnie. Ten skórzany kaftan należał do mojego syna, niech ci służy.",
      rew: { xp: 120, gold: 60, items: [["leather", 1]] } },
    tusks: { n: "Kły na eliksir", giver: "zielarka", item: "tusk", need: 3, desc: "Przynieś Zielarce 3 kły dzika z Mrocznego Boru.",
      offer: "Potrzebuję kłów dzika do mocnego eliksiru. Przynieś mi 3, dziki ryją w Mrocznym Borze.",
      mid: "Masz już {c}/{n} kłów. Dziki znajdziesz w borze.", thx: "Doskonałe kły! Proszę, oto mikstury, świeżo uwarzone.",
      rew: { xp: 90, gold: 30, items: [["pot", 3], ["bigpot", 1]] } },
    wraith: { n: "Upiór z jaskini", giver: "straznik", req: "wolves", lvl: 6, kill: "boss", need: 1, desc: "Pokonaj Upiora Mgieł w Jaskini Cieni (północny wschód boru).",
      offer: "Mgła sączy się z Jaskini Cieni na północnym wschodzie boru. Mieszka tam Upiór Mgieł. Pokonaj go, a cała osada będzie ci dłużna.",
      lock: "Słyszałem o twoich wilkach! Ale do Jaskini Cieni wróć, gdy osiągniesz 6. poziom.",
      mid: "Upiór wciąż żyje, a mgła gęstnieje. Weź zapas mikstur, zanim tam zejdziesz.", thx: "Mgła się rozwiewa! Jesteś bohaterem Osady Brzozowej. Weź Ostrze Świtu, wykute przez naszych przodków.",
      rew: { xp: 500, gold: 250, items: [["blade", 1]] } },
  };

  // ---------- STATE ----------
  const SAVE_KEY = "ardan_kroniki_mgiel_v1";
  const fresh = (): any => ({ lvl: 1, xp: 0, hp: 60, gold: 20, area: "village", x: 18, y: 17, inv: [{ id: "pot", n: 3 }], eq: { w: "club", a: "shirt" }, q: {}, kills: 0, intro: false });
  let P: any = fresh();
  try {
    const s = window.localStorage ? window.localStorage.getItem(SAVE_KEY) : null;
    if (s) { const o = JSON.parse(s); if (o && o.lvl && AREAS[o.area]) P = Object.assign(fresh(), o); }
  } catch (e) { /* no storage */ }
  let lastSave = 0;
  function save(): void { try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(P)); } catch (e) { /* ignore */ } }

  const xpNext = (l: number): number => Math.floor(40 * Math.pow(l, 1.65));
  const maxHp = (): number => 50 + (P.lvl - 1) * 15 + (P.eq.a ? ITEMS[P.eq.a].def * 2 : 0);
  const atk = (): number => 4 + P.lvl * 2 + (P.eq.w ? ITEMS[P.eq.w].atk : 0);
  const def = (): number => P.lvl + (P.eq.a ? ITEMS[P.eq.a].def : 0);
  P.hp = Math.min(P.hp, maxHp());

  const pl: any = { fx: P.x, fy: P.y, mt: 1, dir: 0, phase: 0, cd: 0, anim: 0, hit: 0, path: [] as number[][], target: null as any, talk: null as string | null, repath: 0, dead: 0 };
  const mobs: { [k: string]: any[] } = {};
  Object.keys(AREAS).forEach((k: string) => {
    mobs[k] = AREAS[k].spawns.map((s: any[]) => {
      const d = MON[s[0]];
      return { k: s[0], d, x: s[1], y: s[2], fx: s[1], fy: s[2], hx: s[1], hy: s[2], mt: 1, hp: d.hp, dead: false, rt: 0, cd: 1, wt: R() * 3, aggro: false, hit: 0, dir: 0, anim: 0 };
    });
  });
  const bags: any[] = [];
  const fx: any[] = [];
  const msgs: any[] = [];
  let time = 0;
  let banner = 3.5;
  let trans: any = null;
  let panel = "";
  let dlg: any = null;
  let shopId = "", shopTab = "buy", sellPage = 0, invSel = -1, resetArm = 0;
  let touchMode = false;
  let clickMark: number[] | null = null;
  const keys: { [k: string]: boolean } = {};
  const holds: { [k: number]: number } = {};
  let W = 300, H = 300, S = 1, camX = 0, camY = 0, dpr = 1;
  let ui: any[] = [];
  let hover: any = null;
  let mouse: any = null;
  const isTouch = typeof window !== "undefined" && ("ontouchstart" in window || (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0));
  if (isTouch) touchMode = true;

  const A = (): Area => AREAS[P.area];
  const log = (t: string, c?: string): void => { msgs.push({ t, c: c || "#efe6d2", life: 9 }); if (msgs.length > 6) msgs.shift(); };
  const ftext = (x: number, y: number, t: string, c: string, size?: number): void => { fx.push({ k: "txt", x, y, t, c, life: 1.1, max: 1.1, s: size || 14 }); };
  const burst = (x: number, y: number, c: string, n: number, sp?: number): void => {
    for (let i = 0; i < n; i++) { const an = R() * Math.PI * 2, v = (sp || 60) * (0.4 + R()); fx.push({ k: "p", x, y, vx: Math.cos(an) * v, vy: Math.sin(an) * v - 20, c, life: 0.5 + R() * 0.5, max: 1 }); }
  };
  const rpos = (e: any): number[] => [(e.fx + (e.x - e.fx) * e.mt) * TS, (e.fy + (e.y - e.fy) * e.mt) * TS];
  const pl2 = (): any => ({ fx: pl.fx, fy: pl.fy, x: P.x, y: P.y, mt: pl.mt });

  function countItem(id: string): number { let n = 0; for (const s of P.inv) if (s.id === id) n += s.n; return n; }
  function addItem(id: string, n: number): boolean {
    const it = ITEMS[id];
    const stack = it.t === "p" || it.t === "j" || it.t === "q";
    if (stack) { const s = P.inv.find((x: any) => x.id === id); if (s) { s.n += n; return true; } }
    if (P.inv.length >= 20) { log("Torba jest pełna!", "#ff8a7a"); return false; }
    if (stack) P.inv.push({ id, n }); else for (let i = 0; i < n; i++) { if (P.inv.length >= 20) return false; P.inv.push({ id, n: 1 }); }
    return true;
  }
  function removeItem(id: string, n: number): void {
    for (let i = P.inv.length - 1; i >= 0 && n > 0; i--) {
      const s = P.inv[i]; if (s.id !== id) continue;
      const k = Math.min(n, s.n); s.n -= k; n -= k; if (s.n <= 0) P.inv.splice(i, 1);
    }
  }

  // ---------- QUESTS ----------
  const reqDone = (q: any): boolean => !q.req || (P.q[q.req] && P.q[q.req].s === "done");
  const qAvail = (id: string): boolean => { const q = QUESTS[id]; return !P.q[id] && reqDone(q) && P.lvl >= (q.lvl || 1); };
  const qLocked = (id: string): boolean => { const q = QUESTS[id]; return !P.q[id] && reqDone(q) && P.lvl < (q.lvl || 1); };
  const qProg = (id: string): number => { const q = QUESTS[id], s = P.q[id]; if (!s) return 0; return Math.min(q.need, q.item ? countItem(q.item) : s.c); };
  const qReady = (id: string): boolean => { const s = P.q[id]; return !!s && s.s === "active" && qProg(id) >= QUESTS[id].need; };
  function npcMark(id: string): string {
    let m = "";
    for (const q of QORDER) {
      if (QUESTS[q].giver !== id) continue;
      if (qReady(q)) return "?";
      if (qAvail(q)) m = "!";
      else if (!m && P.q[q] && P.q[q].s === "active") m = "…";
    }
    return m;
  }
  function completeQuest(id: string): void {
    const q = QUESTS[id];
    if (q.item) removeItem(q.item, q.need);
    P.q[id].s = "done";
    P.gold += q.rew.gold;
    for (const it of q.rew.items) addItem(it[0], it[1]);
    log("Ukończono zadanie: " + q.n, "#f5d98a");
    log("Nagroda: " + q.rew.xp + " PD, " + q.rew.gold + " zł" + q.rew.items.map((i: any[]) => ", " + ITEMS[i[0]].n + (i[1] > 1 ? " x" + i[1] : "")).join(""), "#f5d98a");
    const p = rpos(pl2());
    burst(p[0] + 16, p[1] + 10, "#f5d98a", 24, 80);
    gainXp(q.rew.xp);
    save();
  }
  function talk(id: string): void {
    const n = NPCS[id];
    pl.talk = null; pl.target = null; pl.path = [];
    const extra: any[] = [];
    if (n.shop) extra.push({ l: "Pokaż towary", fn: () => { dlg = null; panel = "shop"; shopId = n.shop; shopTab = "buy"; sellPage = 0; } });
    if (n.heal) extra.push({ l: "Odpocznij przy ognisku", fn: () => { P.hp = maxHp(); dlg = { name: n.n, text: "Ciepło ogniska koi rany. Twoje zdrowie zostało w pełni przywrócone.", opts: [{ l: "Dziękuję", fn: () => { dlg = null; } }] }; const p = rpos(pl2()); burst(p[0] + 16, p[1] + 14, "#7dff8a", 18, 50); } });
    const bye = { l: "Do widzenia", fn: () => { dlg = null; } };
    for (const qid of QORDER) {
      const q = QUESTS[qid]; if (q.giver !== id) continue;
      if (qReady(qid)) { dlg = { name: n.n, text: q.thx, opts: [{ l: "Odbierz nagrodę", fn: () => { dlg = null; completeQuest(qid); } }] }; return; }
    }
    for (const qid of QORDER) {
      const q = QUESTS[qid]; if (q.giver !== id) continue;
      if (qAvail(qid)) {
        dlg = { name: n.n, text: q.offer, opts: [{ l: "Przyjmuję zadanie", fn: () => { P.q[qid] = { s: "active", c: 0 }; dlg = null; log("Nowe zadanie: " + q.n, "#9fd3ff"); save(); } }, { l: "Nie teraz", fn: () => { dlg = null; } }] };
        return;
      }
    }
    for (const qid of QORDER) {
      const q = QUESTS[qid]; if (q.giver !== id) continue;
      if (P.q[qid] && P.q[qid].s === "active") { dlg = { name: n.n, text: q.mid.replace("{c}", String(qProg(qid))).replace("{n}", String(q.need)), opts: extra.concat([bye]) }; return; }
      if (qLocked(qid)) { dlg = { name: n.n, text: q.lock, opts: extra.concat([bye]) }; return; }
    }
    dlg = { name: n.n, text: n.talk, opts: extra.concat([bye]) };
  }

  // ---------- COMBAT ----------
  function gainXp(n: number): void {
    P.xp += n;
    const p = rpos(pl2());
    ftext(p[0] + 16, p[1] - 6, "+" + n + " PD", "#9fd3ff", 13);
    while (P.xp >= xpNext(P.lvl)) {
      P.xp -= xpNext(P.lvl); P.lvl++; P.hp = maxHp();
      log("AWANS! Osiągasz poziom " + P.lvl + ".", "#ffd25a");
      fx.push({ k: "ring", x: p[0] + 16, y: p[1] + 18, life: 1.2, max: 1.2 });
      fx.push({ k: "big", t: "AWANS! Poziom " + P.lvl, life: 2.4, max: 2.4 });
      burst(p[0] + 16, p[1] + 16, "#ffd25a", 40, 110);
      save();
    }
  }
  function dmgCalc(a: number, d: number): number { return Math.max(1, Math.round(a * (0.85 + R() * 0.3) - d * 0.6)); }
  function playerAttack(m: any): void {
    if (pl.cd > 0 || m.dead) return;
    pl.cd = 0.75; pl.anim = 0.18; pl.combat = 6;
    face(pl, m.x - P.x, m.y - P.y);
    const crit = R() < 0.12;
    let d = dmgCalc(atk(), m.d.def); if (crit) d = Math.round(d * 1.7);
    m.hp -= d; m.hit = 0.15; m.aggro = true;
    const p = rpos(m);
    ftext(p[0] + 16, p[1] - 2, (crit ? "KRYT! " : "") + d, crit ? "#ffd25a" : "#ffffff", crit ? 17 : 14);
    burst(p[0] + 16, p[1] + 16, m.k === "skel" || m.k === "boss" ? "#e8e4ff" : "#d8443a", 6, 50);
    if (m.hp <= 0) killMob(m);
  }
  function killMob(m: any): void {
    m.dead = true; m.rt = m.d.resp; if (pl.target === m) pl.target = null;
    const p = rpos(m);
    burst(p[0] + 16, p[1] + 16, m.d.boss ? "#c58cff" : "#bbbbbb", m.d.boss ? 50 : 14, m.d.boss ? 120 : 60);
    log("Pokonano: " + m.d.n + ".", "#c8e6a0");
    P.kills++;
    for (const qid of QORDER) { const q = QUESTS[qid], s = P.q[qid]; if (s && s.s === "active" && q.kill === m.k) { s.c++; if (s.c <= q.need) log(q.n + ": " + s.c + "/" + q.need, "#9fd3ff"); } }
    let xp = m.d.xp; const diff = P.lvl - m.d.lvl; if (diff > 4) xp = Math.max(1, Math.round(xp * 0.3)); else if (diff > 2) xp = Math.round(xp * 0.7);
    gainXp(xp);
    const items: any[] = [];
    for (const dr of m.d.drops) if (R() < dr[1]) items.push([dr[0], 1]);
    const gold = ri(m.d.gold[0], m.d.gold[1]);
    if (items.length || gold > 0) bags.push({ area: P.area, x: m.x, y: m.y, items, gold, life: 90 });
  }
  function hurtPlayer(m: any): void {
    if (R() < 0.08) { const p = rpos(pl2()); ftext(p[0] + 16, p[1] - 2, "unik", "#9fd3ff", 12); return; }
    const d = dmgCalc(m.d.atk, def());
    P.hp -= d; pl.hit = 0.2; pl.combat = 6;
    const p = rpos(pl2());
    ftext(p[0] + 16, p[1] - 2, "-" + d, "#ff5a4a", 15);
    if (!pl.target && pl.mt >= 1 && pl.path.length === 0 && !heldDir()) pl.target = m;
    if (P.hp <= 0) die();
  }
  function die(): void {
    P.hp = 0; pl.dead = 2.2; pl.target = null; pl.path = [];
    const lost = Math.floor(P.gold * 0.1); P.gold -= lost;
    log("Poległeś! Tracisz " + lost + " zł. Budzisz się w osadzie.", "#ff8a7a");
  }
  function usePotion(): void {
    if (pl.dead) return;
    const id = countItem("pot") ? (maxHp() - P.hp > 80 && countItem("bigpot") ? "bigpot" : "pot") : countItem("bigpot") ? "bigpot" : "";
    if (!id) { log("Nie masz mikstur. Kup je u Zielarki.", "#ff8a7a"); return; }
    useItem(id);
  }
  function useItem(id: string): void {
    const it = ITEMS[id];
    if (it.t !== "p") return;
    if (P.hp >= maxHp()) { log("Masz pełne zdrowie.", "#a89c86"); return; }
    removeItem(id, 1);
    const before = P.hp; P.hp = Math.min(maxHp(), P.hp + it.heal);
    const p = rpos(pl2());
    ftext(p[0] + 16, p[1] - 4, "+" + Math.round(P.hp - before), "#7dff8a", 15);
    burst(p[0] + 16, p[1] + 16, "#7dff8a", 12, 40);
  }
  function equip(idx: number): void {
    const s = P.inv[idx]; if (!s) return; const it = ITEMS[s.id];
    if (it.t !== "w" && it.t !== "a") return;
    const slot = it.t;
    const old = P.eq[slot];
    P.inv.splice(idx, 1);
    P.eq[slot] = s.id;
    if (old) P.inv.push({ id: old, n: 1 });
    P.hp = Math.min(P.hp, maxHp());
    log("Założono: " + it.n + ".", "#c8e6a0");
    invSel = -1; save();
  }
  function unequip(slot: string): void {
    if (!P.eq[slot]) return;
    if (P.inv.length >= 20) { log("Torba jest pełna!", "#ff8a7a"); return; }
    P.inv.push({ id: P.eq[slot], n: 1 }); P.eq[slot] = null; P.hp = Math.min(P.hp, maxHp()); invSel = -1; save();
  }

  // ---------- MOVEMENT ----------
  function npcAt(x: number, y: number): string | null {
    for (const k of Object.keys(NPCS)) { const n = NPCS[k]; if (n.area === P.area && n.x === x && n.y === y) return k; }
    return null;
  }
  function mobAt(x: number, y: number): any {
    for (const m of mobs[P.area]) if (!m.dead && m.x === x && m.y === y) return m;
    return null;
  }
  function decorAt(x: number, y: number): boolean { return DECOR.some((d: any) => d.area === P.area && d.x === x && d.y === y); }
  function blocked(x: number, y: number, self: any): boolean {
    if (solidT(A(), x, y)) return true;
    if (npcAt(x, y) || decorAt(x, y)) return true;
    const m = mobAt(x, y); if (m && m !== self) return true;
    if (self !== pl && P.x === x && P.y === y) return true;
    return false;
  }
  function face(e: any, dx: number, dy: number): void {
    if (Math.abs(dx) > Math.abs(dy)) e.dir = dx < 0 ? 1 : 2; else if (dy !== 0) e.dir = dy < 0 ? 3 : 0;
  }
  function stepPlayer(dx: number, dy: number): boolean {
    face(pl, dx, dy);
    const nx = P.x + dx, ny = P.y + dy;
    if (blocked(nx, ny, pl)) return false;
    pl.fx = P.x; pl.fy = P.y; P.x = nx; P.y = ny; pl.mt = 0;
    return true;
  }
  function bfs(sx: number, sy: number, goal: (x: number, y: number) => boolean): number[][] | null {
    const a = A(); const Wd = a.w;
    if (goal(sx, sy)) return [];
    const prev = new Int32Array(a.w * a.h).fill(-1);
    const s0 = sy * Wd + sx; prev[s0] = s0; const q = [s0]; let qi = 0;
    const D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (qi < q.length && qi < 3000) {
      const c = q[qi++]; const cx = c % Wd, cy = (c - cx) / Wd;
      for (const d of D) {
        const nx = cx + d[0], ny = cy + d[1];
        if (nx < 0 || ny < 0 || nx >= a.w || ny >= a.h) continue;
        const k = ny * Wd + nx; if (prev[k] !== -1) continue;
        if (blocked(nx, ny, pl)) continue;
        prev[k] = c;
        if (goal(nx, ny)) {
          const path: number[][] = []; let p = k;
          while (p !== s0) { const px = p % Wd; path.unshift([px, (p - px) / Wd]); p = prev[p]; }
          return path;
        }
        q.push(k);
      }
    }
    return null;
  }
  function changeArea(to: string, tx: number, ty: number): void { trans = { to, tx, ty, t: 0, done: false }; }
  function onArrive(): void {
    for (const b of bags) if (!b.taken && b.area === P.area && b.x === P.x && b.y === P.y) pickBag(b);
    for (const e of A().exits) if (e.x === P.x && e.y === P.y) { changeArea(e.to, e.tx, e.ty); pl.path = []; pl.target = null; return; }
  }
  function pickBag(b: any): void {
    b.taken = true;
    const got: string[] = [];
    if (b.gold) { P.gold += b.gold; got.push(b.gold + " zł"); }
    for (const it of b.items) if (addItem(it[0], it[1])) got.push(ITEMS[it[0]].n);
    if (got.length) log("Łup: " + got.join(", "), "#f5d98a");
    ftext(b.x * TS + 16, b.y * TS, b.gold ? "+" + b.gold + " zł" : "łup", "#f5d98a", 13);
  }
  function heldDir(): number[] | null {
    let dx = 0, dy = 0;
    if (keys["ArrowLeft"] || keys["a"]) dx = -1; else if (keys["ArrowRight"] || keys["d"]) dx = 1;
    if (keys["ArrowUp"] || keys["w"]) dy = -1; else if (keys["ArrowDown"] || keys["s"]) dy = 1;
    for (const k of Object.keys(holds)) { const v = holds[Number(k)]; if (v === 0) dy = -1; if (v === 1) dy = 1; if (v === 2) dx = -1; if (v === 3) dx = 1; }
    if (dx === 0 && dy === 0) return null;
    return [dx, dy];
  }
  function nearestMob(r: number): any {
    let best: any = null, bd = 1e9;
    for (const m of mobs[P.area]) {
      if (m.dead) continue;
      const d = Math.abs(m.x - P.x) + Math.abs(m.y - P.y) * 1.01;
      if (cheb(m.x, m.y, P.x, P.y) <= r && d < bd) { bd = d; best = m; }
    }
    return best;
  }
  function attackKey(): void {
    if (pl.dead || dlg) return;
    if (pl.target && !pl.target.dead) { if (cheb(pl.target.x, pl.target.y, P.x, P.y) <= 1) playerAttack(pl.target); return; }
    const m = nearestMob(1) || nearestMob(7);
    if (m) { pl.target = m; pl.talk = null; pl.path = []; pl.repath = 0; if (cheb(m.x, m.y, P.x, P.y) <= 1) playerAttack(m); }
    else log("W pobliżu nie ma przeciwników.", "#a89c86");
  }
  function talkKey(): void {
    if (dlg) { if (dlg.opts.length === 1) dlg.opts[0].fn(); return; }
    for (const k of Object.keys(NPCS)) { const n = NPCS[k]; if (n.area === P.area && cheb(n.x, n.y, P.x, P.y) <= 1) { talk(k); return; } }
    for (const k of Object.keys(NPCS)) { const n = NPCS[k]; if (n.area === P.area && cheb(n.x, n.y, P.x, P.y) <= 6) { pl.talk = k; pl.target = null; pl.path = []; return; } }
  }

  function updatePlayer(dt: number): void {
    pl.cd = Math.max(0, pl.cd - dt); pl.anim = Math.max(0, pl.anim - dt); pl.hit = Math.max(0, pl.hit - dt);
    pl.combat = Math.max(0, (pl.combat || 0) - dt);
    if (!pl.dead && pl.combat <= 0 && P.hp < maxHp()) P.hp = Math.min(maxHp(), P.hp + maxHp() * 0.02 * dt);
    if (pl.dead > 0) {
      pl.dead -= dt;
      if (pl.dead <= 0) { pl.dead = 0; P.hp = maxHp(); changeArea("village", 18, 17); }
      return;
    }
    if (pl.mt < 1) {
      pl.mt = Math.min(1, pl.mt + dt * 5); pl.phase += dt * 14;
      if (pl.mt >= 1) onArrive();
      if (pl.mt < 1 || trans) return;
    }
    if (dlg || trans) return;
    const hd = heldDir();
    if (hd) {
      pl.path = []; pl.target = null; pl.talk = null; clickMark = null;
      if (hd[0]) { if (!stepPlayer(hd[0], 0) && hd[1]) stepPlayer(0, hd[1]); }
      else stepPlayer(0, hd[1]);
      return;
    }
    if (pl.target) {
      const m = pl.target;
      if (m.dead) { pl.target = null; return; }
      if (cheb(m.x, m.y, P.x, P.y) <= 1) { pl.path = []; face(pl, m.x - P.x, m.y - P.y); if (pl.cd <= 0) playerAttack(m); return; }
      pl.repath -= dt;
      if (pl.repath <= 0 || pl.path.length === 0) {
        pl.repath = 0.4;
        const p = bfs(P.x, P.y, (x: number, y: number) => cheb(x, y, m.x, m.y) <= 1);
        if (!p) { pl.target = null; return; }
        pl.path = p;
      }
    }
    if (pl.talk) {
      const n = NPCS[pl.talk];
      if (cheb(n.x, n.y, P.x, P.y) <= 1) { face(pl, n.x - P.x, n.y - P.y); talk(pl.talk); return; }
      if (pl.path.length === 0) { const p = bfs(P.x, P.y, (x: number, y: number) => cheb(x, y, n.x, n.y) <= 1); if (!p) { pl.talk = null; return; } pl.path = p; }
    }
    if (pl.path.length) {
      const nx = pl.path[0];
      if (stepPlayer(nx[0] - P.x, nx[1] - P.y)) pl.path.shift();
      else { pl.path = []; pl.repath = 0; }
      if (!pl.path.length) clickMark = null;
    }
  }
  function updateMobs(dt: number): void {
    const a = A();
    for (const m of mobs[P.area]) {
      m.hit = Math.max(0, m.hit - dt); m.anim = Math.max(0, m.anim - dt);
      if (m.dead) {
        m.rt -= dt;
        if (m.rt <= 0 && cheb(m.hx, m.hy, P.x, P.y) > 5 && !mobAt(m.hx, m.hy)) {
          m.dead = false; m.hp = m.d.hp; m.x = m.fx = m.hx; m.y = m.fy = m.hy; m.mt = 1; m.aggro = false;
        }
        continue;
      }
      if (m.mt < 1) { m.mt = Math.min(1, m.mt + dt * m.d.spd); continue; }
      m.cd = Math.max(0, m.cd - dt);
      const dist = cheb(m.x, m.y, P.x, P.y);
      const home = cheb(m.x, m.y, m.hx, m.hy);
      if (pl.dead) m.aggro = false;
      if (!m.aggro && !pl.dead && m.d.aggro > 0 && dist <= m.d.aggro && P.lvl < m.d.lvl + 6) m.aggro = true;
      if (m.aggro && (home > 11 || dist > 12)) { m.aggro = false; m.hp = Math.min(m.d.hp, m.hp + m.d.hp * 0.5); if (pl.target === m) pl.target = null; }
      const step = (dx: number, dy: number): boolean => {
        if (!dx && !dy) return false;
        const nx = m.x + dx, ny = m.y + dy;
        if (blocked(nx, ny, m)) return false;
        if (a.exits.some((e: Exit) => e.x === nx && e.y === ny)) return false;
        face(m, dx, dy); m.fx = m.x; m.fy = m.y; m.x = nx; m.y = ny; m.mt = 0; return true;
      };
      if (m.aggro && !pl.dead) {
        if (dist <= 1) {
          face(m, P.x - m.x, P.y - m.y);
          if (m.cd <= 0) { m.cd = m.d.cd; m.anim = 0.2; hurtPlayer(m); }
        } else {
          const dx = Math.sign(P.x - m.x), dy = Math.sign(P.y - m.y);
          const prefX = Math.abs(P.x - m.x) >= Math.abs(P.y - m.y);
          if (prefX) { if (!step(dx, 0)) step(0, dy); } else { if (!step(0, dy)) step(dx, 0); }
        }
      } else {
        m.wt -= dt;
        if (m.wt <= 0) {
          m.wt = 1.5 + R() * 3;
          const D = [[1, 0], [-1, 0], [0, 1], [0, -1]][ri(0, 3)];
          if (cheb(m.x + D[0], m.y + D[1], m.hx, m.hy) <= 3) step(D[0], D[1]);
          else if (!step(Math.sign(m.hx - m.x), 0)) step(0, Math.sign(m.hy - m.y));
          if (m.hp < m.d.hp) m.hp = Math.min(m.d.hp, m.hp + m.d.hp * 0.2);
        }
      }
    }
  }
  function update(dt: number): void {
    time += dt;
    banner = Math.max(0, banner - dt);
    if (resetArm > 0) resetArm -= dt;
    if (trans) {
      trans.t += dt;
      if (!trans.done && trans.t >= 0.25) {
        trans.done = true; P.area = trans.to; P.x = trans.tx; P.y = trans.ty; pl.fx = P.x; pl.fy = P.y; pl.mt = 1; pl.path = []; pl.target = null; pl.talk = null;
        const m = mobAt(P.x, P.y); if (m) { m.x = m.fx = m.hx; m.y = m.fy = m.hy; }
        banner = 3; clickMark = null; panel = ""; dlg = null; save();
      }
      if (trans.t >= 0.6) trans = null;
    }
    updatePlayer(dt);
    if (!trans) updateMobs(dt);
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i]; f.life -= dt;
      if (f.k === "p") { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 120 * dt; }
      if (f.k === "txt") f.y -= 28 * dt;
      if (f.life <= 0) fx.splice(i, 1);
    }
    for (let i = bags.length - 1; i >= 0; i--) { bags[i].life -= dt; if (bags[i].life <= 0 || bags[i].taken) bags.splice(i, 1); }
    for (const m of msgs) m.life -= dt;
    while (msgs.length && msgs[0].life <= 0) msgs.shift();
    if (time - lastSave > 8) { lastSave = time; save(); }
    if (!P.intro && !dlg) {
      P.intro = true;
      dlg = { name: "Ardan: Kroniki Mgieł", text: touchMode ? "Mgła spowiła okolice Osady Brzozowej. Porozmawiaj z Sołtysem Radomirem (żółty wykrzyknik nad głową). Dotknij mapy, aby iść, dotknij potwora, aby walczyć, albo użyj krzyżaka i przycisków na ekranie." : "Mgła spowiła okolice Osady Brzozowej. Porozmawiaj z Sołtysem Radomirem (żółty wykrzyknik). Sterowanie: WASD/strzałki lub kliknięcie na mapie, Spacja – atak, E – rozmowa, I – torba, Q – zadania, H – mikstura, Esc – zamknij.", opts: [{ l: "Zaczynajmy!", fn: () => { dlg = null; save(); } }] };
    }
  }

  // ---------- DRAW: ENTITIES ----------
  function drawWeapon(x: number, y: number, col: string): void {
    const g = ctx;
    g.fillStyle = col; g.fillRect(x + 1, y, 3, 13);
    g.fillStyle = "rgba(255,255,255,0.5)"; g.fillRect(x + 1, y, 1, 12);
    g.fillStyle = "#5a3a1e"; g.fillRect(x - 1, y + 12, 7, 2); g.fillRect(x + 1, y + 14, 3, 4);
  }
  function drawHuman(x: number, y: number, dir: number, walk: number, c: any, wcol: string | null, acol: string | null, flash: boolean, lunge: number): void {
    const g = ctx;
    if (lunge > 0) { const k = Math.sin((lunge / 0.18) * Math.PI) * 4; if (dir === 0) y += k; else if (dir === 3) y -= k; else if (dir === 1) x -= k; else x += k; }
    const bob = walk ? Math.abs(Math.sin(walk)) * 1.5 : 0;
    const leg = walk ? Math.sin(walk) * 2.5 : 0;
    g.fillStyle = "rgba(0,0,0,0.28)"; g.beginPath(); g.ellipse(x + 16, y + 29, 9, 3, 0, 0, Math.PI * 2); g.fill();
    y -= bob;
    g.fillStyle = "#3a2a20"; g.fillRect(x + 11, y + 22, 4, 7 + leg); g.fillRect(x + 17, y + 22, 4, 7 - leg);
    const body = acol || c.body;
    if (wcol && dir === 3) drawWeapon(x + 24, y + 6, wcol);
    g.fillStyle = body; g.fillRect(x + 9, y + 13, 14, 10);
    if (c.long) g.fillRect(x + 8, y + 20, 16, 6);
    if (c.apron) { g.fillStyle = "#3a2a1a"; g.fillRect(x + 11, y + 15, 10, 10); }
    g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(x + 9, y + 21, 14, 2);
    g.fillStyle = body; g.fillRect(x + 6, y + 14, 3, 8); g.fillRect(x + 23, y + 14, 3, 8);
    g.fillStyle = c.skin; g.fillRect(x + 6, y + 21, 3, 2); g.fillRect(x + 23, y + 21, 3, 2);
    g.fillRect(x + 10, y + 3, 12, 11);
    g.fillStyle = c.hair;
    if (dir === 3) g.fillRect(x + 10, y + 2, 12, 11);
    else {
      g.fillRect(x + 10, y + 2, 12, 4);
      if (dir === 1) g.fillRect(x + 17, y + 2, 5, 9);
      if (dir === 2) g.fillRect(x + 10, y + 2, 5, 9);
      if (c.long) { g.fillRect(x + 9, y + 4, 3, 11); g.fillRect(x + 20, y + 4, 3, 11); }
    }
    if (c.helmet) { g.fillStyle = "#9aa2ab"; g.fillRect(x + 9, y + 1, 14, 5); g.fillStyle = "#c8ced5"; g.fillRect(x + 10, y + 1, 12, 1); }
    if (dir !== 3) {
      g.fillStyle = c.eye || "#1a1a1a";
      if (dir === 0) { g.fillRect(x + 13, y + 8, 2, 2); g.fillRect(x + 17, y + 8, 2, 2); }
      if (dir === 1) g.fillRect(x + 11, y + 8, 2, 2);
      if (dir === 2) g.fillRect(x + 19, y + 8, 2, 2);
      if (c.beard) { g.fillStyle = c.hair; g.fillRect(x + 11, y + 11, 10, 4); }
    }
    if (wcol && dir !== 3) drawWeapon(dir === 1 ? x + 3 : x + 24, y + 8, wcol);
    if (flash) { g.fillStyle = "rgba(255,80,60,0.45)"; g.fillRect(x + 6, y + 2, 20, 27); }
  }
  function label(cx: number, y: number, t: string, col: string): void {
    ctx.font = "bold 10px " + FONT; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    const w = ctx.measureText(t).width;
    ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(cx - w / 2 - 3, y - 10, w + 6, 13);
    ctx.fillStyle = col; ctx.fillText(t, cx, y);
  }
  function drawMob(m: any): void {
    const p = rpos(m); let x = p[0], y = p[1];
    const g = ctx; const k = m.k; const flash = m.hit > 0;
    const walk = m.mt < 1 ? time * 14 : 0;
    if (m.anim > 0) { const s = Math.sin((m.anim / 0.2) * Math.PI) * 4; const D = [[0, 1], [-1, 0], [1, 0], [0, -1]][m.dir]; x += D[0] * s; y += D[1] * s; }
    if (k === "goblin") drawHuman(x, y, m.dir, walk, { body: "#5a4a2a", skin: "#6aa84f", hair: "#3d5f2a", eye: "#ff3030" }, "#8a8f96", null, flash, 0);
    else if (k === "skel") { drawHuman(x, y, m.dir, walk, { body: "#d8d2c0", skin: "#ece6d4", hair: "#ece6d4", eye: "#ff4040" }, "#7a7f88", null, flash, 0); g.fillStyle = "#3a3640"; g.fillRect(x + 11, y + 15, 10, 1); g.fillRect(x + 11, y + 18, 10, 1); }
    else {
      g.fillStyle = "rgba(0,0,0,0.28)"; g.beginPath(); g.ellipse(x + 16, y + 28, k === "boss" ? 15 : 11, 4, 0, 0, Math.PI * 2); g.fill();
      const leg = walk ? Math.sin(walk) * 2 : 0;
      const left = m.dir === 1;
      const fl = (rx: number, ry: number, w: number, h: number): void => { g.fillRect(left ? x + 32 - rx - w : x + rx, y + ry, w, h); };
      if (k === "rat") {
        g.fillStyle = "#d89a9a"; fl(2, 22, 8, 2);
        g.fillStyle = "#8a7f73"; fl(8, 17, 14, 9); fl(20, 15, 7, 8);
        g.fillStyle = "#6e645a"; fl(19, 13, 3, 3); fl(10, 25, 3, 3 + leg); fl(18, 25, 3, 3 - leg);
        g.fillStyle = "#e05050"; fl(24, 17, 2, 2); g.fillStyle = "#f0b0b0"; fl(27, 19, 2, 2);
      } else if (k === "wolf") {
        g.fillStyle = "#6d7076"; fl(2, 12, 6, 3);
        g.fillStyle = "#8d8f94"; fl(6, 13, 18, 10); fl(21, 8, 9, 9);
        g.fillStyle = "#6d7076"; fl(22, 5, 3, 4); fl(27, 5, 3, 4); fl(8, 22, 3, 6 + leg); fl(19, 22, 3, 6 - leg); fl(12, 22, 3, 5 - leg);
        g.fillStyle = "#c8cacf"; fl(8, 19, 14, 3); g.fillStyle = "#ffd84a"; fl(26, 10, 2, 2); g.fillStyle = "#222"; fl(29, 13, 2, 2);
      } else if (k === "boar") {
        g.fillStyle = "#5b3b25"; fl(4, 12, 20, 13); fl(20, 13, 9, 10);
        g.fillStyle = "#3e2716"; fl(6, 10, 16, 3); fl(7, 24, 3, 4 + leg); fl(18, 24, 3, 4 - leg);
        g.fillStyle = "#c48a6a"; fl(27, 17, 4, 5); g.fillStyle = "#f1ead6"; fl(26, 21, 2, 4); fl(29, 21, 2, 4);
        g.fillStyle = "#111"; fl(24, 15, 2, 2);
      } else if (k === "spider") {
        g.strokeStyle = "#1a1418"; g.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const yy = y + 15 + i * 3, w2 = Math.sin(time * 10 + i) * (m.mt < 1 ? 2 : 0.5);
          g.beginPath(); g.moveTo(x + 12, yy); g.lineTo(x + 4, yy - 5 + w2); g.lineTo(x + 1, yy + 6); g.stroke();
          g.beginPath(); g.moveTo(x + 20, yy); g.lineTo(x + 28, yy - 5 - w2); g.lineTo(x + 31, yy + 6); g.stroke();
        }
        g.fillStyle = "#2a2028"; g.beginPath(); g.ellipse(x + 16, y + 20, 8, 7, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#3a2c38"; g.beginPath(); g.ellipse(x + 16, y + 12, 5, 4, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#c03030"; g.fillRect(x + 13, y + 20, 6, 2);
        g.fillStyle = "#ff3a3a"; g.fillRect(x + 13, y + 11, 2, 2); g.fillRect(x + 17, y + 11, 2, 2);
      } else if (k === "boss") {
        const yy = y - 10 + Math.sin(time * 2.5) * 3;
        const grd = g.createRadialGradient(x + 16, yy + 18, 2, x + 16, yy + 18, 34);
        grd.addColorStop(0, "rgba(197,140,255,0.45)"); grd.addColorStop(1, "rgba(197,140,255,0)");
        g.fillStyle = grd; g.fillRect(x - 20, yy - 16, 72, 72);
        g.fillStyle = "rgba(120,90,170,0.9)";
        g.beginPath(); g.moveTo(x + 2, yy + 36);
        for (let i = 0; i <= 6; i++) g.lineTo(x + 2 + i * 4.67, yy + 36 + (i % 2 ? -5 : 0) + Math.sin(time * 6 + i) * 2);
        g.lineTo(x + 30, yy + 14); g.quadraticCurveTo(x + 16, yy - 8, x + 2, yy + 14); g.closePath(); g.fill();
        g.fillStyle = "rgba(60,40,90,0.95)"; g.beginPath(); g.ellipse(x + 16, yy + 13, 9, 9, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#7fe9ff"; g.fillRect(x + 11, yy + 11, 3, 3); g.fillRect(x + 18, yy + 11, 3, 3);
        g.fillStyle = "rgba(200,170,255,0.8)"; g.fillRect(x - 2, yy + 18, 5, 3); g.fillRect(x + 29, yy + 18, 5, 3);
      }
      if (flash) { g.fillStyle = "rgba(255,255,255,0.45)"; g.fillRect(x + 2, y + 6, 28, 22); }
    }
    const tgt = pl.target === m, hv = hover && hover.m === m;
    if (m.hp < m.d.hp || tgt || m.d.boss) {
      const bw = m.d.boss ? 40 : 26, bx = x + 16 - bw / 2, by = y - (m.d.boss ? 18 : 6);
      g.fillStyle = "rgba(0,0,0,0.6)"; g.fillRect(bx - 1, by - 1, bw + 2, 5);
      g.fillStyle = "#d83a2e"; g.fillRect(bx, by, bw * Math.max(0, m.hp / m.d.hp), 3);
    }
    if (tgt || hv) label(x + 16, y - (m.d.boss ? 22 : 10), m.d.n + " (" + m.d.lvl + ")", m.d.lvl > P.lvl + 2 ? "#ff8a7a" : m.d.lvl < P.lvl - 3 ? "#a8a8a8" : "#ffe9a8");
    if (tgt) { g.strokeStyle = "rgba(255,80,60,0.85)"; g.lineWidth = 1.5; g.beginPath(); g.ellipse(x + 16, y + 28, 13, 5, 0, 0, Math.PI * 2); g.stroke(); }
  }
  function drawNpc(id: string): void {
    const n = NPCS[id]; const x = n.x * TS, y = n.y * TS;
    let dir = 0; if (cheb(n.x, n.y, P.x, P.y) <= 3) { const dx = P.x - n.x, dy = P.y - n.y; dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0; }
    drawHuman(x, y, dir, 0, n.c, n.shop === "smith" ? "#7a7f88" : null, null, false, 0);
    label(x + 16, y - 3, n.n, "#bfe3ff");
    const mk = npcMark(id);
    if (mk) {
      const bob = Math.sin(time * 4) * 2;
      ctx.font = "bold 18px " + FONT; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#000"; ctx.fillText(mk, x + 17, y - 15 + bob);
      ctx.fillStyle = mk === "…" ? "#c8c8c8" : "#ffd84a"; ctx.fillText(mk, x + 16, y - 16 + bob);
    }
  }
  function drawDecor(d: any): void {
    const x = d.x * TS, y = d.y * TS, g = ctx;
    if (d.k === "fire") {
      g.fillStyle = "#5a3a1e"; g.fillRect(x + 6, y + 24, 20, 4); g.fillRect(x + 10, y + 21, 12, 4);
      g.fillStyle = "#7a7a7a"; for (let i = 0; i < 6; i++) g.fillRect(x + 4 + i * 4, y + 27, 3, 3);
      const fc = ["#ff6a1a", "#ffb02e", "#fff07a"];
      for (let i = 0; i < 3; i++) {
        const f = Math.sin(time * 9 + i * 2) * 3;
        g.fillStyle = fc[i];
        g.beginPath(); g.moveTo(x + 9 + i * 2, y + 24); g.lineTo(x + 16, y + 6 + i * 5 + f); g.lineTo(x + 23 - i * 2, y + 24); g.fill();
      }
      const grd = g.createRadialGradient(x + 16, y + 18, 2, x + 16, y + 18, 60);
      grd.addColorStop(0, "rgba(255,170,60,0.25)"); grd.addColorStop(1, "rgba(255,170,60,0)");
      g.fillStyle = grd; g.fillRect(x - 44, y - 42, 120, 120);
    } else if (d.k === "crate") {
      g.fillStyle = "#8a5a2b"; g.fillRect(x + 4, y + 8, 24, 22); g.fillStyle = "#5e3c1c"; g.fillRect(x + 4, y + 8, 24, 2); g.fillRect(x + 4, y + 18, 24, 2); g.fillRect(x + 4, y + 8, 2, 22); g.fillRect(x + 26, y + 8, 2, 22);
    } else {
      g.fillStyle = "#7a4a24"; g.fillRect(x + 7, y + 6, 18, 24); g.fillStyle = "#4a4a50"; g.fillRect(x + 6, y + 10, 20, 2); g.fillRect(x + 6, y + 24, 20, 2); g.fillStyle = "#9a6a3a"; g.fillRect(x + 9, y + 6, 3, 24);
    }
  }
  function drawBag(b: any): void {
    const x = b.x * TS, y = b.y * TS + Math.sin(time * 3 + b.x) * 1.5, g = ctx;
    g.fillStyle = "rgba(0,0,0,0.25)"; g.beginPath(); g.ellipse(x + 16, y + 27, 8, 3, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#a0723c"; g.beginPath(); g.ellipse(x + 16, y + 21, 8, 7, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#7a5228"; g.fillRect(x + 12, y + 12, 8, 4);
    g.fillStyle = "#f5d98a"; g.fillRect(x + 14, y + 19, 4, 4);
    if (Math.sin(time * 5 + b.y) > 0.7) { g.fillStyle = "#fff8c0"; g.fillRect(x + 21, y + 13, 2, 2); }
  }
  function drawIcon(id: string, x: number, y: number, s: number): void {
    const it = ITEMS[id], g = ctx, k = s / 32;
    g.save(); g.translate(x, y); g.scale(k, k);
    const c = it.c;
    switch (it.ic) {
      case "sword": g.translate(16, 16); g.rotate(-Math.PI / 4); g.fillStyle = c; g.fillRect(-2, -14, 4, 20); g.fillStyle = "rgba(255,255,255,0.5)"; g.fillRect(-2, -14, 1, 19); g.fillStyle = "#6b4a2b"; g.fillRect(-6, 6, 12, 3); g.fillRect(-1.5, 9, 3, 6); break;
      case "club": g.translate(16, 16); g.rotate(-Math.PI / 4); g.fillStyle = c; g.fillRect(-3, -13, 7, 14); g.fillStyle = "#6b4a2b"; g.fillRect(-1.5, 1, 3, 13); break;
      case "axe": g.translate(16, 16); g.rotate(-Math.PI / 4); g.fillStyle = "#6b4a2b"; g.fillRect(-1.5, -12, 3, 26); g.fillStyle = c; g.beginPath(); g.moveTo(1, -12); g.lineTo(11, -15); g.lineTo(11, -1); g.lineTo(1, -4); g.fill(); break;
      case "shirt": case "armor":
        g.fillStyle = c; g.fillRect(8, 8, 16, 18); g.fillRect(3, 8, 6, 10); g.fillRect(23, 8, 6, 10); g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(13, 8, 6, 4);
        if (it.ic === "armor") { g.fillStyle = "rgba(255,255,255,0.3)"; g.fillRect(10, 14, 12, 2); g.fillRect(10, 19, 12, 2); }
        break;
      case "pot": g.fillStyle = "#cfd8e0"; g.fillRect(13, 4, 6, 6); g.fillStyle = "#8a5a2b"; g.fillRect(13, 3, 6, 3); g.fillStyle = c; g.beginPath(); g.arc(16, 19, 9, 0, Math.PI * 2); g.fill(); g.fillStyle = "rgba(255,255,255,0.5)"; g.fillRect(11, 14, 3, 4); break;
      case "tail": g.strokeStyle = c; g.lineWidth = 3; g.beginPath(); g.moveTo(6, 24); g.quadraticCurveTo(16, 4, 26, 20); g.stroke(); break;
      case "pelt": g.fillStyle = c; g.beginPath(); g.moveTo(6, 8); g.lineTo(26, 8); g.lineTo(28, 26); g.lineTo(16, 22); g.lineTo(4, 26); g.closePath(); g.fill(); g.fillStyle = "#6d7076"; g.fillRect(10, 12, 12, 2); break;
      case "tusk": g.fillStyle = c; g.beginPath(); g.moveTo(8, 26); g.quadraticCurveTo(10, 6, 26, 6); g.quadraticCurveTo(14, 12, 13, 26); g.closePath(); g.fill(); break;
      case "ear": g.fillStyle = c; g.beginPath(); g.moveTo(8, 24); g.lineTo(26, 6); g.lineTo(20, 26); g.closePath(); g.fill(); break;
      case "silk": g.strokeStyle = c; g.lineWidth = 1.5; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(16, 16, 3 + i * 3.5, 0, Math.PI * 2); g.stroke(); } break;
      case "bone": g.translate(16, 16); g.rotate(-Math.PI / 4); g.fillStyle = c; g.fillRect(-2, -10, 4, 20); g.beginPath(); g.arc(-2.5, -11, 3, 0, 7); g.arc(2.5, -11, 3, 0, 7); g.fill(); g.beginPath(); g.arc(-2.5, 11, 3, 0, 7); g.arc(2.5, 11, 3, 0, 7); g.fill(); break;
      case "gem": g.fillStyle = c; g.beginPath(); g.moveTo(16, 4); g.lineTo(26, 14); g.lineTo(16, 28); g.lineTo(6, 14); g.closePath(); g.fill(); g.fillStyle = "rgba(255,255,255,0.6)"; g.fillRect(12, 10, 4, 4); break;
    }
    g.restore();
  }

  // ---------- DRAW: UI HELPERS ----------
  const COL = { bg: "rgba(24,19,30,0.94)", bd: "#c9a45c", title: "#f5d98a", text: "#efe6d2", mute: "#a89c86", btn: "#3b3046", btnH: "#4d3f5c", good: "#7dff8a", bad: "#ff8a7a" };
  function rr(x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function box(x: number, y: number, w: number, h: number): void {
    rr(x, y, w, h, 8); ctx.fillStyle = COL.bg; ctx.fill(); ctx.strokeStyle = COL.bd; ctx.lineWidth = 1.5; ctx.stroke();
  }
  function text(t: string, x: number, y: number, size: number, col: string, align?: CanvasTextAlign, bold?: boolean): void {
    ctx.font = (bold ? "bold " : "") + size + "px " + FONT; ctx.textAlign = align || "left"; ctx.textBaseline = "middle"; ctx.fillStyle = col; ctx.fillText(t, x, y);
  }
  function wrap(t: string, maxW: number, size: number): string[] {
    ctx.font = size + "px " + FONT;
    const words = t.split(" "); const lines: string[] = []; let cur = "";
    for (const w of words) { const n = cur ? cur + " " + w : w; if (ctx.measureText(n).width > maxW && cur) { lines.push(cur); cur = w; } else cur = n; }
    if (cur) lines.push(cur);
    return lines;
  }
  function button(x: number, y: number, w: number, h: number, lbl: string, fn: () => void, o?: any): void {
    const dis = o && o.dis; const hv = mouse && mouse.x >= x && mouse.x <= x + w && mouse.y >= y && mouse.y <= y + h;
    rr(x, y, w, h, 6); ctx.fillStyle = dis ? "rgba(60,55,65,0.8)" : o && o.col ? o.col : hv ? COL.btnH : COL.btn; ctx.fill();
    ctx.strokeStyle = dis ? "#6a6070" : COL.bd; ctx.lineWidth = 1; ctx.stroke();
    text(lbl, x + w / 2, y + h / 2 + 0.5, (o && o.fs) || 13, dis ? "#8a8090" : COL.text, "center", true);
    if (!dis) ui.push({ x, y, w, h, fn });
  }
  function closeBtn(x: number, y: number, fn: () => void): void { button(x - 32, y + 6, 26, 26, "✕", fn, { fs: 13 }); }
  function bar(x: number, y: number, w: number, h: number, v: number, col: string, bg: string): void {
    ctx.fillStyle = bg; rr(x, y, w, h, h / 2); ctx.fill();
    if (v > 0) { ctx.fillStyle = col; rr(x, y, Math.max(h, w * clamp(v, 0, 1)), h, h / 2); ctx.fill(); }
  }

  // ---------- DRAW: MAIN ----------
  function draw(): void {
    ui = [];
    const a = A();
    const isSmall = W < 520;
    S = clamp(Math.min(W / (isSmall ? 11.5 : 15), H / 11) / TS, 0.7, 2);
    const vw = W / S, vh = H / S;
    const pp = rpos(pl2());
    const mw = a.w * TS, mh = a.h * TS;
    camX = mw <= vw ? (mw - vw) / 2 : clamp(pp[0] + 16 - vw / 2, 0, mw - vw);
    camY = mh <= vh ? (mh - vh) / 2 : clamp(pp[1] + 16 - vh / 2, 0, mh - vh);
    camX = Math.round(camX * S) / S; camY = Math.round(camY * S) / S;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = a.dark ? "#0b090e" : "#1d3a18"; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.scale(S, S); ctx.translate(-camX, -camY);
    ctx.imageSmoothingEnabled = false;
    if (a.img) {
      const sx = Math.max(0, Math.floor(camX)), sy = Math.max(0, Math.floor(camY));
      const sw = Math.min(mw - sx, Math.ceil(vw) + 2), sh = Math.min(mh - sy, Math.ceil(vh) + 2);
      if (sw > 0 && sh > 0) ctx.drawImage(a.img, sx, sy, sw, sh, sx, sy, sw, sh);
    }
    const tx0 = Math.max(0, Math.floor(camX / TS)), ty0 = Math.max(0, Math.floor(camY / TS));
    const tx1 = Math.min(a.w - 1, Math.ceil((camX + vw) / TS)), ty1 = Math.min(a.h - 1, Math.ceil((camY + vh) / TS));
    for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
      const t = gt(a, x, y);
      if (t === WATER) {
        const o = (Math.sin(time * 1.6 + x * 0.9 + y * 0.6) + 1) * 6;
        ctx.fillStyle = "rgba(200,235,255,0.35)"; ctx.fillRect(x * TS + 4 + o, y * TS + 10 + ((x * 7) % 12), 7, 2);
      } else if (t === PORTAL) {
        const gl = 0.35 + Math.sin(time * 3) * 0.15;
        const grd = ctx.createRadialGradient(x * TS + 16, y * TS + 22, 2, x * TS + 16, y * TS + 22, 26);
        grd.addColorStop(0, "rgba(197,140,255," + gl.toFixed(3) + ")"); grd.addColorStop(1, "rgba(197,140,255,0)");
        ctx.fillStyle = grd; ctx.fillRect(x * TS - 12, y * TS - 8, 56, 56);
      }
    }
    for (const e of a.exits) if (gt(a, e.x, e.y) === PATH) {
      const al = 0.25 + Math.sin(time * 3) * 0.12;
      ctx.fillStyle = "rgba(255,230,140," + al.toFixed(3) + ")"; ctx.fillRect(e.x * TS + 4, e.y * TS + 4, 24, 24);
    }
    if (clickMark) { const k = (time * 2) % 1; ctx.strokeStyle = "rgba(255,240,170," + (1 - k).toFixed(3) + ")"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(clickMark[0] * TS + 16, clickMark[1] * TS + 20, 6 + k * 6, 3 + k * 3, 0, 0, Math.PI * 2); ctx.stroke(); }
    for (const b of bags) if (b.area === P.area) drawBag(b);
    const ents: any[] = [];
    for (const k of Object.keys(NPCS)) if (NPCS[k].area === P.area) ents.push({ y: NPCS[k].y * TS, f: () => drawNpc(k) });
    for (const d of DECOR) if (d.area === P.area) ents.push({ y: d.y * TS, f: () => drawDecor(d) });
    for (const m of mobs[P.area]) if (!m.dead) ents.push({ y: rpos(m)[1], f: () => drawMob(m) });
    if (!pl.dead) ents.push({ y: pp[1] + 0.5, f: () => {
      const w = P.eq.w ? ITEMS[P.eq.w].c : null, ar = P.eq.a && P.eq.a !== "shirt" ? ITEMS[P.eq.a].c : null;
      drawHuman(pp[0], pp[1], pl.dir, pl.mt < 1 ? pl.phase : 0, { body: "#3f6fb5", skin: "#f0c9a0", hair: "#6a3e1f" }, w, ar, pl.hit > 0, pl.anim);
    } });
    ents.sort((p: any, q: any) => p.y - q.y);
    for (const e of ents) e.f();
    for (const f of fx) {
      const al = clamp(f.life / (f.max * 0.5), 0, 1);
      if (f.k === "p") { ctx.globalAlpha = al; ctx.fillStyle = f.c; ctx.fillRect(f.x - 1.5, f.y - 1.5, 3, 3); ctx.globalAlpha = 1; }
      else if (f.k === "txt") { ctx.globalAlpha = al; ctx.font = "bold " + f.s + "px " + FONT; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = "#000"; ctx.fillText(f.t, f.x + 1, f.y + 1); ctx.fillStyle = f.c; ctx.fillText(f.t, f.x, f.y); ctx.globalAlpha = 1; }
      else if (f.k === "ring") {
        const k = 1 - f.life / f.max;
        ctx.strokeStyle = "rgba(255,210,90," + (1 - k).toFixed(3) + ")"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(f.x, f.y, 10 + k * 50, 4 + k * 20, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "rgba(255,230,140," + (0.3 * (1 - k)).toFixed(3) + ")"; ctx.fillRect(f.x - 12, f.y - 60 * (1 - k * 0.3), 24, 60);
      }
    }
    if (a.id === "forest") {
      for (let i = 0; i < 18; i++) {
        const bx = ((i * 397.3 + time * 9 * ((i % 3) + 1)) % (vw + 40)) + camX - 20, by = ((i * 211.7 + Math.sin(time + i) * 20 + 400) % (vh + 40)) + camY - 20;
        ctx.globalAlpha = 0.45 + 0.4 * Math.sin(time * 3 + i); ctx.fillStyle = "#f8ff9a"; ctx.fillRect(bx, by, 2, 2); ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
    if (a.dark) {
      const cx = (pp[0] + 16 - camX) * S, cy = (pp[1] + 16 - camY) * S;
      const grd = ctx.createRadialGradient(cx, cy, 50 * S, cx, cy, 230 * S);
      grd.addColorStop(0, "rgba(5,3,10,0)"); grd.addColorStop(1, "rgba(5,3,10,0.88)");
      ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
    }
    drawHud();
    if (trans) { const al = trans.t < 0.25 ? trans.t / 0.25 : 1 - (trans.t - 0.25) / 0.35; ctx.fillStyle = "rgba(0,0,0," + clamp(al, 0, 1).toFixed(3) + ")"; ctx.fillRect(0, 0, W, H); }
    if (pl.dead > 0) { ctx.fillStyle = "rgba(60,0,0," + clamp(1 - pl.dead / 2.2 + 0.3, 0, 0.8).toFixed(3) + ")"; ctx.fillRect(0, 0, W, H); text("Poległeś...", W / 2, H / 2, 28, "#ffd0c8", "center", true); }
  }

  function circleBtn(cx: number, cy: number, r: number, kind: string, fn: () => void, hint: string, badge?: string): void {
    const g = ctx;
    g.globalAlpha = 0.9;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fillStyle = kind === "atk" ? "rgba(140,40,34,0.85)" : "rgba(24,19,30,0.8)"; g.fill();
    g.strokeStyle = COL.bd; g.lineWidth = 1.5; g.stroke(); g.globalAlpha = 1;
    if (kind === "atk") {
      if (pl.cd > 0) { g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r - 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (pl.cd / 0.75)); g.closePath(); g.fillStyle = "rgba(0,0,0,0.35)"; g.fill(); }
      drawIcon("sword", cx - r * 0.55, cy - r * 0.55, r * 1.1);
    } else if (kind === "pot") drawIcon("pot", cx - r * 0.6, cy - r * 0.62, r * 1.2);
    else if (kind === "bag") {
      g.fillStyle = "#a0723c"; g.beginPath(); g.ellipse(cx, cy + 3, r * 0.5, r * 0.45, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = "#7a5228"; g.fillRect(cx - r * 0.25, cy - r * 0.45, r * 0.5, r * 0.25);
    } else if (kind === "quest") {
      g.fillStyle = "#efe0b8"; g.fillRect(cx - r * 0.4, cy - r * 0.45, r * 0.8, r * 0.9); g.fillStyle = "#8a6238"; for (let i = 0; i < 3; i++) g.fillRect(cx - r * 0.28, cy - r * 0.25 + i * r * 0.25, r * 0.56, 2);
      if (QORDER.some((q: string) => qReady(q))) { g.fillStyle = "#ffd84a"; g.beginPath(); g.arc(cx + r * 0.6, cy - r * 0.6, 5, 0, 7); g.fill(); }
    }
    if (badge) { g.fillStyle = "#000"; g.beginPath(); g.arc(cx + r * 0.65, cy + r * 0.6, 8, 0, 7); g.fill(); text(badge, cx + r * 0.65, cy + r * 0.62, 10, "#fff", "center", true); }
    if (hint) text(hint, cx, cy + r + 8, 9, "rgba(255,255,255,0.8)", "center", true);
    ui.push({ x: cx - r, y: cy - r, w: r * 2, h: r * 2, fn });
  }

  function drawHud(): void {
    const a = A();
    const bw = Math.min(200, W * 0.46);
    box(8, 8, bw, 66);
    text("Wędrowiec", 18, 21, 13, COL.title, "left", true);
    text("Poz. " + P.lvl, 8 + bw - 10, 21, 12, COL.text, "right", true);
    bar(18, 32, bw - 20, 12, P.hp / maxHp(), "#d83a2e", "rgba(255,255,255,0.12)");
    text(Math.max(0, Math.ceil(P.hp)) + " / " + maxHp(), 18 + (bw - 20) / 2, 38.5, 10, "#fff", "center", true);
    bar(18, 48, bw - 20, 6, P.xp / xpNext(P.lvl), "#5aa8ff", "rgba(255,255,255,0.12)");
    ctx.fillStyle = "#f2c94c"; ctx.beginPath(); ctx.arc(23, 64, 4, 0, Math.PI * 2); ctx.fill();
    text(P.gold + " zł", 31, 64.5, 11, COL.text, "left", true);
    text("Atak " + atk() + "  Obr. " + def(), 8 + bw - 10, 64.5, 10, COL.mute, "right");
    const t = pl.target;
    if (t && !t.dead) {
      box(8, 80, bw, 34);
      text(t.d.n + " (" + t.d.lvl + ")", 18, 91, 11, "#ffe9a8", "left", true);
      bar(18, 100, bw - 20, 7, t.hp / t.d.hp, "#d83a2e", "rgba(255,255,255,0.12)");
    }
    const mmW = Math.min(150, W * 0.3), mmH = mmW * (a.h / a.w);
    const mx = W - mmW - 8, my = 8;
    box(mx - 3, my - 3, mmW + 6, mmH + 22);
    if (a.mini) { ctx.imageSmoothingEnabled = false; ctx.drawImage(a.mini, mx, my, mmW, mmH); }
    const k = mmW / a.w;
    for (const m of mobs[P.area]) if (!m.dead) { ctx.fillStyle = m.d.boss ? "#c58cff" : "#ff4a3a"; const s2 = m.d.boss ? 4 : 2.5; ctx.fillRect(mx + m.x * k - 1, my + m.y * k - 1, s2, s2); }
    for (const id of Object.keys(NPCS)) { const n = NPCS[id]; if (n.area === P.area) { ctx.fillStyle = "#ffd84a"; ctx.fillRect(mx + n.x * k - 1.5, my + n.y * k - 1.5, 3.5, 3.5); } }
    for (const e of a.exits) { ctx.fillStyle = "#ffffff"; ctx.fillRect(mx + e.x * k - 1, my + e.y * k - 1, 3, 3); }
    if (Math.sin(time * 6) > -0.3) { ctx.fillStyle = "#fff"; ctx.fillRect(mx + P.x * k - 2, my + P.y * k - 2, 4.5, 4.5); ctx.fillStyle = "#3f9bff"; ctx.fillRect(mx + P.x * k - 1, my + P.y * k - 1, 2.5, 2.5); }
    text(a.name, mx + mmW / 2, my + mmH + 10, 10, COL.title, "center", true);
    if (banner > 0) {
      ctx.globalAlpha = clamp(banner, 0, 1);
      const fs = Math.min(30, W / 14);
      text(a.name, W / 2 + 1, H * 0.26 + 1, fs, "#000", "center", true);
      text(a.name, W / 2, H * 0.26, fs, COL.title, "center", true);
      text(a.id === "village" ? "Bezpieczna osada · potwory poz. 1" : a.id === "forest" ? "Potwory poz. 3–6" : "Potwory poz. 7–12", W / 2, H * 0.26 + 26, 12, COL.text, "center", true);
      ctx.globalAlpha = 1;
    }
    for (const f of fx) if (f.k === "big") {
      const al = clamp(f.life / 0.6, 0, 1), sc = 1 + (1 - f.life / f.max) * 0.15, fs = Math.min(34, W / 11) * sc;
      ctx.globalAlpha = al; text(f.t, W / 2 + 2, H * 0.4 + 2, fs, "#000", "center", true); text(f.t, W / 2, H * 0.4, fs, "#ffd25a", "center", true); ctx.globalAlpha = 1;
    }
    const ab = 34;
    const axc = W - 16 - ab, ayc = H - 18 - ab;
    const hintOn = !touchMode;
    circleBtn(axc, ayc, ab, "atk", () => attackKey(), hintOn ? "Spacja" : "");
    circleBtn(axc - 80, ayc + 10, 22, "pot", () => usePotion(), hintOn ? "H" : "", String(countItem("pot") + countItem("bigpot")));
    circleBtn(axc - 66, ayc - 58, 22, "bag", () => { panel = panel === "inv" ? "" : "inv"; invSel = -1; }, hintOn ? "I" : "");
    circleBtn(axc - 6, ayc - 84, 22, "quest", () => { panel = panel === "quest" ? "" : "quest"; }, hintOn ? "Q" : "");
    let logBottom = H - 12;
    if (touchMode) {
      const s = 46, cx = 16 + s * 1.5, cy = H - 16 - s * 1.5;
      const dirs = [[0, -1, 0], [0, 1, 1], [-1, 0, 2], [1, 0, 3]];
      for (const d of dirs) {
        const x = cx + d[0] * s - s / 2, y = cy + d[1] * s - s / 2;
        const on = Object.keys(holds).some((k2: string) => holds[Number(k2)] === d[2]);
        rr(x + 1, y + 1, s - 2, s - 2, 8); ctx.fillStyle = on ? "rgba(201,164,92,0.65)" : "rgba(24,19,30,0.6)"; ctx.fill(); ctx.strokeStyle = COL.bd; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = COL.text; ctx.beginPath();
        const ax = x + s / 2, ay = y + s / 2;
        if (d[2] === 0) { ctx.moveTo(ax, ay - 8); ctx.lineTo(ax - 8, ay + 6); ctx.lineTo(ax + 8, ay + 6); }
        if (d[2] === 1) { ctx.moveTo(ax, ay + 8); ctx.lineTo(ax - 8, ay - 6); ctx.lineTo(ax + 8, ay - 6); }
        if (d[2] === 2) { ctx.moveTo(ax - 8, ay); ctx.lineTo(ax + 6, ay - 8); ctx.lineTo(ax + 6, ay + 8); }
        if (d[2] === 3) { ctx.moveTo(ax + 8, ay); ctx.lineTo(ax - 6, ay - 8); ctx.lineTo(ax - 6, ay + 8); }
        ctx.fill();
        ui.push({ x, y, w: s, h: s, fn: () => {}, hold: d[2] });
      }
      logBottom = H - 16 - s * 3 - 8;
    }
    const lw = Math.min(W * (touchMode ? 0.62 : 0.5), 380);
    let ly = logBottom;
    for (let i = msgs.length - 1; i >= 0 && i >= msgs.length - 5; i--) {
      const m = msgs[i]; const lines = wrap(m.t, lw - 12, 11);
      for (let j = lines.length - 1; j >= 0; j--) {
        ctx.globalAlpha = clamp(m.life / 1.5, 0, 1);
        ctx.font = "bold 11px " + FONT; const tw = ctx.measureText(lines[j]).width;
        ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(8, ly - 15, tw + 12, 16);
        text(lines[j], 14, ly - 7, 11, m.c, "left", true);
        ly -= 16;
        ctx.globalAlpha = 1;
      }
    }
    if (panel === "inv") drawInv();
    if (panel === "quest") drawQuests();
    if (panel === "shop") drawShop();
    if (dlg) drawDialog();
    if (hover && hover.t && !panel && !dlg && !touchMode) {
      ctx.font = "11px " + FONT; const tw = ctx.measureText(hover.t).width;
      const hx = clamp(hover.sx + 12, 4, W - tw - 16);
      ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(hx, hover.sy + 10, tw + 10, 18); text(hover.t, hx + 5, hover.sy + 19, 11, "#fff");
    }
  }

  // ---------- PANELS ----------
  function panelRect(mw: number, mh: number): number[] {
    const w = Math.min(W - 16, mw), h = Math.min(H - 16, mh);
    return [Math.round((W - w) / 2), Math.round((H - h) / 2), w, h];
  }
  function modalBack(): void { ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(0, 0, W, H); ui.push({ x: 0, y: 0, w: W, h: H, fn: () => { panel = ""; } }); }
  function itemDesc(id: string): string {
    const it = ITEMS[id];
    if (it.t === "w") return "Atak +" + it.atk;
    if (it.t === "a") return "Obrona +" + it.def + ", HP +" + it.def * 2;
    if (it.t === "p") return "Leczy " + it.heal + " HP";
    if (it.t === "q") return "Przedmiot do zadania";
    return "Łup na sprzedaż";
  }
  function drawInv(): void {
    modalBack();
    const [x, y, w, h] = panelRect(460, 480);
    box(x, y, w, h); ui.push({ x, y, w, h, fn: () => {} });
    text("Torba i ekwipunek", x + 14, y + 19, 15, COL.title, "left", true); closeBtn(x + w, y, () => { panel = ""; });
    const slotS = Math.max(30, Math.min(52, Math.floor((w - 28) / 5) - 6));
    const eqY = y + 40;
    const eqSlot = (sx: number, slot: string, lbl: string, sel: number): void => {
      rr(sx, eqY, slotS, slotS, 6); ctx.fillStyle = invSel === sel ? "rgba(201,164,92,0.35)" : "rgba(255,255,255,0.06)"; ctx.fill(); ctx.strokeStyle = COL.bd; ctx.lineWidth = 1; ctx.stroke();
      if (P.eq[slot]) drawIcon(P.eq[slot], sx + 4, eqY + 4, slotS - 8);
      text(lbl, sx + slotS / 2, eqY + slotS + 9, 10, COL.mute, "center");
      ui.push({ x: sx, y: eqY, w: slotS, h: slotS, fn: () => { invSel = P.eq[slot] ? sel : -1; } });
    };
    eqSlot(x + 14, "w", "Broń", -2); eqSlot(x + 22 + slotS, "a", "Zbroja", -3);
    const sx0 = x + 34 + slotS * 2;
    const fs = w < 360 ? 10 : 11;
    text("Poziom " + P.lvl + " · PD " + P.xp + "/" + xpNext(P.lvl), sx0, eqY + 8, fs, COL.text);
    text("HP " + Math.ceil(P.hp) + "/" + maxHp() + " · Atak " + atk(), sx0, eqY + 25, fs, COL.text);
    text("Obrona " + def() + " · " + P.gold + " zł", sx0, eqY + 42, fs, COL.text);
    const gy = eqY + slotS + 22;
    const cols = 5;
    const gs = Math.max(24, Math.min(slotS, Math.floor((h - (gy - y) - 92) / 4) - 6));
    for (let i = 0; i < 20; i++) {
      const cx = x + 14 + (i % cols) * (gs + 6), cy = gy + Math.floor(i / cols) * (gs + 6);
      rr(cx, cy, gs, gs, 6); ctx.fillStyle = invSel === i ? "rgba(201,164,92,0.35)" : "rgba(255,255,255,0.06)"; ctx.fill(); ctx.strokeStyle = "rgba(201,164,92,0.5)"; ctx.lineWidth = 1; ctx.stroke();
      const s = P.inv[i];
      if (s) {
        drawIcon(s.id, cx + 3, cy + 3, gs - 6);
        if (s.n > 1) text(String(s.n), cx + gs - 4, cy + gs - 8, 10, "#fff", "right", true);
        ui.push({ x: cx, y: cy, w: gs, h: gs, fn: () => { invSel = invSel === i ? -1 : i; } });
      }
    }
    const dy = gy + 4 * (gs + 6) + 4;
    let selId = "";
    if (invSel >= 0 && P.inv[invSel]) selId = P.inv[invSel].id;
    if (invSel === -2) selId = P.eq.w || "";
    if (invSel === -3) selId = P.eq.a || "";
    if (selId) {
      const it = ITEMS[selId];
      text(it.n, x + 14, dy + 10, 13, COL.title, "left", true);
      text(itemDesc(selId) + " · wartość " + Math.max(1, Math.floor(it.price / 2)) + " zł", x + 14, dy + 28, 11, COL.text);
      const by = Math.min(dy + 42, y + h - 40);
      if (invSel >= 0) {
        if (it.t === "w" || it.t === "a") button(x + 14, by, 110, 30, "Załóż", () => equip(invSel));
        if (it.t === "p") button(x + 14, by, 110, 30, "Użyj", () => { useItem(selId); if (!P.inv[invSel] || P.inv[invSel].id !== selId) invSel = -1; });
      } else button(x + 14, by, 110, 30, "Zdejmij", () => unequip(invSel === -2 ? "w" : "a"));
    } else text("Wybierz przedmiot, aby go użyć lub założyć.", x + 14, dy + 14, 11, COL.mute);
  }
  function drawQuests(): void {
    modalBack();
    const [x, y, w, h] = panelRect(460, 460);
    box(x, y, w, h); ui.push({ x, y, w, h, fn: () => {} });
    text("Dziennik zadań", x + 14, y + 19, 15, COL.title, "left", true); closeBtn(x + w, y, () => { panel = ""; });
    let yy = y + 46;
    const list = QORDER.filter((q: string) => P.q[q]);
    list.sort((p: string, q: string) => (P.q[p].s === "done" ? 1 : 0) - (P.q[q].s === "done" ? 1 : 0));
    if (!list.length) { for (const l of wrap("Nie masz jeszcze zadań. Szukaj postaci z żółtym wykrzyknikiem nad głową.", w - 28, 12)) { text(l, x + 14, yy, 12, COL.text); yy += 17; } }
    for (const id of list) {
      if (yy > y + h - 60) break;
      const q = QUESTS[id], s = P.q[id];
      const done = s.s === "done", ready = qReady(id);
      text(q.n, x + 14, yy, 13, done ? COL.mute : COL.title, "left", true);
      text(done ? "Ukończone" : ready ? "Wróć po nagrodę" : qProg(id) + "/" + q.need, x + w - 14, yy, 11, done ? COL.mute : ready ? COL.good : COL.text, "right", true);
      yy += 17;
      if (!done) {
        for (const l of wrap(q.desc + " Zleca: " + NPCS[q.giver].n + ".", w - 28, 11)) { text(l, x + 14, yy, 11, COL.text); yy += 15; }
        bar(x + 14, yy, w - 28, 5, qProg(id) / q.need, ready ? "#7dd36a" : "#5aa8ff", "rgba(255,255,255,0.1)");
        yy += 12;
      }
      yy += 8;
    }
    const doneN = QORDER.filter((q: string) => P.q[q] && P.q[q].s === "done").length;
    text("Ukończone " + doneN + "/" + QORDER.length + " · Pokonani: " + P.kills, x + 14, y + h - 24, 11, COL.mute);
    button(x + w - 120, y + h - 40, 106, 28, resetArm > 0 ? "Na pewno?" : "Nowa gra", () => {
      if (resetArm > 0) {
        P = fresh(); P.intro = true; pl.fx = P.x; pl.fy = P.y; pl.mt = 1; pl.target = null; pl.path = []; panel = ""; banner = 3; resetArm = 0;
        save(); log("Rozpoczęto nową grę.", "#f5d98a");
      } else resetArm = 3;
    }, { fs: 12, col: resetArm > 0 ? "#7a2a2a" : undefined });
  }
  function drawShop(): void {
    modalBack();
    const [x, y, w, h] = panelRect(460, shopTab === "buy" ? 78 + SHOPS[shopId].length * 46 + 44 : 470);
    box(x, y, w, h); ui.push({ x, y, w, h, fn: () => {} });
    text(shopId === "smith" ? "Kuźnia Bogumiła" : "Chata Zielarki", x + 14, y + 19, 15, COL.title, "left", true); closeBtn(x + w, y, () => { panel = ""; });
    button(x + 14, y + 40, 84, 28, "Kup", () => { shopTab = "buy"; }, { col: shopTab === "buy" ? "#6a5430" : undefined });
    button(x + 104, y + 40, 84, 28, "Sprzedaj", () => { shopTab = "sell"; sellPage = 0; }, { col: shopTab === "sell" ? "#6a5430" : undefined });
    ctx.fillStyle = "#f2c94c"; ctx.beginPath(); ctx.arc(x + w - 66, y + 54, 5, 0, 7); ctx.fill();
    text(P.gold + " zł", x + w - 56, y + 54.5, 12, COL.text, "left", true);
    const rowH = 46; let yy = y + 78;
    const rowsFit = Math.max(1, Math.floor((y + h - 50 - yy) / rowH));
    const bw = w < 360 ? 84 : 100;
    const row = (id: string, sub: string, price: number, lbl: string, fn: () => void, dis: boolean, n?: number): void => {
      rr(x + 10, yy, w - 20, rowH - 6, 6); ctx.fillStyle = "rgba(255,255,255,0.05)"; ctx.fill();
      drawIcon(id, x + 16, yy + 3, 34);
      text(ITEMS[id].n + (n && n > 1 ? " x" + n : ""), x + 56, yy + 12, 12, COL.text, "left", true);
      text(sub, x + 56, yy + 28, 10, COL.mute);
      button(x + w - bw - 16, yy + 6, bw, 28, lbl + " " + price + " zł", fn, { dis, fs: 11 });
      yy += rowH;
    };
    if (shopTab === "buy") {
      for (const id of SHOPS[shopId]) {
        const it = ITEMS[id];
        let sub = itemDesc(id);
        if (it.t === "w" && P.eq.w) { const d = it.atk - ITEMS[P.eq.w].atk; sub += d > 0 ? " (+" + d + ")" : " (" + d + ")"; }
        if (it.t === "a" && P.eq.a) { const d = it.def - ITEMS[P.eq.a].def; sub += d > 0 ? " (+" + d + ")" : " (" + d + ")"; }
        row(id, sub, it.price, "Kup", () => {
          if (P.gold < it.price) { log("Za mało złota.", "#ff8a7a"); return; }
          if (addItem(id, 1)) { P.gold -= it.price; log("Kupiono: " + it.n + ".", "#c8e6a0"); save(); }
        }, P.gold < it.price);
      }
      text(shopId === "smith" ? "Kupiony sprzęt załóż w torbie." : "Miksturę wypijesz przyciskiem z fiolką.", x + 14, y + h - 22, 11, COL.mute);
    } else {
      const inv = P.inv.map((s: any, i: number) => ({ s, i }));
      const pages = Math.max(1, Math.ceil(inv.length / rowsFit));
      sellPage = Math.min(sellPage, pages - 1);
      const slice = inv.slice(sellPage * rowsFit, sellPage * rowsFit + rowsFit);
      if (!slice.length) text("Torba jest pusta.", x + 14, yy + 10, 12, COL.mute);
      for (const e of slice) {
        const it = ITEMS[e.s.id], pr = Math.max(1, Math.floor(it.price / 2));
        row(e.s.id, itemDesc(e.s.id), pr, "Sprzedaj", () => {
          const s = P.inv[e.i]; if (!s) return;
          s.n--; if (s.n <= 0) P.inv.splice(e.i, 1); P.gold += pr; log("Sprzedano: " + it.n + " (+" + pr + " zł).", "#f5d98a"); save();
        }, false, e.s.n);
      }
      if (pages > 1) {
        button(x + 14, y + h - 40, 36, 28, "‹", () => { sellPage = Math.max(0, sellPage - 1); });
        text((sellPage + 1) + "/" + pages, x + 70, y + h - 26, 12, COL.text, "center");
        button(x + 90, y + h - 40, 36, 28, "›", () => { sellPage = Math.min(pages - 1, sellPage + 1); });
      }
      if (P.inv.some((s: any) => ITEMS[s.id].t === "j")) button(x + w - 140, y + h - 40, 126, 28, "Sprzedaj łupy", () => {
        let sum = 0;
        for (let i = P.inv.length - 1; i >= 0; i--) { const s = P.inv[i]; if (ITEMS[s.id].t === "j") { sum += Math.max(1, Math.floor(ITEMS[s.id].price / 2)) * s.n; P.inv.splice(i, 1); } }
        P.gold += sum; log("Sprzedano łupy za " + sum + " zł.", "#f5d98a"); save();
      }, { fs: 12 });
    }
  }
  function drawDialog(): void {
    ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(0, 0, W, H); ui.push({ x: 0, y: 0, w: W, h: H, fn: () => {} });
    const w = Math.min(W - 16, 640);
    const lines = wrap(dlg.text, w - 28, 13);
    ctx.font = "bold 13px " + FONT;
    const bws: number[] = dlg.opts.map((o: any) => Math.min(w - 28, ctx.measureText(o.l).width + 28));
    let rows = 1, acc = 0;
    for (const b of bws) { if (acc + b > w - 28 && acc > 0) { rows++; acc = 0; } acc += b + 8; }
    const h = 44 + lines.length * 18 + rows * 40 + 6;
    const x = (W - w) / 2, y = H - h - 10;
    box(x, y, w, h);
    text(dlg.name, x + 14, y + 19, 14, COL.title, "left", true);
    let yy = y + 42;
    for (const l of lines) { text(l, x + 14, yy, 13, COL.text); yy += 18; }
    let bx = x + 14; yy += 2;
    dlg.opts.forEach((o: any, i: number) => {
      if (bx + bws[i] > x + w - 14 && bx > x + 14) { bx = x + 14; yy += 40; }
      button(bx, yy, bws[i], 32, o.l, o.fn);
      bx += bws[i] + 8;
    });
  }

  // ---------- INPUT ----------
  function pos(e: PointerEvent): number[] { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  function hitUi(x: number, y: number): any {
    for (let i = ui.length - 1; i >= 0; i--) { const b = ui[i]; if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b; }
    return null;
  }
  const worldAt = (sx: number, sy: number): number[] => [sx / S + camX, sy / S + camY];
  function mobUnder(w: number[]): any {
    for (const m of mobs[P.area]) { if (m.dead) continue; const mp = rpos(m); if (Math.abs(mp[0] + 16 - w[0]) < 20 && Math.abs(mp[1] + 16 - w[1]) < 22) return m; }
    return null;
  }
  function onDown(e: PointerEvent): void {
    e.preventDefault();
    try { canvas.focus({ preventScroll: true }); } catch (er) { /* ignore */ }
    if (e.pointerType === "touch" || e.pointerType === "pen") touchMode = true; else if (e.pointerType === "mouse") touchMode = false;
    const p = pos(e);
    try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
    const b = hitUi(p[0], p[1]);
    if (b) { if (b.hold !== undefined) holds[e.pointerId] = b.hold; else b.fn(); return; }
    if (pl.dead || trans) return;
    const w = worldAt(p[0], p[1]);
    const tx = Math.floor(w[0] / TS), ty = Math.floor(w[1] / TS);
    const m = mobUnder(w);
    if (m) { pl.target = m; pl.talk = null; pl.path = []; pl.repath = 0; clickMark = null; return; }
    const npc = npcAt(tx, ty) || npcAt(tx, ty + 1);
    if (npc) { pl.talk = npc; pl.target = null; pl.path = []; return; }
    pl.target = null; pl.talk = null;
    let gx = tx, gy = ty;
    if (blocked(tx, ty, pl)) {
      let best: number[] | null = null, bd = 99;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (!blocked(tx + dx, ty + dy, pl)) { const d = Math.abs(dx) + Math.abs(dy); if (d < bd) { bd = d; best = [tx + dx, ty + dy]; } }
      }
      if (!best) return; gx = best[0]; gy = best[1];
    }
    const path = bfs(P.x, P.y, (x: number, y: number) => x === gx && y === gy);
    if (path) { pl.path = path; clickMark = [gx, gy]; }
  }
  function onMove(e: PointerEvent): void {
    const p = pos(e);
    if (holds[e.pointerId] !== undefined) { const b = hitUi(p[0], p[1]); if (b && b.hold !== undefined) holds[e.pointerId] = b.hold; }
    if (e.pointerType === "mouse") {
      mouse = { x: p[0], y: p[1] };
      const w = worldAt(p[0], p[1]); hover = null;
      const m = mobUnder(w); if (m) hover = { m, sx: p[0], sy: p[1], t: "" };
      const tx = Math.floor(w[0] / TS), ty = Math.floor(w[1] / TS);
      for (const ex of A().exits) if (ex.x === tx && ex.y === ty) hover = { sx: p[0], sy: p[1], t: "Przejście: " + AREAS[ex.to].name };
      canvas.style.cursor = hitUi(p[0], p[1]) && (panel || dlg || p[1] > H - 140 || p[1] < 120) ? "pointer" : hover && hover.m ? "crosshair" : "default";
    }
  }
  function onUp(e: PointerEvent): void { delete holds[e.pointerId]; }
  function onLeave(e: PointerEvent): void { if (e.pointerType === "mouse") { mouse = null; hover = null; } }
  function onCtx(e: Event): void { e.preventDefault(); }
  function onKey(e: KeyboardEvent): void {
    const tg = e.target as HTMLElement | null;
    if (tg && tg !== canvas && (tg.tagName === "INPUT" || tg.tagName === "TEXTAREA")) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].indexOf(e.key) >= 0) e.preventDefault();
    if (e.type === "keyup") { keys[k] = false; return; }
    if (e.repeat && keys[k]) return;
    keys[k] = true;
    if (k === "Escape") { if (dlg) dlg = null; else panel = ""; return; }
    if (dlg) {
      if (k === "e" || k === "Enter" || k === " ") talkKey();
      else if (/^[1-9]$/.test(k) && dlg.opts[Number(k) - 1]) dlg.opts[Number(k) - 1].fn();
      return;
    }
    if (k === " " || k === "f") attackKey();
    else if (k === "e" || k === "Enter") talkKey();
    else if (k === "i" || k === "b") { panel = panel === "inv" ? "" : "inv"; invSel = -1; }
    else if (k === "q" || k === "j") panel = panel === "quest" ? "" : "quest";
    else if (k === "h" || k === "1") usePotion();
  }
  function onBlur(): void { for (const k of Object.keys(keys)) keys[k] = false; for (const k of Object.keys(holds)) delete holds[Number(k)]; }
  canvas.tabIndex = 0;
  canvas.style.touchAction = "none";
  canvas.style.outline = "none";
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("contextmenu", onCtx);
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);
  window.addEventListener("blur", onBlur);

  // ---------- LOOP ----------
  let last = 0;
  function frame(ts: number): void {
    if (destroyed) return;
    const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016; last = ts;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.max(1, canvas.clientWidth), ch = Math.max(1, canvas.clientHeight);
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) { canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); }
    W = cw; H = ch;
    try { update(dt); draw(); } catch (err) { if (typeof console !== "undefined") console.error(err); }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  log("Witaj w Osadzie Brzozowej!", "#f5d98a");
  return () => {
    destroyed = true; cancelAnimationFrame(raf); save();
    canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("pointercancel", onUp);
    canvas.removeEventListener("pointerleave", onLeave); canvas.removeEventListener("contextmenu", onCtx);
    window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKey); window.removeEventListener("blur", onBlur);
  };
}
