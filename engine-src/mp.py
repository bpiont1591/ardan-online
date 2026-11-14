import sys
s=open('engine.ts').read()
def ed(a,b,cnt=1):
    global s
    n=s.count(a)
    assert n==cnt,(a[:90],n)
    s=s.replace(a,b)

# ---- header / modes
ed('function createArdan(canvas: HTMLCanvasElement, opts: { font?: string }): () => void {',
'''function createArdan(canvas: HTMLCanvasElement, opts: any): () => void {
  // SRV: headless authoritative instance on the server (one per connected player, shared mobs).
  // NET: online client - renders server state and only sends intents.
  const SRV: any = opts.server || null, NET: any = opts.net || null;''')
ed('Ardan: Kroniki Mgieł','ARDAN',2)

# ---- state load / save
ed('''  let migrated = false;
  try {
    const ls = window.localStorage;''','''  let migrated = false;
  if (SRV || NET) P = Object.assign(fresh(), (SRV || NET).state || {});
  else try {
    const ls = window.localStorage;''')
ed('function save(): void { try { window.localStorage.setItem(SAVE_KEY','function save(): void { if (SRV) { SRV.dirty = true; return; } if (NET) return; try { window.localStorage.setItem(SAVE_KEY')

# ---- shared mobs
ed('''  const mobs: { [k: string]: any[] } = {};
  Object.keys(AREAS).forEach((k: string) => {
    mobs[k] = AREAS[k].spawns.map(''','''  const mobs: { [k: string]: any[] } = SRV && SRV.mobs ? SRV.mobs : {};
  Object.keys(AREAS).forEach((k: string) => {
    if (mobs[k]) return;
    mobs[k] = AREAS[k].spawns.map(''')

# ---- burst -> event on server
ed('''  const burst = (x: number, y: number, c: string, n: number, sp?: number): void => {
''','''  const burst = (x: number, y: number, c: string, n: number, sp?: number): void => {
    if (SRV) { fx.push({ k: "burst", x, y, c, n, sp }); return; }
''')
ed('      if (s.kind !== "arrow" && s.kind !== "aim" && R() < 0.7) fx.push(','      if (!SRV && s.kind !== "arrow" && s.kind !== "aim" && R() < 0.7) fx.push(')

# ---- mob ownership
ed('''    for (const m of mobs[P.area]) {
      m.hit = Math.max(0, m.hit - dt); m.anim = Math.max(0, m.anim - dt);''','''    for (const m of mobs[P.area]) {
      if (SRV && m.own !== SRV.id) continue;
      m.hit = Math.max(0, m.hit - dt); m.anim = Math.max(0, m.anim - dt);''')
ed('    m.hp -= d; m.hit = 0.15; m.aggro = true; pl.combat = 6;','    if (SRV && (!m.aggro || !m.own)) m.own = SRV.id;\n    m.hp -= d; m.hit = 0.15; m.aggro = true; pl.combat = 6;')

# ---- shop actions (validated, used by both offline and server)
ed('''        row(id, sub, it.price, "Kup", () => {
          if (P.gold < it.price) { log("Za mało złota.", "#ff8a7a"); return; }
          if (addItem(id, 1)) { P.gold -= it.price; log("Kupiono: " + it.n + ".", "#c8e6a0"); save(); }
        }, P.gold < it.price);''','''        row(id, sub, it.price, "Kup", () => act({ a: "buy", id }), P.gold < it.price);''')
ed('''        row(e.s.id, itemDesc(e.s.id), pr, "Sprzedaj", () => {
          const s = P.inv[e.i]; if (!s) return;
          s.n--; if (s.n <= 0) P.inv.splice(e.i, 1); P.gold += pr; log("Sprzedano: " + it.n + " (+" + pr + " zł).", "#f5d98a"); save();
        }, false, e.s.n);''','''        row(e.s.id, itemDesc(e.s.id), pr, "Sprzedaj", () => act({ a: "sell", i: e.i }), false, e.s.n);''')
