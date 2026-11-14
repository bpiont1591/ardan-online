# Turn-based combat, equipment, PvP zones and UI hooks for the online engine (runs after mp.py).
s = open('engine.ts').read()
def ed(a, b, cnt=1):
    global s
    n = s.count(a)
    assert n == cnt, (a[:90], n)
    s = s.replace(a, b)

ed('  const ctx: CanvasRenderingContext2D = c2;', '  let ctx: CanvasRenderingContext2D = c2;')
ed('  const SRV: any = opts.server || null, NET: any = opts.net || null;',
   '  const SRV: any = opts.server || null, NET: any = opts.net || null;\n  // TB: turn-based combat (online): monsters never attack on the map, fights happen on the battle screen.\n  const TB = !!(SRV || NET);')

# ---- stats with equipment slots (P.gear)
ed('  const maxHp = (): number => Math.round(C().hp0 + (P.lvl - 1) * C().hpL + (P.eq.a ? ITEMS[P.eq.a].def * 2 : 0));',
'''  const GEARON = (): boolean => !!(P.gear && typeof P.gear === "object");
  const gs = (k: string): number => { let s0 = 0; const g = P.gear; if (g) for (const sl of Object.keys(g)) { const it = g[sl]; if (it && it.st && typeof it.st[k] === "number") s0 += it.st[k]; } return s0; };
  const maxHp = (): number => Math.round(C().hp0 + (P.lvl - 1) * C().hpL + (GEARON() ? gs("hp") : (P.eq.a ? ITEMS[P.eq.a].def * 2 : 0)));''')
ed('  const maxMp = (): number => Math.round(C().mp0 + (P.lvl - 1) * C().mpL + (P.eq.a && ITEMS[P.eq.a].mp ? ITEMS[P.eq.a].mp : 0));',
   '  const maxMp = (): number => Math.round(C().mp0 + (P.lvl - 1) * C().mpL + (GEARON() ? gs("mp") : (P.eq.a && ITEMS[P.eq.a].mp ? ITEMS[P.eq.a].mp : 0)));')
ed('  const atk = (): number => Math.round(C().atk0 + P.lvl * C().atkL + (P.eq.w ? ITEMS[P.eq.w].atk : 0));',
   '  const atk = (): number => Math.round(C().atk0 + P.lvl * C().atkL + (GEARON() ? gs("atk") : (P.eq.w ? ITEMS[P.eq.w].atk : 0)));')
ed('  const def = (): number => Math.round((P.lvl * C().defL + (P.eq.a ? ITEMS[P.eq.a].def : 0)) * (pl.buffDef > 0 ? 1.6 : 1));',
'''  const def = (): number => Math.round((P.lvl * C().defL + (GEARON() ? gs("def") : (P.eq.a ? ITEMS[P.eq.a].def : 0))) * (pl.buffDef > 0 ? 1.6 : 1));
  const critC = (): number => C().crit + (GEARON() ? gs("crit") / 100 : 0);
  const dodgeC = (): number => C().dodge + (GEARON() ? gs("dodge") / 100 : 0);
  const statsAll = (): any => ({ atk: atk(), def: def(), hp: maxHp(), mp: maxMp(), crit: Math.round(critC() * 100), dodge: Math.round(dodgeC() * 100), res: C().res });''')

# ---- PvP zones (shared by server rules and client drawing)
ed('  const SHOPN: { [k: string]: string } =', '''  const PVPZ: any[] = [
    { area: "village", x0: 14, y0: 19, x1: 24, y1: 25, n: "Arena Osady" },
    { area: "town", x0: 12, y0: 21, x1: 26, y1: 28, n: "Arena Srebrnogrodu" },
    { area: "desert", x0: 0, y0: 0, x1: 99, y1: 99, n: "Ruiny Piasków (cała kraina)" },
  ];
  const pvpAt = (area: string, x: number, y: number): any => { for (const z of PVPZ) if (z.area === area && x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1) return z; return null; };
  const SHOPN: { [k: string]: string } =''')
