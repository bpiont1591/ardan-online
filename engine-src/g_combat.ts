  // ---------- COMBAT ----------
  function gainXp(n: number): void {
    if (P.lvl >= MAXLVL) return;
    P.xp += n;
    const p = rpos(pl2());
    ftext(p[0] + 16, p[1] - 6, "+" + n + " PD", "#9fd3ff", 13);
    while (P.lvl < MAXLVL && P.xp >= xpNext(P.lvl)) {
      P.xp -= xpNext(P.lvl); P.lvl++; P.hp = maxHp(); P.mp = maxMp();
      log("AWANS! Osiągasz poziom " + P.lvl + ".", "#ffd25a");
      for (const s of SK[P.cls] || []) if (s.lvl === P.lvl) log("Nowa umiejętność: " + s.n + "!", "#ffd25a");
      fx.push({ k: "ring", x: p[0] + 16, y: p[1] + 18, life: 1.2, max: 1.2 });
      fx.push({ k: "big", t: "AWANS! Poziom " + P.lvl, life: 2.4, max: 2.4 });
      burst(p[0] + 16, p[1] + 16, "#ffd25a", 40, 110);
      guideT = 0;
      save();
    }
    if (P.lvl >= MAXLVL) P.xp = 0;
  }
  function dmgCalc(a: number, d: number): number { return Math.max(1, Math.round(a * (0.85 + R() * 0.3) - d * 0.6)); }
  function losT(ax: number, ay: number, bx: number, by: number): boolean {
    const a = A(); let ok = true;
    line4(ax, ay, bx, by, (x: number, y: number) => { if ((x !== ax || y !== ay) && (x !== bx || y !== by) && TALL[gt(a, x, y)]) ok = false; });
    return ok;
  }
  const inRange = (m: any, r: number): boolean => cheb(m.x, m.y, P.x, P.y) <= r && (r <= 1 || losT(P.x, P.y, m.x, m.y));
  function applyHit(m: any, d: number, crit: boolean, o: any): void {
    if (m.dead) return;
    m.hp -= d; m.hit = 0.15; m.aggro = true; pl.combat = 6;
    if (o && o.frz) m.frz = Math.max(m.frz || 0, o.frz);
    const p = rpos(m);
    ftext(p[0] + 16, p[1] - 2, (crit ? "KRYT! " : "") + d, crit ? "#ffd25a" : (o && o.col) || "#ffffff", crit || (o && o.big) ? 17 : 14);
    burst(p[0] + 16, p[1] + 16, LIGHTB.indexOf(m.k) >= 0 ? "#e8e4ff" : "#d8443a", 6, 50);
    if (m.hp <= 0) killMob(m);
  }
  function shoot(m: any, d: number, crit: boolean, kind: string, o: any): void {
    const p = rpos(pl2());
    shots.push({ area: P.area, x: p[0] + 16, y: p[1] + 14, m, d, crit, kind, o: o || {}, sp: kind === "fire" ? 320 : kind === "bolt" ? 380 : 460, life: 2.5, ang: 0 });
  }
  function playerAttack(m: any): void {
    if (pl.cd > 0 || m.dead) return;
    const cl = P.cls || "war";
    if (cl === "mag") {
      if (P.mp < 2) { if (pl.nomp <= 0) { log("Brak many! Wypij miksturę many (G) albo odczekaj chwilę.", "#9fb8ff"); pl.nomp = 4; } pl.cd = 0.4; return; }
      P.mp -= 2;
    }
    pl.cd = C().cd / (pl.haste > 0 ? 1.8 : 1); pl.anim = 0.18; pl.combat = 6;
    face(pl, m.x - P.x, m.y - P.y);
    const crit = R() < C().crit + (pl.haste > 0 ? 0.25 : 0);
    let d = dmgCalc(atk(), m.d.def); if (crit) d = Math.round(d * 1.7);
    if (cl === "war") applyHit(m, d, crit, null);
    else shoot(m, d, crit, cl === "arc" ? "arrow" : "bolt", {});
  }
  function killMob(m: any): void {
    m.dead = true; m.rt = m.d.resp; m.frz = 0; if (pl.target === m) pl.target = null;
    const p = rpos(m);
    burst(p[0] + 16, p[1] + 16, m.d.boss ? "#c58cff" : "#bbbbbb", m.d.boss ? 50 : 14, m.d.boss ? 120 : 60);
    log("Pokonano: " + m.d.n + ".", "#c8e6a0");
    if (m.d.boss) fx.push({ k: "big", t: "Pokonano: " + m.d.n + "!", life: 2.6, max: 2.6 });
    P.kills++;
    for (const qid of QORDER) { const q = QUESTS[qid], s = P.q[qid]; if (s && s.s === "active" && q.kill === m.k) { s.c++; if (s.c <= q.need) log(q.n + ": " + s.c + "/" + q.need, "#9fd3ff"); if (s.c === q.need) log("Cel osiągnięty! Strzałka wskaże, komu oddać zadanie.", "#7dff8a"); } }
    let xp = m.d.xp; const diff = P.lvl - m.d.lvl; if (diff > 4) xp = Math.max(1, Math.round(xp * 0.3)); else if (diff > 2) xp = Math.round(xp * 0.7);
    gainXp(xp);
    const items: any[] = [];
    for (const dr of m.d.drops) if (R() < dr[1]) items.push([resolve(dr[0]), 1]);
    const gold = ri(m.d.gold[0], m.d.gold[1]);
    if (items.length || gold > 0) bags.push({ area: P.area, x: m.x, y: m.y, items, gold, life: 90 });
    guideT = 0;
  }
  function hurtPlayer(m: any, raw: number, mult: number): void {
    if (pl.dead) return;
    if (R() < C().dodge) { const p = rpos(pl2()); ftext(p[0] + 16, p[1] - 2, "unik", "#9fd3ff", 12); return; }
    const d = Math.round(dmgCalc(raw, def()) * (mult || 1));
    P.hp -= d; pl.hit = 0.2; pl.combat = 6;
    const p = rpos(pl2());
    ftext(p[0] + 16, p[1] - 2, "-" + d, "#ff5a4a", 15);
    if (m && !m.dead && !pl.target) { pl.target = m; pl.auto = true; }
    if (P.hp <= 0) die();
  }
  function die(): void {
    P.hp = 0; pl.dead = 2.2; pl.target = null; pl.auto = false; pl.path = []; pl.talk = null;
    const lost = Math.floor(P.gold * 0.1); P.gold -= lost;
    const far = ["swamp", "town", "mount", "desert"].indexOf(P.area) >= 0;
    pl.resp = far ? ["town", 19, 13] : ["village", 18, 17];
    log("Poległeś! Tracisz " + lost + " zł. Budzisz się w " + (far ? "Srebrnogrodzie." : "osadzie."), "#ff8a7a");
  }
  function heal(n: number): void {
    const before = P.hp; P.hp = Math.min(maxHp(), P.hp + n);
    const p = rpos(pl2());
    ftext(p[0] + 16, p[1] - 4, "+" + Math.round(P.hp - before), "#7dff8a", 15);
    burst(p[0] + 16, p[1] + 16, "#7dff8a", 12, 40);
  }
  function usePotion(): void {
    if (pl.dead || !P.cls) return;
    const miss = maxHp() - P.hp;
    const have = ["pot", "bigpot", "elix"].filter((id: string) => countItem(id) > 0);
    if (!have.length) { log("Nie masz mikstur leczniczych. Kup je u zielarki lub alchemiczki.", "#ff8a7a"); return; }
    let id = have[0];
    for (const h2 of have) { if (ITEMS[h2].heal <= miss + 20) id = h2; }
    useItem(id);
  }
  function useMana(): void {
    if (pl.dead || !P.cls) return;
    if (!countItem("mpot")) { log("Nie masz mikstur many.", "#9fb8ff"); return; }
    useItem("mpot");
  }
  function useItem(id: string): void {
    const it = ITEMS[id];
    if (it.t === "m") {
      if (P.mp >= maxMp()) { log(C().res + ": pełna.", "#a89c86"); return; }
      removeItem(id, 1);
      const b = P.mp; P.mp = Math.min(maxMp(), P.mp + it.mana);
      const p = rpos(pl2()); ftext(p[0] + 16, p[1] - 4, "+" + Math.round(P.mp - b), "#7fb0ff", 15); burst(p[0] + 16, p[1] + 16, "#6f9bff", 12, 40);
      return;
    }
    if (it.t !== "p") return;
    if (P.hp >= maxHp()) { log("Masz pełne zdrowie.", "#a89c86"); return; }
    removeItem(id, 1);
    heal(it.heal);
  }
  function equip(idx: number): void {
    const s = P.inv[idx]; if (!s) return; const it = ITEMS[s.id];
    if (it.t !== "w" && it.t !== "a") return;
    if (!canUse(s.id)) { log("Tego przedmiotu nie może używać " + C().n + ". Sprzedaj go w sklepie.", "#ff8a7a"); return; }
    const slot = it.t;
    const old = P.eq[slot];
    P.inv.splice(idx, 1);
    P.eq[slot] = s.id;
    if (old) P.inv.push({ id: old, n: 1 });
    P.hp = Math.min(P.hp, maxHp()); P.mp = Math.min(P.mp, maxMp());
    log("Założono: " + it.n + ".", "#c8e6a0");
    invSel = -1; save();
  }
  function unequip(slot: string): void {
    if (!P.eq[slot]) return;
    if (P.inv.length >= 20) { log("Torba jest pełna!", "#ff8a7a"); return; }
    P.inv.push({ id: P.eq[slot], n: 1 }); P.eq[slot] = null; P.hp = Math.min(P.hp, maxHp()); P.mp = Math.min(P.mp, maxMp()); invSel = -1; save();
  }
  function skillTarget(r: number): any {
    if (pl.target && !pl.target.dead && inRange(pl.target, r)) return pl.target;
    let best: any = null, bd = 1e9;
    for (const m of mobs[P.area]) { if (m.dead || !inRange(m, r)) continue; const d = cheb(m.x, m.y, P.x, P.y); if (d < bd) { bd = d; best = m; } }
    return best;
  }
  function useSkill(i: number): void {
    if (pl.dead || dlg || !P.cls || trans) return;
    const sk = SK[P.cls][i]; if (!sk) return;
    if (P.lvl < sk.lvl) { log(sk.n + ": dostępne od poziomu " + sk.lvl + ".", "#a89c86"); return; }
    if (pl.skcd[i] > 0) return;
    if (P.mp < sk.cost) { log("Za mało: " + C().res.toLowerCase() + " (potrzeba " + sk.cost + ").", "#9fb8ff"); return; }
    const cl = P.cls, pp = rpos(pl2()), a0 = atk();
    const noT = (): void => { log(sk.n + ": brak celu w zasięgu.", "#a89c86"); };
    if (cl === "war" && i === 0) {
      const m = skillTarget(1);
      if (!m) { const far = nearestMob(6); if (far) { pl.target = far; tooFar("Podejdź do celu, aby użyć: " + sk.n + "."); } else noT(); return; }
      face(pl, m.x - P.x, m.y - P.y); pl.anim = 0.25; pl.target = m;
      const mp = rpos(m); fx.push({ k: "slash", x: mp[0] + 16, y: mp[1] + 16, life: 0.35, max: 0.35, c: "#ffb347" });
      applyHit(m, Math.round(dmgCalc(a0, m.d.def) * 2.2), false, { frz: 1, col: "#ffb347", big: true });
    } else if (cl === "war" && i === 1) {
      const ms = mobs[P.area].filter((m: any) => !m.dead && cheb(m.x, m.y, P.x, P.y) <= 1);
      if (!ms.length) { log("Brak wrogów wokół ciebie.", "#a89c86"); return; }
      pl.anim = 0.25;
      fx.push({ k: "whirl", x: pp[0] + 16, y: pp[1] + 18, life: 0.45, max: 0.45 });
      ms.forEach((m: any) => applyHit(m, Math.round(dmgCalc(a0, m.d.def) * 1.6), false, { col: "#ffb347", big: true }));
    } else if (cl === "war" && i === 2) {
      pl.buffDef = 8; heal(maxHp() * 0.25);
      fx.push({ k: "ring", x: pp[0] + 16, y: pp[1] + 18, life: 0.9, max: 0.9, c: "255,140,60" });
      ftext(pp[0] + 16, pp[1] - 18, "Okrzyk bojowy!", "#ffb347", 14);
    } else if (cl === "arc" && i === 0) {
      const m = skillTarget(8); if (!m) { noT(); return; }
      pl.target = m; face(pl, m.x - P.x, m.y - P.y); pl.anim = 0.18;
      shoot(m, Math.round(dmgCalc(a0, m.d.def) * 2.6), false, "aim", { col: "#ffe08a", big: true });
    } else if (cl === "arc" && i === 1) {
      const m = skillTarget(7); if (!m) { noT(); return; }
      pl.target = m; face(pl, m.x - P.x, m.y - P.y); pl.anim = 0.18;
      const cx = m.x, cy = m.y, ar = P.area;
      fx.push({ k: "rain", x: cx * TS + 16, y: cy * TS + 16, life: 0.6, max: 0.6 });
      pend.push({ t: 0.45, fn: () => { if (P.area !== ar) return; for (const o of mobs[ar]) if (!o.dead && cheb(o.x, o.y, cx, cy) <= 2) applyHit(o, Math.round(dmgCalc(a0, o.d.def) * 1.3), false, { col: "#ffe08a" }); } });
    } else if (cl === "arc" && i === 2) {
      pl.haste = 7;
      fx.push({ k: "ring", x: pp[0] + 16, y: pp[1] + 18, life: 0.9, max: 0.9, c: "120,255,140" });
      ftext(pp[0] + 16, pp[1] - 18, "Sokole oko!", "#9dff9a", 14);
    } else if (cl === "mag" && i === 0) {
      const m = skillTarget(7); if (!m) { noT(); return; }
      pl.target = m; face(pl, m.x - P.x, m.y - P.y); pl.anim = 0.2;
      shoot(m, Math.round(dmgCalc(a0, m.d.def) * 2.4), false, "fire", { splash: 0.5, col: "#ffb347", big: true });
    } else if (cl === "mag" && i === 1) {
      pl.anim = 0.2;
      fx.push({ k: "nova", x: pp[0] + 16, y: pp[1] + 18, life: 0.5, max: 0.5 });
      const ms = mobs[P.area].filter((m: any) => !m.dead && cheb(m.x, m.y, P.x, P.y) <= 2);
      ms.forEach((m: any) => applyHit(m, Math.round(dmgCalc(a0, m.d.def) * 1.3), false, { frz: 2.5, col: "#9fe6ff" }));
    } else if (cl === "mag" && i === 2) {
      heal(maxHp() * 0.4);
      fx.push({ k: "ring", x: pp[0] + 16, y: pp[1] + 18, life: 0.9, max: 0.9, c: "120,255,160" });
    }
    P.mp -= sk.cost; pl.skcd[i] = sk.cd;
  }