ed('''button(x + w - 140, y + h - 40, 126, 28, "Sprzedaj łupy", () => {
        let sum = 0;
        for (let i = P.inv.length - 1; i >= 0; i--) { const s = P.inv[i]; if (ITEMS[s.id].t === "j") { sum += Math.max(1, Math.floor(ITEMS[s.id].price / 2)) * s.n; P.inv.splice(i, 1); } }
        P.gold += sum; log("Sprzedano łupy za " + sum + " zł.", "#f5d98a"); save();
      }, { fs: 12 });''','''button(x + w - 140, y + h - 40, 126, 28, "Sprzedaj łupy", () => act({ a: "junk" }), { fs: 12 });''')
ed('''  function npcAt(x: number, y: number): string | null {''','''  function shopOk(): boolean {
    if (!shopId) return false;
    for (const k of Object.keys(NPCS)) { const n = NPCS[k]; if (n.shop === shopId && n.area === P.area && cheb(n.x, n.y, P.x, P.y) <= 2) return true; }
    log("Jesteś za daleko od sprzedawcy.", "#ff8a7a"); return false;
  }
  function buyItem(id: string): void {
    if (!shopOk() || shopList(shopId).indexOf(id) < 0 || !ITEMS[id]) return;
    const it = ITEMS[id];
    if (P.gold < it.price) { log("Za mało złota.", "#ff8a7a"); return; }
    if (addItem(id, 1)) { P.gold -= it.price; log("Kupiono: " + it.n + ".", "#c8e6a0"); save(); } else log("Torba jest pełna!", "#ff8a7a");
  }
  function sellItem(i: number): void {
    if (!shopOk()) return;
    const s = P.inv[i]; if (!s) return; const it = ITEMS[s.id], pr = Math.max(1, Math.floor(it.price / 2));
    s.n--; if (s.n <= 0) P.inv.splice(i, 1); P.gold += pr; log("Sprzedano: " + it.n + " (+" + pr + " zł).", "#f5d98a"); save();
  }
  function sellJunk(): void {
    if (!shopOk()) return;
    let sum = 0;
    for (let i = P.inv.length - 1; i >= 0; i--) { const s = P.inv[i]; if (ITEMS[s.id].t === "j") { sum += Math.max(1, Math.floor(ITEMS[s.id].price / 2)) * s.n; P.inv.splice(i, 1); } }
    if (sum) { P.gold += sum; log("Sprzedano łupy za " + sum + " zł.", "#f5d98a"); save(); }
  }
  function npcAt(x: number, y: number): string | null {''')

# ---- inventory / quest buttons -> acts
ed('() => equip(invSel), { dis: !canUse(selId) });','() => { act({ a: "equip", i: invSel }); invSel = -1; }, { dis: !canUse(selId) });')
ed('"Użyj", () => { useItem(selId); if (!P.inv[invSel] || P.inv[invSel].id !== selId) invSel = -1; });','"Użyj", () => { act({ a: "use", id: selId }); });')
ed('"Zdejmij", () => unequip(invSel === -2 ? "w" : "a"));','"Zdejmij", () => { act({ a: "unequip", id: invSel === -2 ? "w" : "a" }); invSel = -1; });')
ed('const fnT = (): void => { P.track = id; guideT = 0; };','const fnT = (): void => { P.track = id; guideT = 0; actQ.push({ a: "track", id }); };')
ed('    button(x + w - 120, y + h - 40, 106, 28, resetArm > 0 ? "Na pewno?" : "Nowa gra", () => {','    if (!NET) button(x + w - 120, y + h - 40, 106, 28, resetArm > 0 ? "Na pewno?" : "Nowa gra", () => {')
ed('P.track = act[(act.indexOf(P.track) + 1) % act.length]; guideT = 0;','P.track = act[(act.indexOf(P.track) + 1) % act.length]; guideT = 0; actQ.push({ a: "track", id: P.track });')
ed('    if (k === "Escape") { if (dlg) dlg = null; else panel = ""; return; }','    if (k === "Escape") { if (dlg) { if (dlg.srv) actQ.push({ a: "dlgx" }); dlg = null; } else panel = ""; return; }')

