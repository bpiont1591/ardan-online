# Round 8: clearly visible fire wisp / ice elemental sprites, no healing in combat, potions from alchemists.
s = open('engine.ts').read()
def ed(a, b, cnt=1):
    global s
    n = s.count(a)
    assert n == cnt, (a[:90], n)
    s = s.replace(a, b)

# --- fire wisp ("Błędny ognik"): solid flame body with a dark outline, hot core, eyes, warm glow (readable on the green swamp)
i0 = s.index('      } else if (k === "wisp") {')
i1 = s.index('      } else if (k === "troll" || k === "yeti") {')
s = s[:i0] + '''      } else if (k === "wisp") {
        const bob = Math.sin(time * 3 + m.hx) * 3, yy = y + 13 + bob, fl2 = 0.75 + Math.sin(time * 13 + m.hy) * 0.25;
        // light pool on the ground + outer glow
        g.fillStyle = "rgba(255,150,40,0.28)"; g.beginPath(); g.ellipse(x + 16, y + 28, 11, 3.5, 0, 0, Math.PI * 2); g.fill();
        glow(x + 16, yy, 26, "rgba(255,140,30," + (0.55 * fl2).toFixed(3) + ")");
        const flame = (sc2: number, ph: number): void => {
          const t1 = Math.sin(time * 9 + ph) * 2.2, t2 = Math.sin(time * 11 + ph + 2) * 2.2, t3 = Math.sin(time * 7 + ph + 4) * 1.6;
          g.beginPath(); g.moveTo(x + 16, yy + 9 * sc2);
          g.bezierCurveTo(x + 16 + 11 * sc2, yy + 9 * sc2, x + 16 + 11 * sc2, yy - 2 * sc2, x + 16 + 6 * sc2 + t2, yy - 8 * sc2);
          g.quadraticCurveTo(x + 16 + 4 * sc2, yy - 3 * sc2, x + 16 + 2 * sc2 + t1, yy - 15 * sc2);
          g.quadraticCurveTo(x + 16 - 2 * sc2, yy - 5 * sc2, x + 16 - 6 * sc2 + t3, yy - 10 * sc2);
          g.bezierCurveTo(x + 16 - 11 * sc2, yy - 2 * sc2, x + 16 - 11 * sc2, yy + 9 * sc2, x + 16, yy + 9 * sc2);
          g.closePath();
        };
        flame(1.08, 0); g.fillStyle = "#3a0e04"; g.fill();                     // dark outline
        flame(1, 0); g.fillStyle = flash ? "#ffffff" : "#e8401a"; g.fill();     // red body
        flame(0.74, 1.3); g.fillStyle = flash ? "#ffffff" : "#ff9a1e"; g.fill(); // orange
        flame(0.46, 2.6); g.fillStyle = "#ffe25a"; g.fill();                     // yellow core
        g.fillStyle = "#fff8d0"; g.beginPath(); g.arc(x + 16, yy + 3, 2.6 * fl2, 0, Math.PI * 2); g.fill();
        // eyes
        const ex2 = left ? -2 : 2;
        g.fillStyle = "#2a0800"; g.fillRect(x + 12 + ex2, yy - 1, 3, 3); g.fillRect(x + 18 + ex2, yy - 1, 3, 3);
        g.fillStyle = "#fff3a0"; g.fillRect(x + 12 + ex2, yy - 1, 1, 1); g.fillRect(x + 18 + ex2, yy - 1, 1, 1);
        // sparks
        for (let i = 0; i < 3; i++) { const sp = (time * 1.6 + i / 3 + (m.hx % 7) * 0.13) % 1; g.fillStyle = "rgba(255," + (200 - i * 40) + ",60," + (1 - sp).toFixed(3) + ")"; g.fillRect(x + 10 + i * 6 + Math.sin(time * 5 + i) * 2, yy - 10 - sp * 14, 2, 2); }
''' + s[i1:]

