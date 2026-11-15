# Round 7: PvP maps (lethal) vs safe maps, item durability (broken gear gives no stats), respawn in the nearest city,
# monster level labels, world map with real map thumbnails, all maps open from the start.
s = open('engine.ts').read()
def ed(a, b, cnt=1):
    global s
    n = s.count(a)
    assert n == cnt, (a[:90], n)
    s = s.replace(a, b)

# --- PvP: arenas = friendly duels (no death); whole PvP maps = lethal fights
ed('''    { area: "desert", x0: 0, y0: 0, x1: 99, y1: 99, n: "Ruiny Piasków (cała kraina)" },
  ];''', '''    { area: "desert", x0: 0, y0: 0, x1: 99, y1: 99, n: "Ruiny Piasków", lethal: 1 },
    { area: "steppe", x0: 0, y0: 0, x1: 99, y1: 99, n: "Spalone Stepy", lethal: 1 },
    { area: "volcano", x0: 0, y0: 0, x1: 99, y1: 99, n: "Wulkan Ignara", lethal: 1 },
    { area: "abyss", x0: 0, y0: 0, x1: 99, y1: 99, n: "Otchłań Zmierzchu", lethal: 1 },
    { area: "necro", x0: 0, y0: 0, x1: 99, y1: 99, n: "Nekropolia Valgaru", lethal: 1 },
    { area: "dragon", x0: 0, y0: 0, x1: 99, y1: 99, n: "Smocze Gniazdo", lethal: 1 },
  ];
  const CITY: { [k: string]: number } = { village: 1, town: 1, port: 1, fort: 1, citadel: 1, star: 1 };
  const pvpMap = (area: string): boolean => PVPZ.some((z: any) => z.area === area && z.lethal);''')

# --- durability: a broken item (d === 0) gives no stats
ed('if (it && it.st && typeof it.st[k] === "number") s0 += it.st[k]; } return s0; };',
   'if (it && it.st && it.d !== 0 && typeof it.st[k] === "number") s0 += it.st[k]; } return s0; };')

# --- respawn in the nearest city (by world-map distance)
ed('''    const far = ["swamp", "town", "mount", "desert"].indexOf(P.area) >= 0;
    pl.resp = far ? ["town", 19, 13] : ["village", 18, 17];
    log("Poległeś! Tracisz " + lost + " zł. Budzisz się w " + (far ? "Srebrnogrodzie." : "osadzie."), "#ff8a7a");''',
'''    const rp = respawnFor(P.area);
    pl.resp = rp; pl.wear = 1;
    log("Poległeś! Tracisz " + lost + " zł, a założony ekwipunek traci wytrzymałość. Budzisz się: " + AREAS[rp[0]].name + ".", "#ff8a7a");''')
ed('  function heal(n: number): void {', '''  // the nearest city on the world map; spawn next to its priest (or the city centre)
  const RESP0: { [k: string]: number[] } = { village: [18, 17], town: [19, 13], port: [26, 16], fort: [26, 16], citadel: [26, 16], star: [21, 17] };
  function respawnFor(area: string): any[] {
    let best = "village", bd = 1e9; const a0 = AINFO[area] || AINFO.village;
    for (const c of Object.keys(RESP0)) { if (!AINFO[c]) continue; const d = Math.abs(AINFO[c].gx - a0.gx) + Math.abs(AINFO[c].gy - a0.gy) + (c === area ? -1 : 0); if (d < bd) { bd = d; best = c; } }
    const a = AREAS[best]; let [x, y] = RESP0[best];
    for (let r = 0; r < 6 && solidT(a, x, y); r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (solidT(a, x, y) && !solidT(a, RESP0[best][0] + dx, RESP0[best][1] + dy)) { x = RESP0[best][0] + dx; y = RESP0[best][1] + dy; }
    return [best, x, y];
  }
  function heal(n: number): void {''')

# --- monster labels: name + level always visible, colour by difficulty
ed('''    if (tgt || hv || m.d.boss) label(x + 16, top - (m.d.boss ? 22 : 10), m.d.n + " (" + m.d.lvl + ")", m.d.lvl > P.lvl + 2 ? "#ff8a7a" : m.d.lvl < P.lvl - 3 ? "#a8a8a8" : "#ffe9a8");''',
'''    const dl = m.d.lvl - P.lvl;
    const lc = m.d.boss ? "#e0a8ff" : dl >= 6 ? "#ff5a4a" : dl >= 3 ? "#ffa04a" : dl >= -2 ? "#ffe9a8" : dl >= -5 ? "#8fe08a" : "#a8a8a8";
    label(x + 16, top - (m.d.boss ? 22 : 10), (tgt || hv || m.d.boss ? m.d.n + " · " : "") + "Lv " + m.d.lvl + (m.d.boss ? " ☠" : ""), lc);''')