# ---- applyAct: new actions
ed('''    else if (a.a === "untarget") { pl.target = null; pl.auto = false; }''','''    else if (a.a === "untarget") { pl.target = null; pl.auto = false; }
    else if (a.a === "buy" && a.id) buyItem(a.id);
    else if (a.a === "sell" && a.i !== undefined) sellItem(a.i);
    else if (a.a === "junk") sellJunk();
    else if (a.a === "equip" && a.i !== undefined) equip(a.i);
    else if (a.a === "unequip" && (a.id === "w" || a.id === "a")) unequip(a.id);
    else if (a.a === "use" && a.id && ITEMS[a.id] && countItem(a.id) > 0) useItem(a.id);
    else if (a.a === "track" && a.id !== undefined) { if (a.id === "" || (QUESTS[a.id] && P.q[a.id] && P.q[a.id].s === "active")) { P.track = a.id; guideT = 0; } }
    else if (a.a === "dlg" && dlg && a.i !== undefined && dlg.opts[a.i]) dlg.opts[a.i].fn();
    else if (a.a === "dlgx") dlg = null;
    else if (a.a === "intro") { P.intro = true; save(); }''')

# ---- online: update split
ed('''    if (!P.cls) return;
    banner = Math.max(0, banner - dt);''','''    if (!P.cls) return;
    if (NET) { netUpdate(dt); return; }
    banner = Math.max(0, banner - dt);''')

