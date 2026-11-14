      case MUD: mudT(g, px, py, h); break;
      case SNOW: snowT(g, px, py, h); break;
      case DUNE: sandT(g, px, py, h, true); break;
      case COBBLE: cobT(g, px, py, h); break;
      case BOG: {
        g.fillStyle = "#33493a"; g.fillRect(px, py, TS, TS);
        for (let i = 0; i < 4; i++) { g.fillStyle = h() < 0.5 ? "#4b6a3e" : "#2a3e30"; g.beginPath(); g.ellipse(px + 4 + h() * 24, py + 4 + h() * 24, 3 + h() * 3, 2, 0, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = "#6b6a44";
        const land = (v: number): boolean => v !== BOG && v !== BRIDGE && v !== -1 && v !== WATER;
        if (land(nb(0, -1))) g.fillRect(px, py, TS, 2);
        if (land(nb(0, 1))) g.fillRect(px, py + TS - 2, TS, 2);
        if (land(nb(-1, 0))) g.fillRect(px, py, 2, TS);
        if (land(nb(1, 0))) g.fillRect(px + TS - 2, py, 2, TS);
        break;
      }
      case REED: {
        mudT(g, px, py, h);
        for (let i = 0; i < 6; i++) {
          const rx = px + 3 + Math.floor(h() * 26), ry = py + 8 + Math.floor(h() * 12), hh = 10 + Math.floor(h() * 8);
          g.fillStyle = "#7d8a3e"; g.fillRect(rx, ry, 1, hh);
          if (h() < 0.5) { g.fillStyle = "#5a3a1e"; g.fillRect(rx - 1, ry - 1, 3, 5); }
        }
        break;
      }
      case DEADT: {
        baseOf(g, a, px, py, h);
        g.fillStyle = "rgba(0,0,0,0.28)"; g.beginPath(); g.ellipse(px + 16, py + 28, 10, 3, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = "#3b332a"; g.lineWidth = 4; g.beginPath(); g.moveTo(px + 16, py + 29); g.lineTo(px + 15, py + 10); g.stroke();
        g.lineWidth = 2; g.beginPath(); g.moveTo(px + 15, py + 16); g.lineTo(px + 6, py + 7); g.moveTo(px + 15, py + 13); g.lineTo(px + 25, py + 5); g.moveTo(px + 15, py + 10); g.lineTo(px + 13, py + 2); g.moveTo(px + 9, py + 10); g.lineTo(px + 5, py + 11); g.stroke();
        if (h() < 0.4) { g.fillStyle = "#56683a"; g.fillRect(px + 19, py + 8, 2, 7); g.fillRect(px + 7, py + 8, 2, 5); }
        break;
      }
      case SWALL: {
        g.fillStyle = "#4f4c59"; g.fillRect(px, py, TS, TS);
        g.fillStyle = "#5e5b69";
        for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) g.fillRect(px + c * 11 + (r % 2) * 5, py + r * 8 + 1, 9, 6);
        if (nb(0, 1) !== SWALL) { g.fillStyle = "#6e6b7a"; g.fillRect(px, py + 20, TS, 12); g.fillStyle = "#3d3a46"; g.fillRect(px, py + 20, TS, 2); for (let i = 0; i < TS; i += 8) g.fillRect(px + i, py + 22, 1, 10); }
        if (nb(0, -1) !== SWALL) { g.fillStyle = "#3a3744"; for (let i = 0; i < TS; i += 10) g.fillRect(px + i, py, 5, 4); }
        break;
      }
      case FOUNT: {
        cobT(g, px, py, h);
        const f = (v: number): boolean => v === FOUNT;
        g.fillStyle = "#c2bdcc"; g.fillRect(px, py, TS, TS);
        g.fillStyle = "#4f9ad8";
        const x0 = f(nb(-1, 0)) ? 0 : 5, x1 = f(nb(1, 0)) ? TS : TS - 5, y0 = f(nb(0, -1)) ? 0 : 5, y1 = f(nb(0, 1)) ? TS : TS - 5;
        g.fillRect(px + x0, py + y0, x1 - x0, y1 - y0);
        g.fillStyle = "#7fc0ee"; g.fillRect(px + x0 + 3, py + y0 + 4, 8, 2);
        if (!f(nb(1, 0)) && !f(nb(0, 1))) { g.fillStyle = "#a9a4b4"; g.fillRect(px - 6, py - 6, 12, 12); }
        break;
      }
      case ICE: {
        g.fillStyle = "#b5def2"; g.fillRect(px, py, TS, TS);
        g.strokeStyle = "rgba(255,255,255,0.7)"; g.lineWidth = 1; g.beginPath(); const sx = px + h() * 20, sy = py + h() * 20; g.moveTo(sx, sy); g.lineTo(sx + 8, sy + 5); g.lineTo(sx + 12, sy + 2); g.stroke();
        g.fillStyle = "rgba(255,255,255,0.5)"; g.fillRect(px + 6 + h() * 16, py + 6 + h() * 16, 5, 2);
        break;
      }
      case SPINE: {
        baseOf(g, a, px, py, h);
        const ox = Math.floor(h() * 5) - 2;
        g.fillStyle = "rgba(0,0,0,0.2)"; g.beginPath(); g.ellipse(px + 16, py + 28, 11, 4, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#5a3a22"; g.fillRect(px + 14 + ox, py + 22, 4, 8);
        const L: [string, number, number][] = [["#1e4a3a", 14, 17], ["#26594a", 11, 10], ["#2f6a58", 7, 4]];
        for (const l of L) {
          g.fillStyle = l[0]; g.beginPath(); g.moveTo(px + 16 + ox, py + l[2] - 4); g.lineTo(px + 16 + ox - l[1], py + l[2] + 10); g.lineTo(px + 16 + ox + l[1], py + l[2] + 10); g.closePath(); g.fill();
          g.fillStyle = "#f2f7fc"; g.beginPath(); g.moveTo(px + 16 + ox, py + l[2] - 4); g.lineTo(px + 16 + ox - l[1] * 0.55, py + l[2] + 3); g.lineTo(px + 16 + ox + l[1] * 0.55, py + l[2] + 3); g.closePath(); g.fill();
        }
        break;
      }
      case CLIFF: {
        baseOf(g, a, px, py, h);
        const snow = a.base === SNOW, sand = a.base === SAND;
        const c1 = snow ? "#6f7480" : sand ? "#a86f40" : "#6e6e74", c2 = snow ? "#8d929e" : sand ? "#c58a54" : "#8a8a90", c3 = snow ? "#565a66" : sand ? "#875632" : "#55555c";
        g.fillStyle = c3; g.fillRect(px + 1, py + 8, 30, 24);
        g.fillStyle = c1; g.beginPath(); g.moveTo(px, py + 30); g.lineTo(px + 3, py + 6 + h() * 4); g.lineTo(px + 12, py + 2); g.lineTo(px + 22, py + 4 + h() * 3); g.lineTo(px + 31, py + 10); g.lineTo(px + 32, py + 30); g.closePath(); g.fill();
        g.fillStyle = c2; g.beginPath(); g.moveTo(px + 5, py + 12); g.lineTo(px + 12, py + 5); g.lineTo(px + 18, py + 8); g.lineTo(px + 10, py + 16); g.closePath(); g.fill();
        if (snow) { g.fillStyle = "#f4f8fc"; g.beginPath(); g.moveTo(px + 3, py + 8); g.lineTo(px + 12, py + 2); g.lineTo(px + 22, py + 4); g.lineTo(px + 29, py + 9); g.lineTo(px + 20, py + 8); g.lineTo(px + 12, py + 7); g.closePath(); g.fill(); }
        g.fillStyle = "rgba(0,0,0,0.18)"; g.fillRect(px, py + 26, TS, 6);
        break;
      }
      case CACTUS: {
        sandT(g, px, py, h, false);
        g.fillStyle = "rgba(0,0,0,0.2)"; g.beginPath(); g.ellipse(px + 16, py + 28, 8, 3, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#3f7a34"; g.fillRect(px + 13, py + 6, 7, 22); g.fillRect(px + 6, py + 12, 4, 9); g.fillRect(px + 6, py + 19, 8, 3); g.fillRect(px + 23, py + 9, 4, 8); g.fillRect(px + 19, py + 15, 8, 3);
        g.fillStyle = "#58a048"; g.fillRect(px + 14, py + 6, 2, 22); g.fillRect(px + 7, py + 12, 1, 8);
        if (h() < 0.5) { g.fillStyle = "#ff7aa8"; g.fillRect(px + 15, py + 4, 3, 3); }
        break;
      }
      case RUINW: {
        g.fillStyle = "#9a7448"; g.fillRect(px, py, TS, TS);
        g.fillStyle = "#b48c5c";
        for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) g.fillRect(px + c * 11 + (r % 2) * 5, py + r * 8 + 1, 9, 6);
        if (nb(0, 1) !== RUINW) { g.fillStyle = "#c9a26e"; g.fillRect(px, py + 20, TS, 12); g.fillStyle = "#8a6438"; g.fillRect(px, py + 20, TS, 2); for (let i = 4; i < TS; i += 9) g.fillRect(px + i, py + 22, 1, 10); }
        if (h() < 0.3) { g.strokeStyle = "#6e4e2a"; g.lineWidth = 1; g.beginPath(); g.moveTo(px + 6, py + 4); g.lineTo(px + 11, py + 12); g.lineTo(px + 8, py + 18); g.stroke(); }
        break;
      }
      case RFLOOR: {
        g.fillStyle = "#c9ae84"; g.fillRect(px, py, TS, TS);
        g.fillStyle = "#b39a70"; g.fillRect(px, py + 15, TS, 1); g.fillRect(px + 15, py, 1, TS); g.fillRect(px, py, TS, 1); g.fillRect(px, py, 1, TS);
        if (h() < 0.12) { g.strokeStyle = "#8c7048"; g.lineWidth = 1; g.beginPath(); g.moveTo(px + 4, py + 6); g.lineTo(px + 12, py + 11); g.stroke(); }
        if (h() < 0.06) { g.fillStyle = "#a8803e"; g.fillRect(px + 20, py + 20, 6, 6); g.fillStyle = "#c9ae84"; g.fillRect(px + 22, py + 22, 2, 2); }
        break;
      }
      case PILLAR: {
        if (a.base === SAND && nb(0, 0) === PILLAR && !(x > 29 && x < 47 && y > 13 && y < 33)) sandT(g, px, py, h, false); else { g.fillStyle = "#c9ae84"; g.fillRect(px, py, TS, TS); }
        g.fillStyle = "rgba(0,0,0,0.25)"; g.beginPath(); g.ellipse(px + 16, py + 28, 11, 4, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#d8c69a"; g.fillRect(px + 9, py + 2, 14, 26);
        g.fillStyle = "#efe2bc"; g.fillRect(px + 11, py + 2, 3, 26);
        g.fillStyle = "#b8a476"; g.fillRect(px + 7, py, 18, 4); g.fillRect(px + 7, py + 25, 18, 4); g.fillRect(px + 19, py + 4, 2, 21);
        break;
      }