# --- ice elemental ("Lodowy żywiołak"): solid crystal body with a navy outline, faceted shading, glowing core (readable on snow)
i0 = s.index('      } else if (k === "ielem") {')
i1 = s.index('      } else if (k === "golem") {')
s = s[:i0] + '''      } else if (k === "ielem") {
        const yy = y + Math.sin(time * 2 + m.hx) * 2.5;
        g.fillStyle = "rgba(20,50,90,0.35)"; g.beginPath(); g.ellipse(x + 16, y + 29, 10, 3, 0, 0, Math.PI * 2); g.fill();
        glow(x + 16, yy + 14, 26, "rgba(80,190,255,0.45)");
        const OUT = "#0e2a4a", D = flash ? "#ffffff" : "#2f7fc4", M = flash ? "#ffffff" : "#5fb8ec", L = flash ? "#ffffff" : "#bfeaff";
        const poly = (pts: number[][], fill: string): void => { g.beginPath(); g.moveTo(x + pts[0][0], yy + pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(x + pts[i][0], yy + pts[i][1]); g.closePath(); g.fillStyle = fill; g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.6; g.stroke(); };
        // orbiting shards
        for (let i = 0; i < 3; i++) { const a2 = time * 1.8 + i * 2.09, ox = Math.cos(a2) * 15, oy = Math.sin(a2) * 5;
          if (oy < 0) poly([[16 + ox, 9 + oy], [19 + ox, 13 + oy], [16 + ox, 18 + oy], [13 + ox, 13 + oy]], M); }
        // arms
        poly([[5, 11], [1, 17], [4, 23], [8, 16]], D); poly([[27, 11], [31, 17], [28, 23], [24, 16]], D);
        // torso (faceted crystal)
        poly([[16, 4], [25, 11], [23, 23], [16, 28], [9, 23], [7, 11]], D);
        poly([[16, 4], [25, 11], [16, 15], [7, 11]], L);
        poly([[16, 15], [25, 11], [23, 23], [16, 28]], M);
        // head crystal
        poly([[16, -6], [21, 0], [19, 6], [13, 6], [11, 0]], M);
        poly([[16, -6], [21, 0], [16, 2], [11, 0]], L);
        // glowing core + eyes
        const cg = 0.6 + 0.4 * Math.sin(time * 4 + m.hy);
        glow(x + 16, yy + 16, 8, "rgba(200,250,255," + cg.toFixed(3) + ")");
        g.fillStyle = "#e8fbff"; g.fillRect(x + 15, yy + 14, 3, 4);
        const ex3 = left ? -1 : 1;
        g.fillStyle = "#04121f"; g.fillRect(x + 13 + ex3, yy + 1, 2, 2); g.fillRect(x + 17 + ex3, yy + 1, 2, 2);
        g.fillStyle = "#9ff4ff"; g.fillRect(x + 13 + ex3, yy + 1, 1, 1); g.fillRect(x + 17 + ex3, yy + 1, 1, 1);
        for (let i = 0; i < 3; i++) { const a2 = time * 1.8 + i * 2.09, ox = Math.cos(a2) * 15, oy = Math.sin(a2) * 5;
          if (oy >= 0) poly([[16 + ox, 9 + oy], [19 + ox, 13 + oy], [16 + ox, 18 + oy], [13 + ox, 13 + oy]], M); }
''' + s[i1:]
ed('    wisp: { n: "Błędny ognik", lvl: 11, hp: 130, atk: 25, def: 8, xp: 135, gold: [8, 18], spd: 3.4, aggro: 6, cd: 1.6, rng: 4, pc: "#c8ff7a",',
   '    wisp: { n: "Błędny ognik", lvl: 11, hp: 130, atk: 25, def: 8, xp: 135, gold: [8, 18], spd: 3.4, aggro: 6, cd: 1.6, rng: 4, pc: "#ff9a2a",')

# --- no healing in combat: skills give a barrier instead of HP
ed('{ n: "Okrzyk bojowy", lvl: 5, cost: 40, cd: 22, ic: "shout", d: "Leczy 25% życia, +60% obrony na 8 s." }',
   '{ n: "Okrzyk bojowy", lvl: 5, cost: 40, cd: 22, ic: "shout", d: "Bariera 30% maks. życia (pochłania obrażenia) i +60% obrony." }')
ed('{ n: "Odnowa", lvl: 5, cost: 35, cd: 16, ic: "heal", d: "Przywraca 40% życia." }',
   '{ n: "Lodowa bariera", lvl: 5, cost: 35, cd: 16, ic: "frost", d: "Bariera 45% maks. życia – pochłania obrażenia (nie leczy)." }')