NETCODE = r'''
  // ---------- MULTIPLAYER: SERVER TICK ----------
  function srvTick(dt: number, it: Intent): void {
    time += dt;
    if (trans) {
      trans.t += dt;
      if (!trans.done && trans.t >= 0.25) {
        trans.done = true; P.area = trans.to; P.x = trans.tx; P.y = trans.ty; pl.fx = P.x; pl.fy = P.y; pl.mt = 1; pl.target = null; pl.auto = false; pl.talk = null;
        const m = mobAt(P.x, P.y); if (m) { m.x = m.fx = m.hx; m.y = m.fy = m.hy; }
        const first = !P.seen[P.area]; P.seen[P.area] = 1;
        shots.length = 0; warns.length = 0; pend.length = 0; dlg = null; panel = ""; shopId = ""; save();
        if (first) log("Odkryto nową krainę: " + A().name + "!", "#f5d98a");
      }
      if (trans.t >= 0.6) trans = null;
    }
    updatePlayer(dt, it);
    if (!trans) { updateMobs(dt); updateShots(dt); }
    for (let i = bags.length - 1; i >= 0; i--) { bags[i].life -= dt; if (bags[i].life <= 0 || bags[i].taken) bags.splice(i, 1); }
  }
  // ---------- MULTIPLAYER: ONLINE CLIENT ----------
  const others: { [id: string]: any } = {};
  let netLast: number[] = [9, 9, -9], netIntro = false;
  function netPos(e: any, o: any, x: number, y: number): void {
    if (o.x === x && o.y === y) return;
    if (cheb(o.x, o.y, x, y) > 2) { e.fx = x; e.fy = y; e.mt = 1; }
    else { e.fx = e.fx + (o.x - e.fx) * e.mt; e.fy = e.fy + (o.y - e.fy) * e.mt; e.mt = 0; }
    o.x = x; o.y = y;
  }
  function netArea(a: string, x: number, y: number): void {
    if (!AREAS[a]) return;
    P.area = a; P.x = x; P.y = y; pl.fx = x; pl.fy = y; pl.mt = 1; pl.target = null;
    for (const k of Object.keys(AREAS)) if (k !== a) AREAS[k].img = null;
    const first = !P.seen[a]; P.seen[a] = 1;
    for (const k of Object.keys(others)) delete others[k];
    shots.length = 0; warns.length = 0; bags.length = 0; panel = ""; guide = null; guideT = 0;
    banner = first ? 4.5 : 3; trans = { t: 0.25, done: true, to: a };
    if (first) log("Odkryto nową krainę: " + A().name + "!", "#f5d98a");
  }
  function netEvent(e: any): void {
    if (e.k === "burst") burst(e.x, e.y, e.c, Math.min(60, e.n || 8), e.sp);
    else if (e.k === "shot") {
      const m = e.m >= 0 ? mobs[P.area][e.m] : null;
      shots.push({ area: P.area, x: e.x, y: e.y, m, tp: e.p || null, kind: e.kind, col: e.col, sp: e.sp || 300, life: 3, ang: 0, o: {} });
    } else if (e.k === "warn") warns.push({ area: P.area, x: e.x, y: e.y, r: e.r, t: e.t, max: e.max });
    else if (typeof e.k === "string") { const f = Object.assign({}, e); if (fx.length < 400) fx.push(f); }
  }
  function netRecv(msg: any): void {
    if (!msg || typeof msg !== "object") return;
    if (msg.t === "s") {
      const me = msg.p;
      if (msg.a !== P.area) netArea(msg.a, me.x, me.y);
      netPos(pl, P, me.x, me.y);
      pl.dir = me.d; P.hp = me.hp; P.mp = me.mp; pl.dead = me.dd; pl.cd = me.cd; pl.skcd = me.sk; pl.buffDef = me.bd; pl.haste = me.hs; pl.auto = !!me.au; pl.combat = me.cb;
      if (me.an > pl.anim + 0.05) pl.anim = me.an;
      if (me.ht > pl.hit + 0.05) pl.hit = me.ht;
      const ml = mobs[msg.a];
      pl.target = me.tg >= 0 && ml && ml[me.tg] && !ml[me.tg].dead ? ml[me.tg] : null;
      if (ml && msg.m) msg.m.forEach((r: number[], i: number) => {
        const m = ml[i]; if (!m || !r) return;
        const dead = (r[3] & 1) === 1;
        if (dead && !m.dead && pl.target === m) pl.target = null;
        if (m.dead && !dead) { m.x = m.fx = r[0]; m.y = m.fy = r[1]; m.mt = 1; } else netPos(m, m, r[0], r[1]);
        m.hp = r[2]; m.dead = dead; m.aggro = (r[3] & 2) === 2; m.frz = (r[3] & 4) ? 1 : 0;
        if ((r[3] & 8) && m.hit <= 0) m.hit = 0.15;
        if ((r[3] & 16) && m.anim <= 0) m.anim = 0.2;
        m.dir = r[4];
      });
      const seen: { [k: string]: boolean } = {};
      for (const o of msg.o || []) {
        seen[o.i] = true;
        let e = others[o.i];
        if (!e) { e = others[o.i] = { x: o.x, y: o.y, fx: o.x, fy: o.y, mt: 1, phase: 0, an: 0, hit: 0, area: msg.a }; }
        netPos(e, e, o.x, o.y);
        e.n = o.n; e.c = o.c; e.l = o.l; e.dir = o.d; e.hp = o.hp; e.mh = o.mh; e.w = o.w; e.a = o.a; e.dead = o.dd; e.area = msg.a; e.bd = o.bd;
        if (o.an > e.an + 0.05) e.an = o.an;
        if (o.ht > e.hit + 0.05) e.hit = o.ht;
      }
      for (const k of Object.keys(others)) if (!seen[k]) delete others[k];
      if (msg.b) { bags.length = 0; for (const b of msg.b) bags.push({ area: msg.a, x: b[0], y: b[1], items: [], gold: 0, life: 9 }); }
      for (const e of msg.e || []) netEvent(e);
      for (const l of msg.l || []) log(String(l.t), l.c);
    } else if (msg.t === "me") {
      const keep = { x: P.x, y: P.y, area: P.area, hp: P.hp, mp: P.mp, mmz: P.mmz, seen: P.seen };
      P = Object.assign(fresh(), msg.me, keep); guideT = 0;
    } else if (msg.t === "dlg") {
      const d = msg.d;
      if (d) dlg = { srv: true, name: String(d.name), text: String(d.text), opts: (d.opts || []).map((l: string, i: number) => ({ l: String(l), fn: () => { act({ a: "dlg", i }); } })) };
      else if (dlg && dlg.srv) dlg = null;
    } else if (msg.t === "shop") { panel = "shop"; shopId = String(msg.shop); shopTab = "buy"; sellPage = 0; }
    else if (msg.t === "log") log(String(msg.text), msg.c);
  }
  function netShots(dt: number): void {
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i]; s.life -= dt;
      let tp: number[] | null = null;
      if (s.m) { if (!s.m.dead) tp = rpos(s.m); }
      else if (s.tp) { if (s.tp === NET.id) tp = rpos(pl2()); else if (others[s.tp]) tp = rpos(others[s.tp]); }
      if (!tp || s.life <= 0) { shots.splice(i, 1); continue; }
      const tx = tp[0] + 16, ty = tp[1] + 14, dx = tx - s.x, dy = ty - s.y, dist = Math.hypot(dx, dy);
      s.ang = Math.atan2(dy, dx);
      const stp = s.sp * dt;
      if (dist <= stp + 4) { shots.splice(i, 1); continue; }
      s.x += dx / dist * stp; s.y += dy / dist * stp;
      if (s.kind !== "arrow" && s.kind !== "aim" && R() < 0.7) fx.push({ k: "p", x: s.x, y: s.y, vx: (R() - 0.5) * 20, vy: (R() - 0.5) * 20, c: s.kind === "fire" ? "#ffb347" : s.kind === "bolt" ? "#bfa8ff" : s.col, life: 0.3, max: 0.6 });
    }
    for (let i = warns.length - 1; i >= 0; i--) { warns[i].t -= dt; if (warns[i].t <= 0) { warns.splice(i, 1); } }
  }
  function netUpdate(dt: number): void {
    banner = Math.max(0, banner - dt);
    if (trans) { trans.t += dt; if (trans.t >= 0.6) trans = null; }
    const it = readIntent();
    if (it.mx !== netLast[0] || it.my !== netLast[1] || it.acts.length || time - netLast[2] > 1) {
      netLast = [it.mx, it.my, time];
      NET.send({ t: "in", mx: it.mx, my: it.my, acts: it.acts });
    }
    pl.cd = Math.max(0, pl.cd - dt); pl.anim = Math.max(0, pl.anim - dt); pl.hit = Math.max(0, pl.hit - dt);
    pl.buffDef = Math.max(0, pl.buffDef - dt); pl.haste = Math.max(0, pl.haste - dt);
    for (let i = 0; i < 3; i++) pl.skcd[i] = Math.max(0, (pl.skcd[i] || 0) - dt);
    if (pl.mt < 1) { pl.mt = Math.min(1, pl.mt + dt * 5); pl.phase += dt * 14; }
    for (const m of mobs[P.area]) { m.hit = Math.max(0, m.hit - dt); m.anim = Math.max(0, m.anim - dt); if (m.mt < 1) m.mt = Math.min(1, m.mt + dt * m.d.spd * (m.frz > 0 ? 0.3 : 1)); }
    for (const k of Object.keys(others)) { const o = others[k]; if (o.mt < 1) { o.mt = Math.min(1, o.mt + dt * 5); o.phase += dt * 14; } o.an = Math.max(0, o.an - dt); o.hit = Math.max(0, o.hit - dt); }
    netShots(dt);
    updateGuide(dt);
    for (const m of msgs) m.life -= dt;
    while (msgs.length && msgs[0].life <= 0) msgs.shift();
    if (!P.intro && !dlg && !netIntro) {
      netIntro = true;
      dlg = { name: "ARDAN", text: (touchMode
        ? "Witaj w świecie ARDAN! Chodzisz strzałkami w lewym dolnym rogu (przytrzymaj; dwie naraz – po skosie). Złota strzałka i kropki wskazują drogę do celu zadania. Dotknij potwora, by go wybrać, i bij przyciskiem ataku. Z postacią porozmawiasz, stojąc obok niej. Czat otworzysz przyciskiem z dymkiem."
        : "Witaj w świecie ARDAN! WASD/strzałki – ruch, klik na potwora – wybór celu, Spacja/F – atak, 1/2/3 – umiejętności, E – rozmowa (stojąc obok), I – torba, Q – zadania, M – mapa, H/G – mikstury, C – czat. Inni gracze są tu razem z tobą!"),
        opts: [{ l: "Zaczynajmy!", fn: () => { dlg = null; act({ a: "intro" }); } }] };
    }
  }
  function drawOther(o: any, op: number[]): void {
    const c = CLS[o.c] || CLS.war;
    const w = o.w && ITEMS[o.w] ? ITEMS[o.w].c : null, ar = o.a && o.a !== "shirt" && ITEMS[o.a] ? ITEMS[o.a].c : null;
    if (o.bd) { ctx.strokeStyle = "rgba(255,150,60,0.6)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(op[0] + 16, op[1] + 28, 14, 5, 0, 0, Math.PI * 2); ctx.stroke(); }
    drawHuman(op[0], op[1], o.dir || 0, o.mt < 1 ? o.phase : 0, c.look, w, ar, o.hit > 0, o.an, c.wk);
    label(op[0] + 16, op[1] - 8, o.n + " · " + o.l, "#9fe0ff");
    const hpk = o.mh ? clamp(o.hp / o.mh, 0, 1) : 1;
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(op[0] + 4, op[1] - 4, 24, 4); ctx.fillStyle = "#5fd35a"; ctx.fillRect(op[0] + 4, op[1] - 4, 24 * hpk, 4);
  }
'''
ed('  // ---------- DRAW: ENTITIES ----------', NETCODE + '\n  // ---------- DRAW: ENTITIES ----------')

