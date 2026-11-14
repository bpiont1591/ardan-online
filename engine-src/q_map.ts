  function drawMap(): void {
    modalBack();
    const [x, y, w, h] = panelRect(920, 700);
    box(x, y, w, h); ui.push({ x, y, w, h, fn: () => {} });
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
      if (a.mini) ctx.drawImage(a.mini, ox, oy, a.w * k, a.h * k);
      ctx.strokeStyle = "rgba(201,164,92,0.6)"; ctx.lineWidth = 1; ctx.strokeRect(ox, oy, a.w * k, a.h * k);
      const tp = (tx: number, ty: number): number[] => [ox + (tx + 0.5) * k, oy + (ty + 0.5) * k];
      if (guide && guide.path && guide.path.length) {
        ctx.strokeStyle = "rgba(255,216,74,0.9)"; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.lineDashOffset = -time * 12;
        ctx.beginPath(); const p0 = tp(P.x, P.y); ctx.moveTo(p0[0], p0[1]);
        for (const nd of guide.path) { const p = tp(nd[0], nd[1]); ctx.lineTo(p[0], p[1]); }
        ctx.stroke(); ctx.setLineDash([]);
      }
      for (const m of mobs[P.area]) if (!m.dead && !m.d.boss) { const p = tp(m.x, m.y); ctx.fillStyle = "#ff4a3a"; ctx.beginPath(); ctx.arc(p[0], p[1], Math.max(2, k * 0.3), 0, 7); ctx.fill(); }
      const labels: number[][] = [];
      const lab = (lx: number, ly: number, t: string, col: string, fs2: number): void => {
        ctx.font = "bold " + fs2 + "px " + FONT; const tw = ctx.measureText(t).width;
        let bx = clamp(lx - tw / 2 - 4, ix, ix + iw - tw - 8), by = clamp(ly - 16, iy, iy + ih - 14);
        for (let i = 0; i < 4; i++) if (labels.some((r2: number[]) => bx < r2[0] + r2[2] && bx + tw + 8 > r2[0] && by < r2[1] + 14 && by + 14 > r2[1])) by += 15;
        labels.push([bx, by, tw + 8]);
        ctx.fillStyle = "rgba(0,0,0,0.72)"; rr(bx, by, tw + 8, 14, 3); ctx.fill();
        text(t, bx + 4, by + 7.5, fs2, col, "left", true);
      };
      for (const m of mobs[P.area]) if (m.d.boss) {
        const p = tp(m.dead ? m.hx : m.x, m.dead ? m.hy : m.y);
        ctx.fillStyle = m.dead ? "rgba(197,140,255,0.4)" : "#c58cff"; ctx.beginPath(); ctx.arc(p[0], p[1], 6, 0, 7); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke();
        lab(p[0], p[1] - 4, "☠ " + m.d.n + " (" + m.d.lvl + ")" + (m.dead ? " – pokonany" : ""), "#e0c8ff", 10);
      }
      for (const g of EXG[a.id]) {
        const p = tp(g.x, g.y);
        ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(Math.PI / 4); ctx.fillStyle = "#fff"; ctx.fillRect(-5, -5, 10, 10); ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5; ctx.strokeRect(-5, -5, 10, 10); ctx.restore();
        lab(p[0], p[1] - 4, "→ " + AREAS[g.to].name, "#ffffff", 11);
      }
      for (const id of Object.keys(NPCS)) {
        const n = NPCS[id]; if (n.area !== P.area) continue;
        const p = tp(n.x, n.y), mk = npcMark(id);
        ctx.fillStyle = "#ffd84a"; ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, 7); ctx.fill(); ctx.strokeStyle = "#000"; ctx.lineWidth = 1; ctx.stroke();
        lab(p[0], p[1] - 4, (mk === "!" || mk === "?" ? mk + " " : "") + n.n, mk === "!" || mk === "?" ? "#ffd84a" : "#bfe3ff", 10);
      }
      if (guide) {
        const p = tp(guide.x, guide.y), pul = 6 + Math.sin(time * 6) * 2;
        ctx.strokeStyle = "#ffd84a"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(p[0], p[1], pul, 0, 7); ctx.stroke();
        ctx.fillStyle = "#ffd84a"; ctx.beginPath(); ctx.arc(p[0], p[1], 2.5, 0, 7); ctx.fill();
      }
      const pq = tp(P.x, P.y);
      ctx.fillStyle = "rgba(79,176,255,0.3)"; ctx.beginPath(); ctx.arc(pq[0], pq[1], 9 + Math.sin(time * 5) * 2, 0, 7); ctx.fill();
      arrowTri(pq[0], pq[1], [Math.PI / 2, Math.PI, 0, -Math.PI / 2][pl.dir], 7, "#4fb0ff");
      const items: [string, string][] = [["#4fb0ff", "Ty"], ["#ffd84a", "Postać (! / ?)"], ["#ff4a3a", "Potwór"], ["#c58cff", "Boss"], ["#ffffff", "Przejście"], ["#ffd84a", "◎ Cel zadania"]];
      let lx = x + 14, lyy = y + h - legH + 4;
      for (const it of items) {
        ctx.font = "11px " + FONT; const tw = ctx.measureText(it[1]).width;
        if (lx + tw + 24 > x + w - 10) { lx = x + 14; lyy += 18; }
        ctx.fillStyle = it[0]; ctx.beginPath(); ctx.arc(lx + 5, lyy + 6, 4, 0, 7); ctx.fill();
        text(it[1], lx + 13, lyy + 6.5, 11, COL.text); lx += tw + 28;
      }
    } else {
      const cw = iw / 4, ch = ih / 3;
      const nb2 = (id: string): number[] => [ix + (AINFO[id].gx + 0.5) * cw, iy + (AINFO[id].gy + 0.5) * ch];
      const done: { [k: string]: boolean } = {};
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(201,164,92,0.45)";
      for (const a1 of Object.keys(GRAPH)) for (const a2 of Object.keys(GRAPH[a1])) {
        const key = [a1, a2].sort().join("-"); if (done[key]) continue; done[key] = true;
        const p1 = nb2(a1), p2 = nb2(a2); ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
      }
      if (guide && guide.o.area !== P.area) {
        const rt = routeList(P.area, guide.o.area);
        ctx.strokeStyle = "#ffd84a"; ctx.lineWidth = 4; ctx.setLineDash([8, 6]); ctx.lineDashOffset = -time * 20;
        ctx.beginPath(); rt.forEach((id: string, i: number) => { const p = nb2(id); if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); }); ctx.stroke(); ctx.setLineDash([]);
      }
      const bw2 = Math.min(cw - 10, 190), bh2 = Math.min(ch - 14, 70);
      for (const id of Object.keys(AREAS)) {
        const p = nb2(id), seen = !!P.seen[id], cur = id === P.area, goal = guide && guide.o.area === id;
        const bx = p[0] - bw2 / 2, by = p[1] - bh2 / 2;
        rr(bx, by, bw2, bh2, 8); ctx.fillStyle = seen ? MINI[AREAS[id].base] || "#444" : "#2a2630"; ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1;
        ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fill();
        ctx.strokeStyle = cur ? "#4fb0ff" : goal ? "#ffd84a" : COL.bd; ctx.lineWidth = cur || goal ? 2.5 : 1; ctx.stroke();
        const fs3 = bw2 < 110 ? 10 : 12;
        text(fitText(seen ? AREAS[id].name : "??? (nieodkryta)", bw2 - 10, fs3, true), p[0], by + 14, fs3, seen ? COL.title : COL.mute, "center", true);
        text(fitText(AINFO[id].lv, bw2 - 8, 9), p[0], by + 29, 9, COL.text, "center");
        const qn = activeQuests().filter((q: string) => QUESTS[q].area === id).length;
        if (cur) text("● Tu jesteś", p[0], by + bh2 - 11, 10, "#4fb0ff", "center", true);
        else if (goal) text("★ Cel zadania", p[0], by + bh2 - 11, 10, "#ffd84a", "center", true);
        else if (qn) text("Zadania: " + qn, p[0], by + bh2 - 11, 10, "#9fd3ff", "center", true);
      }
      text("Złota linia: droga do celu śledzonego zadania.", x + 14, y + h - legH + 10, 11, COL.mute);
    }
  }
  function drawCard(c: string, x: number, y: number, w: number, h: number, row: boolean): void {
    const cl = CLS[c], sel = selCls === c;
    rr(x, y, w, h, 10); ctx.fillStyle = sel ? "rgba(90,70,40,0.92)" : COL.bg; ctx.fill();
    ctx.strokeStyle = sel ? "#ffd25a" : COL.bd; ctx.lineWidth = sel ? 2.5 : 1.2; ctx.stroke();
    ui.push({ x, y, w, h, fn: () => { selCls = c; } });
    const ps = row ? Math.min(2.3, (h - 16) / 36) : Math.min(3, (w - 40) / 40, (h * 0.32) / 34);
    const sx = row ? x + 12 : x + w / 2 - 16 * ps, sy = row ? y + h / 2 - 17 * ps : y + 18 + 12 * ps * 0.5;
    ctx.save(); ctx.translate(sx, sy + 10 * ps * 0.3); ctx.scale(ps, ps);
    drawHuman(0, 0, 0, sel ? time * 8 : 0, cl.look, ITEMS[GEAR[c].w[sel ? 3 : 1]].c, null, false, 0, cl.wk);
    ctx.restore();
    const tx = row ? x + 22 + 32 * ps : x + 14;
    let ty = row ? y + 16 : sy + 38 * ps + 10;
    const tw = row ? x + w - tx - 10 : w - 28;
    text(cl.n, tx, ty, 16, sel ? "#ffe9a8" : COL.title, "left", true);
    text("klawisz " + (CLSORDER.indexOf(c) + 1), tx + tw, ty, 9, COL.mute, "right");
    ty += 17;
    const dl = wrap(cl.desc, tw, 11);
    for (const l of dl.slice(0, row ? 2 : 3)) { text(l, tx, ty, 11, COL.text); ty += 14; }
    ty += 2;
    const sn = ["Życie", "Atak", "Obrona", "Zasięg"];
    for (let i = 0; i < 4; i++) {
      const colW = row ? tw / 2 : tw;
      const cx2 = tx + (row ? (i % 2) * colW : 0), cy2 = row ? ty + Math.floor(i / 2) * 14 : ty + i * 15;
      text(sn[i], cx2, cy2, 10, COL.mute);
      for (let j = 0; j < 5; j++) { ctx.fillStyle = j < cl.st[i] ? "#ffd25a" : "rgba(255,255,255,0.15)"; ctx.fillRect(cx2 + 46 + j * 9, cy2 - 3, 7, 7); }
    }
    ty += row ? 30 : 64;
    if (row) {
      const sl = wrap("Umiejętności: " + SK[c].map((s: any) => s.n).join(", "), tw, 10);
      for (const l of sl.slice(0, 2)) { if (ty > y + h - 6) break; text(l, tx, ty, 10, "#bfe3ff"); ty += 13; }
    } else {
      text("Umiejętności:", tx, ty, 11, COL.title, "left", true); ty += 15;
      for (const s of SK[c]) {
        if (ty > y + h - 14) break;
        text(fitText(s.n + (s.lvl > 1 ? " (poz. " + s.lvl + ")" : ""), tw, 11, true), tx, ty, 11, "#bfe3ff", "left", true); ty += 13;
        const l2 = wrap(s.d, tw, 10); for (const l of l2.slice(0, 2)) { if (ty > y + h - 10) break; text(l, tx, ty, 10, COL.mute); ty += 12; }
        ty += 3;
      }
    }
  }
  function drawSelect(): void {
    ctx.fillStyle = "rgba(10,8,14,0.84)"; ctx.fillRect(0, 0, W, H);
    ui.push({ x: 0, y: 0, w: W, h: H, fn: () => {} });
    const narrow = W < 640;
    const tfs = Math.min(30, W / 13);
    text("Ardan: Kroniki Mgieł", W / 2, 30, tfs, COL.title, "center", true);
    text("Wybierz klasę postaci", W / 2, 30 + tfs * 0.5 + 14, 13, COL.text, "center", true);
    let top = 30 + tfs * 0.5 + 30;
    if (migrated) {
      const ml = wrap("Znaleziono zapis z poprzedniej wersji (poziom " + P.lvl + "). Poziom, złoto, przedmioty i zadania zostaną zachowane – wybierz tylko klasę.", W - 40, 11);
      for (const l of ml) { text(l, W / 2, top, 11, "#9fd3ff", "center"); top += 14; }
      top += 6;
    }
    const btnH = 44, avail = H - top - btnH - 26;
    if (!narrow) {
      const cw = Math.min(280, (W - 56) / 3), ch = Math.min(avail, 400);
      const x0 = (W - (cw * 3 + 32)) / 2;
      CLSORDER.forEach((c: string, i: number) => drawCard(c, x0 + i * (cw + 16), top, cw, ch, false));
    } else {
      const ch = Math.min(176, (avail - 16) / 3), cw = Math.min(W - 24, 520);
      CLSORDER.forEach((c: string, i: number) => drawCard(c, (W - cw) / 2, top + i * (ch + 8), cw, ch, true));
    }
    const bw = Math.min(W - 40, 340);
    button((W - bw) / 2, H - btnH - 16, bw, btnH, "Rozpocznij jako: " + CLS[selCls].n + " ▸", () => pickClass(selCls), { fs: 15, col: "#7a5a2a" });
  }
