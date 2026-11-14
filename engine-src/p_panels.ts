  function itemDesc(id: string): string {
    const it = ITEMS[id];
    const who = it.cls ? " · " + it.cls.split(" ").map((c: string) => CLS[c].n).join("/") : "";
    if (it.t === "w") return "Atak +" + it.atk + who;
    if (it.t === "a") return "Obrona +" + it.def + ", HP +" + it.def * 2 + (it.mp ? ", mana +" + it.mp : "") + who;
    if (it.t === "p") return "Leczy " + it.heal + " HP";
    if (it.t === "m") return "Przywraca " + it.mana + " " + (P.cls === "mag" ? "many" : "energii");
    if (it.t === "q") return "Przedmiot do zadania";
    return "Łup na sprzedaż";
  }
  function shopList(id: string): string[] {
    const out: string[] = [];
    for (const s of SHOPS[id]) { const r = resolve(s); if (out.indexOf(r) < 0) out.push(r); }
    return out;
  }
  function drawInv(): void {
    modalBack();
    const [x, y, w, h] = panelRect(460, 500);
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
      rr(cx, cy, gs, gs, 6); ctx.fillStyle = invSel === i ? "rgba(201,164,92,0.35)" : "rgba(255,255,255,0.06)"; ctx.fill(); ctx.strokeStyle = "rgba(201,164,92,0.5)"; ctx.lineWidth = 1; ctx.stroke();
      const s = P.inv[i];
      if (s) {
        drawIcon(s.id, cx + 3, cy + 3, gs - 6);
        if (!canUse(s.id)) { ctx.fillStyle = "rgba(160,30,30,0.35)"; ctx.fillRect(cx + 1, cy + 1, gs - 2, gs - 2); }
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
      text(fitText(itemDesc(selId) + " · wartość " + Math.max(1, Math.floor(it.price / 2)) + " zł", w - 28, 11), x + 14, dy + 28, 11, canUse(selId) ? COL.text : COL.bad);
      const by = Math.min(dy + 42, y + h - 40);
      if (invSel >= 0) {
        if (it.t === "w" || it.t === "a") button(x + 14, by, 110, 30, canUse(selId) ? "Załóż" : "Nie dla klasy", () => equip(invSel), { dis: !canUse(selId) });
        if (it.t === "p" || it.t === "m") button(x + 14, by, 110, 30, "Użyj", () => { useItem(selId); if (!P.inv[invSel] || P.inv[invSel].id !== selId) invSel = -1; });
      } else button(x + 14, by, 110, 30, "Zdejmij", () => unequip(invSel === -2 ? "w" : "a"));
    } else text("Wybierz przedmiot, aby go użyć lub założyć.", x + 14, dy + 14, 11, COL.mute);
  }
  function drawQuests(): void {
    modalBack();
    const [x, y, w, h] = panelRect(520, 600);
    box(x, y, w, h); ui.push({ x, y, w, h, fn: () => {} });
    text("Dziennik zadań", x + 14, y + 19, 15, COL.title, "left", true); closeBtn(x + w, y, () => { panel = ""; });
    let yy = y + 44;
    const act = activeQuests();
    if (!act.length) { for (const l of wrap("Nie masz aktywnych zadań. Szukaj postaci z żółtym wykrzyknikiem – złota strzałka cię do nich zaprowadzi.", w - 28, 12)) { text(l, x + 14, yy + 6, 12, COL.text); yy += 17; } yy += 6; }
    else { text("Wybierz zadanie, które ma wskazywać strzałka:", x + 14, yy + 4, 10, COL.mute); yy += 16; }
    const bwT = w < 380 ? 78 : 92;
    let shown = 0;
    for (const id of act) {
      const q = QUESTS[id], tr = P.track === id, ready = qReady(id);
      const lines = wrap(q.desc + " Zleca: " + NPCS[q.giver].n + ".", w - 40 - bwT, 11);
      const rh = 26 + lines.length * 14 + 12;
      if (yy + rh > y + h - 110) { text("… i " + (act.length - shown) + " więcej", x + 14, yy + 6, 11, COL.mute); yy += 18; break; }
      const fnT = (): void => { P.track = id; guideT = 0; };
      rr(x + 10, yy, w - 20, rh, 6); ctx.fillStyle = tr ? "rgba(255,216,74,0.13)" : "rgba(255,255,255,0.04)"; ctx.fill();
      if (tr) { ctx.strokeStyle = "#ffd84a"; ctx.lineWidth = 1.5; ctx.stroke(); }
      ui.push({ x: x + 10, y: yy, w: w - 20, h: rh, fn: fnT });
      text(fitText(q.n, w - 60 - bwT - 70, 13, true), x + 20, yy + 13, 13, COL.title, "left", true);
      const st2 = ready ? (q.talkq ? "Zanieś list" : "Wróć po nagrodę") : qProg(id) + "/" + q.need;
      text(st2, x + w - 28 - bwT, yy + 13, 11, ready ? COL.good : COL.text, "right", true);
      let ly = yy + 28;
      for (const l of lines) { text(l, x + 20, ly, 11, COL.text); ly += 14; }
      bar(x + 20, ly - 2, w - 48 - bwT, 5, qProg(id) / q.need, ready ? "#7dd36a" : "#5aa8ff", "rgba(255,255,255,0.1)");
      button(x + w - 18 - bwT, yy + 6, bwT, 26, tr ? "Śledzone ✓" : "Śledź", fnT, { fs: 11, col: tr ? "#6a5430" : undefined });
      yy += rh + 6; shown++;
    }
    const av = QORDER.filter((q: string) => qAvail(q));
    if (av.length && yy < y + h - 100) {
      text("Nowe zadania do podjęcia:", x + 14, yy + 6, 11, COL.title, "left", true); yy += 18;
      for (const id of av) { if (yy > y + h - 80) break; const n = NPCS[QUESTS[id].giver]; text(fitText("! " + n.n + " (" + AREAS[n.area].name + ")", w - 28, 11), x + 18, yy + 4, 11, "#ffd84a"); yy += 15; }
    }
    const nextL = QORDER.filter((q: string) => qLocked(q));
    if (nextL.length && yy < y + h - 70) { const q = QUESTS[nextL[0]]; text(fitText("Od poz. " + q.lvl + ": " + q.n + " (" + NPCS[q.giver].n + ")", w - 28, 10), x + 18, yy + 6, 10, COL.mute); }
    const doneN = QORDER.filter((q: string) => P.q[q] && P.q[q].s === "done").length;
    text("Ukończone " + doneN + "/" + QORDER.length + " · Pokonani: " + P.kills, x + 14, y + h - 24, 11, COL.mute);
    button(x + w - 120, y + h - 40, 106, 28, resetArm > 0 ? "Na pewno?" : "Nowa gra", () => {
      if (resetArm > 0) {
        P = fresh(); migrated = false; selCls = "war"; pl.fx = P.x; pl.fy = P.y; pl.mt = 1; pl.target = null; pl.path = []; pl.talk = null; panel = ""; dlg = null; banner = 3; resetArm = 0;
        guide = null; shots.length = 0; warns.length = 0; for (const k of Object.keys(AREAS)) if (k !== P.area) AREAS[k].img = null;
        save();
      } else resetArm = 3;
    }, { fs: 12, col: resetArm > 0 ? "#7a2a2a" : undefined });
  }
