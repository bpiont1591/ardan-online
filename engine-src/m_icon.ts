  function drawIcon(id: string, x: number, y: number, s: number): void {
    const it = ITEMS[id], g = ctx, k = s / 32;
    if (!it) return;
    g.save(); g.translate(x, y); g.scale(k, k);
    const c = it.c;
    switch (it.ic) {
      case "sword": g.translate(16, 16); g.rotate(-Math.PI / 4); g.fillStyle = c; g.fillRect(-2, -14, 4, 20); g.fillStyle = "rgba(255,255,255,0.5)"; g.fillRect(-2, -14, 1, 19); g.fillStyle = "#6b4a2b"; g.fillRect(-6, 6, 12, 3); g.fillRect(-1.5, 9, 3, 6); break;
      case "club": g.translate(16, 16); g.rotate(-Math.PI / 4); g.fillStyle = c; g.fillRect(-3, -13, 7, 14); g.fillStyle = "#6b4a2b"; g.fillRect(-1.5, 1, 3, 13); break;
      case "axe": g.translate(16, 16); g.rotate(-Math.PI / 4); g.fillStyle = "#6b4a2b"; g.fillRect(-1.5, -12, 3, 26); g.fillStyle = c; g.beginPath(); g.moveTo(1, -12); g.lineTo(11, -15); g.lineTo(11, -1); g.lineTo(1, -4); g.fill(); break;
      case "bow": g.strokeStyle = c; g.lineWidth = 3; g.beginPath(); g.moveTo(8, 4); g.quadraticCurveTo(30, 16, 8, 28); g.stroke(); g.strokeStyle = "#f0f0f0"; g.lineWidth = 1; g.beginPath(); g.moveTo(8, 4); g.lineTo(8, 28); g.stroke(); g.fillStyle = "#c9d1d9"; g.fillRect(6, 15, 18, 2); g.beginPath(); g.moveTo(24, 13); g.lineTo(28, 16); g.lineTo(24, 19); g.fill(); break;
      case "staff": g.translate(16, 16); g.rotate(Math.PI / 5); g.fillStyle = "#6b4a2b"; g.fillRect(-1.5, -9, 3, 24); g.fillStyle = c; g.beginPath(); g.arc(0, -11, 5, 0, Math.PI * 2); g.fill(); g.fillStyle = "rgba(255,255,255,0.6)"; g.fillRect(-2, -14, 2, 2); break;
      case "shirt": case "armor": case "robe":
        g.fillStyle = c; g.fillRect(8, 8, 16, 18); g.fillRect(3, 8, 6, 10); g.fillRect(23, 8, 6, 10); g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(13, 8, 6, 4);
        if (it.ic === "armor") { g.fillStyle = "rgba(255,255,255,0.3)"; g.fillRect(10, 14, 12, 2); g.fillRect(10, 19, 12, 2); }
        if (it.ic === "robe") { g.fillStyle = c; g.fillRect(6, 24, 20, 5); g.fillStyle = "#ffd25a"; g.fillRect(15, 12, 2, 17); }
        break;
      case "pot": g.fillStyle = "#cfd8e0"; g.fillRect(13, 4, 6, 6); g.fillStyle = "#8a5a2b"; g.fillRect(13, 3, 6, 3); g.fillStyle = c; g.beginPath(); g.arc(16, 19, 9, 0, Math.PI * 2); g.fill(); g.fillStyle = "rgba(255,255,255,0.5)"; g.fillRect(11, 14, 3, 4); break;
      case "tail": g.strokeStyle = c; g.lineWidth = 3; g.beginPath(); g.moveTo(6, 24); g.quadraticCurveTo(16, 4, 26, 20); g.stroke(); break;
      case "pelt": g.fillStyle = c; g.beginPath(); g.moveTo(6, 8); g.lineTo(26, 8); g.lineTo(28, 26); g.lineTo(16, 22); g.lineTo(4, 26); g.closePath(); g.fill(); g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(10, 12, 12, 2); break;
      case "tusk": g.fillStyle = c; g.beginPath(); g.moveTo(8, 26); g.quadraticCurveTo(10, 6, 26, 6); g.quadraticCurveTo(14, 12, 13, 26); g.closePath(); g.fill(); break;
      case "ear": g.fillStyle = c; g.beginPath(); g.moveTo(8, 24); g.lineTo(26, 6); g.lineTo(20, 26); g.closePath(); g.fill(); break;
      case "silk": g.strokeStyle = c; g.lineWidth = 1.5; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(16, 16, 3 + i * 3.5, 0, Math.PI * 2); g.stroke(); } break;
      case "bone": g.translate(16, 16); g.rotate(-Math.PI / 4); g.fillStyle = c; g.fillRect(-2, -10, 4, 20); g.beginPath(); g.arc(-2.5, -11, 3, 0, 7); g.arc(2.5, -11, 3, 0, 7); g.fill(); g.beginPath(); g.arc(-2.5, 11, 3, 0, 7); g.arc(2.5, 11, 3, 0, 7); g.fill(); break;
      case "gem": g.fillStyle = c; g.beginPath(); g.moveTo(16, 4); g.lineTo(26, 14); g.lineTo(16, 28); g.lineTo(6, 14); g.closePath(); g.fill(); g.fillStyle = "rgba(255,255,255,0.6)"; g.fillRect(12, 10, 4, 4); break;
      case "drop": g.fillStyle = c; g.beginPath(); g.moveTo(16, 4); g.quadraticCurveTo(28, 20, 16, 28); g.quadraticCurveTo(4, 20, 16, 4); g.fill(); g.fillStyle = "rgba(255,255,255,0.4)"; g.fillRect(12, 16, 3, 5); break;
      case "orb": g.fillStyle = "rgba(200,255,120,0.35)"; g.beginPath(); g.arc(16, 16, 13, 0, 7); g.fill(); g.fillStyle = c; g.beginPath(); g.arc(16, 16, 8, 0, 7); g.fill(); g.fillStyle = "#fff"; g.beginPath(); g.arc(14, 14, 3, 0, 7); g.fill(); break;
      case "scarab": g.fillStyle = c; g.beginPath(); g.ellipse(16, 18, 8, 10, 0, 0, 7); g.fill(); g.fillStyle = "rgba(0,0,0,0.3)"; g.fillRect(15.5, 9, 1, 19); g.fillStyle = c; g.beginPath(); g.arc(16, 7, 4, 0, 7); g.fill(); g.fillRect(5, 14, 4, 2); g.fillRect(23, 14, 4, 2); g.fillRect(5, 21, 4, 2); g.fillRect(23, 21, 4, 2); break;
      case "relic": g.fillStyle = c; g.beginPath(); g.ellipse(16, 9, 5, 6, 0, 0, 7); g.lineWidth = 3; g.strokeStyle = c; g.stroke(); g.fillRect(14.5, 14, 3, 14); g.fillRect(8, 16, 16, 3); break;
      case "letter": g.fillStyle = c; g.fillRect(5, 8, 22, 16); g.strokeStyle = "#8a6238"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(5, 8); g.lineTo(16, 17); g.lineTo(27, 8); g.stroke(); g.fillStyle = "#c0392b"; g.beginPath(); g.arc(16, 17, 3, 0, 7); g.fill(); break;
    }
    g.restore();
  }
  function drawSkillIcon(ic: string, cx: number, cy: number, r: number): void {
    const g = ctx; g.save(); g.translate(cx, cy); const s = r / 16; g.scale(s, s); g.lineCap = "round";
    switch (ic) {
      case "smash": g.fillStyle = "#c9d1d9"; g.save(); g.rotate(-Math.PI / 4); g.fillRect(-2, -12, 4, 16); g.fillStyle = "#6b4a2b"; g.fillRect(-5, 4, 10, 3); g.fillRect(-1.5, 7, 3, 6); g.restore(); g.strokeStyle = "#ffb347"; g.lineWidth = 2; for (let i = 0; i < 5; i++) { const a = -1.9 + i * 0.5; g.beginPath(); g.moveTo(Math.cos(a) * 9, Math.sin(a) * 9 - 2); g.lineTo(Math.cos(a) * 13, Math.sin(a) * 13 - 2); g.stroke(); } break;
      case "whirl": g.strokeStyle = "#ffcf7a"; g.lineWidth = 2.5; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(0, 0, 4 + i * 3.5, i * 2, i * 2 + 4); g.stroke(); } break;
      case "shout": g.fillStyle = "#ffb347"; g.beginPath(); g.moveTo(-9, -3); g.lineTo(-2, -7); g.lineTo(-2, 7); g.lineTo(-9, 3); g.closePath(); g.fill(); g.strokeStyle = "#ffe0a0"; g.lineWidth = 2; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(-2, 0, 5 + i * 3.5, -0.8, 0.8); g.stroke(); } break;
      case "aim": g.strokeStyle = "#ffe08a"; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 9, 0, 7); g.stroke(); g.beginPath(); g.arc(0, 0, 4, 0, 7); g.stroke(); g.beginPath(); g.moveTo(-13, 0); g.lineTo(-6, 0); g.moveTo(13, 0); g.lineTo(6, 0); g.moveTo(0, -13); g.lineTo(0, -6); g.moveTo(0, 13); g.lineTo(0, 6); g.stroke(); break;
      case "rain": g.strokeStyle = "#e8e0c8"; g.lineWidth = 2; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(i * 6, -11 + Math.abs(i) * 3); g.lineTo(i * 6, 6 + Math.abs(i) * 3); g.stroke(); g.fillStyle = "#c9d1d9"; g.beginPath(); g.moveTo(i * 6 - 3, 5 + Math.abs(i) * 3); g.lineTo(i * 6 + 3, 5 + Math.abs(i) * 3); g.lineTo(i * 6, 10 + Math.abs(i) * 3); g.fill(); } break;
      case "eye": g.fillStyle = "#e8f8e0"; g.beginPath(); g.moveTo(-12, 0); g.quadraticCurveTo(0, -10, 12, 0); g.quadraticCurveTo(0, 10, -12, 0); g.fill(); g.fillStyle = "#3f9a3a"; g.beginPath(); g.arc(0, 0, 4.5, 0, 7); g.fill(); g.fillStyle = "#111"; g.beginPath(); g.arc(0, 0, 2, 0, 7); g.fill(); break;
      case "fire": g.fillStyle = "#ff6a1a"; g.beginPath(); g.moveTo(-8, 8); g.quadraticCurveTo(-10, -4, 0, -13); g.quadraticCurveTo(10, -4, 8, 8); g.closePath(); g.fill(); g.fillStyle = "#ffd25a"; g.beginPath(); g.moveTo(-4, 8); g.quadraticCurveTo(-5, -1, 0, -6); g.quadraticCurveTo(5, -1, 4, 8); g.closePath(); g.fill(); break;
      case "frost": g.strokeStyle = "#bff2ff"; g.lineWidth = 2; for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; g.beginPath(); g.moveTo(Math.cos(a) * -12, Math.sin(a) * -12); g.lineTo(Math.cos(a) * 12, Math.sin(a) * 12); g.stroke(); } g.beginPath(); g.arc(0, 0, 3, 0, 7); g.stroke(); break;
      case "heal": g.fillStyle = "#7dff8a"; g.fillRect(-3.5, -11, 7, 22); g.fillRect(-11, -3.5, 22, 7); g.fillStyle = "rgba(255,255,255,0.5)"; g.fillRect(-3.5, -11, 2, 22); break;
    }
    g.restore();
  }
