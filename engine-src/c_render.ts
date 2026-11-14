  function renderArea(a: Area): void {
    const c = document.createElement("canvas"); c.width = a.w * TS; c.height = a.h * TS;
    const g = c.getContext("2d") as CanvasRenderingContext2D;
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) drawTile(g, a, x, y);
    a.img = c;
  }
  function renderMini(a: Area): void {
    const m = document.createElement("canvas"); m.width = a.w * 3; m.height = a.h * 3;
    const mg = m.getContext("2d") as CanvasRenderingContext2D;
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
      const t = gt(a, x, y);
      mg.fillStyle = MINI[t] || "#000"; mg.fillRect(x * 3, y * 3, 3, 3);
      if (TALL[t] && ((x + y) & 1)) { mg.fillStyle = "rgba(0,0,0,0.22)"; mg.fillRect(x * 3 + 1, y * 3 + 1, 1, 1); }
      else if (!BLOCK[t] && t !== PATH && t !== COBBLE && ((x * 7 + y * 3) % 5 === 0)) { mg.fillStyle = "rgba(255,255,255,0.08)"; mg.fillRect(x * 3, y * 3, 1, 1); }
    }
    a.mini = m;
  }