# --- world map: every area box shows its real map thumbnail, names always visible (all maps are open)
ed('''        rr(bx, by, bw2, bh2, 8); ctx.fillStyle = seen ? MINI[AREAS[id].base] || "#444" : "#2a2630"; ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1;
        ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fill();''',
'''        rr(bx, by, bw2, bh2, 8); ctx.fillStyle = MINI[AREAS[id].base] || "#444"; ctx.fill();
        const am = AREAS[id].mini;
        if (am) { ctx.save(); rr(bx, by, bw2, bh2, 8); ctx.clip(); const k2 = Math.max(bw2 / am.width, bh2 / am.height); ctx.drawImage(am, p[0] - am.width * k2 / 2, p[1] - am.height * k2 / 2, am.width * k2, am.height * k2); ctx.restore(); }
        rr(bx, by, bw2, bh2, 8); ctx.fillStyle = seen ? "rgba(0,0,0,0.38)" : "rgba(10,8,14,0.62)"; ctx.fill();
        if (pvpMap(id) || CITY[id]) { const tg = CITY[id] ? "bezpieczna" : "⚔ PvP"; ctx.font = "bold 9px " + FONT; const tw = ctx.measureText(tg).width + 8; rr(bx + bw2 - tw - 4, by + bh2 - 15, tw, 12, 4); ctx.fillStyle = CITY[id] ? "rgba(40,120,60,0.9)" : "rgba(170,30,30,0.92)"; ctx.fill(); text(tg, bx + bw2 - tw / 2 - 4, by + bh2 - 9, 9, "#fff", "center", true); }''')
ed('text(fitText(seen ? AREAS[id].name : "??? (nieodkryta)", bw2 - 10, fs3, true), p[0], by + 14, fs3, seen ? COL.title : COL.mute, "center", true);',
   'text(fitText(AREAS[id].name + (seen ? "" : " (nieodwiedzona)"), bw2 - 10, fs3, true), p[0], by + 14, fs3, seen ? COL.title : "#cfc6b8", "center", true);')
ed('text("Złota linia: droga do celu śledzonego zadania.", x + 14, y + h - legH + 10, 11, COL.mute);',
   'text("Złota linia: droga do celu zadania. Wszystkie krainy są otwarte – ale wysoko poziomowe są śmiertelnie groźne. ⚔ PvP: inni gracze mogą cię zaatakować.", x + 14, y + h - legH + 10, 11, COL.mute);')

# --- the dwarven mine was almost pitch black: a bit more light so the map is visible

# --- the necropolis / mine looked like black empty fields: real crypt flagstones + less darkness
ed('      case FLOOR: floorT(g, px, py, h); break;', """      case FLOOR: {
        if (a.id !== "necro") { floorT(g, px, py, h); break; }
        g.fillStyle = (x + y) & 1 ? "#5a5462" : "#544e5c"; g.fillRect(px, py, TS, TS);
        g.fillStyle = "#3e3946"; g.fillRect(px, py, TS, 1); g.fillRect(px, py, 1, TS); g.fillRect(px, py + 15, TS, 1); g.fillRect(px + ((y & 1) ? 8 : 22), py, 1, 15); g.fillRect(px + ((y & 1) ? 22 : 8), py + 16, 1, 16);
        g.fillStyle = "#6a6474"; g.fillRect(px + 1, py + 1, TS - 2, 1); g.fillRect(px + 1, py + 16, TS - 2, 1);
        if (h() < 0.18) { g.strokeStyle = "#35303c"; g.lineWidth = 1; g.beginPath(); g.moveTo(px + 4 + h() * 10, py + 4); g.lineTo(px + 10 + h() * 12, py + 12 + h() * 10); g.stroke(); }
        if (h() < 0.07) { g.fillStyle = "#d8d0c0"; g.fillRect(px + 9, py + 20, 12, 2); g.fillRect(px + 8, py + 19, 3, 4); g.fillRect(px + 19, py + 19, 3, 4); }
        if (h() < 0.05) { g.fillStyle = "#4b6a3a"; g.fillRect(px + 3, py + 26, 6, 3); g.fillRect(px + 22, py + 4, 5, 2); }
        break;
      }""")
