  function drawMob(m: any): void {
    const p = rpos(m); let x = p[0], y = p[1];
    const g = ctx; const k = m.k; const flash = m.hit > 0;
    const walk = m.mt < 1 ? time * 14 : 0;
    if (m.anim > 0) { const s = Math.sin((m.anim / 0.2) * Math.PI) * 4; const D = [[0, 1], [-1, 0], [1, 0], [0, -1]][m.dir]; x += D[0] * s; y += D[1] * s; }
    const sc = m.d.sc || 1;
    const bx0 = x, by0 = y;
    if (sc !== 1) { g.save(); g.translate(x + 16, y + 30); g.scale(sc, sc); g.translate(-16, -30); x = 0; y = 0; }
    const left = m.dir === 1;
    const fl = (rx: number, ry: number, w: number, h: number): void => { g.fillRect(left ? x + 32 - rx - w : x + rx, y + ry, w, h); };
    const shadow = (w: number): void => { g.fillStyle = "rgba(0,0,0,0.28)"; g.beginPath(); g.ellipse(x + 16, y + 28, w, 4, 0, 0, Math.PI * 2); g.fill(); };
    const leg = walk ? Math.sin(walk) * 2 : 0;
    const glow = (cx: number, cy: number, r: number, col: string): void => { const gr = g.createRadialGradient(cx, cy, 1, cx, cy, r); gr.addColorStop(0, col); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(cx - r, cy - r, r * 2, r * 2); };
    if (k === "goblin") drawHuman(x, y, m.dir, walk, { body: "#5a4a2a", skin: "#6aa84f", hair: "#3d5f2a", eye: "#ff3030" }, "#8a8f96", null, flash, 0);
    else if (k === "skel") { drawHuman(x, y, m.dir, walk, { body: "#d8d2c0", skin: "#ece6d4", hair: "#ece6d4", eye: "#ff4040" }, "#7a7f88", null, flash, 0); g.fillStyle = "#3a3640"; g.fillRect(x + 11, y + 15, 10, 1); g.fillRect(x + 11, y + 18, 10, 1); }
    else if (k === "drowner") { drawHuman(x, y, m.dir, walk, { body: "#3f5a4a", skin: "#7a9a80", hair: "#2a4a2a", eye: "#d0ff60", long: true }, null, null, flash, 0); g.fillStyle = "#4a7a3a"; g.fillRect(x + 10, y + 14, 2, 8); g.fillRect(x + 19, y + 16, 2, 7); }
    else if (k === "mummy") drawHuman(x, y, m.dir, walk, { body: "#d8cfae", skin: "#d8cfae", hair: "#cfc39e", eye: "#ffd84a", wrap: true }, null, null, flash, 0);
    else if (k === "witch") {
      glow(x + 16, y + 16, 30, "rgba(140,255,120,0.35)");
      drawHuman(x, y + Math.sin(time * 2) * 1.5, m.dir, 0, { body: "#2a3a2a", skin: "#9ab07a", hair: "#1a1a1a", eye: "#c8ff40", long: true, robe: true, wiz: true, hat: "#1a1a1a" }, "#9dff7a", null, flash, 0, "staff");
    } else if (k === "king") {
      glow(x + 16, y + 14, 34, "rgba(197,140,255,0.4)");
      drawHuman(x, y - 4 + Math.sin(time * 2.2) * 2, m.dir, 0, { body: "#2a1a3a", skin: "#b8aac8", hair: "#1a1022", eye: "#ff4fd8", robe: true, crown: true }, "#c58cff", null, flash, 0, "staff");
    } else {
      if (k !== "wisp" && k !== "ielem" && k !== "boss") shadow(k === "dragon" ? 15 : 11);
      if (k === "rat") {
        g.fillStyle = "#d89a9a"; fl(2, 22, 8, 2);
        g.fillStyle = "#8a7f73"; fl(8, 17, 14, 9); fl(20, 15, 7, 8);
        g.fillStyle = "#6e645a"; fl(19, 13, 3, 3); fl(10, 25, 3, 3 + leg); fl(18, 25, 3, 3 - leg);
        g.fillStyle = "#e05050"; fl(24, 17, 2, 2); g.fillStyle = "#f0b0b0"; fl(27, 19, 2, 2);
      } else if (k === "wolf" || k === "swolf") {
        const sn = k === "swolf";
        g.fillStyle = sn ? "#c8d0dc" : "#6d7076"; fl(2, 12, 6, 3);
        g.fillStyle = sn ? "#eef2f8" : "#8d8f94"; fl(6, 13, 18, 10); fl(21, 8, 9, 9);
        g.fillStyle = sn ? "#c8d0dc" : "#6d7076"; fl(22, 5, 3, 4); fl(27, 5, 3, 4); fl(8, 22, 3, 6 + leg); fl(19, 22, 3, 6 - leg); fl(12, 22, 3, 5 - leg);
        g.fillStyle = sn ? "#ffffff" : "#c8cacf"; fl(8, 19, 14, 3); g.fillStyle = sn ? "#6fd8ff" : "#ffd84a"; fl(26, 10, 2, 2); g.fillStyle = "#222"; fl(29, 13, 2, 2);
      } else if (k === "boar") {
        g.fillStyle = "#5b3b25"; fl(4, 12, 20, 13); fl(20, 13, 9, 10);
        g.fillStyle = "#3e2716"; fl(6, 10, 16, 3); fl(7, 24, 3, 4 + leg); fl(18, 24, 3, 4 - leg);
        g.fillStyle = "#c48a6a"; fl(27, 17, 4, 5); g.fillStyle = "#f1ead6"; fl(26, 21, 2, 4); fl(29, 21, 2, 4);
        g.fillStyle = "#111"; fl(24, 15, 2, 2);
      } else if (k === "spider" || k === "scorp") {
        if (k === "spider") {
          g.strokeStyle = "#1a1418"; g.lineWidth = 2;
          for (let i = 0; i < 4; i++) {
            const yy = y + 15 + i * 3, w2 = Math.sin(time * 10 + i) * (m.mt < 1 ? 2 : 0.5);
            g.beginPath(); g.moveTo(x + 12, yy); g.lineTo(x + 4, yy - 5 + w2); g.lineTo(x + 1, yy + 6); g.stroke();
            g.beginPath(); g.moveTo(x + 20, yy); g.lineTo(x + 28, yy - 5 - w2); g.lineTo(x + 31, yy + 6); g.stroke();
          }
          g.fillStyle = "#2a2028"; g.beginPath(); g.ellipse(x + 16, y + 20, 8, 7, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = "#3a2c38"; g.beginPath(); g.ellipse(x + 16, y + 12, 5, 4, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = "#c03030"; g.fillRect(x + 13, y + 20, 6, 2);
          g.fillStyle = "#ff3a3a"; g.fillRect(x + 13, y + 11, 2, 2); g.fillRect(x + 17, y + 11, 2, 2);
        } else {
          g.strokeStyle = "#7a4a1a"; g.lineWidth = 2;
          for (let i = 0; i < 3; i++) { const yy = y + 19 + i * 3, w2 = Math.sin(time * 12 + i) * (m.mt < 1 ? 2 : 0.4); g.beginPath(); g.moveTo(x + 11, yy); g.lineTo(x + 4, yy + 4 + w2); g.stroke(); g.beginPath(); g.moveTo(x + 21, yy); g.lineTo(x + 28, yy + 4 - w2); g.stroke(); }
          g.fillStyle = "#b8742a"; g.beginPath(); g.ellipse(x + 16, y + 21, 7, 6, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = "#d08a3a"; g.fillRect(x + 4, y + 12, 6, 5); g.fillRect(x + 22, y + 12, 6, 5); g.fillRect(x + 7, y + 15, 3, 5); g.fillRect(x + 22, y + 15, 3, 5);
          g.strokeStyle = "#c27a30"; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 16, y + 26); g.quadraticCurveTo(x + 30, y + 22, x + 22, y + 6 + Math.sin(time * 4) * 1.5); g.stroke();
          g.fillStyle = "#3a1a0a"; g.fillRect(x + 20, y + 3, 4, 4);
          g.fillStyle = "#111"; g.fillRect(x + 13, y + 17, 2, 2); g.fillRect(x + 17, y + 17, 2, 2);
        }
      } else if (k === "boss") {
        const yy = y - 10 + Math.sin(time * 2.5) * 3;
        glow(x + 16, yy + 18, 34, "rgba(197,140,255,0.45)");
        g.fillStyle = "rgba(120,90,170,0.9)";
        g.beginPath(); g.moveTo(x + 2, yy + 36);
        for (let i = 0; i <= 6; i++) g.lineTo(x + 2 + i * 4.67, yy + 36 + (i % 2 ? -5 : 0) + Math.sin(time * 6 + i) * 2);
        g.lineTo(x + 30, yy + 14); g.quadraticCurveTo(x + 16, yy - 8, x + 2, yy + 14); g.closePath(); g.fill();
        g.fillStyle = "rgba(60,40,90,0.95)"; g.beginPath(); g.ellipse(x + 16, yy + 13, 9, 9, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#7fe9ff"; g.fillRect(x + 11, yy + 11, 3, 3); g.fillRect(x + 18, yy + 11, 3, 3);
        g.fillStyle = "rgba(200,170,255,0.8)"; g.fillRect(x - 2, yy + 18, 5, 3); g.fillRect(x + 29, yy + 18, 5, 3);
      } else if (k === "wisp") {
        const yy = y + 10 + Math.sin(time * 3 + m.hx) * 4, fl2 = 0.7 + Math.sin(time * 13 + m.hy) * 0.2;
        glow(x + 16, yy, 22, "rgba(200,255,120," + (0.5 * fl2).toFixed(3) + ")");
        g.fillStyle = "#e8ffb0"; g.beginPath(); g.arc(x + 16, yy, 5 + fl2 * 2, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#ffffff"; g.beginPath(); g.arc(x + 15, yy - 1, 2.5, 0, Math.PI * 2); g.fill();
        g.fillStyle = "rgba(0,0,0,0.18)"; g.beginPath(); g.ellipse(x + 16, y + 28, 6, 2, 0, 0, Math.PI * 2); g.fill();
      } else if (k === "troll" || k === "yeti") {
        const ye = k === "yeti";
        const c1 = ye ? "#e8eef4" : "#5a6a3a", c2 = ye ? "#c8d4e0" : "#46552c", fc = ye ? "#6a7a8a" : "#7a8a4a";
        g.fillStyle = c2; fl(6, 22, 6, 7 + leg); fl(20, 22, 6, 7 - leg);
        g.fillStyle = c1; g.beginPath(); g.ellipse(x + 16, y + 17, 12, 10, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = c2; fl(2, 13, 6, 14); fl(24, 13, 6, 14);
        g.fillStyle = fc; g.beginPath(); g.ellipse(x + (left ? 13 : 19), y + 9, 7, 6, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = ye ? "#1a3a5a" : "#ffd84a"; fl(19, 7, 2, 2); fl(23, 7, 2, 2);
        if (!ye) { g.fillStyle = "#f1ead6"; fl(19, 12, 2, 3); fl(24, 12, 2, 3); }
      } else if (k === "ielem") {
        const yy = y + Math.sin(time * 2 + m.hx) * 3;
        glow(x + 16, yy + 14, 24, "rgba(160,230,255,0.4)");
        g.save(); g.translate(x + 16, yy + 14); g.rotate(Math.sin(time) * 0.2);
        const sh: number[][] = [[0, -14, 5], [-8, -2, 4], [8, -3, 4], [-3, 8, 4], [5, 7, 3]];
        for (const s of sh) { g.fillStyle = "#8fd8f5"; g.beginPath(); g.moveTo(s[0], s[1] - s[2] * 1.6); g.lineTo(s[0] + s[2], s[1]); g.lineTo(s[0], s[1] + s[2] * 1.6); g.lineTo(s[0] - s[2], s[1]); g.closePath(); g.fill(); g.fillStyle = "rgba(255,255,255,0.7)"; g.fillRect(s[0] - 1, s[1] - s[2], 1.5, s[2]); }
        g.fillStyle = "#1a5a8a"; g.fillRect(-4, -4, 2, 2); g.fillRect(2, -4, 2, 2);
        g.restore();
        g.fillStyle = "rgba(0,0,0,0.15)"; g.beginPath(); g.ellipse(x + 16, y + 29, 8, 2, 0, 0, Math.PI * 2); g.fill();
      } else if (k === "golem") {
        g.fillStyle = "#7a6a4a"; fl(8, 22, 6, 7 + leg); fl(18, 22, 6, 7 - leg);
        g.fillStyle = "#9a8a6a"; fl(5, 10, 22, 14); g.fillStyle = "#867656"; fl(1, 11, 5, 13); fl(26, 11, 5, 13);
        g.fillStyle = "#a89878"; fl(10, 2, 12, 9);
        const gl2 = 0.6 + 0.4 * Math.sin(time * 3);
        g.fillStyle = "rgba(90,230,255," + gl2.toFixed(3) + ")"; fl(12, 5, 3, 2); fl(17, 5, 3, 2); fl(14, 14, 4, 1); fl(15, 14, 1, 7);
      } else if (k === "dragon") {
        const fl3 = Math.sin(time * 5) * 6;
        g.fillStyle = "#5a92c0";
        g.beginPath(); g.moveTo(x + 10, y + 12); g.lineTo(x - 14, y - 4 + fl3); g.lineTo(x - 6, y + 16); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(x + 22, y + 12); g.lineTo(x + 46, y - 4 + fl3); g.lineTo(x + 38, y + 16); g.closePath(); g.fill();
        g.fillStyle = "#7fb8e0"; g.beginPath(); g.ellipse(x + 16, y + 18, 11, 9, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = "#7fb8e0"; g.lineWidth = 5; g.beginPath(); g.moveTo(x + 16, y + 24); g.quadraticCurveTo(x + (left ? 34 : -2), y + 30, x + (left ? 36 : -4), y + 20); g.stroke();
        g.fillStyle = "#a8d8f5"; g.fillRect(x + 11, y + 16, 10, 8);
        g.fillStyle = "#6aa4d0"; g.beginPath(); g.ellipse(x + (left ? 10 : 22), y + 7, 7, 5, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#e8f6ff"; fl(22, 0, 2, 4); fl(27, 1, 2, 4);
        g.fillStyle = "#ffffff"; fl(24, 5, 2, 2); g.fillStyle = "#1a4a7a"; fl(25, 6, 1, 1);
        if (m.anim > 0) { g.fillStyle = "rgba(200,240,255,0.6)"; fl(29, 6, 8, 3); }
      }
      if (flash) { g.fillStyle = "rgba(255,255,255,0.45)"; g.fillRect(x + 2, y + 6, 28, 22); }
    }
    if (m.frz > 0) { g.fillStyle = "rgba(150,220,255,0.38)"; g.fillRect(x + 4, y + 2, 24, 27); g.strokeStyle = "rgba(220,250,255,0.9)"; g.lineWidth = 1; g.strokeRect(x + 4.5, y + 2.5, 23, 26); }
    if (sc !== 1) { g.restore(); x = bx0; y = by0; }
    const tgt = pl.target === m, hv = hover && hover.m === m;
    const top = y - (sc - 1) * 30;
    if (m.hp < m.d.hp || tgt || m.d.boss) {
      const bw = m.d.boss ? 44 : 26, bx = x + 16 - bw / 2, by = top - (m.d.boss ? 18 : 6);
      g.fillStyle = "rgba(0,0,0,0.6)"; g.fillRect(bx - 1, by - 1, bw + 2, 5);
      g.fillStyle = "#d83a2e"; g.fillRect(bx, by, bw * Math.max(0, m.hp / m.d.hp), 3);
    }
    if (tgt || hv || m.d.boss) label(x + 16, top - (m.d.boss ? 22 : 10), m.d.n + " (" + m.d.lvl + ")", m.d.lvl > P.lvl + 2 ? "#ff8a7a" : m.d.lvl < P.lvl - 3 ? "#a8a8a8" : "#ffe9a8");
    if (tgt) { g.strokeStyle = "rgba(255,80,60,0.85)"; g.lineWidth = 1.5; g.beginPath(); g.ellipse(x + 16, y + 28, 13 * sc, 5 * sc, 0, 0, Math.PI * 2); g.stroke(); }
  }