ed('    for (const b of bags) if (b.area === P.area) drawBag(b);', '''    for (const z of PVPZ) if (z.area === P.area && z.x1 < 99) {
      const zx = z.x0 * TS, zy = z.y0 * TS, zw = (z.x1 - z.x0 + 1) * TS, zh = (z.y1 - z.y0 + 1) * TS;
      ctx.fillStyle = "rgba(190,40,40,0.13)"; ctx.fillRect(zx, zy, zw, zh);
      ctx.strokeStyle = "rgba(255,90,70,0.75)"; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.strokeRect(zx + 1, zy + 1, zw - 2, zh - 2); ctx.setLineDash([]);
      label(zx + zw / 2, zy + 14, "⚔ " + z.n + " – strefa PvP", "#ffb0a0");
    }
    for (const b of bags) if (b.area === P.area) drawBag(b);''')

# ---- monsters do not attack on the map; monsters in a battle stand still
ed('      if (!m.aggro && !pl.dead && m.d.aggro > 0 && dist <= m.d.aggro && P.lvl < m.d.lvl + 6) m.aggro = true;',
   '      if (!TB && !m.aggro && !pl.dead && m.d.aggro > 0 && dist <= m.d.aggro && P.lvl < m.d.lvl + 6) m.aggro = true;')
ed('      if (SRV && m.own !== SRV.id) continue;\n      m.hit = Math.max(0, m.hit - dt); m.anim = Math.max(0, m.anim - dt);\n      if (m.dead) {',
   '      if (SRV && m.own !== SRV.id) continue;\n      m.hit = Math.max(0, m.hit - dt); m.anim = Math.max(0, m.anim - dt);\n      if (m.inB && !m.dead) continue;\n      if (m.dead) {')
ed('m.frz = (r[3] & 4) ? 1 : 0;', 'm.frz = (r[3] & 4) ? 1 : 0; m.inB = (r[3] & 32) === 32;')
ed('    for (const m of mobs[P.area]) if (!m.dead) ents.push({ y: rpos(m)[1], f: () => drawMob(m) });',
   '    for (const m of mobs[P.area]) if (!m.dead) ents.push({ y: rpos(m)[1], f: () => { drawMob(m); if (m.inB) { const mp = rpos(m); label(mp[0] + 16, mp[1] - 12 - (m.d.sc ? (m.d.sc - 1) * 26 : 0), "⚔ walka", "#ffb347"); } } });')
# loot is picked up right after a turn-based fight
ed('    if (items.length || gold > 0) bags.push({ area: P.area, x: m.x, y: m.y, items, gold, life: 90 });',
   '    if (items.length || gold > 0) { const bg = { area: P.area, x: m.x, y: m.y, items, gold, life: 90 }; if (TB) pickBag(bg); else bags.push(bg); }')

# ---- labels: guild tag, PvP colour
ed('    label(op[0] + 16, op[1] - 8, (inParty ? "◆ " : "") + o.n + " · " + o.l, inParty ? "#8fff8f" : "#9fe0ff");',
   '    const inZ = !!pvpAt(P.area, o.x, o.y) && !!pvpAt(P.area, P.x, P.y);\n    label(op[0] + 16, op[1] - 8, (inParty ? "◆ " : "") + (o.gt ? "[" + o.gt + "] " : "") + o.n + " · " + o.l, inParty ? "#8fff8f" : inZ ? "#ff9a8a" : "#9fe0ff");')
ed('      if (NET && NET.nick) label(pp[0] + 16, pp[1] - 8, NET.nick + " · " + P.lvl, "#ffe9a8");',
   '      if (NET && NET.nick) label(pp[0] + 16, pp[1] - 8, (NET.gtag ? "[" + NET.gtag + "] " : "") + NET.nick + " · " + P.lvl, "#ffe9a8");\n      if (NET && NET.title) label(pp[0] + 16, pp[1] - 21, "«" + NET.title + "»", "#e8c96a");')

