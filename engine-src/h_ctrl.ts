  function nearestMob(r: number): any {
    let best: any = null, bd = 1e9;
    for (const m of mobs[P.area]) {
      if (m.dead) continue;
      const d = Math.abs(m.x - P.x) + Math.abs(m.y - P.y) * 1.01;
      if (cheb(m.x, m.y, P.x, P.y) <= r && d < bd) { bd = d; best = m; }
    }
    return best;
  }
  let farT = 0;
  function tooFar(t: string): void { if (time - farT > 1.2) { farT = time; log(t, "#a89c86"); } }
  // Attack never moves the player: it hits the selected target if it is in range.
  function attackKey(): void {
    if (pl.dead || dlg || !P.cls) return;
    const r = C().rng;
    if (!pl.target || pl.target.dead) {
      const m = skillTarget(r);
      if (m) pl.target = m;
      else { const far = nearestMob(8); if (far) { pl.target = far; tooFar("Cel wybrany – podejdź bliżej, by zaatakować."); } else log("W pobliżu nie ma przeciwników.", "#a89c86"); return; }
    }
    pl.auto = true;
    if (inRange(pl.target, r)) { if (pl.cd <= 0) playerAttack(pl.target); }
    else tooFar(r > 1 ? "Cel poza zasięgiem lub zasłonięty – podejdź bliżej." : "Cel za daleko – podejdź bliżej.");
  }
  function selectMob(m: any): void {
    if (!m || m.dead) return;
    if (pl.target !== m) pl.auto = false;
    pl.target = m;
  }
  function talkKey(): void {
    if (dlg) { if (dlg.opts.length === 1) dlg.opts[0].fn(); return; }
    if (!P.cls) return;
    for (const k of Object.keys(NPCS)) { const n = NPCS[k]; if (n.area === P.area && cheb(n.x, n.y, P.x, P.y) <= 1) { face(pl, n.x - P.x, n.y - P.y); talk(k); return; } }
    for (const k of Object.keys(NPCS)) { const n = NPCS[k]; if (n.area === P.area && cheb(n.x, n.y, P.x, P.y) <= 6) { tooFar("Podejdź bliżej, by porozmawiać: " + n.n + "."); return; } }
  }
  function npcTap(id: string): void {
    const n = NPCS[id];
    if (cheb(n.x, n.y, P.x, P.y) <= 1) { face(pl, n.x - P.x, n.y - P.y); talk(id); }
    else tooFar("Podejdź bliżej, by porozmawiać: " + n.n + ".");
  }
  // ---- intent sampling (device layer) ----
  // d-pad cell under a point: arrows give one axis, the corners between two arrows give a diagonal
  function padCell(x: number, y: number): number[] {
    const rx = x - pad.cx, ry = y - pad.cy, h = pad.s / 2;
    return [rx > h ? 1 : rx < -h ? -1 : 0, ry > h ? 1 : ry < -h ? -1 : 0];
  }
  function padDir(): number[] | null {
    let dx = 0, dy = 0;
    for (const k of Object.keys(pad.ptr)) { const d = pad.ptr[Number(k)]; dx += d[0]; dy += d[1]; }
    dx = Math.max(-1, Math.min(1, dx)); dy = Math.max(-1, Math.min(1, dy));
    return dx || dy ? [dx, dy] : null;
  }
  function heldDir(): number[] | null {
    let dx = 0, dy = 0;
    if (keys["ArrowLeft"] || keys["a"]) dx -= 1; if (keys["ArrowRight"] || keys["d"]) dx += 1;
    if (keys["ArrowUp"] || keys["w"]) dy -= 1; if (keys["ArrowDown"] || keys["s"]) dy += 1;
    const j = padDir(); if (j) { dx = Math.max(-1, Math.min(1, dx + j[0])); dy = Math.max(-1, Math.min(1, dy + j[1])); }
    if (extDir) { dx = extDir[0]; dy = extDir[1]; }
    if (dx === 0 && dy === 0) return null;
    return [dx, dy];
  }
  function readIntent(): Intent {
    const d = heldDir();
    return { mx: d ? d[0] : 0, my: d ? d[1] : 0, acts: actQ.splice(0, actQ.length) };
  }
  // ---- simulation side: actions ----
  function applyAct(a: Act): void {
    if (a.a === "atk") attackKey();
    else if (a.a === "sk") useSkill(a.i || 0);
    else if (a.a === "pot") usePotion();
    else if (a.a === "mpot") useMana();
    else if (a.a === "talk") talkKey();
    else if (a.a === "npc" && a.id && NPCS[a.id] && NPCS[a.id].area === P.area) npcTap(a.id);
    else if (a.a === "target") { const m = a.area === P.area && a.i !== undefined ? mobs[P.area][a.i] : null; if (m) selectMob(m); }
    else if (a.a === "untarget") { pl.target = null; pl.auto = false; }
  }
  // Deterministic grid step: 8-way intent, diagonals alternate axes; slides along walls.
  function moveIntent(mx: number, my: number): void {
    if (mx && my) {
      const first = pl.ax ? 1 : 0;
      for (let k = 0; k < 2; k++) {
        const ax = (first + k) % 2;
        if (ax === 0 ? stepPlayer(mx, 0) : stepPlayer(0, my)) { pl.ax = ax === 0 ? 1 : 0; return; }
      }
      return;
    }
    stepPlayer(mx, my);
  }
