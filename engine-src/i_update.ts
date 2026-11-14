  function updatePlayer(dt: number, it: Intent): void {
    pl.cd = Math.max(0, pl.cd - dt); pl.anim = Math.max(0, pl.anim - dt); pl.hit = Math.max(0, pl.hit - dt);
    pl.combat = Math.max(0, (pl.combat || 0) - dt); pl.nomp = Math.max(0, pl.nomp - dt);
    pl.buffDef = Math.max(0, pl.buffDef - dt); pl.haste = Math.max(0, pl.haste - dt);
    for (let i = 0; i < 3; i++) pl.skcd[i] = Math.max(0, pl.skcd[i] - dt);
    for (const ac of it.acts) applyAct(ac);
    if (!pl.dead) {
      if (pl.combat <= 0 && P.hp < maxHp()) P.hp = Math.min(maxHp(), P.hp + maxHp() * 0.02 * dt);
      const rg = (C().reg + (P.cls === "mag" ? P.lvl * 0.12 : 0)) * (pl.combat > 0 ? 1 : 2.2);
      if (P.mp < maxMp()) P.mp = Math.min(maxMp(), P.mp + rg * dt);
    }
    if (pl.dead > 0) {
      pl.dead -= dt;
      if (pl.dead <= 0) { pl.dead = 0; P.hp = maxHp(); P.mp = maxMp(); changeArea(pl.resp[0], pl.resp[1], pl.resp[2]); }
      return;
    }
    if (pl.mt < 1) {
      const nm = pl.mt + dt * 5; pl.carry = nm > 1 ? Math.min(0.5, nm - 1) : 0;
      pl.mt = Math.min(1, nm); pl.phase += dt * 14;
      if (pl.mt >= 1) onArrive();
      if (pl.mt < 1 || trans) return;
    }
    if (dlg || trans) return;
    if (pl.target && (pl.target.dead || cheb(pl.target.x, pl.target.y, P.x, P.y) > 14)) { pl.target = null; pl.auto = false; }
    if (pl.auto && pl.target && pl.cd <= 0 && inRange(pl.target, C().rng)) { face(pl, pl.target.x - P.x, pl.target.y - P.y); playerAttack(pl.target); }
    if (it.mx || it.my) { moveIntent(it.mx, it.my); if (pl.mt === 0) pl.mt = pl.carry || 0; }
    pl.carry = 0;
  }
  function mobShoot(m: any): void {
    const p = rpos(m);
    shots.push({ area: P.area, x: p[0] + 16, y: p[1] + 10, pl: true, src: m, d: m.d.atk, col: m.d.pc || "#c8ff7a", sp: 250, life: 3, ang: 0, kind: "mob" });
  }
  function updateMobs(dt: number): void {
    const a = A();
    for (const m of mobs[P.area]) {
      m.hit = Math.max(0, m.hit - dt); m.anim = Math.max(0, m.anim - dt);
      if (m.dead) {
        m.rt -= dt;
        if (m.rt <= 0 && cheb(m.hx, m.hy, P.x, P.y) > 5 && !mobAt(m.hx, m.hy)) {
          m.dead = false; m.hp = m.d.hp; m.x = m.fx = m.hx; m.y = m.fy = m.hy; m.mt = 1; m.aggro = false; m.frz = 0; m.sl = m.d.slam || 0;
        }
        continue;
      }
      if (m.mt < 1) { m.mt = Math.min(1, m.mt + dt * m.d.spd * (m.frz > 0 ? 0.3 : 1)); continue; }
      if (m.frz > 0) { m.frz -= dt; continue; }
      m.cd = Math.max(0, m.cd - dt);
      const dist = cheb(m.x, m.y, P.x, P.y);
      const home = cheb(m.x, m.y, m.hx, m.hy);
      if (pl.dead) m.aggro = false;
      if (!m.aggro && !pl.dead && m.d.aggro > 0 && dist <= m.d.aggro && P.lvl < m.d.lvl + 6) m.aggro = true;
      if (m.aggro && (home > (m.d.boss ? 8 : 11) || dist > 12)) { m.aggro = false; m.hp = Math.min(m.d.hp, m.hp + m.d.hp * 0.5); if (pl.target === m) pl.target = null; }
      const step = (dx: number, dy: number): boolean => {
        if (!dx && !dy) return false;
        const nx = m.x + dx, ny = m.y + dy;
        if (blocked(nx, ny, m)) return false;
        if (a.exits.some((e: Exit) => e.x === nx && e.y === ny)) return false;
        face(m, dx, dy); m.fx = m.x; m.fy = m.y; m.x = nx; m.y = ny; m.mt = 0; return true;
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
          if (m.cd <= 0) { m.cd = m.d.cd; m.anim = 0.2; if (dist <= 1) hurtPlayer(m, m.d.atk, 1); else mobShoot(m); }
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
  function updateShots(dt: number): void {
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i]; s.life -= dt;
      if (s.area !== P.area || s.life <= 0 || (s.pl && pl.dead)) { shots.splice(i, 1); continue; }
      let tx = 0, ty = 0;
      if (s.pl) { const p = rpos(pl2()); tx = p[0] + 16; ty = p[1] + 14; }
      else { if (s.m.dead) { shots.splice(i, 1); continue; } const p = rpos(s.m); tx = p[0] + 16; ty = p[1] + 14; }
      const dx = tx - s.x, dy = ty - s.y, dist = Math.hypot(dx, dy);
      s.ang = Math.atan2(dy, dx);
      const stp = s.sp * dt;
      if (dist <= stp + 4) {
        shots.splice(i, 1);
        if (s.pl) hurtPlayer(s.src, s.d, 1);
        else {
          if (s.o.splash) { for (const o of mobs[P.area]) if (o !== s.m && !o.dead && cheb(o.x, o.y, s.m.x, s.m.y) <= 1) applyHit(o, Math.max(1, Math.round(s.d * s.o.splash)), false, { col: "#ffb347" }); burst(tx, ty, "#ff9a3c", 18, 90); }
          applyHit(s.m, s.d, s.crit, s.o);
        }
        continue;
      }
      s.x += dx / dist * stp; s.y += dy / dist * stp;
      if (s.kind !== "arrow" && s.kind !== "aim" && R() < 0.7) fx.push({ k: "p", x: s.x, y: s.y, vx: (R() - 0.5) * 20, vy: (R() - 0.5) * 20, c: s.kind === "fire" ? "#ffb347" : s.kind === "bolt" ? "#bfa8ff" : s.col, life: 0.3, max: 0.6 });
    }
    for (let i = warns.length - 1; i >= 0; i--) {
      const w = warns[i]; w.t -= dt;
      if (w.area !== P.area) { warns.splice(i, 1); continue; }
      if (w.t <= 0) {
        warns.splice(i, 1);
        burst(w.x * TS + 16, w.y * TS + 16, "#ff6a4a", 30, 120);
        if (!pl.dead && cheb(P.x, P.y, w.x, w.y) <= w.r) hurtPlayer(w.m, w.d, 1.7);
      }
    }
    for (let i = pend.length - 1; i >= 0; i--) { pend[i].t -= dt; if (pend[i].t <= 0) { const f = pend[i].fn; pend.splice(i, 1); f(); } }
  }
  function update(dt: number): void {
    time += dt;
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i]; f.life -= dt;
      if (f.k === "p") { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 120 * dt; }
      if (f.k === "txt") f.y -= 28 * dt;
      if (f.life <= 0) fx.splice(i, 1);
    }
    if (!P.cls) return;
    banner = Math.max(0, banner - dt);
    if (resetArm > 0) resetArm -= dt;
    if (trans) {
      trans.t += dt;
      if (!trans.done && trans.t >= 0.25) {
        trans.done = true; P.area = trans.to; P.x = trans.tx; P.y = trans.ty; pl.fx = P.x; pl.fy = P.y; pl.mt = 1; pl.path = []; pl.target = null; pl.talk = null;
        const m = mobAt(P.x, P.y); if (m) { m.x = m.fx = m.hx; m.y = m.fy = m.hy; }
        const first = !P.seen[P.area]; P.seen[P.area] = 1;
        for (const k of Object.keys(AREAS)) if (k !== P.area) AREAS[k].img = null;
        shots.length = 0; warns.length = 0;
        banner = first ? 4.5 : 3; clickMark = null; panel = ""; dlg = null; guideT = 0; save();
        if (first) log("Odkryto nową krainę: " + A().name + "!", "#f5d98a");
      }
      if (trans.t >= 0.6) trans = null;
    }
    updatePlayer(dt, readIntent());
    if (!trans) { updateMobs(dt); updateShots(dt); }
    updateGuide(dt);
    for (let i = bags.length - 1; i >= 0; i--) { bags[i].life -= dt; if (bags[i].life <= 0 || bags[i].taken) bags.splice(i, 1); }
    for (const m of msgs) m.life -= dt;
    while (msgs.length && msgs[0].life <= 0) msgs.shift();
    if (time - lastSave > 8) { lastSave = time; save(); }
    if (!P.intro && !dlg) {
      P.intro = true;
      dlg = { name: "Ardan: Kroniki Mgieł", text: touchMode
        ? "Mgła spowiła Ardan. Chodzisz strzałkami w lewym dolnym rogu (przytrzymaj; dwie naraz – po skosie). Złota strzałka i kropki wskazują drogę do celu zadania. Dotknij potwora, by go wybrać, i bij przyciskiem ataku (musisz być w zasięgu). Z postacią porozmawiasz, stojąc obok niej i dotykając jej. Mapka powiększa się po dotknięciu."
        : "Mgła spowiła Ardan. Złota strzałka i kropki wskazują drogę do celu zadania. Sterowanie: WASD/strzałki – ruch, klik na potwora – wybór celu, Spacja/F – atak (w zasięgu), 1/2/3 – umiejętności, E – rozmowa (stojąc obok), I – torba, Q – zadania, T – zmiana zadania, M – mapa, H – mikstura, G – mana.",
        opts: [{ l: "Zaczynajmy!", fn: () => { dlg = null; save(); } }] };
    }
  }