# ---- draw others + own nick
ed('''    for (const m of mobs[P.area]) if (!m.dead) ents.push({ y: rpos(m)[1], f: () => drawMob(m) });''','''    for (const m of mobs[P.area]) if (!m.dead) ents.push({ y: rpos(m)[1], f: () => drawMob(m) });
    if (NET) for (const k of Object.keys(others)) { const o = others[k]; if (o.area !== P.area || o.dead) continue; const op = rpos(o); ents.push({ y: op[1] + 0.4, f: () => drawOther(o, op) }); }''')
ed('''      drawPlayerAt(pp[0], pp[1], pl.dir, pl.mt < 1 ? pl.phase : 0, pl.hit > 0, pl.anim);
    } });''','''      drawPlayerAt(pp[0], pp[1], pl.dir, pl.mt < 1 ? pl.phase : 0, pl.hit > 0, pl.anim);
      if (NET && NET.nick) label(pp[0] + 16, pp[1] - 8, NET.nick + " · " + P.lvl, "#ffe9a8");
    } });''')
# minimap others
ed('''    const pp2 = rpos(pl2()); const pq = tp(pp2[0] / TS, pp2[1] / TS);''','''    if (NET) for (const k of Object.keys(others)) { const o = others[k]; if (o.area !== P.area || o.dead) continue; const q2 = tp(o.x + 0.5, o.y + 0.5); ctx.fillStyle = "#9fe0ff"; ctx.strokeStyle = "#0a2030"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(q2[0], q2[1], 2.8, 0, 7); ctx.fill(); ctx.stroke(); }
    const pp2 = rpos(pl2()); const pq = tp(pp2[0] / TS, pp2[1] / TS);''')
