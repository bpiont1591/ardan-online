  function fitText(t: string, maxW: number, size: number, bold?: boolean): string {
    ctx.font = (bold ? "bold " : "") + size + "px " + FONT;
    if (ctx.measureText(t).width <= maxW) return t;
    let s = t; while (s.length > 1 && ctx.measureText(s + "…").width > maxW) s = s.slice(0, -1);
    return s + "…";
  }
  function circleBtn(cx: number, cy: number, r: number, kind: string, fn: () => void, hint: string, badge?: string): void {
    const g = ctx;
    const ski = kind.charAt(0) === "s" && kind.length === 3 ? Number(kind.charAt(2)) : -1;
    const sk = ski >= 0 ? SK[P.cls][ski] : null;
    const locked = !!sk && P.lvl < sk.lvl, noMp = !!sk && P.mp < sk.cost;
    g.globalAlpha = 0.92;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fillStyle = kind === "atk" ? "rgba(140,40,34,0.85)" : sk ? "rgba(46,36,66,0.88)" : "rgba(24,19,30,0.8)"; g.fill();
    g.strokeStyle = sk && !locked && pl.skcd[ski] <= 0 && !noMp ? "#ffd25a" : COL.bd; g.lineWidth = 1.5; g.stroke(); g.globalAlpha = 1;
    if (kind === "atk") {
      if (pl.cd > 0) { g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r - 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(pl.cd / C().cd, 0, 1)); g.closePath(); g.fillStyle = "rgba(0,0,0,0.35)"; g.fill(); }
      drawIcon(P.eq.w || GEAR[P.cls || "war"].w[0], cx - r * 0.55, cy - r * 0.55, r * 1.1);
    } else if (kind === "pot") drawIcon("pot", cx - r * 0.6, cy - r * 0.62, r * 1.2);
    else if (kind === "mpot") drawIcon("mpot", cx - r * 0.6, cy - r * 0.62, r * 1.2);
    else if (kind === "bag") {
      g.fillStyle = "#a0723c"; g.beginPath(); g.ellipse(cx, cy + 3, r * 0.5, r * 0.45, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = "#7a5228"; g.fillRect(cx - r * 0.25, cy - r * 0.45, r * 0.5, r * 0.25);
    } else if (kind === "quest") {
      g.fillStyle = "#efe0b8"; g.fillRect(cx - r * 0.4, cy - r * 0.45, r * 0.8, r * 0.9); g.fillStyle = "#8a6238"; for (let i = 0; i < 3; i++) g.fillRect(cx - r * 0.28, cy - r * 0.25 + i * r * 0.25, r * 0.56, 2);
      if (QORDER.some((q: string) => qReady(q))) { g.fillStyle = "#ffd84a"; g.beginPath(); g.arc(cx + r * 0.6, cy - r * 0.6, 5, 0, 7); g.fill(); }
    } else if (kind === "map") {
      g.fillStyle = "#d8c89a"; g.beginPath(); g.moveTo(cx - r * 0.55, cy - r * 0.4); g.lineTo(cx - r * 0.18, cy - r * 0.52); g.lineTo(cx + r * 0.18, cy - r * 0.4); g.lineTo(cx + r * 0.55, cy - r * 0.52); g.lineTo(cx + r * 0.55, cy + r * 0.45); g.lineTo(cx + r * 0.18, cy + r * 0.57); g.lineTo(cx - r * 0.18, cy + r * 0.45); g.lineTo(cx - r * 0.55, cy + r * 0.57); g.closePath(); g.fill();
      g.strokeStyle = "#8a6238"; g.lineWidth = 1; g.beginPath(); g.moveTo(cx - r * 0.18, cy - r * 0.52); g.lineTo(cx - r * 0.18, cy + r * 0.45); g.moveTo(cx + r * 0.18, cy - r * 0.4); g.lineTo(cx + r * 0.18, cy + r * 0.57); g.stroke();
      g.fillStyle = "#c0392b"; g.beginPath(); g.arc(cx + r * 0.05, cy, 2.5, 0, 7); g.fill();
    } else if (sk) {
      drawSkillIcon(sk.ic, cx, cy, r * 0.72);
      const cdv = pl.skcd[ski];
      if (locked || noMp || cdv > 0) { g.beginPath(); g.arc(cx, cy, r - 1.5, 0, Math.PI * 2); g.fillStyle = locked ? "rgba(0,0,0,0.62)" : noMp ? "rgba(20,30,80,0.5)" : "rgba(0,0,0,0.25)"; g.fill(); }
      if (cdv > 0 && !locked) {
        g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r - 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (cdv / sk.cd)); g.closePath(); g.fillStyle = "rgba(0,0,0,0.45)"; g.fill();
        text(String(Math.ceil(cdv)), cx, cy + 1, 13, "#fff", "center", true);
      }
      if (locked) text("poz. " + sk.lvl, cx, cy + 1, 10, "#ddd", "center", true);
    }
    if (badge) { g.fillStyle = "#000"; g.beginPath(); g.arc(cx + r * 0.65, cy + r * 0.6, 8, 0, 7); g.fill(); text(badge, cx + r * 0.65, cy + r * 0.62, 10, "#fff", "center", true); }
    if (hint) text(hint, cx, cy + r + 8, 9, "rgba(255,255,255,0.85)", "center", true);
    ui.push({ x: cx - r, y: cy - r, w: r * 2, h: r * 2, fn, k: kind } as any);
  }
  function drawTracker(x: number, y: number, w: number): void {
    if (!guide) return;
    const h = 46;
    box(x, y, w, h);
    const q = guide.o.q ? QUESTS[guide.o.q] : null;
    const dir = guideDir();
    ctx.beginPath(); ctx.arc(x + 22, y + 23, 15, 0, Math.PI * 2); ctx.fillStyle = "rgba(255,216,74,0.14)"; ctx.fill(); ctx.strokeStyle = "rgba(255,216,74,0.7)"; ctx.lineWidth = 1; ctx.stroke();
    if (dir) arrowTri(x + 22, y + 23, Math.atan2(dir[1], dir[0]), 10, "#ffd84a");
    else { ctx.fillStyle = "#ffd84a"; ctx.beginPath(); ctx.arc(x + 22, y + 23, 4, 0, 7); ctx.fill(); }
    const t1 = q ? q.n + (q.need > 1 && !qReady(guide.o.q) ? "  " + qProg(guide.o.q) + "/" + q.need : "") : "Wskazówka";
    const dist = guide.dist + " m";
    ctx.font = "bold 11px " + FONT; const dw = ctx.measureText(dist).width;
    text(fitText(t1, w - 54 - dw - 8, 11, true), x + 44, y + 14, 11, COL.title, "left", true);
    text(dist, x + w - 8, y + 14, 11, "#ffe9a8", "right", true);
    const t2 = guide.via ? "Idź do: " + AREAS[guide.via].name + (guide.o.area !== guide.via ? " → " + AREAS[guide.o.area].name : "") : guide.o.t;
    text(fitText(t2, w - 54, 10), x + 44, y + 29, 10, COL.text);
    text(touchMode ? "dotknij: dziennik ▸" : "T – zmień · Q – dziennik", x + w - 8, y + 40, 9, COL.mute, "right");
    ui.push({ x, y, w, h, fn: () => { panel = "quest"; } });
  }
  function drawMinimap(): number[] {
    const a = A();
    const small = W < 520;
    const mmW = Math.round(small ? Math.min(150, W * 0.38) : Math.min(230, W * 0.22)), mmH = Math.round(mmW * 0.78);
    const mx = W - mmW - 10, my = 10;
    box(mx - 4, my - 4, mmW + 8, mmH + 28);
    const zi = clamp(Math.floor(P.mmz || 0), 0, 2);
    let vwT = 0, vhT = 0;
    if (zi === 0) { const k0 = Math.min(mmW / a.w, mmH / a.h); vwT = mmW / k0; vhT = mmH / k0; } else { vwT = zi === 1 ? 32 : 20; vhT = vwT * mmH / mmW; }
    const k = mmW / vwT;
    let ox = (a.w - vwT) / 2, oy = (a.h - vhT) / 2;
    if (zi > 0) {
      const pr = rpos(pl2());
      ox = pr[0] / TS + 0.5 - vwT / 2; oy = pr[1] / TS + 0.5 - vhT / 2;
      ox = a.w > vwT ? clamp(ox, 0, a.w - vwT) : (a.w - vwT) / 2; oy = a.h > vhT ? clamp(oy, 0, a.h - vhT) : (a.h - vhT) / 2;
    }
    const tp = (tx: number, ty: number): number[] => [mx + (tx + 0.5 - ox) * k, my + (ty + 0.5 - oy) * k];
    ctx.save(); rr(mx, my, mmW, mmH, 5); ctx.clip();
    ctx.fillStyle = "#0c0a10"; ctx.fillRect(mx, my, mmW, mmH);
    ctx.imageSmoothingEnabled = false;
    if (a.mini) ctx.drawImage(a.mini, 0, 0, a.w * 3, a.h * 3, mx - ox * k, my - oy * k, a.w * k, a.h * k);
    if (a.dark) { ctx.fillStyle = "rgba(0,0,0,0.15)"; ctx.fillRect(mx, my, mmW, mmH); }
    for (const g of EXG[a.id]) { const p = tp(g.x, g.y); ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(Math.PI / 4); ctx.fillStyle = "#ffffff"; ctx.fillRect(-3.5, -3.5, 7, 7); ctx.strokeStyle = "#000"; ctx.lineWidth = 1; ctx.strokeRect(-3.5, -3.5, 7, 7); ctx.restore(); }
    for (const m of mobs[P.area]) if (!m.dead) {
      const p = tp(m.x, m.y);
      if (m.d.boss) { ctx.fillStyle = "#c58cff"; ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, 7); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.stroke(); }
      else { ctx.fillStyle = "#ff4a3a"; ctx.beginPath(); ctx.arc(p[0], p[1], Math.max(1.6, k * 0.32), 0, 7); ctx.fill(); }
    }
    for (const id of Object.keys(NPCS)) {
      const n = NPCS[id]; if (n.area !== P.area) continue;
      const p = tp(n.x, n.y);
      ctx.fillStyle = "#ffd84a"; ctx.beginPath(); ctx.arc(p[0], p[1], 2.8, 0, 7); ctx.fill(); ctx.strokeStyle = "#000"; ctx.lineWidth = 1; ctx.stroke();
      const mk = npcMark(id);
      if (mk === "!" || mk === "?") { ctx.font = "bold 11px " + FONT; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = "#000"; ctx.fillText(mk, p[0] + 1, p[1] - 3); ctx.fillStyle = "#ffd84a"; ctx.fillText(mk, p[0], p[1] - 4); }
    }
    if (guide) {
      const p = tp(guide.x, guide.y), pul = 3 + Math.sin(time * 6) * 1.2;
      const inside = p[0] > mx + 4 && p[0] < mx + mmW - 4 && p[1] > my + 4 && p[1] < my + mmH - 4;
      if (inside) { ctx.strokeStyle = "#ffd84a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p[0], p[1], pul + 2, 0, 7); ctx.stroke(); ctx.fillStyle = "#ffd84a"; ctx.beginPath(); ctx.arc(p[0], p[1], 2, 0, 7); ctx.fill(); }
      else { const pp = tp(P.x, P.y); const an = Math.atan2(p[1] - pp[1], p[0] - pp[0]); const ex = clamp(p[0], mx + 8, mx + mmW - 8), ey = clamp(p[1], my + 8, my + mmH - 8); arrowTri(ex, ey, an, 6, "#ffd84a"); }
    }
    const pp2 = rpos(pl2()); const pq = tp(pp2[0] / TS, pp2[1] / TS);
    arrowTri(pq[0], pq[1], [Math.PI / 2, Math.PI, 0, -Math.PI / 2][pl.dir], 5.5, "#4fb0ff");
    ctx.restore();
    ctx.strokeStyle = "rgba(201,164,92,0.6)"; ctx.lineWidth = 1; rr(mx, my, mmW, mmH, 5); ctx.stroke();
    text(fitText(a.name, mmW - 50, 10, true), mx + mmW / 2, my + mmH + 12, 10, COL.title, "center", true);
    button(mx - 2, my + mmH + 3, 20, 18, "−", () => { P.mmz = Math.max(0, (P.mmz || 0) - 1); }, { fs: 12 });
    button(mx + mmW - 18, my + mmH + 3, 20, 18, "+", () => { P.mmz = Math.min(2, (P.mmz || 0) + 1); }, { fs: 12 });
    ui.push({ x: mx, y: my, w: mmW, h: mmH, fn: () => { panel = "map"; mapTab = "area"; } });
    return [mx, my + mmH + 26, mmW];
  }
  function drawHud(): void {
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
    ctx.fillStyle = "#f2c94c"; ctx.beginPath(); ctx.arc(23, 76, 4, 0, Math.PI * 2); ctx.fill();
    text(P.gold + " zł", 31, 76.5, 11, COL.text, "left", true);
    text("Atak " + atk() + "  Obr. " + def() + (pl.buffDef > 0 ? "↑" : ""), 8 + bw - 10, 76.5, 10, pl.buffDef > 0 ? "#ffb347" : COL.mute, "right");
    let yy = 94;
    if (guide && !panel) { drawTracker(8, yy, bw); yy += 52; }
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
    circleBtn(W - 10 - ur * 5 - 16, uy, ur, "bag", () => { panel = panel === "inv" ? "" : "inv"; invSel = -1; }, hintOn ? "I" : "");
    if (banner > 0) {
      ctx.globalAlpha = clamp(banner, 0, 1);
      const fs = Math.min(30, W / 14);
      text(a.name, W / 2 + 1, H * 0.3 + 1, fs, "#000", "center", true);
      text(a.name, W / 2, H * 0.3, fs, COL.title, "center", true);
      text(AINFO[a.id].lv, W / 2, H * 0.3 + 26, 12, COL.text, "center", true);
      ctx.globalAlpha = 1;
    }
    for (const f of fx) if (f.k === "big") {
      const al = clamp(f.life / 0.6, 0, 1), sc = 1 + (1 - f.life / f.max) * 0.15, fs = Math.min(34, W / 12) * sc;
      ctx.globalAlpha = al; text(f.t, W / 2 + 2, H * 0.42 + 2, fs, "#000", "center", true); text(f.t, W / 2, H * 0.42, fs, "#ffd25a", "center", true); ctx.globalAlpha = 1;
    }
    const ab = small ? 31 : 34, sr = small ? 21 : 24;
    const axc = W - 14 - ab, ayc = H - 18 - ab;
    const R0 = ab + sr + 16;
    circleBtn(axc, ayc, ab, "atk", () => act({ a: "atk" }), hintOn ? "Spacja" : "");
    const angs = [Math.PI, Math.PI * 1.25, Math.PI * 1.5];
    for (let i = 0; i < 3; i++) circleBtn(axc + Math.cos(angs[i]) * R0, ayc + Math.sin(angs[i]) * R0, sr, "sk" + i, () => act({ a: "sk", i }), hintOn ? String(i + 1) : "");
    const pr = small ? 18 : 20;
    const potX = axc - R0 - sr - pr - 8;
    circleBtn(potX, ayc + 8, pr, "pot", () => act({ a: "pot" }), hintOn ? "H" : "", String(countItem("pot") + countItem("bigpot") + countItem("elix")));
    if (P.cls === "mag" || countItem("mpot") > 0) circleBtn(potX + 6, ayc - pr * 2 - 14, pr, "mpot", () => act({ a: "mpot" }), hintOn ? "G" : "", String(countItem("mpot")));
    let logBottom = H - 12;
    if (touchMode) {
      // arrow d-pad (always visible on touch devices); hold to walk, two arrows = diagonal
      const sz = small ? 50 : 54, cx = 16 + sz * 1.5, cy = H - 16 - sz * 1.5;
      pad.cx = cx; pad.cy = cy; pad.s = sz;
      const pd = padDir();
      const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      ctx.beginPath(); ctx.arc(cx, cy, sz * 0.42, 0, Math.PI * 2); ctx.fillStyle = "rgba(24,19,30,0.35)"; ctx.fill();
      for (const d of dirs) {
        const x = cx + d[0] * sz - sz / 2, y = cy + d[1] * sz - sz / 2;
        const on = !!pd && ((d[0] !== 0 && pd[0] === d[0]) || (d[1] !== 0 && pd[1] === d[1]));
        rr(x + 2, y + 2, sz - 4, sz - 4, 10); ctx.fillStyle = on ? "rgba(201,164,92,0.85)" : "rgba(24,19,30,0.62)"; ctx.fill();
        ctx.strokeStyle = on ? "#f5e0a8" : COL.bd; ctx.lineWidth = on ? 2 : 1; ctx.stroke();
        const ax = x + sz / 2, ay = y + sz / 2, an = Math.atan2(d[1], d[0]);
        ctx.save(); ctx.translate(ax, ay); ctx.rotate(an); ctx.fillStyle = on ? "#2a1f12" : COL.text;
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -10); ctx.lineTo(-6, 10); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      ui.push({ x: cx - sz * 1.5, y: cy - sz * 1.5, w: sz * 3, h: sz * 3, fn: () => {}, pad: true });
      logBottom = cy - sz * 1.5 - 10;
    }
    const lw = Math.min(W * (touchMode ? 0.62 : 0.45), 380);
    let ly = logBottom;
    for (let i = msgs.length - 1; i >= 0 && i >= msgs.length - (small ? 4 : 5); i--) {
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
    if (panel === "map") drawMap();
    if (dlg) drawDialog();
    if (hover && hover.t && !panel && !dlg && !touchMode) {
      ctx.font = "11px " + FONT; const tw = ctx.measureText(hover.t).width;
      const hx = clamp(hover.sx + 12, 4, W - tw - 16);
      ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(hx, hover.sy + 10, tw + 10, 18); text(hover.t, hx + 5, hover.sy + 19, 11, "#fff");
    }
  }
