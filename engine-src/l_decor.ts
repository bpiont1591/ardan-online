  function drawDecor(d: any): void {
    const x = d.x * TS, y = d.y * TS, g = ctx;
    if (d.k === "fire") {
      g.fillStyle = "#5a3a1e"; g.fillRect(x + 6, y + 24, 20, 4); g.fillRect(x + 10, y + 21, 12, 4);
      g.fillStyle = "#7a7a7a"; for (let i = 0; i < 6; i++) g.fillRect(x + 4 + i * 4, y + 27, 3, 3);
      const fc = ["#ff6a1a", "#ffb02e", "#fff07a"];
      for (let i = 0; i < 3; i++) {
        const f = Math.sin(time * 9 + i * 2) * 3;
        g.fillStyle = fc[i];
        g.beginPath(); g.moveTo(x + 9 + i * 2, y + 24); g.lineTo(x + 16, y + 6 + i * 5 + f); g.lineTo(x + 23 - i * 2, y + 24); g.fill();
      }
      const grd = g.createRadialGradient(x + 16, y + 18, 2, x + 16, y + 18, 60);
      grd.addColorStop(0, "rgba(255,170,60,0.25)"); grd.addColorStop(1, "rgba(255,170,60,0)");
      g.fillStyle = grd; g.fillRect(x - 44, y - 42, 120, 120);
    } else if (d.k === "crate") {
      g.fillStyle = "#8a5a2b"; g.fillRect(x + 4, y + 8, 24, 22); g.fillStyle = "#5e3c1c"; g.fillRect(x + 4, y + 8, 24, 2); g.fillRect(x + 4, y + 18, 24, 2); g.fillRect(x + 4, y + 8, 2, 22); g.fillRect(x + 26, y + 8, 2, 22);
    } else if (d.k === "barrel") {
      g.fillStyle = "#7a4a24"; g.fillRect(x + 7, y + 6, 18, 24); g.fillStyle = "#4a4a50"; g.fillRect(x + 6, y + 10, 20, 2); g.fillRect(x + 6, y + 24, 20, 2); g.fillStyle = "#9a6a3a"; g.fillRect(x + 9, y + 6, 3, 24);
    } else if (d.k === "lamp") {
      g.fillStyle = "#3a2a1a"; g.fillRect(x + 14, y + 6, 3, 24); g.fillRect(x + 14, y + 6, 9, 2);
      const fl = 0.7 + Math.sin(time * 7 + d.x) * 0.15;
      g.fillStyle = "#ffd27a"; g.fillRect(x + 19, y + 8, 6, 7);
      const grd = g.createRadialGradient(x + 22, y + 12, 1, x + 22, y + 12, 46);
      grd.addColorStop(0, "rgba(255,200,110," + (0.35 * fl).toFixed(3) + ")"); grd.addColorStop(1, "rgba(255,200,110,0)");
      g.fillStyle = grd; g.fillRect(x - 24, y - 34, 92, 92);
    } else if (d.k === "banner") {
      g.fillStyle = "#4a3a2a"; g.fillRect(x + 14, y - 6, 3, 36);
      const w = Math.sin(time * 3 + d.x) * 2;
      g.fillStyle = "#2f58b0"; g.beginPath(); g.moveTo(x + 17, y - 4); g.lineTo(x + 30 + w, y - 2); g.lineTo(x + 28 + w, y + 14); g.lineTo(x + 17, y + 12); g.closePath(); g.fill();
      g.fillStyle = "#e8e8f0"; g.fillRect(x + 21 + w * 0.5, y + 2, 4, 4);
    } else if (d.k === "shrine") {
      g.fillStyle = "rgba(0,0,0,0.25)"; g.beginPath(); g.ellipse(x + 16, y + 28, 11, 4, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#8a8e98"; g.fillRect(x + 8, y + 10, 16, 19); g.fillStyle = "#a8acb6"; g.fillRect(x + 6, y + 7, 20, 4);
      g.fillStyle = "#5a5e68"; g.fillRect(x + 13, y + 14, 6, 8);
      const fl = 0.6 + Math.sin(time * 8) * 0.2;
      g.fillStyle = "#fff0a0"; g.fillRect(x + 15, y + 15, 2, 4);
      const grd = g.createRadialGradient(x + 16, y + 16, 1, x + 16, y + 16, 40);
      grd.addColorStop(0, "rgba(255,240,170," + (0.35 * fl).toFixed(3) + ")"); grd.addColorStop(1, "rgba(255,240,170,0)");
      g.fillStyle = grd; g.fillRect(x - 24, y - 24, 80, 80);
    } else if (d.k === "tent") {
      g.fillStyle = "rgba(0,0,0,0.25)"; g.beginPath(); g.ellipse(x + 16, y + 29, 16, 4, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#b8483a"; g.beginPath(); g.moveTo(x - 2, y + 30); g.lineTo(x + 16, y - 2); g.lineTo(x + 34, y + 30); g.closePath(); g.fill();
      g.fillStyle = "#e8d8b0"; g.beginPath(); g.moveTo(x + 6, y + 30); g.lineTo(x + 16, y + 6); g.lineTo(x + 26, y + 30); g.closePath(); g.fill();
      g.fillStyle = "#3a2418"; g.beginPath(); g.moveTo(x + 12, y + 30); g.lineTo(x + 16, y + 16); g.lineTo(x + 20, y + 30); g.closePath(); g.fill();
    }
  }