# chat util button
ed('''    circleBtn(W - 10 - ur * 5 - 16, uy, ur, "bag", () => { panel = panel === "inv" ? "" : "inv"; invSel = -1; }, hintOn ? "I" : "");''','''    circleBtn(W - 10 - ur * 5 - 16, uy, ur, "bag", () => { panel = panel === "inv" ? "" : "inv"; invSel = -1; }, hintOn ? "I" : "");
    if (NET && NET.onChat) circleBtn(W - 10 - ur * 7 - 24, uy, ur, "chat", () => { NET.onChat(); }, hintOn ? "C" : "", NET.unread ? String(Math.min(9, NET.unread)) : undefined);''')
ed('''    } else if (kind === "quest") {
      g.fillStyle = "#efe0b8";''','''    } else if (kind === "chat") {
      g.fillStyle = "#e8dcc0"; rr(cx - r * 0.55, cy - r * 0.45, r * 1.1, r * 0.75, 4); g.fill();
      g.beginPath(); g.moveTo(cx - r * 0.25, cy + r * 0.28); g.lineTo(cx - r * 0.4, cy + r * 0.6); g.lineTo(cx + r * 0.05, cy + r * 0.28); g.fill();
      g.fillStyle = "#6a5430"; for (let i = 0; i < 3; i++) g.fillRect(cx - r * 0.32 + i * r * 0.26, cy - r * 0.1, 3, 3);
    } else if (kind === "quest") {
      g.fillStyle = "#efe0b8";''')