ed('d: "Cios za 350%, leczy 30% życia i wzmacnia obronę." }', 'd: "Cios za 350%, bariera 30% maks. życia i +60% obrony." }')
ed('d: "Zamraża wrogów (poza bossami), rani za 220% i leczy 35%." }', 'd: "Zamraża wrogów (poza bossami), rani za 220% i daje barierę 35% maks. życia." }')
ed('      pl.buffDef = 8; heal(maxHp() * 0.25);', '      pl.buffDef = 8;')
ed('''      heal(maxHp() * 0.4);
      fx.push({ k: "ring", x: pp[0] + 16, y: pp[1] + 18, life: 0.9, max: 0.9, c: "120,255,160" });''', '''      pl.buffDef = 8;
      fx.push({ k: "ring", x: pp[0] + 16, y: pp[1] + 18, life: 0.9, max: 0.9, c: "140,220,255" });''')
# --- no natural HP regeneration; a slow free heal only while standing in a city (safe zone, outside arenas)
ed('      if (pl.combat <= 0 && P.hp < maxHp()) P.hp = Math.min(maxHp(), P.hp + maxHp() * 0.02 * dt);',
   '      if (pl.combat <= 0 && P.hp < maxHp() && CITY[P.area] && !pvpAt(P.area, P.x, P.y)) P.hp = Math.min(maxHp(), P.hp + maxHp() * 0.01 * dt);')

# --- every city has an alchemist with several potion tiers (bought only next to the NPC – shopOk runs on the server)
ed('herbs: ["pot", "bigpot", "mpot"]', 'herbs: ["pot", "bigpot", "elix", "mpot"]')
ed('alch: ["bigpot", "elix", "mpot"]', 'alch: ["pot", "bigpot", "elix", "mpot"]')
ed('portm: ["bigpot", "elix", "gpot", "mpot"]', 'portm: ["pot", "bigpot", "elix", "gpot", "mpot"]')
ed('fortm: ["elix", "gpot", "selix", "mpot"]', 'fortm: ["bigpot", "elix", "gpot", "selix", "mpot"]')
ed('citm: ["gpot", "selix", "spot", "mpot", "gmpot"]', 'citm: ["elix", "gpot", "selix", "spot", "mpot", "gmpot"]')
ed('starm: ["selix", "spot", "dpot", "mpot", "gmpot"]', 'starm: ["gpot", "selix", "spot", "dpot", "mpot", "gmpot"]')
ed('    if (it.t === "p") return "Leczy " + it.heal + " HP";', '    if (it.t === "p") return "Leczy " + it.heal + " HP (także w walce)";')
ed('text(shopId === "smith" || shopId === "armory" ? "Sprzęt dla klasy: " + C().n + ". Załóż go w torbie." : "Mikstury: H – leczenie, G – mana/energia.",',
   'text(shopId === "smith" || shopId === "armory" ? "Sprzęt dla klasy: " + C().n + ". Załóż go w torbie." : "Życie nie odnawia się samo – tylko mikstury (H, także w walce) i odpoczynek w mieście.",')
ed('    quests: QUESTS, qorder: QORDER, maxLvl: MAXLVL,\n', '    quests: QUESTS, qorder: QORDER, maxLvl: MAXLVL, shops: SHOPS,\n')
# battle-view portraits: the synthetic mob had no home tile (hx/hy) -> NaN in the animated sprites -> invisible
ed('drawMob({ k, d: MON[k], x: 0, y: 0, fx: 0, fy: 0, mt: 1,', 'drawMob({ k, d: MON[k], x: 0, y: 0, fx: 0, fy: 0, hx: 0, hy: 0, mt: 1,')
ed('fx: 0, fy: 0, hx: 0, hy: 0, mt: 1,', 'fx: 0, fy: 0, hx: 0, hy: 0, portrait: true, mt: 1,')
ed('    label(x + 16, top - (m.d.boss ? 22 : 10), (tgt || hv || m.d.boss ? m.d.n + " · " : "") + "Lv "', '    if (!m.portrait) label(x + 16, top - (m.d.boss ? 22 : 10), (tgt || hv || m.d.boss ? m.d.n + " · " : "") + "Lv "')

open('engine.ts', 'w').write(s)
print('r8 ok')