ed('necro: { lv: "Potwory poz. 66–74", amb: "fog", dark: 0.55,', 'necro: { lv: "Potwory poz. 66–74", amb: "fog", dark: 0.32,')
ed('mine: { lv: "Potwory poz. 11–18", amb: "", dark: 0.82,', 'mine: { lv: "Potwory poz. 11–18", amb: "", dark: 0.45,')


# --- blacksmiths repair gear (server-checked proximity): flag + dialog option
ed('  function heal(n: number): void {', """  for (const k of ["kowal", "platnerz", "portsmith", "fortsmith", "citsmith", "starsmith"]) if (NPCS[k]) NPCS[k].rep = 1;
  function heal(n: number): void {""")
ed('    if (n.heal) extra.push({ l: n.heal,', '''    if (n.rep) extra.push({ l: "Napraw ekwipunek", fn: () => { dlg = null; uiReq = "naprawa:" + id; } });
    if (n.heal) extra.push({ l: n.heal,''')

# --- entering a map: warn about PvP maps and maps far above the player's level
ed('  function heal(n: number): void {', """  let areaWarnT = "";
  const lvRange = (a: string): number[] | null => { const m = /Potwory poz\\. (\\d+)\\D+(\\d+)/.exec((AINFO[a] && AINFO[a].lv) || ""); return m ? [+m[1], +m[2]] : null; };
  function areaWarn(): void {
    areaWarnT = "";
    const r = lvRange(P.area);
    if (pvpMap(P.area)) { log("⚔ Wchodzisz na mapę PvP! Inni gracze (od 10. poziomu) mogą cię tu zaatakować i zabić.", "#ff8a7a"); areaWarnT = "⚔ STREFA PvP – inni gracze mogą cię zaatakować"; }
    if (r && r[0] >= P.lvl + 6) { log("⚠ Uwaga: potwory w tej krainie mają poziom " + r[0] + "–" + r[1] + ", a ty " + P.lvl + ". Łatwo tu zginąć!", "#ffa04a"); areaWarnT = (areaWarnT ? areaWarnT + "  ·  " : "") + "⚠ Potwory poz. " + r[0] + "–" + r[1] + " – śmiertelnie groźne dla ciebie!"; }
    if (areaWarnT) banner = Math.max(banner, 6);
  }
  function heal(n: number): void {""")
ed('''    banner = first ? 4.5 : 3; trans = { t: 0.25, done: true, to: a };
    if (first) log("Odkryto nową krainę: " + A().name + "!", "#f5d98a");''', '''    banner = first ? 4.5 : 3; trans = { t: 0.25, done: true, to: a };
    if (first) log("Odkryto nową krainę: " + A().name + "!", "#f5d98a");
    areaWarn();''')
ed('''        banner = first ? 4.5 : 3; clickMark = null; panel = ""; dlg = null; guideT = 0; save();
        if (first) log("Odkryto nową krainę: " + A().name + "!", "#f5d98a");''', '''        banner = first ? 4.5 : 3; clickMark = null; panel = ""; dlg = null; guideT = 0; save();
        if (first) log("Odkryto nową krainę: " + A().name + "!", "#f5d98a");
        areaWarn();''')
ed('''      text(AINFO[a.id].lv, W / 2, H * 0.3 + 26, 12, COL.text, "center", true);
      ctx.globalAlpha = 1;
    }''', '''      text(AINFO[a.id].lv, W / 2, H * 0.3 + 26, 12, COL.text, "center", true);
      if (areaWarnT) text(fitText(areaWarnT, W - 30, 14, true), W / 2, H * 0.3 + 48, 14, "#ff8a6a", "center", true);
      ctx.globalAlpha = 1;
    }''')

ed('zones: PVPZ, pvpAt, npcs: NPCS, areas: AREAS, ainfo: AINFO,', 'zones: PVPZ, pvpAt, pvpMap, city: CITY, npcs: NPCS, areas: AREAS, ainfo: AINFO,')
ed('zones: PVPZ, pvpAt, others:', 'zones: PVPZ, pvpAt, pvpMap, city: CITY, others:')
open('engine.ts', 'w').write(s)
print('r7 ok')
