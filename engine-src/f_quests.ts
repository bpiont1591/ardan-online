  // ---------- QUESTS ----------
  const reqDone = (q: any): boolean => !q.req || (P.q[q.req] && P.q[q.req].s === "done");
  const qAvail = (id: string): boolean => { const q = QUESTS[id]; return !P.q[id] && reqDone(q) && P.lvl >= (q.lvl || 1); };
  const qLocked = (id: string): boolean => { const q = QUESTS[id]; return !P.q[id] && reqDone(q) && P.lvl < (q.lvl || 1); };
  const qProg = (id: string): number => { const q = QUESTS[id], s = P.q[id]; if (!s) return 0; if (q.talkq) return q.need; return Math.min(q.need, q.item ? countItem(q.item) : s.c); };
  const qReady = (id: string): boolean => { const s = P.q[id]; return !!s && s.s === "active" && qProg(id) >= QUESTS[id].need; };
  const qTo = (id: string): string => QUESTS[id].to || QUESTS[id].giver;
  function npcMark(id: string): string {
    let m = "";
    for (const q of QORDER) {
      if (qTo(q) === id && qReady(q)) return "?";
      if (QUESTS[q].giver !== id) continue;
      if (qAvail(q)) m = "!";
      else if (!m && P.q[q] && P.q[q].s === "active") m = "…";
    }
    return m;
  }
  function completeQuest(id: string): void {
    const q = QUESTS[id];
    if (q.item) removeItem(q.item, q.need);
    if (q.give) removeItem(q.give, 1);
    P.q[id].s = "done";
    P.gold += q.rew.gold;
    const its = q.rew.items.map((i: any[]) => [resolve(i[0]), i[1]]);
    for (const it of its) addItem(it[0], it[1]);
    log("Ukończono zadanie: " + q.n, "#f5d98a");
    log("Nagroda: " + q.rew.xp + " PD, " + q.rew.gold + " zł" + its.map((i: any[]) => ", " + ITEMS[i[0]].n + (i[1] > 1 ? " x" + i[1] : "")).join(""), "#f5d98a");
    const p = rpos(pl2());
    burst(p[0] + 16, p[1] + 10, "#f5d98a", 24, 80);
    if (P.track === id) P.track = "";
    guideT = 0;
    gainXp(q.rew.xp);
    save();
  }
  function talk(id: string): void {
    const n = NPCS[id];
    pl.talk = null; pl.target = null; pl.path = [];
    const extra: any[] = [];
    if (n.shop) extra.push({ l: "Pokaż towary", fn: () => { dlg = null; panel = "shop"; shopId = n.shop; shopTab = "buy"; sellPage = 0; } });
    if (n.heal) extra.push({ l: n.heal, fn: () => { P.hp = maxHp(); P.mp = maxMp(); dlg = { name: n.n, text: "Czujesz, jak siły wracają. Zdrowie i " + C().res.toLowerCase() + " zostały w pełni przywrócone.", opts: [{ l: "Dziękuję", fn: () => { dlg = null; } }] }; const p = rpos(pl2()); burst(p[0] + 16, p[1] + 14, "#7dff8a", 18, 50); } });
    const bye = { l: "Do widzenia", fn: () => { dlg = null; } };
    for (const qid of QORDER) {
      const q = QUESTS[qid]; if (qTo(qid) !== id) continue;
      if (qReady(qid)) { dlg = { name: n.n, text: q.thx, opts: [{ l: "Odbierz nagrodę", fn: () => { dlg = null; completeQuest(qid); } }] }; return; }
    }
    for (const qid of QORDER) {
      const q = QUESTS[qid]; if (q.giver !== id) continue;
      if (qAvail(qid)) {
        dlg = { name: n.n, text: q.offer, opts: [{ l: "Przyjmuję zadanie", fn: () => {
          P.q[qid] = { s: "active", c: 0 }; if (q.give) addItem(q.give, 1); P.track = qid; guideT = 0; dlg = null;
          log("Nowe zadanie: " + q.n + " (śledzone – idź za złotą strzałką)", "#9fd3ff"); save();
        } }, { l: "Nie teraz", fn: () => { dlg = null; } }] };
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
  // ---------- GUIDANCE ----------
  function questObj(id: string): any {
    const q = QUESTS[id], s = P.q[id];
    if (!s || s.s === "done") return null;
    if (qReady(id)) { const n = NPCS[qTo(id)]; return { area: n.area, x: n.x, y: n.y, t: (q.talkq ? "Zanieś list: " : "Oddaj: ") + n.n, kind: "npc" }; }
    const kind = q.kill || q.src;
    if (!kind) return null;
    const verb = q.kill ? "Ubij: " : "Zdobądź z: ";
    if (P.area === q.area) {
      let best: any = null, bd = 1e9;
      for (const m of mobs[P.area]) if (!m.dead && m.k === kind) { const d = cheb(m.x, m.y, P.x, P.y); if (d < bd) { bd = d; best = m; } }
      if (best) return { area: q.area, x: best.x, y: best.y, t: verb + MON[kind].n, kind: "mob", m: best };
      for (const m of mobs[P.area]) if (m.k === kind) return { area: q.area, x: m.hx, y: m.hy, t: MON[kind].n + " (odradza się)", kind: "spawn" };
    }
    const sp = AREAS[q.area].spawns.find((s2: any[]) => s2[0] === kind);
    return { area: q.area, x: sp ? sp[1] : 1, y: sp ? sp[2] : 1, t: verb + MON[kind].n, kind: "spawn" };
  }
  function activeQuests(): string[] { return QORDER.filter((q: string) => P.q[q] && P.q[q].s === "active"); }
  function curObj(): any {
    let id = P.track;
    if (!id || !P.q[id] || P.q[id].s !== "active") {
      const act = activeQuests();
      id = act.find((q: string) => qReady(q)) || act.find((q: string) => QUESTS[q].area === P.area) || act[0] || "";
      P.track = id;
    }
    if (id) { const o = questObj(id); if (o) { o.q = id; return o; } }
    let pick: any = null;
    for (const qid of QORDER) if (qAvail(qid)) { const n = NPCS[QUESTS[qid].giver]; if (!pick || (n.area === P.area && pick.area !== P.area)) pick = { area: n.area, x: n.x, y: n.y, t: "Nowe zadanie: " + n.n, kind: "npc", q: "" }; }
    return pick;
  }
  function gpath(sx: number, sy: number, tx: number, ty: number, near: number): number[][] | null {
    const a = A(); const Wd = a.w;
    if (cheb(sx, sy, tx, ty) <= near) return [];
    const prev = new Int32Array(a.w * a.h).fill(-1);
    const s0 = sy * Wd + sx; prev[s0] = s0; const q = [s0]; let qi = 0;
    const D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (qi < q.length) {
      const c = q[qi++]; const cx = c % Wd, cy = (c - cx) / Wd;
      for (const d of D) {
        const nx = cx + d[0], ny = cy + d[1];
        if (nx < 0 || ny < 0 || nx >= a.w || ny >= a.h) continue;
        const k = ny * Wd + nx; if (prev[k] !== -1) continue;
        const goal = near ? cheb(nx, ny, tx, ty) <= near : nx === tx && ny === ty;
        if (!goal && (solidT(a, nx, ny) || npcAt(nx, ny) || decorAt(nx, ny))) continue;
        prev[k] = c;
        if (goal) {
          const path: number[][] = []; let p = k;
          while (p !== s0) { const px = p % Wd; path.unshift([px, (p - px) / Wd]); p = prev[p]; }
          return path;
        }
        q.push(k);
      }
    }
    return null;
  }
  function updateGuide(dt: number): void {
    guideT -= dt;
    if (guideT > 0) { if (guide && guide.o.m && !guide.o.m.dead && guide.o.area === P.area) { guide.x = guide.o.m.x; guide.y = guide.o.m.y; } return; }
    guideT = 0.45;
    const o = curObj();
    if (!o) { guide = null; return; }
    let gx = o.x, gy = o.y, via = "", near = o.kind === "npc" || o.kind === "mob" ? 1 : 0;
    if (o.area !== P.area) {
      const nx = routeNext(P.area, o.area);
      if (!nx) { guide = null; return; }
      let be: any = null, bd = 1e9;
      for (const e of GRAPH[P.area][nx]) { const d = cheb(e.x, e.y, P.x, P.y); if (d < bd) { bd = d; be = e; } }
      gx = be.x; gy = be.y; via = nx; near = 0;
    } else if (o.kind === "spawn") near = 2;
    const path = gpath(P.x, P.y, gx, gy, near);
    guide = { o, x: gx, y: gy, via, path, near, dist: path ? path.length : cheb(gx, gy, P.x, P.y) };
  }
  function guideDir(): number[] | null {
    if (!guide) return null;
    const pp = rpos(pl2());
    let tx = guide.x * TS + 16, ty = guide.y * TS + 16;
    if (guide.path && guide.path.length > 1) { const n = guide.path[Math.min(guide.path.length - 1, 3)]; tx = n[0] * TS + 16; ty = n[1] * TS + 16; }
    const dx = tx - (pp[0] + 16), dy = ty - (pp[1] + 16), d = Math.hypot(dx, dy);
    if (d < 1) return null;
    return [dx / d, dy / d];
  }

