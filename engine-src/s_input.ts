  // Pointer input: UI buttons, the arrow d-pad, and target selection only.
  // Tapping the world never moves the player (movement comes from the d-pad / WASD / arrow keys).
  function onDown(e: PointerEvent): void {
    e.preventDefault();
    try { canvas.focus({ preventScroll: true }); } catch (er) { /* ignore */ }
    if (e.pointerType === "touch" || e.pointerType === "pen") touchMode = true; else if (e.pointerType === "mouse") touchMode = false;
    const p = pos(e);
    try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
    const b = hitUi(p[0], p[1]);
    if (b) {
      if (b.pad) { if (!panel && !dlg) pad.ptr[e.pointerId] = padCell(p[0], p[1]); return; }
      b.fn(); return;
    }
    if (!P.cls || panel || dlg) return;
    if (pl.dead || trans) return;
    const w = worldAt(p[0], p[1]);
    const tx = Math.floor(w[0] / TS), ty = Math.floor(w[1] / TS);
    const m = mobUnder(w);
    if (m) { act({ a: "target", area: P.area, i: mobs[P.area].indexOf(m) }); return; }
    const npc = npcAt(tx, ty) || npcAt(tx, ty + 1);
    if (npc) { act({ a: "npc", id: npc }); return; }
    act({ a: "untarget" });
  }
  function onMove(e: PointerEvent): void {
    const p = pos(e);
    if (pad.ptr[e.pointerId]) { pad.ptr[e.pointerId] = padCell(p[0], p[1]); return; }
    if (e.pointerType === "mouse") {
      mouse = { x: p[0], y: p[1] };
      const w = worldAt(p[0], p[1]); hover = null;
      const m = mobUnder(w); if (m) hover = { m, sx: p[0], sy: p[1], t: "" };
      const tx = Math.floor(w[0] / TS), ty = Math.floor(w[1] / TS);
      for (const ex of A().exits) if (ex.x === tx && ex.y === ty) hover = { sx: p[0], sy: p[1], t: "Przejście: " + AREAS[ex.to].name };
      canvas.style.cursor = hitUi(p[0], p[1]) && (panel || dlg || p[1] > H - 140 || p[1] < 120) ? "pointer" : hover && hover.m ? "crosshair" : "default";
    }
  }
  function onUp(e: PointerEvent): void { delete pad.ptr[e.pointerId]; }
