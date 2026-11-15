"use strict";
function createArdan(canvas, opts) {
    // SRV: headless authoritative instance on the server (one per connected player, shared mobs).
    // NET: online client - renders server state and only sends intents.
    const SRV = opts.server || null, NET = opts.net || null;
    // TB: turn-based combat (online): monsters never attack on the map, fights happen on the battle screen.
    const TB = !!(SRV || NET);
    const FONT = opts.font || "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
    const c2 = canvas.getContext("2d");
    if (!c2)
        return () => { };
    let ctx = c2;
    const TS = 32;
    let destroyed = false;
    let raf = 0;
    const R = Math.random;
    const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
    function mkRng(seed) {
        let s = seed >>> 0;
        return function () {
            s = (s + 0x6d2b79f5) >>> 0;
            let t = s;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    // ---------- TILES ----------
    const GRASS = 0, PATH = 1, WATER = 2, TREE = 3, WALL = 4, ROOF = 5, DOOR = 6, FLOOR = 7, CWALL = 8, BRIDGE = 9, FLOWER = 10, FENCE = 11, SAND = 12, ROCK = 13, PORTAL = 14, DGRASS = 15, WELL = 16, CRYSTAL = 17, MUD = 18, BOG = 19, REED = 20, DEADT = 21, COBBLE = 22, SWALL = 23, ROOF2 = 24, FOUNT = 25, SNOW = 26, ICE = 27, SPINE = 28, CLIFF = 29, DUNE = 30, CACTUS = 31, RUINW = 32, RFLOOR = 33, PILLAR = 34, ASH = 35, LAVA = 36;
    const BLOCK = [];
    [WATER, TREE, WALL, ROOF, DOOR, CWALL, FENCE, ROCK, WELL, CRYSTAL, BOG, DEADT, SWALL, ROOF2, FOUNT, SPINE, CLIFF, CACTUS, RUINW, PILLAR, LAVA].forEach((v) => { BLOCK[v] = true; });
    const TALL = [];
    [TREE, WALL, ROOF, DOOR, CWALL, CRYSTAL, DEADT, SWALL, ROOF2, SPINE, CLIFF, RUINW, PILLAR].forEach((v) => { TALL[v] = true; });
    const MINI = [];
    MINI[ASH] = "#3a3236";
    MINI[LAVA] = "#e0541c";
    MINI[GRASS] = "#4b8d3b";
    MINI[DGRASS] = "#3f7a33";
    MINI[FLOWER] = "#5a9a45";
    MINI[PATH] = "#c09a60";
    MINI[SAND] = "#d6c07c";
    MINI[WATER] = "#2d6db0";
    MINI[TREE] = "#1f4a1c";
    MINI[WALL] = "#d9c39a";
    MINI[ROOF] = "#a8432f";
    MINI[DOOR] = "#5a3a1e";
    MINI[FLOOR] = "#5a5463";
    MINI[CWALL] = "#1d1922";
    MINI[BRIDGE] = "#8b5e34";
    MINI[FENCE] = "#8a6238";
    MINI[ROCK] = "#8a8a8a";
    MINI[PORTAL] = "#c58cff";
    MINI[WELL] = "#8d8d95";
    MINI[CRYSTAL] = "#5fe3ff";
    MINI[MUD] = "#615e3e";
    MINI[BOG] = "#2c4636";
    MINI[REED] = "#77803e";
    MINI[DEADT] = "#2a261e";
    MINI[COBBLE] = "#a19dab";
    MINI[SWALL] = "#4d4a58";
    MINI[ROOF2] = "#3a5fa8";
    MINI[FOUNT] = "#6ab0e8";
    MINI[SNOW] = "#e8eef6";
    MINI[ICE] = "#a8d8f0";
    MINI[SPINE] = "#2c5a48";
    MINI[CLIFF] = "#6f7480";
    MINI[DUNE] = "#cfa964";
    MINI[CACTUS] = "#4f8a3a";
    MINI[RUINW] = "#9a7448";
    MINI[RFLOOR] = "#cdb48a";
    MINI[PILLAR] = "#efe2bc";
    function mkArea(id, name, w, h, fill, dark, base) {
        return { id, name, w, h, t: new Array(w * h).fill(fill), exits: [], spawns: [], dark, base, img: null, mini: null };
    }
    const gt = (a, x, y) => (x < 0 || y < 0 || x >= a.w || y >= a.h ? -1 : a.t[y * a.w + x]);
    const st = (a, x, y, v) => { if (x >= 0 && y >= 0 && x < a.w && y < a.h)
        a.t[y * a.w + x] = v; };
    const solidT = (a, x, y) => { const t = gt(a, x, y); return t < 0 || !!BLOCK[t]; };
    function line4(x0, y0, x1, y1, fn) {
        let x = x0, y = y0;
        fn(x, y);
        const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = Math.sign(x1 - x0), sy = Math.sign(y1 - y0);
        let ix = 0, iy = 0;
        while (ix < dx || iy < dy) {
            if ((0.5 + ix) / dx < (0.5 + iy) / dy) {
                x += sx;
                ix++;
            }
            else {
                y += sy;
                iy++;
            }
            fn(x, y);
        }
    }
    function disc(cx, cy, r, fn) {
        for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
            for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
                if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r)
                    fn(x, y);
    }
    function reach(a, sx, sy) {
        const seen = new Uint8Array(a.w * a.h);
        const q = [sy * a.w + sx];
        seen[q[0]] = 1;
        let qi = 0;
        while (qi < q.length) {
            const c = q[qi++];
            const x = c % a.w, y = (c - x) / a.w;
            const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            for (const d of nb) {
                const nx = x + d[0], ny = y + d[1];
                if (solidT(a, nx, ny))
                    continue;
                const k = ny * a.w + nx;
                if (seen[k])
                    continue;
                seen[k] = 1;
                q.push(k);
            }
        }
        return seen;
    }
    function genVillage() {
        const a = mkArea("village", "Osada Brzozowa", 40, 30, GRASS, false, GRASS);
        const r = mkRng(11);
        for (let i = 0; i < a.t.length; i++)
            if (r() < 0.07)
                a.t[i] = FLOWER;
        for (let y = 0; y < a.h; y++)
            for (let x = 0; x < a.w; x++) {
                const e = Math.min(x, y, a.w - 1 - x, a.h - 1 - y);
                if (e === 0 || (e === 1 && r() < 0.75) || (e === 2 && r() < 0.25))
                    st(a, x, y, TREE);
            }
        for (let x = 1; x < 40; x++) {
            st(a, x, 14, PATH);
            st(a, x, 15, PATH);
        }
        for (let y = 4; y <= 26; y++) {
            st(a, 19, y, PATH);
            st(a, 20, y, PATH);
        }
        disc(19.5, 14.5, 3.2, (x, y) => st(a, x, y, PATH));
        const house = (x, y, w, h) => {
            for (let yy = y; yy < y + h; yy++)
                for (let xx = x; xx < x + w; xx++)
                    st(a, xx, yy, yy < y + h - 2 ? ROOF : WALL);
            st(a, x + Math.floor(w / 2), y + h - 1, DOOR);
        };
        house(6, 6, 7, 6);
        st(a, 9, 12, PATH);
        st(a, 9, 13, PATH);
        house(25, 5, 8, 7);
        st(a, 29, 12, PATH);
        st(a, 29, 13, PATH);
        house(6, 18, 7, 6);
        house(26, 18, 7, 6);
        for (let y = 24; y <= 25; y++) {
            st(a, 9, y, PATH);
            st(a, 29, y, PATH);
        }
        for (let x = 9; x <= 29; x++)
            st(a, x, 25, PATH);
        for (let x = 34; x <= 38; x++)
            for (let y = 3; y <= 8; y++) {
                const edge = x === 34 || x === 38 || y === 3 || y === 8;
                st(a, x, y, edge ? FENCE : FLOWER);
            }
        st(a, 36, 8, PATH);
        for (let y = 9; y <= 13; y++)
            st(a, 36, y, PATH);
        for (let y = 20; y < 30; y++)
            for (let x = 29; x < 40; x++) {
                const v = ((x - 34.5) / 3) ** 2 + ((y - 25.5) / 2.2) ** 2;
                const t = gt(a, x, y);
                if (t === GRASS || t === FLOWER || t === TREE) {
                    if (v <= 1)
                        st(a, x, y, WATER);
                    else if (v <= 1.7 && t !== TREE)
                        st(a, x, y, SAND);
                }
            }
        st(a, 17, 11, WELL);
        st(a, 39, 14, PATH);
        st(a, 39, 15, PATH);
        a.exits.push({ x: 39, y: 14, to: "forest", tx: 1, ty: 20 }, { x: 39, y: 15, to: "forest", tx: 1, ty: 21 });
        a.spawns = [["rat", 4, 27], ["rat", 13, 27], ["rat", 23, 27], ["rat", 5, 4], ["rat", 14, 4], ["rat", 26, 14]];
        return a;
    }
    function genForest() {
        const a = mkArea("forest", "Mroczny Bór", 50, 40, GRASS, false, DGRASS);
        const r = mkRng(23);
        for (let i = 0; i < a.t.length; i++)
            if (r() < 0.4)
                a.t[i] = DGRASS;
        for (let i = 0; i < a.t.length; i++)
            if (r() < 0.36)
                a.t[i] = TREE;
        for (let y = 0; y < a.h; y++)
            for (let x = 0; x < a.w; x++) {
                const e = Math.min(x, y, a.w - 1 - x, a.h - 1 - y);
                if (e <= 1 || (e === 2 && r() < 0.7))
                    st(a, x, y, TREE);
            }
        const clear = (x, y) => { if (gt(a, x, y) === TREE && x > 0 && y > 0 && x < a.w - 1 && y < a.h - 1)
            st(a, x, y, r() < 0.5 ? GRASS : DGRASS); };
        const clearings = [[15, 14, 4], [22, 30, 4], [12, 33, 3.6], [40, 32, 4], [38, 18, 3.2], [8, 20, 2.6], [26, 8, 3.5], [44, 24, 3]];
        for (const c of clearings)
            disc(c[0], c[1], c[2], clear);
        for (let y = 0; y < a.h; y++) {
            const x0 = Math.round(31 + Math.sin(y * 0.28) * 2.2);
            st(a, x0, y, WATER);
            st(a, x0 + 1, y, WATER);
            if (gt(a, x0 - 1, y) !== TREE && r() < 0.6)
                st(a, x0 - 1, y, SAND);
            if (gt(a, x0 + 2, y) !== TREE && r() < 0.6)
                st(a, x0 + 2, y, SAND);
        }
        const segs = [[0, 20, 8, 20], [8, 20, 15, 14], [15, 14, 24, 16], [24, 16, 30, 22], [30, 22, 38, 18], [38, 18, 42, 8], [42, 8, 44, 3],
            [24, 16, 22, 30], [22, 30, 12, 33], [30, 22, 40, 32], [40, 32, 44, 24], [15, 14, 26, 8]];
        for (const s of segs) {
            line4(s[0], s[1], s[2], s[3], (x, y) => {
                disc(x, y, 1.2, clear);
                const t = gt(a, x, y);
                if (t === WATER)
                    st(a, x, y, BRIDGE);
                else if (t !== BRIDGE)
                    st(a, x, y, PATH);
            });
        }
        for (let y = 19; y <= 21; y++) {
            st(a, 0, y, PATH);
            st(a, 1, y, PATH);
        }
        for (let i = 0; i < a.t.length; i++) {
            const t = a.t[i];
            if ((t === GRASS || t === DGRASS)) {
                const q = r();
                if (q < 0.018)
                    a.t[i] = ROCK;
                else if (q < 0.06)
                    a.t[i] = FLOWER;
            }
        }
        for (let y = 3; y <= 5; y++)
            for (let x = 43; x <= 45; x++)
                st(a, x, y, PATH);
        st(a, 43, 1, ROCK);
        st(a, 44, 1, ROCK);
        st(a, 45, 1, ROCK);
        st(a, 43, 2, ROCK);
        st(a, 45, 2, ROCK);
        st(a, 44, 2, PORTAL);
        for (let y = 19; y <= 21; y++)
            a.exits.push({ x: 0, y, to: "village", tx: 38, ty: y === 21 ? 15 : 14 });
        a.exits.push({ x: 44, y: 2, to: "cave", tx: 6, ty: 23 });
        const seen = reach(a, 1, 20);
        const cand = [];
        for (let y = 0; y < a.h; y++)
            for (let x = 0; x < a.w; x++) {
                const t = gt(a, x, y);
                if (seen[y * a.w + x] && t !== PATH && t !== BRIDGE && t !== PORTAL && Math.abs(x - 1) + Math.abs(y - 20) > 10 && cheb(x, y, 13, 33) > 3)
                    cand.push([x, y]);
            }
        const used = [];
        const pick = (kind, n, f) => {
            let tries = 0;
            while (n > 0 && tries++ < 3000) {
                const c = cand[Math.floor(r() * cand.length)];
                if (!f(c[0], c[1]))
                    continue;
                if (used.some((u) => cheb(u[0], u[1], c[0], c[1]) < 3))
                    continue;
                used.push(c);
                a.spawns.push([kind, c[0], c[1]]);
                n--;
            }
        };
        pick("wolf", 8, (x) => x < 29);
        pick("boar", 7, (x, y) => x < 30 || y > 26);
        pick("goblin", 7, (x) => x > 34);
        line4(22, 30, 22, 39, (x, y) => { for (let dx = -1; dx <= 1; dx++) {
            const t = gt(a, x + dx, y);
            if (t === TREE || t === ROCK || t === FLOWER)
                st(a, x + dx, y, y >= 38 ? PATH : GRASS);
        } if (gt(a, x, y) !== BRIDGE)
            st(a, x, y, PATH); });
        for (let x = 21; x <= 23; x++) {
            st(a, x, 38, PATH);
            st(a, x, 39, PATH);
            a.exits.push({ x, y: 39, to: "swamp", tx: x + 1, ty: 1 });
        }
        a.spawns = a.spawns.filter((s2) => !(Math.abs(s2[1] - 22) <= 1 && s2[2] >= 36));
        return a;
    }
    function genCave() {
        const a = mkArea("cave", "Jaskinia Cieni", 36, 28, CWALL, true, FLOOR);
        const r = mkRng(37);
        const rooms = [[2, 21, 8, 5], [13, 17, 8, 7], [3, 3, 9, 8], [16, 3, 10, 8], [25, 13, 9, 11]];
        for (const m of rooms)
            for (let y = m[1]; y < m[1] + m[3]; y++)
                for (let x = m[0]; x < m[0] + m[2]; x++)
                    st(a, x, y, FLOOR);
        const cen = rooms.map((m) => [m[0] + Math.floor(m[2] / 2), m[1] + Math.floor(m[3] / 2)]);
        const links = [[0, 1], [1, 2], [2, 3], [3, 4], [1, 3]];
        for (const l of links) {
            const A1 = cen[l[0]], B1 = cen[l[1]];
            line4(A1[0], A1[1], B1[0], A1[1], (x, y) => { st(a, x, y, FLOOR); st(a, x, y + 1, FLOOR); });
            line4(B1[0], A1[1], B1[0], B1[1], (x, y) => { st(a, x, y, FLOOR); st(a, x + 1, y, FLOOR); });
        }
        for (let y = 1; y < a.h - 1; y++)
            for (let x = 1; x < a.w - 1; x++) {
                if (gt(a, x, y) !== FLOOR)
                    continue;
                let all = true;
                for (let dy = -1; dy <= 1; dy++)
                    for (let dx = -1; dx <= 1; dx++)
                        if (gt(a, x + dx, y + dy) !== FLOOR)
                            all = false;
                if (all && r() < 0.035)
                    st(a, x, y, ROCK);
            }
        for (let y = 0; y < a.h; y++)
            for (let x = 0; x < a.w; x++) {
                if (gt(a, x, y) !== CWALL)
                    continue;
                if ((gt(a, x, y + 1) === FLOOR || gt(a, x + 1, y) === FLOOR || gt(a, x - 1, y) === FLOOR) && r() < 0.06)
                    st(a, x, y, CRYSTAL);
            }
        st(a, 3, 23, PORTAL);
        st(a, 4, 23, FLOOR);
        st(a, 5, 23, FLOOR);
        st(a, 6, 23, FLOOR);
        a.exits.push({ x: 3, y: 23, to: "forest", tx: 44, ty: 4 });
        const inRoom = (k, kind, n) => {
            const m = rooms[k];
            let tries = 0;
            while (n > 0 && tries++ < 200) {
                const x = m[0] + 1 + Math.floor(r() * (m[2] - 2)), y = m[1] + 1 + Math.floor(r() * (m[3] - 2));
                if (gt(a, x, y) !== FLOOR || a.spawns.some((s) => s[1] === x && s[2] === y))
                    continue;
                a.spawns.push([kind, x, y]);
                n--;
            }
        };
        inRoom(1, "spider", 3);
        inRoom(2, "spider", 2);
        inRoom(2, "skel", 1);
        inRoom(3, "skel", 3);
        inRoom(4, "skel", 2);
        a.spawns.push(["boss", 29, 18]);
        st(a, 29, 18, FLOOR);
        return a;
    }
    function houseT(a, x, y, w, h, roof) {
        for (let yy = y; yy < y + h; yy++)
            for (let xx = x; xx < x + w; xx++)
                st(a, xx, yy, yy < y + h - 2 ? roof : WALL);
        st(a, x + Math.floor(w / 2), y + h - 1, DOOR);
    }
    function borderFill(a, r, tiles, p2) {
        for (let y = 0; y < a.h; y++)
            for (let x = 0; x < a.w; x++) {
                const e = Math.min(x, y, a.w - 1 - x, a.h - 1 - y);
                if (e <= 1 || (e === 2 && r() < p2))
                    st(a, x, y, tiles[Math.floor(r() * tiles.length)]);
            }
    }
    function spawnIn(a, r, ex, ey, specs, avoid) {
        const seen = reach(a, ex, ey);
        const cand = [];
        for (let y = 0; y < a.h; y++)
            for (let x = 0; x < a.w; x++) {
                const t = gt(a, x, y);
                if (!seen[y * a.w + x] || t === PATH || t === BRIDGE || BLOCK[t])
                    continue;
                if (Math.abs(x - ex) + Math.abs(y - ey) <= 9)
                    continue;
                if (avoid.some((v) => cheb(x, y, v[0], v[1]) <= v[2]))
                    continue;
                cand.push([x, y]);
            }
        const used = [];
        for (const sp of specs) {
            let n = sp[1], tries = 0;
            while (n > 0 && tries++ < 4000 && cand.length) {
                const c = cand[Math.floor(r() * cand.length)];
                if (!sp[2](c[0], c[1]))
                    continue;
                if (used.some((u) => cheb(u[0], u[1], c[0], c[1]) < 3))
                    continue;
                used.push(c);
                a.spawns.push([sp[0], c[0], c[1]]);
                n--;
            }
        }
    }
    function genSwamp() {
        const a = mkArea("swamp", "Bagna Żałoby", 48, 40, MUD, false, MUD);
        const r = mkRng(51);
        for (let i = 0; i < a.t.length; i++)
            if (r() < 0.1)
                a.t[i] = REED;
        for (let i = 0; i < 26; i++)
            disc(3 + r() * 42, 3 + r() * 34, 1.5 + r() * 2.8, (x, y) => st(a, x, y, BOG));
        for (let i = 0; i < a.t.length; i++)
            if (a.t[i] !== BOG && r() < 0.09)
                a.t[i] = DEADT;
        borderFill(a, r, [DEADT, BOG, DEADT], 0.6);
        const isl = [[23, 5, 3.2], [13, 15, 3.5], [15, 27, 3.5], [27, 30, 3], [37, 22, 3.5], [37, 32, 4.5], [8, 34, 3], [33, 10, 3.5], [43, 12, 2.5]];
        for (const c of isl)
            disc(c[0], c[1], c[2], (x, y) => { if (x > 1 && y > 1 && x < a.w - 2 && y < a.h - 2)
                st(a, x, y, r() < 0.15 ? REED : MUD); });
        const clr = (x, y) => { if (x > 0 && y > 0 && x < a.w - 1 && y < a.h - 1) {
            const t = gt(a, x, y);
            if (t === DEADT || t === REED)
                st(a, x, y, MUD);
        } };
        const segs = [[23, 0, 23, 6], [23, 6, 13, 15], [13, 15, 15, 27], [15, 27, 27, 30], [27, 30, 37, 22], [37, 22, 47, 20], [27, 30, 37, 32],
            [15, 27, 8, 34], [23, 6, 33, 10], [33, 10, 43, 12], [43, 12, 37, 22]];
        for (const s of segs)
            line4(s[0], s[1], s[2], s[3], (x, y) => { disc(x, y, 1, clr); const t = gt(a, x, y); st(a, x, y, t === BOG || t === WATER ? BRIDGE : PATH); });
        for (let x = 22; x <= 24; x++) {
            st(a, x, 0, PATH);
            st(a, x, 1, PATH);
        }
        for (let y = 19; y <= 21; y++) {
            st(a, 46, y, PATH);
            st(a, 47, y, PATH);
        }
        houseT(a, 17, 1, 5, 4, ROOF);
        for (let x = 19; x <= 22; x++)
            st(a, x, 5, PATH);
        houseT(a, 38, 28, 4, 3, ROOF);
        st(a, 37, 33, MUD);
        for (let x = 22; x <= 24; x++)
            a.exits.push({ x, y: 0, to: "forest", tx: x - 1, ty: 38 });
        for (let y = 19; y <= 21; y++)
            a.exits.push({ x: 47, y, to: "town", tx: 1, ty: y === 19 ? 15 : 16 });
        spawnIn(a, r, 23, 1, [["drowner", 8, () => true], ["wisp", 6, (x, y) => y > 12], ["troll", 5, (x, y) => x > 18 && y > 14]], [[25, 6, 5], [37, 33, 4]]);
        a.spawns.push(["witch", 37, 33]);
        return a;
    }
    function genTown() {
        const a = mkArea("town", "Srebrnogród", 40, 32, GRASS, false, GRASS);
        const r = mkRng(63);
        for (let i = 0; i < a.t.length; i++)
            if (r() < 0.06)
                a.t[i] = FLOWER;
        for (let y = 0; y < a.h; y++)
            for (let x = 0; x < a.w; x++)
                if (Math.min(x, y, a.w - 1 - x, a.h - 1 - y) <= 1)
                    st(a, x, y, SWALL);
        for (let x = 0; x < 40; x++) {
            st(a, x, 15, COBBLE);
            st(a, x, 16, COBBLE);
        }
        for (let y = 0; y < 30; y++) {
            st(a, 19, y, COBBLE);
            st(a, 20, y, COBBLE);
        }
        disc(19.5, 15.5, 4.2, (x, y) => st(a, x, y, COBBLE));
        st(a, 19, 15, FOUNT);
        st(a, 20, 15, FOUNT);
        st(a, 19, 16, FOUNT);
        st(a, 20, 16, FOUNT);
        houseT(a, 4, 3, 7, 6, ROOF2);
        houseT(a, 27, 3, 8, 6, ROOF2);
        houseT(a, 4, 21, 7, 6, ROOF2);
        houseT(a, 28, 21, 7, 6, ROOF2);
        houseT(a, 12, 3, 5, 5, ROOF);
        for (let y = 9; y <= 14; y++) {
            st(a, 7, y, COBBLE);
            st(a, 31, y, COBBLE);
        }
        for (let y = 8; y <= 14; y++)
            st(a, 14, y, COBBLE);
        for (let y = 27; y <= 28; y++) {
            st(a, 7, y, COBBLE);
            st(a, 31, y, COBBLE);
        }
        for (let x = 7; x <= 31; x++)
            st(a, x, 28, COBBLE);
        for (let y = 2; y < a.h - 2; y++)
            for (let x = 2; x < a.w - 2; x++) {
                const t = gt(a, x, y);
                if ((t === GRASS || t === FLOWER) && r() < 0.05 && cheb(x, y, 19.5, 15.5) > 6)
                    st(a, x, y, TREE);
            }
        for (let x = 0; x <= 1; x++) {
            st(a, x, 15, COBBLE);
            st(a, x, 16, COBBLE);
            st(a, 39 - x, 15, COBBLE);
            st(a, 39 - x, 16, COBBLE);
        }
        for (let y = 15; y <= 16; y++) {
            a.exits.push({ x: 0, y, to: "swamp", tx: 46, ty: y + 5 });
            a.exits.push({ x: 39, y, to: "desert", tx: 1, ty: y + 4 });
        }
        a.exits.push({ x: 19, y: 0, to: "mount", tx: 24, ty: 38 }, { x: 20, y: 0, to: "mount", tx: 25, ty: 38 });
        return a;
    }
    function genMount() {
        const a = mkArea("mount", "Szczyty Szronu", 50, 40, SNOW, false, SNOW);
        const r = mkRng(77);
        for (let i = 0; i < a.t.length; i++) {
            const q = r();
            if (q < 0.27)
                a.t[i] = SPINE;
            else if (q < 0.33)
                a.t[i] = CLIFF;
        }
        borderFill(a, r, [CLIFF, SPINE, CLIFF], 0.7);
        const clr = (x, y) => { if (x > 0 && y > 0 && x < a.w - 1 && y < a.h - 1) {
            const t = gt(a, x, y);
            if (t === SPINE || t === CLIFF)
                st(a, x, y, SNOW);
        } };
        const cl = [[25, 33, 4], [12, 24, 4], [18, 12, 4], [30, 9, 3.5], [40, 16, 4], [38, 28, 4], [42, 6, 5.2], [8, 8, 3], [12, 32, 4.5]];
        for (const c of cl)
            disc(c[0], c[1], c[2], clr);
        disc(12.5, 32.5, 3.2, (x, y) => st(a, x, y, ICE));
        disc(34, 20, 2.2, (x, y) => st(a, x, y, ICE));
        const segs = [[24, 39, 25, 33], [25, 33, 12, 24], [12, 24, 18, 12], [18, 12, 30, 9], [30, 9, 40, 16], [40, 16, 38, 28], [38, 28, 25, 33], [30, 9, 42, 6], [18, 12, 8, 8], [12, 24, 12, 30]];
        for (const s of segs)
            line4(s[0], s[1], s[2], s[3], (x, y) => { disc(x, y, 1.2, clr); if (gt(a, x, y) !== ICE)
                st(a, x, y, PATH); });
        for (let y = 37; y <= 39; y++) {
            st(a, 24, y, PATH);
            st(a, 25, y, PATH);
        }
        houseT(a, 27, 34, 5, 4, ROOF);
        st(a, 42, 5, SNOW);
        for (let x = 24; x <= 25; x++)
            a.exits.push({ x, y: 39, to: "town", tx: x - 5, ty: 1 });
        spawnIn(a, r, 24, 38, [["swolf", 8, (x, y) => y > 16], ["ielem", 6, (x, y) => y < 26], ["yeti", 5, (x, y) => x > 26 || y < 14]], [[29, 33, 6], [42, 5, 5]]);
        a.spawns.push(["dragon", 42, 5]);
        return a;
    }
    function genDesert() {
        const a = mkArea("desert", "Ruiny Piasków", 52, 40, SAND, false, SAND);
        const r = mkRng(91);
        for (let i = 0; i < 34; i++)
            disc(r() * 52, r() * 40, 1.5 + r() * 2.5, (x, y) => st(a, x, y, DUNE));
        for (let i = 0; i < a.t.length; i++) {
            const q = r();
            if (q < 0.035)
                a.t[i] = CACTUS;
            else if (q < 0.05)
                a.t[i] = ROCK;
        }
        borderFill(a, r, [CLIFF, CLIFF, CACTUS], 0.6);
        const clr = (x, y) => { if (x > 0 && y > 0 && x < a.w - 1 && y < a.h - 1) {
            const t = gt(a, x, y);
            if (t === CACTUS || t === ROCK || t === CLIFF)
                st(a, x, y, SAND);
        } };
        disc(15, 14, 3.4, clr);
        disc(12, 9, 3.8, (x, y) => { if (x > 1 && y > 1)
            st(a, x, y, r() < 0.4 ? TREE : SAND); });
        disc(12, 9, 2.6, (x, y) => st(a, x, y, WATER));
        for (let y = 13; y <= 33; y++)
            for (let x = 29; x <= 47; x++)
                st(a, x, y, (x === 29 || x === 47 || y === 13 || y === 33) ? RUINW : RFLOOR);
        for (let y = 13; y <= 33; y++)
            if (y < 22 || y > 24)
                st(a, 38, y, RUINW);
        for (let x = 29; x <= 38; x++)
            if (x !== 33 && x !== 34)
                st(a, x, 23, RUINW);
        for (const y of [17, 18, 28, 29])
            st(a, 29, y, RFLOOR);
        const pil = [[32, 16], [35, 16], [32, 20], [35, 20], [32, 27], [35, 27], [32, 31], [35, 31], [41, 16], [44, 16], [41, 30], [44, 30], [41, 20], [44, 20], [41, 26], [44, 26]];
        for (const p of pil)
            st(a, p[0], p[1], PILLAR);
        for (let y = 14; y < 33; y++)
            for (let x = 30; x < 47; x++)
                if (gt(a, x, y) === RFLOOR && r() < 0.04 && cheb(x, y, 43, 23) > 2)
                    st(a, x, y, DUNE);
        for (let i = 0; i < 10; i++) {
            const x = 4 + Math.floor(r() * 22), y = 18 + Math.floor(r() * 18);
            st(a, x, y, r() < 0.5 ? RUINW : PILLAR);
        }
        const segs = [[0, 19, 15, 15], [15, 15, 28, 17], [15, 15, 20, 30], [20, 30, 28, 28], [15, 15, 15, 6], [28, 17, 29, 17], [28, 28, 29, 28]];
        for (const s of segs)
            line4(s[0], s[1], s[2], s[3], (x, y) => { disc(x, y, 1, clr); const t = gt(a, x, y); if (t !== RFLOOR && t !== WATER)
                st(a, x, y, PATH); });
        for (let y = 19; y <= 20; y++) {
            st(a, 0, y, PATH);
            st(a, 1, y, PATH);
        }
        st(a, 43, 23, RFLOOR);
        for (const s0 of [[15, 15, 22, 8], [22, 8, 51, 8]])
            line4(s0[0], s0[1], s0[2], s0[3], (x, y) => { disc(x, y, 1, clr); const t = gt(a, x, y); if (t !== RFLOOR && t !== WATER && t !== RUINW && t !== PILLAR)
                st(a, x, y, PATH); });
        for (let x = 48; x <= 51; x++) {
            st(a, x, 7, PATH);
            st(a, x, 8, PATH);
        }
        for (let y = 7; y <= 8; y++)
            a.exits.push({ x: 51, y, to: "port", tx: 1, ty: y + 6 });
        for (let y = 19; y <= 20; y++)
            a.exits.push({ x: 0, y, to: "town", tx: 38, ty: y - 4 });
        const inT = (x, y) => x > 29 && x < 47 && y > 13 && y < 33;
        spawnIn(a, r, 1, 19, [["scorp", 9, (x, y) => !inT(x, y)], ["mummy", 7, (x, y) => inT(x, y) && x < 38], ["golem", 4, (x, y) => inT(x, y) && x > 38]], [[16, 13, 6], [43, 23, 4]]);
        a.spawns.push(["king", 43, 23]);
        return a;
    }
    function genCity(id, name, seed, base, roofA, roofB, ex) {
        const a = mkArea(id, name, 36, 28, base, false, base);
        const r = mkRng(seed);
        if (base === GRASS)
            for (let i = 0; i < a.t.length; i++)
                if (r() < 0.05)
                    a.t[i] = FLOWER;
        for (let y = 0; y < a.h; y++)
            for (let x = 0; x < a.w; x++)
                if (Math.min(x, y, a.w - 1 - x, a.h - 1 - y) <= 1)
                    st(a, x, y, SWALL);
        for (let x = 2; x < 34; x++) {
            st(a, x, 13, COBBLE);
            st(a, x, 14, COBBLE);
        }
        for (let y = 2; y < 26; y++) {
            st(a, 17, y, COBBLE);
            st(a, 18, y, COBBLE);
        }
        disc(17.5, 13.5, 3.6, (x, y) => st(a, x, y, COBBLE));
        st(a, 17, 13, FOUNT);
        st(a, 18, 13, FOUNT);
        st(a, 17, 14, FOUNT);
        st(a, 18, 14, FOUNT);
        houseT(a, 4, 3, 7, 6, roofA);
        houseT(a, 25, 3, 7, 6, roofB);
        houseT(a, 4, 18, 7, 5, roofB);
        houseT(a, 25, 18, 7, 5, roofA);
        for (let y = 9; y <= 12; y++) {
            st(a, 7, y, COBBLE);
            st(a, 28, y, COBBLE);
        }
        for (let x = 7; x <= 28; x++)
            st(a, x, 24, COBBLE);
        st(a, 7, 23, COBBLE);
        st(a, 28, 23, COBBLE);
        st(a, 7, 22, DOOR);
        st(a, 28, 22, DOOR);
        for (let y = 2; y < a.h - 2; y++)
            for (let x = 2; x < a.w - 2; x++) {
                const t = gt(a, x, y);
                if ((t === base || t === FLOWER) && r() < 0.045 && cheb(x, y, 17.5, 13.5) > 5 && (y < 11 || y > 16))
                    st(a, x, y, TREE);
            }
        if (ex.indexOf("w") >= 0)
            for (let y = 13; y <= 14; y++) {
                st(a, 0, y, COBBLE);
                st(a, 1, y, COBBLE);
            }
        if (ex.indexOf("e") >= 0)
            for (let y = 13; y <= 14; y++) {
                st(a, 34, y, COBBLE);
                st(a, 35, y, COBBLE);
            }
        if (ex.indexOf("n") >= 0)
            for (let x = 17; x <= 18; x++) {
                st(a, x, 0, COBBLE);
                st(a, x, 1, COBBLE);
            }
        if (ex.indexOf("s") >= 0)
            for (let x = 17; x <= 18; x++) {
                st(a, x, 26, COBBLE);
                st(a, x, 27, COBBLE);
            }
        return a;
    }
    function genPort() {
        const a = genCity("port", "Mewia Przystań", 401, GRASS, ROOF, ROOF2, "we");
        for (let x = 2; x < 34; x++) {
            st(a, x, 26, WATER);
            st(a, x, 27, WATER);
            if (x !== 17 && x !== 18)
                st(a, x, 25, x % 5 === 0 ? FENCE : COBBLE);
        }
        for (let y = 25; y <= 27; y++) {
            st(a, 17, y, BRIDGE);
            st(a, 18, y, BRIDGE);
        }
        for (let y = 13; y <= 14; y++) {
            a.exits.push({ x: 0, y, to: "desert", tx: 50, ty: y - 6 });
            a.exits.push({ x: 35, y, to: "coast", tx: 1, ty: y + 6 });
        }
        return a;
    }
    function genCoast() {
        const a = mkArea("coast", "Wybrzeże Wraków", 50, 40, SAND, false, SAND);
        const r = mkRng(411);
        for (let y = 0; y < a.h; y++) {
            const shore = 37 + Math.round(Math.sin(y * 0.35) * 2 + r() * 1.5);
            for (let x = shore; x < a.w; x++)
                st(a, x, y, WATER);
        }
        for (let i = 0; i < a.t.length; i++) {
            const q = r();
            if (a.t[i] === SAND) {
                if (q < 0.035)
                    a.t[i] = TREE;
                else if (q < 0.06)
                    a.t[i] = ROCK;
                else if (q < 0.1)
                    a.t[i] = DUNE;
            }
        }
        borderFill(a, r, [CLIFF, ROCK, TREE], 0.55);
        for (let y = 0; y < a.h; y++)
            for (let x = 36; x < a.w; x++)
                if (gt(a, x, y) === CLIFF || gt(a, x, y) === ROCK || gt(a, x, y) === TREE) {
                    if (x > 39)
                        st(a, x, y, WATER);
                }
        const clr = (x, y) => { if (x > 0 && y > 0 && x < a.w - 1 && y < a.h - 1) {
            const t = gt(a, x, y);
            if (t === TREE || t === ROCK || t === CLIFF)
                st(a, x, y, SAND);
        } };
        disc(33, 8, 4.2, (x, y) => { if (x > 1 && y > 1 && x < 48)
            st(a, x, y, SAND); });
        const segs = [[0, 19, 12, 20], [12, 20, 24, 20], [24, 20, 24, 0], [24, 20, 30, 31], [12, 20, 10, 32], [24, 12, 33, 8]];
        for (const s0 of segs)
            line4(s0[0], s0[1], s0[2], s0[3], (x, y) => { disc(x, y, 1, clr); if (gt(a, x, y) !== WATER)
                st(a, x, y, PATH); });
        for (let y = 19; y <= 20; y++) {
            st(a, 0, y, PATH);
            st(a, 1, y, PATH);
        }
        for (let x = 24; x <= 25; x++) {
            st(a, x, 0, PATH);
            st(a, x, 1, PATH);
        }
        for (let i = 0; i < 6; i++) {
            const x = 6 + Math.floor(r() * 26), y = 4 + Math.floor(r() * 32);
            if (gt(a, x, y) === SAND)
                st(a, x, y, RUINW);
        }
        for (let y = 19; y <= 20; y++)
            a.exits.push({ x: 0, y, to: "port", tx: 34, ty: y - 6 });
        for (let x = 24; x <= 25; x++)
            a.exits.push({ x, y: 0, to: "fort", tx: x - 7, ty: 26 });
        spawnIn(a, r, 1, 19, [["crab", 9, (x, y) => x > 6], ["pirate", 8, (x, y) => y > 14], ["siren", 6, (x) => x > 22]], [[33, 8, 5], [24, 2, 4]]);
        a.spawns.push(["leviathan", 34, 7]);
        return a;
    }
    function genFort() {
        const a = genCity("fort", "Twierdza Żarogród", 421, DGRASS, ROOF, ROOF, "wns");
        for (const p of [[14, 10], [21, 10], [14, 17], [21, 17]])
            st(a, p[0], p[1], PILLAR);
        for (let y = 13; y <= 14; y++)
            a.exits.push({ x: 0, y, to: "volcano", tx: 48, ty: y + 6 });
        for (let x = 17; x <= 18; x++) {
            a.exits.push({ x, y: 27, to: "coast", tx: x + 7, ty: 1 });
            a.exits.push({ x, y: 0, to: "citadel", tx: x, ty: 26 });
        }
        return a;
    }
    function genVolcano() {
        const a = mkArea("volcano", "Wulkan Ignara", 50, 40, ASH, false, ASH);
        const r = mkRng(431);
        for (let i = 0; i < 16; i++)
            disc(4 + r() * 42, 4 + r() * 32, 1.2 + r() * 2.6, (x, y) => st(a, x, y, LAVA));
        for (let i = 0; i < a.t.length; i++) {
            const q = r();
            if (a.t[i] === ASH) {
                if (q < 0.05)
                    a.t[i] = ROCK;
                else if (q < 0.08)
                    a.t[i] = CLIFF;
                else if (q < 0.095)
                    a.t[i] = DEADT;
            }
        }
        borderFill(a, r, [CLIFF, CLIFF, ROCK], 0.65);
        const clr = (x, y) => { if (x > 0 && y > 0 && x < a.w - 1 && y < a.h - 1) {
            const t = gt(a, x, y);
            if (t === ROCK || t === CLIFF || t === DEADT || t === LAVA)
                st(a, x, y, ASH);
        } };
        disc(9, 8, 4.5, clr);
        disc(9, 8, 6.5, (x, y) => { if (cheb(x, y, 9, 8) >= 5 && gt(a, x, y) === ASH && r() < 0.5)
            st(a, x, y, LAVA); });
        const segs = [[49, 19, 36, 20], [36, 20, 24, 14], [24, 14, 12, 10], [36, 20, 30, 32], [24, 14, 22, 30], [30, 32, 14, 30], [12, 10, 9, 8]];
        for (const s0 of segs)
            line4(s0[0], s0[1], s0[2], s0[3], (x, y) => { disc(x, y, 1.2, clr); st(a, x, y, PATH); });
        for (let y = 19; y <= 20; y++) {
            st(a, 49, y, PATH);
            st(a, 48, y, PATH);
        }
        for (let y = 19; y <= 20; y++)
            a.exits.push({ x: 49, y, to: "fort", tx: 1, ty: y - 6 });
        spawnIn(a, r, 48, 19, [["imp", 9, () => true], ["salam", 8, (x, y) => x < 40], ["lgolem", 5, (x, y) => x < 30]], [[9, 8, 6], [44, 30, 3]]);
        a.spawns.push(["ignar", 9, 8]);
        return a;
    }
    function genCitadel() {
        const a = genCity("citadel", "Cytadela Świtu", 441, COBBLE, ROOF2, ROOF2, "ws");
        for (const p of [[13, 9], [22, 9], [13, 18], [22, 18]])
            st(a, p[0], p[1], PILLAR);
        for (let y = 13; y <= 14; y++)
            a.exits.push({ x: 0, y, to: "abyss", tx: 48, ty: y + 6 });
        for (let x = 17; x <= 18; x++)
            a.exits.push({ x, y: 27, to: "fort", tx: x, ty: 1 });
        return a;
    }
    function genAbyss() {
        const a = mkArea("abyss", "Otchłań Zmierzchu", 50, 40, FLOOR, true, FLOOR);
        const r = mkRng(451);
        for (let i = 0; i < a.t.length; i++) {
            const q = r();
            if (q < 0.1)
                a.t[i] = CWALL;
            else if (q < 0.125)
                a.t[i] = CRYSTAL;
            else if (q < 0.14)
                a.t[i] = DEADT;
        }
        borderFill(a, r, [CWALL, CWALL, CRYSTAL], 0.7);
        const clr = (x, y) => { if (x > 0 && y > 0 && x < a.w - 1 && y < a.h - 1) {
            const t = gt(a, x, y);
            if (t === CWALL || t === CRYSTAL || t === DEADT)
                st(a, x, y, FLOOR);
        } };
        const cl = [[42, 20, 4], [30, 12, 4], [40, 8, 5], [18, 10, 4], [10, 22, 4], [20, 32, 4], [38, 32, 4], [28, 24, 3.5]];
        for (const c of cl)
            disc(c[0], c[1], c[2], clr);
        const segs = [[49, 19, 42, 20], [42, 20, 30, 12], [30, 12, 40, 8], [30, 12, 18, 10], [18, 10, 10, 22], [10, 22, 20, 32], [20, 32, 38, 32], [38, 32, 42, 20], [28, 24, 20, 32], [28, 24, 30, 12]];
        for (const s0 of segs)
            line4(s0[0], s0[1], s0[2], s0[3], (x, y) => { disc(x, y, 1.2, clr); st(a, x, y, PATH); });
        for (let y = 19; y <= 20; y++) {
            st(a, 49, y, PATH);
            st(a, 48, y, PATH);
        }
        for (let y = 19; y <= 20; y++)
            a.exits.push({ x: 49, y, to: "citadel", tx: 1, ty: y - 6 });
        spawnIn(a, r, 48, 19, [["shade", 9, () => true], ["voidb", 7, (x) => x < 40], ["dknight", 5, (x, y) => x < 32]], [[40, 8, 6], [38, 32, 3]]);
        a.spawns.push(["morgath", 40, 7]);
        return a;
    }
    // round 6: data-driven hunting land: scattered obstacles, clearings (nodes) joined by paths, edge exits
    function genWild(o) {
        const a = mkArea(o.id, o.name, o.w, o.h, o.base, !!o.dark, o.base);
        const r = mkRng(o.seed);
        for (const b of o.blobs || [])
            for (let i = 0; i < b[1]; i++)
                disc(3 + r() * (a.w - 6), 3 + r() * (a.h - 6), b[2] + r() * b[3], (x, y) => st(a, x, y, b[0]));
        for (let i = 0; i < a.t.length; i++) {
            if (a.t[i] !== o.base)
                continue;
            let q = r();
            for (const s0 of o.scat) {
                if (q < s0[1]) {
                    a.t[i] = s0[0];
                    break;
                }
                q -= s0[1];
            }
        }
        borderFill(a, r, o.border, 0.6);
        const inner = (x, y) => x > 0 && y > 0 && x < a.w - 1 && y < a.h - 1;
        const clrN = (x, y) => { if (inner(x, y) && BLOCK[gt(a, x, y)])
            st(a, x, y, o.base); };
        const clrL = (x, y) => { if (!inner(x, y))
            return; const t = gt(a, x, y); if (BLOCK[t] && t !== WATER && t !== BOG)
            st(a, x, y, o.base); };
        for (const c of o.nodes)
            disc(c[0], c[1], c[2], clrN);
        for (const s0 of o.segs)
            line4(s0[0], s0[1], s0[2], s0[3], (x, y) => { disc(x, y, 1.2, clrL); const t = gt(a, x, y); st(a, x, y, t === WATER || t === BOG ? BRIDGE : PATH); });
        for (const e of o.edges)
            for (let c = e[1]; c <= e[2]; c++) {
                for (let d = 0; d <= 1; d++) {
                    const x = e[0] === "w" ? d : e[0] === "e" ? a.w - 1 - d : c, y = e[0] === "n" ? d : e[0] === "s" ? a.h - 1 - d : c;
                    st(a, x, y, PATH);
                }
                const ex = e[0] === "w" ? 0 : e[0] === "e" ? a.w - 1 : c, ey = e[0] === "n" ? 0 : e[0] === "s" ? a.h - 1 : c;
                a.exits.push(e[0] === "w" || e[0] === "e" ? { x: ex, y: ey, to: e[3], tx: e[4], ty: c + e[5] } : { x: ex, y: ey, to: e[3], tx: c + e[5], ty: e[4] });
            }
        for (const p of o.free || [])
            disc(p[0], p[1], 1.5, (x, y) => { if (inner(x, y) && BLOCK[gt(a, x, y)])
                st(a, x, y, o.base); });
        const e0 = a.exits[0];
        spawnIn(a, r, e0.x, e0.y, o.spawns, o.avoid);
        a.spawns.push([o.boss[0], o.boss[1], o.boss[2]]);
        return a;
    }
    // carve a corridor from the map edge inwards until it meets the walkable part of an existing area
    function openEdge(a, side, c0, c1, tile, to, fixed, off) {
        const e0 = a.exits[0];
        const seen = reach(a, e0.x, e0.y);
        for (let c = c0; c <= c1; c++) {
            for (let d = 0; d < Math.max(a.w, a.h); d++) {
                const x = side === "w" ? d : side === "e" ? a.w - 1 - d : c, y = side === "n" ? d : side === "s" ? a.h - 1 - d : c;
                if (d > 1 && seen[y * a.w + x])
                    break;
                st(a, x, y, tile);
            }
            const ex = side === "w" ? 0 : side === "e" ? a.w - 1 : c, ey = side === "n" ? 0 : side === "s" ? a.h - 1 : c;
            a.exits.push(side === "w" || side === "e" ? { x: ex, y: ey, to, tx: fixed, ty: c + off } : { x: ex, y: ey, to, tx: c + off, ty: fixed });
        }
    }
    function genStar() {
        const a = genCity("star", "Gwiezdna Strażnica", 461, COBBLE, ROOF2, ROOF, "wse");
        for (const p of [[13, 9], [22, 9], [13, 18], [22, 18]])
            st(a, p[0], p[1], PILLAR);
        for (let y = 13; y <= 14; y++) {
            a.exits.push({ x: 0, y, to: "citadel", tx: 34, ty: y });
            a.exits.push({ x: 35, y, to: "crystal", tx: 1, ty: y + 6 });
        }
        for (let x = 17; x <= 18; x++)
            a.exits.push({ x, y: 27, to: "necro", tx: x + 7, ty: 1 });
        return a;
    }
    const AREAS = {};
    [genVillage(), genForest(), genCave(), genSwamp(), genTown(), genMount(), genDesert(), genPort(), genCoast(), genFort(), genVolcano(), genCitadel(), genAbyss(), genStar(), genWild({ id: "wolfhills", name: "Wilcze Wzgórza", w: 50, h: 40, base: GRASS, seed: 501, dark: false, blobs: [[WATER, 3, 1.4, 1.4]], scat: [[TREE, 0.15], [DGRASS, 0.1], [ROCK, 0.03], [FLOWER, 0.05]], border: [TREE, TREE, ROCK], nodes: [[25, 4, 3.4], [14, 12, 4], [36, 12, 4], [24, 22, 4], [12, 30, 4], [38, 31, 4.5], [25, 34, 3.5]], segs: [[24, 0, 25, 4], [25, 4, 14, 12], [25, 4, 36, 12], [14, 12, 24, 22], [36, 12, 24, 22], [24, 22, 12, 30], [24, 22, 38, 31], [12, 30, 25, 34], [25, 34, 38, 31]], edges: [["n", 24, 25, "village", 28, -5]], spawns: [["bandit", 9, (x, y) => y > 8], ["bwolf", 8, (x, y) => true], ["bear", 5, (x, y) => y > 18]], avoid: [[25, 4, 6], [38, 31, 4]], boss: ["kiel", 38, 31], free: [[27, 4], [22, 3], [23, 6]] }), genWild({ id: "mine", name: "Kopalnia Krasnoludów", w: 44, h: 34, base: FLOOR, seed: 511, dark: true, blobs: [[WATER, 2, 1.2, 1]], scat: [[CWALL, 0.15], [ROCK, 0.05], [CRYSTAL, 0.015]], border: [CWALL, CWALL, ROCK], nodes: [[38, 21, 3.6], [28, 14, 4], [30, 27, 4], [16, 8, 4], [16, 22, 4.5], [8, 27, 4.5], [6, 12, 3]], segs: [[43, 21, 38, 21], [38, 21, 28, 14], [38, 21, 30, 27], [28, 14, 16, 8], [28, 14, 16, 22], [30, 27, 16, 22], [16, 22, 8, 27], [16, 8, 6, 12]], edges: [["e", 20, 22, "cave", 1, 1]], spawns: [["kobold", 9, (x, y) => true], ["crawler", 7, (x, y) => true], ["dghost", 5, (x, y) => x < 24]], avoid: [[38, 21, 5], [8, 27, 4]], boss: ["grimgor", 8, 27], free: [[38, 19], [37, 23]] }), genWild({ id: "glacier", name: "Lodowiec Wichrów", w: 50, h: 40, base: SNOW, seed: 521, dark: false, blobs: [[ICE, 6, 2, 2.5]], scat: [[SPINE, 0.2], [CLIFF, 0.06], [ROCK, 0.03]], border: [CLIFF, SPINE, CLIFF], nodes: [[25, 34, 3.6], [14, 26, 4], [36, 26, 4], [24, 17, 4.5], [10, 10, 4], [38, 9, 5], [24, 6, 3.5]], segs: [[25, 39, 25, 34], [25, 34, 14, 26], [25, 34, 36, 26], [14, 26, 24, 17], [36, 26, 24, 17], [24, 17, 10, 10], [24, 17, 24, 6], [24, 6, 38, 9], [36, 26, 38, 9]], edges: [["s", 24, 26, "mount", 1, 17]], spawns: [["frwraith", 9, (x, y) => true], ["icetroll", 7, (x, y) => y < 30], ["mammoth", 5, (x, y) => y < 22]], avoid: [[25, 34, 6], [38, 9, 5]], boss: ["szronia", 38, 8], free: [[27, 34], [22, 33], [23, 36]] }), genWild({ id: "steppe", name: "Spalone Stepy", w: 50, h: 40, base: SAND, seed: 531, dark: false, blobs: [[ASH, 8, 2, 3]], scat: [[DUNE, 0.08], [ROCK, 0.04], [CACTUS, 0.03], [DEADT, 0.03]], border: [CLIFF, ROCK, CLIFF], nodes: [[24, 34, 3.6], [12, 27, 4], [37, 27, 4], [24, 19, 4.5], [10, 11, 4], [39, 10, 4.5], [24, 5, 3]], segs: [[24, 39, 24, 34], [24, 34, 12, 27], [24, 34, 37, 27], [12, 27, 24, 19], [37, 27, 24, 19], [24, 19, 10, 11], [24, 19, 39, 10], [24, 19, 24, 5], [24, 5, 24, 0], [25, 5, 25, 0]], edges: [["s", 23, 25, "desert", 1, 0], ["n", 24, 25, "elfwood", 38, 0]], spawns: [["hyena", 9, (x, y) => true], ["nomad", 7, (x, y) => true], ["basil", 5, (x, y) => y < 24]], avoid: [[24, 34, 6], [39, 10, 4]], boss: ["burzan", 40, 9], free: [[26, 34], [21, 33], [22, 36]] }), genWild({ id: "elfwood", name: "Szmaragdowa Puszcza", w: 50, h: 40, base: DGRASS, seed: 541, dark: false, blobs: [[WATER, 4, 1.5, 2]], scat: [[TREE, 0.24], [FLOWER, 0.05], [ROCK, 0.02]], border: [TREE, TREE, TREE], nodes: [[25, 34, 3.6], [13, 27, 4], [37, 26, 4], [25, 18, 4.5], [11, 8, 5], [38, 10, 4], [25, 7, 3.5]], segs: [[24, 39, 25, 34], [25, 39, 25, 34], [25, 34, 13, 27], [25, 34, 37, 26], [13, 27, 25, 18], [37, 26, 25, 18], [25, 18, 25, 7], [25, 7, 11, 8], [25, 7, 38, 10], [37, 26, 38, 10]], edges: [["s", 24, 25, "steppe", 1, 0]], spawns: [["delf", 9, (x, y) => true], ["wwolf", 7, (x, y) => y < 30], ["treant", 5, (x, y) => y < 24]], avoid: [[25, 34, 6], [11, 8, 5]], boss: ["morana", 11, 7], free: [[27, 34], [22, 33], [23, 36]] }), genWild({ id: "sunken", name: "Zatopione Miasto", w: 50, h: 40, base: RFLOOR, seed: 551, dark: true, blobs: [[WATER, 14, 1.5, 2.5]], scat: [[RUINW, 0.06], [PILLAR, 0.03], [REED, 0.03]], border: [WATER, RUINW, WATER], nodes: [[25, 5, 3.6], [13, 12, 4], [37, 12, 4], [25, 21, 4.5], [12, 30, 4], [38, 30, 4], [25, 33, 5]], segs: [[24, 0, 24, 5], [25, 0, 25, 5], [25, 5, 13, 12], [25, 5, 37, 12], [13, 12, 25, 21], [37, 12, 25, 21], [25, 21, 12, 30], [25, 21, 38, 30], [12, 30, 25, 33], [38, 30, 25, 33]], edges: [["n", 24, 25, "coast", 38, 0]], spawns: [["naga", 9, (x, y) => true], ["drowned", 7, (x, y) => true], ["tentacle", 5, (x, y) => y > 16]], avoid: [[25, 5, 6], [25, 33, 5]], boss: ["thalassor", 25, 34], free: [[27, 5], [22, 4]] }), genWild({ id: "crystal", name: "Kryształowe Pustkowia", w: 50, h: 40, base: SNOW, seed: 561, dark: false, blobs: [[ICE, 8, 2, 3]], scat: [[CRYSTAL, 0.12], [ROCK, 0.05], [CLIFF, 0.05]], border: [CRYSTAL, CLIFF, CRYSTAL], nodes: [[5, 19.5, 3], [15, 12, 4], [15, 28, 4], [27, 20, 4.5], [37, 10, 4.5], [37, 30, 4], [44, 20, 5]], segs: [[0, 19, 5, 19], [0, 20, 5, 20], [5, 19, 15, 12], [5, 19, 15, 28], [15, 12, 27, 20], [15, 28, 27, 20], [27, 20, 37, 10], [27, 20, 37, 30], [37, 10, 44, 20], [37, 30, 44, 20]], edges: [["w", 19, 20, "star", 34, -6]], spawns: [["cspider", 9, (x, y) => true], ["starw", 7, (x, y) => true], ["cgolem", 5, (x, y) => x > 20]], avoid: [[5, 19, 6], [44, 20, 5]], boss: ["kolos", 44, 20], free: [] }), genWild({ id: "necro", name: "Nekropolia Valgaru", w: 50, h: 40, base: FLOOR, seed: 571, dark: true, blobs: [[BOG, 5, 1.5, 2]], scat: [[RUINW, 0.06], [DEADT, 0.05], [PILLAR, 0.02], [CWALL, 0.06]], border: [CWALL, RUINW, CWALL], nodes: [[24.5, 5, 3.5], [12, 12, 4], [37, 12, 4], [24, 21, 5], [10, 30, 4.5], [37, 30, 4], [44, 20, 3.5]], segs: [[24, 0, 24, 5], [25, 0, 25, 5], [24, 5, 12, 12], [24, 5, 37, 12], [12, 12, 24, 21], [37, 12, 24, 21], [24, 21, 10, 30], [24, 21, 37, 30], [37, 30, 44, 20], [37, 12, 44, 20], [44, 20, 49, 19], [44, 20, 49, 20]], edges: [["n", 24, 25, "star", 26, -7], ["e", 19, 20, "dragon", 1, 0]], spawns: [["bmage", 9, (x, y) => true], ["specter", 7, (x, y) => true], ["bdrake", 5, (x, y) => y > 14]], avoid: [[24, 5, 6], [10, 30, 5]], boss: ["valgar", 10, 31], free: [] }), genWild({ id: "dragon", name: "Smocze Gniazdo", w: 50, h: 40, base: ASH, seed: 581, dark: false, blobs: [[LAVA, 14, 1.2, 2.4]], scat: [[ROCK, 0.05], [CLIFF, 0.07], [DEADT, 0.02]], border: [CLIFF, CLIFF, ROCK], nodes: [[5, 19.5, 3], [15, 10, 4], [16, 30, 4], [27, 20, 4.5], [37, 30, 4], [36, 9, 4], [43, 18, 5.5]], segs: [[0, 19, 5, 19], [0, 20, 5, 20], [5, 19, 15, 10], [5, 19, 16, 30], [15, 10, 27, 20], [16, 30, 27, 20], [27, 20, 36, 9], [27, 20, 37, 30], [36, 9, 43, 18], [37, 30, 43, 18]], edges: [["w", 19, 20, "necro", 48, 0]], spawns: [["drakon", 9, (x, y) => true], ["dkin", 7, (x, y) => true], ["wyrm", 5, (x, y) => x > 20]], avoid: [[5, 19, 6], [43, 18, 6]], boss: ["valdrak", 44, 18], free: [] })].forEach((a) => { AREAS[a.id] = a; });
    // round 6: roads from the old world into the new lands
    openEdge(AREAS.village, "s", 19, 20, PATH, "wolfhills", 1, 5);
    openEdge(AREAS.cave, "w", 21, 23, FLOOR, "mine", 42, -1);
    openEdge(AREAS.mount, "n", 41, 43, PATH, "glacier", 38, -17);
    openEdge(AREAS.desert, "n", 23, 25, PATH, "steppe", 38, 0);
    openEdge(AREAS.coast, "s", 24, 25, PATH, "sunken", 1, 0);
    openEdge(AREAS.citadel, "e", 13, 14, COBBLE, "star", 1, 0);
    Object.keys(AREAS).forEach((k) => {
        const a = AREAS[k];
        const e0 = a.exits[0];
        const seen = reach(a, e0.x, e0.y);
        for (const sp of a.spawns) {
            if (seen[sp[2] * a.w + sp[1]])
                continue;
            let done = false;
            for (let r = 1; r < 8 && !done; r++)
                for (let dy = -r; dy <= r && !done; dy++)
                    for (let dx = -r; dx <= r && !done; dx++) {
                        const x = sp[1] + dx, y = sp[2] + dy;
                        if (x > 0 && y > 0 && x < a.w && y < a.h && seen[y * a.w + x]) {
                            sp[1] = x;
                            sp[2] = y;
                            done = true;
                        }
                    }
        }
    });
    const AINFO = {
        village: { lv: "Bezpieczna osada · potwory poz. 1", amb: "", dark: 0, bg: "#1d3a18", gx: 0, gy: 1 },
        forest: { lv: "Potwory poz. 3–6", amb: "fly", dark: 0, bg: "#1d3a18", gx: 1, gy: 1 },
        cave: { lv: "Potwory poz. 7–12", amb: "", dark: 0.88, bg: "#0b090e", gx: 1, gy: 0 },
        swamp: { lv: "Potwory poz. 10–16", amb: "fog", dark: 0.5, bg: "#1e2618", gx: 1, gy: 2 },
        town: { lv: "Bezpieczne miasto · sklepy i zadania", amb: "", dark: 0, bg: "#2a2830", gx: 2, gy: 2 },
        mount: { lv: "Potwory poz. 14–22", amb: "snow", dark: 0, bg: "#6f7480", gx: 2, gy: 1 },
        desert: { lv: "Potwory poz. 18–26", amb: "sand", dark: 0, bg: "#9a7448", gx: 3, gy: 2 },
        port: { lv: "Bezpieczne miasto · poz. 26+", amb: "", dark: 0, bg: "#24343a", gx: 4, gy: 2 },
        coast: { lv: "Potwory poz. 27–36", amb: "", dark: 0, bg: "#7a6a48", gx: 5, gy: 2 },
        fort: { lv: "Bezpieczne miasto · poz. 36+", amb: "", dark: 0, bg: "#2a2622", gx: 5, gy: 1 },
        volcano: { lv: "Potwory poz. 37–48", amb: "", dark: 0.25, bg: "#1a1012", gx: 4, gy: 1 },
        citadel: { lv: "Bezpieczne miasto · poz. 46+", amb: "", dark: 0, bg: "#2a2a38", gx: 5, gy: 0 },
        abyss: { lv: "Potwory poz. 49–60", amb: "fog", dark: 0.6, bg: "#0b0812", gx: 4, gy: 0 },
        wolfhills: { lv: "Potwory poz. 4–10", amb: "fly", dark: 0, bg: "#24401c", gx: 0, gy: 2 },
        mine: { lv: "Potwory poz. 11–18", amb: "", dark: 0.45, bg: "#0c0a0e", gx: 0, gy: 0 },
        glacier: { lv: "Potwory poz. 20–28", amb: "snow", dark: 0, bg: "#7a8494", gx: 2, gy: 0 },
        steppe: { lv: "Potwory poz. 25–33", amb: "sand", dark: 0, bg: "#8a6a40", gx: 3, gy: 1 },
        elfwood: { lv: "Potwory poz. 31–39", amb: "fly", dark: 0.15, bg: "#14301a", gx: 3, gy: 0 },
        sunken: { lv: "Potwory poz. 42–50", amb: "fog", dark: 0.4, bg: "#0e2026", gx: 5, gy: 3 },
        star: { lv: "Bezpieczne miasto · poz. 60+", amb: "", dark: 0, bg: "#1c2236", gx: 6, gy: 0 },
        crystal: { lv: "Potwory poz. 60–68", amb: "snow", dark: 0.15, bg: "#5a7088", gx: 7, gy: 0 },
        necro: { lv: "Potwory poz. 66–74", amb: "fog", dark: 0.32, bg: "#0e0c12", gx: 6, gy: 1 },
        dragon: { lv: "Potwory poz. 72–80", amb: "", dark: 0.25, bg: "#1a0c0a", gx: 7, gy: 1 },
    };
    const GRAPH = {};
    const EXG = {};
    Object.keys(AREAS).forEach((k) => {
        GRAPH[k] = {};
        EXG[k] = [];
        for (const e of AREAS[k].exits) {
            (GRAPH[k][e.to] = GRAPH[k][e.to] || []).push(e);
        }
        for (const to of Object.keys(GRAPH[k])) {
            const es = GRAPH[k][to];
            let sx = 0, sy = 0;
            for (const e of es) {
                sx += e.x;
                sy += e.y;
            }
            EXG[k].push({ to, x: sx / es.length, y: sy / es.length });
        }
    });
    function routeNext(from, to) {
        if (from === to)
            return to;
        const prev = {};
        prev[from] = from;
        const q = [from];
        while (q.length) {
            const c = q.shift();
            for (const n of Object.keys(GRAPH[c])) {
                if (prev[n])
                    continue;
                prev[n] = c;
                if (n === to) {
                    let p = n;
                    while (prev[p] !== from)
                        p = prev[p];
                    return p;
                }
                q.push(n);
            }
        }
        return null;
    }
    function routeList(from, to) {
        const out = [from];
        let c = from, g = 0;
        while (c !== to && g++ < 40) {
            const n = routeNext(c, to);
            if (!n)
                break;
            out.push(n);
            c = n;
        }
        return out;
    }
    // ---------- TILE ART ----------
    function grass(g, px, py, h, dark) {
        g.fillStyle = dark ? "#3f7a33" : "#4b8d3b";
        g.fillRect(px, py, TS, TS);
        for (let i = 0; i < 7; i++) {
            g.fillStyle = h() < 0.5 ? (dark ? "#4c8a3e" : "#5ca34a") : (dark ? "#336a2a" : "#3e7a31");
            g.fillRect(px + Math.floor(h() * 30), py + Math.floor(h() * 30), 2, h() < 0.3 ? 4 : 2);
        }
    }
    function floorT(g, px, py, h) {
        g.fillStyle = "#4b4552";
        g.fillRect(px, py, TS, TS);
        for (let i = 0; i < 6; i++) {
            g.fillStyle = h() < 0.5 ? "#56505e" : "#403a47";
            g.fillRect(px + Math.floor(h() * 29), py + Math.floor(h() * 29), 3, 3);
        }
        if (h() < 0.25) {
            g.fillStyle = "#35303d";
            const x = px + 4 + Math.floor(h() * 20), y = py + 4 + Math.floor(h() * 20);
            g.fillRect(x, y, 6, 1);
            g.fillRect(x + 5, y + 1, 1, 5);
        }
        if (h() < 0.04) {
            g.fillStyle = "#d8d2c0";
            const x = px + 8 + Math.floor(h() * 12), y = py + 10 + Math.floor(h() * 12);
            g.fillRect(x, y, 8, 2);
            g.fillRect(x - 1, y - 1, 2, 4);
            g.fillRect(x + 7, y - 1, 2, 4);
        }
    }
    function snowT(g, px, py, h) {
        g.fillStyle = "#e6edf6";
        g.fillRect(px, py, TS, TS);
        for (let i = 0; i < 6; i++) {
            g.fillStyle = h() < 0.5 ? "#d5deeb" : "#f8fbff";
            g.fillRect(px + Math.floor(h() * 29), py + Math.floor(h() * 29), 3, 2);
        }
        if (h() < 0.18) {
            g.fillStyle = "#c3cfe0";
            g.fillRect(px + 2 + Math.floor(h() * 22), py + 4 + Math.floor(h() * 22), 7, 1);
        }
    }
    function mudT(g, px, py, h) {
        g.fillStyle = "#58553a";
        g.fillRect(px, py, TS, TS);
        for (let i = 0; i < 7; i++) {
            g.fillStyle = h() < 0.5 ? "#666245" : "#4a4830";
            g.fillRect(px + Math.floor(h() * 29), py + Math.floor(h() * 29), 3, 2);
        }
        if (h() < 0.2) {
            g.fillStyle = "#3c4836";
            g.beginPath();
            g.ellipse(px + 8 + h() * 16, py + 8 + h() * 16, 5, 3, 0, 0, Math.PI * 2);
            g.fill();
        }
    }
    function sandT(g, px, py, h, dune) {
        g.fillStyle = dune ? "#d2ad68" : "#dec384";
        g.fillRect(px, py, TS, TS);
        for (let i = 0; i < 7; i++) {
            g.fillStyle = h() < 0.5 ? (dune ? "#c49d5a" : "#d0b273") : (dune ? "#ddbb78" : "#e9d29a");
            g.fillRect(px + Math.floor(h() * 30), py + Math.floor(h() * 30), 2, 2);
        }
        if (dune) {
            g.strokeStyle = "rgba(150,110,60,0.45)";
            g.lineWidth = 1.5;
            g.beginPath();
            const yy = py + 10 + h() * 12;
            g.moveTo(px + 2, yy);
            g.quadraticCurveTo(px + 16, yy - 6, px + 30, yy);
            g.stroke();
        }
    }
    function cobT(g, px, py, h) {
        g.fillStyle = "#7a7682";
        g.fillRect(px, py, TS, TS);
        for (let r = 0; r < 4; r++)
            for (let c = 0; c < 4; c++) {
                const ox = (r % 2) * 4, v = h();
                g.fillStyle = v < 0.33 ? "#9a96a3" : v < 0.66 ? "#a8a4b0" : "#8f8b98";
                g.fillRect(px + c * 8 + ox - (ox && c === 3 ? 0 : 0) + 1, py + r * 8 + 1, ox && c === 3 ? 3 : 6, 6);
                if (ox && c === 0)
                    g.fillRect(px, py + r * 8 + 1, 3, 6);
            }
    }
    function ashT(g, px, py, h) {
        g.fillStyle = "#3a3236";
        g.fillRect(px, py, TS, TS);
        for (let i = 0; i < 7; i++) {
            g.fillStyle = h() < 0.5 ? "#2c2629" : "#4a4044";
            g.fillRect(px + Math.floor(h() * 29), py + Math.floor(h() * 29), 2 + Math.floor(h() * 3), 2);
        }
        if (h() < 0.18) {
            g.fillStyle = "rgba(255,110,40,0.55)";
            g.fillRect(px + Math.floor(h() * 26), py + Math.floor(h() * 26), 4, 1);
        }
    }
    function baseOf(g, a, px, py, h) {
        if (a.base === FLOOR)
            floorT(g, px, py, h);
        else if (a.base === SNOW)
            snowT(g, px, py, h);
        else if (a.base === MUD)
            mudT(g, px, py, h);
        else if (a.base === SAND)
            sandT(g, px, py, h, false);
        else if (a.base === COBBLE)
            cobT(g, px, py, h);
        else if (a.base === ASH)
            ashT(g, px, py, h);
        else
            grass(g, px, py, h, a.base === DGRASS);
    }
    function drawTile(g, a, x, y) {
        const t = gt(a, x, y), px = x * TS, py = y * TS;
        const h = mkRng(((x * 73856093) ^ (y * 19349663) ^ (a.w * 83492791)) >>> 0);
        const nb = (dx, dy) => gt(a, x + dx, y + dy);
        switch (t) {
            case GRASS:
                grass(g, px, py, h, false);
                break;
            case DGRASS:
                grass(g, px, py, h, true);
                break;
            case FLOWER: {
                grass(g, px, py, h, a.base === DGRASS);
                const cols = ["#e8505b", "#f5d547", "#ffffff", "#b46cf0", "#ff9a3c"];
                for (let i = 0; i < 4; i++) {
                    const fx = px + 3 + Math.floor(h() * 24), fy = py + 3 + Math.floor(h() * 24);
                    g.fillStyle = "#2f6a2a";
                    g.fillRect(fx + 1, fy + 3, 1, 3);
                    g.fillStyle = cols[Math.floor(h() * cols.length)];
                    g.fillRect(fx, fy, 3, 3);
                    g.fillStyle = "#fff6a0";
                    g.fillRect(fx + 1, fy + 1, 1, 1);
                }
                break;
            }
            case PATH:
            case SAND: {
                g.fillStyle = t === PATH ? "#b7925b" : "#d6c07c";
                g.fillRect(px, py, TS, TS);
                for (let i = 0; i < 8; i++) {
                    g.fillStyle = h() < 0.5 ? (t === PATH ? "#a3804c" : "#c4ad6a") : (t === PATH ? "#c9a56d" : "#e2cf92");
                    g.fillRect(px + Math.floor(h() * 30), py + Math.floor(h() * 30), 2, 2);
                }
                if (t === PATH && h() < 0.5) {
                    g.fillStyle = "#8c7048";
                    g.fillRect(px + Math.floor(h() * 26) + 2, py + Math.floor(h() * 26) + 2, 3, 2);
                }
                const soft = (v) => v === GRASS || v === DGRASS || v === FLOWER || v === TREE || v === ROCK || v === SNOW || v === MUD || v === SPINE || v === DEADT || v === REED;
                g.fillStyle = a.base === SNOW ? "rgba(240,246,255,0.75)" : a.base === MUD ? "rgba(70,72,44,0.6)" : "rgba(60,110,40,0.45)";
                if (soft(nb(0, -1)))
                    for (let i = 0; i < 8; i++)
                        g.fillRect(px + i * 4, py, 4, 2 + Math.floor(h() * 3));
                if (soft(nb(0, 1)))
                    for (let i = 0; i < 8; i++) {
                        const k = 2 + Math.floor(h() * 3);
                        g.fillRect(px + i * 4, py + TS - k, 4, k);
                    }
                if (soft(nb(-1, 0)))
                    for (let i = 0; i < 8; i++)
                        g.fillRect(px, py + i * 4, 2 + Math.floor(h() * 3), 4);
                if (soft(nb(1, 0)))
                    for (let i = 0; i < 8; i++) {
                        const k = 2 + Math.floor(h() * 3);
                        g.fillRect(px + TS - k, py + i * 4, k, 4);
                    }
                break;
            }
            case WATER: {
                g.fillStyle = "#2d6db0";
                g.fillRect(px, py, TS, TS);
                g.fillStyle = "#3a7fc4";
                for (let i = 0; i < 3; i++)
                    g.fillRect(px + Math.floor(h() * 24), py + 4 + Math.floor(h() * 24), 8, 2);
                g.fillStyle = "#a9d8f2";
                const land = (v) => v !== WATER && v !== BRIDGE && v !== -1;
                if (land(nb(0, -1)))
                    g.fillRect(px, py, TS, 2);
                if (land(nb(0, 1)))
                    g.fillRect(px, py + TS - 2, TS, 2);
                if (land(nb(-1, 0)))
                    g.fillRect(px, py, 2, TS);
                if (land(nb(1, 0)))
                    g.fillRect(px + TS - 2, py, 2, TS);
                break;
            }
            case BRIDGE: {
                g.fillStyle = a.base === MUD ? "#33493a" : "#2d6db0";
                g.fillRect(px, py, TS, TS);
                g.fillStyle = "#8b5e34";
                g.fillRect(px, py + 2, TS, TS - 4);
                g.fillStyle = "#6e4826";
                for (let i = 0; i < TS; i += 6)
                    g.fillRect(px + i, py + 2, 1, TS - 4);
                g.fillStyle = "#4e3119";
                if (nb(0, -1) === WATER || nb(0, -1) === BOG)
                    g.fillRect(px, py + 2, TS, 3);
                if (nb(0, 1) === WATER || nb(0, 1) === BOG)
                    g.fillRect(px, py + TS - 5, TS, 3);
                break;
            }
            case TREE: {
                baseOf(g, a, px, py, h);
                if (a.base === SAND) {
                    g.fillStyle = "rgba(0,0,0,0.22)";
                    g.beginPath();
                    g.ellipse(px + 18, py + 28, 11, 3, 0, 0, Math.PI * 2);
                    g.fill();
                    g.strokeStyle = "#8a6238";
                    g.lineWidth = 4;
                    g.beginPath();
                    g.moveTo(px + 15, py + 30);
                    g.quadraticCurveTo(px + 13, py + 18, px + 18, py + 8);
                    g.stroke();
                    g.fillStyle = "#3f8a3a";
                    for (let i = 0; i < 5; i++) {
                        const an = -Math.PI + i * Math.PI / 4 - 0.2;
                        g.beginPath();
                        g.moveTo(px + 18, py + 8);
                        g.quadraticCurveTo(px + 18 + Math.cos(an) * 10, py + 4 + Math.sin(an) * 8, px + 18 + Math.cos(an) * 15, py + 10 + Math.sin(an) * 6 + 4);
                        g.lineTo(px + 18 + Math.cos(an) * 8, py + 9);
                        g.closePath();
                        g.fill();
                    }
                    g.fillStyle = "#6a4a2a";
                    g.fillRect(px + 16, py + 9, 4, 3);
                    break;
                }
                const ox = Math.floor(h() * 5) - 2, oy = Math.floor(h() * 3) - 1;
                const pine = a.base === DGRASS && h() < 0.45;
                g.fillStyle = "rgba(0,0,0,0.25)";
                g.beginPath();
                g.ellipse(px + 16, py + 28, 12, 4, 0, 0, Math.PI * 2);
                g.fill();
                g.fillStyle = "#6b4423";
                g.fillRect(px + 13 + ox, py + 19, 6, 11);
                if (pine) {
                    const layers = [["#1f4d22", 14, 18], ["#2a6230", 11, 11], ["#367a3a", 7, 5]];
                    for (const L of layers) {
                        g.fillStyle = L[0];
                        g.beginPath();
                        const w = L[1], ty = L[2];
                        g.moveTo(px + 16 + ox, py + ty - 4 + oy);
                        g.lineTo(px + 16 + ox - w, py + ty + 10 + oy);
                        g.lineTo(px + 16 + ox + w, py + ty + 10 + oy);
                        g.closePath();
                        g.fill();
                    }
                }
                else {
                    const dark = a.base === DGRASS;
                    g.fillStyle = dark ? "#24561f" : "#2f6b2a";
                    g.beginPath();
                    g.arc(px + 16 + ox, py + 13 + oy, 13, 0, Math.PI * 2);
                    g.fill();
                    g.fillStyle = dark ? "#2f6d29" : "#3d8a35";
                    g.beginPath();
                    g.arc(px + 12 + ox, py + 10 + oy, 8, 0, Math.PI * 2);
                    g.fill();
                    g.beginPath();
                    g.arc(px + 21 + ox, py + 12 + oy, 7, 0, Math.PI * 2);
                    g.fill();
                    g.fillStyle = dark ? "#418a37" : "#58a84a";
                    g.beginPath();
                    g.arc(px + 10 + ox, py + 7 + oy, 3, 0, Math.PI * 2);
                    g.fill();
                    if (!dark && h() < 0.2) {
                        g.fillStyle = "#d8403a";
                        g.fillRect(px + 18 + ox, py + 9, 3, 3);
                        g.fillRect(px + 9 + ox, py + 15, 3, 3);
                    }
                }
                break;
            }
            case ROOF:
            case ROOF2: {
                const bl = t === ROOF2, RF = bl ? ROOF2 : ROOF;
                g.fillStyle = bl ? "#3a5fa8" : "#a8432f";
                g.fillRect(px, py, TS, TS);
                g.fillStyle = bl ? "#2e4c88" : "#8a3424";
                for (let r = 0; r < 4; r++) {
                    g.fillRect(px, py + r * 8 + 7, TS, 1);
                    for (let i = (r % 2) * 4; i < TS; i += 8)
                        g.fillRect(px + i, py + r * 8, 1, 8);
                }
                g.fillStyle = bl ? "#4f74c0" : "#c2563f";
                for (let r = 0; r < 4; r++)
                    g.fillRect(px, py + r * 8, TS, 1);
                if (nb(0, -1) !== RF) {
                    g.fillStyle = bl ? "#22386a" : "#6a261b";
                    g.fillRect(px, py, TS, 4);
                }
                if (nb(-1, 0) !== RF) {
                    g.fillStyle = bl ? "#2a4278" : "#7a2d20";
                    g.fillRect(px, py, 3, TS);
                }
                if (nb(1, 0) !== RF) {
                    g.fillStyle = bl ? "#2a4278" : "#7a2d20";
                    g.fillRect(px + TS - 3, py, 3, TS);
                }
                if (nb(0, 1) !== RF) {
                    g.fillStyle = bl ? "#1c2e5a" : "#5a2016";
                    g.fillRect(px, py + TS - 4, TS, 4);
                }
                break;
            }
            case WALL:
            case DOOR: {
                g.fillStyle = "#dcc79d";
                g.fillRect(px, py, TS, TS);
                g.fillStyle = "#6b4a2b";
                if (nb(-1, 0) !== WALL && nb(-1, 0) !== DOOR)
                    g.fillRect(px, py, 4, TS);
                if (nb(1, 0) !== WALL && nb(1, 0) !== DOOR)
                    g.fillRect(px + TS - 4, py, 4, TS);
                if (nb(0, -1) === ROOF || nb(0, -1) === ROOF2) {
                    g.fillStyle = "rgba(0,0,0,0.25)";
                    g.fillRect(px, py, TS, 4);
                }
                g.fillStyle = "#6b4a2b";
                if (nb(0, 1) !== WALL && nb(0, 1) !== DOOR)
                    g.fillRect(px, py + TS - 3, TS, 3);
                if (t === DOOR) {
                    g.fillStyle = "#4a2e17";
                    g.fillRect(px + 7, py + 4, 18, 28);
                    g.fillStyle = "#6a4423";
                    g.fillRect(px + 9, py + 6, 14, 26);
                    g.fillStyle = "#553519";
                    g.fillRect(px + 15, py + 6, 2, 26);
                    g.fillStyle = "#f2c94c";
                    g.fillRect(px + 19, py + 19, 2, 2);
                }
                else if (nb(0, 1) !== WALL && nb(0, 1) !== DOOR && h() < 0.55) {
                    g.fillStyle = "#6b4a2b";
                    g.fillRect(px + 8, py + 6, 16, 14);
                    g.fillStyle = "#7fb2d8";
                    g.fillRect(px + 10, py + 8, 12, 10);
                    g.fillStyle = "#c8e4f5";
                    g.fillRect(px + 11, py + 9, 4, 3);
                    g.fillStyle = "#6b4a2b";
                    g.fillRect(px + 15, py + 8, 2, 10);
                    g.fillRect(px + 10, py + 12, 12, 2);
                    g.fillStyle = "#e26f6f";
                    g.fillRect(px + 9, py + 20, 14, 3);
                }
                break;
            }
            case FLOOR: {
                if (a.id !== "necro") {
                    floorT(g, px, py, h);
                    break;
                }
                g.fillStyle = (x + y) & 1 ? "#5a5462" : "#544e5c";
                g.fillRect(px, py, TS, TS);
                g.fillStyle = "#3e3946";
                g.fillRect(px, py, TS, 1);
                g.fillRect(px, py, 1, TS);
                g.fillRect(px, py + 15, TS, 1);
                g.fillRect(px + ((y & 1) ? 8 : 22), py, 1, 15);
                g.fillRect(px + ((y & 1) ? 22 : 8), py + 16, 1, 16);
                g.fillStyle = "#6a6474";
                g.fillRect(px + 1, py + 1, TS - 2, 1);
                g.fillRect(px + 1, py + 16, TS - 2, 1);
                if (h() < 0.18) {
                    g.strokeStyle = "#35303c";
                    g.lineWidth = 1;
                    g.beginPath();
                    g.moveTo(px + 4 + h() * 10, py + 4);
                    g.lineTo(px + 10 + h() * 12, py + 12 + h() * 10);
                    g.stroke();
                }
                if (h() < 0.07) {
                    g.fillStyle = "#d8d0c0";
                    g.fillRect(px + 9, py + 20, 12, 2);
                    g.fillRect(px + 8, py + 19, 3, 4);
                    g.fillRect(px + 19, py + 19, 3, 4);
                }
                if (h() < 0.05) {
                    g.fillStyle = "#4b6a3a";
                    g.fillRect(px + 3, py + 26, 6, 3);
                    g.fillRect(px + 22, py + 4, 5, 2);
                }
                break;
            }
            case CWALL:
            case CRYSTAL: {
                g.fillStyle = "#211d27";
                g.fillRect(px, py, TS, TS);
                for (let i = 0; i < 4; i++) {
                    g.fillStyle = "#2b2631";
                    g.fillRect(px + Math.floor(h() * 26), py + Math.floor(h() * 26), 5, 4);
                }
                if (nb(0, 1) === FLOOR || nb(0, 1) === ROCK || nb(0, 1) === PORTAL) {
                    g.fillStyle = "#3b3445";
                    g.fillRect(px, py + 16, TS, 16);
                    g.fillStyle = "#2d2836";
                    for (let r = 0; r < 2; r++) {
                        g.fillRect(px, py + 16 + r * 8, TS, 1);
                        for (let i = (r % 2) * 6; i < TS; i += 12)
                            g.fillRect(px + i, py + 16 + r * 8, 1, 8);
                    }
                    g.fillStyle = "#4a4256";
                    g.fillRect(px, py + 16, TS, 2);
                }
                if (t === CRYSTAL) {
                    g.fillStyle = "#2aa6d6";
                    g.beginPath();
                    g.moveTo(px + 10, py + 30);
                    g.lineTo(px + 14, py + 12);
                    g.lineTo(px + 18, py + 30);
                    g.fill();
                    g.fillStyle = "#5fe3ff";
                    g.beginPath();
                    g.moveTo(px + 16, py + 30);
                    g.lineTo(px + 21, py + 16);
                    g.lineTo(px + 25, py + 30);
                    g.fill();
                    g.fillStyle = "#c9f6ff";
                    g.fillRect(px + 13, py + 16, 1, 6);
                }
                break;
            }
            case FENCE: {
                grass(g, px, py, h, false);
                g.fillStyle = "#8a6238";
                const f = (v) => v === FENCE;
                if (f(nb(-1, 0)) || f(nb(1, 0))) {
                    const x0 = f(nb(-1, 0)) ? 0 : 13, x1 = f(nb(1, 0)) ? TS : 19;
                    g.fillRect(px + x0, py + 12, x1 - x0, 3);
                    g.fillRect(px + x0, py + 20, x1 - x0, 3);
                }
                if (f(nb(0, -1)) || f(nb(0, 1))) {
                    const y0 = f(nb(0, -1)) ? 0 : 10, y1 = f(nb(0, 1)) ? TS : 26;
                    g.fillRect(px + 14, py + y0, 4, y1 - y0);
                }
                g.fillStyle = "#6e4a26";
                g.fillRect(px + 13, py + 8, 6, 20);
                g.fillStyle = "#a57a4a";
                g.fillRect(px + 13, py + 8, 6, 2);
                break;
            }
            case ROCK: {
                baseOf(g, a, px, py, h);
                g.fillStyle = "rgba(0,0,0,0.3)";
                g.beginPath();
                g.ellipse(px + 16, py + 26, 12, 4, 0, 0, Math.PI * 2);
                g.fill();
                const cave = a.base === FLOOR;
                g.fillStyle = cave ? "#6a6276" : "#7f8186";
                g.beginPath();
                g.ellipse(px + 16, py + 18, 12, 10, 0, 0, Math.PI * 2);
                g.fill();
                g.fillStyle = cave ? "#8a8296" : "#a5a7ad";
                g.beginPath();
                g.ellipse(px + 12, py + 14, 6, 4, 0, 0, Math.PI * 2);
                g.fill();
                g.fillStyle = cave ? "#4c4556" : "#5d6066";
                g.fillRect(px + 16, py + 20, 8, 2);
                break;
            }
            case PORTAL: {
                if (a.base === FLOOR) {
                    floorT(g, px, py, h);
                    for (let i = 0; i < 4; i++) {
                        g.fillStyle = i % 2 ? "#7a7088" : "#958aa5";
                        g.fillRect(px + 4, py + 4 + i * 7, 24, 6);
                    }
                    g.fillStyle = "#e8d9a0";
                    g.fillRect(px + 4, py + 4, 24, 2);
                }
                else {
                    grass(g, px, py, h, true);
                    g.fillStyle = "#3a3440";
                    g.beginPath();
                    g.ellipse(px + 16, py + 20, 15, 14, 0, Math.PI, 0);
                    g.lineTo(px + 31, py + 32);
                    g.lineTo(px + 1, py + 32);
                    g.fill();
                    g.fillStyle = "#0d0a12";
                    g.beginPath();
                    g.ellipse(px + 16, py + 22, 10, 10, 0, Math.PI, 0);
                    g.lineTo(px + 26, py + 32);
                    g.lineTo(px + 6, py + 32);
                    g.fill();
                }
                break;
            }
            case WELL: {
                grass(g, px, py, h, false);
                g.fillStyle = "rgba(0,0,0,0.25)";
                g.beginPath();
                g.ellipse(px + 16, py + 27, 13, 4, 0, 0, Math.PI * 2);
                g.fill();
                g.fillStyle = "#8d8d95";
                g.beginPath();
                g.ellipse(px + 16, py + 21, 12, 8, 0, 0, Math.PI * 2);
                g.fill();
                g.fillStyle = "#2d5f9a";
                g.beginPath();
                g.ellipse(px + 16, py + 20, 7, 4, 0, 0, Math.PI * 2);
                g.fill();
                g.fillStyle = "#6b4a2b";
                g.fillRect(px + 4, py + 4, 3, 18);
                g.fillRect(px + 25, py + 4, 3, 18);
                g.fillRect(px + 4, py + 6, 24, 2);
                g.fillStyle = "#8a3a2a";
                g.beginPath();
                g.moveTo(px + 1, py + 7);
                g.lineTo(px + 16, py);
                g.lineTo(px + 31, py + 7);
                g.fill();
                break;
            }
            case MUD:
                mudT(g, px, py, h);
                break;
            case SNOW:
                snowT(g, px, py, h);
                break;
            case DUNE:
                sandT(g, px, py, h, true);
                break;
            case COBBLE:
                cobT(g, px, py, h);
                break;
            case ASH:
                ashT(g, px, py, h);
                break;
            case LAVA: {
                g.fillStyle = "#c4380e";
                g.fillRect(px, py, TS, TS);
                for (let i = 0; i < 5; i++) {
                    g.fillStyle = h() < 0.5 ? "#ff8a1e" : "#ffcf4a";
                    g.beginPath();
                    g.ellipse(px + 4 + h() * 24, py + 4 + h() * 24, 2 + h() * 4, 1.5 + h() * 2, 0, 0, Math.PI * 2);
                    g.fill();
                }
                g.fillStyle = "#2a2226";
                const land = (v) => v !== LAVA && v !== -1;
                if (land(nb(0, -1)))
                    g.fillRect(px, py, TS, 2);
                if (land(nb(0, 1)))
                    g.fillRect(px, py + TS - 2, TS, 2);
                if (land(nb(-1, 0)))
                    g.fillRect(px, py, 2, TS);
                if (land(nb(1, 0)))
                    g.fillRect(px + TS - 2, py, 2, TS);
                break;
            }
            case BOG: {
                g.fillStyle = "#33493a";
                g.fillRect(px, py, TS, TS);
                for (let i = 0; i < 4; i++) {
                    g.fillStyle = h() < 0.5 ? "#4b6a3e" : "#2a3e30";
                    g.beginPath();
                    g.ellipse(px + 4 + h() * 24, py + 4 + h() * 24, 3 + h() * 3, 2, 0, 0, Math.PI * 2);
                    g.fill();
                }
                g.fillStyle = "#6b6a44";
                const land = (v) => v !== BOG && v !== BRIDGE && v !== -1 && v !== WATER;
                if (land(nb(0, -1)))
                    g.fillRect(px, py, TS, 2);
                if (land(nb(0, 1)))
                    g.fillRect(px, py + TS - 2, TS, 2);
                if (land(nb(-1, 0)))
                    g.fillRect(px, py, 2, TS);
                if (land(nb(1, 0)))
                    g.fillRect(px + TS - 2, py, 2, TS);
                break;
            }
            case REED: {
                mudT(g, px, py, h);
                for (let i = 0; i < 6; i++) {
                    const rx = px + 3 + Math.floor(h() * 26), ry = py + 8 + Math.floor(h() * 12), hh = 10 + Math.floor(h() * 8);
                    g.fillStyle = "#7d8a3e";
                    g.fillRect(rx, ry, 1, hh);
                    if (h() < 0.5) {
                        g.fillStyle = "#5a3a1e";
                        g.fillRect(rx - 1, ry - 1, 3, 5);
                    }
                }
                break;
            }
            case DEADT: {
                baseOf(g, a, px, py, h);
                g.fillStyle = "rgba(0,0,0,0.28)";
                g.beginPath();
                g.ellipse(px + 16, py + 28, 10, 3, 0, 0, Math.PI * 2);
                g.fill();
                g.strokeStyle = "#3b332a";
                g.lineWidth = 4;
                g.beginPath();
                g.moveTo(px + 16, py + 29);
                g.lineTo(px + 15, py + 10);
                g.stroke();
                g.lineWidth = 2;
                g.beginPath();
                g.moveTo(px + 15, py + 16);
                g.lineTo(px + 6, py + 7);
                g.moveTo(px + 15, py + 13);
                g.lineTo(px + 25, py + 5);
                g.moveTo(px + 15, py + 10);
                g.lineTo(px + 13, py + 2);
                g.moveTo(px + 9, py + 10);
                g.lineTo(px + 5, py + 11);
                g.stroke();
                if (h() < 0.4) {
                    g.fillStyle = "#56683a";
                    g.fillRect(px + 19, py + 8, 2, 7);
                    g.fillRect(px + 7, py + 8, 2, 5);
                }
                break;
            }
            case SWALL: {
                g.fillStyle = "#4f4c59";
                g.fillRect(px, py, TS, TS);
                g.fillStyle = "#5e5b69";
                for (let r = 0; r < 4; r++)
                    for (let c = 0; c < 3; c++)
                        g.fillRect(px + c * 11 + (r % 2) * 5, py + r * 8 + 1, 9, 6);
                if (nb(0, 1) !== SWALL) {
                    g.fillStyle = "#6e6b7a";
                    g.fillRect(px, py + 20, TS, 12);
                    g.fillStyle = "#3d3a46";
                    g.fillRect(px, py + 20, TS, 2);
                    for (let i = 0; i < TS; i += 8)
                        g.fillRect(px + i, py + 22, 1, 10);
                }
                if (nb(0, -1) !== SWALL) {
                    g.fillStyle = "#3a3744";
                    for (let i = 0; i < TS; i += 10)
                        g.fillRect(px + i, py, 5, 4);
                }
                break;
            }
            case FOUNT: {
                cobT(g, px, py, h);
                const f = (v) => v === FOUNT;
                g.fillStyle = "#c2bdcc";
                g.fillRect(px, py, TS, TS);
                g.fillStyle = "#4f9ad8";
                const x0 = f(nb(-1, 0)) ? 0 : 5, x1 = f(nb(1, 0)) ? TS : TS - 5, y0 = f(nb(0, -1)) ? 0 : 5, y1 = f(nb(0, 1)) ? TS : TS - 5;
                g.fillRect(px + x0, py + y0, x1 - x0, y1 - y0);
                g.fillStyle = "#7fc0ee";
                g.fillRect(px + x0 + 3, py + y0 + 4, 8, 2);
                if (!f(nb(1, 0)) && !f(nb(0, 1))) {
                    g.fillStyle = "#a9a4b4";
                    g.fillRect(px - 6, py - 6, 12, 12);
                }
                break;
            }
            case ICE: {
                g.fillStyle = "#b5def2";
                g.fillRect(px, py, TS, TS);
                g.strokeStyle = "rgba(255,255,255,0.7)";
                g.lineWidth = 1;
                g.beginPath();
                const sx = px + h() * 20, sy = py + h() * 20;
                g.moveTo(sx, sy);
                g.lineTo(sx + 8, sy + 5);
                g.lineTo(sx + 12, sy + 2);
                g.stroke();
                g.fillStyle = "rgba(255,255,255,0.5)";
                g.fillRect(px + 6 + h() * 16, py + 6 + h() * 16, 5, 2);
                break;
            }
            case SPINE: {
                baseOf(g, a, px, py, h);
                const ox = Math.floor(h() * 5) - 2;
                g.fillStyle = "rgba(0,0,0,0.2)";
                g.beginPath();
                g.ellipse(px + 16, py + 28, 11, 4, 0, 0, Math.PI * 2);
                g.fill();
                g.fillStyle = "#5a3a22";
                g.fillRect(px + 14 + ox, py + 22, 4, 8);
                const L = [["#1e4a3a", 14, 17], ["#26594a", 11, 10], ["#2f6a58", 7, 4]];
                for (const l of L) {
                    g.fillStyle = l[0];
                    g.beginPath();
                    g.moveTo(px + 16 + ox, py + l[2] - 4);
                    g.lineTo(px + 16 + ox - l[1], py + l[2] + 10);
                    g.lineTo(px + 16 + ox + l[1], py + l[2] + 10);
                    g.closePath();
                    g.fill();
                    g.fillStyle = "#f2f7fc";
                    g.beginPath();
                    g.moveTo(px + 16 + ox, py + l[2] - 4);
                    g.lineTo(px + 16 + ox - l[1] * 0.55, py + l[2] + 3);
                    g.lineTo(px + 16 + ox + l[1] * 0.55, py + l[2] + 3);
                    g.closePath();
                    g.fill();
                }
                break;
            }
            case CLIFF: {
                baseOf(g, a, px, py, h);
                const snow = a.base === SNOW, sand = a.base === SAND;
                const c1 = snow ? "#6f7480" : sand ? "#a86f40" : "#6e6e74", c2 = snow ? "#8d929e" : sand ? "#c58a54" : "#8a8a90", c3 = snow ? "#565a66" : sand ? "#875632" : "#55555c";
                g.fillStyle = c3;
                g.fillRect(px + 1, py + 8, 30, 24);
                g.fillStyle = c1;
                g.beginPath();
                g.moveTo(px, py + 30);
                g.lineTo(px + 3, py + 6 + h() * 4);
                g.lineTo(px + 12, py + 2);
                g.lineTo(px + 22, py + 4 + h() * 3);
                g.lineTo(px + 31, py + 10);
                g.lineTo(px + 32, py + 30);
                g.closePath();
                g.fill();
                g.fillStyle = c2;
                g.beginPath();
                g.moveTo(px + 5, py + 12);
                g.lineTo(px + 12, py + 5);
                g.lineTo(px + 18, py + 8);
                g.lineTo(px + 10, py + 16);
                g.closePath();
                g.fill();
                if (snow) {
                    g.fillStyle = "#f4f8fc";
                    g.beginPath();
                    g.moveTo(px + 3, py + 8);
                    g.lineTo(px + 12, py + 2);
                    g.lineTo(px + 22, py + 4);
                    g.lineTo(px + 29, py + 9);
                    g.lineTo(px + 20, py + 8);
                    g.lineTo(px + 12, py + 7);
                    g.closePath();
                    g.fill();
                }
                g.fillStyle = "rgba(0,0,0,0.18)";
                g.fillRect(px, py + 26, TS, 6);
                break;
            }
            case CACTUS: {
                sandT(g, px, py, h, false);
                g.fillStyle = "rgba(0,0,0,0.2)";
                g.beginPath();
                g.ellipse(px + 16, py + 28, 8, 3, 0, 0, Math.PI * 2);
                g.fill();
                g.fillStyle = "#3f7a34";
                g.fillRect(px + 13, py + 6, 7, 22);
                g.fillRect(px + 6, py + 12, 4, 9);
                g.fillRect(px + 6, py + 19, 8, 3);
                g.fillRect(px + 23, py + 9, 4, 8);
                g.fillRect(px + 19, py + 15, 8, 3);
                g.fillStyle = "#58a048";
                g.fillRect(px + 14, py + 6, 2, 22);
                g.fillRect(px + 7, py + 12, 1, 8);
                if (h() < 0.5) {
                    g.fillStyle = "#ff7aa8";
                    g.fillRect(px + 15, py + 4, 3, 3);
                }
                break;
            }
            case RUINW: {
                g.fillStyle = "#9a7448";
                g.fillRect(px, py, TS, TS);
                g.fillStyle = "#b48c5c";
                for (let r = 0; r < 4; r++)
                    for (let c = 0; c < 3; c++)
                        g.fillRect(px + c * 11 + (r % 2) * 5, py + r * 8 + 1, 9, 6);
                if (nb(0, 1) !== RUINW) {
                    g.fillStyle = "#c9a26e";
                    g.fillRect(px, py + 20, TS, 12);
                    g.fillStyle = "#8a6438";
                    g.fillRect(px, py + 20, TS, 2);
                    for (let i = 4; i < TS; i += 9)
                        g.fillRect(px + i, py + 22, 1, 10);
                }
                if (h() < 0.3) {
                    g.strokeStyle = "#6e4e2a";
                    g.lineWidth = 1;
                    g.beginPath();
                    g.moveTo(px + 6, py + 4);
                    g.lineTo(px + 11, py + 12);
                    g.lineTo(px + 8, py + 18);
                    g.stroke();
                }
                break;
            }
            case RFLOOR: {
                g.fillStyle = "#c9ae84";
                g.fillRect(px, py, TS, TS);
                g.fillStyle = "#b39a70";
                g.fillRect(px, py + 15, TS, 1);
                g.fillRect(px + 15, py, 1, TS);
                g.fillRect(px, py, TS, 1);
                g.fillRect(px, py, 1, TS);
                if (h() < 0.12) {
                    g.strokeStyle = "#8c7048";
                    g.lineWidth = 1;
                    g.beginPath();
                    g.moveTo(px + 4, py + 6);
                    g.lineTo(px + 12, py + 11);
                    g.stroke();
                }
                if (h() < 0.06) {
                    g.fillStyle = "#a8803e";
                    g.fillRect(px + 20, py + 20, 6, 6);
                    g.fillStyle = "#c9ae84";
                    g.fillRect(px + 22, py + 22, 2, 2);
                }
                break;
            }
            case PILLAR: {
                if (a.base === SAND && nb(0, 0) === PILLAR && !(x > 29 && x < 47 && y > 13 && y < 33))
                    sandT(g, px, py, h, false);
                else {
                    g.fillStyle = "#c9ae84";
                    g.fillRect(px, py, TS, TS);
                }
                g.fillStyle = "rgba(0,0,0,0.25)";
                g.beginPath();
                g.ellipse(px + 16, py + 28, 11, 4, 0, 0, Math.PI * 2);
                g.fill();
                g.fillStyle = "#d8c69a";
                g.fillRect(px + 9, py + 2, 14, 26);
                g.fillStyle = "#efe2bc";
                g.fillRect(px + 11, py + 2, 3, 26);
                g.fillStyle = "#b8a476";
                g.fillRect(px + 7, py, 18, 4);
                g.fillRect(px + 7, py + 25, 18, 4);
                g.fillRect(px + 19, py + 4, 2, 21);
                break;
            }
            default: grass(g, px, py, h, false);
        }
    }
    function renderArea(a) {
        const c = document.createElement("canvas");
        c.width = a.w * TS;
        c.height = a.h * TS;
        const g = c.getContext("2d");
        for (let y = 0; y < a.h; y++)
            for (let x = 0; x < a.w; x++)
                drawTile(g, a, x, y);
        a.img = c;
    }
    function renderMini(a) {
        const m = document.createElement("canvas");
        m.width = a.w * 3;
        m.height = a.h * 3;
        const mg = m.getContext("2d");
        for (let y = 0; y < a.h; y++)
            for (let x = 0; x < a.w; x++) {
                const t = gt(a, x, y);
                mg.fillStyle = MINI[t] || "#000";
                mg.fillRect(x * 3, y * 3, 3, 3);
                if (TALL[t] && ((x + y) & 1)) {
                    mg.fillStyle = "rgba(0,0,0,0.22)";
                    mg.fillRect(x * 3 + 1, y * 3 + 1, 1, 1);
                }
                else if (!BLOCK[t] && t !== PATH && t !== COBBLE && ((x * 7 + y * 3) % 5 === 0)) {
                    mg.fillStyle = "rgba(255,255,255,0.08)";
                    mg.fillRect(x * 3, y * 3, 1, 1);
                }
            }
        a.mini = m;
    }
    // ---------- DATA ----------
    const ITEMS = {
        club: { n: "Drewniana pałka", t: "w", cls: "war", atk: 2, price: 6, c: "#9a6b3c", ic: "club" },
        sword: { n: "Żelazny miecz", t: "w", cls: "war", atk: 6, price: 60, c: "#c9d1d9", ic: "sword" },
        axe: { n: "Stalowy topór", t: "w", cls: "war", atk: 11, price: 170, c: "#aab4be", ic: "axe" },
        blade: { n: "Ostrze Świtu", t: "w", cls: "war", atk: 19, price: 450, c: "#ffd25a", ic: "sword" },
        fsword: { n: "Miecz Szronu", t: "w", cls: "war", atk: 28, price: 900, c: "#9fe6ff", ic: "sword" },
        ssword: { n: "Topór Piasków", t: "w", cls: "war", atk: 40, price: 1800, c: "#ffb347", ic: "axe" },
        sbow: { n: "Krótki łuk", t: "w", cls: "arc", atk: 2, price: 6, c: "#9a6b3c", ic: "bow" },
        hbow: { n: "Łuk myśliwski", t: "w", cls: "arc", atk: 6, price: 60, c: "#b07a44", ic: "bow" },
        lbow: { n: "Długi łuk cisowy", t: "w", cls: "arc", atk: 11, price: 170, c: "#7a4a24", ic: "bow" },
        dbow: { n: "Łuk Świtu", t: "w", cls: "arc", atk: 19, price: 450, c: "#ffd25a", ic: "bow" },
        fbow: { n: "Łuk Szronu", t: "w", cls: "arc", atk: 28, price: 900, c: "#9fe6ff", ic: "bow" },
        sunbow: { n: "Łuk Słońca", t: "w", cls: "arc", atk: 40, price: 1800, c: "#ffb347", ic: "bow" },
        wand: { n: "Kostur ucznia", t: "w", cls: "mag", atk: 3, price: 6, c: "#c58cff", ic: "staff" },
        ostaff: { n: "Dębowy kostur", t: "w", cls: "mag", atk: 7, price: 60, c: "#7fd0ff", ic: "staff" },
        rstaff: { n: "Kostur runiczny", t: "w", cls: "mag", atk: 12, price: 170, c: "#6fb0ff", ic: "staff" },
        dstaff: { n: "Kostur Świtu", t: "w", cls: "mag", atk: 20, price: 450, c: "#ffd25a", ic: "staff" },
        fstaff: { n: "Kostur Szronu", t: "w", cls: "mag", atk: 30, price: 900, c: "#9fe6ff", ic: "staff" },
        sstaff: { n: "Berło Piasków", t: "w", cls: "mag", atk: 42, price: 1800, c: "#ffb347", ic: "staff" },
        shirt: { n: "Lniana koszula", t: "a", def: 1, price: 6, c: "#c9b89a", ic: "shirt" },
        leather: { n: "Skórzany kaftan", t: "a", cls: "war arc", def: 4, price: 50, c: "#8a5a2b", ic: "armor" },
        chain: { n: "Kolczuga", t: "a", cls: "war", def: 8, price: 150, c: "#9aa4ad", ic: "armor" },
        plate: { n: "Zbroja płytowa", t: "a", cls: "war", def: 13, price: 380, c: "#d8dee6", ic: "armor" },
        wplate: { n: "Zbroja Srebrnogrodu", t: "a", cls: "war", def: 20, price: 800, c: "#b8c8e8", ic: "armor" },
        dplate: { n: "Zbroja smoczej łuski", t: "a", cls: "war", def: 28, price: 1600, c: "#7fd8c8", ic: "armor" },
        rjack: { n: "Kurta tropiciela", t: "a", cls: "arc", def: 7, price: 150, c: "#4f7a3a", ic: "armor" },
        rcloak: { n: "Płaszcz zwiadowcy", t: "a", cls: "arc", def: 11, price: 380, c: "#2f6a4a", ic: "armor" },
        rmail: { n: "Kolczuga łowcy", t: "a", cls: "arc", def: 17, price: 800, c: "#7a9a6a", ic: "armor" },
        rdrag: { n: "Pancerz ze smoczej skóry", t: "a", cls: "arc", def: 24, price: 1600, c: "#5ab8a0", ic: "armor" },
        robe: { n: "Szata nowicjusza", t: "a", cls: "mag", def: 3, mp: 15, price: 50, c: "#5a4aa8", ic: "robe" },
        mrobe: { n: "Szata maga", t: "a", cls: "mag", def: 6, mp: 30, price: 150, c: "#3a3a9a", ic: "robe" },
        arobe: { n: "Szata arkanów", t: "a", cls: "mag", def: 10, mp: 50, price: 380, c: "#7a3a9a", ic: "robe" },
        srobe: { n: "Szata gwiazd", t: "a", cls: "mag", def: 15, mp: 75, price: 800, c: "#2a3a7a", ic: "robe" },
        drobe: { n: "Szata Pradawnych", t: "a", cls: "mag", def: 21, mp: 100, price: 1600, c: "#c8a03a", ic: "robe" },
        pot: { n: "Mała mikstura", t: "p", heal: 45, price: 12, c: "#e0413a", ic: "pot" },
        bigpot: { n: "Duża mikstura", t: "p", heal: 120, price: 35, c: "#b03ad0", ic: "pot" },
        elix: { n: "Eliksir życia", t: "p", heal: 320, price: 90, c: "#ff4f7a", ic: "pot" },
        mpot: { n: "Mikstura many", t: "m", mana: 60, price: 15, c: "#3a7bff", ic: "pot" },
        gpot: { n: "Wielka mikstura", t: "p", heal: 700, price: 160, c: "#ff7a3a", ic: "pot" },
        selix: { n: "Eliksir Świtu", t: "p", heal: 1500, price: 340, c: "#ffd84a", ic: "pot" },
        shell: { n: "Pancerz kraba", t: "j", price: 70, c: "#e0603a", ic: "scarab" },
        pearl: { n: "Perła syreny", t: "q", price: 80, c: "#e8f4ff", ic: "gem" },
        ember: { n: "Żarzący się rdzeń", t: "q", price: 110, c: "#ff7a2a", ic: "orb" },
        obsid: { n: "Odłamek obsydianu", t: "j", price: 130, c: "#6a4a8a", ic: "gem" },
        voids: { n: "Esencja pustki", t: "j", price: 200, c: "#9a5aff", ic: "orb" },
        crown: { n: "Korona Morgatha", t: "j", price: 3000, c: "#c58cff", ic: "relic" },
        spot: { n: "Mikstura Gwiazd", t: "p", heal: 2600, price: 520, c: "#9fd8ff", ic: "pot" },
        dpot: { n: "Smocza mikstura", t: "p", heal: 4200, price: 860, c: "#ff4a3a", ic: "pot" },
        gmpot: { n: "Wielka mikstura many", t: "m", mana: 180, price: 70, c: "#2a5bff", ic: "pot" },
        bandana: { n: "Chusta zbója", t: "j", price: 8, c: "#a0302a", ic: "silk" },
        bearpaw: { n: "Niedźwiedzia łapa", t: "q", price: 14, c: "#7a4a2a", ic: "pelt" },
        fang: { n: "Kieł Herszta", t: "j", price: 180, c: "#e8e0c8", ic: "tusk" },
        kcrys: { n: "Kryształ kobolda", t: "j", price: 22, c: "#5fe3ff", ic: "gem" },
        dwarfr: { n: "Krasnoludzka runa", t: "q", price: 30, c: "#c9a45c", ic: "relic" },
        mtusk: { n: "Kieł mamuta", t: "q", price: 48, c: "#f0f0e0", ic: "tusk" },
        frostc: { n: "Rdzeń zamieci", t: "j", price: 55, c: "#bfefff", ic: "orb" },
        hyhide: { n: "Skóra hieny", t: "j", price: 50, c: "#b08a50", ic: "pelt" },
        bscale: { n: "Łuska bazyliszka", t: "q", price: 70, c: "#5aa040", ic: "scarab" },
        bark: { n: "Kora pradrzewa", t: "q", price: 85, c: "#6a8a3a", ic: "bone" },
        elfar: { n: "Elfi grot", t: "j", price: 80, c: "#9fe08a", ic: "ear" },
        coral: { n: "Czarny koral", t: "q", price: 150, c: "#3a2a4a", ic: "gem" },
        nscale: { n: "Łuska nagi", t: "j", price: 140, c: "#3ac8a8", ic: "scarab" },
        starsh: { n: "Gwiezdny odłamek", t: "q", price: 260, c: "#e8f4ff", ic: "gem" },
        prism: { n: "Pryzmat", t: "j", price: 240, c: "#9fe8ff", ic: "orb" },
        soulg: { n: "Klejnot duszy", t: "q", price: 300, c: "#8aff9a", ic: "orb" },
        bdust: { n: "Proch kości", t: "j", price: 260, c: "#d8d2c0", ic: "bone" },
        dscale: { n: "Łuska ognistego wyrma", t: "q", price: 360, c: "#ff5a2a", ic: "scarab" },
        dheart: { n: "Smocze serce", t: "j", price: 1200, c: "#ff2a2a", ic: "relic" },
        vcrown: { n: "Korona Valgara", t: "j", price: 4200, c: "#9aff9a", ic: "relic" },
        vscale: { n: "Łuska Valdraka", t: "j", price: 6000, c: "#ffb347", ic: "relic" },
        tail: { n: "Szczurzy ogon", t: "j", price: 3, c: "#d89a9a", ic: "tail" },
        pelt: { n: "Wilcza skóra", t: "j", price: 9, c: "#8d8f94", ic: "pelt" },
        tusk: { n: "Kieł dzika", t: "q", price: 7, c: "#f1ead6", ic: "tusk" },
        ear: { n: "Ucho goblina", t: "j", price: 11, c: "#6aa84f", ic: "ear" },
        silk: { n: "Pajęczy jedwab", t: "j", price: 14, c: "#e8e8f0", ic: "silk" },
        bone: { n: "Stara kość", t: "j", price: 10, c: "#e6dfc8", ic: "bone" },
        gem: { n: "Kryształ Mgieł", t: "j", price: 90, c: "#7fe9ff", ic: "gem" },
        slime: { n: "Błotny śluz", t: "j", price: 18, c: "#8a9a3a", ic: "drop" },
        essence: { n: "Esencja ognika", t: "q", price: 20, c: "#b8ff7a", ic: "orb" },
        heart: { n: "Lodowe serce", t: "q", price: 40, c: "#9fe6ff", ic: "gem" },
        fur: { n: "Biała skóra", t: "j", price: 28, c: "#f2f2f2", ic: "pelt" },
        sting: { n: "Żądło skorpiona", t: "q", price: 35, c: "#d8a040", ic: "tusk" },
        scarab: { n: "Złoty skarabeusz", t: "j", price: 60, c: "#f2c94c", ic: "scarab" },
        relic: { n: "Pradawna relikwia", t: "j", price: 250, c: "#ffd25a", ic: "relic" },
        scale: { n: "Łuska smoka", t: "j", price: 300, c: "#9fe6ff", ic: "scarab" },
        letter: { n: "List Sołtysa", t: "q", price: 1, c: "#efe0b8", ic: "letter" },
    };
    const GEAR = {
        war: { w: ["club", "sword", "axe", "blade", "fsword", "ssword"], a: ["shirt", "leather", "chain", "plate", "wplate", "dplate"] },
        arc: { w: ["sbow", "hbow", "lbow", "dbow", "fbow", "sunbow"], a: ["shirt", "leather", "rjack", "rcloak", "rmail", "rdrag"] },
        mag: { w: ["wand", "ostaff", "rstaff", "dstaff", "fstaff", "sstaff"], a: ["shirt", "robe", "mrobe", "arobe", "srobe", "drobe"] },
    };
    const LIGHTB = ["skel", "boss", "wisp", "ielem", "golem", "mummy", "king", "dragon", "siren", "imp", "lgolem", "ignar", "shade", "morgath", "dghost", "grimgor", "frwraith", "szronia", "delf", "naga", "starw", "kolos", "bmage", "specter", "valgar", "dkin", "valdrak", "morana", "thalassor", "cspider", "cgolem"];
    const MON = {
        rat: { n: "Szczur", lvl: 1, hp: 16, atk: 4, def: 0, xp: 7, gold: [0, 3], spd: 2.6, aggro: 0, cd: 1.3, resp: 14, drops: [["tail", 0.6], ["pot", 0.06]] },
        wolf: { n: "Szary wilk", lvl: 3, hp: 38, atk: 9, def: 2, xp: 17, gold: [2, 6], spd: 3.6, aggro: 4, cd: 1.2, resp: 22, drops: [["pelt", 0.5], ["pot", 0.1]] },
        boar: { n: "Dzik", lvl: 4, hp: 55, atk: 10, def: 4, xp: 23, gold: [3, 8], spd: 3, aggro: 2, cd: 1.3, resp: 22, drops: [["tusk", 0.6], ["pot", 0.1]] },
        goblin: { n: "Leśny goblin", lvl: 6, hp: 78, atk: 15, def: 5, xp: 38, gold: [6, 15], spd: 3.1, aggro: 5, cd: 1.2, resp: 28, drops: [["ear", 0.5], ["pot", 0.15], ["$w2", 0.05], ["$a2", 0.05]] },
        spider: { n: "Jaskiniowy pająk", lvl: 7, hp: 88, atk: 18, def: 6, xp: 50, gold: [5, 14], spd: 3.8, aggro: 5, cd: 1.1, resp: 30, drops: [["silk", 0.5], ["bigpot", 0.08], ["mpot", 0.06]] },
        skel: { n: "Szkielet", lvl: 9, hp: 125, atk: 22, def: 9, xp: 72, gold: [10, 22], spd: 2.7, aggro: 5, cd: 1.3, resp: 34, drops: [["bone", 0.6], ["bigpot", 0.1], ["$a3", 0.04], ["$w3", 0.03]] },
        boss: { n: "Upiór Mgieł", lvl: 12, hp: 560, atk: 30, def: 12, xp: 420, gold: [150, 250], spd: 2.5, aggro: 6, cd: 1.5, resp: 120, boss: true, slam: 8, drops: [["gem", 1], ["bigpot", 0.7], ["$a4", 0.2]] },
        drowner: { n: "Topielec", lvl: 10, hp: 170, atk: 27, def: 10, xp: 125, gold: [10, 22], spd: 3, aggro: 5, cd: 1.3, resp: 30, drops: [["slime", 0.5], ["bigpot", 0.1], ["mpot", 0.1]] },
        wisp: { n: "Błędny ognik", lvl: 11, hp: 130, atk: 25, def: 8, xp: 135, gold: [8, 18], spd: 3.4, aggro: 6, cd: 1.6, rng: 4, pc: "#c8ff7a", resp: 30, drops: [["essence", 0.55], ["mpot", 0.12]] },
        troll: { n: "Bagienny troll", lvl: 13, hp: 280, atk: 34, def: 14, xp: 200, gold: [15, 30], spd: 2.6, aggro: 4, cd: 1.5, resp: 36, sc: 1.25, drops: [["slime", 0.4], ["bigpot", 0.15], ["$a3", 0.05]] },
        witch: { n: "Wiedźma Moczarów", lvl: 16, hp: 1300, atk: 40, def: 16, xp: 1400, gold: [300, 450], spd: 2.6, aggro: 6, cd: 1.6, rng: 5, pc: "#9dff7a", resp: 180, boss: true, slam: 7, drops: [["$w4", 0.5], ["elix", 0.6], ["relic", 0.3]] },
        swolf: { n: "Śnieżny wilk", lvl: 14, hp: 260, atk: 37, def: 15, xp: 230, gold: [12, 26], spd: 3.8, aggro: 5, cd: 1.1, resp: 30, drops: [["fur", 0.5], ["bigpot", 0.1]] },
        ielem: { n: "Lodowy żywiołak", lvl: 16, hp: 290, atk: 39, def: 18, xp: 280, gold: [15, 30], spd: 2.8, aggro: 6, cd: 1.7, rng: 4, pc: "#9fe6ff", resp: 34, drops: [["heart", 0.5], ["mpot", 0.15]] },
        yeti: { n: "Śnieżny troll", lvl: 17, hp: 430, atk: 47, def: 20, xp: 340, gold: [20, 40], spd: 2.8, aggro: 4, cd: 1.5, resp: 38, sc: 1.3, drops: [["fur", 0.6], ["elix", 0.06], ["$a5", 0.04]] },
        dragon: { n: "Szronogrzbiet", lvl: 22, hp: 3000, atk: 58, def: 26, xp: 3600, gold: [700, 1000], spd: 2.4, aggro: 7, cd: 1.8, rng: 5, pc: "#bff2ff", resp: 240, boss: true, slam: 6, sc: 1.6, drops: [["scale", 1], ["elix", 0.8], ["$a5", 0.5]] },
        scorp: { n: "Skorpion pustyni", lvl: 18, hp: 380, atk: 49, def: 22, xp: 380, gold: [20, 40], spd: 3.4, aggro: 5, cd: 1.2, resp: 32, drops: [["sting", 0.55], ["bigpot", 0.12]] },
        mummy: { n: "Mumia", lvl: 20, hp: 470, atk: 53, def: 24, xp: 470, gold: [25, 50], spd: 2.5, aggro: 5, cd: 1.4, resp: 36, drops: [["scarab", 0.4], ["elix", 0.06], ["$a5", 0.03]] },
        golem: { n: "Kamienny strażnik", lvl: 22, hp: 700, atk: 62, def: 30, xp: 620, gold: [35, 70], spd: 2.1, aggro: 4, cd: 1.7, resp: 40, sc: 1.3, drops: [["scarab", 0.5], ["relic", 0.08]] },
        crab: { n: "Olbrzymi krab", lvl: 27, hp: 880, atk: 72, def: 33, xp: 880, gold: [30, 60], spd: 2.6, aggro: 4, cd: 1.4, resp: 32, as: "scorp", tint: "hue-rotate(150deg) saturate(1.6)", drops: [["shell", 0.5], ["elix", 0.08]] },
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
        bandit: { n: "Zbój z gościńca", lvl: 5, hp: 66, atk: 13, def: 4, xp: 30, gold: [4, 9], spd: 3, aggro: 5, cd: 1.4, resp: 18, hum: { "body": "#5a3a2a", "skin": "#e0b48a", "hair": "#2a1a10", "eye": "#ff5040", "hood": true }, hw: "#9aa0a8", drops: [["bandana", 0.5], ["pot", 0.12]] },
        bwolf: { n: "Czarny wilk", lvl: 6, hp: 80, atk: 15, def: 5, xp: 38, gold: [4, 10], spd: 3, aggro: 5, cd: 1.4, resp: 18, as: "wolf", tint: "brightness(0.45) saturate(0.6)", drops: [["pelt", 0.5], ["pot", 0.12]] },
        bear: { n: "Niedźwiedź brunatny", lvl: 8, hp: 150, atk: 21, def: 8, xp: 75, gold: [8, 16], spd: 2.4, aggro: 5, cd: 1.4, resp: 26, as: "yeti", tint: "sepia(1) saturate(2.2) hue-rotate(-15deg) brightness(0.55)", sc: 1.05, drops: [["bearpaw", 0.55], ["bigpot", 0.06]] },
        kiel: { n: "Kieł, Herszt Zbójców", lvl: 10, hp: 720, atk: 27, def: 11, xp: 760, gold: [140, 220], spd: 3, aggro: 5, cd: 1.4, resp: 180, boss: true, slam: 6, sc: 1.25, rng: 4, pc: "#ffb347", hum: { "body": "#3a1a1a", "skin": "#d8a880", "hair": "#1a1a1a", "eye": "#ff3030", "beard": true, "helmet": true }, hw: "#c9d1d9", glow: "rgba(255,90,60,0.3)", drops: [["fang", 1], ["bigpot", 1], ["$w3", 0.25]] },
        kobold: { n: "Kobold górnik", lvl: 12, hp: 210, atk: 31, def: 12, xp: 160, gold: [10, 20], spd: 3, aggro: 5, cd: 1.4, resp: 22, as: "goblin", tint: "hue-rotate(160deg) saturate(1.4) brightness(0.8)", sc: 0.9, drops: [["kcrys", 0.5], ["bigpot", 0.08]] },
        crawler: { n: "Kamienny pełzacz", lvl: 14, hp: 270, atk: 37, def: 15, xp: 220, gold: [12, 24], spd: 2.6, aggro: 5, cd: 1.4, resp: 22, as: "spider", tint: "grayscale(1) brightness(1.2)", sc: 1.2, drops: [["kcrys", 0.35], ["mpot", 0.1]] },
        dghost: { n: "Duch krasnoluda", lvl: 16, hp: 380, atk: 43, def: 18, xp: 320, gold: [16, 30], spd: 3, aggro: 5, cd: 1.4, resp: 22, hum: { "body": "#4a5a7a", "skin": "#a8c0e0", "hair": "#e8e8ff", "eye": "#9fe8ff", "beard": true, "helmet": true }, hw: "#9fe8ff", glow: "rgba(150,200,255,0.4)", sc: 0.9, drops: [["dwarfr", 0.55], ["elix", 0.05]] },
        grimgor: { n: "Grimgor, Duch Kopalni", lvl: 18, hp: 2100, atk: 50, def: 21, xp: 2500, gold: [400, 650], spd: 3, aggro: 5, cd: 1.4, resp: 200, boss: true, slam: 6, sc: 1.35, rng: 4, pc: "#9fe8ff", hum: { "body": "#2a3a5a", "skin": "#b8d0f0", "hair": "#ffffff", "eye": "#7fe9ff", "beard": true, "crown": true }, hw: "#9fe8ff", hwk: "staff", glow: "rgba(127,233,255,0.45)", drops: [["dwarfr", 1], ["elix", 1], ["relic", 0.5]] },
        frwraith: { n: "Upiór zamieci", lvl: 21, hp: 500, atk: 56, def: 25, xp: 500, gold: [20, 40], spd: 3, aggro: 5, cd: 1.4, resp: 34, as: "wisp", tint: "grayscale(1) brightness(1.5)", rng: 4, pc: "#e8f8ff", drops: [["frostc", 0.45], ["elix", 0.05]] },
        icetroll: { n: "Lodowy troll", lvl: 23, hp: 600, atk: 61, def: 28, xp: 600, gold: [24, 46], spd: 3, aggro: 5, cd: 1.4, resp: 34, as: "troll", tint: "hue-rotate(170deg) saturate(1.4) brightness(1.15)", drops: [["frostc", 0.3], ["elix", 0.06]] },
        mammoth: { n: "Mamut szronowy", lvl: 25, hp: 850, atk: 68, def: 31, xp: 800, gold: [30, 55], spd: 2.2, aggro: 5, cd: 1.4, resp: 40, as: "yeti", tint: "sepia(0.6) brightness(0.9)", sc: 1.4, drops: [["mtusk", 0.55], ["gpot", 0.04]] },
        szronia: { n: "Szronia, Królowa Lodu", lvl: 28, hp: 5200, atk: 76, def: 34, xp: 8500, gold: [1100, 1700], spd: 3, aggro: 5, cd: 1.4, resp: 240, boss: true, slam: 5, sc: 1.4, rng: 5, pc: "#bfefff", hum: { "body": "#bfe0ff", "skin": "#e8f4ff", "hair": "#ffffff", "eye": "#5fd8ff", "long": true, "robe": true, "crown": true }, hw: "#bfefff", hwk: "staff", glow: "rgba(190,240,255,0.5)", drops: [["frostc", 1], ["gpot", 1], ["relic", 1]] },
        hyena: { n: "Hiena stepowa", lvl: 26, hp: 820, atk: 70, def: 32, xp: 820, gold: [28, 56], spd: 3, aggro: 5, cd: 1.4, resp: 34, as: "wolf", tint: "sepia(1) saturate(1.6) brightness(0.95)", drops: [["hyhide", 0.5], ["elix", 0.06]] },
        nomad: { n: "Koczownik-łupieżca", lvl: 28, hp: 950, atk: 75, def: 34, xp: 950, gold: [36, 70], spd: 3, aggro: 5, cd: 1.4, resp: 34, hum: { "body": "#8a5a2a", "skin": "#c89068", "hair": "#1a1a1a", "eye": "#ffb040", "hood": true }, hw: "#c9d1d9", drops: [["hyhide", 0.25], ["gpot", 0.05]] },
        basil: { n: "Bazyliszek", lvl: 31, hp: 1350, atk: 84, def: 37, xp: 1300, gold: [44, 84], spd: 2.4, aggro: 5, cd: 1.4, resp: 40, as: "scorp", tint: "hue-rotate(70deg) saturate(1.8)", sc: 1.3, drops: [["bscale", 0.55], ["gpot", 0.06]] },
        burzan: { n: "Chan Burzan", lvl: 33, hp: 6500, atk: 88, def: 39, xp: 10000, gold: [1400, 2100], spd: 3, aggro: 5, cd: 1.4, resp: 240, boss: true, slam: 5, sc: 1.4, rng: 4, pc: "#ffb347", hum: { "body": "#7a3a1a", "skin": "#c89068", "hair": "#1a1a1a", "eye": "#ffd84a", "beard": true, "helmet": true }, hw: "#ffd84a", glow: "rgba(255,180,60,0.35)", drops: [["gpot", 1], ["relic", 1], ["hyhide", 1]] },
        delf: { n: "Mroczny elf", lvl: 32, hp: 1250, atk: 86, def: 38, xp: 1250, gold: [42, 80], spd: 3, aggro: 5, cd: 1.4, resp: 34, hum: { "body": "#1a3a2a", "skin": "#c8d8c0", "hair": "#e8e8e8", "eye": "#7dff8a", "long": true, "hood": true }, hw: "#9fe08a", hwk: "staff", rng: 4, pc: "#7dff8a", drops: [["elfar", 0.5], ["gpot", 0.05]] },
        wwolf: { n: "Wilkołak", lvl: 36, hp: 1500, atk: 96, def: 42, xp: 1550, gold: [48, 90], spd: 3, aggro: 5, cd: 1.4, resp: 34, as: "swolf", tint: "brightness(0.5) sepia(0.6)", sc: 1.25, drops: [["pelt", 0.6], ["gpot", 0.06]] },
        treant: { n: "Pradrzewiec", lvl: 35, hp: 1900, atk: 94, def: 44, xp: 1700, gold: [50, 96], spd: 2, aggro: 5, cd: 1.4, resp: 40, as: "golem", tint: "sepia(1) hue-rotate(50deg) saturate(2) brightness(0.8)", sc: 1.35, drops: [["bark", 0.55], ["selix", 0.03]] },
        morana: { n: "Morana, Driada Zagłady", lvl: 39, hp: 9000, atk: 104, def: 46, xp: 16000, gold: [2200, 3200], spd: 3, aggro: 5, cd: 1.4, resp: 270, boss: true, slam: 5, sc: 1.45, rng: 5, pc: "#7dff8a", hum: { "body": "#1a4a1a", "skin": "#a8d890", "hair": "#3a8a2a", "eye": "#e0ff60", "long": true, "robe": true, "crown": true }, hw: "#7dff8a", hwk: "staff", glow: "rgba(125,255,138,0.45)", drops: [["bark", 1], ["selix", 1], ["relic", 1]] },
        naga: { n: "Naga z głębin", lvl: 43, hp: 2200, atk: 113, def: 52, xp: 2200, gold: [62, 120], spd: 3, aggro: 5, cd: 1.4, resp: 34, hum: { "body": "#1a6a6a", "skin": "#7ad8c0", "hair": "#1a3a3a", "eye": "#e0ff60", "long": true, "robe": true }, hw: "#7fffd0", hwk: "staff", rng: 4, pc: "#7fffd0", glow: "rgba(120,255,208,0.3)", drops: [["nscale", 0.5], ["selix", 0.04]] },
        drowned: { n: "Utopiony rycerz", lvl: 46, hp: 2600, atk: 121, def: 56, xp: 2500, gold: [70, 130], spd: 3, aggro: 5, cd: 1.4, resp: 34, hum: { "body": "#2a4a4a", "skin": "#6a8a80", "hair": "#1a2a2a", "eye": "#c8ff60", "helmet": true }, hw: "#7a9a90", drops: [["nscale", 0.3], ["selix", 0.05]] },
        tentacle: { n: "Macka Głębin", lvl: 48, hp: 3300, atk: 127, def: 60, xp: 3000, gold: [80, 150], spd: 2.2, aggro: 5, cd: 1.4, resp: 40, as: "drowner", tint: "hue-rotate(200deg) saturate(1.8) brightness(0.8)", sc: 1.35, drops: [["coral", 0.55], ["selix", 0.06]] },
        thalassor: { n: "Thalassor, Kraken Głębin", lvl: 50, hp: 17000, atk: 136, def: 62, xp: 32000, gold: [3800, 5200], spd: 3, aggro: 5, cd: 1.4, resp: 300, boss: true, slam: 5, sc: 1.75, rng: 5, pc: "#7fffd0", as: "dragon", tint: "hue-rotate(120deg) saturate(1.6) brightness(0.8)", drops: [["coral", 1], ["selix", 1], ["relic", 2]] },
        cspider: { n: "Pryzmatyczny pająk", lvl: 61, hp: 4200, atk: 158, def: 76, xp: 4300, gold: [120, 220], spd: 3, aggro: 5, cd: 1.4, resp: 34, as: "spider", tint: "hue-rotate(170deg) saturate(2) brightness(1.4)", sc: 1.25, drops: [["prism", 0.45], ["spot", 0.04]] },
        cgolem: { n: "Kryształowy golem", lvl: 63, hp: 5600, atk: 164, def: 82, xp: 5200, gold: [140, 250], spd: 2, aggro: 5, cd: 1.4, resp: 42, as: "golem", tint: "hue-rotate(160deg) saturate(2.4) brightness(1.3)", sc: 1.4, drops: [["prism", 0.55], ["spot", 0.05]] },
        starw: { n: "Gwiezdny strażnik", lvl: 66, hp: 5000, atk: 170, def: 80, xp: 5200, gold: [140, 260], spd: 3, aggro: 5, cd: 1.4, resp: 34, hum: { "body": "#2a3a6a", "skin": "#d8e0ff", "hair": "#ffffff", "eye": "#9fd8ff", "helmet": true }, hw: "#bfe8ff", glow: "rgba(160,210,255,0.35)", drops: [["starsh", 0.5], ["spot", 0.05]] },
        kolos: { n: "Lustrzany Kolos", lvl: 68, hp: 32000, atk: 176, def: 84, xp: 70000, gold: [7000, 9500], spd: 3, aggro: 5, cd: 1.4, resp: 330, boss: true, slam: 5, sc: 1.8, rng: 5, pc: "#bfe8ff", as: "golem", tint: "hue-rotate(180deg) saturate(1.2) brightness(1.7)", drops: [["starsh", 1], ["spot", 2], ["relic", 2]] },
        bmage: { n: "Kościany mag", lvl: 67, hp: 5300, atk: 172, def: 82, xp: 5400, gold: [150, 270], spd: 3, aggro: 5, cd: 1.4, resp: 34, hum: { "body": "#2a2a2a", "skin": "#ece6d4", "hair": "#ece6d4", "eye": "#7dff8a", "robe": true, "hood": true }, hw: "#7dff8a", hwk: "staff", rng: 4, pc: "#7dff8a", glow: "rgba(125,255,138,0.3)", drops: [["bdust", 0.5], ["spot", 0.05]] },
        specter: { n: "Upiorna zjawa", lvl: 69, hp: 5600, atk: 177, def: 84, xp: 5800, gold: [160, 280], spd: 3, aggro: 5, cd: 1.4, resp: 34, as: "boss", tint: "hue-rotate(80deg) saturate(1.4)", drops: [["soulg", 0.5], ["spot", 0.05]] },
        bdrake: { n: "Kościany smok", lvl: 72, hp: 7400, atk: 185, def: 90, xp: 7000, gold: [190, 320], spd: 2.4, aggro: 5, cd: 1.4, resp: 44, as: "dragon", tint: "grayscale(1) brightness(1.3)", sc: 1.1, drops: [["bdust", 0.6], ["dpot", 0.04]] },
        valgar: { n: "Valgar, Lisz Nekropolii", lvl: 74, hp: 38000, atk: 190, def: 90, xp: 85000, gold: [8000, 11000], spd: 3, aggro: 5, cd: 1.4, resp: 360, boss: true, slam: 5, sc: 1.6, rng: 5, pc: "#9aff9a", hum: { "body": "#14201a", "skin": "#c8d0c0", "hair": "#0a120a", "eye": "#7dff8a", "robe": true, "crown": true }, hw: "#9aff9a", hwk: "staff", glow: "rgba(154,255,154,0.5)", drops: [["vcrown", 1], ["dpot", 2], ["relic", 2]] },
        drakon: { n: "Ognisty drakon", lvl: 73, hp: 6400, atk: 188, def: 90, xp: 6600, gold: [180, 320], spd: 3, aggro: 5, cd: 1.4, resp: 34, as: "dragon", tint: "hue-rotate(-60deg) saturate(2)", sc: 0.9, drops: [["dscale", 0.3], ["dpot", 0.04]] },
        dkin: { n: "Smoczy kultysta", lvl: 75, hp: 6800, atk: 193, def: 92, xp: 7000, gold: [190, 340], spd: 3, aggro: 5, cd: 1.4, resp: 34, hum: { "body": "#5a1a0a", "skin": "#d8a080", "hair": "#2a0a0a", "eye": "#ff6a2a", "robe": true, "hood": true }, hw: "#ff7a2a", hwk: "staff", rng: 4, pc: "#ff7a2a", glow: "rgba(255,120,40,0.35)", drops: [["dheart", 0.06], ["dpot", 0.05]] },
        wyrm: { n: "Lawowy wyrm", lvl: 78, hp: 8800, atk: 200, def: 98, xp: 8600, gold: [220, 380], spd: 2.2, aggro: 5, cd: 1.4, resp: 46, as: "scorp", tint: "hue-rotate(-30deg) saturate(3) brightness(0.9)", sc: 1.5, drops: [["dscale", 0.55], ["dpot", 0.06]] },
        valdrak: { n: "Valdrak, Pradawny Smok", lvl: 80, hp: 52000, atk: 210, def: 100, xp: 120000, gold: [12000, 16000], spd: 3, aggro: 5, cd: 1.4, resp: 420, boss: true, slam: 5, sc: 2, rng: 5, pc: "#ff7a2a", as: "dragon", tint: "hue-rotate(-90deg) saturate(2.4) brightness(1.05)", drops: [["vscale", 1], ["dheart", 1], ["dpot", 3]] },
        king: { n: "Sethar, Król Cieni", lvl: 26, hp: 4200, atk: 72, def: 32, xp: 7000, gold: [1500, 2200], spd: 2.5, aggro: 7, cd: 1.6, rng: 5, pc: "#c58cff", resp: 300, boss: true, slam: 5, sc: 1.4, drops: [["$w6", 1], ["relic", 1], ["elix", 1]] },
    };
    const NPCS = {
        soltys: { n: "Sołtys Radomir", area: "village", x: 16, y: 17, c: { body: "#3c5aa6", skin: "#f0c9a0", hair: "#e8e8e8", beard: true }, talk: "Osada Brzozowa to spokojne miejsce... przynajmniej była, zanim z północy zeszła mgła." },
        kowal: { n: "Kowal Bogumił", area: "village", x: 11, y: 12, c: { body: "#5b3a24", skin: "#e2b48a", hair: "#2a1a10", apron: true }, shop: "smith", talk: "Dobra stal to podstawa przetrwania. Obejrzyj, co wykułem dla ludzi twojego fachu." },
        zielarka: { n: "Zielarka Wiesława", area: "village", x: 31, y: 12, c: { body: "#4f7a3a", skin: "#f2cfa8", hair: "#a0522d", long: true }, shop: "herbs", talk: "Mikstury z ziół Mrocznego Boru. Postawią cię na nogi po każdej walce." },
        straznik: { n: "Strażnik Mirek", area: "village", x: 37, y: 13, c: { body: "#7a7f88", skin: "#e8bf98", hair: "#5a3a1a", helmet: true }, talk: "Za bramą zaczyna się Mroczny Bór. Na jego południowym skraju ścieżka prowadzi na Bagna Żałoby." },
        pustelnik: { n: "Pustelnik Ignacy", area: "forest", x: 13, y: 33, c: { body: "#6a5a8a", skin: "#e0b890", hair: "#cfcfcf", beard: true }, heal: "Odpocznij przy ognisku", talk: "Mgła przyszła z jaskini na północnym wschodzie. Coś się tam obudziło. Ogrzej się przy moim ognisku." },
        rybak: { n: "Rybak Zdzich", area: "swamp", x: 25, y: 6, c: { body: "#5a6a4a", skin: "#e0b48a", hair: "#7a6a5a", beard: true }, shop: "swamp", talk: "Kiedyś łowiłem tu karasie. Teraz z bagna wyłażą topielce, a nocą tańczą ogniki." },
        kapitan: { n: "Kapitan Bronisław", area: "town", x: 22, y: 12, c: { body: "#7a2a2a", skin: "#e8bf98", hair: "#3a2a1a", helmet: true }, talk: "Srebrnogród stoi od trzystu lat. Ale z gór na północy schodzą bestie, a ze wschodniej pustyni wieje chłodem śmierci." },
        platnerz: { n: "Płatnerz Wojsław", area: "town", x: 8, y: 13, c: { body: "#4a3a2a", skin: "#dfb088", hair: "#1a1a1a", apron: true }, shop: "armory", talk: "Najlepszy sprzęt w całym Ardanie. Dla każdej profesji coś się znajdzie." },
        alchemik: { n: "Alchemiczka Halina", area: "town", x: 33, y: 13, c: { body: "#5a3a7a", skin: "#f2cfa8", hair: "#d8c060", long: true }, shop: "alch", talk: "Eliksiry, mikstury many... wszystko, czego potrzebuje rozsądny poszukiwacz przygód." },
        kronikarz: { n: "Kronikarz Leon", area: "town", x: 24, y: 18, c: { body: "#3a4a6a", skin: "#f0c9a0", hair: "#bbbbbb", beard: true }, talk: "Na wschód od miasta leżą Ruiny Piasków, dawna stolica Króla Cieni. Zapisuję każdą opowieść stamtąd." },
        kaplanka: { n: "Kapłanka Dobrosława", area: "town", x: 15, y: 18, c: { body: "#e8e0d0", skin: "#f2cfa8", hair: "#c87a3a", long: true }, heal: "Poproś o błogosławieństwo", talk: "Niech światło prowadzi twoje kroki, wędrowcze." },
        mnich: { n: "Mnich Teodor", area: "mount", x: 29, y: 33, c: { body: "#8a5a2a", skin: "#e0b890", hair: "#5a3a2a" }, heal: "Odpocznij przy kapliczce", talk: "Wiatr na przełęczy szepcze imię smoka. Odpocznij przy kapliczce, zanim ruszysz wyżej." },
        nomada: { n: "Nomada Kazimir", area: "desert", x: 16, y: 13, c: { body: "#c8a060", skin: "#c89068", hair: "#2a1a10" }, shop: "nomad", talk: "Woda z oazy jest słodka, ale ruiny na wschodzie pełne są martwych. Handluję tym, co przetrwa upał. Na północnym wschodzie droga wiedzie do portu." },
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
        gajowy: { n: "Gajowy Bartosz", area: "wolfhills", x: 27, y: 4, c: { "body": "#3a5a2a", "skin": "#e0b48a", "hair": "#6a4a2a", "beard": true }, talk: "Wilcze Wzgórza były kiedyś spokojne. Teraz rządzą tu zbóje Kła i wilki, które straciły strach przed ludźmi." },
        borysl: { n: "Krasnolud Borysław", area: "mine", x: 38, y: 19, c: { "body": "#5a4a3a", "skin": "#e0b090", "hair": "#a0522d", "beard": true, "helmet": true }, talk: "Moi przodkowie kopali tu srebro. Teraz w chodnikach straszy duch naszego dawnego starszego, Grimgora." },
        szronka: { n: "Łowczyni Szronka", area: "glacier", x: 27, y: 34, c: { "body": "#c8d8e8", "skin": "#f2cfa8", "hair": "#e8e8e8", "long": true, "hood": true }, talk: "Na lodowcu przeżyją tylko najtwardsi. Królowa Lodu zamraża każdego, kto zbliży się do jej tronu." },
        radzim: { n: "Zwiadowca Radzim", area: "steppe", x: 26, y: 34, c: { "body": "#8a6a3a", "skin": "#c89068", "hair": "#2a1a10", "hood": true }, talk: "Stepy płoną od lat. Chan Burzan i jego koczownicy palą wszystko, czego nie mogą zabrać." },
        iwa: { n: "Strażniczka Iwa", area: "elfwood", x: 27, y: 34, c: { "body": "#2a5a3a", "skin": "#f2cfa8", "hair": "#d8c070", "long": true }, talk: "Puszcza choruje. Driada Morana zatruła korzenie pradrzew i obróciła mój lud przeciw nam." },
        wawrzyn: { n: "Nurek Wawrzyn", area: "sunken", x: 27, y: 5, c: { "body": "#2a4a6a", "skin": "#e0b48a", "hair": "#3a2a1a", "beard": true }, talk: "Pod wodą leży stolica dawnego królestwa. Kraken Thalassor pilnuje jej skarbów od tysiąca lat." },
        starcap: { n: "Strażnik Gwiazd Aurelian", area: "star", x: 21, y: 11, c: { "body": "#2a3a6a", "skin": "#e8bf98", "hair": "#e8e8e8", "helmet": true }, talk: "Gwiezdna Strażnica pilnuje granic świata. Dalej na wschodzie jest już tylko kryształ, śmierć i smoki." },
        astronom: { n: "Astronom Gwidon", area: "star", x: 14, y: 16, c: { "body": "#3a2a6a", "skin": "#f0c9a0", "hair": "#bbbbbb", "beard": true, "robe": true }, talk: "Gwiazdy spadają na Kryształowe Pustkowia. Każdy odłamek ma w sobie moc, której nie rozumiemy." },
        inkwiz: { n: "Inkwizytor Bożydar", area: "star", x: 26, y: 15, c: { "body": "#1a1a2a", "skin": "#e0b890", "hair": "#2a2a2a", "helmet": true }, talk: "Nekropolia Valgaru budzi się do życia. Lisz zbiera armię, której nie powstrzyma żaden mur." },
        smokobojca: { n: "Smokobójca Bolesław", area: "star", x: 9, y: 15, c: { "body": "#6a2a1a", "skin": "#dfb088", "hair": "#7a2a1a", "beard": true, "helmet": true }, talk: "Valdrak, Pradawny Smok, był stary, gdy Ardan był młody. Kto go pokona, stanie się legendą." },
        starsmith: { n: "Mistrz kuźni gwiezdnej Ostoja", area: "star", x: 26, y: 12, c: { "body": "#2a2a3a", "skin": "#dfb088", "hair": "#e8e8e8", "apron": true, "beard": true }, shop: "starm", talk: "Kuję w ogniu spadających gwiazd. Pokaż, co masz, a zrobię z tego coś godnego bohatera." },
        staralch: { n: "Alchemiczka Gwiazdka", area: "star", x: 9, y: 12, c: { "body": "#3a5a8a", "skin": "#f2cfa8", "hair": "#d8d8ff", "long": true }, shop: "starm", talk: "Mikstura Gwiazd uleczy rany, po których inni już by nie wstali." },
        starpriest: { n: "Kapłan Zorzy", area: "star", x: 21, y: 16, c: { "body": "#f0e8d8", "skin": "#e8bf98", "hair": "#5a3a2a" }, heal: "Poproś o blask zorzy", talk: "Blask zorzy przywraca siły każdemu, kto walczy z mrokiem." },
        handvil: { n: "Handlarz Jędrek", area: "village", x: 24, y: 13, trade: "skup", c: { "body": "#7a5a2a", "skin": "#f0c9a0", "hair": "#5a3a1a", "beard": true }, talk: "Skupuję wszystko, co przyniesiesz z lasu: broń, zbroje, materiały. Płacę uczciwie, w złocie." },
        handtown: { n: "Handlarz Bogdan", area: "town", x: 16, y: 12, trade: "skup", c: { "body": "#6a4a2a", "skin": "#f0c9a0", "hair": "#2a1a10", "beard": true }, talk: "Najlepsze ceny w Srebrnogrodzie! Sprzedaj mi to, czego nie potrzebujesz." },
        auktown: { n: "Aukcjoner Mieszko", area: "town", x: 25, y: 13, trade: "aukcja", c: { "body": "#5a2a6a", "skin": "#f0c9a0", "hair": "#8a8a8a", "beard": true }, talk: "Dom aukcyjny Srebrnogrodu. U mnie wystawisz przedmioty dla innych graczy i kupisz to, co oni wystawili." },
        handport: { n: "Handlarz Ignacy", area: "port", x: 21, y: 16, trade: "skup", c: { "body": "#2a4a6a", "skin": "#e0b48a", "hair": "#5a3a1a" }, talk: "Statki zabierają wszystko. Skupię każdy przedmiot i każdy materiał." },
        aukport: { n: "Aukcjonerka Halina", area: "port", x: 14, y: 11, trade: "aukcja", c: { "body": "#6a2a3a", "skin": "#f2cfa8", "hair": "#c87a3a", "long": true }, talk: "Dom aukcyjny Mewiej Przystani. Wystawiaj, kupuj, odbieraj złoto ze sprzedaży." },
        handfort: { n: "Handlarz Wojmir", area: "fort", x: 21, y: 16, trade: "skup", c: { "body": "#5a3a2a", "skin": "#e0b48a", "hair": "#1a1a1a", "beard": true }, talk: "Twierdza potrzebuje stali. Skupię broń, zbroje i materiały." },
        handcit: { n: "Handlarz Świętosław", area: "citadel", x: 21, y: 16, trade: "skup", c: { "body": "#4a4a6a", "skin": "#f0c9a0", "hair": "#d8d8d8", "beard": true }, talk: "Skup przedmiotów Cytadeli. Każdy łup ma swoją cenę." },
        aukcit: { n: "Aukcjonerka Dobrosława", area: "citadel", x: 14, y: 11, trade: "aukcja", c: { "body": "#2a2a5a", "skin": "#f2cfa8", "hair": "#ffd84a", "long": true }, talk: "Dom aukcyjny Cytadeli Świtu. Najlepsze przedmioty Ardanu przechodzą przez moje ręce." },
        handstar: { n: "Handlarz Gwiezdny Lech", area: "star", x: 12, y: 11, trade: "skup", c: { "body": "#3a3a6a", "skin": "#e0b48a", "hair": "#2a1a10" }, talk: "Skupuję łupy z najdalszych krain. Płacę dobrze, bo wiem, ile kosztują." },
        aukstar: { n: "Aukcjoner Gwiezdny Radosław", area: "star", x: 23, y: 17, trade: "aukcja", c: { "body": "#5a3a7a", "skin": "#f0c9a0", "hair": "#e8e8e8", "beard": true }, talk: "Dom aukcyjny Gwiezdnej Strażnicy. Tu handlują najpotężniejsi bohaterowie." },
    };
    const DECOR = [{ area: "forest", x: 12, y: 34, k: "fire" }, { area: "village", x: 22, y: 12, k: "crate" }, { area: "village", x: 23, y: 12, k: "barrel" },
        { area: "swamp", x: 27, y: 4, k: "lamp" }, { area: "swamp", x: 21, y: 8, k: "lamp" }, { area: "swamp", x: 36, y: 30, k: "lamp" },
        { area: "town", x: 18, y: 2, k: "banner" }, { area: "town", x: 21, y: 2, k: "banner" }, { area: "town", x: 2, y: 14, k: "banner" }, { area: "town", x: 2, y: 17, k: "banner" },
        { area: "town", x: 37, y: 14, k: "banner" }, { area: "town", x: 37, y: 17, k: "banner" }, { area: "town", x: 10, y: 10, k: "crate" }, { area: "town", x: 26, y: 10, k: "barrel" },
        { area: "mount", x: 31, y: 33, k: "shrine" }, { area: "desert", x: 14, y: 12, k: "tent" }, { area: "desert", x: 14, y: 15, k: "fire" },
        { area: "port", x: 16, y: 2, k: "banner" }, { area: "port", x: 19, y: 2, k: "banner" }, { area: "port", x: 12, y: 11, k: "crate" }, { area: "port", x: 23, y: 16, k: "barrel" }, { area: "port", x: 15, y: 23, k: "lamp" }, { area: "port", x: 20, y: 23, k: "lamp" },
        { area: "fort", x: 16, y: 2, k: "banner" }, { area: "fort", x: 19, y: 2, k: "banner" }, { area: "fort", x: 2, y: 12, k: "banner" }, { area: "fort", x: 2, y: 15, k: "banner" }, { area: "fort", x: 12, y: 16, k: "fire" },
        { area: "citadel", x: 16, y: 2, k: "banner" }, { area: "citadel", x: 19, y: 2, k: "banner" }, { area: "citadel", x: 2, y: 12, k: "banner" }, { area: "citadel", x: 2, y: 15, k: "banner" }, { area: "citadel", x: 12, y: 11, k: "shrine" },
        { area: "coast", x: 12, y: 18, k: "tent" }, { area: "coast", x: 13, y: 22, k: "fire" }, { area: "volcano", x: 44, y: 30, k: "shrine" }, { area: "abyss", x: 38, y: 32, k: "lamp" }, { area: "abyss", x: 42, y: 22, k: "lamp" },
        { area: "wolfhills", x: 22, y: 3, k: "tent" }, { area: "wolfhills", x: 23, y: 6, k: "fire" }, { area: "mine", x: 37, y: 23, k: "lamp" }, { area: "mine", x: 29, y: 12, k: "lamp" }, { area: "mine", x: 15, y: 20, k: "lamp" }, { area: "mine", x: 40, y: 23, k: "crate" }, { area: "glacier", x: 22, y: 33, k: "tent" }, { area: "glacier", x: 23, y: 36, k: "fire" }, { area: "steppe", x: 21, y: 33, k: "tent" }, { area: "steppe", x: 22, y: 36, k: "fire" }, { area: "elfwood", x: 22, y: 33, k: "tent" }, { area: "elfwood", x: 23, y: 36, k: "fire" }, { area: "sunken", x: 22, y: 4, k: "lamp" }, { area: "sunken", x: 28, y: 3, k: "crate" }, { area: "star", x: 16, y: 2, k: "banner" }, { area: "star", x: 19, y: 2, k: "banner" }, { area: "star", x: 33, y: 12, k: "banner" }, { area: "star", x: 33, y: 15, k: "banner" }, { area: "star", x: 12, y: 16, k: "shrine" }, { area: "village", x: 25, y: 12, k: "crate" }, { area: "town", x: 15, y: 11, k: "crate" }, { area: "town", x: 26, y: 12, k: "banner" }, { area: "port", x: 13, y: 10, k: "banner" }, { area: "citadel", x: 13, y: 10, k: "lamp" }, { area: "star", x: 22, y: 18, k: "lamp" }, { area: "crystal", x: 6, y: 17, k: "shrine" }, { area: "necro", x: 22, y: 4, k: "lamp" }, { area: "necro", x: 27, y: 4, k: "lamp" }, { area: "dragon", x: 6, y: 17, k: "shrine" }];
    Object.keys(NPCS).forEach((k) => { const n = NPCS[k]; const a = AREAS[n.area]; if (solidT(a, n.x, n.y))
        st(a, n.x, n.y, a.base); });
    DECOR.forEach((d) => { const a = AREAS[d.area]; if (solidT(a, d.x, d.y))
        st(a, d.x, d.y, a.base); });
    if (!SRV)
        Object.keys(AREAS).forEach((k) => renderMini(AREAS[k]));
    const PVPZ = [
        { area: "village", x0: 14, y0: 19, x1: 24, y1: 25, n: "Arena Osady" },
        { area: "town", x0: 12, y0: 21, x1: 26, y1: 28, n: "Arena Srebrnogrodu" },
        { area: "desert", x0: 0, y0: 0, x1: 99, y1: 99, n: "Ruiny Piasków", lethal: 1 },
        { area: "steppe", x0: 0, y0: 0, x1: 99, y1: 99, n: "Spalone Stepy", lethal: 1 },
        { area: "volcano", x0: 0, y0: 0, x1: 99, y1: 99, n: "Wulkan Ignara", lethal: 1 },
        { area: "abyss", x0: 0, y0: 0, x1: 99, y1: 99, n: "Otchłań Zmierzchu", lethal: 1 },
        { area: "necro", x0: 0, y0: 0, x1: 99, y1: 99, n: "Nekropolia Valgaru", lethal: 1 },
        { area: "dragon", x0: 0, y0: 0, x1: 99, y1: 99, n: "Smocze Gniazdo", lethal: 1 },
    ];
    const CITY = { village: 1, town: 1, port: 1, fort: 1, citadel: 1, star: 1 };
    const pvpMap = (area) => PVPZ.some((z) => z.area === area && z.lethal);
    const pvpAt = (area, x, y) => { for (const z of PVPZ)
        if (z.area === area && x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1)
            return z; return null; };
    const SHOPN = { smith: "Kuźnia Bogumiła", herbs: "Chata Zielarki", swamp: "Zapasy Rybaka", armory: "Zbrojownia Wojsława", alch: "Pracownia Alchemiczki", nomad: "Kram Nomady", portm: "Kram Mewiej Przystani", portsmith: "Kuźnia mistrzów", fortm: "Zaopatrzenie Żarogrodu", citm: "Skarbiec Świtu", starm: "Gwiezdny skarbiec" };
    const SHOPS = { smith: ["$w2", "$w3", "$a2", "$a3", "$a4"], herbs: ["pot", "bigpot", "mpot"], swamp: ["pot", "bigpot", "mpot"], armory: ["$w4", "$w5", "$a4", "$a5"], alch: ["bigpot", "elix", "mpot"], nomad: ["bigpot", "elix", "mpot"], portm: ["bigpot", "elix", "gpot", "mpot"], portsmith: ["$w5", "$w6", "$a5", "$a6"], fortm: ["elix", "gpot", "selix", "mpot"], citm: ["gpot", "selix", "spot", "mpot", "gmpot"], starm: ["selix", "spot", "dpot", "mpot", "gmpot"] };
    const QORDER = ["rats", "wolves", "tusks", "wraith", "letter", "drown", "wisps", "witchq", "swolves", "hearts", "dragonq", "stings", "mummies", "kingq", "crabs", "pirates", "pearls", "leviq", "imps", "embers", "golemsq", "ignarq", "shades", "voidq", "knights", "morgq", "bandits", "bwolves", "bearpaws", "kielq", "kobolds", "crawlers", "runes", "grimq", "frwraiths", "mtusks", "szroniaq", "hyenas", "nomads", "bscales", "burzanq", "delves", "bark", "wolfmen", "moranaq", "nagas", "drowned", "corals", "thalq", "cspiders", "starsh", "kolosq", "bmages", "souls", "bdrakes", "valgarq", "drakons", "dkins", "dscales", "valdrakq"];
    const QUESTS = {
        rats: { n: "Szczury w spiżarni", giver: "soltys", kill: "rat", need: 4, area: "village", desc: "Ubij 4 szczury w Osadzie Brzozowej.",
            offer: "Witaj, wędrowcze! Szczury z piwnic rozpanoszyły się po całej osadzie. Ubij 4 z nich, a cię wynagrodzę.",
            mid: "Szczury wciąż harcują. Ubite: {c}/{n}.", thx: "Wspaniale! Spiżarnia ocalała. Przyjmij te mikstury i trochę grosza.",
            rew: { xp: 35, gold: 25, items: [["pot", 2]] } },
        wolves: { n: "Wilcza plaga", giver: "soltys", req: "rats", kill: "wolf", need: 6, area: "forest", desc: "Ubij 6 szarych wilków w Mrocznym Borze (wschodnia brama).",
            offer: "Z Mrocznego Boru za wschodnią bramą przychodzą wilki i porywają nam owce. Ubij 6 szarych wilków.",
            mid: "Wilków wciąż za dużo. Ubite: {c}/{n}.", thx: "Owce znów pasą się spokojnie. Ten pancerz należał do mojego syna, niech ci służy.",
            rew: { xp: 120, gold: 60, items: [["$a2", 1]] } },
        tusks: { n: "Kły na eliksir", giver: "zielarka", item: "tusk", src: "boar", need: 3, area: "forest", desc: "Przynieś Zielarce 3 kły dzika z Mrocznego Boru.",
            offer: "Potrzebuję kłów dzika do mocnego eliksiru. Przynieś mi 3, dziki ryją w Mrocznym Borze.",
            mid: "Masz już {c}/{n} kłów. Dziki znajdziesz w borze.", thx: "Doskonałe kły! Proszę, oto mikstury, świeżo uwarzone.",
            rew: { xp: 90, gold: 30, items: [["pot", 3], ["bigpot", 1], ["mpot", 2]] } },
        wraith: { n: "Upiór z jaskini", giver: "straznik", req: "wolves", lvl: 6, kill: "boss", need: 1, area: "cave", desc: "Pokonaj Upiora Mgieł w Jaskini Cieni (północny wschód boru).",
            offer: "Mgła sączy się z Jaskini Cieni na północnym wschodzie boru. Mieszka tam Upiór Mgieł. Pokonaj go, a cała osada będzie ci dłużna.",
            lock: "Słyszałem o twoich wilkach! Ale do Jaskini Cieni wróć, gdy osiągniesz 6. poziom.",
            mid: "Upiór wciąż żyje, a mgła gęstnieje. Weź zapas mikstur, zanim tam zejdziesz.", thx: "Mgła się rozwiewa! Jesteś bohaterem Osady Brzozowej. Weź tę broń, wykuli ją nasi przodkowie.",
            rew: { xp: 500, gold: 250, items: [["$w4", 1]] } },
        letter: { n: "Droga na południe", giver: "soltys", to: "kapitan", req: "wraith", talkq: true, give: "letter", need: 1, area: "town",
            desc: "Zanieś list Sołtysa Kapitanowi Bronisławowi do Srebrnogrodu (południe Mrocznego Boru, potem Bagna Żałoby na wschód).",
            offer: "Upiór pokonany, ale mgła to dopiero początek. Zanieś ten list Kapitanowi Bronisławowi do Srebrnogrodu. Droga wiedzie przez południowy skraj Mrocznego Boru i Bagna Żałoby.",
            mid: "Kapitan Bronisław czeka w Srebrnogrodzie, za Bagnami Żałoby.", thx: "List od Radomira? Dobre wieści w złych czasach. Zostań z nami, bohaterze. Srebrnogród potrzebuje takich jak ty.",
            rew: { xp: 600, gold: 120, items: [["bigpot", 3]] } },
        drown: { n: "Topielcy z moczarów", giver: "rybak", lvl: 9, kill: "drowner", need: 6, area: "swamp", desc: "Ubij 6 topielców na Bagnach Żałoby.",
            offer: "Topielce wciągają moje sieci i każdego, kto podejdzie za blisko. Ubij 6 z nich, proszę.", lock: "Te bagna to nie miejsce dla żółtodzioba. Wróć, gdy osiągniesz 9. poziom.",
            mid: "Topielce wciąż czyhają. Ubite: {c}/{n}.", thx: "Wreszcie mogę zarzucić sieć! Weź, co mam najcenniejszego.", rew: { xp: 900, gold: 150, items: [["bigpot", 2], ["mpot", 2]] } },
        wisps: { n: "Ognie nad bagnem", giver: "rybak", req: "drown", item: "essence", src: "wisp", need: 4, area: "swamp", desc: "Zbierz 4 esencje z błędnych ogników (Bagna Żałoby).",
            offer: "Ogniki wabią ludzi w głąb bagna. Ich esencja to podobno świetny składnik mikstur. Przynieś mi 4.", mid: "Esencji: {c}/{n}. Ogniki krążą dalej od mojej chaty.",
            thx: "Świecą jak latarnie! Proszę, twoja nagroda.", rew: { xp: 1100, gold: 180, items: [["elix", 2]] } },
        witchq: { n: "Wiedźma Moczarów", giver: "rybak", req: "wisps", lvl: 13, kill: "witch", need: 1, area: "swamp", desc: "Pokonaj Wiedźmę Moczarów przy jej chacie na południowym wschodzie bagien.",
            offer: "To ona przyzywa topielce i ogniki. Jej chata stoi na wyspie na południowym wschodzie. Skończ z tym raz na zawsze.", lock: "Wiedźma jest potężna. Wróć, gdy osiągniesz 13. poziom.",
            mid: "Wiedźma wciąż żyje. Gdy ziemia pod tobą zaświeci na czerwono, natychmiast odskocz!", thx: "Bagna wreszcie milkną. Ten pancerz należał do dawnych strażników grobli. Jest twój.",
            rew: { xp: 2500, gold: 400, items: [["$a5", 1]] } },
        swolves: { n: "Biały kieł", giver: "kapitan", lvl: 13, kill: "swolf", need: 6, area: "mount", desc: "Ubij 6 śnieżnych wilków w Szczytach Szronu (północna brama Srebrnogrodu).",
            offer: "Śnieżne wilki napadają karawany na przełęczy. Za północną bramą zaczynają się Szczyty Szronu. Ubij 6.", lock: "Góry zabiją nieprzygotowanego. Wróć na 13. poziomie.",
            mid: "Wilki wciąż wyją. Ubite: {c}/{n}.", thx: "Przełęcz znów jest bezpieczna. Garnizon jest ci wdzięczny.", rew: { xp: 2000, gold: 250, items: [["elix", 2]] } },
        hearts: { n: "Serce lodu", giver: "mnich", item: "heart", src: "ielem", need: 3, area: "mount", desc: "Przynieś Mnichowi Teodorowi 3 lodowe serca z żywiołaków.",
            offer: "Lodowe żywiołaki krążą wysoko w górach. Ich serca pozwolą mi wzmocnić kapliczkę. Przynieś 3.", mid: "Masz {c}/{n} serc. Żywiołaki są na północy.",
            thx: "Kapliczka jaśnieje! Przyjmij moje błogosławieństwo i te eliksiry.", rew: { xp: 2400, gold: 200, items: [["elix", 2], ["mpot", 3]] } },
        dragonq: { n: "Szronogrzbiet", giver: "kapitan", req: "swolves", lvl: 18, kill: "dragon", need: 1, area: "mount", desc: "Pokonaj lodowego smoka Szronogrzbieta na płaskowyżu w północno-wschodniej części gór.",
            offer: "Na płaskowyżu gnieździ się Szronogrzbiet, lodowy smok. Dopóki żyje, przełęcz nigdy nie będzie bezpieczna. Zgładź go.", lock: "Smok zamrozi cię w mgnieniu oka. Wróć, gdy osiągniesz 18. poziom.",
            mid: "Smok wciąż żyje. Gdy ziemia zaświeci na czerwono, uciekaj z kręgu!", thx: "Smok nie żyje! Pieśni o tobie będą śpiewać w każdej karczmie. Weź broń z królewskiej zbrojowni.",
            rew: { xp: 6000, gold: 900, items: [["$w5", 1]] } },
        stings: { n: "Jad skorpiona", giver: "nomada", lvl: 17, item: "sting", src: "scorp", need: 5, area: "desert", desc: "Przynieś Nomadzie Kazimirowi 5 żądeł skorpionów pustyni.",
            offer: "Z jadu skorpionów robię odtrutkę dla karawan. Przynieś mi 5 żądeł.", lock: "Skorpiony są zabójcze. Wróć na 17. poziomie.",
            mid: "Masz {c}/{n} żądeł.", thx: "Karawany będą ci wdzięczne. Bierz, uczciwa zapłata.", rew: { xp: 3500, gold: 400, items: [["elix", 3]] } },
        mummies: { n: "Klątwa ruin", giver: "kronikarz", lvl: 18, kill: "mummy", need: 8, area: "desert", desc: "Ubij 8 mumii w zachodnich salach świątyni w Ruinach Piasków (wschodnia brama).",
            offer: "Mumie strzegą ruin dawnej stolicy. Ubij 8 z nich, a zapiszę twoje imię w kronice.", lock: "Ruiny to miejsce dla weteranów. Wróć na 18. poziomie.",
            mid: "Mumii ubitych: {c}/{n}.", thx: "Twoje imię trafi do kroniki! A to za fatygę.", rew: { xp: 4500, gold: 500, items: [["elix", 2], ["relic", 1]] } },
        kingq: { n: "Król Cieni", giver: "kronikarz", req: "mummies", lvl: 23, kill: "king", need: 1, area: "desert", desc: "Pokonaj Sethara, Króla Cieni, we wschodniej sali świątyni.",
            offer: "W najgłębszej sali świątyni czeka Sethar, Król Cieni. To on stoi za mgłą, bestiami i klątwami. Zakończ jego panowanie.", lock: "Sethar to najpotężniejsze zło Ardanu. Wróć, gdy osiągniesz 23. poziom.",
            mid: "Sethar wciąż panuje w cieniach świątyni.", thx: "Ardan jest wolny! Mgła zniknie na zawsze. Jesteś legendą, a to pancerz godny legendy.",
            rew: { xp: 12000, gold: 2000, items: [["$a6", 1]] } },
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
        bandits: { n: "Zbóje na gościńcu", giver: "gajowy", lvl: 4, kill: "bandit", need: 8, area: "wolfhills", desc: "Ubij 8 zbójów na Wilczych Wzgórzach (południowa droga z Osady).", offer: "Zbóje Kła napadają na każdego, kto idzie gościńcem. Przegoń ośmiu.", lock: "Zbóje są groźni dla żółtodziobów. Wróć na 4. poziomie.", mid: "Zbójów pokonanych: {c}/{n}.", thx: "Gościniec znów jest bezpieczny. Należy ci się nagroda.", rew: { "xp": 150, "gold": 50, "items": [["pot", 4]] } },
        bwolves: { n: "Czarna wataha", giver: "gajowy", lvl: 5, kill: "bwolf", need: 8, area: "wolfhills", desc: "Ubij 8 czarnych wilków na Wilczych Wzgórzach.", offer: "Czarne wilki porywają owce z Osady. Ubij osiem, zanim zaczną atakować ludzi.", lock: "Wataha jest zbyt silna. Wróć na 5. poziomie.", mid: "Wilków ubitych: {c}/{n}.", thx: "Wataha się przerzedziła. Pasterze ci dziękują.", rew: { "xp": 220, "gold": 60, "items": [["pot", 3]] } },
        bearpaws: { n: "Łapy niedźwiedzia", giver: "gajowy", lvl: 7, item: "bearpaw", src: "bear", need: 4, area: "wolfhills", desc: "Przynieś 4 niedźwiedzie łapy od niedźwiedzi brunatnych.", offer: "Z niedźwiedzich łap robię maść na rany. Przynieś mi cztery.", lock: "Niedźwiedź rozszarpie cię w mig. Wróć na 7. poziomie.", mid: "Masz {c}/{n} łap.", thx: "Doskonale! Maść wystarczy na całą zimę. Weź mikstury.", rew: { "xp": 480, "gold": 80, "items": [["bigpot", 2]] } },
        kielq: { n: "Herszt Kieł", giver: "gajowy", req: "bandits", lvl: 8, kill: "kiel", need: 1, area: "wolfhills", desc: "Pokonaj Kła, Herszta Zbójców, w obozie na południowym wschodzie Wilczych Wzgórz.", offer: "Kieł dowodzi wszystkimi zbójami w okolicy. Pokonaj go, a wzgórza odetchną.", lock: "Kieł to doświadczony wojownik. Wróć na 8. poziomie.", mid: "Kieł wciąż rządzi w swoim obozie.", thx: "Kieł pokonany! Osada jest ci winna wdzięczność.", rew: { "xp": 1290, "gold": 240, "items": [["bigpot", 3]] } },
        kobolds: { n: "Kobold w każdym chodniku", giver: "borysl", lvl: 11, kill: "kobold", need: 10, area: "mine", desc: "Ubij 10 koboldów w Kopalni Krasnoludów (zachodni tunel Jaskini Cieni).", offer: "Koboldy zajęły nasze chodniki i kradną rudę. Wyrzuć dziesięciu.", lock: "Koboldy chodzą stadami. Wróć na 11. poziomie.", mid: "Koboldów ubitych: {c}/{n}.", thx: "Chodniki znów są nasze. Dzięki, przyjacielu.", rew: { "xp": 930, "gold": 150, "items": [["bigpot", 3]] } },
        crawlers: { n: "Kamienne pełzacze", giver: "borysl", lvl: 13, kill: "crawler", need: 8, area: "mine", desc: "Rozbij 8 kamiennych pełzaczy w kopalni.", offer: "Pełzacze drążą skałę i zawalają stropy. Rozbij ośmiu.", lock: "Pełzacze mają skorupy twarde jak granit. Wróć na 13. poziomie.", mid: "Pełzaczy rozbitych: {c}/{n}.", thx: "Stropy przestały się sypać. Bierz zapłatę.", rew: { "xp": 1280, "gold": 190, "items": [["bigpot", 3], ["mpot", 2]] } },
        runes: { n: "Runy przodków", giver: "borysl", lvl: 14, item: "dwarfr", src: "dghost", need: 5, area: "mine", desc: "Przynieś 5 krasnoludzkich run od duchów krasnoludów.", offer: "Duchy moich przodków noszą runy, które mogą je uspokoić. Przynieś pięć.", lock: "Duchy nie zniosą słabego. Wróć na 14. poziomie.", mid: "Masz {c}/{n} run.", thx: "Runy wróciły do rodu. Duchy wreszcie odpoczną.", rew: { "xp": 1750, "gold": 220, "items": [["elix", 2]] } },
        grimq: { n: "Duch Kopalni", giver: "borysl", req: "runes", lvl: 16, kill: "grimgor", need: 1, area: "mine", desc: "Pokonaj Grimgora, Ducha Kopalni, w najgłębszej sali na południowym zachodzie.", offer: "Grimgor był naszym starszym. Jego duch oszalał. Uwolnij go.", lock: "Grimgor jest potężny nawet po śmierci. Wróć na 16. poziomie.", mid: "Grimgor wciąż krąży po najgłębszej sali.", thx: "Grimgor zaznał spokoju. Ród Borysława nigdy cię nie zapomni.", rew: { "xp": 4790, "gold": 680, "items": [["elix", 3], ["relic", 1]] } },
        frwraiths: { n: "Upiory zamieci", giver: "szronka", lvl: 20, kill: "frwraith", need: 10, area: "glacier", desc: "Rozprosz 10 upiorów zamieci na Lodowcu Wichrów (północna przełęcz Szczytów Szronu).", offer: "Upiory zamieci zamrażają podróżnych. Rozprosz dziesięć.", lock: "Mróz zabije cię szybciej niż upiór. Wróć na 20. poziomie.", mid: "Upiorów rozproszonych: {c}/{n}.", thx: "Zamieć słabnie. Dobra robota.", rew: { "xp": 2880, "gold": 400, "items": [["elix", 3]] } },
        mtusks: { n: "Kły mamutów", giver: "szronka", lvl: 23, item: "mtusk", src: "mammoth", need: 5, area: "glacier", desc: "Przynieś 5 kłów mamuta od szronowych mamutów.", offer: "Kły mamutów są cenne jak złoto. Przynieś mi pięć.", lock: "Mamut stratuje cię bez trudu. Wróć na 23. poziomie.", mid: "Masz {c}/{n} kłów.", thx: "Piękne kły! Część zysku jest twoja.", rew: { "xp": 4290, "gold": 520, "items": [["elix", 3]] } },
        szroniaq: { n: "Królowa Lodu", giver: "szronka", req: "frwraiths", lvl: 26, kill: "szronia", need: 1, area: "glacier", desc: "Pokonaj Szronię, Królową Lodu, na lodowym tronie na północnym wschodzie.", offer: "Szronia zamroziła pół Ardanu. Roztop jej serce mieczem.", lock: "Szronia zamrozi cię jednym spojrzeniem. Wróć na 26. poziomie.", mid: "Szronia wciąż siedzi na lodowym tronie.", thx: "Lód pęka! Wiosna wraca na przełęcze.", rew: { "xp": 11090, "gold": 1620, "items": [["gpot", 3], ["relic", 1]] } },
        hyenas: { n: "Hieny stepowe", giver: "radzim", lvl: 25, kill: "hyena", need: 10, area: "steppe", desc: "Ubij 10 hien na Spalonych Stepach (północna droga z Ruin Piasków).", offer: "Hieny idą za koczownikami i dobijają rannych. Ubij dziesięć.", lock: "Stepy nie wybaczają słabości. Wróć na 25. poziomie.", mid: "Hien ubitych: {c}/{n}.", thx: "Hieny uciekły na wschód. Dziękuję.", rew: { "xp": 4160, "gold": 600, "items": [["elix", 3]] } },
        nomads: { n: "Łupieżcy Chana", giver: "radzim", lvl: 27, kill: "nomad", need: 8, area: "steppe", desc: "Pokonaj 8 koczowników-łupieżców.", offer: "Koczownicy Burzana palą osady. Rozpraw się z ośmioma.", lock: "Łupieżcy jeżdżą bandami. Wróć na 27. poziomie.", mid: "Łupieżców pokonanych: {c}/{n}.", thx: "Osady ocalały. Chan straci cierpliwość.", rew: { "xp": 4720, "gold": 700, "items": [["gpot", 2]] } },
        bscales: { n: "Łuski bazyliszka", giver: "radzim", lvl: 29, item: "bscale", src: "basil", need: 5, area: "steppe", desc: "Przynieś 5 łusek bazyliszka.", offer: "Łuski bazyliszka chronią przed ogniem. Przynieś mi pięć.", lock: "Spojrzenie bazyliszka paraliżuje. Wróć na 29. poziomie.", mid: "Masz {c}/{n} łusek.", thx: "Z tych łusek zrobimy tarcze dla zwiadowców.", rew: { "xp": 6290, "gold": 800, "items": [["gpot", 3]] } },
        burzanq: { n: "Chan Burzan", giver: "radzim", req: "nomads", lvl: 31, kill: "burzan", need: 1, area: "steppe", desc: "Pokonaj Chana Burzana w jego obozie na północnym wschodzie stepów.", offer: "Bez Chana koczownicy rozproszą się w tydzień. Pokonaj go.", lock: "Chan to najlepszy wojownik stepów. Wróć na 31. poziomie.", mid: "Chan wciąż rządzi z obozu.", thx: "Chan pokonany! Stepy mogą odrosnąć.", rew: { "xp": 15560, "gold": 2260, "items": [["gpot", 3], ["relic", 1]] } },
        delves: { n: "Mroczne elfy", giver: "iwa", lvl: 31, kill: "delf", need: 10, area: "elfwood", desc: "Pokonaj 10 mrocznych elfów w Szmaragdowej Puszczy (północ Spalonych Stepów).", offer: "Morana obróciła mój lud przeciwko nam. Pokonaj dziesięciu, może reszta się opamięta.", lock: "Elfy strzelają z ukrycia. Wróć na 31. poziomie.", mid: "Elfów pokonanych: {c}/{n}.", thx: "Część elfów rzuciła łuki. Jest nadzieja.", rew: { "xp": 6220, "gold": 900, "items": [["gpot", 3]] } },
        bark: { n: "Kora pradrzew", giver: "iwa", lvl: 33, item: "bark", src: "treant", need: 6, area: "elfwood", desc: "Przynieś 6 kawałków kory pradrzewa od pradrzewców.", offer: "Z kory pradrzew uwarzę lek na zarazę korzeni. Przynieś sześć.", lock: "Pradrzewce miażdżą skały. Wróć na 33. poziomie.", mid: "Masz {c}/{n} kawałków kory.", thx: "Lek gotowy. Puszcza zaczyna zdrowieć.", rew: { "xp": 8950, "gold": 1020, "items": [["gpot", 3]] } },
        wolfmen: { n: "Wilkołaki", giver: "iwa", lvl: 35, kill: "wwolf", need: 8, area: "elfwood", desc: "Ubij 8 wilkołaków w Szmaragdowej Puszczy.", offer: "Wilkołaki strzegą drogi do Morany. Ubij ośmiu.", lock: "Wilkołaki rozszarpią cię przy pełni. Wróć na 35. poziomie.", mid: "Wilkołaków ubitych: {c}/{n}.", thx: "Droga do Morany stoi otworem.", rew: { "xp": 9050, "gold": 1140, "items": [["gpot", 2], ["selix", 1]] } },
        moranaq: { n: "Driada Zagłady", giver: "iwa", req: "wolfmen", lvl: 37, kill: "morana", need: 1, area: "elfwood", desc: "Pokonaj Moranę, Driadę Zagłady, na polanie na północnym zachodzie puszczy.", offer: "Morana jest sercem zarazy. Pokonaj ją, a puszcza ożyje.", lock: "Morana włada samymi korzeniami świata. Wróć na 37. poziomie.", mid: "Morana wciąż truje korzenie.", thx: "Puszcza oddycha! Mój lud jest wolny.", rew: { "xp": 26790, "gold": 3180, "items": [["selix", 3], ["relic", 2]] } },
        nagas: { n: "Nagi z głębin", giver: "wawrzyn", lvl: 42, kill: "naga", need: 10, area: "sunken", desc: "Pokonaj 10 nag w Zatopionym Mieście (południowa droga z Wybrzeża Wraków).", offer: "Nagi wypływają na brzeg i porywają rybaków. Pokonaj dziesięć.", lock: "Nagi władają magią wody. Wróć na 42. poziomie.", mid: "Nag pokonanych: {c}/{n}.", thx: "Rybacy znów mogą łowić.", rew: { "xp": 15650, "gold": 1630, "items": [["selix", 2]] } },
        drowned: { n: "Utopieni rycerze", giver: "wawrzyn", lvl: 44, kill: "drowned", need: 8, area: "sunken", desc: "Pokonaj 8 utopionych rycerzy.", offer: "Rycerze dawnej stolicy wciąż jej strzegą, choć dawno utonęli. Uwolnij ośmiu.", lock: "Ich zbroje pamiętają setki bitew. Wróć na 44. poziomie.", mid: "Rycerzy pokonanych: {c}/{n}.", thx: "Ich dusze odpłynęły w spokoju.", rew: { "xp": 17960, "gold": 1780, "items": [["selix", 2]] } },
        corals: { n: "Czarny koral", giver: "wawrzyn", lvl: 46, item: "coral", src: "tentacle", need: 5, area: "sunken", desc: "Przynieś 5 czarnych korali od macek głębin.", offer: "Czarny koral rośnie tylko na mackach Krakena. Przynieś pięć.", lock: "Macki wciągną cię pod wodę. Wróć na 46. poziomie.", mid: "Masz {c}/{n} korali.", thx: "Z tego koralu zrobię amulety oddechu.", rew: { "xp": 24230, "gold": 1940, "items": [["selix", 3]] } },
        thalq: { n: "Kraken Głębin", giver: "wawrzyn", req: "drowned", lvl: 48, kill: "thalassor", need: 1, area: "sunken", desc: "Pokonaj Thalassora, Krakena Głębin, w zatopionej świątyni na południu.", offer: "Thalassor śpi w świątyni na dnie miasta. Obudź go i pokonaj.", lock: "Kraken zmiażdży cię mackami. Wróć na 48. poziomie.", mid: "Thalassor wciąż czai się w świątyni.", thx: "Kraken pokonany! Skarby stolicy są wolne.", rew: { "xp": 57930, "gold": 5280, "items": [["selix", 4], ["relic", 2]] } },
        cspiders: { n: "Pryzmatyczne pająki", giver: "astronom", lvl: 60, kill: "cspider", need: 10, area: "crystal", desc: "Ubij 10 pryzmatycznych pająków na Kryształowych Pustkowiach (wschodnia brama Strażnicy).", offer: "Pająki tkają sieci z kryształu i łapią moich zwiadowców. Ubij dziesięć.", lock: "Pustkowia to kraj dla legend. Wróć na 60. poziomie.", mid: "Pająków ubitych: {c}/{n}.", thx: "Moi zwiadowcy mogą wrócić do pracy.", rew: { "xp": 44060, "gold": 3280, "items": [["spot", 3]] } },
        starsh: { n: "Odłamki gwiazd", giver: "astronom", req: "cspiders", lvl: 62, item: "starsh", src: "starw", need: 6, area: "crystal", desc: "Przynieś 6 gwiezdnych odłamków od gwiezdnych strażników.", offer: "Strażnicy noszą odłamki spadłych gwiazd. Przynieś mi sześć, chcę zbadać ich moc.", lock: "Strażnicy gwiazd nie znają litości. Wróć na 62. poziomie.", mid: "Masz {c}/{n} odłamków.", thx: "Niezwykłe! Gwiazdy mówią o czymś wielkim na wschodzie.", rew: { "xp": 57280, "gold": 3500, "items": [["spot", 3]] } },
        kolosq: { n: "Lustrzany Kolos", giver: "astronom", req: "starsh", lvl: 65, kill: "kolos", need: 1, area: "crystal", desc: "Pokonaj Lustrzanego Kolosa na wschodnim krańcu Kryształowych Pustkowi.", offer: "Kolos odbija każdy cios i każde zaklęcie. Znajdź sposób, by go rozbić.", lock: "Kolos to góra żywego kryształu. Wróć na 65. poziomie.", mid: "Kolos wciąż stoi na straży.", thx: "Kolos rozbity w drobny mak! Strażnica jest ci wdzięczna.", rew: { "xp": 138280, "gold": 9610, "items": [["spot", 4], ["relic", 3]] } },
        bmages: { n: "Kościani magowie", giver: "inkwiz", lvl: 66, kill: "bmage", need: 10, area: "necro", desc: "Pokonaj 10 kościanych magów w Nekropolii Valgaru (południowa brama Strażnicy).", offer: "Kościani magowie wskrzeszają poległych. Zniszcz dziesięciu.", lock: "Nekropolia pożre słabego. Wróć na 66. poziomie.", mid: "Magów pokonanych: {c}/{n}.", thx: "Martwi przestali wstawać. Dobrze.", rew: { "xp": 57750, "gold": 3960, "items": [["spot", 3]] } },
        souls: { n: "Klejnoty dusz", giver: "inkwiz", lvl: 68, item: "soulg", src: "specter", need: 6, area: "necro", desc: "Przynieś 6 klejnotów duszy od upiornych zjaw.", offer: "Zjawy więzią dusze w klejnotach. Przynieś sześć, uwolnię je.", lock: "Zjawy wysysają życie. Wróć na 68. poziomie.", mid: "Masz {c}/{n} klejnotów.", thx: "Dusze są wolne. Valgar traci siłę.", rew: { "xp": 74410, "gold": 4200, "items": [["spot", 3]] } },
        bdrakes: { n: "Kościane smoki", giver: "inkwiz", req: "bmages", lvl: 70, kill: "bdrake", need: 6, area: "necro", desc: "Zniszcz 6 kościanych smoków w Nekropolii.", offer: "Valgar wskrzesił smoki z dawnych wojen. Zniszcz sześć.", lock: "Kościany smok to wciąż smok. Wróć na 70. poziomie.", mid: "Smoków zniszczonych: {c}/{n}.", thx: "Niebo nad Nekropolią jest czyste.", rew: { "xp": 68190, "gold": 4450, "items": [["dpot", 2]] } },
        valgarq: { n: "Lisz Nekropolii", giver: "inkwiz", req: "bdrakes", lvl: 71, kill: "valgar", need: 1, area: "necro", desc: "Pokonaj Valgara, Lisza Nekropolii, w krypcie na południowym zachodzie.", offer: "Valgar ukrył swoją duszę w koronie. Pokonaj go i zabierz ją.", lock: "Valgar to mistrz śmierci. Wróć na 71. poziomie.", mid: "Valgar wciąż rządzi w krypcie.", thx: "Lisz upadł! Korona Valgara już nikogo nie wskrzesi.", rew: { "xp": 177420, "gold": 11440, "items": [["dpot", 4], ["relic", 3]] } },
        drakons: { n: "Ogniste drakony", giver: "smokobojca", lvl: 72, kill: "drakon", need: 10, area: "dragon", desc: "Ubij 10 ognistych drakonów w Smoczym Gnieździe (wschodnie wyjście z Nekropolii).", offer: "Drakony to młode Valdraka. Ubij dziesięć, zanim urosną.", lock: "Ogień drakonów topi stal. Wróć na 72. poziomie.", mid: "Drakonów ubitych: {c}/{n}.", thx: "Gniazdo się przerzedziło. Valdrak będzie wściekły.", rew: { "xp": 73810, "gold": 4710, "items": [["dpot", 3]] } },
        dkins: { n: "Smoczy kultyści", giver: "smokobojca", lvl: 74, kill: "dkin", need: 8, area: "dragon", desc: "Pokonaj 8 smoczych kultystów.", offer: "Kultyści karmią Valdraka i strzegą jego legowiska. Pokonaj ośmiu.", lock: "Kultyści władają smoczym ogniem. Wróć na 74. poziomie.", mid: "Kultystów pokonanych: {c}/{n}.", thx: "Kult rozbity. Droga do Valdraka stoi otworem.", rew: { "xp": 79720, "gold": 4970, "items": [["dpot", 3]] } },
        dscales: { n: "Łuski wyrmów", giver: "smokobojca", lvl: 76, item: "dscale", src: "wyrm", need: 5, area: "dragon", desc: "Przynieś 5 łusek ognistego wyrma od lawowych wyrmów.", offer: "Z łusek wyrmów wykuję pancerz, który zniesie oddech Valdraka. Przynieś pięć.", lock: "Wyrmy pływają w lawie. Wróć na 76. poziomie.", mid: "Masz {c}/{n} łusek.", thx: "Pancerz będzie gotowy na czas. Teraz twój ruch.", rew: { "xp": 101730, "gold": 5240, "items": [["dpot", 3]] } },
        valdrakq: { n: "Pradawny Smok", giver: "smokobojca", req: "dscales", lvl: 77, kill: "valdrak", need: 1, area: "dragon", desc: "Pokonaj Valdraka, Pradawnego Smoka, na szczycie gniazda na wschodzie.", offer: "Valdrak był stary, gdy Ardan był młody. Pokonaj go i zostań legendą.", lock: "Valdrak to najpotężniejsza istota świata. Wróć na 77. poziomie.", mid: "Valdrak wciąż śpi na swoim złocie.", thx: "Pradawny Smok pokonany! Twoje imię zapisze się w Kronice Ardanu na zawsze.", rew: { "xp": 222780, "gold": 13440, "items": [["dpot", 5], ["relic", 5]] } },
    };
    // ---------- CLASSES ----------
    const CLS = {
        war: { n: "Wojownik", hp0: 62, hpL: 18, atk0: 5, atkL: 2, defL: 1.3, rng: 1, cd: 0.75, crit: 0.12, dodge: 0.08, res: "Energia", rc: "#e8a33a", mp0: 100, mpL: 0, reg: 7,
            look: { body: "#8a3a2e", skin: "#f0c9a0", hair: "#3a2414", helmet: true }, wk: "sw",
            desc: "Mistrz walki wręcz. Najwięcej życia i obrony, nosi ciężkie zbroje.", st: [5, 3, 5, 1] },
        arc: { n: "Łucznik", hp0: 52, hpL: 14, atk0: 4, atkL: 2.1, defL: 0.95, rng: 6, cd: 0.85, crit: 0.2, dodge: 0.13, res: "Energia", rc: "#e8a33a", mp0: 100, mpL: 0, reg: 7,
            look: { body: "#3f7a3a", skin: "#f0c9a0", hair: "#8a5a2a", hood: true }, wk: "bow",
            desc: "Razi wrogów strzałami z daleka. Częste trafienia krytyczne i uniki.", st: [3, 4, 3, 5] },
        mag: { n: "Mag", hp0: 44, hpL: 11.5, atk0: 6, atkL: 2.4, defL: 0.7, rng: 6, cd: 0.95, crit: 0.1, dodge: 0.08, res: "Mana", rc: "#4a8aff", mp0: 70, mpL: 9, reg: 2.6,
            look: { body: "#4a3a8a", skin: "#f0c9a0", hair: "#d8d8e8", robe: true, wiz: true }, wk: "staff",
            desc: "Ciska zaklęciami zużywającymi manę. Najsilniejsze ataki, ale wątłe ciało.", st: [2, 5, 2, 5] },
    };
    const CLSORDER = ["war", "arc", "mag"];
    const SK = {
        war: [
            { n: "Potężny cios", lvl: 1, cost: 25, cd: 5, ic: "smash", d: "Cios za 220% obrażeń, ogłusza na 1 s." },
            { n: "Wir ostrzy", lvl: 3, cost: 35, cd: 9, ic: "whirl", d: "Rani wszystkich wrogów wokół (160%)." },
            { n: "Okrzyk bojowy", lvl: 5, cost: 40, cd: 22, ic: "shout", d: "Leczy 25% życia, +60% obrony na 8 s." }
        ],
        arc: [
            { n: "Celny strzał", lvl: 1, cost: 25, cd: 6, ic: "aim", d: "Strzała za 260% obrażeń, zasięg 8." },
            { n: "Deszcz strzał", lvl: 3, cost: 40, cd: 10, ic: "rain", d: "Grad strzał na obszar wokół celu (130%)." },
            { n: "Sokole oko", lvl: 5, cost: 35, cd: 20, ic: "eye", d: "Szybsze strzały i +25% kryt. przez 7 s." }
        ],
        mag: [
            { n: "Kula ognia", lvl: 1, cost: 18, cd: 4, ic: "fire", d: "Ognista kula za 240%, rani też sąsiadów." },
            { n: "Nova mrozu", lvl: 3, cost: 30, cd: 10, ic: "frost", d: "Lodowy wybuch wokół (130%), zamraża 2,5 s." },
            { n: "Odnowa", lvl: 5, cost: 35, cd: 16, ic: "heal", d: "Przywraca 40% życia." }
        ],
    };
    const MAXLVL = 80;
    const SKX = {
        war: [
            { n: "Szarża tytana", lvl: 15, cost: 45, cd: 3, ic: "smash", d: "Cios za 300% obrażeń, ogłusza (bossa rzadziej)." },
            { n: "Krwawy wir", lvl: 30, cost: 55, cd: 4, ic: "whirl", d: "Rani wszystkich wrogów za 200% i wywołuje krwawienie." },
            { n: "Gniew bogów", lvl: 45, cost: 70, cd: 6, ic: "shout", d: "Cios za 350%, leczy 30% życia i wzmacnia obronę." }
        ],
        arc: [
            { n: "Strzała przebijająca", lvl: 15, cost: 40, cd: 3, ic: "aim", d: "Przebija wszystkich wrogów, każdy dostaje 190%." },
            { n: "Salwa burzy", lvl: 30, cost: 55, cd: 4, ic: "rain", d: "5 strzał w losowe cele, każda za 130%." },
            { n: "Strzała zagłady", lvl: 45, cost: 70, cd: 6, ic: "eye", d: "Pewny cios krytyczny za 420% obrażeń." }
        ],
        mag: [
            { n: "Łańcuch błyskawic", lvl: 15, cost: 40, cd: 3, ic: "frost", d: "Błyskawica skacze po wszystkich wrogach (190%)." },
            { n: "Meteor", lvl: 30, cost: 60, cd: 4, ic: "fire", d: "Meteor za 380% w cel i 150% w pozostałych, podpala." },
            { n: "Zatrzymanie czasu", lvl: 45, cost: 75, cd: 6, ic: "frost", d: "Zamraża wrogów (poza bossami), rani za 220% i leczy 35%." }
        ],
    };
    // ---------- STATE ----------
    const SAVE_KEY = "ardan_kroniki_mgiel_v2", OLD_KEY = "ardan_kroniki_mgiel_v1";
    const fresh = () => ({ v: 2, cls: "", lvl: 1, xp: 0, hp: 60, mp: 100, gold: 20, area: "village", x: 18, y: 17, inv: [{ id: "pot", n: 3 }], eq: { w: null, a: "shirt" }, q: {}, kills: 0, intro: false, track: "", seen: { village: 1 }, mmz: 1 });
    let P = fresh();
    let migrated = false;
    if (SRV || NET)
        P = Object.assign(fresh(), (SRV || NET).state || {});
    else
        try {
            const ls = window.localStorage;
            const s = ls ? ls.getItem(SAVE_KEY) : null;
            if (s) {
                const o = JSON.parse(s);
                if (o && o.lvl && AREAS[o.area])
                    P = Object.assign(fresh(), o);
            }
            else {
                const s1 = ls ? ls.getItem(OLD_KEY) : null;
                if (s1) {
                    const o = JSON.parse(s1);
                    if (o && o.lvl && AREAS[o.area]) {
                        P = Object.assign(fresh(), o);
                        P.cls = "";
                        P.v = 2;
                        migrated = true;
                        P.seen = { village: 1 };
                        P.seen[P.area] = 1;
                    }
                }
            }
        }
        catch (e) { /* no storage */ }
    if (!Array.isArray(P.inv))
        P.inv = [];
    P.inv = P.inv.filter((s) => s && ITEMS[s.id] && s.n > 0);
    if (!P.eq || typeof P.eq !== "object")
        P.eq = { w: null, a: null };
    if (P.eq.w && !ITEMS[P.eq.w])
        P.eq.w = null;
    if (P.eq.a && !ITEMS[P.eq.a])
        P.eq.a = null;
    if (!P.q || typeof P.q !== "object")
        P.q = {};
    if (!P.seen)
        P.seen = {};
    P.seen[P.area] = 1;
    if (P.cls && !CLS[P.cls])
        P.cls = "";
    P.lvl = clamp(Math.floor(P.lvl) || 1, 1, MAXLVL);
    if (solidT(AREAS[P.area], P.x, P.y)) {
        const a0 = AREAS[P.area];
        let done = false;
        for (let r = 1; r < 12 && !done; r++)
            for (let dy = -r; dy <= r && !done; dy++)
                for (let dx = -r; dx <= r && !done; dx++) {
                    if (!solidT(a0, P.x + dx, P.y + dy)) {
                        P.x += dx;
                        P.y += dy;
                        done = true;
                    }
                }
    }
    let lastSave = 0;
    function save() { if (SRV) {
        SRV.dirty = true;
        return;
    } if (NET)
        return; try {
        window.localStorage.setItem(SAVE_KEY, JSON.stringify(P));
    }
    catch (e) { /* ignore */ } }
    const pl = { fx: P.x, fy: P.y, mt: 1, dir: 0, phase: 0, cd: 0, anim: 0, hit: 0, path: [], target: null, talk: null, repath: 0, dead: 0,
        skcd: [0, 0, 0], buffDef: 0, haste: 0, combat: 0, nomp: 0, resp: ["village", 18, 17] };
    const C = () => CLS[P.cls || "war"];
    const xpNext = (l) => Math.floor(40 * Math.pow(l, 1.65) * (1 + Math.min(0.35, Math.max(0, l - 4) * 0.025)) * (l > 30 ? 1 + (l - 30) * 0.05 : 1));
    const GEARON = () => !!(P.gear && typeof P.gear === "object");
    const gs = (k) => { let s0 = 0; const g = P.gear; if (g)
        for (const sl of Object.keys(g)) {
            const it = g[sl];
            if (it && it.st && it.d !== 0 && typeof it.st[k] === "number")
                s0 += it.st[k];
        } return s0; };
    const maxHp = () => Math.round(C().hp0 + (P.lvl - 1) * C().hpL + (GEARON() ? gs("hp") : (P.eq.a ? ITEMS[P.eq.a].def * 2 : 0)));
    const maxMp = () => Math.round(C().mp0 + (P.lvl - 1) * C().mpL + (GEARON() ? gs("mp") : (P.eq.a && ITEMS[P.eq.a].mp ? ITEMS[P.eq.a].mp : 0)));
    const atk = () => Math.round(C().atk0 + P.lvl * C().atkL + (GEARON() ? gs("atk") : (P.eq.w ? ITEMS[P.eq.w].atk : 0)));
    const def = () => Math.round((P.lvl * C().defL + (GEARON() ? gs("def") : (P.eq.a ? ITEMS[P.eq.a].def : 0))) * (pl.buffDef > 0 ? 1.6 : 1));
    const critC = () => C().crit + (GEARON() ? gs("crit") / 100 : 0);
    const dodgeC = () => C().dodge + (GEARON() ? gs("dodge") / 100 : 0);
    const statsAll = () => ({ atk: atk(), def: def(), hp: maxHp(), mp: maxMp(), crit: Math.round(critC() * 100), dodge: Math.round(dodgeC() * 100), res: C().res });
    const canUse = (id) => { const it = ITEMS[id]; return !it.cls || !P.cls || it.cls.split(" ").indexOf(P.cls) >= 0; };
    const resolve = (id) => { if (id.charAt(0) !== "$")
        return id; const g = GEAR[P.cls || "war"]; return g[id.charAt(1)][Number(id.charAt(2)) - 1]; };
    if (P.cls) {
        P.hp = Math.min(P.hp, maxHp());
        P.mp = Math.min(typeof P.mp === "number" ? P.mp : maxMp(), maxMp());
    }
    const mobs = SRV && SRV.mobs ? SRV.mobs : {};
    Object.keys(AREAS).forEach((k) => {
        if (mobs[k])
            return;
        mobs[k] = AREAS[k].spawns.map((s) => {
            const d = MON[s[0]];
            return { k: s[0], d, x: s[1], y: s[2], fx: s[1], fy: s[2], hx: s[1], hy: s[2], mt: 1, hp: d.hp, dead: false, rt: 0, cd: 1, wt: R() * 3, aggro: false, hit: 0, dir: 0, anim: 0, frz: 0, sl: d.slam || 0 };
        });
    });
    const bags = [];
    const fx = [];
    const msgs = [];
    const shots = [];
    const warns = [];
    const pend = [];
    let time = 0;
    let banner = 3.5;
    let trans = null;
    let panel = "";
    let dlg = null;
    let shopId = "", shopTab = "buy", sellPage = 0, invSel = -1, resetArm = 0;
    let selCls = "war", mapTab = "area", qPage = 0;
    let guide = null, guideT = 0;
    let touchMode = typeof window !== "undefined" && (("ontouchstart" in window) || (!!window.matchMedia && window.matchMedia("(pointer: coarse)").matches));
    let clickMark = null;
    const keys = {};
    const actQ = [];
    const act = (a) => { if (actQ.length < 16)
        actQ.push(a); };
    let extDir = null; // external direction source (tests / replay / network)
    // on-screen arrow d-pad: each touching pointer holds a direction (multi-touch sums them)
    const pad = { cx: 0, cy: 0, s: 46, ptr: {} };
    let W = 300, H = 300, S = 1, camX = 0, camY = 0, dpr = 1;
    let ui = [];
    let hover = null;
    let mouse = null;
    const isTouch = typeof window !== "undefined" && ("ontouchstart" in window || (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0));
    if (isTouch)
        touchMode = true;
    const A = () => AREAS[P.area];
    const log = (t, c) => { msgs.push({ t, c: c || "#efe6d2", life: 9 }); if (msgs.length > 6)
        msgs.shift(); };
    const ftext = (x, y, t, c, size) => { fx.push({ k: "txt", x, y, t, c, life: 1.1, max: 1.1, s: size || 14 }); };
    const burst = (x, y, c, n, sp) => {
        if (SRV) {
            fx.push({ k: "burst", x, y, c, n, sp });
            return;
        }
        for (let i = 0; i < n; i++) {
            const an = R() * Math.PI * 2, v = (sp || 60) * (0.4 + R());
            fx.push({ k: "p", x, y, vx: Math.cos(an) * v, vy: Math.sin(an) * v - 20, c, life: 0.5 + R() * 0.5, max: 1 });
        }
    };
    const rpos = (e) => [(e.fx + (e.x - e.fx) * e.mt) * TS, (e.fy + (e.y - e.fy) * e.mt) * TS];
    const pl2 = () => ({ fx: pl.fx, fy: pl.fy, x: P.x, y: P.y, mt: pl.mt });
    function pickClass(c) {
        P.cls = c;
        const conv = (id) => {
            for (const sl of ["w", "a"]) {
                const i = GEAR.war[sl].indexOf(id);
                if (i >= 0 && !canUse(id))
                    return GEAR[c][sl][i];
            }
            return id;
        };
        if (migrated) {
            P.eq.w = P.eq.w ? conv(P.eq.w) : GEAR[c].w[0];
            P.eq.a = P.eq.a ? conv(P.eq.a) : null;
            P.inv.forEach((s) => { s.id = conv(s.id); });
            log("Przeniesiono postać z poprzedniej wersji gry.", "#f5d98a");
            migrated = false;
        }
        else
            P.eq.w = GEAR[c].w[0];
        P.hp = maxHp();
        P.mp = maxMp();
        banner = 3;
        panel = "";
        dlg = null;
        pl.skcd = [0, 0, 0];
        log("Wybrano klasę: " + CLS[c].n + ".", "#f5d98a");
        save();
    }
    function countItem(id) { let n = 0; for (const s of P.inv)
        if (s.id === id)
            n += s.n; return n; }
    function addItem(id, n) {
        const it = ITEMS[id];
        const stack = it.t === "p" || it.t === "j" || it.t === "q";
        if (stack) {
            const s = P.inv.find((x) => x.id === id);
            if (s) {
                s.n += n;
                return true;
            }
        }
        if (P.inv.length >= 20) {
            log("Torba jest pełna!", "#ff8a7a");
            return false;
        }
        if (stack)
            P.inv.push({ id, n });
        else
            for (let i = 0; i < n; i++) {
                if (P.inv.length >= 20)
                    return false;
                P.inv.push({ id, n: 1 });
            }
        return true;
    }
    function removeItem(id, n) {
        for (let i = P.inv.length - 1; i >= 0 && n > 0; i--) {
            const s = P.inv[i];
            if (s.id !== id)
                continue;
            const k = Math.min(n, s.n);
            s.n -= k;
            n -= k;
            if (s.n <= 0)
                P.inv.splice(i, 1);
        }
    }
    // ---------- QUESTS ----------
    const reqDone = (q) => !q.req || (P.q[q.req] && P.q[q.req].s === "done");
    const qAvail = (id) => { const q = QUESTS[id]; return !P.q[id] && reqDone(q) && P.lvl >= (q.lvl || 1); };
    const qLocked = (id) => { const q = QUESTS[id]; return !P.q[id] && reqDone(q) && P.lvl < (q.lvl || 1); };
    const qProg = (id) => { const q = QUESTS[id], s = P.q[id]; if (!s)
        return 0; if (q.talkq)
        return q.need; return Math.min(q.need, q.item ? countItem(q.item) : s.c); };
    const qReady = (id) => { const s = P.q[id]; return !!s && s.s === "active" && qProg(id) >= QUESTS[id].need; };
    const qTo = (id) => QUESTS[id].to || QUESTS[id].giver;
    function npcMark(id) {
        let m = "";
        for (const q of QORDER) {
            if (qTo(q) === id && qReady(q))
                return "?";
            if (QUESTS[q].giver !== id)
                continue;
            if (qAvail(q))
                m = "!";
            else if (!m && P.q[q] && P.q[q].s === "active")
                m = "…";
        }
        return m;
    }
    function completeQuest(id) {
        const q = QUESTS[id];
        if (q.item)
            removeItem(q.item, q.need);
        if (q.give)
            removeItem(q.give, 1);
        P.q[id].s = "done";
        P.gold += q.rew.gold;
        const its = q.rew.items.map((i) => [resolve(i[0]), i[1]]);
        for (const it of its)
            addItem(it[0], it[1]);
        log("Ukończono zadanie: " + q.n, "#f5d98a");
        log("Nagroda: " + q.rew.xp + " PD, " + q.rew.gold + " zł" + its.map((i) => ", " + ITEMS[i[0]].n + (i[1] > 1 ? " x" + i[1] : "")).join(""), "#f5d98a");
        const p = rpos(pl2());
        burst(p[0] + 16, p[1] + 10, "#f5d98a", 24, 80);
        if (P.track === id)
            P.track = "";
        guideT = 0;
        gainXp(q.rew.xp);
        save();
    }
    let uiReq = "";
    function talk(id) {
        const n = NPCS[id];
        pl.talk = null;
        pl.target = null;
        pl.path = [];
        const extra = [];
        if (n.shop)
            extra.push({ l: "Pokaż towary", fn: () => { dlg = null; panel = "shop"; shopId = n.shop; shopTab = "buy"; sellPage = 0; } });
        if (n.trade)
            extra.push({ l: n.trade === "aukcja" ? "Otwórz dom aukcyjny" : "Sprzedaj przedmioty", fn: () => { dlg = null; uiReq = n.trade + ":" + id; } });
        if (n.rep)
            extra.push({ l: "Napraw ekwipunek", fn: () => { dlg = null; uiReq = "naprawa:" + id; } });
        if (n.heal)
            extra.push({ l: n.heal, fn: () => { P.hp = maxHp(); P.mp = maxMp(); dlg = { name: n.n, text: "Czujesz, jak siły wracają. Zdrowie i " + C().res.toLowerCase() + " zostały w pełni przywrócone.", opts: [{ l: "Dziękuję", fn: () => { dlg = null; } }] }; const p = rpos(pl2()); burst(p[0] + 16, p[1] + 14, "#7dff8a", 18, 50); } });
        const bye = { l: "Do widzenia", fn: () => { dlg = null; } };
        for (const qid of QORDER) {
            const q = QUESTS[qid];
            if (qTo(qid) !== id)
                continue;
            if (qReady(qid)) {
                dlg = { name: n.n, text: q.thx, opts: [{ l: "Odbierz nagrodę", fn: () => { dlg = null; completeQuest(qid); } }] };
                return;
            }
        }
        for (const qid of QORDER) {
            const q = QUESTS[qid];
            if (q.giver !== id)
                continue;
            if (qAvail(qid)) {
                dlg = { name: n.n, text: q.offer, opts: [{ l: "Przyjmuję zadanie", fn: () => {
                                P.q[qid] = { s: "active", c: 0 };
                                if (q.give)
                                    addItem(q.give, 1);
                                P.track = qid;
                                guideT = 0;
                                dlg = null;
                                log("Nowe zadanie: " + q.n + " (śledzone – idź za złotą strzałką)", "#9fd3ff");
                                save();
                            } }, { l: "Nie teraz", fn: () => { dlg = null; } }] };
                return;
            }
        }
        for (const qid of QORDER) {
            const q = QUESTS[qid];
            if (q.giver !== id)
                continue;
            if (P.q[qid] && P.q[qid].s === "active") {
                dlg = { name: n.n, text: q.mid.replace("{c}", String(qProg(qid))).replace("{n}", String(q.need)), opts: extra.concat([bye]) };
                return;
            }
            if (qLocked(qid)) {
                dlg = { name: n.n, text: q.lock, opts: extra.concat([bye]) };
                return;
            }
        }
        dlg = { name: n.n, text: n.talk, opts: extra.concat([bye]) };
    }
    // ---------- GUIDANCE ----------
    function questObj(id) {
        const q = QUESTS[id], s = P.q[id];
        if (!s || s.s === "done")
            return null;
        if (qReady(id)) {
            const n = NPCS[qTo(id)];
            return { area: n.area, x: n.x, y: n.y, t: (q.talkq ? "Zanieś list: " : "Oddaj: ") + n.n, kind: "npc" };
        }
        const kind = q.kill || q.src;
        if (!kind)
            return null;
        const verb = q.kill ? "Ubij: " : "Zdobądź z: ";
        if (P.area === q.area) {
            let best = null, bd = 1e9;
            for (const m of mobs[P.area])
                if (!m.dead && m.k === kind) {
                    const d = cheb(m.x, m.y, P.x, P.y);
                    if (d < bd) {
                        bd = d;
                        best = m;
                    }
                }
            if (best)
                return { area: q.area, x: best.x, y: best.y, t: verb + MON[kind].n, kind: "mob", m: best };
            for (const m of mobs[P.area])
                if (m.k === kind)
                    return { area: q.area, x: m.hx, y: m.hy, t: MON[kind].n + " (odradza się)", kind: "spawn" };
        }
        const sp = AREAS[q.area].spawns.find((s2) => s2[0] === kind);
        return { area: q.area, x: sp ? sp[1] : 1, y: sp ? sp[2] : 1, t: verb + MON[kind].n, kind: "spawn" };
    }
    function activeQuests() { return QORDER.filter((q) => P.q[q] && P.q[q].s === "active"); }
    function curObj() {
        let id = P.track;
        if (!id || !P.q[id] || P.q[id].s !== "active") {
            const act = activeQuests();
            id = act.find((q) => qReady(q)) || act.find((q) => QUESTS[q].area === P.area) || act[0] || "";
            P.track = id;
        }
        if (id) {
            const o = questObj(id);
            if (o) {
                o.q = id;
                return o;
            }
        }
        let pick = null;
        for (const qid of QORDER)
            if (qAvail(qid)) {
                const n = NPCS[QUESTS[qid].giver];
                if (!pick || (n.area === P.area && pick.area !== P.area))
                    pick = { area: n.area, x: n.x, y: n.y, t: "Nowe zadanie: " + n.n, kind: "npc", q: "" };
            }
        return pick;
    }
    function gpath(sx, sy, tx, ty, near) {
        const a = A();
        const Wd = a.w;
        if (cheb(sx, sy, tx, ty) <= near)
            return [];
        const prev = new Int32Array(a.w * a.h).fill(-1);
        const s0 = sy * Wd + sx;
        prev[s0] = s0;
        const q = [s0];
        let qi = 0;
        const D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        while (qi < q.length) {
            const c = q[qi++];
            const cx = c % Wd, cy = (c - cx) / Wd;
            for (const d of D) {
                const nx = cx + d[0], ny = cy + d[1];
                if (nx < 0 || ny < 0 || nx >= a.w || ny >= a.h)
                    continue;
                const k = ny * Wd + nx;
                if (prev[k] !== -1)
                    continue;
                const goal = near ? cheb(nx, ny, tx, ty) <= near : nx === tx && ny === ty;
                if (!goal && (solidT(a, nx, ny) || npcAt(nx, ny) || decorAt(nx, ny)))
                    continue;
                prev[k] = c;
                if (goal) {
                    const path = [];
                    let p = k;
                    while (p !== s0) {
                        const px = p % Wd;
                        path.unshift([px, (p - px) / Wd]);
                        p = prev[p];
                    }
                    return path;
                }
                q.push(k);
            }
        }
        return null;
    }
    function updateGuide(dt) {
        guideT -= dt;
        if (guideT > 0) {
            if (guide && guide.o.m && !guide.o.m.dead && guide.o.area === P.area) {
                guide.x = guide.o.m.x;
                guide.y = guide.o.m.y;
            }
            return;
        }
        guideT = 0.45;
        const o = curObj();
        if (!o) {
            guide = null;
            return;
        }
        let gx = o.x, gy = o.y, via = "", near = o.kind === "npc" || o.kind === "mob" ? 1 : 0;
        if (o.area !== P.area) {
            const nx = routeNext(P.area, o.area);
            if (!nx) {
                guide = null;
                return;
            }
            let be = null, bd = 1e9;
            for (const e of GRAPH[P.area][nx]) {
                const d = cheb(e.x, e.y, P.x, P.y);
                if (d < bd) {
                    bd = d;
                    be = e;
                }
            }
            gx = be.x;
            gy = be.y;
            via = nx;
            near = 0;
        }
        else if (o.kind === "spawn")
            near = 2;
        const path = gpath(P.x, P.y, gx, gy, near);
        guide = { o, x: gx, y: gy, via, path, near, dist: path ? path.length : cheb(gx, gy, P.x, P.y) };
    }
    function guideDir() {
        if (!guide)
            return null;
        const pp = rpos(pl2());
        let tx = guide.x * TS + 16, ty = guide.y * TS + 16;
        if (guide.path && guide.path.length > 1) {
            const n = guide.path[Math.min(guide.path.length - 1, 3)];
            tx = n[0] * TS + 16;
            ty = n[1] * TS + 16;
        }
        const dx = tx - (pp[0] + 16), dy = ty - (pp[1] + 16), d = Math.hypot(dx, dy);
        if (d < 1)
            return null;
        return [dx / d, dy / d];
    }
    // ---------- COMBAT ----------
    function gainXp(n) {
        if (P.lvl >= MAXLVL)
            return;
        P.xp += n;
        const p = rpos(pl2());
        ftext(p[0] + 16, p[1] - 6, "+" + n + " PD", "#9fd3ff", 13);
        while (P.lvl < MAXLVL && P.xp >= xpNext(P.lvl)) {
            P.xp -= xpNext(P.lvl);
            P.lvl++;
            P.hp = maxHp();
            P.mp = maxMp();
            log("AWANS! Osiągasz poziom " + P.lvl + ".", "#ffd25a");
            for (const s of (SK[P.cls] || []).concat(SKX[P.cls] || []))
                if (s.lvl === P.lvl)
                    log("Nowa umiejętność: " + s.n + "!", "#ffd25a");
            fx.push({ k: "ring", x: p[0] + 16, y: p[1] + 18, life: 1.2, max: 1.2 });
            fx.push({ k: "big", t: "AWANS! Poziom " + P.lvl, life: 2.4, max: 2.4 });
            burst(p[0] + 16, p[1] + 16, "#ffd25a", 40, 110);
            guideT = 0;
            save();
        }
        if (P.lvl >= MAXLVL)
            P.xp = 0;
    }
    function dmgCalc(a, d) { return Math.max(1, Math.round(a * (0.85 + R() * 0.3) - d * 0.6)); }
    function losT(ax, ay, bx, by) {
        const a = A();
        let ok = true;
        line4(ax, ay, bx, by, (x, y) => { if ((x !== ax || y !== ay) && (x !== bx || y !== by) && TALL[gt(a, x, y)])
            ok = false; });
        return ok;
    }
    const inRange = (m, r) => cheb(m.x, m.y, P.x, P.y) <= r && (r <= 1 || losT(P.x, P.y, m.x, m.y));
    function applyHit(m, d, crit, o) {
        if (m.dead)
            return;
        if (SRV && (!m.aggro || !m.own))
            m.own = SRV.id;
        m.hp -= d;
        m.hit = 0.15;
        m.aggro = true;
        pl.combat = 6;
        if (o && o.frz)
            m.frz = Math.max(m.frz || 0, o.frz);
        const p = rpos(m);
        ftext(p[0] + 16, p[1] - 2, (crit ? "KRYT! " : "") + d, crit ? "#ffd25a" : (o && o.col) || "#ffffff", crit || (o && o.big) ? 17 : 14);
        burst(p[0] + 16, p[1] + 16, LIGHTB.indexOf(m.k) >= 0 ? "#e8e4ff" : "#d8443a", 6, 50);
        if (m.hp <= 0)
            killMob(m);
    }
    function shoot(m, d, crit, kind, o) {
        const p = rpos(pl2());
        shots.push({ area: P.area, x: p[0] + 16, y: p[1] + 14, m, d, crit, kind, o: o || {}, sp: kind === "fire" ? 320 : kind === "bolt" ? 380 : 460, life: 2.5, ang: 0 });
    }
    function playerAttack(m) {
        if (pl.cd > 0 || m.dead)
            return;
        const cl = P.cls || "war";
        if (cl === "mag") {
            if (P.mp < 2) {
                if (pl.nomp <= 0) {
                    log("Brak many! Wypij miksturę many (G) albo odczekaj chwilę.", "#9fb8ff");
                    pl.nomp = 4;
                }
                pl.cd = 0.4;
                return;
            }
            P.mp -= 2;
        }
        pl.cd = C().cd / (pl.haste > 0 ? 1.8 : 1);
        pl.anim = 0.18;
        pl.combat = 6;
        face(pl, m.x - P.x, m.y - P.y);
        const crit = R() < C().crit + (pl.haste > 0 ? 0.25 : 0);
        let d = dmgCalc(atk(), m.d.def);
        if (crit)
            d = Math.round(d * 1.7);
        if (cl === "war")
            applyHit(m, d, crit, null);
        else
            shoot(m, d, crit, cl === "arc" ? "arrow" : "bolt", {});
    }
    function killMob(m) {
        m.dead = true;
        m.rt = m.d.resp;
        m.frz = 0;
        if (pl.target === m)
            pl.target = null;
        const p = rpos(m);
        burst(p[0] + 16, p[1] + 16, m.d.boss ? "#c58cff" : "#bbbbbb", m.d.boss ? 50 : 14, m.d.boss ? 120 : 60);
        log("Pokonano: " + m.d.n + ".", "#c8e6a0");
        if (m.d.boss)
            fx.push({ k: "big", t: "Pokonano: " + m.d.n + "!", life: 2.6, max: 2.6 });
        P.kills++;
        for (const qid of QORDER) {
            const q = QUESTS[qid], s = P.q[qid];
            if (s && s.s === "active" && q.kill === m.k) {
                s.c++;
                if (s.c <= q.need)
                    log(q.n + ": " + s.c + "/" + q.need, "#9fd3ff");
                if (s.c === q.need)
                    log("Cel osiągnięty! Strzałka wskaże, komu oddać zadanie.", "#7dff8a");
            }
        }
        let xp = m.d.xp;
        const diff = P.lvl - m.d.lvl;
        if (diff > 4)
            xp = Math.max(1, Math.round(xp * 0.3));
        else if (diff > 2)
            xp = Math.round(xp * 0.7);
        gainXp(xp);
        if (SRV && SRV.onKill)
            SRV.onKill(m.k, m.d.lvl, m.d.xp, m.x, m.y);
        const items = [];
        for (const dr of m.d.drops)
            if (R() < dr[1])
                items.push([resolve(dr[0]), 1]);
        const gold = ri(m.d.gold[0], m.d.gold[1]);
        if (items.length || gold > 0) {
            const bg = { area: P.area, x: m.x, y: m.y, items, gold, life: 90 };
            if (TB)
                pickBag(bg);
            else
                bags.push(bg);
        }
        guideT = 0;
    }
    function hurtPlayer(m, raw, mult) {
        if (pl.dead)
            return;
        if (R() < C().dodge) {
            const p = rpos(pl2());
            ftext(p[0] + 16, p[1] - 2, "unik", "#9fd3ff", 12);
            return;
        }
        const d = Math.round(dmgCalc(raw, def()) * (mult || 1));
        P.hp -= d;
        pl.hit = 0.2;
        pl.combat = 6;
        const p = rpos(pl2());
        ftext(p[0] + 16, p[1] - 2, "-" + d, "#ff5a4a", 15);
        if (m && !m.dead && !pl.target) {
            pl.target = m;
            pl.auto = true;
        }
        if (P.hp <= 0)
            die();
    }
    function die() {
        P.hp = 0;
        pl.dead = 2.2;
        pl.target = null;
        pl.auto = false;
        pl.path = [];
        pl.talk = null;
        const lost = Math.floor(P.gold * 0.1);
        P.gold -= lost;
        const rp = respawnFor(P.area);
        pl.resp = rp;
        pl.wear = 1;
        log("Poległeś! Tracisz " + lost + " zł, a założony ekwipunek traci wytrzymałość. Budzisz się: " + AREAS[rp[0]].name + ".", "#ff8a7a");
    }
    // the nearest city on the world map; spawn next to its priest (or the city centre)
    const RESP0 = { village: [18, 17], town: [19, 13], port: [26, 16], fort: [26, 16], citadel: [26, 16], star: [21, 17] };
    function respawnFor(area) {
        let best = "village", bd = 1e9;
        const a0 = AINFO[area] || AINFO.village;
        for (const c of Object.keys(RESP0)) {
            if (!AINFO[c])
                continue;
            const d = Math.abs(AINFO[c].gx - a0.gx) + Math.abs(AINFO[c].gy - a0.gy) + (c === area ? -1 : 0);
            if (d < bd) {
                bd = d;
                best = c;
            }
        }
        const a = AREAS[best];
        let [x, y] = RESP0[best];
        for (let r = 0; r < 6 && solidT(a, x, y); r++)
            for (let dy = -r; dy <= r; dy++)
                for (let dx = -r; dx <= r; dx++)
                    if (solidT(a, x, y) && !solidT(a, RESP0[best][0] + dx, RESP0[best][1] + dy)) {
                        x = RESP0[best][0] + dx;
                        y = RESP0[best][1] + dy;
                    }
        return [best, x, y];
    }
    for (const k of ["kowal", "platnerz", "portsmith", "fortsmith", "citsmith", "starsmith"])
        if (NPCS[k])
            NPCS[k].rep = 1;
    let areaWarnT = "";
    const lvRange = (a) => { const m = /Potwory poz\. (\d+)\D+(\d+)/.exec((AINFO[a] && AINFO[a].lv) || ""); return m ? [+m[1], +m[2]] : null; };
    function areaWarn() {
        areaWarnT = "";
        const r = lvRange(P.area);
        if (pvpMap(P.area)) {
            log("⚔ Wchodzisz na mapę PvP! Inni gracze (od 10. poziomu) mogą cię tu zaatakować i zabić.", "#ff8a7a");
            areaWarnT = "⚔ STREFA PvP – inni gracze mogą cię zaatakować";
        }
        if (r && r[0] >= P.lvl + 6) {
            log("⚠ Uwaga: potwory w tej krainie mają poziom " + r[0] + "–" + r[1] + ", a ty " + P.lvl + ". Łatwo tu zginąć!", "#ffa04a");
            areaWarnT = (areaWarnT ? areaWarnT + "  ·  " : "") + "⚠ Potwory poz. " + r[0] + "–" + r[1] + " – śmiertelnie groźne dla ciebie!";
        }
        if (areaWarnT)
            banner = Math.max(banner, 6);
    }
    function heal(n) {
        const before = P.hp;
        P.hp = Math.min(maxHp(), P.hp + n);
        const p = rpos(pl2());
        ftext(p[0] + 16, p[1] - 4, "+" + Math.round(P.hp - before), "#7dff8a", 15);
        burst(p[0] + 16, p[1] + 16, "#7dff8a", 12, 40);
    }
    function usePotion() {
        if (pl.dead || !P.cls)
            return;
        const miss = maxHp() - P.hp;
        const have = ["pot", "bigpot", "elix", "gpot", "selix", "spot", "dpot"].filter((id) => countItem(id) > 0);
        if (!have.length) {
            log("Nie masz mikstur leczniczych. Kup je u zielarki lub alchemiczki.", "#ff8a7a");
            return;
        }
        let id = have[0];
        for (const h2 of have) {
            if (ITEMS[h2].heal <= miss + 20)
                id = h2;
        }
        useItem(id);
    }
    function useMana() {
        if (pl.dead || !P.cls)
            return;
        const mid = countItem("gmpot") ? "gmpot" : "mpot";
        if (!countItem(mid)) {
            log("Nie masz mikstur many.", "#9fb8ff");
            return;
        }
        useItem(mid);
    }
    function useItem(id) {
        const it = ITEMS[id];
        if (it.t === "m") {
            if (P.mp >= maxMp()) {
                log(C().res + ": pełna.", "#a89c86");
                return;
            }
            removeItem(id, 1);
            const b = P.mp;
            P.mp = Math.min(maxMp(), P.mp + it.mana);
            const p = rpos(pl2());
            ftext(p[0] + 16, p[1] - 4, "+" + Math.round(P.mp - b), "#7fb0ff", 15);
            burst(p[0] + 16, p[1] + 16, "#6f9bff", 12, 40);
            return;
        }
        if (it.t !== "p")
            return;
        if (P.hp >= maxHp()) {
            log("Masz pełne zdrowie.", "#a89c86");
            return;
        }
        removeItem(id, 1);
        heal(it.heal);
    }
    function equip(idx) {
        const s = P.inv[idx];
        if (!s)
            return;
        const it = ITEMS[s.id];
        if (it.t !== "w" && it.t !== "a")
            return;
        if (!canUse(s.id)) {
            log("Tego przedmiotu nie może używać " + C().n + ". Sprzedaj go w sklepie.", "#ff8a7a");
            return;
        }
        const slot = it.t;
        const old = P.eq[slot];
        P.inv.splice(idx, 1);
        P.eq[slot] = s.id;
        if (old)
            P.inv.push({ id: old, n: 1 });
        P.hp = Math.min(P.hp, maxHp());
        P.mp = Math.min(P.mp, maxMp());
        log("Założono: " + it.n + ".", "#c8e6a0");
        invSel = -1;
        save();
    }
    function unequip(slot) {
        if (!P.eq[slot])
            return;
        if (P.inv.length >= 20) {
            log("Torba jest pełna!", "#ff8a7a");
            return;
        }
        P.inv.push({ id: P.eq[slot], n: 1 });
        P.eq[slot] = null;
        P.hp = Math.min(P.hp, maxHp());
        P.mp = Math.min(P.mp, maxMp());
        invSel = -1;
        save();
    }
    function skillTarget(r) {
        if (pl.target && !pl.target.dead && inRange(pl.target, r))
            return pl.target;
        let best = null, bd = 1e9;
        for (const m of mobs[P.area]) {
            if (m.dead || !inRange(m, r))
                continue;
            const d = cheb(m.x, m.y, P.x, P.y);
            if (d < bd) {
                bd = d;
                best = m;
            }
        }
        return best;
    }
    function useSkill(i) {
        if (pl.dead || dlg || !P.cls || trans)
            return;
        const sk = SK[P.cls][i];
        if (!sk)
            return;
        if (P.lvl < sk.lvl) {
            log(sk.n + ": dostępne od poziomu " + sk.lvl + ".", "#a89c86");
            return;
        }
        if (pl.skcd[i] > 0)
            return;
        if (P.mp < sk.cost) {
            log("Za mało: " + C().res.toLowerCase() + " (potrzeba " + sk.cost + ").", "#9fb8ff");
            return;
        }
        const cl = P.cls, pp = rpos(pl2()), a0 = atk();
        const noT = () => { log(sk.n + ": brak celu w zasięgu.", "#a89c86"); };
        if (cl === "war" && i === 0) {
            const m = skillTarget(1);
            if (!m) {
                const far = nearestMob(6);
                if (far) {
                    pl.target = far;
                    tooFar("Podejdź do celu, aby użyć: " + sk.n + ".");
                }
                else
                    noT();
                return;
            }
            face(pl, m.x - P.x, m.y - P.y);
            pl.anim = 0.25;
            pl.target = m;
            const mp = rpos(m);
            fx.push({ k: "slash", x: mp[0] + 16, y: mp[1] + 16, life: 0.35, max: 0.35, c: "#ffb347" });
            applyHit(m, Math.round(dmgCalc(a0, m.d.def) * 2.2), false, { frz: 1, col: "#ffb347", big: true });
        }
        else if (cl === "war" && i === 1) {
            const ms = mobs[P.area].filter((m) => !m.dead && cheb(m.x, m.y, P.x, P.y) <= 1);
            if (!ms.length) {
                log("Brak wrogów wokół ciebie.", "#a89c86");
                return;
            }
            pl.anim = 0.25;
            fx.push({ k: "whirl", x: pp[0] + 16, y: pp[1] + 18, life: 0.45, max: 0.45 });
            ms.forEach((m) => applyHit(m, Math.round(dmgCalc(a0, m.d.def) * 1.6), false, { col: "#ffb347", big: true }));
        }
        else if (cl === "war" && i === 2) {
            pl.buffDef = 8;
            heal(maxHp() * 0.25);
            fx.push({ k: "ring", x: pp[0] + 16, y: pp[1] + 18, life: 0.9, max: 0.9, c: "255,140,60" });
            ftext(pp[0] + 16, pp[1] - 18, "Okrzyk bojowy!", "#ffb347", 14);
        }
        else if (cl === "arc" && i === 0) {
            const m = skillTarget(8);
            if (!m) {
                noT();
                return;
            }
            pl.target = m;
            face(pl, m.x - P.x, m.y - P.y);
            pl.anim = 0.18;
            shoot(m, Math.round(dmgCalc(a0, m.d.def) * 2.6), false, "aim", { col: "#ffe08a", big: true });
        }
        else if (cl === "arc" && i === 1) {
            const m = skillTarget(7);
            if (!m) {
                noT();
                return;
            }
            pl.target = m;
            face(pl, m.x - P.x, m.y - P.y);
            pl.anim = 0.18;
            const cx = m.x, cy = m.y, ar = P.area;
            fx.push({ k: "rain", x: cx * TS + 16, y: cy * TS + 16, life: 0.6, max: 0.6 });
            pend.push({ t: 0.45, fn: () => { if (P.area !== ar)
                    return; for (const o of mobs[ar])
                    if (!o.dead && cheb(o.x, o.y, cx, cy) <= 2)
                        applyHit(o, Math.round(dmgCalc(a0, o.d.def) * 1.3), false, { col: "#ffe08a" }); } });
        }
        else if (cl === "arc" && i === 2) {
            pl.haste = 7;
            fx.push({ k: "ring", x: pp[0] + 16, y: pp[1] + 18, life: 0.9, max: 0.9, c: "120,255,140" });
            ftext(pp[0] + 16, pp[1] - 18, "Sokole oko!", "#9dff9a", 14);
        }
        else if (cl === "mag" && i === 0) {
            const m = skillTarget(7);
            if (!m) {
                noT();
                return;
            }
            pl.target = m;
            face(pl, m.x - P.x, m.y - P.y);
            pl.anim = 0.2;
            shoot(m, Math.round(dmgCalc(a0, m.d.def) * 2.4), false, "fire", { splash: 0.5, col: "#ffb347", big: true });
        }
        else if (cl === "mag" && i === 1) {
            pl.anim = 0.2;
            fx.push({ k: "nova", x: pp[0] + 16, y: pp[1] + 18, life: 0.5, max: 0.5 });
            const ms = mobs[P.area].filter((m) => !m.dead && cheb(m.x, m.y, P.x, P.y) <= 2);
            ms.forEach((m) => applyHit(m, Math.round(dmgCalc(a0, m.d.def) * 1.3), false, { frz: 2.5, col: "#9fe6ff" }));
        }
        else if (cl === "mag" && i === 2) {
            heal(maxHp() * 0.4);
            fx.push({ k: "ring", x: pp[0] + 16, y: pp[1] + 18, life: 0.9, max: 0.9, c: "120,255,160" });
        }
        P.mp -= sk.cost;
        pl.skcd[i] = sk.cd;
    }
    // ---------- MOVEMENT ----------
    function shopOk() {
        if (!shopId)
            return false;
        for (const k of Object.keys(NPCS)) {
            const n = NPCS[k];
            if (n.shop === shopId && n.area === P.area && cheb(n.x, n.y, P.x, P.y) <= 2)
                return true;
        }
        log("Jesteś za daleko od sprzedawcy.", "#ff8a7a");
        return false;
    }
    function buyItem(id) {
        if (!shopOk() || shopList(shopId).indexOf(id) < 0 || !ITEMS[id])
            return;
        const it = ITEMS[id];
        if (P.gold < it.price) {
            log("Za mało złota.", "#ff8a7a");
            return;
        }
        if (addItem(id, 1)) {
            P.gold -= it.price;
            log("Kupiono: " + it.n + ".", "#c8e6a0");
            save();
        }
        else
            log("Torba jest pełna!", "#ff8a7a");
    }
    function sellItem(i) {
        if (!shopOk())
            return;
        const s = P.inv[i];
        if (!s)
            return;
        const it = ITEMS[s.id], pr = Math.max(1, Math.floor(it.price / 2));
        s.n--;
        if (s.n <= 0)
            P.inv.splice(i, 1);
        P.gold += pr;
        log("Sprzedano: " + it.n + " (+" + pr + " zł).", "#f5d98a");
        save();
    }
    function sellJunk() {
        if (!shopOk())
            return;
        let sum = 0;
        for (let i = P.inv.length - 1; i >= 0; i--) {
            const s = P.inv[i];
            if (ITEMS[s.id].t === "j") {
                sum += Math.max(1, Math.floor(ITEMS[s.id].price / 2)) * s.n;
                P.inv.splice(i, 1);
            }
        }
        if (sum) {
            P.gold += sum;
            log("Sprzedano łupy za " + sum + " zł.", "#f5d98a");
            save();
        }
    }
    function npcAt(x, y) {
        for (const k of Object.keys(NPCS)) {
            const n = NPCS[k];
            if (n.area === P.area && n.x === x && n.y === y)
                return k;
        }
        return null;
    }
    function mobAt(x, y) {
        for (const m of mobs[P.area])
            if (!m.dead && m.x === x && m.y === y)
                return m;
        return null;
    }
    function decorAt(x, y) { return DECOR.some((d) => d.area === P.area && d.x === x && d.y === y); }
    function blocked(x, y, self) {
        if (solidT(A(), x, y))
            return true;
        if (npcAt(x, y) || decorAt(x, y))
            return true;
        const m = mobAt(x, y);
        if (m && m !== self)
            return true;
        if (self !== pl && P.x === x && P.y === y)
            return true;
        return false;
    }
    function face(e, dx, dy) {
        if (Math.abs(dx) > Math.abs(dy))
            e.dir = dx < 0 ? 1 : 2;
        else if (dy !== 0)
            e.dir = dy < 0 ? 3 : 0;
    }
    function stepPlayer(dx, dy) {
        face(pl, dx, dy);
        const nx = P.x + dx, ny = P.y + dy;
        if (blocked(nx, ny, pl))
            return false;
        pl.fx = P.x;
        pl.fy = P.y;
        P.x = nx;
        P.y = ny;
        pl.mt = 0;
        return true;
    }
    function bfs(sx, sy, goal) {
        const a = A();
        const Wd = a.w;
        if (goal(sx, sy))
            return [];
        const prev = new Int32Array(a.w * a.h).fill(-1);
        const s0 = sy * Wd + sx;
        prev[s0] = s0;
        const q = [s0];
        let qi = 0;
        const D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        while (qi < q.length && qi < 8000) {
            const c = q[qi++];
            const cx = c % Wd, cy = (c - cx) / Wd;
            for (const d of D) {
                const nx = cx + d[0], ny = cy + d[1];
                if (nx < 0 || ny < 0 || nx >= a.w || ny >= a.h)
                    continue;
                const k = ny * Wd + nx;
                if (prev[k] !== -1)
                    continue;
                if (blocked(nx, ny, pl))
                    continue;
                prev[k] = c;
                if (goal(nx, ny)) {
                    const path = [];
                    let p = k;
                    while (p !== s0) {
                        const px = p % Wd;
                        path.unshift([px, (p - px) / Wd]);
                        p = prev[p];
                    }
                    return path;
                }
                q.push(k);
            }
        }
        return null;
    }
    function changeArea(to, tx, ty) { trans = { to, tx, ty, t: 0, done: false }; }
    function onArrive() {
        for (const b of bags)
            if (!b.taken && b.area === P.area && b.x === P.x && b.y === P.y)
                pickBag(b);
        for (const e of A().exits)
            if (e.x === P.x && e.y === P.y) {
                changeArea(e.to, e.tx, e.ty);
                pl.path = [];
                pl.target = null;
                return;
            }
    }
    function pickBag(b) {
        b.taken = true;
        const got = [];
        if (b.gold) {
            P.gold += b.gold;
            got.push(b.gold + " zł");
        }
        for (const it of b.items)
            if (addItem(it[0], it[1]))
                got.push(ITEMS[it[0]].n);
        if (got.length)
            log("Łup: " + got.join(", "), "#f5d98a");
        ftext(b.x * TS + 16, b.y * TS, b.gold ? "+" + b.gold + " zł" : "łup", "#f5d98a", 13);
    }
    function nearestMob(r) {
        let best = null, bd = 1e9;
        for (const m of mobs[P.area]) {
            if (m.dead)
                continue;
            const d = Math.abs(m.x - P.x) + Math.abs(m.y - P.y) * 1.01;
            if (cheb(m.x, m.y, P.x, P.y) <= r && d < bd) {
                bd = d;
                best = m;
            }
        }
        return best;
    }
    let farT = 0;
    function tooFar(t) { if (time - farT > 1.2) {
        farT = time;
        log(t, "#a89c86");
    } }
    // Attack never moves the player: it hits the selected target if it is in range.
    function attackKey() {
        if (pl.dead || dlg || !P.cls)
            return;
        const r = C().rng;
        if (!pl.target || pl.target.dead) {
            const m = skillTarget(r);
            if (m)
                pl.target = m;
            else {
                const far = nearestMob(8);
                if (far) {
                    pl.target = far;
                    tooFar("Cel wybrany – podejdź bliżej, by zaatakować.");
                }
                else
                    log("W pobliżu nie ma przeciwników.", "#a89c86");
                return;
            }
        }
        pl.auto = true;
        if (inRange(pl.target, r)) {
            if (pl.cd <= 0)
                playerAttack(pl.target);
        }
        else
            tooFar(r > 1 ? "Cel poza zasięgiem lub zasłonięty – podejdź bliżej." : "Cel za daleko – podejdź bliżej.");
    }
    function selectMob(m) {
        if (!m || m.dead)
            return;
        if (pl.target !== m)
            pl.auto = false;
        pl.target = m;
    }
    function talkKey() {
        if (dlg) {
            if (dlg.opts.length === 1)
                dlg.opts[0].fn();
            return;
        }
        if (!P.cls)
            return;
        for (const k of Object.keys(NPCS)) {
            const n = NPCS[k];
            if (n.area === P.area && cheb(n.x, n.y, P.x, P.y) <= 1) {
                face(pl, n.x - P.x, n.y - P.y);
                talk(k);
                return;
            }
        }
        for (const k of Object.keys(NPCS)) {
            const n = NPCS[k];
            if (n.area === P.area && cheb(n.x, n.y, P.x, P.y) <= 6) {
                tooFar("Podejdź bliżej, by porozmawiać: " + n.n + ".");
                return;
            }
        }
    }
    function npcTap(id) {
        const n = NPCS[id];
        if (cheb(n.x, n.y, P.x, P.y) <= 1) {
            face(pl, n.x - P.x, n.y - P.y);
            talk(id);
        }
        else
            tooFar("Podejdź bliżej, by porozmawiać: " + n.n + ".");
    }
    // ---- intent sampling (device layer) ----
    // d-pad cell under a point: arrows give one axis, the corners between two arrows give a diagonal
    function padCell(x, y) {
        const rx = x - pad.cx, ry = y - pad.cy, h = pad.s / 2;
        return [rx > h ? 1 : rx < -h ? -1 : 0, ry > h ? 1 : ry < -h ? -1 : 0];
    }
    function padDir() {
        let dx = 0, dy = 0;
        for (const k of Object.keys(pad.ptr)) {
            const d = pad.ptr[Number(k)];
            dx += d[0];
            dy += d[1];
        }
        dx = Math.max(-1, Math.min(1, dx));
        dy = Math.max(-1, Math.min(1, dy));
        return dx || dy ? [dx, dy] : null;
    }
    function heldDir() {
        let dx = 0, dy = 0;
        if (keys["ArrowLeft"] || keys["a"])
            dx -= 1;
        if (keys["ArrowRight"] || keys["d"])
            dx += 1;
        if (keys["ArrowUp"] || keys["w"])
            dy -= 1;
        if (keys["ArrowDown"] || keys["s"])
            dy += 1;
        const j = padDir();
        if (j) {
            dx = Math.max(-1, Math.min(1, dx + j[0]));
            dy = Math.max(-1, Math.min(1, dy + j[1]));
        }
        if (extDir) {
            dx = extDir[0];
            dy = extDir[1];
        }
        if (dx === 0 && dy === 0)
            return null;
        return [dx, dy];
    }
    function readIntent() {
        const d = heldDir();
        return { mx: d ? d[0] : 0, my: d ? d[1] : 0, acts: actQ.splice(0, actQ.length) };
    }
    // ---- simulation side: actions ----
    function applyAct(a) {
        if (a.a === "atk")
            attackKey();
        else if (a.a === "sk")
            useSkill(a.i || 0);
        else if (a.a === "pot")
            usePotion();
        else if (a.a === "mpot")
            useMana();
        else if (a.a === "talk")
            talkKey();
        else if (a.a === "npc" && a.id && NPCS[a.id] && NPCS[a.id].area === P.area)
            npcTap(a.id);
        else if (a.a === "target") {
            const m = a.area === P.area && a.i !== undefined ? mobs[P.area][a.i] : null;
            if (m)
                selectMob(m);
        }
        else if (a.a === "untarget") {
            pl.target = null;
            pl.auto = false;
        }
        else if (a.a === "buy" && a.id)
            buyItem(a.id);
        else if (a.a === "sell" && a.i !== undefined)
            sellItem(a.i);
        else if (a.a === "junk")
            sellJunk();
        else if (a.a === "equip" && a.i !== undefined)
            equip(a.i);
        else if (a.a === "unequip" && (a.id === "w" || a.id === "a"))
            unequip(a.id);
        else if (a.a === "use" && a.id && ITEMS[a.id] && countItem(a.id) > 0)
            useItem(a.id);
        else if (a.a === "track" && a.id !== undefined) {
            if (a.id === "" || (QUESTS[a.id] && P.q[a.id] && P.q[a.id].s === "active")) {
                P.track = a.id;
                guideT = 0;
            }
        }
        else if (a.a === "dlg" && dlg && a.i !== undefined && dlg.opts[a.i])
            dlg.opts[a.i].fn();
        else if (a.a === "dlgx")
            dlg = null;
        else if (a.a === "intro") {
            P.intro = true;
            save();
        }
    }
    // Deterministic grid step: 8-way intent, diagonals alternate axes; slides along walls.
    function moveIntent(mx, my) {
        if (mx && my) {
            const first = pl.ax ? 1 : 0;
            for (let k = 0; k < 2; k++) {
                const ax = (first + k) % 2;
                if (ax === 0 ? stepPlayer(mx, 0) : stepPlayer(0, my)) {
                    pl.ax = ax === 0 ? 1 : 0;
                    return;
                }
            }
            return;
        }
        stepPlayer(mx, my);
    }
    function updatePlayer(dt, it) {
        pl.cd = Math.max(0, pl.cd - dt);
        pl.anim = Math.max(0, pl.anim - dt);
        pl.hit = Math.max(0, pl.hit - dt);
        pl.combat = Math.max(0, (pl.combat || 0) - dt);
        pl.nomp = Math.max(0, pl.nomp - dt);
        pl.buffDef = Math.max(0, pl.buffDef - dt);
        pl.haste = Math.max(0, pl.haste - dt);
        for (let i = 0; i < 3; i++)
            pl.skcd[i] = Math.max(0, pl.skcd[i] - dt);
        for (const ac of it.acts)
            applyAct(ac);
        if (!pl.dead) {
            if (pl.combat <= 0 && P.hp < maxHp())
                P.hp = Math.min(maxHp(), P.hp + maxHp() * 0.02 * dt);
            const rg = (C().reg + (P.cls === "mag" ? P.lvl * 0.12 : 0)) * (pl.combat > 0 ? 1 : 2.2);
            if (P.mp < maxMp())
                P.mp = Math.min(maxMp(), P.mp + rg * dt);
        }
        if (pl.dead > 0) {
            pl.dead -= dt;
            if (pl.dead <= 0) {
                pl.dead = 0;
                P.hp = maxHp();
                P.mp = maxMp();
                changeArea(pl.resp[0], pl.resp[1], pl.resp[2]);
            }
            return;
        }
        if (pl.mt < 1) {
            const nm = pl.mt + dt * 5;
            pl.carry = nm > 1 ? Math.min(0.5, nm - 1) : 0;
            pl.mt = Math.min(1, nm);
            pl.phase += dt * 14;
            if (pl.mt >= 1)
                onArrive();
            if (pl.mt < 1 || trans)
                return;
        }
        if (dlg || trans)
            return;
        if (pl.target && (pl.target.dead || cheb(pl.target.x, pl.target.y, P.x, P.y) > 14)) {
            pl.target = null;
            pl.auto = false;
        }
        if (pl.auto && pl.target && pl.cd <= 0 && inRange(pl.target, C().rng)) {
            face(pl, pl.target.x - P.x, pl.target.y - P.y);
            playerAttack(pl.target);
        }
        if (it.mx || it.my) {
            moveIntent(it.mx, it.my);
            if (pl.mt === 0)
                pl.mt = pl.carry || 0;
        }
        pl.carry = 0;
    }
    function mobShoot(m) {
        const p = rpos(m);
        shots.push({ area: P.area, x: p[0] + 16, y: p[1] + 10, pl: true, src: m, d: m.d.atk, col: m.d.pc || "#c8ff7a", sp: 250, life: 3, ang: 0, kind: "mob" });
    }
    function updateMobs(dt) {
        const a = A();
        for (const m of mobs[P.area]) {
            if (SRV && m.own !== SRV.id)
                continue;
            m.hit = Math.max(0, m.hit - dt);
            m.anim = Math.max(0, m.anim - dt);
            if (m.inB && !m.dead)
                continue;
            if (m.dead) {
                m.rt -= dt;
                if (m.rt <= 0 && cheb(m.hx, m.hy, P.x, P.y) > 5 && !mobAt(m.hx, m.hy)) {
                    m.dead = false;
                    m.hp = m.d.hp;
                    m.x = m.fx = m.hx;
                    m.y = m.fy = m.hy;
                    m.mt = 1;
                    m.aggro = false;
                    m.frz = 0;
                    m.sl = m.d.slam || 0;
                }
                continue;
            }
            if (m.mt < 1) {
                m.mt = Math.min(1, m.mt + dt * m.d.spd * (m.frz > 0 ? 0.3 : 1));
                continue;
            }
            if (TB) {
                m.aggro = false;
                continue;
            }
            if (m.frz > 0) {
                m.frz -= dt;
                continue;
            }
            m.cd = Math.max(0, m.cd - dt);
            const dist = cheb(m.x, m.y, P.x, P.y);
            const home = cheb(m.x, m.y, m.hx, m.hy);
            if (pl.dead)
                m.aggro = false;
            if (!TB && !m.aggro && !pl.dead && m.d.aggro > 0 && dist <= m.d.aggro && P.lvl < m.d.lvl + 6)
                m.aggro = true;
            if (m.aggro && (home > (m.d.boss ? 8 : 11) || dist > 12)) {
                m.aggro = false;
                m.hp = Math.min(m.d.hp, m.hp + m.d.hp * 0.5);
                if (pl.target === m)
                    pl.target = null;
            }
            const step = (dx, dy) => {
                if (!dx && !dy)
                    return false;
                const nx = m.x + dx, ny = m.y + dy;
                if (blocked(nx, ny, m))
                    return false;
                if (a.exits.some((e) => e.x === nx && e.y === ny))
                    return false;
                face(m, dx, dy);
                m.fx = m.x;
                m.fy = m.y;
                m.x = nx;
                m.y = ny;
                m.mt = 0;
                return true;
            };
            if (m.aggro && !pl.dead) {
                if (m.d.slam) {
                    m.sl -= dt;
                    if (m.sl <= 0 && dist <= 4) {
                        m.sl = m.d.slam;
                        warns.push({ area: P.area, x: P.x, y: P.y, r: 1, t: 1.15, max: 1.15, d: m.d.atk, m });
                        log(m.d.n + " szykuje potężny atak! Wyjdź z czerwonego kręgu!", "#ff8a7a");
                    }
                }
                const ranged = m.d.rng && dist <= m.d.rng && dist > 1 && losT(m.x, m.y, P.x, P.y);
                if (dist <= 1 || ranged) {
                    face(m, P.x - m.x, P.y - m.y);
                    if (m.cd <= 0) {
                        m.cd = m.d.cd;
                        m.anim = 0.2;
                        if (dist <= 1)
                            hurtPlayer(m, m.d.atk, 1);
                        else
                            mobShoot(m);
                    }
                }
                else {
                    const dx = Math.sign(P.x - m.x), dy = Math.sign(P.y - m.y);
                    const prefX = Math.abs(P.x - m.x) >= Math.abs(P.y - m.y);
                    if (prefX) {
                        if (!step(dx, 0))
                            step(0, dy);
                    }
                    else {
                        if (!step(0, dy))
                            step(dx, 0);
                    }
                }
            }
            else {
                m.wt -= dt;
                if (m.wt <= 0) {
                    m.wt = 1.5 + R() * 3;
                    const D = [[1, 0], [-1, 0], [0, 1], [0, -1]][ri(0, 3)];
                    if (cheb(m.x + D[0], m.y + D[1], m.hx, m.hy) <= 3)
                        step(D[0], D[1]);
                    else if (!step(Math.sign(m.hx - m.x), 0))
                        step(0, Math.sign(m.hy - m.y));
                    if (m.hp < m.d.hp)
                        m.hp = Math.min(m.d.hp, m.hp + m.d.hp * 0.2);
                }
            }
        }
    }
    function updateShots(dt) {
        for (let i = shots.length - 1; i >= 0; i--) {
            const s = shots[i];
            s.life -= dt;
            if (s.area !== P.area || s.life <= 0 || (s.pl && pl.dead)) {
                shots.splice(i, 1);
                continue;
            }
            let tx = 0, ty = 0;
            if (s.pl) {
                const p = rpos(pl2());
                tx = p[0] + 16;
                ty = p[1] + 14;
            }
            else {
                if (s.m.dead) {
                    shots.splice(i, 1);
                    continue;
                }
                const p = rpos(s.m);
                tx = p[0] + 16;
                ty = p[1] + 14;
            }
            const dx = tx - s.x, dy = ty - s.y, dist = Math.hypot(dx, dy);
            s.ang = Math.atan2(dy, dx);
            const stp = s.sp * dt;
            if (dist <= stp + 4) {
                shots.splice(i, 1);
                if (s.pl)
                    hurtPlayer(s.src, s.d, 1);
                else {
                    if (s.o.splash) {
                        for (const o of mobs[P.area])
                            if (o !== s.m && !o.dead && cheb(o.x, o.y, s.m.x, s.m.y) <= 1)
                                applyHit(o, Math.max(1, Math.round(s.d * s.o.splash)), false, { col: "#ffb347" });
                        burst(tx, ty, "#ff9a3c", 18, 90);
                    }
                    applyHit(s.m, s.d, s.crit, s.o);
                }
                continue;
            }
            s.x += dx / dist * stp;
            s.y += dy / dist * stp;
            if (!SRV && s.kind !== "arrow" && s.kind !== "aim" && R() < 0.7)
                fx.push({ k: "p", x: s.x, y: s.y, vx: (R() - 0.5) * 20, vy: (R() - 0.5) * 20, c: s.kind === "fire" ? "#ffb347" : s.kind === "bolt" ? "#bfa8ff" : s.col, life: 0.3, max: 0.6 });
        }
        for (let i = warns.length - 1; i >= 0; i--) {
            const w = warns[i];
            w.t -= dt;
            if (w.area !== P.area) {
                warns.splice(i, 1);
                continue;
            }
            if (w.t <= 0) {
                warns.splice(i, 1);
                burst(w.x * TS + 16, w.y * TS + 16, "#ff6a4a", 30, 120);
                if (!pl.dead && cheb(P.x, P.y, w.x, w.y) <= w.r)
                    hurtPlayer(w.m, w.d, 1.7);
            }
        }
        for (let i = pend.length - 1; i >= 0; i--) {
            pend[i].t -= dt;
            if (pend[i].t <= 0) {
                const f = pend[i].fn;
                pend.splice(i, 1);
                f();
            }
        }
    }
    function update(dt) {
        time += dt;
        for (let i = fx.length - 1; i >= 0; i--) {
            const f = fx[i];
            f.life -= dt;
            if (f.k === "p") {
                f.x += f.vx * dt;
                f.y += f.vy * dt;
                f.vy += 120 * dt;
            }
            if (f.k === "txt")
                f.y -= 28 * dt;
            if (f.life <= 0)
                fx.splice(i, 1);
        }
        if (!P.cls)
            return;
        if (NET) {
            netUpdate(dt);
            return;
        }
        banner = Math.max(0, banner - dt);
        if (resetArm > 0)
            resetArm -= dt;
        if (trans) {
            trans.t += dt;
            if (!trans.done && trans.t >= 0.25) {
                trans.done = true;
                P.area = trans.to;
                P.x = trans.tx;
                P.y = trans.ty;
                pl.fx = P.x;
                pl.fy = P.y;
                pl.mt = 1;
                pl.path = [];
                pl.target = null;
                pl.talk = null;
                const m = mobAt(P.x, P.y);
                if (m) {
                    m.x = m.fx = m.hx;
                    m.y = m.fy = m.hy;
                }
                const first = !P.seen[P.area];
                P.seen[P.area] = 1;
                for (const k of Object.keys(AREAS))
                    if (k !== P.area)
                        AREAS[k].img = null;
                shots.length = 0;
                warns.length = 0;
                banner = first ? 4.5 : 3;
                clickMark = null;
                panel = "";
                dlg = null;
                guideT = 0;
                save();
                if (first)
                    log("Odkryto nową krainę: " + A().name + "!", "#f5d98a");
                areaWarn();
            }
            if (trans.t >= 0.6)
                trans = null;
        }
        updatePlayer(dt, readIntent());
        if (!trans) {
            updateMobs(dt);
            updateShots(dt);
        }
        updateGuide(dt);
        for (let i = bags.length - 1; i >= 0; i--) {
            bags[i].life -= dt;
            if (bags[i].life <= 0 || bags[i].taken)
                bags.splice(i, 1);
        }
        for (const m of msgs)
            m.life -= dt;
        while (msgs.length && msgs[0].life <= 0)
            msgs.shift();
        if (time - lastSave > 8) {
            lastSave = time;
            save();
        }
        if (!P.intro && !dlg) {
            P.intro = true;
            dlg = { name: "ARDAN", text: touchMode
                    ? "Mgła spowiła Ardan. Chodzisz strzałkami w lewym dolnym rogu (przytrzymaj; dwie naraz – po skosie). Złota strzałka i kropki wskazują drogę do celu zadania. Dotknij potwora, by go wybrać, i bij przyciskiem ataku (musisz być w zasięgu). Z postacią porozmawiasz, stojąc obok niej i dotykając jej. Mapka powiększa się po dotknięciu."
                    : "Mgła spowiła Ardan. Złota strzałka i kropki wskazują drogę do celu zadania. Sterowanie: WASD/strzałki – ruch, klik na potwora – wybór celu, Spacja/F – atak (w zasięgu), 1/2/3 – umiejętności, E – rozmowa (stojąc obok), I – torba, Q – zadania, T – zmiana zadania, M – mapa, H – mikstura, G – mana.",
                opts: [{ l: "Zaczynajmy!", fn: () => { dlg = null; save(); } }] };
        }
    }
    // ---------- MULTIPLAYER: SERVER TICK ----------
    function srvTick(dt, it) {
        time += dt;
        if (trans) {
            trans.t += dt;
            if (!trans.done && trans.t >= 0.25) {
                trans.done = true;
                P.area = trans.to;
                P.x = trans.tx;
                P.y = trans.ty;
                pl.fx = P.x;
                pl.fy = P.y;
                pl.mt = 1;
                pl.target = null;
                pl.auto = false;
                pl.talk = null;
                const m = mobAt(P.x, P.y);
                if (m) {
                    m.x = m.fx = m.hx;
                    m.y = m.fy = m.hy;
                }
                const first = !P.seen[P.area];
                P.seen[P.area] = 1;
                shots.length = 0;
                warns.length = 0;
                pend.length = 0;
                dlg = null;
                panel = "";
                shopId = "";
                save();
                if (first)
                    log("Odkryto nową krainę: " + A().name + "!", "#f5d98a");
            }
            if (trans.t >= 0.6)
                trans = null;
        }
        updatePlayer(dt, it);
        if (!trans) {
            updateMobs(dt);
            updateShots(dt);
        }
        for (let i = bags.length - 1; i >= 0; i--) {
            bags[i].life -= dt;
            if (bags[i].life <= 0 || bags[i].taken)
                bags.splice(i, 1);
        }
    }
    // ---------- MULTIPLAYER: ONLINE CLIENT ----------
    const others = {};
    let netLast = [9, 9, -9], netIntro = false;
    function netPos(e, o, x, y) {
        if (o.x === x && o.y === y)
            return;
        if (cheb(o.x, o.y, x, y) > 2) {
            e.fx = x;
            e.fy = y;
            e.mt = 1;
        }
        else {
            e.fx = e.fx + (o.x - e.fx) * e.mt;
            e.fy = e.fy + (o.y - e.fy) * e.mt;
            e.mt = 0;
        }
        o.x = x;
        o.y = y;
    }
    function netArea(a, x, y) {
        if (!AREAS[a])
            return;
        P.area = a;
        P.x = x;
        P.y = y;
        pl.fx = x;
        pl.fy = y;
        pl.mt = 1;
        pl.target = null;
        for (const k of Object.keys(AREAS))
            if (k !== a)
                AREAS[k].img = null;
        const first = !P.seen[a];
        P.seen[a] = 1;
        for (const k of Object.keys(others))
            delete others[k];
        shots.length = 0;
        warns.length = 0;
        bags.length = 0;
        panel = "";
        guide = null;
        guideT = 0;
        banner = first ? 4.5 : 3;
        trans = { t: 0.25, done: true, to: a };
        if (first)
            log("Odkryto nową krainę: " + A().name + "!", "#f5d98a");
        areaWarn();
    }
    function netEvent(e) {
        if (e.k === "burst")
            burst(e.x, e.y, e.c, Math.min(60, e.n || 8), e.sp);
        else if (e.k === "shot") {
            const m = e.m >= 0 ? mobs[P.area][e.m] : null;
            shots.push({ area: P.area, x: e.x, y: e.y, m, tp: e.p || null, kind: e.kind, col: e.col, sp: e.sp || 300, life: 3, ang: 0, o: {} });
        }
        else if (e.k === "warn")
            warns.push({ area: P.area, x: e.x, y: e.y, r: e.r, t: e.t, max: e.max });
        else if (typeof e.k === "string") {
            const f = Object.assign({}, e);
            if (fx.length < 400)
                fx.push(f);
        }
    }
    function netRecv(msg) {
        if (!msg || typeof msg !== "object")
            return;
        if (msg.t === "s") {
            const me = msg.p;
            if (msg.a !== P.area)
                netArea(msg.a, me.x, me.y);
            netPos(pl, P, me.x, me.y);
            pl.dir = me.d;
            P.hp = me.hp;
            P.mp = me.mp;
            pl.dead = me.dd;
            pl.cd = me.cd;
            pl.skcd = me.sk;
            pl.buffDef = me.bd;
            pl.haste = me.hs;
            pl.auto = !!me.au;
            pl.combat = me.cb;
            if (me.an > pl.anim + 0.05)
                pl.anim = me.an;
            if (me.ht > pl.hit + 0.05)
                pl.hit = me.ht;
            const ml = mobs[msg.a];
            pl.target = me.tg >= 0 && ml && ml[me.tg] && !ml[me.tg].dead ? ml[me.tg] : null;
            if (ml && msg.m)
                msg.m.forEach((r, i) => {
                    const m = ml[i];
                    if (!m || !r)
                        return;
                    const dead = (r[3] & 1) === 1;
                    if (dead && !m.dead && pl.target === m)
                        pl.target = null;
                    if (m.dead && !dead) {
                        m.x = m.fx = r[0];
                        m.y = m.fy = r[1];
                        m.mt = 1;
                    }
                    else
                        netPos(m, m, r[0], r[1]);
                    m.hp = r[2];
                    m.dead = dead;
                    m.aggro = (r[3] & 2) === 2;
                    m.frz = (r[3] & 4) ? 1 : 0;
                    m.inB = (r[3] & 32) === 32;
                    if ((r[3] & 8) && m.hit <= 0)
                        m.hit = 0.15;
                    if ((r[3] & 16) && m.anim <= 0)
                        m.anim = 0.2;
                    m.dir = r[4];
                });
            const seen = {};
            for (const o of msg.o || []) {
                seen[o.i] = true;
                let e = others[o.i];
                if (!e) {
                    e = others[o.i] = { x: o.x, y: o.y, fx: o.x, fy: o.y, mt: 1, phase: 0, an: 0, hit: 0, area: msg.a };
                }
                netPos(e, e, o.x, o.y);
                e.i = o.i;
                e.n = o.n;
                e.c = o.c;
                e.l = o.l;
                e.dir = o.d;
                e.hp = o.hp;
                e.mh = o.mh;
                e.w = o.w;
                e.a = o.a;
                e.dead = o.dd;
                e.area = msg.a;
                e.bd = o.bd;
                e.gt = o.gt;
                e.fb = o.fb;
                e.i = o.i;
                e.ti = o.ti;
                e.dg = o.dg;
                if (o.an > e.an + 0.05)
                    e.an = o.an;
                if (o.ht > e.hit + 0.05)
                    e.hit = o.ht;
            }
            for (const k of Object.keys(others))
                if (!seen[k])
                    delete others[k];
            if (msg.b) {
                bags.length = 0;
                for (const b of msg.b)
                    bags.push({ area: msg.a, x: b[0], y: b[1], items: [], gold: 0, life: 9 });
            }
            for (const e of msg.e || [])
                netEvent(e);
            for (const l of msg.l || [])
                log(String(l.t), l.c);
        }
        else if (msg.t === "me") {
            const keep = { x: P.x, y: P.y, area: P.area, hp: P.hp, mp: P.mp, mmz: P.mmz, seen: P.seen };
            P = Object.assign(fresh(), msg.me, keep);
            guideT = 0;
        }
        else if (msg.t === "dlg") {
            const d = msg.d;
            if (d)
                dlg = { srv: true, name: String(d.name), text: String(d.text), opts: (d.opts || []).map((l, i) => ({ l: String(l), fn: () => { act({ a: "dlg", i }); } })) };
            else if (dlg && dlg.srv)
                dlg = null;
        }
        else if (msg.t === "shop") {
            panel = "shop";
            shopId = String(msg.shop);
            shopTab = "buy";
            sellPage = 0;
        }
        else if (msg.t === "log")
            log(String(msg.text), msg.c);
    }
    function netShots(dt) {
        for (let i = shots.length - 1; i >= 0; i--) {
            const s = shots[i];
            s.life -= dt;
            let tp = null;
            if (s.m) {
                if (!s.m.dead)
                    tp = rpos(s.m);
            }
            else if (s.tp) {
                if (s.tp === NET.id)
                    tp = rpos(pl2());
                else if (others[s.tp])
                    tp = rpos(others[s.tp]);
            }
            if (!tp || s.life <= 0) {
                shots.splice(i, 1);
                continue;
            }
            const tx = tp[0] + 16, ty = tp[1] + 14, dx = tx - s.x, dy = ty - s.y, dist = Math.hypot(dx, dy);
            s.ang = Math.atan2(dy, dx);
            const stp = s.sp * dt;
            if (dist <= stp + 4) {
                shots.splice(i, 1);
                continue;
            }
            s.x += dx / dist * stp;
            s.y += dy / dist * stp;
            if (s.kind !== "arrow" && s.kind !== "aim" && R() < 0.7)
                fx.push({ k: "p", x: s.x, y: s.y, vx: (R() - 0.5) * 20, vy: (R() - 0.5) * 20, c: s.kind === "fire" ? "#ffb347" : s.kind === "bolt" ? "#bfa8ff" : s.col, life: 0.3, max: 0.6 });
        }
        for (let i = warns.length - 1; i >= 0; i--) {
            warns[i].t -= dt;
            if (warns[i].t <= 0) {
                warns.splice(i, 1);
            }
        }
    }
    function netUpdate(dt) {
        banner = Math.max(0, banner - dt);
        if (trans) {
            trans.t += dt;
            if (trans.t >= 0.6)
                trans = null;
        }
        const it = readIntent();
        if (it.mx !== netLast[0] || it.my !== netLast[1] || it.acts.length || time - netLast[2] > 1) {
            netLast = [it.mx, it.my, time];
            NET.send({ t: "in", mx: it.mx, my: it.my, acts: it.acts });
        }
        pl.cd = Math.max(0, pl.cd - dt);
        pl.anim = Math.max(0, pl.anim - dt);
        pl.hit = Math.max(0, pl.hit - dt);
        pl.buffDef = Math.max(0, pl.buffDef - dt);
        pl.haste = Math.max(0, pl.haste - dt);
        for (let i = 0; i < 3; i++)
            pl.skcd[i] = Math.max(0, (pl.skcd[i] || 0) - dt);
        if (pl.mt < 1) {
            pl.mt = Math.min(1, pl.mt + dt * 5);
            pl.phase += dt * 14;
        }
        for (const m of mobs[P.area]) {
            m.hit = Math.max(0, m.hit - dt);
            m.anim = Math.max(0, m.anim - dt);
            if (m.mt < 1)
                m.mt = Math.min(1, m.mt + dt * m.d.spd * (m.frz > 0 ? 0.3 : 1));
        }
        for (const k of Object.keys(others)) {
            const o = others[k];
            if (o.mt < 1) {
                o.mt = Math.min(1, o.mt + dt * 5);
                o.phase += dt * 14;
            }
            o.an = Math.max(0, o.an - dt);
            o.hit = Math.max(0, o.hit - dt);
        }
        netShots(dt);
        updateGuide(dt);
        for (const m of msgs)
            m.life -= dt;
        while (msgs.length && msgs[0].life <= 0)
            msgs.shift();
        if (!P.intro && !dlg && !netIntro) {
            netIntro = true;
            dlg = { name: "ARDAN", text: (touchMode
                    ? "Witaj w świecie ARDAN! Chodzisz strzałkami w lewym dolnym rogu (przytrzymaj; dwie naraz – po skosie). Złota strzałka i kropki wskazują drogę do celu zadania. Dotknij potwora (lub przycisk ataku obok niego), aby rozpocząć walkę turową – możesz włączyć walkę automatyczną. Dotknij innego gracza, by handlować, zaprosić go lub wyzwać na arenie PvP. Menu (☰) otwiera ekwipunek, gildię i ranking PvP. Przedmioty sprzedasz u handlarzy, a wystawisz u aukcjonerów w miastach."
                    : "Witaj w świecie ARDAN! WASD/strzałki – ruch. Klik na potwora albo Spacja/E obok niego – walka turowa (z opcją walki automatycznej). Klik na gracza – handel, drużyna, gildia, pojedynek PvP. I – ekwipunek, R – rynek, U – gildia, P – PvP, Q – zadania, M – mapa, C – czat."),
                opts: [{ l: "Zaczynajmy!", fn: () => { dlg = null; act({ a: "intro" }); } }] };
        }
    }
    function drawOther(o, op) {
        const c = CLS[o.c] || CLS.war;
        const w = o.w && ITEMS[o.w] ? ITEMS[o.w].c : null, ar = o.a && o.a !== "shirt" && ITEMS[o.a] ? ITEMS[o.a].c : null;
        if (o.bd) {
            ctx.strokeStyle = "rgba(255,150,60,0.6)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(op[0] + 16, op[1] + 28, 14, 5, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
        drawHuman(op[0], op[1], o.dir || 0, o.mt < 1 ? o.phase : 0, c.look, w, ar, o.hit > 0, o.an, c.wk);
        const inParty = !!(NET && NET.party && NET.party[o.i]);
        const inZ = !!pvpAt(P.area, o.x, o.y) && !!pvpAt(P.area, P.x, P.y);
        if (o.ti)
            label(op[0] + 16, op[1] - 21, "«" + o.ti + "»", "#e8c96a");
        if (o.fb || o.dg)
            label(op[0] + 16, op[1] - (o.ti ? 34 : 21), o.dg ? "🕳 w lochu" : "⚔ walczy", "#ffb347");
        label(op[0] + 16, op[1] - 8, (inParty ? "◆ " : "") + (o.gt ? "[" + o.gt + "] " : "") + o.n + " · " + o.l, inParty ? "#8fff8f" : inZ ? "#ff9a8a" : "#9fe0ff");
        const hpk = o.mh ? clamp(o.hp / o.mh, 0, 1) : 1;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(op[0] + 4, op[1] - 4, 24, 4);
        ctx.fillStyle = "#5fd35a";
        ctx.fillRect(op[0] + 4, op[1] - 4, 24 * hpk, 4);
    }
    // ---------- DRAW: ENTITIES ----------
    function drawWeapon(x, y, col, wk, dir) {
        const g = ctx;
        if (wk === "bow") {
            const flip = dir === 1 ? -1 : 1;
            g.strokeStyle = col;
            g.lineWidth = 2.5;
            g.beginPath();
            g.moveTo(x + 2, y - 2);
            g.quadraticCurveTo(x + 2 + 7 * flip, y + 7, x + 2, y + 16);
            g.stroke();
            g.strokeStyle = "rgba(255,255,255,0.75)";
            g.lineWidth = 1;
            g.beginPath();
            g.moveTo(x + 2, y - 2);
            g.lineTo(x + 2, y + 16);
            g.stroke();
            return;
        }
        if (wk === "staff") {
            g.fillStyle = "#6b4a2b";
            g.fillRect(x + 1, y - 4, 3, 22);
            g.fillStyle = col;
            g.beginPath();
            g.arc(x + 2.5, y - 5, 3.5, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = "rgba(255,255,255," + (0.35 + 0.25 * Math.sin(time * 5)).toFixed(3) + ")";
            g.beginPath();
            g.arc(x + 2.5, y - 5, 6, 0, Math.PI * 2);
            g.fill();
            return;
        }
        g.fillStyle = col;
        g.fillRect(x + 1, y, 3, 13);
        g.fillStyle = "rgba(255,255,255,0.5)";
        g.fillRect(x + 1, y, 1, 12);
        g.fillStyle = "#5a3a1e";
        g.fillRect(x - 1, y + 12, 7, 2);
        g.fillRect(x + 1, y + 14, 3, 4);
    }
    function drawHuman(x, y, dir, walk, c, wcol, acol, flash, lunge, wk) {
        const g = ctx;
        if (lunge > 0) {
            const k = Math.sin((lunge / 0.18) * Math.PI) * 4;
            if (dir === 0)
                y += k;
            else if (dir === 3)
                y -= k;
            else if (dir === 1)
                x -= k;
            else
                x += k;
        }
        const bob = walk ? Math.abs(Math.sin(walk)) * 1.5 : 0;
        const leg = walk ? Math.sin(walk) * 2.5 : 0;
        g.fillStyle = "rgba(0,0,0,0.28)";
        g.beginPath();
        g.ellipse(x + 16, y + 29, 9, 3, 0, 0, Math.PI * 2);
        g.fill();
        y -= bob;
        g.fillStyle = "#3a2a20";
        g.fillRect(x + 11, y + 22, 4, 7 + leg);
        g.fillRect(x + 17, y + 22, 4, 7 - leg);
        const body = acol || c.body;
        if (c.hood && dir !== 3) {
            g.fillStyle = "#2e5e2c";
            g.fillRect(x + 22, y + 10, 3, 12);
        }
        if (wcol && dir === 3)
            drawWeapon(x + 24, y + 6, wcol, wk, dir);
        if (c.hood && dir === 3) {
            g.fillStyle = "#6b4a2b";
            g.fillRect(x + 8, y + 12, 4, 10);
            g.fillStyle = "#e8e0d0";
            g.fillRect(x + 8, y + 10, 1, 3);
            g.fillRect(x + 10, y + 10, 1, 3);
        }
        g.fillStyle = body;
        g.fillRect(x + 9, y + 13, 14, 10);
        if (c.long || c.robe)
            g.fillRect(x + 8, y + 20, 16, 7);
        if (c.robe) {
            g.fillStyle = "rgba(255,215,120,0.8)";
            g.fillRect(x + 15, y + 13, 2, 14);
        }
        if (c.apron) {
            g.fillStyle = "#3a2a1a";
            g.fillRect(x + 11, y + 15, 10, 10);
        }
        g.fillStyle = "rgba(0,0,0,0.25)";
        g.fillRect(x + 9, y + 21, 14, 2);
        g.fillStyle = body;
        g.fillRect(x + 6, y + 14, 3, 8);
        g.fillRect(x + 23, y + 14, 3, 8);
        g.fillStyle = c.skin;
        g.fillRect(x + 6, y + 21, 3, 2);
        g.fillRect(x + 23, y + 21, 3, 2);
        g.fillRect(x + 10, y + 3, 12, 11);
        g.fillStyle = c.hair;
        if (dir === 3)
            g.fillRect(x + 10, y + 2, 12, 11);
        else {
            g.fillRect(x + 10, y + 2, 12, 4);
            if (dir === 1)
                g.fillRect(x + 17, y + 2, 5, 9);
            if (dir === 2)
                g.fillRect(x + 10, y + 2, 5, 9);
            if (c.long) {
                g.fillRect(x + 9, y + 4, 3, 11);
                g.fillRect(x + 20, y + 4, 3, 11);
            }
        }
        if (c.helmet) {
            g.fillStyle = "#9aa2ab";
            g.fillRect(x + 9, y + 1, 14, 5);
            g.fillStyle = "#c8ced5";
            g.fillRect(x + 10, y + 1, 12, 1);
            if (c.crest) {
                g.fillStyle = c.crest;
                g.fillRect(x + 14, y - 3, 4, 5);
            }
        }
        if (c.hood) {
            g.fillStyle = "#2e5e2c";
            if (dir === 3)
                g.fillRect(x + 9, y + 1, 14, 13);
            else {
                g.fillRect(x + 9, y + 1, 14, 5);
                g.fillRect(x + 9, y + 4, 2, 9);
                g.fillRect(x + 21, y + 4, 2, 9);
            }
            g.fillStyle = "#c8403a";
            g.fillRect(x + 21, y - 2, 2, 6);
        }
        if (c.wiz) {
            g.fillStyle = c.hat || "#3a2a7a";
            g.fillRect(x + 7, y + 2, 18, 3);
            g.beginPath();
            g.moveTo(x + 9, y + 3);
            g.lineTo(x + 23, y + 3);
            g.lineTo(x + 18 + Math.sin(time * 2) * 1.5, y - 11);
            g.closePath();
            g.fill();
            g.fillStyle = "#ffd25a";
            g.fillRect(x + 15, y - 3, 2, 2);
        }
        if (c.crown) {
            g.fillStyle = "#ffd25a";
            g.fillRect(x + 10, y - 1, 12, 3);
            g.fillRect(x + 10, y - 4, 2, 3);
            g.fillRect(x + 15, y - 5, 2, 4);
            g.fillRect(x + 20, y - 4, 2, 3);
        }
        if (dir !== 3) {
            g.fillStyle = c.eye || "#1a1a1a";
            if (dir === 0) {
                g.fillRect(x + 13, y + 8, 2, 2);
                g.fillRect(x + 17, y + 8, 2, 2);
            }
            if (dir === 1)
                g.fillRect(x + 11, y + 8, 2, 2);
            if (dir === 2)
                g.fillRect(x + 19, y + 8, 2, 2);
            if (c.beard) {
                g.fillStyle = c.hair;
                g.fillRect(x + 11, y + 11, 10, 4);
            }
        }
        if (c.wrap) {
            g.fillStyle = "rgba(120,100,70,0.5)";
            for (let i = 0; i < 4; i++)
                g.fillRect(x + 9, y + 5 + i * 5, 14, 1);
        }
        if (wcol && dir !== 3)
            drawWeapon(dir === 1 ? x + 3 : x + 24, y + 8, wcol, wk, dir);
        if (flash) {
            g.fillStyle = "rgba(255,80,60,0.45)";
            g.fillRect(x + 6, y + 2, 20, 27);
        }
    }
    function label(cx, y, t, col) {
        ctx.font = "bold 10px " + FONT;
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        const w = ctx.measureText(t).width;
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(cx - w / 2 - 3, y - 10, w + 6, 13);
        ctx.fillStyle = col;
        ctx.fillText(t, cx, y);
    }
    function drawMob(m) {
        const p = rpos(m);
        let x = p[0], y = p[1];
        const g = ctx;
        const k = m.d.as || m.k;
        const flash = m.hit > 0;
        const tint = m.d.tint && "filter" in g ? m.d.tint : "";
        if (tint)
            g.filter = tint;
        const walk = m.mt < 1 ? time * 14 : 0;
        if (m.anim > 0) {
            const s = Math.sin((m.anim / 0.2) * Math.PI) * 4;
            const D = [[0, 1], [-1, 0], [1, 0], [0, -1]][m.dir];
            x += D[0] * s;
            y += D[1] * s;
        }
        const sc = m.d.sc || 1;
        const bx0 = x, by0 = y;
        if (sc !== 1) {
            g.save();
            g.translate(x + 16, y + 30);
            g.scale(sc, sc);
            g.translate(-16, -30);
            x = 0;
            y = 0;
        }
        const left = m.dir === 1;
        const fl = (rx, ry, w, h) => { g.fillRect(left ? x + 32 - rx - w : x + rx, y + ry, w, h); };
        const shadow = (w) => { g.fillStyle = "rgba(0,0,0,0.28)"; g.beginPath(); g.ellipse(x + 16, y + 28, w, 4, 0, 0, Math.PI * 2); g.fill(); };
        const leg = walk ? Math.sin(walk) * 2 : 0;
        const glow = (cx, cy, r, col) => { const gr = g.createRadialGradient(cx, cy, 1, cx, cy, r); gr.addColorStop(0, col); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(cx - r, cy - r, r * 2, r * 2); };
        if (m.d.hum) {
            if (m.d.glow)
                glow(x + 16, y + 14, 32, m.d.glow);
            drawHuman(x, y + (m.d.boss ? -3 + Math.sin(time * 2.2) * 2 : 0), m.dir, m.d.boss ? 0 : walk, m.d.hum, m.d.hw || null, null, flash, 0, m.d.hwk);
        }
        else if (k === "goblin")
            drawHuman(x, y, m.dir, walk, { body: "#5a4a2a", skin: "#6aa84f", hair: "#3d5f2a", eye: "#ff3030" }, "#8a8f96", null, flash, 0);
        else if (k === "skel") {
            drawHuman(x, y, m.dir, walk, { body: "#d8d2c0", skin: "#ece6d4", hair: "#ece6d4", eye: "#ff4040" }, "#7a7f88", null, flash, 0);
            g.fillStyle = "#3a3640";
            g.fillRect(x + 11, y + 15, 10, 1);
            g.fillRect(x + 11, y + 18, 10, 1);
        }
        else if (k === "drowner") {
            drawHuman(x, y, m.dir, walk, { body: "#3f5a4a", skin: "#7a9a80", hair: "#2a4a2a", eye: "#d0ff60", long: true }, null, null, flash, 0);
            g.fillStyle = "#4a7a3a";
            g.fillRect(x + 10, y + 14, 2, 8);
            g.fillRect(x + 19, y + 16, 2, 7);
        }
        else if (k === "mummy")
            drawHuman(x, y, m.dir, walk, { body: "#d8cfae", skin: "#d8cfae", hair: "#cfc39e", eye: "#ffd84a", wrap: true }, null, null, flash, 0);
        else if (k === "witch") {
            glow(x + 16, y + 16, 30, "rgba(140,255,120,0.35)");
            drawHuman(x, y + Math.sin(time * 2) * 1.5, m.dir, 0, { body: "#2a3a2a", skin: "#9ab07a", hair: "#1a1a1a", eye: "#c8ff40", long: true, robe: true, wiz: true, hat: "#1a1a1a" }, "#9dff7a", null, flash, 0, "staff");
        }
        else if (k === "king") {
            glow(x + 16, y + 14, 34, "rgba(197,140,255,0.4)");
            drawHuman(x, y - 4 + Math.sin(time * 2.2) * 2, m.dir, 0, { body: "#2a1a3a", skin: "#b8aac8", hair: "#1a1022", eye: "#ff4fd8", robe: true, crown: true }, "#c58cff", null, flash, 0, "staff");
        }
        else {
            if (k !== "wisp" && k !== "ielem" && k !== "boss")
                shadow(k === "dragon" ? 15 : 11);
            if (k === "rat") {
                g.fillStyle = "#d89a9a";
                fl(2, 22, 8, 2);
                g.fillStyle = "#8a7f73";
                fl(8, 17, 14, 9);
                fl(20, 15, 7, 8);
                g.fillStyle = "#6e645a";
                fl(19, 13, 3, 3);
                fl(10, 25, 3, 3 + leg);
                fl(18, 25, 3, 3 - leg);
                g.fillStyle = "#e05050";
                fl(24, 17, 2, 2);
                g.fillStyle = "#f0b0b0";
                fl(27, 19, 2, 2);
            }
            else if (k === "wolf" || k === "swolf") {
                const sn = k === "swolf";
                g.fillStyle = sn ? "#c8d0dc" : "#6d7076";
                fl(2, 12, 6, 3);
                g.fillStyle = sn ? "#eef2f8" : "#8d8f94";
                fl(6, 13, 18, 10);
                fl(21, 8, 9, 9);
                g.fillStyle = sn ? "#c8d0dc" : "#6d7076";
                fl(22, 5, 3, 4);
                fl(27, 5, 3, 4);
                fl(8, 22, 3, 6 + leg);
                fl(19, 22, 3, 6 - leg);
                fl(12, 22, 3, 5 - leg);
                g.fillStyle = sn ? "#ffffff" : "#c8cacf";
                fl(8, 19, 14, 3);
                g.fillStyle = sn ? "#6fd8ff" : "#ffd84a";
                fl(26, 10, 2, 2);
                g.fillStyle = "#222";
                fl(29, 13, 2, 2);
            }
            else if (k === "boar") {
                g.fillStyle = "#5b3b25";
                fl(4, 12, 20, 13);
                fl(20, 13, 9, 10);
                g.fillStyle = "#3e2716";
                fl(6, 10, 16, 3);
                fl(7, 24, 3, 4 + leg);
                fl(18, 24, 3, 4 - leg);
                g.fillStyle = "#c48a6a";
                fl(27, 17, 4, 5);
                g.fillStyle = "#f1ead6";
                fl(26, 21, 2, 4);
                fl(29, 21, 2, 4);
                g.fillStyle = "#111";
                fl(24, 15, 2, 2);
            }
            else if (k === "spider" || k === "scorp") {
                if (k === "spider") {
                    g.strokeStyle = "#1a1418";
                    g.lineWidth = 2;
                    for (let i = 0; i < 4; i++) {
                        const yy = y + 15 + i * 3, w2 = Math.sin(time * 10 + i) * (m.mt < 1 ? 2 : 0.5);
                        g.beginPath();
                        g.moveTo(x + 12, yy);
                        g.lineTo(x + 4, yy - 5 + w2);
                        g.lineTo(x + 1, yy + 6);
                        g.stroke();
                        g.beginPath();
                        g.moveTo(x + 20, yy);
                        g.lineTo(x + 28, yy - 5 - w2);
                        g.lineTo(x + 31, yy + 6);
                        g.stroke();
                    }
                    g.fillStyle = "#2a2028";
                    g.beginPath();
                    g.ellipse(x + 16, y + 20, 8, 7, 0, 0, Math.PI * 2);
                    g.fill();
                    g.fillStyle = "#3a2c38";
                    g.beginPath();
                    g.ellipse(x + 16, y + 12, 5, 4, 0, 0, Math.PI * 2);
                    g.fill();
                    g.fillStyle = "#c03030";
                    g.fillRect(x + 13, y + 20, 6, 2);
                    g.fillStyle = "#ff3a3a";
                    g.fillRect(x + 13, y + 11, 2, 2);
                    g.fillRect(x + 17, y + 11, 2, 2);
                }
                else {
                    g.strokeStyle = "#7a4a1a";
                    g.lineWidth = 2;
                    for (let i = 0; i < 3; i++) {
                        const yy = y + 19 + i * 3, w2 = Math.sin(time * 12 + i) * (m.mt < 1 ? 2 : 0.4);
                        g.beginPath();
                        g.moveTo(x + 11, yy);
                        g.lineTo(x + 4, yy + 4 + w2);
                        g.stroke();
                        g.beginPath();
                        g.moveTo(x + 21, yy);
                        g.lineTo(x + 28, yy + 4 - w2);
                        g.stroke();
                    }
                    g.fillStyle = "#b8742a";
                    g.beginPath();
                    g.ellipse(x + 16, y + 21, 7, 6, 0, 0, Math.PI * 2);
                    g.fill();
                    g.fillStyle = "#d08a3a";
                    g.fillRect(x + 4, y + 12, 6, 5);
                    g.fillRect(x + 22, y + 12, 6, 5);
                    g.fillRect(x + 7, y + 15, 3, 5);
                    g.fillRect(x + 22, y + 15, 3, 5);
                    g.strokeStyle = "#c27a30";
                    g.lineWidth = 3;
                    g.beginPath();
                    g.moveTo(x + 16, y + 26);
                    g.quadraticCurveTo(x + 30, y + 22, x + 22, y + 6 + Math.sin(time * 4) * 1.5);
                    g.stroke();
                    g.fillStyle = "#3a1a0a";
                    g.fillRect(x + 20, y + 3, 4, 4);
                    g.fillStyle = "#111";
                    g.fillRect(x + 13, y + 17, 2, 2);
                    g.fillRect(x + 17, y + 17, 2, 2);
                }
            }
            else if (k === "boss") {
                const yy = y - 10 + Math.sin(time * 2.5) * 3;
                glow(x + 16, yy + 18, 34, "rgba(197,140,255,0.45)");
                g.fillStyle = "rgba(120,90,170,0.9)";
                g.beginPath();
                g.moveTo(x + 2, yy + 36);
                for (let i = 0; i <= 6; i++)
                    g.lineTo(x + 2 + i * 4.67, yy + 36 + (i % 2 ? -5 : 0) + Math.sin(time * 6 + i) * 2);
                g.lineTo(x + 30, yy + 14);
                g.quadraticCurveTo(x + 16, yy - 8, x + 2, yy + 14);
                g.closePath();
                g.fill();
                g.fillStyle = "rgba(60,40,90,0.95)";
                g.beginPath();
                g.ellipse(x + 16, yy + 13, 9, 9, 0, 0, Math.PI * 2);
                g.fill();
                g.fillStyle = "#7fe9ff";
                g.fillRect(x + 11, yy + 11, 3, 3);
                g.fillRect(x + 18, yy + 11, 3, 3);
                g.fillStyle = "rgba(200,170,255,0.8)";
                g.fillRect(x - 2, yy + 18, 5, 3);
                g.fillRect(x + 29, yy + 18, 5, 3);
            }
            else if (k === "wisp") {
                const yy = y + 10 + Math.sin(time * 3 + m.hx) * 4, fl2 = 0.7 + Math.sin(time * 13 + m.hy) * 0.2;
                glow(x + 16, yy, 22, "rgba(200,255,120," + (0.5 * fl2).toFixed(3) + ")");
                g.fillStyle = "#e8ffb0";
                g.beginPath();
                g.arc(x + 16, yy, 5 + fl2 * 2, 0, Math.PI * 2);
                g.fill();
                g.fillStyle = "#ffffff";
                g.beginPath();
                g.arc(x + 15, yy - 1, 2.5, 0, Math.PI * 2);
                g.fill();
                g.fillStyle = "rgba(0,0,0,0.18)";
                g.beginPath();
                g.ellipse(x + 16, y + 28, 6, 2, 0, 0, Math.PI * 2);
                g.fill();
            }
            else if (k === "troll" || k === "yeti") {
                const ye = k === "yeti";
                const c1 = ye ? "#e8eef4" : "#5a6a3a", c2 = ye ? "#c8d4e0" : "#46552c", fc = ye ? "#6a7a8a" : "#7a8a4a";
                g.fillStyle = c2;
                fl(6, 22, 6, 7 + leg);
                fl(20, 22, 6, 7 - leg);
                g.fillStyle = c1;
                g.beginPath();
                g.ellipse(x + 16, y + 17, 12, 10, 0, 0, Math.PI * 2);
                g.fill();
                g.fillStyle = c2;
                fl(2, 13, 6, 14);
                fl(24, 13, 6, 14);
                g.fillStyle = fc;
                g.beginPath();
                g.ellipse(x + (left ? 13 : 19), y + 9, 7, 6, 0, 0, Math.PI * 2);
                g.fill();
                g.fillStyle = ye ? "#1a3a5a" : "#ffd84a";
                fl(19, 7, 2, 2);
                fl(23, 7, 2, 2);
                if (!ye) {
                    g.fillStyle = "#f1ead6";
                    fl(19, 12, 2, 3);
                    fl(24, 12, 2, 3);
                }
            }
            else if (k === "ielem") {
                const yy = y + Math.sin(time * 2 + m.hx) * 3;
                glow(x + 16, yy + 14, 24, "rgba(160,230,255,0.4)");
                g.save();
                g.translate(x + 16, yy + 14);
                g.rotate(Math.sin(time) * 0.2);
                const sh = [[0, -14, 5], [-8, -2, 4], [8, -3, 4], [-3, 8, 4], [5, 7, 3]];
                for (const s of sh) {
                    g.fillStyle = "#8fd8f5";
                    g.beginPath();
                    g.moveTo(s[0], s[1] - s[2] * 1.6);
                    g.lineTo(s[0] + s[2], s[1]);
                    g.lineTo(s[0], s[1] + s[2] * 1.6);
                    g.lineTo(s[0] - s[2], s[1]);
                    g.closePath();
                    g.fill();
                    g.fillStyle = "rgba(255,255,255,0.7)";
                    g.fillRect(s[0] - 1, s[1] - s[2], 1.5, s[2]);
                }
                g.fillStyle = "#1a5a8a";
                g.fillRect(-4, -4, 2, 2);
                g.fillRect(2, -4, 2, 2);
                g.restore();
                g.fillStyle = "rgba(0,0,0,0.15)";
                g.beginPath();
                g.ellipse(x + 16, y + 29, 8, 2, 0, 0, Math.PI * 2);
                g.fill();
            }
            else if (k === "golem") {
                g.fillStyle = "#7a6a4a";
                fl(8, 22, 6, 7 + leg);
                fl(18, 22, 6, 7 - leg);
                g.fillStyle = "#9a8a6a";
                fl(5, 10, 22, 14);
                g.fillStyle = "#867656";
                fl(1, 11, 5, 13);
                fl(26, 11, 5, 13);
                g.fillStyle = "#a89878";
                fl(10, 2, 12, 9);
                const gl2 = 0.6 + 0.4 * Math.sin(time * 3);
                g.fillStyle = "rgba(90,230,255," + gl2.toFixed(3) + ")";
                fl(12, 5, 3, 2);
                fl(17, 5, 3, 2);
                fl(14, 14, 4, 1);
                fl(15, 14, 1, 7);
            }
            else if (k === "dragon") {
                const fl3 = Math.sin(time * 5) * 6;
                g.fillStyle = "#5a92c0";
                g.beginPath();
                g.moveTo(x + 10, y + 12);
                g.lineTo(x - 14, y - 4 + fl3);
                g.lineTo(x - 6, y + 16);
                g.closePath();
                g.fill();
                g.beginPath();
                g.moveTo(x + 22, y + 12);
                g.lineTo(x + 46, y - 4 + fl3);
                g.lineTo(x + 38, y + 16);
                g.closePath();
                g.fill();
                g.fillStyle = "#7fb8e0";
                g.beginPath();
                g.ellipse(x + 16, y + 18, 11, 9, 0, 0, Math.PI * 2);
                g.fill();
                g.strokeStyle = "#7fb8e0";
                g.lineWidth = 5;
                g.beginPath();
                g.moveTo(x + 16, y + 24);
                g.quadraticCurveTo(x + (left ? 34 : -2), y + 30, x + (left ? 36 : -4), y + 20);
                g.stroke();
                g.fillStyle = "#a8d8f5";
                g.fillRect(x + 11, y + 16, 10, 8);
                g.fillStyle = "#6aa4d0";
                g.beginPath();
                g.ellipse(x + (left ? 10 : 22), y + 7, 7, 5, 0, 0, Math.PI * 2);
                g.fill();
                g.fillStyle = "#e8f6ff";
                fl(22, 0, 2, 4);
                fl(27, 1, 2, 4);
                g.fillStyle = "#ffffff";
                fl(24, 5, 2, 2);
                g.fillStyle = "#1a4a7a";
                fl(25, 6, 1, 1);
                if (m.anim > 0) {
                    g.fillStyle = "rgba(200,240,255,0.6)";
                    fl(29, 6, 8, 3);
                }
            }
            if (flash) {
                g.fillStyle = "rgba(255,255,255,0.45)";
                g.fillRect(x + 2, y + 6, 28, 22);
            }
        }
        if (m.frz > 0) {
            g.fillStyle = "rgba(150,220,255,0.38)";
            g.fillRect(x + 4, y + 2, 24, 27);
            g.strokeStyle = "rgba(220,250,255,0.9)";
            g.lineWidth = 1;
            g.strokeRect(x + 4.5, y + 2.5, 23, 26);
        }
        if (sc !== 1) {
            g.restore();
            x = bx0;
            y = by0;
        }
        if (tint)
            g.filter = "none";
        const tgt = pl.target === m, hv = hover && hover.m === m;
        const top = y - (sc - 1) * 30;
        if (m.hp < m.d.hp || tgt || m.d.boss) {
            const bw = m.d.boss ? 44 : 26, bx = x + 16 - bw / 2, by = top - (m.d.boss ? 18 : 6);
            g.fillStyle = "rgba(0,0,0,0.6)";
            g.fillRect(bx - 1, by - 1, bw + 2, 5);
            g.fillStyle = "#d83a2e";
            g.fillRect(bx, by, bw * Math.max(0, m.hp / m.d.hp), 3);
        }
        const dl = m.d.lvl - P.lvl;
        const lc = m.d.boss ? "#e0a8ff" : dl >= 6 ? "#ff5a4a" : dl >= 3 ? "#ffa04a" : dl >= -2 ? "#ffe9a8" : dl >= -5 ? "#8fe08a" : "#a8a8a8";
        label(x + 16, top - (m.d.boss ? 22 : 10), (tgt || hv || m.d.boss ? m.d.n + " · " : "") + "Lv " + m.d.lvl + (m.d.boss ? " ☠" : ""), lc);
        if (tgt) {
            g.strokeStyle = "rgba(255,80,60,0.85)";
            g.lineWidth = 1.5;
            g.beginPath();
            g.ellipse(x + 16, y + 28, 13 * sc, 5 * sc, 0, 0, Math.PI * 2);
            g.stroke();
        }
    }
    function drawNpc(id) {
        const n = NPCS[id];
        const x = n.x * TS, y = n.y * TS;
        let dir = 0;
        if (cheb(n.x, n.y, P.x, P.y) <= 3) {
            const dx = P.x - n.x, dy = P.y - n.y;
            dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0;
        }
        drawHuman(x, y, dir, 0, n.c, n.shop === "smith" || n.shop === "armory" || id === "kapitan" ? "#7a7f88" : null, null, false, 0);
        label(x + 16, y - 3, n.n, "#bfe3ff");
        const mk = npcMark(id);
        if (mk) {
            const bob = Math.sin(time * 4) * 2;
            ctx.font = "bold 18px " + FONT;
            ctx.textAlign = "center";
            ctx.textBaseline = "alphabetic";
            ctx.fillStyle = "#000";
            ctx.fillText(mk, x + 17, y - 15 + bob);
            ctx.fillStyle = mk === "…" ? "#c8c8c8" : "#ffd84a";
            ctx.fillText(mk, x + 16, y - 16 + bob);
        }
    }
    function drawDecor(d) {
        const x = d.x * TS, y = d.y * TS, g = ctx;
        if (d.k === "fire") {
            g.fillStyle = "#5a3a1e";
            g.fillRect(x + 6, y + 24, 20, 4);
            g.fillRect(x + 10, y + 21, 12, 4);
            g.fillStyle = "#7a7a7a";
            for (let i = 0; i < 6; i++)
                g.fillRect(x + 4 + i * 4, y + 27, 3, 3);
            const fc = ["#ff6a1a", "#ffb02e", "#fff07a"];
            for (let i = 0; i < 3; i++) {
                const f = Math.sin(time * 9 + i * 2) * 3;
                g.fillStyle = fc[i];
                g.beginPath();
                g.moveTo(x + 9 + i * 2, y + 24);
                g.lineTo(x + 16, y + 6 + i * 5 + f);
                g.lineTo(x + 23 - i * 2, y + 24);
                g.fill();
            }
            const grd = g.createRadialGradient(x + 16, y + 18, 2, x + 16, y + 18, 60);
            grd.addColorStop(0, "rgba(255,170,60,0.25)");
            grd.addColorStop(1, "rgba(255,170,60,0)");
            g.fillStyle = grd;
            g.fillRect(x - 44, y - 42, 120, 120);
        }
        else if (d.k === "crate") {
            g.fillStyle = "#8a5a2b";
            g.fillRect(x + 4, y + 8, 24, 22);
            g.fillStyle = "#5e3c1c";
            g.fillRect(x + 4, y + 8, 24, 2);
            g.fillRect(x + 4, y + 18, 24, 2);
            g.fillRect(x + 4, y + 8, 2, 22);
            g.fillRect(x + 26, y + 8, 2, 22);
        }
        else if (d.k === "barrel") {
            g.fillStyle = "#7a4a24";
            g.fillRect(x + 7, y + 6, 18, 24);
            g.fillStyle = "#4a4a50";
            g.fillRect(x + 6, y + 10, 20, 2);
            g.fillRect(x + 6, y + 24, 20, 2);
            g.fillStyle = "#9a6a3a";
            g.fillRect(x + 9, y + 6, 3, 24);
        }
        else if (d.k === "lamp") {
            g.fillStyle = "#3a2a1a";
            g.fillRect(x + 14, y + 6, 3, 24);
            g.fillRect(x + 14, y + 6, 9, 2);
            const fl = 0.7 + Math.sin(time * 7 + d.x) * 0.15;
            g.fillStyle = "#ffd27a";
            g.fillRect(x + 19, y + 8, 6, 7);
            const grd = g.createRadialGradient(x + 22, y + 12, 1, x + 22, y + 12, 46);
            grd.addColorStop(0, "rgba(255,200,110," + (0.35 * fl).toFixed(3) + ")");
            grd.addColorStop(1, "rgba(255,200,110,0)");
            g.fillStyle = grd;
            g.fillRect(x - 24, y - 34, 92, 92);
        }
        else if (d.k === "banner") {
            g.fillStyle = "#4a3a2a";
            g.fillRect(x + 14, y - 6, 3, 36);
            const w = Math.sin(time * 3 + d.x) * 2;
            g.fillStyle = "#2f58b0";
            g.beginPath();
            g.moveTo(x + 17, y - 4);
            g.lineTo(x + 30 + w, y - 2);
            g.lineTo(x + 28 + w, y + 14);
            g.lineTo(x + 17, y + 12);
            g.closePath();
            g.fill();
            g.fillStyle = "#e8e8f0";
            g.fillRect(x + 21 + w * 0.5, y + 2, 4, 4);
        }
        else if (d.k === "shrine") {
            g.fillStyle = "rgba(0,0,0,0.25)";
            g.beginPath();
            g.ellipse(x + 16, y + 28, 11, 4, 0, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = "#8a8e98";
            g.fillRect(x + 8, y + 10, 16, 19);
            g.fillStyle = "#a8acb6";
            g.fillRect(x + 6, y + 7, 20, 4);
            g.fillStyle = "#5a5e68";
            g.fillRect(x + 13, y + 14, 6, 8);
            const fl = 0.6 + Math.sin(time * 8) * 0.2;
            g.fillStyle = "#fff0a0";
            g.fillRect(x + 15, y + 15, 2, 4);
            const grd = g.createRadialGradient(x + 16, y + 16, 1, x + 16, y + 16, 40);
            grd.addColorStop(0, "rgba(255,240,170," + (0.35 * fl).toFixed(3) + ")");
            grd.addColorStop(1, "rgba(255,240,170,0)");
            g.fillStyle = grd;
            g.fillRect(x - 24, y - 24, 80, 80);
        }
        else if (d.k === "tent") {
            g.fillStyle = "rgba(0,0,0,0.25)";
            g.beginPath();
            g.ellipse(x + 16, y + 29, 16, 4, 0, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = "#b8483a";
            g.beginPath();
            g.moveTo(x - 2, y + 30);
            g.lineTo(x + 16, y - 2);
            g.lineTo(x + 34, y + 30);
            g.closePath();
            g.fill();
            g.fillStyle = "#e8d8b0";
            g.beginPath();
            g.moveTo(x + 6, y + 30);
            g.lineTo(x + 16, y + 6);
            g.lineTo(x + 26, y + 30);
            g.closePath();
            g.fill();
            g.fillStyle = "#3a2418";
            g.beginPath();
            g.moveTo(x + 12, y + 30);
            g.lineTo(x + 16, y + 16);
            g.lineTo(x + 20, y + 30);
            g.closePath();
            g.fill();
        }
    }
    function drawBag(b) {
        const x = b.x * TS, y = b.y * TS + Math.sin(time * 3 + b.x) * 1.5, g = ctx;
        g.fillStyle = "rgba(0,0,0,0.25)";
        g.beginPath();
        g.ellipse(x + 16, y + 27, 8, 3, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#a0723c";
        g.beginPath();
        g.ellipse(x + 16, y + 21, 8, 7, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#7a5228";
        g.fillRect(x + 12, y + 12, 8, 4);
        g.fillStyle = "#f5d98a";
        g.fillRect(x + 14, y + 19, 4, 4);
        if (Math.sin(time * 5 + b.y) > 0.7) {
            g.fillStyle = "#fff8c0";
            g.fillRect(x + 21, y + 13, 2, 2);
        }
    }
    function drawIcon(id, x, y, s) {
        const it = ITEMS[id], g = ctx, k = s / 32;
        if (!it)
            return;
        g.save();
        g.translate(x, y);
        g.scale(k, k);
        const c = it.c;
        switch (it.ic) {
            case "sword":
                g.translate(16, 16);
                g.rotate(-Math.PI / 4);
                g.fillStyle = c;
                g.fillRect(-2, -14, 4, 20);
                g.fillStyle = "rgba(255,255,255,0.5)";
                g.fillRect(-2, -14, 1, 19);
                g.fillStyle = "#6b4a2b";
                g.fillRect(-6, 6, 12, 3);
                g.fillRect(-1.5, 9, 3, 6);
                break;
            case "club":
                g.translate(16, 16);
                g.rotate(-Math.PI / 4);
                g.fillStyle = c;
                g.fillRect(-3, -13, 7, 14);
                g.fillStyle = "#6b4a2b";
                g.fillRect(-1.5, 1, 3, 13);
                break;
            case "axe":
                g.translate(16, 16);
                g.rotate(-Math.PI / 4);
                g.fillStyle = "#6b4a2b";
                g.fillRect(-1.5, -12, 3, 26);
                g.fillStyle = c;
                g.beginPath();
                g.moveTo(1, -12);
                g.lineTo(11, -15);
                g.lineTo(11, -1);
                g.lineTo(1, -4);
                g.fill();
                break;
            case "bow":
                g.strokeStyle = c;
                g.lineWidth = 3;
                g.beginPath();
                g.moveTo(8, 4);
                g.quadraticCurveTo(30, 16, 8, 28);
                g.stroke();
                g.strokeStyle = "#f0f0f0";
                g.lineWidth = 1;
                g.beginPath();
                g.moveTo(8, 4);
                g.lineTo(8, 28);
                g.stroke();
                g.fillStyle = "#c9d1d9";
                g.fillRect(6, 15, 18, 2);
                g.beginPath();
                g.moveTo(24, 13);
                g.lineTo(28, 16);
                g.lineTo(24, 19);
                g.fill();
                break;
            case "staff":
                g.translate(16, 16);
                g.rotate(Math.PI / 5);
                g.fillStyle = "#6b4a2b";
                g.fillRect(-1.5, -9, 3, 24);
                g.fillStyle = c;
                g.beginPath();
                g.arc(0, -11, 5, 0, Math.PI * 2);
                g.fill();
                g.fillStyle = "rgba(255,255,255,0.6)";
                g.fillRect(-2, -14, 2, 2);
                break;
            case "shirt":
            case "armor":
            case "robe":
                g.fillStyle = c;
                g.fillRect(8, 8, 16, 18);
                g.fillRect(3, 8, 6, 10);
                g.fillRect(23, 8, 6, 10);
                g.fillStyle = "rgba(0,0,0,0.25)";
                g.fillRect(13, 8, 6, 4);
                if (it.ic === "armor") {
                    g.fillStyle = "rgba(255,255,255,0.3)";
                    g.fillRect(10, 14, 12, 2);
                    g.fillRect(10, 19, 12, 2);
                }
                if (it.ic === "robe") {
                    g.fillStyle = c;
                    g.fillRect(6, 24, 20, 5);
                    g.fillStyle = "#ffd25a";
                    g.fillRect(15, 12, 2, 17);
                }
                break;
            case "pot":
                g.fillStyle = "#cfd8e0";
                g.fillRect(13, 4, 6, 6);
                g.fillStyle = "#8a5a2b";
                g.fillRect(13, 3, 6, 3);
                g.fillStyle = c;
                g.beginPath();
                g.arc(16, 19, 9, 0, Math.PI * 2);
                g.fill();
                g.fillStyle = "rgba(255,255,255,0.5)";
                g.fillRect(11, 14, 3, 4);
                break;
            case "tail":
                g.strokeStyle = c;
                g.lineWidth = 3;
                g.beginPath();
                g.moveTo(6, 24);
                g.quadraticCurveTo(16, 4, 26, 20);
                g.stroke();
                break;
            case "pelt":
                g.fillStyle = c;
                g.beginPath();
                g.moveTo(6, 8);
                g.lineTo(26, 8);
                g.lineTo(28, 26);
                g.lineTo(16, 22);
                g.lineTo(4, 26);
                g.closePath();
                g.fill();
                g.fillStyle = "rgba(0,0,0,0.25)";
                g.fillRect(10, 12, 12, 2);
                break;
            case "tusk":
                g.fillStyle = c;
                g.beginPath();
                g.moveTo(8, 26);
                g.quadraticCurveTo(10, 6, 26, 6);
                g.quadraticCurveTo(14, 12, 13, 26);
                g.closePath();
                g.fill();
                break;
            case "ear":
                g.fillStyle = c;
                g.beginPath();
                g.moveTo(8, 24);
                g.lineTo(26, 6);
                g.lineTo(20, 26);
                g.closePath();
                g.fill();
                break;
            case "silk":
                g.strokeStyle = c;
                g.lineWidth = 1.5;
                for (let i = 0; i < 4; i++) {
                    g.beginPath();
                    g.arc(16, 16, 3 + i * 3.5, 0, Math.PI * 2);
                    g.stroke();
                }
                break;
            case "bone":
                g.translate(16, 16);
                g.rotate(-Math.PI / 4);
                g.fillStyle = c;
                g.fillRect(-2, -10, 4, 20);
                g.beginPath();
                g.arc(-2.5, -11, 3, 0, 7);
                g.arc(2.5, -11, 3, 0, 7);
                g.fill();
                g.beginPath();
                g.arc(-2.5, 11, 3, 0, 7);
                g.arc(2.5, 11, 3, 0, 7);
                g.fill();
                break;
            case "gem":
                g.fillStyle = c;
                g.beginPath();
                g.moveTo(16, 4);
                g.lineTo(26, 14);
                g.lineTo(16, 28);
                g.lineTo(6, 14);
                g.closePath();
                g.fill();
                g.fillStyle = "rgba(255,255,255,0.6)";
                g.fillRect(12, 10, 4, 4);
                break;
            case "drop":
                g.fillStyle = c;
                g.beginPath();
                g.moveTo(16, 4);
                g.quadraticCurveTo(28, 20, 16, 28);
                g.quadraticCurveTo(4, 20, 16, 4);
                g.fill();
                g.fillStyle = "rgba(255,255,255,0.4)";
                g.fillRect(12, 16, 3, 5);
                break;
            case "orb":
                g.fillStyle = "rgba(200,255,120,0.35)";
                g.beginPath();
                g.arc(16, 16, 13, 0, 7);
                g.fill();
                g.fillStyle = c;
                g.beginPath();
                g.arc(16, 16, 8, 0, 7);
                g.fill();
                g.fillStyle = "#fff";
                g.beginPath();
                g.arc(14, 14, 3, 0, 7);
                g.fill();
                break;
            case "scarab":
                g.fillStyle = c;
                g.beginPath();
                g.ellipse(16, 18, 8, 10, 0, 0, 7);
                g.fill();
                g.fillStyle = "rgba(0,0,0,0.3)";
                g.fillRect(15.5, 9, 1, 19);
                g.fillStyle = c;
                g.beginPath();
                g.arc(16, 7, 4, 0, 7);
                g.fill();
                g.fillRect(5, 14, 4, 2);
                g.fillRect(23, 14, 4, 2);
                g.fillRect(5, 21, 4, 2);
                g.fillRect(23, 21, 4, 2);
                break;
            case "relic":
                g.fillStyle = c;
                g.beginPath();
                g.ellipse(16, 9, 5, 6, 0, 0, 7);
                g.lineWidth = 3;
                g.strokeStyle = c;
                g.stroke();
                g.fillRect(14.5, 14, 3, 14);
                g.fillRect(8, 16, 16, 3);
                break;
            case "letter":
                g.fillStyle = c;
                g.fillRect(5, 8, 22, 16);
                g.strokeStyle = "#8a6238";
                g.lineWidth = 1.5;
                g.beginPath();
                g.moveTo(5, 8);
                g.lineTo(16, 17);
                g.lineTo(27, 8);
                g.stroke();
                g.fillStyle = "#c0392b";
                g.beginPath();
                g.arc(16, 17, 3, 0, 7);
                g.fill();
                break;
        }
        g.restore();
    }
    function drawSkillIcon(ic, cx, cy, r) {
        const g = ctx;
        g.save();
        g.translate(cx, cy);
        const s = r / 16;
        g.scale(s, s);
        g.lineCap = "round";
        switch (ic) {
            case "smash":
                g.fillStyle = "#c9d1d9";
                g.save();
                g.rotate(-Math.PI / 4);
                g.fillRect(-2, -12, 4, 16);
                g.fillStyle = "#6b4a2b";
                g.fillRect(-5, 4, 10, 3);
                g.fillRect(-1.5, 7, 3, 6);
                g.restore();
                g.strokeStyle = "#ffb347";
                g.lineWidth = 2;
                for (let i = 0; i < 5; i++) {
                    const a = -1.9 + i * 0.5;
                    g.beginPath();
                    g.moveTo(Math.cos(a) * 9, Math.sin(a) * 9 - 2);
                    g.lineTo(Math.cos(a) * 13, Math.sin(a) * 13 - 2);
                    g.stroke();
                }
                break;
            case "whirl":
                g.strokeStyle = "#ffcf7a";
                g.lineWidth = 2.5;
                for (let i = 0; i < 3; i++) {
                    g.beginPath();
                    g.arc(0, 0, 4 + i * 3.5, i * 2, i * 2 + 4);
                    g.stroke();
                }
                break;
            case "shout":
                g.fillStyle = "#ffb347";
                g.beginPath();
                g.moveTo(-9, -3);
                g.lineTo(-2, -7);
                g.lineTo(-2, 7);
                g.lineTo(-9, 3);
                g.closePath();
                g.fill();
                g.strokeStyle = "#ffe0a0";
                g.lineWidth = 2;
                for (let i = 0; i < 3; i++) {
                    g.beginPath();
                    g.arc(-2, 0, 5 + i * 3.5, -0.8, 0.8);
                    g.stroke();
                }
                break;
            case "aim":
                g.strokeStyle = "#ffe08a";
                g.lineWidth = 2;
                g.beginPath();
                g.arc(0, 0, 9, 0, 7);
                g.stroke();
                g.beginPath();
                g.arc(0, 0, 4, 0, 7);
                g.stroke();
                g.beginPath();
                g.moveTo(-13, 0);
                g.lineTo(-6, 0);
                g.moveTo(13, 0);
                g.lineTo(6, 0);
                g.moveTo(0, -13);
                g.lineTo(0, -6);
                g.moveTo(0, 13);
                g.lineTo(0, 6);
                g.stroke();
                break;
            case "rain":
                g.strokeStyle = "#e8e0c8";
                g.lineWidth = 2;
                for (let i = -1; i <= 1; i++) {
                    g.beginPath();
                    g.moveTo(i * 6, -11 + Math.abs(i) * 3);
                    g.lineTo(i * 6, 6 + Math.abs(i) * 3);
                    g.stroke();
                    g.fillStyle = "#c9d1d9";
                    g.beginPath();
                    g.moveTo(i * 6 - 3, 5 + Math.abs(i) * 3);
                    g.lineTo(i * 6 + 3, 5 + Math.abs(i) * 3);
                    g.lineTo(i * 6, 10 + Math.abs(i) * 3);
                    g.fill();
                }
                break;
            case "eye":
                g.fillStyle = "#e8f8e0";
                g.beginPath();
                g.moveTo(-12, 0);
                g.quadraticCurveTo(0, -10, 12, 0);
                g.quadraticCurveTo(0, 10, -12, 0);
                g.fill();
                g.fillStyle = "#3f9a3a";
                g.beginPath();
                g.arc(0, 0, 4.5, 0, 7);
                g.fill();
                g.fillStyle = "#111";
                g.beginPath();
                g.arc(0, 0, 2, 0, 7);
                g.fill();
                break;
            case "fire":
                g.fillStyle = "#ff6a1a";
                g.beginPath();
                g.moveTo(-8, 8);
                g.quadraticCurveTo(-10, -4, 0, -13);
                g.quadraticCurveTo(10, -4, 8, 8);
                g.closePath();
                g.fill();
                g.fillStyle = "#ffd25a";
                g.beginPath();
                g.moveTo(-4, 8);
                g.quadraticCurveTo(-5, -1, 0, -6);
                g.quadraticCurveTo(5, -1, 4, 8);
                g.closePath();
                g.fill();
                break;
            case "frost":
                g.strokeStyle = "#bff2ff";
                g.lineWidth = 2;
                for (let i = 0; i < 3; i++) {
                    const a = i * Math.PI / 3;
                    g.beginPath();
                    g.moveTo(Math.cos(a) * -12, Math.sin(a) * -12);
                    g.lineTo(Math.cos(a) * 12, Math.sin(a) * 12);
                    g.stroke();
                }
                g.beginPath();
                g.arc(0, 0, 3, 0, 7);
                g.stroke();
                break;
            case "heal":
                g.fillStyle = "#7dff8a";
                g.fillRect(-3.5, -11, 7, 22);
                g.fillRect(-11, -3.5, 22, 7);
                g.fillStyle = "rgba(255,255,255,0.5)";
                g.fillRect(-3.5, -11, 2, 22);
                break;
        }
        g.restore();
    }
    // ---------- DRAW: UI HELPERS ----------
    const COL = { bg: "rgba(24,19,30,0.94)", bd: "#c9a45c", title: "#f5d98a", text: "#efe6d2", mute: "#a89c86", btn: "#3b3046", btnH: "#4d3f5c", good: "#7dff8a", bad: "#ff8a7a" };
    function rr(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }
    function box(x, y, w, h) {
        rr(x, y, w, h, 8);
        ctx.fillStyle = COL.bg;
        ctx.fill();
        ctx.strokeStyle = COL.bd;
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
    function text(t, x, y, size, col, align, bold) {
        ctx.font = (bold ? "bold " : "") + size + "px " + FONT;
        ctx.textAlign = align || "left";
        ctx.textBaseline = "middle";
        ctx.fillStyle = col;
        ctx.fillText(t, x, y);
    }
    function wrap(t, maxW, size) {
        ctx.font = size + "px " + FONT;
        const words = t.split(" ");
        const lines = [];
        let cur = "";
        for (const w of words) {
            const n = cur ? cur + " " + w : w;
            if (ctx.measureText(n).width > maxW && cur) {
                lines.push(cur);
                cur = w;
            }
            else
                cur = n;
        }
        if (cur)
            lines.push(cur);
        return lines;
    }
    function button(x, y, w, h, lbl, fn, o) {
        const dis = o && o.dis;
        const hv = mouse && mouse.x >= x && mouse.x <= x + w && mouse.y >= y && mouse.y <= y + h;
        rr(x, y, w, h, 6);
        ctx.fillStyle = dis ? "rgba(60,55,65,0.8)" : o && o.col ? o.col : hv ? COL.btnH : COL.btn;
        ctx.fill();
        ctx.strokeStyle = dis ? "#6a6070" : COL.bd;
        ctx.lineWidth = 1;
        ctx.stroke();
        text(lbl, x + w / 2, y + h / 2 + 0.5, (o && o.fs) || 13, dis ? "#8a8090" : COL.text, "center", true);
        if (!dis)
            ui.push({ x, y, w, h, fn });
    }
    function closeBtn(x, y, fn) { button(x - 32, y + 6, 26, 26, "✕", fn, { fs: 13 }); }
    function bar(x, y, w, h, v, col, bg) {
        ctx.fillStyle = bg;
        rr(x, y, w, h, h / 2);
        ctx.fill();
        if (v > 0) {
            ctx.fillStyle = col;
            rr(x, y, Math.max(h, w * clamp(v, 0, 1)), h, h / 2);
            ctx.fill();
        }
    }
    // ---------- DRAW: MAIN ----------
    function drawPlayerAt(x, y, dir, walk, flash, lunge) {
        const w = P.eq.w ? ITEMS[P.eq.w].c : null, ar = P.eq.a && P.eq.a !== "shirt" ? ITEMS[P.eq.a].c : null;
        drawHuman(x, y, dir, walk, C().look, w, ar, flash, lunge, C().wk);
    }
    function arrowTri(cx, cy, ang, sz, col) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(sz, 0);
        ctx.lineTo(-sz * 0.7, -sz * 0.75);
        ctx.lineTo(-sz * 0.35, 0);
        ctx.lineTo(-sz * 0.7, sz * 0.75);
        ctx.closePath();
        ctx.fillStyle = col;
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.75)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
    }
    function draw() {
        ui = [];
        const a = A();
        if (!a.img)
            renderArea(a);
        const info = AINFO[a.id];
        const isSmall = W < 520;
        S = clamp(Math.min(W / (isSmall ? 11.5 : 15), H / 11) / TS, 0.7, 2);
        const vw = W / S, vh = H / S;
        const pp = rpos(pl2());
        const mw = a.w * TS, mh = a.h * TS;
        camX = mw <= vw ? (mw - vw) / 2 : clamp(pp[0] + 16 - vw / 2, 0, mw - vw);
        camY = mh <= vh ? (mh - vh) / 2 : clamp(pp[1] + 16 - vh / 2, 0, mh - vh);
        camX = Math.round(camX * S) / S;
        camY = Math.round(camY * S) / S;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = info.bg;
        ctx.fillRect(0, 0, W, H);
        ctx.save();
        ctx.scale(S, S);
        ctx.translate(-camX, -camY);
        ctx.imageSmoothingEnabled = false;
        if (a.img) {
            const sx = Math.max(0, Math.floor(camX)), sy = Math.max(0, Math.floor(camY));
            const sw = Math.min(mw - sx, Math.ceil(vw) + 2), sh = Math.min(mh - sy, Math.ceil(vh) + 2);
            if (sw > 0 && sh > 0)
                ctx.drawImage(a.img, sx, sy, sw, sh, sx, sy, sw, sh);
        }
        const tx0 = Math.max(0, Math.floor(camX / TS)), ty0 = Math.max(0, Math.floor(camY / TS));
        const tx1 = Math.min(a.w - 1, Math.ceil((camX + vw) / TS)), ty1 = Math.min(a.h - 1, Math.ceil((camY + vh) / TS));
        for (let y = ty0; y <= ty1; y++)
            for (let x = tx0; x <= tx1; x++) {
                const t = gt(a, x, y);
                if (t === WATER || t === FOUNT) {
                    const o = (Math.sin(time * 1.6 + x * 0.9 + y * 0.6) + 1) * 6;
                    ctx.fillStyle = "rgba(200,235,255,0.35)";
                    ctx.fillRect(x * TS + 4 + o, y * TS + 10 + ((x * 7) % 12), 7, 2);
                }
                else if (t === BOG) {
                    const ph = (time * 0.7 + x * 0.37 + y * 0.61) % 3;
                    if (ph < 0.6) {
                        ctx.strokeStyle = "rgba(160,190,120," + (0.6 - ph).toFixed(3) + ")";
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.arc(x * TS + 10 + (x * 5) % 12, y * TS + 12 + (y * 7) % 10, 1 + ph * 5, 0, Math.PI * 2);
                        ctx.stroke();
                    }
                }
                else if (t === PORTAL) {
                    const gl = 0.35 + Math.sin(time * 3) * 0.15;
                    const grd = ctx.createRadialGradient(x * TS + 16, y * TS + 22, 2, x * TS + 16, y * TS + 22, 26);
                    grd.addColorStop(0, "rgba(197,140,255," + gl.toFixed(3) + ")");
                    grd.addColorStop(1, "rgba(197,140,255,0)");
                    ctx.fillStyle = grd;
                    ctx.fillRect(x * TS - 12, y * TS - 8, 56, 56);
                }
            }
        for (const e of a.exits)
            if (gt(a, e.x, e.y) !== PORTAL) {
                const al = 0.25 + Math.sin(time * 3) * 0.12;
                ctx.fillStyle = "rgba(255,230,140," + al.toFixed(3) + ")";
                ctx.fillRect(e.x * TS + 4, e.y * TS + 4, 24, 24);
            }
        for (const w of warns)
            if (w.area === P.area) {
                const k = 1 - w.t / w.max, x0 = (w.x - w.r) * TS, y0 = (w.y - w.r) * TS, s2 = (w.r * 2 + 1) * TS;
                ctx.fillStyle = "rgba(255,40,30," + (0.15 + k * 0.35).toFixed(3) + ")";
                ctx.fillRect(x0, y0, s2, s2);
                ctx.strokeStyle = "rgba(255,90,60,0.9)";
                ctx.lineWidth = 2;
                ctx.strokeRect(x0 + 1, y0 + 1, s2 - 2, s2 - 2);
                const ins = (1 - k) * s2 / 2;
                ctx.strokeStyle = "rgba(255,220,160,0.8)";
                ctx.strokeRect(x0 + ins, y0 + ins, s2 - ins * 2, s2 - ins * 2);
            }
        if (guide && guide.path && P.cls && !pl.dead) {
            const n = Math.min(guide.path.length, 16);
            for (let i = 0; i < n; i++) {
                const nd = guide.path[i];
                const ph = (time * 3 - i * 0.35) % 1;
                ctx.globalAlpha = (1 - i / n) * (0.35 + 0.35 * (ph < 0 ? ph + 1 : ph));
                ctx.fillStyle = "#ffd84a";
                ctx.beginPath();
                ctx.arc(nd[0] * TS + 16, nd[1] * TS + 18, 3, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }
        for (const z of PVPZ)
            if (z.area === P.area && z.x1 < 99) {
                const zx = z.x0 * TS, zy = z.y0 * TS, zw = (z.x1 - z.x0 + 1) * TS, zh = (z.y1 - z.y0 + 1) * TS;
                ctx.fillStyle = "rgba(190,40,40,0.13)";
                ctx.fillRect(zx, zy, zw, zh);
                ctx.strokeStyle = "rgba(255,90,70,0.75)";
                ctx.lineWidth = 2;
                ctx.setLineDash([8, 6]);
                ctx.strokeRect(zx + 1, zy + 1, zw - 2, zh - 2);
                ctx.setLineDash([]);
                label(zx + zw / 2, zy + 14, "⚔ " + z.n + " – strefa PvP", "#ffb0a0");
            }
        for (const b of bags)
            if (b.area === P.area)
                drawBag(b);
        const ents = [];
        for (const k of Object.keys(NPCS))
            if (NPCS[k].area === P.area)
                ents.push({ y: NPCS[k].y * TS, f: () => drawNpc(k) });
        for (const d of DECOR)
            if (d.area === P.area)
                ents.push({ y: d.y * TS, f: () => drawDecor(d) });
        if (NET && NET.objs && NET.drawObj)
            for (const o of NET.objs)
                if (o.a === P.area)
                    ents.push({ y: o.y * TS - 1, f: () => { try {
                            NET.drawObj(ctx, o, o.x * TS, o.y * TS, TS, performance.now() / 1000);
                        }
                        catch (e) { /* ignore */ } } });
        for (const m of mobs[P.area])
            if (!m.dead)
                ents.push({ y: rpos(m)[1], f: () => { drawMob(m); if (m.inB) {
                        const mp = rpos(m);
                        label(mp[0] + 16, mp[1] - 12 - (m.d.sc ? (m.d.sc - 1) * 26 : 0), "⚔ walka", "#ffb347");
                    } } });
        if (NET)
            for (const k of Object.keys(others)) {
                const o = others[k];
                if (o.area !== P.area || o.dead)
                    continue;
                const op = rpos(o);
                ents.push({ y: op[1] + 0.4, f: () => drawOther(o, op) });
            }
        if (!pl.dead && P.cls)
            ents.push({ y: pp[1] + 0.5, f: () => {
                    if (pl.buffDef > 0) {
                        ctx.strokeStyle = "rgba(255,150,60," + (0.5 + 0.3 * Math.sin(time * 8)).toFixed(3) + ")";
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.ellipse(pp[0] + 16, pp[1] + 28, 14, 5, 0, 0, Math.PI * 2);
                        ctx.stroke();
                    }
                    if (pl.haste > 0 && R() < 0.3)
                        fx.push({ k: "p", x: pp[0] + 6 + R() * 20, y: pp[1] + 10 + R() * 16, vx: 0, vy: -30, c: "#9dff9a", life: 0.4, max: 0.8 });
                    drawPlayerAt(pp[0], pp[1], pl.dir, pl.mt < 1 ? pl.phase : 0, pl.hit > 0, pl.anim);
                    if (NET && NET.nick)
                        label(pp[0] + 16, pp[1] - 8, (NET.gtag ? "[" + NET.gtag + "] " : "") + NET.nick + " · " + P.lvl, "#ffe9a8");
                    if (NET && NET.title)
                        label(pp[0] + 16, pp[1] - 21, "«" + NET.title + "»", "#e8c96a");
                } });
        ents.sort((p, q) => p.y - q.y);
        for (const e of ents)
            e.f();
        for (const s of shots) {
            if (s.area !== P.area)
                continue;
            if (s.kind === "arrow" || s.kind === "aim") {
                ctx.save();
                ctx.translate(s.x, s.y);
                ctx.rotate(s.ang);
                const L = s.kind === "aim" ? 18 : 13;
                ctx.strokeStyle = s.kind === "aim" ? "#ffe08a" : "#e8dcc0";
                ctx.lineWidth = s.kind === "aim" ? 2.5 : 1.8;
                ctx.beginPath();
                ctx.moveTo(-L, 0);
                ctx.lineTo(0, 0);
                ctx.stroke();
                ctx.fillStyle = "#c9d1d9";
                ctx.beginPath();
                ctx.moveTo(3, 0);
                ctx.lineTo(-3, -3);
                ctx.lineTo(-3, 3);
                ctx.fill();
                if (s.kind === "aim") {
                    ctx.fillStyle = "rgba(255,224,138,0.35)";
                    ctx.beginPath();
                    ctx.arc(0, 0, 7, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            }
            else {
                const big = s.kind === "fire", col = s.kind === "fire" ? "rgba(255,150,40," : s.kind === "bolt" ? "rgba(170,140,255," : "rgba(200,255,140,";
                const grd = ctx.createRadialGradient(s.x, s.y, 1, s.x, s.y, big ? 16 : 10);
                grd.addColorStop(0, col + "0.9)");
                grd.addColorStop(1, col + "0)");
                ctx.fillStyle = grd;
                ctx.fillRect(s.x - 16, s.y - 16, 32, 32);
                ctx.fillStyle = s.kind === "mob" ? s.col : "#ffffff";
                ctx.beginPath();
                ctx.arc(s.x, s.y, big ? 4.5 : 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        for (const f of fx) {
            const al = clamp(f.life / (f.max * 0.5), 0, 1);
            if (f.k === "p") {
                ctx.globalAlpha = al;
                ctx.fillStyle = f.c;
                ctx.fillRect(f.x - 1.5, f.y - 1.5, 3, 3);
                ctx.globalAlpha = 1;
            }
            else if (f.k === "txt") {
                ctx.globalAlpha = al;
                ctx.font = "bold " + f.s + "px " + FONT;
                ctx.textAlign = "center";
                ctx.textBaseline = "alphabetic";
                ctx.fillStyle = "#000";
                ctx.fillText(f.t, f.x + 1, f.y + 1);
                ctx.fillStyle = f.c;
                ctx.fillText(f.t, f.x, f.y);
                ctx.globalAlpha = 1;
            }
            else if (f.k === "ring") {
                const k = 1 - f.life / f.max, c = f.c || "255,210,90";
                ctx.strokeStyle = "rgba(" + c + "," + (1 - k).toFixed(3) + ")";
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.ellipse(f.x, f.y, 10 + k * 50, 4 + k * 20, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.fillStyle = "rgba(" + c + "," + (0.3 * (1 - k)).toFixed(3) + ")";
                ctx.fillRect(f.x - 12, f.y - 60 * (1 - k * 0.3), 24, 60);
            }
            else if (f.k === "whirl") {
                const k = 1 - f.life / f.max;
                ctx.strokeStyle = "rgba(255,200,120," + (1 - k).toFixed(3) + ")";
                ctx.lineWidth = 5;
                ctx.beginPath();
                ctx.arc(f.x, f.y - 4, 30, k * Math.PI * 4, k * Math.PI * 4 + Math.PI * 1.3);
                ctx.stroke();
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(f.x, f.y - 4, 40, k * Math.PI * 4 + Math.PI, k * Math.PI * 4 + Math.PI * 2);
                ctx.stroke();
            }
            else if (f.k === "nova") {
                const k = 1 - f.life / f.max;
                ctx.strokeStyle = "rgba(170,235,255," + (1 - k).toFixed(3) + ")";
                ctx.lineWidth = 6;
                ctx.beginPath();
                ctx.arc(f.x, f.y - 4, 10 + k * 76, 0, Math.PI * 2);
                ctx.stroke();
                ctx.fillStyle = "rgba(170,235,255," + (0.18 * (1 - k)).toFixed(3) + ")";
                ctx.beginPath();
                ctx.arc(f.x, f.y - 4, 10 + k * 76, 0, Math.PI * 2);
                ctx.fill();
            }
            else if (f.k === "rain") {
                const k = 1 - f.life / f.max;
                ctx.strokeStyle = "rgba(240,230,200,0.9)";
                ctx.lineWidth = 1.5;
                for (let i = 0; i < 12; i++) {
                    const ax = f.x + ((i * 37) % 90) - 45, ay = f.y + ((i * 53) % 90) - 45 - (1 - k) * 60;
                    ctx.beginPath();
                    ctx.moveTo(ax, ay - 10);
                    ctx.lineTo(ax, ay);
                    ctx.stroke();
                }
                ctx.strokeStyle = "rgba(255,224,138," + (0.6 * (1 - k)).toFixed(3) + ")";
                ctx.lineWidth = 2;
                ctx.strokeRect(f.x - 80, f.y - 80, 160, 160);
            }
            else if (f.k === "slash") {
                const k = 1 - f.life / f.max;
                ctx.strokeStyle = "rgba(255,190,90," + (1 - k).toFixed(3) + ")";
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(f.x, f.y, 16 + k * 8, -2.4 + k, -0.6 + k);
                ctx.stroke();
            }
        }
        for (const g of EXG[a.id]) {
            if (Math.abs(g.x - P.x) > 10 || Math.abs(g.y - P.y) > 8)
                continue;
            const lx = clamp(g.x * TS + 16, camX + 60, camX + vw - 60), ly = clamp(g.y * TS - 6, camY + 20, camY + vh - 10);
            label(lx, ly, "→ " + AREAS[g.to].name, "#ffe9a8");
        }
        if (guide && P.cls && !pl.dead) {
            let gx = guide.x * TS + 16, gy = guide.y * TS;
            if (guide.o.kind === "mob" && guide.o.m && !guide.o.m.dead && guide.o.area === P.area) {
                const mp = rpos(guide.o.m);
                gx = mp[0] + 16;
                gy = mp[1] - ((guide.o.m.d.sc || 1) - 1) * 30;
            }
            const bob = Math.sin(time * 5) * 4;
            if (guide.o.kind === "spawn" && !guide.via) {
                ctx.strokeStyle = "rgba(255,216,74,0.7)";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(gx, gy + 16, 22 + Math.sin(time * 3) * 4, 0, Math.PI * 2);
                ctx.stroke();
            }
            arrowTri(gx, gy - 22 + bob, Math.PI / 2, 10, "#ffd84a");
            const dir = guideDir();
            if (dir && guide.dist > 1) {
                const cx = pp[0] + 16 + dir[0] * 30, cy = pp[1] + 18 + dir[1] * 24;
                const pul = 1 + 0.12 * Math.sin(time * 6);
                arrowTri(cx, cy, Math.atan2(dir[1], dir[0]), 9 * pul, "#ffd84a");
                ctx.font = "bold 10px " + FONT;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                const tx = pp[0] + 16 + dir[0] * 48, ty = pp[1] + 18 + dir[1] * 38;
                ctx.fillStyle = "rgba(0,0,0,0.7)";
                ctx.fillText(guide.dist + " m", tx + 1, ty + 1);
                ctx.fillStyle = "#ffe9a8";
                ctx.fillText(guide.dist + " m", tx, ty);
            }
        }
        if (info.amb === "fly") {
            for (let i = 0; i < 18; i++) {
                const bx = ((i * 397.3 + time * 9 * ((i % 3) + 1)) % (vw + 40)) + camX - 20, by = ((i * 211.7 + Math.sin(time + i) * 20 + 400) % (vh + 40)) + camY - 20;
                ctx.globalAlpha = 0.45 + 0.4 * Math.sin(time * 3 + i);
                ctx.fillStyle = "#f8ff9a";
                ctx.fillRect(bx, by, 2, 2);
                ctx.globalAlpha = 1;
            }
        }
        else if (info.amb === "snow") {
            ctx.fillStyle = "rgba(255,255,255,0.85)";
            for (let i = 0; i < 60; i++) {
                const bx = ((i * 173.3 + Math.sin(time * 0.8 + i) * 18 + time * 14) % (vw + 40)) + camX - 20, by = ((i * 97.1 + time * (28 + (i % 5) * 9)) % (vh + 40)) + camY - 20;
                const s2 = i % 3 === 0 ? 3 : 2;
                ctx.fillRect(bx, by, s2, s2);
            }
        }
        else if (info.amb === "fog") {
            for (let i = 0; i < 7; i++) {
                const bx = ((i * 311 + time * (6 + i)) % (vw + 320)) + camX - 160, by = camY + ((i * 137) % Math.max(1, vh)) + Math.sin(time * 0.3 + i) * 20;
                ctx.fillStyle = "rgba(200,220,190,0.08)";
                ctx.beginPath();
                ctx.ellipse(bx, by, 150, 40, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            for (let i = 0; i < 10; i++) {
                const bx = ((i * 263.3 + time * 7 * ((i % 3) + 1)) % (vw + 40)) + camX - 20, by = ((i * 181.7 + Math.sin(time + i) * 24 + 300) % (vh + 40)) + camY - 20;
                ctx.globalAlpha = 0.4 + 0.4 * Math.sin(time * 2 + i);
                ctx.fillStyle = "#c8ff9a";
                ctx.fillRect(bx, by, 2, 2);
                ctx.globalAlpha = 1;
            }
        }
        else if (info.amb === "sand") {
            ctx.fillStyle = "rgba(245,215,160,0.5)";
            for (let i = 0; i < 30; i++) {
                const bx = ((i * 251 + time * (90 + (i % 4) * 30)) % (vw + 60)) + camX - 30, by = ((i * 131.7 + Math.sin(time + i) * 10) % Math.max(1, vh)) + camY;
                ctx.fillRect(bx, by, 9, 1);
            }
        }
        ctx.restore();
        if (info.dark > 0) {
            const cx = (pp[0] + 16 - camX) * S, cy = (pp[1] + 16 - camY) * S;
            const cave = a.dark;
            const grd = ctx.createRadialGradient(cx, cy, (cave ? 50 : 120) * S, cx, cy, (cave ? 230 : 380) * S);
            const base = cave ? "5,3,10" : "10,20,8";
            grd.addColorStop(0, "rgba(" + base + ",0)");
            grd.addColorStop(1, "rgba(" + base + "," + info.dark + ")");
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, W, H);
        }
        if (info.amb === "fog") {
            ctx.fillStyle = "rgba(40,70,30,0.12)";
            ctx.fillRect(0, 0, W, H);
        }
        if (info.amb === "sand") {
            ctx.fillStyle = "rgba(255,190,110,0.06)";
            ctx.fillRect(0, 0, W, H);
        }
        if (info.amb === "snow") {
            ctx.fillStyle = "rgba(200,220,255,0.06)";
            ctx.fillRect(0, 0, W, H);
        }
        if (!P.cls) {
            drawSelect();
            return;
        }
        drawHud();
        if (trans) {
            const al = trans.t < 0.25 ? trans.t / 0.25 : 1 - (trans.t - 0.25) / 0.35;
            ctx.fillStyle = "rgba(0,0,0," + clamp(al, 0, 1).toFixed(3) + ")";
            ctx.fillRect(0, 0, W, H);
        }
        if (pl.dead > 0) {
            ctx.fillStyle = "rgba(60,0,0," + clamp(1 - pl.dead / 2.2 + 0.3, 0, 0.8).toFixed(3) + ")";
            ctx.fillRect(0, 0, W, H);
            text("Poległeś...", W / 2, H / 2, 28, "#ffd0c8", "center", true);
        }
    }
    function fitText(t, maxW, size, bold) {
        ctx.font = (bold ? "bold " : "") + size + "px " + FONT;
        if (ctx.measureText(t).width <= maxW)
            return t;
        let s = t;
        while (s.length > 1 && ctx.measureText(s + "…").width > maxW)
            s = s.slice(0, -1);
        return s + "…";
    }
    function circleBtn(cx, cy, r, kind, fn, hint, badge) {
        const g = ctx;
        const ski = kind.charAt(0) === "s" && kind.length === 3 ? Number(kind.charAt(2)) : -1;
        const sk = ski >= 0 ? SK[P.cls][ski] : null;
        const locked = !!sk && P.lvl < sk.lvl, noMp = !!sk && P.mp < sk.cost;
        g.globalAlpha = 0.92;
        g.beginPath();
        g.arc(cx, cy, r, 0, Math.PI * 2);
        g.fillStyle = kind === "atk" ? "rgba(140,40,34,0.85)" : sk ? "rgba(46,36,66,0.88)" : "rgba(24,19,30,0.8)";
        g.fill();
        g.strokeStyle = sk && !locked && pl.skcd[ski] <= 0 && !noMp ? "#ffd25a" : COL.bd;
        g.lineWidth = 1.5;
        g.stroke();
        g.globalAlpha = 1;
        if (kind === "atk") {
            if (pl.cd > 0) {
                g.beginPath();
                g.moveTo(cx, cy);
                g.arc(cx, cy, r - 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(pl.cd / C().cd, 0, 1));
                g.closePath();
                g.fillStyle = "rgba(0,0,0,0.35)";
                g.fill();
            }
            drawIcon(P.eq.w || GEAR[P.cls || "war"].w[0], cx - r * 0.55, cy - r * 0.55, r * 1.1);
        }
        else if (kind === "pot")
            drawIcon("pot", cx - r * 0.6, cy - r * 0.62, r * 1.2);
        else if (kind === "mpot")
            drawIcon("mpot", cx - r * 0.6, cy - r * 0.62, r * 1.2);
        else if (kind === "bag") {
            g.fillStyle = "#a0723c";
            g.beginPath();
            g.ellipse(cx, cy + 3, r * 0.5, r * 0.45, 0, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = "#7a5228";
            g.fillRect(cx - r * 0.25, cy - r * 0.45, r * 0.5, r * 0.25);
        }
        else if (kind === "chat") {
            g.fillStyle = "#e8dcc0";
            rr(cx - r * 0.55, cy - r * 0.45, r * 1.1, r * 0.75, 4);
            g.fill();
            g.beginPath();
            g.moveTo(cx - r * 0.25, cy + r * 0.28);
            g.lineTo(cx - r * 0.4, cy + r * 0.6);
            g.lineTo(cx + r * 0.05, cy + r * 0.28);
            g.fill();
            g.fillStyle = "#6a5430";
            for (let i = 0; i < 3; i++)
                g.fillRect(cx - r * 0.32 + i * r * 0.26, cy - r * 0.1, 3, 3);
        }
        else if (kind === "menu") {
            g.fillStyle = "#ffd25a";
            for (let i = 0; i < 3; i++)
                g.fillRect(cx - r * 0.45, cy - r * 0.38 + i * r * 0.32, r * 0.9, Math.max(2, r * 0.14));
        }
        else if (kind === "quest") {
            g.fillStyle = "#efe0b8";
            g.fillRect(cx - r * 0.4, cy - r * 0.45, r * 0.8, r * 0.9);
            g.fillStyle = "#8a6238";
            for (let i = 0; i < 3; i++)
                g.fillRect(cx - r * 0.28, cy - r * 0.25 + i * r * 0.25, r * 0.56, 2);
            if (QORDER.some((q) => qReady(q))) {
                g.fillStyle = "#ffd84a";
                g.beginPath();
                g.arc(cx + r * 0.6, cy - r * 0.6, 5, 0, 7);
                g.fill();
            }
        }
        else if (kind === "map") {
            g.fillStyle = "#d8c89a";
            g.beginPath();
            g.moveTo(cx - r * 0.55, cy - r * 0.4);
            g.lineTo(cx - r * 0.18, cy - r * 0.52);
            g.lineTo(cx + r * 0.18, cy - r * 0.4);
            g.lineTo(cx + r * 0.55, cy - r * 0.52);
            g.lineTo(cx + r * 0.55, cy + r * 0.45);
            g.lineTo(cx + r * 0.18, cy + r * 0.57);
            g.lineTo(cx - r * 0.18, cy + r * 0.45);
            g.lineTo(cx - r * 0.55, cy + r * 0.57);
            g.closePath();
            g.fill();
            g.strokeStyle = "#8a6238";
            g.lineWidth = 1;
            g.beginPath();
            g.moveTo(cx - r * 0.18, cy - r * 0.52);
            g.lineTo(cx - r * 0.18, cy + r * 0.45);
            g.moveTo(cx + r * 0.18, cy - r * 0.4);
            g.lineTo(cx + r * 0.18, cy + r * 0.57);
            g.stroke();
            g.fillStyle = "#c0392b";
            g.beginPath();
            g.arc(cx + r * 0.05, cy, 2.5, 0, 7);
            g.fill();
        }
        else if (sk) {
            drawSkillIcon(sk.ic, cx, cy, r * 0.72);
            const cdv = pl.skcd[ski];
            if (locked || noMp || cdv > 0) {
                g.beginPath();
                g.arc(cx, cy, r - 1.5, 0, Math.PI * 2);
                g.fillStyle = locked ? "rgba(0,0,0,0.62)" : noMp ? "rgba(20,30,80,0.5)" : "rgba(0,0,0,0.25)";
                g.fill();
            }
            if (cdv > 0 && !locked) {
                g.beginPath();
                g.moveTo(cx, cy);
                g.arc(cx, cy, r - 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (cdv / sk.cd));
                g.closePath();
                g.fillStyle = "rgba(0,0,0,0.45)";
                g.fill();
                text(String(Math.ceil(cdv)), cx, cy + 1, 13, "#fff", "center", true);
            }
            if (locked)
                text("poz. " + sk.lvl, cx, cy + 1, 10, "#ddd", "center", true);
        }
        if (badge) {
            g.fillStyle = "#000";
            g.beginPath();
            g.arc(cx + r * 0.65, cy + r * 0.6, 8, 0, 7);
            g.fill();
            text(badge, cx + r * 0.65, cy + r * 0.62, 10, "#fff", "center", true);
        }
        if (hint)
            text(hint, cx, cy + r + 8, 9, "rgba(255,255,255,0.85)", "center", true);
        ui.push({ x: cx - r, y: cy - r, w: r * 2, h: r * 2, fn, k: kind });
    }
    function drawTracker(x, y, w) {
        if (!guide)
            return;
        const h = 46;
        box(x, y, w, h);
        const q = guide.o.q ? QUESTS[guide.o.q] : null;
        const dir = guideDir();
        ctx.beginPath();
        ctx.arc(x + 22, y + 23, 15, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,216,74,0.14)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,216,74,0.7)";
        ctx.lineWidth = 1;
        ctx.stroke();
        if (dir)
            arrowTri(x + 22, y + 23, Math.atan2(dir[1], dir[0]), 10, "#ffd84a");
        else {
            ctx.fillStyle = "#ffd84a";
            ctx.beginPath();
            ctx.arc(x + 22, y + 23, 4, 0, 7);
            ctx.fill();
        }
        const t1 = q ? q.n + (q.need > 1 && !qReady(guide.o.q) ? "  " + qProg(guide.o.q) + "/" + q.need : "") : "Wskazówka";
        const dist = guide.dist + " m";
        ctx.font = "bold 11px " + FONT;
        const dw = ctx.measureText(dist).width;
        text(fitText(t1, w - 54 - dw - 8, 11, true), x + 44, y + 14, 11, COL.title, "left", true);
        text(dist, x + w - 8, y + 14, 11, "#ffe9a8", "right", true);
        const t2 = guide.via ? "Idź do: " + AREAS[guide.via].name + (guide.o.area !== guide.via ? " → " + AREAS[guide.o.area].name : "") : guide.o.t;
        text(fitText(t2, w - 54, 10), x + 44, y + 29, 10, COL.text);
        text(touchMode ? "dotknij: dziennik ▸" : "T – zmień · Q – dziennik", x + w - 8, y + 40, 9, COL.mute, "right");
        ui.push({ x, y, w, h, fn: () => { panel = "quest"; } });
    }
    function drawMinimap() {
        const a = A();
        const small = W < 520;
        const mmW = Math.round(small ? Math.min(150, W * 0.38) : Math.min(230, W * 0.22)), mmH = Math.round(mmW * 0.78);
        const mx = W - mmW - 10, my = 10;
        box(mx - 4, my - 4, mmW + 8, mmH + 28);
        const zi = clamp(Math.floor(P.mmz || 0), 0, 2);
        let vwT = 0, vhT = 0;
        if (zi === 0) {
            const k0 = Math.min(mmW / a.w, mmH / a.h);
            vwT = mmW / k0;
            vhT = mmH / k0;
        }
        else {
            vwT = zi === 1 ? 32 : 20;
            vhT = vwT * mmH / mmW;
        }
        const k = mmW / vwT;
        let ox = (a.w - vwT) / 2, oy = (a.h - vhT) / 2;
        if (zi > 0) {
            const pr = rpos(pl2());
            ox = pr[0] / TS + 0.5 - vwT / 2;
            oy = pr[1] / TS + 0.5 - vhT / 2;
            ox = a.w > vwT ? clamp(ox, 0, a.w - vwT) : (a.w - vwT) / 2;
            oy = a.h > vhT ? clamp(oy, 0, a.h - vhT) : (a.h - vhT) / 2;
        }
        const tp = (tx, ty) => [mx + (tx + 0.5 - ox) * k, my + (ty + 0.5 - oy) * k];
        ctx.save();
        rr(mx, my, mmW, mmH, 5);
        ctx.clip();
        ctx.fillStyle = "#0c0a10";
        ctx.fillRect(mx, my, mmW, mmH);
        ctx.imageSmoothingEnabled = false;
        if (a.mini)
            ctx.drawImage(a.mini, 0, 0, a.w * 3, a.h * 3, mx - ox * k, my - oy * k, a.w * k, a.h * k);
        if (a.dark) {
            ctx.fillStyle = "rgba(0,0,0,0.15)";
            ctx.fillRect(mx, my, mmW, mmH);
        }
        for (const g of EXG[a.id]) {
            const p = tp(g.x, g.y);
            ctx.save();
            ctx.translate(p[0], p[1]);
            ctx.rotate(Math.PI / 4);
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(-3.5, -3.5, 7, 7);
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 1;
            ctx.strokeRect(-3.5, -3.5, 7, 7);
            ctx.restore();
        }
        for (const m of mobs[P.area])
            if (!m.dead) {
                const p = tp(m.x, m.y);
                if (m.d.boss) {
                    ctx.fillStyle = "#c58cff";
                    ctx.beginPath();
                    ctx.arc(p[0], p[1], 4, 0, 7);
                    ctx.fill();
                    ctx.strokeStyle = "#fff";
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
                else {
                    ctx.fillStyle = "#ff4a3a";
                    ctx.beginPath();
                    ctx.arc(p[0], p[1], Math.max(1.6, k * 0.32), 0, 7);
                    ctx.fill();
                }
            }
        for (const id of Object.keys(NPCS)) {
            const n = NPCS[id];
            if (n.area !== P.area)
                continue;
            const p = tp(n.x, n.y);
            ctx.fillStyle = "#ffd84a";
            ctx.beginPath();
            ctx.arc(p[0], p[1], 2.8, 0, 7);
            ctx.fill();
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 1;
            ctx.stroke();
            const mk = npcMark(id);
            if (mk === "!" || mk === "?") {
                ctx.font = "bold 11px " + FONT;
                ctx.textAlign = "center";
                ctx.textBaseline = "alphabetic";
                ctx.fillStyle = "#000";
                ctx.fillText(mk, p[0] + 1, p[1] - 3);
                ctx.fillStyle = "#ffd84a";
                ctx.fillText(mk, p[0], p[1] - 4);
            }
        }
        if (guide) {
            const p = tp(guide.x, guide.y), pul = 3 + Math.sin(time * 6) * 1.2;
            const inside = p[0] > mx + 4 && p[0] < mx + mmW - 4 && p[1] > my + 4 && p[1] < my + mmH - 4;
            if (inside) {
                ctx.strokeStyle = "#ffd84a";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(p[0], p[1], pul + 2, 0, 7);
                ctx.stroke();
                ctx.fillStyle = "#ffd84a";
                ctx.beginPath();
                ctx.arc(p[0], p[1], 2, 0, 7);
                ctx.fill();
            }
            else {
                const pp = tp(P.x, P.y);
                const an = Math.atan2(p[1] - pp[1], p[0] - pp[0]);
                const ex = clamp(p[0], mx + 8, mx + mmW - 8), ey = clamp(p[1], my + 8, my + mmH - 8);
                arrowTri(ex, ey, an, 6, "#ffd84a");
            }
        }
        if (NET)
            for (const k of Object.keys(others)) {
                const o = others[k];
                if (o.area !== P.area || o.dead)
                    continue;
                const q2 = tp(o.x + 0.5, o.y + 0.5);
                ctx.fillStyle = "#9fe0ff";
                ctx.strokeStyle = "#0a2030";
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(q2[0], q2[1], 2.8, 0, 7);
                ctx.fill();
                ctx.stroke();
            }
        const pp2 = rpos(pl2());
        const pq = tp(pp2[0] / TS, pp2[1] / TS);
        arrowTri(pq[0], pq[1], [Math.PI / 2, Math.PI, 0, -Math.PI / 2][pl.dir], 5.5, "#4fb0ff");
        ctx.restore();
        ctx.strokeStyle = "rgba(201,164,92,0.6)";
        ctx.lineWidth = 1;
        rr(mx, my, mmW, mmH, 5);
        ctx.stroke();
        text(fitText(a.name, mmW - 50, 10, true), mx + mmW / 2, my + mmH + 12, 10, COL.title, "center", true);
        button(mx - 2, my + mmH + 3, 20, 18, "−", () => { P.mmz = Math.max(0, (P.mmz || 0) - 1); }, { fs: 12 });
        button(mx + mmW - 18, my + mmH + 3, 20, 18, "+", () => { P.mmz = Math.min(2, (P.mmz || 0) + 1); }, { fs: 12 });
        ui.push({ x: mx, y: my, w: mmW, h: mmH, fn: () => { panel = "map"; mapTab = "area"; } });
        return [mx, my + mmH + 26, mmW];
    }
    function drawHud() {
        const a = A();
        const small = W < 520;
        const bw = Math.min(214, W * (small ? 0.5 : 0.3));
        box(8, 8, bw, 80);
        text(fitText(C().n, bw - 70, 13, true), 18, 21, 13, COL.title, "left", true);
        text("Poz. " + P.lvl, 8 + bw - 10, 21, 12, COL.text, "right", true);
        bar(18, 31, bw - 20, 12, P.hp / maxHp(), "#d83a2e", "rgba(255,255,255,0.12)");
        text(Math.max(0, Math.ceil(P.hp)) + " / " + maxHp(), 18 + (bw - 20) / 2, 37.5, 10, "#fff", "center", true);
        bar(18, 45, bw - 20, 11, P.mp / maxMp(), C().rc, "rgba(255,255,255,0.12)");
        text(C().res + " " + Math.floor(P.mp) + "/" + maxMp(), 18 + (bw - 20) / 2, 50.5, 9, "#fff", "center", true);
        bar(18, 59, bw - 20, 5, P.lvl >= MAXLVL ? 1 : P.xp / xpNext(P.lvl), "#5aa8ff", "rgba(255,255,255,0.12)");
        ctx.fillStyle = "#f2c94c";
        ctx.beginPath();
        ctx.arc(23, 76, 4, 0, Math.PI * 2);
        ctx.fill();
        text(P.gold + " zł", 31, 76.5, 11, COL.text, "left", true);
        text("Atak " + atk() + "  Obr. " + def() + (pl.buffDef > 0 ? "↑" : ""), 8 + bw - 10, 76.5, 10, pl.buffDef > 0 ? "#ffb347" : COL.mute, "right");
        let yy = 94;
        if (guide && !panel) {
            drawTracker(8, yy, bw);
            yy += 52;
        }
        const t = pl.target;
        if (t && !t.dead) {
            box(8, yy, bw, 34);
            text(fitText(t.d.n + " (" + t.d.lvl + ")", bw - 20, 11, true), 18, yy + 11, 11, "#ffe9a8", "left", true);
            bar(18, yy + 20, bw - 20, 7, t.hp / t.d.hp, "#d83a2e", "rgba(255,255,255,0.12)");
        }
        const mm = drawMinimap();
        const ur = small ? 16 : 18, uy = mm[1] + ur + 4;
        const hintOn = !touchMode;
        circleBtn(W - 10 - ur, uy, ur, "map", () => { panel = panel === "map" ? "" : "map"; mapTab = "area"; }, hintOn ? "M" : "");
        circleBtn(W - 10 - ur * 3 - 8, uy, ur, "quest", () => { panel = panel === "quest" ? "" : "quest"; }, hintOn ? "Q" : "");
        circleBtn(W - 10 - ur * 5 - 16, uy, ur, "bag", () => { if (NET && NET.onPanel) {
            panel = "";
            NET.onPanel("inv");
        }
        else {
            panel = panel === "inv" ? "" : "inv";
            invSel = -1;
        } }, hintOn ? "I" : "");
        if (NET && NET.onPanel)
            circleBtn(W - 10 - ur, uy + ur * 2 + 8, ur, "menu", () => { panel = ""; NET.onPanel("menu"); }, hintOn ? "R/U/P" : "");
        if (NET && NET.onChat)
            circleBtn(W - 10 - ur * 7 - 24, uy, ur, "chat", () => { NET.onChat(); }, hintOn ? "C" : "", NET.unread ? String(Math.min(9, NET.unread)) : undefined);
        if (banner > 0) {
            ctx.globalAlpha = clamp(banner, 0, 1);
            const fs = Math.min(30, W / 14);
            text(a.name, W / 2 + 1, H * 0.3 + 1, fs, "#000", "center", true);
            text(a.name, W / 2, H * 0.3, fs, COL.title, "center", true);
            text(AINFO[a.id].lv, W / 2, H * 0.3 + 26, 12, COL.text, "center", true);
            if (areaWarnT)
                text(fitText(areaWarnT, W - 30, 14, true), W / 2, H * 0.3 + 48, 14, "#ff8a6a", "center", true);
            ctx.globalAlpha = 1;
        }
        for (const f of fx)
            if (f.k === "big") {
                const al = clamp(f.life / 0.6, 0, 1), sc = 1 + (1 - f.life / f.max) * 0.15, fs = Math.min(34, W / 12) * sc;
                ctx.globalAlpha = al;
                text(f.t, W / 2 + 2, H * 0.42 + 2, fs, "#000", "center", true);
                text(f.t, W / 2, H * 0.42, fs, "#ffd25a", "center", true);
                ctx.globalAlpha = 1;
            }
        const ab = small ? 31 : 34, sr = small ? 21 : 24;
        const axc = W - 14 - ab, ayc = H - 18 - ab;
        const R0 = ab + sr + 16;
        circleBtn(axc, ayc, ab, "atk", () => act({ a: "atk" }), hintOn ? "Spacja" : "");
        const angs = [Math.PI, Math.PI * 1.25, Math.PI * 1.5];
        for (let i = 0; i < 3; i++)
            circleBtn(axc + Math.cos(angs[i]) * R0, ayc + Math.sin(angs[i]) * R0, sr, "sk" + i, () => act({ a: "sk", i }), hintOn ? String(i + 1) : "");
        const pr = small ? 18 : 20;
        const potX = axc - R0 - sr - pr - 8;
        circleBtn(potX, ayc + 8, pr, "pot", () => act({ a: "pot" }), hintOn ? "H" : "", String(["pot", "bigpot", "elix", "gpot", "selix", "spot", "dpot"].reduce((n, k) => n + countItem(k), 0)));
        if (P.cls === "mag" || countItem("mpot") + countItem("gmpot") > 0)
            circleBtn(potX + 6, ayc - pr * 2 - 14, pr, "mpot", () => act({ a: "mpot" }), hintOn ? "G" : "", String(countItem("mpot") + countItem("gmpot")));
        let logBottom = H - 12;
        if (touchMode) {
            // arrow d-pad (always visible on touch devices); hold to walk, two arrows = diagonal
            const sz = small ? 50 : 54, cx = 16 + sz * 1.5, cy = H - 16 - sz * 1.5;
            pad.cx = cx;
            pad.cy = cy;
            pad.s = sz;
            const pd = padDir();
            const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
            ctx.beginPath();
            ctx.arc(cx, cy, sz * 0.42, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(24,19,30,0.35)";
            ctx.fill();
            for (const d of dirs) {
                const x = cx + d[0] * sz - sz / 2, y = cy + d[1] * sz - sz / 2;
                const on = !!pd && ((d[0] !== 0 && pd[0] === d[0]) || (d[1] !== 0 && pd[1] === d[1]));
                rr(x + 2, y + 2, sz - 4, sz - 4, 10);
                ctx.fillStyle = on ? "rgba(201,164,92,0.85)" : "rgba(24,19,30,0.62)";
                ctx.fill();
                ctx.strokeStyle = on ? "#f5e0a8" : COL.bd;
                ctx.lineWidth = on ? 2 : 1;
                ctx.stroke();
                const ax = x + sz / 2, ay = y + sz / 2, an = Math.atan2(d[1], d[0]);
                ctx.save();
                ctx.translate(ax, ay);
                ctx.rotate(an);
                ctx.fillStyle = on ? "#2a1f12" : COL.text;
                ctx.beginPath();
                ctx.moveTo(10, 0);
                ctx.lineTo(-6, -10);
                ctx.lineTo(-6, 10);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
            ui.push({ x: cx - sz * 1.5, y: cy - sz * 1.5, w: sz * 3, h: sz * 3, fn: () => { }, pad: true });
            logBottom = cy - sz * 1.5 - 10;
        }
        const lw = Math.min(W * (touchMode ? 0.62 : 0.45), 380);
        let ly = logBottom;
        for (let i = msgs.length - 1; i >= 0 && i >= msgs.length - (small ? 4 : 5); i--) {
            const m = msgs[i];
            const lines = wrap(m.t, lw - 12, 11);
            for (let j = lines.length - 1; j >= 0; j--) {
                ctx.globalAlpha = clamp(m.life / 1.5, 0, 1);
                ctx.font = "bold 11px " + FONT;
                const tw = ctx.measureText(lines[j]).width;
                ctx.fillStyle = "rgba(0,0,0,0.5)";
                ctx.fillRect(8, ly - 15, tw + 12, 16);
                text(lines[j], 14, ly - 7, 11, m.c, "left", true);
                ly -= 16;
                ctx.globalAlpha = 1;
            }
        }
        if (panel === "inv")
            drawInv();
        if (panel === "quest")
            drawQuests();
        if (panel === "shop")
            drawShop();
        if (panel === "map")
            drawMap();
        if (dlg)
            drawDialog();
        if (hover && hover.t && !panel && !dlg && !touchMode) {
            ctx.font = "11px " + FONT;
            const tw = ctx.measureText(hover.t).width;
            const hx = clamp(hover.sx + 12, 4, W - tw - 16);
            ctx.fillStyle = "rgba(0,0,0,0.7)";
            ctx.fillRect(hx, hover.sy + 10, tw + 10, 18);
            text(hover.t, hx + 5, hover.sy + 19, 11, "#fff");
        }
    }
    // ---------- PANELS ----------
    function panelRect(mw, mh) {
        const w = Math.min(W - 16, mw), h = Math.min(H - 16, mh);
        return [Math.round((W - w) / 2), Math.round((H - h) / 2), w, h];
    }
    function modalBack() { ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(0, 0, W, H); ui.push({ x: 0, y: 0, w: W, h: H, fn: () => { panel = ""; } }); }
    function itemDesc(id) {
        const it = ITEMS[id];
        const who = it.cls ? " · " + it.cls.split(" ").map((c) => CLS[c].n).join("/") : "";
        if (it.t === "w")
            return "Atak +" + it.atk + who;
        if (it.t === "a")
            return "Obrona +" + it.def + ", HP +" + it.def * 2 + (it.mp ? ", mana +" + it.mp : "") + who;
        if (it.t === "p")
            return "Leczy " + it.heal + " HP";
        if (it.t === "m")
            return "Przywraca " + it.mana + " " + (P.cls === "mag" ? "many" : "energii");
        if (it.t === "q")
            return "Przedmiot do zadania";
        return "Łup na sprzedaż";
    }
    function shopList(id) {
        const out = [];
        for (const s of SHOPS[id]) {
            const r = resolve(s);
            if (out.indexOf(r) < 0)
                out.push(r);
        }
        return out;
    }
    function drawInv() {
        modalBack();
        const [x, y, w, h] = panelRect(460, 500);
        box(x, y, w, h);
        ui.push({ x, y, w, h, fn: () => { } });
        text("Torba i ekwipunek", x + 14, y + 19, 15, COL.title, "left", true);
        closeBtn(x + w, y, () => { panel = ""; });
        const slotS = Math.max(30, Math.min(52, Math.floor((w - 28) / 5) - 6));
        const eqY = y + 40;
        const eqSlot = (sx, slot, lbl, sel) => {
            rr(sx, eqY, slotS, slotS, 6);
            ctx.fillStyle = invSel === sel ? "rgba(201,164,92,0.35)" : "rgba(255,255,255,0.06)";
            ctx.fill();
            ctx.strokeStyle = COL.bd;
            ctx.lineWidth = 1;
            ctx.stroke();
            if (P.eq[slot])
                drawIcon(P.eq[slot], sx + 4, eqY + 4, slotS - 8);
            text(lbl, sx + slotS / 2, eqY + slotS + 9, 10, COL.mute, "center");
            ui.push({ x: sx, y: eqY, w: slotS, h: slotS, fn: () => { invSel = P.eq[slot] ? sel : -1; } });
        };
        eqSlot(x + 14, "w", "Broń", -2);
        eqSlot(x + 22 + slotS, "a", "Zbroja", -3);
        const sx0 = x + 34 + slotS * 2;
        const fs = w < 380 ? 10 : 11;
        text(C().n + " · poziom " + P.lvl + (P.lvl < MAXLVL ? " · PD " + P.xp + "/" + xpNext(P.lvl) : " (maks.)"), sx0, eqY + 6, fs, COL.title, "left", true);
        text("HP " + Math.ceil(P.hp) + "/" + maxHp() + " · " + C().res + " " + Math.floor(P.mp) + "/" + maxMp(), sx0, eqY + 22, fs, COL.text);
        text("Atak " + atk() + " · Obrona " + def() + " · Zasięg " + C().rng, sx0, eqY + 37, fs, COL.text);
        text(P.gold + " zł · pokonani: " + P.kills, sx0, eqY + 52, fs, COL.mute);
        const gy = eqY + slotS + 22;
        const cols = 5;
        const gs = Math.max(24, Math.min(slotS, Math.floor((h - (gy - y) - 92) / 4) - 6));
        for (let i = 0; i < 20; i++) {
            const cx = x + 14 + (i % cols) * (gs + 6), cy = gy + Math.floor(i / cols) * (gs + 6);
            rr(cx, cy, gs, gs, 6);
            ctx.fillStyle = invSel === i ? "rgba(201,164,92,0.35)" : "rgba(255,255,255,0.06)";
            ctx.fill();
            ctx.strokeStyle = "rgba(201,164,92,0.5)";
            ctx.lineWidth = 1;
            ctx.stroke();
            const s = P.inv[i];
            if (s) {
                drawIcon(s.id, cx + 3, cy + 3, gs - 6);
                if (!canUse(s.id)) {
                    ctx.fillStyle = "rgba(160,30,30,0.35)";
                    ctx.fillRect(cx + 1, cy + 1, gs - 2, gs - 2);
                }
                if (s.n > 1)
                    text(String(s.n), cx + gs - 4, cy + gs - 8, 10, "#fff", "right", true);
                ui.push({ x: cx, y: cy, w: gs, h: gs, fn: () => { invSel = invSel === i ? -1 : i; } });
            }
        }
        const dy = gy + 4 * (gs + 6) + 4;
        let selId = "";
        if (invSel >= 0 && P.inv[invSel])
            selId = P.inv[invSel].id;
        if (invSel === -2)
            selId = P.eq.w || "";
        if (invSel === -3)
            selId = P.eq.a || "";
        if (selId) {
            const it = ITEMS[selId];
            text(it.n, x + 14, dy + 10, 13, COL.title, "left", true);
            text(fitText(itemDesc(selId) + " · wartość " + Math.max(1, Math.floor(it.price / 2)) + " zł", w - 28, 11), x + 14, dy + 28, 11, canUse(selId) ? COL.text : COL.bad);
            const by = Math.min(dy + 42, y + h - 40);
            if (invSel >= 0) {
                if (it.t === "w" || it.t === "a")
                    button(x + 14, by, 110, 30, canUse(selId) ? "Załóż" : "Nie dla klasy", () => { act({ a: "equip", i: invSel }); invSel = -1; }, { dis: !canUse(selId) });
                if (it.t === "p" || it.t === "m")
                    button(x + 14, by, 110, 30, "Użyj", () => { act({ a: "use", id: selId }); });
            }
            else
                button(x + 14, by, 110, 30, "Zdejmij", () => { act({ a: "unequip", id: invSel === -2 ? "w" : "a" }); invSel = -1; });
        }
        else
            text("Wybierz przedmiot, aby go użyć lub założyć.", x + 14, dy + 14, 11, COL.mute);
    }
    function drawQuests() {
        modalBack();
        const [x, y, w, h] = panelRect(520, 600);
        box(x, y, w, h);
        ui.push({ x, y, w, h, fn: () => { } });
        text("Dziennik zadań", x + 14, y + 19, 15, COL.title, "left", true);
        closeBtn(x + w, y, () => { panel = ""; });
        let yy = y + 44;
        const act = activeQuests();
        if (!act.length) {
            for (const l of wrap("Nie masz aktywnych zadań. Szukaj postaci z żółtym wykrzyknikiem – złota strzałka cię do nich zaprowadzi.", w - 28, 12)) {
                text(l, x + 14, yy + 6, 12, COL.text);
                yy += 17;
            }
            yy += 6;
        }
        else {
            text("Wybierz zadanie, które ma wskazywać strzałka:", x + 14, yy + 4, 10, COL.mute);
            yy += 16;
        }
        const bwT = w < 380 ? 78 : 92;
        let shown = 0;
        for (const id of act) {
            const q = QUESTS[id], tr = P.track === id, ready = qReady(id);
            const lines = wrap(q.desc + " Zleca: " + NPCS[q.giver].n + ".", w - 40 - bwT, 11);
            const rh = 26 + lines.length * 14 + 12;
            if (yy + rh > y + h - 110) {
                text("… i " + (act.length - shown) + " więcej", x + 14, yy + 6, 11, COL.mute);
                yy += 18;
                break;
            }
            const fnT = () => { P.track = id; guideT = 0; actQ.push({ a: "track", id }); };
            rr(x + 10, yy, w - 20, rh, 6);
            ctx.fillStyle = tr ? "rgba(255,216,74,0.13)" : "rgba(255,255,255,0.04)";
            ctx.fill();
            if (tr) {
                ctx.strokeStyle = "#ffd84a";
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
            ui.push({ x: x + 10, y: yy, w: w - 20, h: rh, fn: fnT });
            text(fitText(q.n, w - 60 - bwT - 70, 13, true), x + 20, yy + 13, 13, COL.title, "left", true);
            const st2 = ready ? (q.talkq ? "Zanieś list" : "Wróć po nagrodę") : qProg(id) + "/" + q.need;
            text(st2, x + w - 28 - bwT, yy + 13, 11, ready ? COL.good : COL.text, "right", true);
            let ly = yy + 28;
            for (const l of lines) {
                text(l, x + 20, ly, 11, COL.text);
                ly += 14;
            }
            bar(x + 20, ly - 2, w - 48 - bwT, 5, qProg(id) / q.need, ready ? "#7dd36a" : "#5aa8ff", "rgba(255,255,255,0.1)");
            button(x + w - 18 - bwT, yy + 6, bwT, 26, tr ? "Śledzone ✓" : "Śledź", fnT, { fs: 11, col: tr ? "#6a5430" : undefined });
            yy += rh + 6;
            shown++;
        }
        const av = QORDER.filter((q) => qAvail(q));
        if (av.length && yy < y + h - 100) {
            text("Nowe zadania do podjęcia:", x + 14, yy + 6, 11, COL.title, "left", true);
            yy += 18;
            for (const id of av) {
                if (yy > y + h - 80)
                    break;
                const n = NPCS[QUESTS[id].giver];
                text(fitText("! " + n.n + " (" + AREAS[n.area].name + ")", w - 28, 11), x + 18, yy + 4, 11, "#ffd84a");
                yy += 15;
            }
        }
        const nextL = QORDER.filter((q) => qLocked(q));
        if (nextL.length && yy < y + h - 70) {
            const q = QUESTS[nextL[0]];
            text(fitText("Od poz. " + q.lvl + ": " + q.n + " (" + NPCS[q.giver].n + ")", w - 28, 10), x + 18, yy + 6, 10, COL.mute);
        }
        const doneN = QORDER.filter((q) => P.q[q] && P.q[q].s === "done").length;
        text("Ukończone " + doneN + "/" + QORDER.length + " · Pokonani: " + P.kills, x + 14, y + h - 24, 11, COL.mute);
        if (!NET)
            button(x + w - 120, y + h - 40, 106, 28, resetArm > 0 ? "Na pewno?" : "Nowa gra", () => {
                if (resetArm > 0) {
                    P = fresh();
                    migrated = false;
                    selCls = "war";
                    pl.fx = P.x;
                    pl.fy = P.y;
                    pl.mt = 1;
                    pl.target = null;
                    pl.path = [];
                    pl.talk = null;
                    panel = "";
                    dlg = null;
                    banner = 3;
                    resetArm = 0;
                    guide = null;
                    shots.length = 0;
                    warns.length = 0;
                    for (const k of Object.keys(AREAS))
                        if (k !== P.area)
                            AREAS[k].img = null;
                    save();
                }
                else
                    resetArm = 3;
            }, { fs: 12, col: resetArm > 0 ? "#7a2a2a" : undefined });
    }
    function drawShop() {
        modalBack();
        const [x, y, w, h] = panelRect(460, shopTab === "buy" ? 78 + shopList(shopId).length * 46 + 44 : 470);
        box(x, y, w, h);
        ui.push({ x, y, w, h, fn: () => { } });
        text(SHOPN[shopId], x + 14, y + 19, 15, COL.title, "left", true);
        closeBtn(x + w, y, () => { panel = ""; });
        button(x + 14, y + 40, 84, 28, "Kup", () => { shopTab = "buy"; }, { col: shopTab === "buy" ? "#6a5430" : undefined });
        button(x + 104, y + 40, 84, 28, "Sprzedaj", () => { shopTab = "sell"; sellPage = 0; }, { col: shopTab === "sell" ? "#6a5430" : undefined });
        ctx.fillStyle = "#f2c94c";
        ctx.beginPath();
        ctx.arc(x + w - 66, y + 54, 5, 0, 7);
        ctx.fill();
        text(P.gold + " zł", x + w - 56, y + 54.5, 12, COL.text, "left", true);
        const rowH = 46;
        let yy = y + 78;
        const rowsFit = Math.max(1, Math.floor((y + h - 50 - yy) / rowH));
        const bw = w < 360 ? 84 : 100;
        const row = (id, sub, price, lbl, fn, dis, n) => {
            rr(x + 10, yy, w - 20, rowH - 6, 6);
            ctx.fillStyle = "rgba(255,255,255,0.05)";
            ctx.fill();
            drawIcon(id, x + 16, yy + 3, 34);
            text(ITEMS[id].n + (n && n > 1 ? " x" + n : ""), x + 56, yy + 12, 12, COL.text, "left", true);
            text(sub, x + 56, yy + 28, 10, COL.mute);
            button(x + w - bw - 16, yy + 6, bw, 28, lbl + " " + price + " zł", fn, { dis, fs: 11 });
            yy += rowH;
        };
        if (shopTab === "buy") {
            for (const id of shopList(shopId)) {
                const it = ITEMS[id];
                let sub = itemDesc(id);
                if (it.t === "w" && P.eq.w) {
                    const d = it.atk - ITEMS[P.eq.w].atk;
                    sub += d > 0 ? " (+" + d + ")" : " (" + d + ")";
                }
                if (it.t === "a" && P.eq.a) {
                    const d = it.def - ITEMS[P.eq.a].def;
                    sub += d > 0 ? " (+" + d + ")" : " (" + d + ")";
                }
                row(id, sub, it.price, "Kup", () => act({ a: "buy", id }), P.gold < it.price);
            }
            text(shopId === "smith" || shopId === "armory" ? "Sprzęt dla klasy: " + C().n + ". Załóż go w torbie." : "Mikstury: H – leczenie, G – mana/energia.", x + 14, y + h - 22, 11, COL.mute);
        }
        else {
            const inv = P.inv.map((s, i) => ({ s, i }));
            const pages = Math.max(1, Math.ceil(inv.length / rowsFit));
            sellPage = Math.min(sellPage, pages - 1);
            const slice = inv.slice(sellPage * rowsFit, sellPage * rowsFit + rowsFit);
            if (!slice.length)
                text("Torba jest pusta.", x + 14, yy + 10, 12, COL.mute);
            for (const e of slice) {
                const it = ITEMS[e.s.id], pr = Math.max(1, Math.floor(it.price / 2));
                row(e.s.id, itemDesc(e.s.id), pr, "Sprzedaj", () => act({ a: "sell", i: e.i }), false, e.s.n);
            }
            if (pages > 1) {
                button(x + 14, y + h - 40, 36, 28, "‹", () => { sellPage = Math.max(0, sellPage - 1); });
                text((sellPage + 1) + "/" + pages, x + 70, y + h - 26, 12, COL.text, "center");
                button(x + 90, y + h - 40, 36, 28, "›", () => { sellPage = Math.min(pages - 1, sellPage + 1); });
            }
            if (P.inv.some((s) => ITEMS[s.id].t === "j"))
                button(x + w - 140, y + h - 40, 126, 28, "Sprzedaj łupy", () => act({ a: "junk" }), { fs: 12 });
        }
    }
    function drawDialog() {
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(0, 0, W, H);
        ui.push({ x: 0, y: 0, w: W, h: H, fn: () => { } });
        const w = Math.min(W - 16, 640);
        const lines = wrap(dlg.text, w - 28, 13);
        ctx.font = "bold 13px " + FONT;
        const bws = dlg.opts.map((o) => Math.min(w - 28, ctx.measureText(o.l).width + 28));
        let rows = 1, acc = 0;
        for (const b of bws) {
            if (acc + b > w - 28 && acc > 0) {
                rows++;
                acc = 0;
            }
            acc += b + 8;
        }
        const h = 44 + lines.length * 18 + rows * 40 + 6;
        const x = (W - w) / 2, y = H - h - 10;
        box(x, y, w, h);
        text(dlg.name, x + 14, y + 19, 14, COL.title, "left", true);
        let yy = y + 42;
        for (const l of lines) {
            text(l, x + 14, yy, 13, COL.text);
            yy += 18;
        }
        let bx = x + 14;
        yy += 2;
        dlg.opts.forEach((o, i) => {
            if (bx + bws[i] > x + w - 14 && bx > x + 14) {
                bx = x + 14;
                yy += 40;
            }
            button(bx, yy, bws[i], 32, o.l, o.fn);
            bx += bws[i] + 8;
        });
    }
    function drawMap() {
        modalBack();
        const [x, y, w, h] = panelRect(920, 700);
        box(x, y, w, h);
        ui.push({ x, y, w, h, fn: () => { } });
        text("Mapa", x + 14, y + 19, 15, COL.title, "left", true);
        button(x + 66, y + 7, 78, 26, "Kraina", () => { mapTab = "area"; }, { fs: 12, col: mapTab === "area" ? "#6a5430" : undefined });
        button(x + 150, y + 7, 78, 26, "Świat", () => { mapTab = "world"; }, { fs: 12, col: mapTab === "world" ? "#6a5430" : undefined });
        closeBtn(x + w, y, () => { panel = ""; });
        const legH = w < 520 ? 44 : 26;
        const ix = x + 10, iy = y + 42, iw = w - 20, ih = h - 42 - legH - 8;
        if (mapTab === "area") {
            const a = A();
            const k = Math.min(iw / a.w, ih / a.h);
            const ox = ix + (iw - a.w * k) / 2, oy = iy + (ih - a.h * k) / 2;
            ctx.imageSmoothingEnabled = false;
            if (a.mini)
                ctx.drawImage(a.mini, ox, oy, a.w * k, a.h * k);
            ctx.strokeStyle = "rgba(201,164,92,0.6)";
            ctx.lineWidth = 1;
            ctx.strokeRect(ox, oy, a.w * k, a.h * k);
            const tp = (tx, ty) => [ox + (tx + 0.5) * k, oy + (ty + 0.5) * k];
            if (guide && guide.path && guide.path.length) {
                ctx.strokeStyle = "rgba(255,216,74,0.9)";
                ctx.lineWidth = 2;
                ctx.setLineDash([4, 4]);
                ctx.lineDashOffset = -time * 12;
                ctx.beginPath();
                const p0 = tp(P.x, P.y);
                ctx.moveTo(p0[0], p0[1]);
                for (const nd of guide.path) {
                    const p = tp(nd[0], nd[1]);
                    ctx.lineTo(p[0], p[1]);
                }
                ctx.stroke();
                ctx.setLineDash([]);
            }
            for (const m of mobs[P.area])
                if (!m.dead && !m.d.boss) {
                    const p = tp(m.x, m.y);
                    ctx.fillStyle = "#ff4a3a";
                    ctx.beginPath();
                    ctx.arc(p[0], p[1], Math.max(2, k * 0.3), 0, 7);
                    ctx.fill();
                }
            const labels = [];
            const lab = (lx, ly, t, col, fs2) => {
                ctx.font = "bold " + fs2 + "px " + FONT;
                const tw = ctx.measureText(t).width;
                let bx = clamp(lx - tw / 2 - 4, ix, ix + iw - tw - 8), by = clamp(ly - 16, iy, iy + ih - 14);
                for (let i = 0; i < 4; i++)
                    if (labels.some((r2) => bx < r2[0] + r2[2] && bx + tw + 8 > r2[0] && by < r2[1] + 14 && by + 14 > r2[1]))
                        by += 15;
                labels.push([bx, by, tw + 8]);
                ctx.fillStyle = "rgba(0,0,0,0.72)";
                rr(bx, by, tw + 8, 14, 3);
                ctx.fill();
                text(t, bx + 4, by + 7.5, fs2, col, "left", true);
            };
            for (const m of mobs[P.area])
                if (m.d.boss) {
                    const p = tp(m.dead ? m.hx : m.x, m.dead ? m.hy : m.y);
                    ctx.fillStyle = m.dead ? "rgba(197,140,255,0.4)" : "#c58cff";
                    ctx.beginPath();
                    ctx.arc(p[0], p[1], 6, 0, 7);
                    ctx.fill();
                    ctx.strokeStyle = "#fff";
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                    lab(p[0], p[1] - 4, "☠ " + m.d.n + " (" + m.d.lvl + ")" + (m.dead ? " – pokonany" : ""), "#e0c8ff", 10);
                }
            for (const g of EXG[a.id]) {
                const p = tp(g.x, g.y);
                ctx.save();
                ctx.translate(p[0], p[1]);
                ctx.rotate(Math.PI / 4);
                ctx.fillStyle = "#fff";
                ctx.fillRect(-5, -5, 10, 10);
                ctx.strokeStyle = "#000";
                ctx.lineWidth = 1.5;
                ctx.strokeRect(-5, -5, 10, 10);
                ctx.restore();
                lab(p[0], p[1] - 4, "→ " + AREAS[g.to].name, "#ffffff", 11);
            }
            for (const id of Object.keys(NPCS)) {
                const n = NPCS[id];
                if (n.area !== P.area)
                    continue;
                const p = tp(n.x, n.y), mk = npcMark(id);
                ctx.fillStyle = "#ffd84a";
                ctx.beginPath();
                ctx.arc(p[0], p[1], 4, 0, 7);
                ctx.fill();
                ctx.strokeStyle = "#000";
                ctx.lineWidth = 1;
                ctx.stroke();
                lab(p[0], p[1] - 4, (mk === "!" || mk === "?" ? mk + " " : "") + n.n, mk === "!" || mk === "?" ? "#ffd84a" : "#bfe3ff", 10);
            }
            if (guide) {
                const p = tp(guide.x, guide.y), pul = 6 + Math.sin(time * 6) * 2;
                ctx.strokeStyle = "#ffd84a";
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.arc(p[0], p[1], pul, 0, 7);
                ctx.stroke();
                ctx.fillStyle = "#ffd84a";
                ctx.beginPath();
                ctx.arc(p[0], p[1], 2.5, 0, 7);
                ctx.fill();
            }
            const pq = tp(P.x, P.y);
            ctx.fillStyle = "rgba(79,176,255,0.3)";
            ctx.beginPath();
            ctx.arc(pq[0], pq[1], 9 + Math.sin(time * 5) * 2, 0, 7);
            ctx.fill();
            arrowTri(pq[0], pq[1], [Math.PI / 2, Math.PI, 0, -Math.PI / 2][pl.dir], 7, "#4fb0ff");
            const items = [["#4fb0ff", "Ty"], ["#ffd84a", "Postać (! / ?)"], ["#ff4a3a", "Potwór"], ["#c58cff", "Boss"], ["#ffffff", "Przejście"], ["#ffd84a", "◎ Cel zadania"]];
            let lx = x + 14, lyy = y + h - legH + 4;
            for (const it of items) {
                ctx.font = "11px " + FONT;
                const tw = ctx.measureText(it[1]).width;
                if (lx + tw + 24 > x + w - 10) {
                    lx = x + 14;
                    lyy += 18;
                }
                ctx.fillStyle = it[0];
                ctx.beginPath();
                ctx.arc(lx + 5, lyy + 6, 4, 0, 7);
                ctx.fill();
                text(it[1], lx + 13, lyy + 6.5, 11, COL.text);
                lx += tw + 28;
            }
        }
        else {
            let gxm = 0, gym = 0;
            for (const k of Object.keys(AINFO)) {
                gxm = Math.max(gxm, AINFO[k].gx);
                gym = Math.max(gym, AINFO[k].gy);
            }
            const trp = ih > iw * 1.1;
            const cw = iw / ((trp ? gym : gxm) + 1), ch = ih / ((trp ? gxm : gym) + 1);
            const nb2 = (id) => [ix + ((trp ? AINFO[id].gy : AINFO[id].gx) + 0.5) * cw, iy + ((trp ? AINFO[id].gx : AINFO[id].gy) + 0.5) * ch];
            const done = {};
            ctx.lineWidth = 3;
            ctx.strokeStyle = "rgba(201,164,92,0.45)";
            for (const a1 of Object.keys(GRAPH))
                for (const a2 of Object.keys(GRAPH[a1])) {
                    const key = [a1, a2].sort().join("-");
                    if (done[key])
                        continue;
                    done[key] = true;
                    const p1 = nb2(a1), p2 = nb2(a2);
                    ctx.beginPath();
                    ctx.moveTo(p1[0], p1[1]);
                    ctx.lineTo(p2[0], p2[1]);
                    ctx.stroke();
                }
            if (guide && guide.o.area !== P.area) {
                const rt = routeList(P.area, guide.o.area);
                ctx.strokeStyle = "#ffd84a";
                ctx.lineWidth = 4;
                ctx.setLineDash([8, 6]);
                ctx.lineDashOffset = -time * 20;
                ctx.beginPath();
                rt.forEach((id, i) => { const p = nb2(id); if (i === 0)
                    ctx.moveTo(p[0], p[1]);
                else
                    ctx.lineTo(p[0], p[1]); });
                ctx.stroke();
                ctx.setLineDash([]);
            }
            const bw2 = Math.min(cw - 10, 190), bh2 = Math.min(ch - 14, 70);
            for (const id of Object.keys(AREAS)) {
                const p = nb2(id), seen = !!P.seen[id], cur = id === P.area, goal = guide && guide.o.area === id;
                const bx = p[0] - bw2 / 2, by = p[1] - bh2 / 2;
                rr(bx, by, bw2, bh2, 8);
                ctx.fillStyle = MINI[AREAS[id].base] || "#444";
                ctx.fill();
                const am = AREAS[id].mini;
                if (am) {
                    ctx.save();
                    rr(bx, by, bw2, bh2, 8);
                    ctx.clip();
                    const k2 = Math.max(bw2 / am.width, bh2 / am.height);
                    ctx.drawImage(am, p[0] - am.width * k2 / 2, p[1] - am.height * k2 / 2, am.width * k2, am.height * k2);
                    ctx.restore();
                }
                rr(bx, by, bw2, bh2, 8);
                ctx.fillStyle = seen ? "rgba(0,0,0,0.38)" : "rgba(10,8,14,0.62)";
                ctx.fill();
                if (pvpMap(id) || CITY[id]) {
                    const tg = CITY[id] ? "bezpieczna" : "⚔ PvP";
                    ctx.font = "bold 9px " + FONT;
                    const tw = ctx.measureText(tg).width + 8;
                    rr(bx + bw2 - tw - 4, by + bh2 - 15, tw, 12, 4);
                    ctx.fillStyle = CITY[id] ? "rgba(40,120,60,0.9)" : "rgba(170,30,30,0.92)";
                    ctx.fill();
                    text(tg, bx + bw2 - tw / 2 - 4, by + bh2 - 9, 9, "#fff", "center", true);
                }
                ctx.strokeStyle = cur ? "#4fb0ff" : goal ? "#ffd84a" : COL.bd;
                ctx.lineWidth = cur || goal ? 2.5 : 1;
                ctx.stroke();
                const fs3 = bw2 < 110 ? 10 : 12;
                text(fitText(AREAS[id].name + (seen ? "" : " (nieodwiedzona)"), bw2 - 10, fs3, true), p[0], by + 14, fs3, seen ? COL.title : "#cfc6b8", "center", true);
                text(fitText(AINFO[id].lv, bw2 - 8, 9), p[0], by + 29, 9, COL.text, "center");
                const qn = activeQuests().filter((q) => QUESTS[q].area === id).length;
                if (cur)
                    text("● Tu jesteś", p[0], by + bh2 - 11, 10, "#4fb0ff", "center", true);
                else if (goal)
                    text("★ Cel zadania", p[0], by + bh2 - 11, 10, "#ffd84a", "center", true);
                else if (qn)
                    text("Zadania: " + qn, p[0], by + bh2 - 11, 10, "#9fd3ff", "center", true);
            }
            text("Złota linia: droga do celu zadania. Wszystkie krainy są otwarte – ale wysoko poziomowe są śmiertelnie groźne. ⚔ PvP: inni gracze mogą cię zaatakować.", x + 14, y + h - legH + 10, 11, COL.mute);
        }
    }
    function drawCard(c, x, y, w, h, row) {
        const cl = CLS[c], sel = selCls === c;
        rr(x, y, w, h, 10);
        ctx.fillStyle = sel ? "rgba(90,70,40,0.92)" : COL.bg;
        ctx.fill();
        ctx.strokeStyle = sel ? "#ffd25a" : COL.bd;
        ctx.lineWidth = sel ? 2.5 : 1.2;
        ctx.stroke();
        ui.push({ x, y, w, h, fn: () => { selCls = c; } });
        const ps = row ? Math.min(2.3, (h - 16) / 36) : Math.min(3, (w - 40) / 40, (h * 0.32) / 34);
        const sx = row ? x + 12 : x + w / 2 - 16 * ps, sy = row ? y + h / 2 - 17 * ps : y + 18 + 12 * ps * 0.5;
        ctx.save();
        ctx.translate(sx, sy + 10 * ps * 0.3);
        ctx.scale(ps, ps);
        drawHuman(0, 0, 0, sel ? time * 8 : 0, cl.look, ITEMS[GEAR[c].w[sel ? 3 : 1]].c, null, false, 0, cl.wk);
        ctx.restore();
        const tx = row ? x + 22 + 32 * ps : x + 14;
        let ty = row ? y + 16 : sy + 38 * ps + 10;
        const tw = row ? x + w - tx - 10 : w - 28;
        text(cl.n, tx, ty, 16, sel ? "#ffe9a8" : COL.title, "left", true);
        text("klawisz " + (CLSORDER.indexOf(c) + 1), tx + tw, ty, 9, COL.mute, "right");
        ty += 17;
        const dl = wrap(cl.desc, tw, 11);
        for (const l of dl.slice(0, row ? 2 : 3)) {
            text(l, tx, ty, 11, COL.text);
            ty += 14;
        }
        ty += 2;
        const sn = ["Życie", "Atak", "Obrona", "Zasięg"];
        for (let i = 0; i < 4; i++) {
            const colW = row ? tw / 2 : tw;
            const cx2 = tx + (row ? (i % 2) * colW : 0), cy2 = row ? ty + Math.floor(i / 2) * 14 : ty + i * 15;
            text(sn[i], cx2, cy2, 10, COL.mute);
            for (let j = 0; j < 5; j++) {
                ctx.fillStyle = j < cl.st[i] ? "#ffd25a" : "rgba(255,255,255,0.15)";
                ctx.fillRect(cx2 + 46 + j * 9, cy2 - 3, 7, 7);
            }
        }
        ty += row ? 30 : 64;
        if (row) {
            const sl = wrap("Umiejętności: " + SK[c].map((s) => s.n).join(", "), tw, 10);
            for (const l of sl.slice(0, 2)) {
                if (ty > y + h - 6)
                    break;
                text(l, tx, ty, 10, "#bfe3ff");
                ty += 13;
            }
        }
        else {
            text("Umiejętności:", tx, ty, 11, COL.title, "left", true);
            ty += 15;
            for (const s of SK[c]) {
                if (ty > y + h - 14)
                    break;
                text(fitText(s.n + (s.lvl > 1 ? " (poz. " + s.lvl + ")" : ""), tw, 11, true), tx, ty, 11, "#bfe3ff", "left", true);
                ty += 13;
                const l2 = wrap(s.d, tw, 10);
                for (const l of l2.slice(0, 2)) {
                    if (ty > y + h - 10)
                        break;
                    text(l, tx, ty, 10, COL.mute);
                    ty += 12;
                }
                ty += 3;
            }
        }
    }
    function drawSelect() {
        ctx.fillStyle = "rgba(10,8,14,0.84)";
        ctx.fillRect(0, 0, W, H);
        ui.push({ x: 0, y: 0, w: W, h: H, fn: () => { } });
        const narrow = W < 640;
        const tfs = Math.min(30, W / 13);
        text("ARDAN", W / 2, 30, tfs, COL.title, "center", true);
        text("Wybierz klasę postaci", W / 2, 30 + tfs * 0.5 + 14, 13, COL.text, "center", true);
        let top = 30 + tfs * 0.5 + 30;
        if (migrated) {
            const ml = wrap("Znaleziono zapis z poprzedniej wersji (poziom " + P.lvl + "). Poziom, złoto, przedmioty i zadania zostaną zachowane – wybierz tylko klasę.", W - 40, 11);
            for (const l of ml) {
                text(l, W / 2, top, 11, "#9fd3ff", "center");
                top += 14;
            }
            top += 6;
        }
        const btnH = 44, avail = H - top - btnH - 26;
        if (!narrow) {
            const cw = Math.min(280, (W - 56) / 3), ch = Math.min(avail, 400);
            const x0 = (W - (cw * 3 + 32)) / 2;
            CLSORDER.forEach((c, i) => drawCard(c, x0 + i * (cw + 16), top, cw, ch, false));
        }
        else {
            const ch = Math.min(176, (avail - 16) / 3), cw = Math.min(W - 24, 520);
            CLSORDER.forEach((c, i) => drawCard(c, (W - cw) / 2, top + i * (ch + 8), cw, ch, true));
        }
        const bw = Math.min(W - 40, 340);
        button((W - bw) / 2, H - btnH - 16, bw, btnH, "Rozpocznij jako: " + CLS[selCls].n + " ▸", () => pickClass(selCls), { fs: 15, col: "#7a5a2a" });
    }
    // ---------- INPUT ----------
    function pos(e) { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    function hitUi(x, y) {
        for (let i = ui.length - 1; i >= 0; i--) {
            const b = ui[i];
            if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)
                return b;
        }
        return null;
    }
    const worldAt = (sx, sy) => [sx / S + camX, sy / S + camY];
    function mobUnder(w) {
        for (const m of mobs[P.area]) {
            if (m.dead)
                continue;
            const mp = rpos(m);
            if (Math.abs(mp[0] + 16 - w[0]) < 20 && Math.abs(mp[1] + 16 - w[1]) < 22)
                return m;
        }
        return null;
    }
    // Pointer input: UI buttons, the arrow d-pad, and target selection only.
    // Tapping the world never moves the player (movement comes from the d-pad / WASD / arrow keys).
    function onDown(e) {
        e.preventDefault();
        try {
            canvas.focus({ preventScroll: true });
        }
        catch (er) { /* ignore */ }
        if (e.pointerType === "touch" || e.pointerType === "pen")
            touchMode = true;
        else if (e.pointerType === "mouse")
            touchMode = false;
        const p = pos(e);
        try {
            canvas.setPointerCapture(e.pointerId);
        }
        catch (er) { /* ignore */ }
        const b = hitUi(p[0], p[1]);
        if (b) {
            if (b.pad) {
                if (!panel && !dlg)
                    pad.ptr[e.pointerId] = padCell(p[0], p[1]);
                return;
            }
            b.fn();
            return;
        }
        if (!P.cls || panel || dlg)
            return;
        if (pl.dead || trans)
            return;
        const w = worldAt(p[0], p[1]);
        const tx = Math.floor(w[0] / TS), ty = Math.floor(w[1] / TS);
        if (NET && NET.objs && NET.onObjTap)
            for (const o of NET.objs) {
                if (o.a !== P.area)
                    continue;
                const tx = Math.floor(w[0] / TS), ty = Math.floor(w[1] / TS);
                if (tx === o.x && (ty === o.y || (o.k === "gate" && ty === o.y - 1))) {
                    NET.onObjTap(o);
                    return;
                }
            }
        if (NET && NET.onPlayerTap)
            for (const k of Object.keys(others)) {
                const o = others[k];
                if (o.area !== P.area || o.dead)
                    continue;
                const op = rpos(o);
                if (Math.abs(op[0] + 16 - w[0]) < 15 && Math.abs(op[1] + 14 - w[1]) < 19) {
                    NET.onPlayerTap(o);
                    return;
                }
            }
        const m = mobUnder(w);
        if (m) {
            act({ a: "target", area: P.area, i: mobs[P.area].indexOf(m) });
            return;
        }
        const npc = npcAt(tx, ty) || npcAt(tx, ty + 1);
        if (npc) {
            act({ a: "npc", id: npc });
            return;
        }
        act({ a: "untarget" });
    }
    function onMove(e) {
        const p = pos(e);
        if (pad.ptr[e.pointerId]) {
            pad.ptr[e.pointerId] = padCell(p[0], p[1]);
            return;
        }
        if (e.pointerType === "mouse") {
            mouse = { x: p[0], y: p[1] };
            const w = worldAt(p[0], p[1]);
            hover = null;
            const m = mobUnder(w);
            if (m)
                hover = { m, sx: p[0], sy: p[1], t: "" };
            const tx = Math.floor(w[0] / TS), ty = Math.floor(w[1] / TS);
            for (const ex of A().exits)
                if (ex.x === tx && ex.y === ty)
                    hover = { sx: p[0], sy: p[1], t: "Przejście: " + AREAS[ex.to].name };
            canvas.style.cursor = hitUi(p[0], p[1]) && (panel || dlg || p[1] > H - 140 || p[1] < 120) ? "pointer" : hover && hover.m ? "crosshair" : "default";
        }
    }
    function onUp(e) { delete pad.ptr[e.pointerId]; }
    function onLeave(e) { if (e.pointerType === "mouse") {
        mouse = null;
        hover = null;
    } }
    function onCtx(e) { e.preventDefault(); }
    function onKey(e) {
        const tg = e.target;
        if (tg && tg !== canvas && (tg.tagName === "INPUT" || tg.tagName === "TEXTAREA"))
            return;
        const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].indexOf(e.key) >= 0)
            e.preventDefault();
        if (e.type === "keyup") {
            keys[k] = false;
            return;
        }
        if (e.repeat && keys[k])
            return;
        keys[k] = true;
        if (!P.cls) {
            if (/^[1-3]$/.test(k))
                selCls = CLSORDER[Number(k) - 1];
            else if (k === "ArrowLeft" || k === "ArrowUp")
                selCls = CLSORDER[(CLSORDER.indexOf(selCls) + 2) % 3];
            else if (k === "ArrowRight" || k === "ArrowDown")
                selCls = CLSORDER[(CLSORDER.indexOf(selCls) + 1) % 3];
            else if (k === "Enter" || k === " ")
                pickClass(selCls);
            for (const kk of Object.keys(keys))
                keys[kk] = false;
            return;
        }
        if (NET && NET.onKey && !dlg && NET.onKey(k)) {
            for (const kk of Object.keys(keys))
                keys[kk] = false;
            return;
        }
        if (k === "Escape") {
            if (dlg) {
                if (dlg.srv)
                    actQ.push({ a: "dlgx" });
                dlg = null;
            }
            else
                panel = "";
            return;
        }
        if (dlg) {
            if (k === "e" || k === "Enter" || k === " ")
                talkKey();
            else if (/^[1-9]$/.test(k) && dlg.opts[Number(k) - 1])
                dlg.opts[Number(k) - 1].fn();
            return;
        }
        if (k === " " || k === "f")
            act({ a: "atk" });
        else if (k === "e" || k === "Enter")
            act({ a: "talk" });
        else if (k === "1" || k === "2" || k === "3")
            act({ a: "sk", i: Number(k) - 1 });
        else if (k === "i" || k === "b") {
            panel = panel === "inv" ? "" : "inv";
            invSel = -1;
        }
        else if (k === "q" || k === "j")
            panel = panel === "quest" ? "" : "quest";
        else if ((k === "c" || k === "/") && NET && NET.onChat) {
            for (const kk of Object.keys(keys))
                keys[kk] = false;
            NET.onChat();
        }
        else if (k === "m") {
            panel = panel === "map" ? "" : "map";
            mapTab = "area";
        }
        else if (k === "h")
            act({ a: "pot" });
        else if (k === "g")
            act({ a: "mpot" });
        else if (k === "t") {
            const act = activeQuests();
            if (act.length) {
                P.track = act[(act.indexOf(P.track) + 1) % act.length];
                guideT = 0;
                actQ.push({ a: "track", id: P.track });
                log("Śledzone zadanie: " + QUESTS[P.track].n, "#9fd3ff");
            }
        }
        else if (k === "+" || k === "=")
            P.mmz = Math.min(2, (P.mmz || 0) + 1);
        else if (k === "-")
            P.mmz = Math.max(0, (P.mmz || 0) - 1);
    }
    function onBlur() { for (const k of Object.keys(keys))
        keys[k] = false; for (const k of Object.keys(pad.ptr))
        delete pad.ptr[Number(k)]; }
    if (!SRV) {
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
    }
    // ---------- LOOP ----------
    let last = 0;
    function frame(ts) {
        if (destroyed)
            return;
        const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016;
        last = ts;
        dpr = Math.min(2, window.devicePixelRatio || 1);
        const cw = Math.max(1, canvas.clientWidth), ch = Math.max(1, canvas.clientHeight);
        if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
            canvas.width = Math.round(cw * dpr);
            canvas.height = Math.round(ch * dpr);
        }
        W = cw;
        H = ch;
        try {
            update(dt);
            draw();
        }
        catch (err) {
            if (typeof console !== "undefined")
                console.error(err);
        }
        raf = requestAnimationFrame(frame);
    }
    if (!SRV)
        raf = requestAnimationFrame(frame);
    log("Witaj w Ardanie!", "#f5d98a");
    if (SRV)
        SRV.api = {
            tick: srvTick, pl, P: () => P, maxHp, maxMp,
            stats: statsAll, items: ITEMS, mon: MON, gearIds: GEAR, sk: SK, skx: SKX, cls: CLS, zones: PVPZ, pvpAt, pvpMap, city: CITY, npcs: NPCS, areas: AREAS, ainfo: AINFO,
            kill: (m) => { if (m && !m.dead) {
                m.hp = 0;
                killMob(m);
            } }, die: () => { if (!pl.dead)
                die(); },
            gainXp: (n) => gainXp(n), countItem, removeItem, addItem, log, solid: (a, x, y) => solidT(AREAS[a], x, y),
            drain: () => ({ fx: fx.splice(0, fx.length), msgs: msgs.splice(0, msgs.length) }),
            shots: () => shots, warns: () => warns, bags: () => bags,
            dlgView: () => dlg ? { name: dlg.name, text: dlg.text, opts: dlg.opts.map((o) => o.l) } : null,
            shopReq: () => { if (panel === "shop") {
                panel = "";
                return shopId;
            } return null; },
            uiReq: () => { const u = uiReq; uiReq = ""; return u || null; },
            quests: QUESTS, qorder: QORDER, maxLvl: MAXLVL,
            mobIdx: (m) => mobs[P.area].indexOf(m),
            partyKill: (mk, mlvl, baseXp, from) => {
                if (pl.dead > 0 || !P.cls)
                    return;
                for (const qid of QORDER) {
                    const q = QUESTS[qid], s2 = P.q[qid];
                    if (s2 && s2.s === "active" && q.kill === mk && s2.c < q.need) {
                        s2.c++;
                        log(q.n + ": " + s2.c + "/" + q.need + " (drużyna)", "#9fd3ff");
                        if (s2.c === q.need)
                            log("Cel osiągnięty! Strzałka wskaże, komu oddać zadanie.", "#7dff8a");
                    }
                }
                let xp = baseXp;
                const diff = P.lvl - mlvl;
                if (diff > 4)
                    xp = Math.max(1, Math.round(xp * 0.3));
                else if (diff > 2)
                    xp = Math.round(xp * 0.7);
                xp = Math.max(1, Math.round(xp * 0.5));
                log("Drużyna (" + from + "): +" + xp + " PD", "#8fff8f");
                gainXp(xp);
                save();
            },
        };
    const withCtx = (g, fn) => { const o = ctx; ctx = g; try {
        fn();
    }
    finally {
        ctx = o;
    } };
    if (NET)
        NET.api = { recv: netRecv, clearKeys: onBlur, log,
            P: () => P, stats: statsAll, items: ITEMS, mon: MON, sk: SK, skx: SKX, cls: CLS, zones: PVPZ, pvpAt, pvpMap, city: CITY, others: () => others, gearIds: GEAR, npcs: NPCS, ainfo: AINFO,
            drawMob: (g, k) => { if (MON[k])
                withCtx(g, () => drawMob({ k, d: MON[k], x: 0, y: 0, fx: 0, fy: 0, mt: 1, hit: 0, anim: 0, dir: 0, hp: MON[k].hp, cd: 0, frz: 0 })); },
            drawChar: (g, cls, w, a, dir) => { const c = CLS[cls] || CLS.war; withCtx(g, () => drawHuman(0, 0, dir || 0, 0, c.look, w && ITEMS[w] ? ITEMS[w].c : null, a && a !== "shirt" && ITEMS[a] ? ITEMS[a].c : null, false, 0, c.wk)); },
            drawIcon: (g, id, x, y, sz) => { if (ITEMS[id])
                withCtx(g, () => drawIcon(id, x, y, sz)); },
        };
    return () => {
        destroyed = true;
        if (!SRV)
            cancelAnimationFrame(raf);
        save();
        if (SRV)
            return;
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("pointerup", onUp);
        canvas.removeEventListener("pointercancel", onUp);
        canvas.removeEventListener("pointerleave", onLeave);
        canvas.removeEventListener("contextmenu", onCtx);
        window.removeEventListener("keydown", onKey);
        window.removeEventListener("keyup", onKey);
        window.removeEventListener("blur", onBlur);
    };
}

module.exports = { createArdan };
