  function snowT(g: CanvasRenderingContext2D, px: number, py: number, h: () => number): void {
    g.fillStyle = "#e6edf6"; g.fillRect(px, py, TS, TS);
    for (let i = 0; i < 6; i++) { g.fillStyle = h() < 0.5 ? "#d5deeb" : "#f8fbff"; g.fillRect(px + Math.floor(h() * 29), py + Math.floor(h() * 29), 3, 2); }
    if (h() < 0.18) { g.fillStyle = "#c3cfe0"; g.fillRect(px + 2 + Math.floor(h() * 22), py + 4 + Math.floor(h() * 22), 7, 1); }
  }
  function mudT(g: CanvasRenderingContext2D, px: number, py: number, h: () => number): void {
    g.fillStyle = "#58553a"; g.fillRect(px, py, TS, TS);
    for (let i = 0; i < 7; i++) { g.fillStyle = h() < 0.5 ? "#666245" : "#4a4830"; g.fillRect(px + Math.floor(h() * 29), py + Math.floor(h() * 29), 3, 2); }
    if (h() < 0.2) { g.fillStyle = "#3c4836"; g.beginPath(); g.ellipse(px + 8 + h() * 16, py + 8 + h() * 16, 5, 3, 0, 0, Math.PI * 2); g.fill(); }
  }
  function sandT(g: CanvasRenderingContext2D, px: number, py: number, h: () => number, dune: boolean): void {
    g.fillStyle = dune ? "#d2ad68" : "#dec384"; g.fillRect(px, py, TS, TS);
    for (let i = 0; i < 7; i++) { g.fillStyle = h() < 0.5 ? (dune ? "#c49d5a" : "#d0b273") : (dune ? "#ddbb78" : "#e9d29a"); g.fillRect(px + Math.floor(h() * 30), py + Math.floor(h() * 30), 2, 2); }
    if (dune) { g.strokeStyle = "rgba(150,110,60,0.45)"; g.lineWidth = 1.5; g.beginPath(); const yy = py + 10 + h() * 12; g.moveTo(px + 2, yy); g.quadraticCurveTo(px + 16, yy - 6, px + 30, yy); g.stroke(); }
  }
  function cobT(g: CanvasRenderingContext2D, px: number, py: number, h: () => number): void {
    g.fillStyle = "#7a7682"; g.fillRect(px, py, TS, TS);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const ox = (r % 2) * 4, v = h();
      g.fillStyle = v < 0.33 ? "#9a96a3" : v < 0.66 ? "#a8a4b0" : "#8f8b98";
      g.fillRect(px + c * 8 + ox - (ox && c === 3 ? 0 : 0) + 1, py + r * 8 + 1, ox && c === 3 ? 3 : 6, 6);
      if (ox && c === 0) g.fillRect(px, py + r * 8 + 1, 3, 6);
    }
  }
  function baseOf(g: CanvasRenderingContext2D, a: Area, px: number, py: number, h: () => number): void {
    if (a.base === FLOOR) floorT(g, px, py, h);
    else if (a.base === SNOW) snowT(g, px, py, h);
    else if (a.base === MUD) mudT(g, px, py, h);
    else if (a.base === SAND) sandT(g, px, py, h, false);
    else if (a.base === COBBLE) cobT(g, px, py, h);
    else grass(g, px, py, h, a.base === DGRASS);
  }
