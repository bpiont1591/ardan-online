  // ---------- DRAW: MAIN ----------
  function drawPlayerAt(x: number, y: number, dir: number, walk: number, flash: boolean, lunge: number): void {
    const w = P.eq.w ? ITEMS[P.eq.w].c : null, ar = P.eq.a && P.eq.a !== "shirt" ? ITEMS[P.eq.a].c : null;
    drawHuman(x, y, dir, walk, C().look, w, ar, flash, lunge, C().wk);
  }
  function arrowTri(cx: number, cy: number, ang: number, sz: number, col: string): void {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(sz, 0); ctx.lineTo(-sz * 0.7, -sz * 0.75); ctx.lineTo(-sz * 0.35, 0); ctx.lineTo(-sz * 0.7, sz * 0.75); ctx.closePath();
    ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = "rgba(0,0,0,0.75)"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }
  function draw(): void {
    ui = [];
    const a = A();
    if (!a.img) renderArea(a);
    const info = AINFO[a.id];
    const isSmall = W < 520;
    S = clamp(Math.min(W / (isSmall ? 11.5 : 15), H / 11) / TS, 0.7, 2);
    const vw = W / S, vh = H / S;
    const pp = rpos(pl2());
    const mw = a.w * TS, mh = a.h * TS;
    camX = mw <= vw ? (mw - vw) / 2 : clamp(pp[0] + 16 - vw / 2, 0, mw - vw);
    camY = mh <= vh ? (mh - vh) / 2 : clamp(pp[1] + 16 - vh / 2, 0, mh - vh);
    camX = Math.round(camX * S) / S; camY = Math.round(camY * S) / S;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = info.bg; ctx.fillRect(0, 0, W, H);
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
      if (t === WATER || t === FOUNT) {
        const o = (Math.sin(time * 1.6 + x * 0.9 + y * 0.6) + 1) * 6;
        ctx.fillStyle = "rgba(200,235,255,0.35)"; ctx.fillRect(x * TS + 4 + o, y * TS + 10 + ((x * 7) % 12), 7, 2);
      } else if (t === BOG) {
        const ph = (time * 0.7 + x * 0.37 + y * 0.61) % 3;
        if (ph < 0.6) { ctx.strokeStyle = "rgba(160,190,120," + (0.6 - ph).toFixed(3) + ")"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x * TS + 10 + (x * 5) % 12, y * TS + 12 + (y * 7) % 10, 1 + ph * 5, 0, Math.PI * 2); ctx.stroke(); }
      } else if (t === PORTAL) {
        const gl = 0.35 + Math.sin(time * 3) * 0.15;
        const grd = ctx.createRadialGradient(x * TS + 16, y * TS + 22, 2, x * TS + 16, y * TS + 22, 26);
        grd.addColorStop(0, "rgba(197,140,255," + gl.toFixed(3) + ")"); grd.addColorStop(1, "rgba(197,140,255,0)");
        ctx.fillStyle = grd; ctx.fillRect(x * TS - 12, y * TS - 8, 56, 56);
      }
    }
    for (const e of a.exits) if (gt(a, e.x, e.y) !== PORTAL) {
      const al = 0.25 + Math.sin(time * 3) * 0.12;
      ctx.fillStyle = "rgba(255,230,140," + al.toFixed(3) + ")"; ctx.fillRect(e.x * TS + 4, e.y * TS + 4, 24, 24);
    }
    for (const w of warns) if (w.area === P.area) {
      const k = 1 - w.t / w.max, x0 = (w.x - w.r) * TS, y0 = (w.y - w.r) * TS, s2 = (w.r * 2 + 1) * TS;
      ctx.fillStyle = "rgba(255,40,30," + (0.15 + k * 0.35).toFixed(3) + ")"; ctx.fillRect(x0, y0, s2, s2);
      ctx.strokeStyle = "rgba(255,90,60,0.9)"; ctx.lineWidth = 2; ctx.strokeRect(x0 + 1, y0 + 1, s2 - 2, s2 - 2);
      const ins = (1 - k) * s2 / 2; ctx.strokeStyle = "rgba(255,220,160,0.8)"; ctx.strokeRect(x0 + ins, y0 + ins, s2 - ins * 2, s2 - ins * 2);
    }
    if (guide && guide.path && P.cls && !pl.dead) {
      const n = Math.min(guide.path.length, 16);
      for (let i = 0; i < n; i++) {
        const nd = guide.path[i]; const ph = (time * 3 - i * 0.35) % 1;
        ctx.globalAlpha = (1 - i / n) * (0.35 + 0.35 * (ph < 0 ? ph + 1 : ph));
        ctx.fillStyle = "#ffd84a"; ctx.beginPath(); ctx.arc(nd[0] * TS + 16, nd[1] * TS + 18, 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    for (const b of bags) if (b.area === P.area) drawBag(b);
    const ents: any[] = [];
    for (const k of Object.keys(NPCS)) if (NPCS[k].area === P.area) ents.push({ y: NPCS[k].y * TS, f: () => drawNpc(k) });
    for (const d of DECOR) if (d.area === P.area) ents.push({ y: d.y * TS, f: () => drawDecor(d) });
    for (const m of mobs[P.area]) if (!m.dead) ents.push({ y: rpos(m)[1], f: () => drawMob(m) });
    if (!pl.dead && P.cls) ents.push({ y: pp[1] + 0.5, f: () => {
      if (pl.buffDef > 0) { ctx.strokeStyle = "rgba(255,150,60," + (0.5 + 0.3 * Math.sin(time * 8)).toFixed(3) + ")"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(pp[0] + 16, pp[1] + 28, 14, 5, 0, 0, Math.PI * 2); ctx.stroke(); }
      if (pl.haste > 0 && R() < 0.3) fx.push({ k: "p", x: pp[0] + 6 + R() * 20, y: pp[1] + 10 + R() * 16, vx: 0, vy: -30, c: "#9dff9a", life: 0.4, max: 0.8 });
      drawPlayerAt(pp[0], pp[1], pl.dir, pl.mt < 1 ? pl.phase : 0, pl.hit > 0, pl.anim);
    } });
    ents.sort((p: any, q: any) => p.y - q.y);
    for (const e of ents) e.f();
    for (const s of shots) {
      if (s.area !== P.area) continue;
      if (s.kind === "arrow" || s.kind === "aim") {
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.ang);
        const L = s.kind === "aim" ? 18 : 13;
        ctx.strokeStyle = s.kind === "aim" ? "#ffe08a" : "#e8dcc0"; ctx.lineWidth = s.kind === "aim" ? 2.5 : 1.8; ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(0, 0); ctx.stroke();
        ctx.fillStyle = "#c9d1d9"; ctx.beginPath(); ctx.moveTo(3, 0); ctx.lineTo(-3, -3); ctx.lineTo(-3, 3); ctx.fill();
        if (s.kind === "aim") { ctx.fillStyle = "rgba(255,224,138,0.35)"; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      } else {
        const big = s.kind === "fire", col = s.kind === "fire" ? "rgba(255,150,40," : s.kind === "bolt" ? "rgba(170,140,255," : "rgba(200,255,140,";
        const grd = ctx.createRadialGradient(s.x, s.y, 1, s.x, s.y, big ? 16 : 10);
        grd.addColorStop(0, col + "0.9)"); grd.addColorStop(1, col + "0)");
        ctx.fillStyle = grd; ctx.fillRect(s.x - 16, s.y - 16, 32, 32);
        ctx.fillStyle = s.kind === "mob" ? s.col : "#ffffff"; ctx.beginPath(); ctx.arc(s.x, s.y, big ? 4.5 : 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    for (const f of fx) {
      const al = clamp(f.life / (f.max * 0.5), 0, 1);
      if (f.k === "p") { ctx.globalAlpha = al; ctx.fillStyle = f.c; ctx.fillRect(f.x - 1.5, f.y - 1.5, 3, 3); ctx.globalAlpha = 1; }
      else if (f.k === "txt") { ctx.globalAlpha = al; ctx.font = "bold " + f.s + "px " + FONT; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = "#000"; ctx.fillText(f.t, f.x + 1, f.y + 1); ctx.fillStyle = f.c; ctx.fillText(f.t, f.x, f.y); ctx.globalAlpha = 1; }
      else if (f.k === "ring") {
        const k = 1 - f.life / f.max, c = f.c || "255,210,90";
        ctx.strokeStyle = "rgba(" + c + "," + (1 - k).toFixed(3) + ")"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(f.x, f.y, 10 + k * 50, 4 + k * 20, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "rgba(" + c + "," + (0.3 * (1 - k)).toFixed(3) + ")"; ctx.fillRect(f.x - 12, f.y - 60 * (1 - k * 0.3), 24, 60);
      } else if (f.k === "whirl") {
        const k = 1 - f.life / f.max;
        ctx.strokeStyle = "rgba(255,200,120," + (1 - k).toFixed(3) + ")"; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(f.x, f.y - 4, 30, k * Math.PI * 4, k * Math.PI * 4 + Math.PI * 1.3); ctx.stroke();
        ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y - 4, 40, k * Math.PI * 4 + Math.PI, k * Math.PI * 4 + Math.PI * 2); ctx.stroke();
      } else if (f.k === "nova") {
        const k = 1 - f.life / f.max;
        ctx.strokeStyle = "rgba(170,235,255," + (1 - k).toFixed(3) + ")"; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(f.x, f.y - 4, 10 + k * 76, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "rgba(170,235,255," + (0.18 * (1 - k)).toFixed(3) + ")"; ctx.beginPath(); ctx.arc(f.x, f.y - 4, 10 + k * 76, 0, Math.PI * 2); ctx.fill();
      } else if (f.k === "rain") {
        const k = 1 - f.life / f.max;
        ctx.strokeStyle = "rgba(240,230,200,0.9)"; ctx.lineWidth = 1.5;
        for (let i = 0; i < 12; i++) { const ax = f.x + ((i * 37) % 90) - 45, ay = f.y + ((i * 53) % 90) - 45 - (1 - k) * 60; ctx.beginPath(); ctx.moveTo(ax, ay - 10); ctx.lineTo(ax, ay); ctx.stroke(); }
        ctx.strokeStyle = "rgba(255,224,138," + (0.6 * (1 - k)).toFixed(3) + ")"; ctx.lineWidth = 2; ctx.strokeRect(f.x - 80, f.y - 80, 160, 160);
      } else if (f.k === "slash") {
        const k = 1 - f.life / f.max;
        ctx.strokeStyle = "rgba(255,190,90," + (1 - k).toFixed(3) + ")"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(f.x, f.y, 16 + k * 8, -2.4 + k, -0.6 + k); ctx.stroke();
      }
    }
    for (const g of EXG[a.id]) {
      if (Math.abs(g.x - P.x) > 10 || Math.abs(g.y - P.y) > 8) continue;
      const lx = clamp(g.x * TS + 16, camX + 60, camX + vw - 60), ly = clamp(g.y * TS - 6, camY + 20, camY + vh - 10);
      label(lx, ly, "→ " + AREAS[g.to].name, "#ffe9a8");
    }
    if (guide && P.cls && !pl.dead) {
      let gx = guide.x * TS + 16, gy = guide.y * TS;
      if (guide.o.kind === "mob" && guide.o.m && !guide.o.m.dead && guide.o.area === P.area) { const mp = rpos(guide.o.m); gx = mp[0] + 16; gy = mp[1] - ((guide.o.m.d.sc || 1) - 1) * 30; }
      const bob = Math.sin(time * 5) * 4;
      if (guide.o.kind === "spawn" && !guide.via) { ctx.strokeStyle = "rgba(255,216,74,0.7)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(gx, gy + 16, 22 + Math.sin(time * 3) * 4, 0, Math.PI * 2); ctx.stroke(); }
      arrowTri(gx, gy - 22 + bob, Math.PI / 2, 10, "#ffd84a");
      const dir = guideDir();
      if (dir && guide.dist > 1) {
        const cx = pp[0] + 16 + dir[0] * 30, cy = pp[1] + 18 + dir[1] * 24;
        const pul = 1 + 0.12 * Math.sin(time * 6);
        arrowTri(cx, cy, Math.atan2(dir[1], dir[0]), 9 * pul, "#ffd84a");
        ctx.font = "bold 10px " + FONT; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        const tx = pp[0] + 16 + dir[0] * 48, ty = pp[1] + 18 + dir[1] * 38;
        ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillText(guide.dist + " m", tx + 1, ty + 1); ctx.fillStyle = "#ffe9a8"; ctx.fillText(guide.dist + " m", tx, ty);
      }
    }
    if (info.amb === "fly") {
      for (let i = 0; i < 18; i++) {
        const bx = ((i * 397.3 + time * 9 * ((i % 3) + 1)) % (vw + 40)) + camX - 20, by = ((i * 211.7 + Math.sin(time + i) * 20 + 400) % (vh + 40)) + camY - 20;
        ctx.globalAlpha = 0.45 + 0.4 * Math.sin(time * 3 + i); ctx.fillStyle = "#f8ff9a"; ctx.fillRect(bx, by, 2, 2); ctx.globalAlpha = 1;
      }
    } else if (info.amb === "snow") {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      for (let i = 0; i < 60; i++) {
        const bx = ((i * 173.3 + Math.sin(time * 0.8 + i) * 18 + time * 14) % (vw + 40)) + camX - 20, by = ((i * 97.1 + time * (28 + (i % 5) * 9)) % (vh + 40)) + camY - 20;
        const s2 = i % 3 === 0 ? 3 : 2; ctx.fillRect(bx, by, s2, s2);
      }
    } else if (info.amb === "fog") {
      for (let i = 0; i < 7; i++) {
        const bx = ((i * 311 + time * (6 + i)) % (vw + 320)) + camX - 160, by = camY + ((i * 137) % Math.max(1, vh)) + Math.sin(time * 0.3 + i) * 20;
        ctx.fillStyle = "rgba(200,220,190,0.08)"; ctx.beginPath(); ctx.ellipse(bx, by, 150, 40, 0, 0, Math.PI * 2); ctx.fill();
      }
      for (let i = 0; i < 10; i++) {
        const bx = ((i * 263.3 + time * 7 * ((i % 3) + 1)) % (vw + 40)) + camX - 20, by = ((i * 181.7 + Math.sin(time + i) * 24 + 300) % (vh + 40)) + camY - 20;
        ctx.globalAlpha = 0.4 + 0.4 * Math.sin(time * 2 + i); ctx.fillStyle = "#c8ff9a"; ctx.fillRect(bx, by, 2, 2); ctx.globalAlpha = 1;
      }
    } else if (info.amb === "sand") {
      ctx.fillStyle = "rgba(245,215,160,0.5)";
      for (let i = 0; i < 30; i++) { const bx = ((i * 251 + time * (90 + (i % 4) * 30)) % (vw + 60)) + camX - 30, by = ((i * 131.7 + Math.sin(time + i) * 10) % Math.max(1, vh)) + camY; ctx.fillRect(bx, by, 9, 1); }
    }
    ctx.restore();
    if (info.dark > 0) {
      const cx = (pp[0] + 16 - camX) * S, cy = (pp[1] + 16 - camY) * S;
      const cave = a.dark;
      const grd = ctx.createRadialGradient(cx, cy, (cave ? 50 : 120) * S, cx, cy, (cave ? 230 : 380) * S);
      const base = cave ? "5,3,10" : "10,20,8";
      grd.addColorStop(0, "rgba(" + base + ",0)"); grd.addColorStop(1, "rgba(" + base + "," + info.dark + ")");
      ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
    }
    if (info.amb === "fog") { ctx.fillStyle = "rgba(40,70,30,0.12)"; ctx.fillRect(0, 0, W, H); }
    if (info.amb === "sand") { ctx.fillStyle = "rgba(255,190,110,0.06)"; ctx.fillRect(0, 0, W, H); }
    if (info.amb === "snow") { ctx.fillStyle = "rgba(200,220,255,0.06)"; ctx.fillRect(0, 0, W, H); }
    if (!P.cls) { drawSelect(); return; }
    drawHud();
    if (trans) { const al = trans.t < 0.25 ? trans.t / 0.25 : 1 - (trans.t - 0.25) / 0.35; ctx.fillStyle = "rgba(0,0,0," + clamp(al, 0, 1).toFixed(3) + ")"; ctx.fillRect(0, 0, W, H); }
    if (pl.dead > 0) { ctx.fillStyle = "rgba(60,0,0," + clamp(1 - pl.dead / 2.2 + 0.3, 0, 0.8).toFixed(3) + ")"; ctx.fillRect(0, 0, W, H); text("Poległeś...", W / 2, H / 2, 28, "#ffd0c8", "center", true); }
  }