# ---- HUD: bag opens the HTML equipment panel, extra menu button
ed('    circleBtn(W - 10 - ur * 5 - 16, uy, ur, "bag", () => { panel = panel === "inv" ? "" : "inv"; invSel = -1; }, hintOn ? "I" : "");',
   '''    circleBtn(W - 10 - ur * 5 - 16, uy, ur, "bag", () => { if (NET && NET.onPanel) { panel = ""; NET.onPanel("inv"); } else { panel = panel === "inv" ? "" : "inv"; invSel = -1; } }, hintOn ? "I" : "");
    if (NET && NET.onPanel) circleBtn(W - 10 - ur, uy + ur * 2 + 8, ur, "menu", () => { panel = ""; NET.onPanel("menu"); }, hintOn ? "R/U/P" : "");''')
ed('    } else if (kind === "quest") {', '''    } else if (kind === "menu") {
      g.fillStyle = "#ffd25a"; for (let i = 0; i < 3; i++) g.fillRect(cx - r * 0.45, cy - r * 0.38 + i * r * 0.32, r * 0.9, Math.max(2, r * 0.14));
    } else if (kind === "quest") {''')

ed('e.area = msg.a; e.bd = o.bd;', 'e.area = msg.a; e.bd = o.bd; e.gt = o.gt; e.fb = o.fb; e.i = o.i; e.ti = o.ti; e.dg = o.dg;')
ed('label(op[0] + 16, op[1] - 8, (inParty ? "◆ " : "") + (o.gt', 'if (o.ti) label(op[0] + 16, op[1] - 21, "«" + o.ti + "»", "#e8c96a");\n    if (o.fb || o.dg) label(op[0] + 16, op[1] - (o.ti ? 34 : 21), o.dg ? "🕳 w lochu" : "⚔ walczy", "#ffb347");\n    label(op[0] + 16, op[1] - 8, (inParty ? "◆ " : "") + (o.gt')
# monsters stand still at their spawn spot in turn-based mode (idle animation only)
ed('      if (m.mt < 1) { m.mt = Math.min(1, m.mt + dt * m.d.spd * (m.frz > 0 ? 0.3 : 1)); continue; }\n      if (m.frz > 0) { m.frz -= dt; continue; }',
   '      if (m.mt < 1) { m.mt = Math.min(1, m.mt + dt * m.d.spd * (m.frz > 0 ? 0.3 : 1)); continue; }\n      if (TB) { m.aggro = false; continue; }\n      if (m.frz > 0) { m.frz -= dt; continue; }')
# world objects (gathering nodes, dungeon gates) drawn by the UI layer, tap to use
ed('    for (const m of mobs[P.area]) if (!m.dead) ents.push({ y: rpos(m)[1], f: () => { drawMob(m);',
   '    if (NET && NET.objs && NET.drawObj) for (const o of NET.objs) if (o.a === P.area) ents.push({ y: o.y * TS - 1, f: () => { try { NET.drawObj(ctx, o, o.x * TS, o.y * TS, TS, performance.now() / 1000); } catch (e) { /* ignore */ } } });\n    for (const m of mobs[P.area]) if (!m.dead) ents.push({ y: rpos(m)[1], f: () => { drawMob(m);')
# ---- input hooks
ed('    if (k === "Escape") { if (dlg) { if (dlg.srv) actQ.push({ a: "dlgx" }); dlg = null; } else panel = ""; return; }',
   '    if (NET && NET.onKey && !dlg && NET.onKey(k)) { for (const kk of Object.keys(keys)) keys[kk] = false; return; }\n    if (k === "Escape") { if (dlg) { if (dlg.srv) actQ.push({ a: "dlgx" }); dlg = null; } else panel = ""; return; }')