# key: C opens chat (online)
ed('''    else if (k === "m") {''','''    else if ((k === "c" || k === "/") && NET && NET.onChat) { for (const kk of Object.keys(keys)) keys[kk] = false; NET.onChat(); }
    else if (k === "m") {''')

# ---- loop / listeners / API
ed('''  canvas.tabIndex = 0;''','''  if (!SRV) {
  canvas.tabIndex = 0;''')
ed('''  window.addEventListener("blur", onBlur);
''','''  window.addEventListener("blur", onBlur);
  }
''')
ed('''  raf = requestAnimationFrame(frame);
  log("Witaj w Ardanie!", "#f5d98a");''','''  if (!SRV) raf = requestAnimationFrame(frame);
  log("Witaj w Ardanie!", "#f5d98a");
  if (SRV) SRV.api = {
    tick: srvTick, pl, P: (): any => P, maxHp, maxMp,
    drain: (): any => ({ fx: fx.splice(0, fx.length), msgs: msgs.splice(0, msgs.length) }),
    shots: (): any[] => shots, warns: (): any[] => warns, bags: (): any[] => bags,
    dlgView: (): any => dlg ? { name: dlg.name, text: dlg.text, opts: dlg.opts.map((o: any) => o.l) } : null,
    shopReq: (): string | null => { if (panel === "shop") { panel = ""; return shopId; } return null; },
    mobIdx: (m: any): number => mobs[P.area].indexOf(m),
  };
  if (NET) NET.api = { recv: netRecv, clearKeys: onBlur, log };''')
ed('''    destroyed = true; cancelAnimationFrame(raf); save();''','''    destroyed = true; if (!SRV) cancelAnimationFrame(raf); save();
    if (SRV) return;''')
ed('  Object.keys(AREAS).forEach((k: string) => renderMini(AREAS[k]));','  if (!SRV) Object.keys(AREAS).forEach((k: string) => renderMini(AREAS[k]));')
# ---- parties (phase 2): kill hook + shared party kill credit
ed("""    gainXp(xp);
    const items: any[] = [];""","""    gainXp(xp);
    if (SRV && SRV.onKill) SRV.onKill(m.k, m.d.lvl, m.d.xp, m.x, m.y);
    const items: any[] = [];""")
ed("""    mobIdx: (m: any): number => mobs[P.area].indexOf(m),
  };""","""    mobIdx: (m: any): number => mobs[P.area].indexOf(m),
    partyKill: (mk: string, mlvl: number, baseXp: number, from: string): void => {
      if (pl.dead > 0 || !P.cls) return;
      for (const qid of QORDER) { const q = QUESTS[qid], s2 = P.q[qid]; if (s2 && s2.s === "active" && q.kill === mk && s2.c < q.need) { s2.c++; log(q.n + ": " + s2.c + "/" + q.need + " (drużyna)", "#9fd3ff"); if (s2.c === q.need) log("Cel osiągnięty! Strzałka wskaże, komu oddać zadanie.", "#7dff8a"); } }
      let xp = baseXp; const diff = P.lvl - mlvl; if (diff > 4) xp = Math.max(1, Math.round(xp * 0.3)); else if (diff > 2) xp = Math.round(xp * 0.7);
      xp = Math.max(1, Math.round(xp * 0.5));
      log("Drużyna (" + from + "): +" + xp + " PD", "#8fff8f");
      gainXp(xp); save();
    },
  };""")
ed("""        e.n = o.n; e.c = o.c;""","""        e.i = o.i; e.n = o.n; e.c = o.c;""")
ed("""    label(op[0] + 16, op[1] - 8, o.n + " · " + o.l, "#9fe0ff");""","""    const inParty = !!(NET && NET.party && NET.party[o.i]);
    label(op[0] + 16, op[1] - 8, (inParty ? "◆ " : "") + o.n + " · " + o.l, inParty ? "#8fff8f" : "#9fe0ff");""")
open('engine.ts','w').write(s)
print('mp ok', len(s))
