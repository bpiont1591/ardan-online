  // ---------- DRAW: ENTITIES ----------
  function drawWeapon(x: number, y: number, col: string, wk?: string, dir?: number): void {
    const g = ctx;
    if (wk === "bow") {
      const flip = dir === 1 ? -1 : 1;
      g.strokeStyle = col; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x + 2, y - 2); g.quadraticCurveTo(x + 2 + 7 * flip, y + 7, x + 2, y + 16); g.stroke();
      g.strokeStyle = "rgba(255,255,255,0.75)"; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 2, y - 2); g.lineTo(x + 2, y + 16); g.stroke();
      return;
    }
    if (wk === "staff") {
      g.fillStyle = "#6b4a2b"; g.fillRect(x + 1, y - 4, 3, 22);
      g.fillStyle = col; g.beginPath(); g.arc(x + 2.5, y - 5, 3.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(255,255,255," + (0.35 + 0.25 * Math.sin(time * 5)).toFixed(3) + ")"; g.beginPath(); g.arc(x + 2.5, y - 5, 6, 0, Math.PI * 2); g.fill();
      return;
    }
    g.fillStyle = col; g.fillRect(x + 1, y, 3, 13);
    g.fillStyle = "rgba(255,255,255,0.5)"; g.fillRect(x + 1, y, 1, 12);
    g.fillStyle = "#5a3a1e"; g.fillRect(x - 1, y + 12, 7, 2); g.fillRect(x + 1, y + 14, 3, 4);
  }
  function drawHuman(x: number, y: number, dir: number, walk: number, c: any, wcol: string | null, acol: string | null, flash: boolean, lunge: number, wk?: string): void {
    const g = ctx;
    if (lunge > 0) { const k = Math.sin((lunge / 0.18) * Math.PI) * 4; if (dir === 0) y += k; else if (dir === 3) y -= k; else if (dir === 1) x -= k; else x += k; }
    const bob = walk ? Math.abs(Math.sin(walk)) * 1.5 : 0;
    const leg = walk ? Math.sin(walk) * 2.5 : 0;
    g.fillStyle = "rgba(0,0,0,0.28)"; g.beginPath(); g.ellipse(x + 16, y + 29, 9, 3, 0, 0, Math.PI * 2); g.fill();
    y -= bob;
    g.fillStyle = "#3a2a20"; g.fillRect(x + 11, y + 22, 4, 7 + leg); g.fillRect(x + 17, y + 22, 4, 7 - leg);
    const body = acol || c.body;
    if (c.hood && dir !== 3) { g.fillStyle = "#2e5e2c"; g.fillRect(x + 22, y + 10, 3, 12); }
    if (wcol && dir === 3) drawWeapon(x + 24, y + 6, wcol, wk, dir);
    if (c.hood && dir === 3) { g.fillStyle = "#6b4a2b"; g.fillRect(x + 8, y + 12, 4, 10); g.fillStyle = "#e8e0d0"; g.fillRect(x + 8, y + 10, 1, 3); g.fillRect(x + 10, y + 10, 1, 3); }
    g.fillStyle = body; g.fillRect(x + 9, y + 13, 14, 10);
    if (c.long || c.robe) g.fillRect(x + 8, y + 20, 16, 7);
    if (c.robe) { g.fillStyle = "rgba(255,215,120,0.8)"; g.fillRect(x + 15, y + 13, 2, 14); }
    if (c.apron) { g.fillStyle = "#3a2a1a"; g.fillRect(x + 11, y + 15, 10, 10); }
    g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(x + 9, y + 21, 14, 2);
    g.fillStyle = body; g.fillRect(x + 6, y + 14, 3, 8); g.fillRect(x + 23, y + 14, 3, 8);
    g.fillStyle = c.skin; g.fillRect(x + 6, y + 21, 3, 2); g.fillRect(x + 23, y + 21, 3, 2);
    g.fillRect(x + 10, y + 3, 12, 11);
    g.fillStyle = c.hair;
    if (dir === 3) g.fillRect(x + 10, y + 2, 12, 11);
    else {
      g.fillRect(x + 10, y + 2, 12, 4);
      if (dir === 1) g.fillRect(x + 17, y + 2, 5, 9);
      if (dir === 2) g.fillRect(x + 10, y + 2, 5, 9);
      if (c.long) { g.fillRect(x + 9, y + 4, 3, 11); g.fillRect(x + 20, y + 4, 3, 11); }
    }
    if (c.helmet) { g.fillStyle = "#9aa2ab"; g.fillRect(x + 9, y + 1, 14, 5); g.fillStyle = "#c8ced5"; g.fillRect(x + 10, y + 1, 12, 1); if (c.crest) { g.fillStyle = c.crest; g.fillRect(x + 14, y - 3, 4, 5); } }
    if (c.hood) {
      g.fillStyle = "#2e5e2c";
      if (dir === 3) g.fillRect(x + 9, y + 1, 14, 13);
      else { g.fillRect(x + 9, y + 1, 14, 5); g.fillRect(x + 9, y + 4, 2, 9); g.fillRect(x + 21, y + 4, 2, 9); }
      g.fillStyle = "#c8403a"; g.fillRect(x + 21, y - 2, 2, 6);
    }
    if (c.wiz) {
      g.fillStyle = c.hat || "#3a2a7a"; g.fillRect(x + 7, y + 2, 18, 3);
      g.beginPath(); g.moveTo(x + 9, y + 3); g.lineTo(x + 23, y + 3); g.lineTo(x + 18 + Math.sin(time * 2) * 1.5, y - 11); g.closePath(); g.fill();
      g.fillStyle = "#ffd25a"; g.fillRect(x + 15, y - 3, 2, 2);
    }
    if (c.crown) { g.fillStyle = "#ffd25a"; g.fillRect(x + 10, y - 1, 12, 3); g.fillRect(x + 10, y - 4, 2, 3); g.fillRect(x + 15, y - 5, 2, 4); g.fillRect(x + 20, y - 4, 2, 3); }
    if (dir !== 3) {
      g.fillStyle = c.eye || "#1a1a1a";
      if (dir === 0) { g.fillRect(x + 13, y + 8, 2, 2); g.fillRect(x + 17, y + 8, 2, 2); }
      if (dir === 1) g.fillRect(x + 11, y + 8, 2, 2);
      if (dir === 2) g.fillRect(x + 19, y + 8, 2, 2);
      if (c.beard) { g.fillStyle = c.hair; g.fillRect(x + 11, y + 11, 10, 4); }
    }
    if (c.wrap) { g.fillStyle = "rgba(120,100,70,0.5)"; for (let i = 0; i < 4; i++) g.fillRect(x + 9, y + 5 + i * 5, 14, 1); }
    if (wcol && dir !== 3) drawWeapon(dir === 1 ? x + 3 : x + 24, y + 8, wcol, wk, dir);
    if (flash) { g.fillStyle = "rgba(255,80,60,0.45)"; g.fillRect(x + 6, y + 2, 20, 27); }
  }
