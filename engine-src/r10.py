# Round 10: free level skins (wygląd postaci). Tiers unlock at SKIN_LV; P.skin = chosen tier (missing / -1 = highest unlocked).
# The tier art lives in public/js/skins.js (window.ARDAN_SKINS); without it (server) the classic look is drawn.
s = open('engine.ts').read()
def ed(a, b, cnt=1):
    global s
    n = s.count(a)
    assert n == cnt, (a[:90], n)
    s = s.replace(a, b)

ed('''  const MAXLVL = 80;''', '''  const MAXLVL = 80;
  const SKIN_LV = [1, 5, 15, 30, 45, 60, 70, 80];
  function skinTier(lvl: number, choice: any): number {
    let top = 0; for (let i = 0; i < SKIN_LV.length; i++) if (lvl >= SKIN_LV[i]) top = i;
    return Number.isInteger(choice) && choice >= 0 && choice <= top ? choice : top;
  }
  const SKINS = (): any => (typeof window !== "undefined" ? (window as any).ARDAN_SKINS : null);
  // a player figure: the skin art for tiers 1+ (when loaded), the classic drawHuman otherwise
  function drawHero(x: number, y: number, dir: number, walk: number, cls: string, tier: number, w: string | null, ar: string | null, flash: boolean, lunge: number): void {
    const SK2 = SKINS(), c = CLS[cls] || CLS.war;
    if (SK2 && tier > 0) { SK2.hero(ctx, x, y, { cls: CLS[cls] ? cls : "war", tier, dir, walk, flash, lunge, t: time, wcol: w, weapon: drawWeapon }); return; }
    drawHuman(x, y, dir, walk, c.look, w, ar, flash, lunge, c.wk);
  }''')
ed('''    drawHuman(x, y, dir, walk, C().look, w, ar, flash, lunge, C().wk);
  }''', '''    drawHero(x, y, dir, walk, P.cls, skinTier(P.lvl, P.skin), w, ar, flash, lunge);
  }''')
ed('''    drawHuman(op[0], op[1], o.dir || 0, o.mt < 1 ? o.phase : 0, c.look, w, ar, o.hit > 0, o.an, c.wk);''',
   '''    drawHero(op[0], op[1], o.dir || 0, o.mt < 1 ? o.phase : 0, o.c, o.sk | 0, w, ar, o.hit > 0, o.an); void c;''')
ed('''e.ti = o.ti; e.dg = o.dg;''', '''e.ti = o.ti; e.dg = o.dg; e.sk = o.sk | 0;''')
ed('''    drawChar: (g: CanvasRenderingContext2D, cls: string, w: string, a: string, dir: number): void => { const c = CLS[cls] || CLS.war; withCtx(g, () => drawHuman(0, 0, dir || 0, 0, c.look, w && ITEMS[w] ? ITEMS[w].c : null, a && a !== "shirt" && ITEMS[a] ? ITEMS[a].c : null, false, 0, c.wk)); },''',
   '''    drawChar: (g: CanvasRenderingContext2D, cls: string, w: string, a: string, dir: number, sk?: number): void => { withCtx(g, () => drawHero(0, 0, dir || 0, 0, cls, sk === undefined ? skinTier(P.lvl, P.skin) : sk | 0, w && ITEMS[w] ? ITEMS[w].c : null, a && a !== "shirt" && ITEMS[a] ? ITEMS[a].c : null, false, 0)); },
    skinLv: SKIN_LV, skinTier: (lvl?: number, ch?: any): number => skinTier(lvl === undefined ? P.lvl : lvl, ch === undefined ? P.skin : ch),''')
ed('''    quests: QUESTS, qorder: QORDER, maxLvl: MAXLVL, shops: SHOPS, xpNext, used, invFull,''',
   '''    quests: QUESTS, qorder: QORDER, maxLvl: MAXLVL, shops: SHOPS, xpNext, used, invFull,
    skinLv: SKIN_LV, skinTier: (): number => skinTier(P.lvl, P.skin),''')
# friends button (round 10) under the quest button – opens the friends window (L); badge = pending friend requests
ed('''    if (NET && NET.onPanel) circleBtn(W - 10 - ur, uy + ur * 2 + 8, ur, "menu", () => { panel = ""; NET.onPanel("menu"); }, hintOn ? "R/U/P" : "");''',
   '''    if (NET && NET.onPanel) circleBtn(W - 10 - ur, uy + ur * 2 + 8, ur, "menu", () => { panel = ""; NET.onPanel("menu"); }, hintOn ? "R/U/P" : "");
    if (NET && NET.onPanel) circleBtn(W - 10 - ur * 3 - 8, uy + ur * 2 + 8, ur, "friends", () => { panel = ""; NET.onPanel("fr"); }, hintOn ? "L" : "", NET.frBadge ? String(Math.min(9, NET.frBadge)) : undefined);''')
ed('''    } else if (kind === "menu") {''', '''    } else if (kind === "friends") {
      g.fillStyle = "#9fc2ff"; g.beginPath(); g.arc(cx - r * 0.22, cy - r * 0.2, r * 0.22, 0, 7); g.fill(); g.fillRect(cx - r * 0.52, cy + r * 0.08, r * 0.6, r * 0.38);
      g.fillStyle = "#ffd25a"; g.beginPath(); g.arc(cx + r * 0.25, cy - r * 0.12, r * 0.22, 0, 7); g.fill(); g.fillRect(cx - r * 0.05, cy + r * 0.16, r * 0.6, r * 0.34);
    } else if (kind === "menu") {''')
open('engine.ts', 'w').write(s)
print('r10 ok')