ed('''    const m = mobUnder(w);
    if (m) { act({ a: "target", area: P.area, i: mobs[P.area].indexOf(m) }); return; }''', '''    if (NET && NET.objs && NET.onObjTap) for (const o of NET.objs) {
      if (o.a !== P.area) continue; const tx = Math.floor(w[0] / TS), ty = Math.floor(w[1] / TS);
      if (tx === o.x && (ty === o.y || (o.k === "gate" && ty === o.y - 1))) { NET.onObjTap(o); return; }
    }
    if (NET && NET.onPlayerTap) for (const k of Object.keys(others)) {
      const o = others[k]; if (o.area !== P.area || o.dead) continue; const op = rpos(o);
      if (Math.abs(op[0] + 16 - w[0]) < 15 && Math.abs(op[1] + 14 - w[1]) < 19) { NET.onPlayerTap(o); return; }
    }
    const m = mobUnder(w);
    if (m) { act({ a: "target", area: P.area, i: mobs[P.area].indexOf(m) }); return; }''')
ed('Dotknij potwora, by go wybrać, i bij przyciskiem ataku. Z postacią porozmawiasz, stojąc obok niej. Czat otworzysz przyciskiem z dymkiem.',
   'Dotknij potwora (lub przycisk ataku obok niego), aby rozpocząć walkę turową – możesz włączyć walkę automatyczną. Dotknij innego gracza, by handlować, zaprosić go lub wyzwać na arenie PvP. Menu (☰) otwiera ekwipunek, rynek, gildię i ranking PvP.')
ed('WASD/strzałki – ruch, klik na potwora – wybór celu, Spacja/F – atak, 1/2/3 – umiejętności, E – rozmowa (stojąc obok), I – torba, Q – zadania, M – mapa, H/G – mikstury, C – czat. Inni gracze są tu razem z tobą!',
   'WASD/strzałki – ruch. Klik na potwora albo Spacja/E obok niego – walka turowa (z opcją walki automatycznej). Klik na gracza – handel, drużyna, gildia, pojedynek PvP. I – ekwipunek, R – rynek, U – gildia, P – PvP, Q – zadania, M – mapa, C – czat.')

# ---- APIs
ed('    tick: srvTick, pl, P: (): any => P, maxHp, maxMp,',
   '''    tick: srvTick, pl, P: (): any => P, maxHp, maxMp,
    stats: statsAll, items: ITEMS, mon: MON, gearIds: GEAR, sk: SK, cls: CLS, zones: PVPZ, pvpAt, npcs: NPCS, areas: AREAS,
    kill: (m: any) => { if (m && !m.dead) { m.hp = 0; killMob(m); } }, die: () => { if (!pl.dead) die(); },
    gainXp: (n: number) => gainXp(n), countItem, removeItem, addItem, log, solid: (a: string, x: number, y: number) => solidT(AREAS[a], x, y),''')
ed('  if (NET) NET.api = { recv: netRecv, clearKeys: onBlur, log };', '''  const withCtx = (g: CanvasRenderingContext2D, fn: () => void): void => { const o = ctx; ctx = g; try { fn(); } finally { ctx = o; } };
  if (NET) NET.api = { recv: netRecv, clearKeys: onBlur, log,
    P: (): any => P, stats: statsAll, items: ITEMS, mon: MON, sk: SK, cls: CLS, zones: PVPZ, pvpAt, others: (): any => others, gearIds: GEAR, npcs: NPCS,
    drawMob: (g: CanvasRenderingContext2D, k: string): void => { if (MON[k]) withCtx(g, () => drawMob({ k, d: MON[k], x: 0, y: 0, fx: 0, fy: 0, mt: 1, hit: 0, anim: 0, dir: 0, hp: MON[k].hp, cd: 0, frz: 0 })); },
    drawChar: (g: CanvasRenderingContext2D, cls: string, w: string, a: string, dir: number): void => { const c = CLS[cls] || CLS.war; withCtx(g, () => drawHuman(0, 0, dir || 0, 0, c.look, w && ITEMS[w] ? ITEMS[w].c : null, a && a !== "shirt" && ITEMS[a] ? ITEMS[a].c : null, false, 0, c.wk)); },
    drawIcon: (g: CanvasRenderingContext2D, id: string, x: number, y: number, sz: number): void => { if (ITEMS[id]) withCtx(g, () => drawIcon(id, x, y, sz)); },
  };''')
open('engine.ts', 'w').write(s)
print('tb ok', len(s))
