# Round 9: Margonem-like bags (capacity = sum of worn bags, counted together with the item list), stat points
# (Siła / Zręczność / Intelekt, 1 per level), small XP death penalty, teleport scrolls, no potions in battle.
s = open('engine.ts').read()
def ed(a, b, cnt=1):
    global s
    n = s.count(a)
    assert n == cnt, (a[:90], n)
    s = s.replace(a, b)

# --- inventory capacity: the server sets P.cap (sum of the worn bags); equipment (P.gbag) and items (P.inv) share it
ed('''  function addItem(id: string, n: number): boolean {
    const it = ITEMS[id];
    const stack = it.t === "p" || it.t === "j" || it.t === "q";
    if (stack) { const s = P.inv.find((x: any) => x.id === id); if (s) { s.n += n; return true; } }
    if (P.inv.length >= 20) { log("Torba jest pełna!", "#ff8a7a"); return false; }
    if (stack) P.inv.push({ id, n }); else for (let i = 0; i < n; i++) { if (P.inv.length >= 20) return false; P.inv.push({ id, n: 1 }); }
    return true;
  }''', '''  const isStack = (id: string): boolean => { const t = ITEMS[id] ? ITEMS[id].t : ""; return t === "p" || t === "j" || t === "q" || t === "m" || t === "s"; };
  const used = (): number => P.inv.length + (Array.isArray(P.gbag) ? P.gbag.length : 0);
  const invFull = (): boolean => (P.cap ? used() >= P.cap : P.inv.length >= 20);
  function addItem(id: string, n: number): boolean {
    const stack = isStack(id);
    if (stack) { const s = P.inv.find((x: any) => x.id === id); if (s) { s.n += n; return true; } }
    if (invFull()) { log("Plecak pełny!", "#ff8a7a"); return false; }
    if (stack) P.inv.push({ id, n }); else for (let i = 0; i < n; i++) { if (invFull()) return false; P.inv.push({ id, n: 1 }); }
    return true;
  }''')
# merge split stacks (mana potions used to take one slot each)
ed('''  P.inv = P.inv.filter((s: any) => s && ITEMS[s.id] && s.n > 0);
''', '''  P.inv = P.inv.filter((s: any) => s && ITEMS[s.id] && s.n > 0);
  { const m: any[] = []; for (const s0 of P.inv) { const t = ITEMS[s0.id].t; const st = t === "p" || t === "j" || t === "q" || t === "m" || t === "s"; const e = st ? m.find((x: any) => x.id === s0.id) : null; if (e) e.n += s0.n; else m.push({ id: s0.id, n: s0.n }); } P.inv = m; }
''')
ed('''    if (P.inv.length >= 20) { log("Torba jest pełna!", "#ff8a7a"); return; }''', '''    if (invFull()) { log("Plecak pełny!", "#ff8a7a"); return; }''')
ed('''else log("Torba jest pełna!", "#ff8a7a");''', '''else log("Plecak pełny – zrób miejsce w torbach.", "#ff8a7a");''')

# --- stat points (Margonem): 1 point per level above 1, spent on Siła / Zręczność / Intelekt (P.attr)
ed('''  const maxHp = (): number => Math.round(C().hp0 + (P.lvl - 1) * C().hpL + (GEARON() ? gs("hp") : (P.eq.a ? ITEMS[P.eq.a].def * 2 : 0)));
  const maxMp = (): number => Math.round(C().mp0 + (P.lvl - 1) * C().mpL + (GEARON() ? gs("mp") : (P.eq.a && ITEMS[P.eq.a].mp ? ITEMS[P.eq.a].mp : 0)));
  const atk = (): number => Math.round(C().atk0 + P.lvl * C().atkL + (GEARON() ? gs("atk") : (P.eq.w ? ITEMS[P.eq.w].atk : 0)));''',
'''  const AT = (k: string): number => (P.attr && Number.isFinite(P.attr[k]) ? Math.max(0, P.attr[k]) : 0);
  const atkFromAttr = (): number => AT("str") * (P.cls === "war" ? 1 : 0.4) + AT("agi") * (P.cls === "arc" ? 1 : 0) + AT("int") * (P.cls === "mag" ? 1 : 0);
  const maxHp = (): number => Math.round(C().hp0 + (P.lvl - 1) * C().hpL + AT("str") * 3 + (GEARON() ? gs("hp") : (P.eq.a ? ITEMS[P.eq.a].def * 2 : 0)));
  const maxMp = (): number => Math.round(C().mp0 + (P.lvl - 1) * C().mpL + AT("int") * 5 + (GEARON() ? gs("mp") : (P.eq.a && ITEMS[P.eq.a].mp ? ITEMS[P.eq.a].mp : 0)));
  const atk = (): number => Math.round(C().atk0 + P.lvl * C().atkL + atkFromAttr() + (GEARON() ? gs("atk") : (P.eq.w ? ITEMS[P.eq.w].atk : 0)));''')
ed('''  const critC = (): number => C().crit + (GEARON() ? gs("crit") / 100 : 0);
  const dodgeC = (): number => C().dodge + (GEARON() ? gs("dodge") / 100 : 0);''',
'''  const critC = (): number => C().crit + AT("agi") * 0.002 + (GEARON() ? gs("crit") / 100 : 0);
  const dodgeC = (): number => C().dodge + AT("agi") * 0.002 + (GEARON() ? gs("dodge") / 100 : 0);''')
ed('''      log("AWANS! Osiągasz poziom " + P.lvl + ".", "#ffd25a");''', '''      log("AWANS! Osiągasz poziom " + P.lvl + ". Nowy punkt statystyk do rozdania (I – ekwipunek).", "#ffd25a");''')

# --- death penalty (Margonem): besides 10% gold and durability, lose 5% of the XP needed for the next level (never a level)
ed('''    const lost = Math.floor(P.gold * 0.1); P.gold -= lost;
    const rp = respawnFor(P.area);
    pl.resp = rp; pl.wear = 1;
    log("Poległeś! Tracisz " + lost + " zł, a założony ekwipunek traci wytrzymałość. Budzisz się: " + AREAS[rp[0]].name + ".", "#ff8a7a");''',
'''    const lost = Math.floor(P.gold * 0.1); P.gold -= lost;
    const xl = P.lvl >= MAXLVL ? 0 : Math.min(P.xp, Math.floor(xpNext(P.lvl) * 0.05)); P.xp -= xl;
    const rp = respawnFor(P.area);
    pl.resp = rp; pl.wear = 1;
    log("Poległeś! Tracisz " + lost + " zł" + (xl > 0 ? " i " + xl + " PD" : "") + ", a założony ekwipunek traci wytrzymałość. Budzisz się: " + AREAS[rp[0]].name + ".", "#ff8a7a");''')

# --- teleport scrolls (Margonem "zwoje teleportacji"): one per city, used outside battle
ed('''    pot: { n: "Mała mikstura", t: "p", heal: 45, price: 12, c: "#e0413a", ic: "pot" },''',
'''    pot: { n: "Mała mikstura", t: "p", heal: 45, price: 12, c: "#e0413a", ic: "pot" },
    tp_village: { n: "Zwój teleportacji: Osada Brzozowa", t: "s", tp: "village", price: 20, c: "#c8a46a", ic: "letter" },
    tp_town: { n: "Zwój teleportacji: Srebrnogród", t: "s", tp: "town", price: 35, c: "#d8dde6", ic: "letter" },
    tp_port: { n: "Zwój teleportacji: Mewia Przystań", t: "s", tp: "port", price: 60, c: "#8fd0ff", ic: "letter" },
    tp_fort: { n: "Zwój teleportacji: Twierdza Żarogród", t: "s", tp: "fort", price: 90, c: "#ff9a5a", ic: "letter" },
    tp_citadel: { n: "Zwój teleportacji: Cytadela Świtu", t: "s", tp: "citadel", price: 130, c: "#ffe9a8", ic: "letter" },
    tp_star: { n: "Zwój teleportacji: Gwiezdna Strażnica", t: "s", tp: "star", price: 180, c: "#bfe8ff", ic: "letter" },''')
ed('''    if (it.t !== "p") return;
    if (P.hp >= maxHp()) { log("Masz pełne zdrowie.", "#a89c86"); return; }''',
'''    if (it.t === "s") {
      if (pl.dead || trans) return;
      if (!AREAS[it.tp] || !RESP0[it.tp]) return;
      if (P.area === it.tp) { log("Już jesteś w tym mieście.", "#a89c86"); return; }
      removeItem(id, 1); save();
      log("Zwój teleportacji przenosi cię: " + AREAS[it.tp].name + ".", "#c8b6ff");
      const p0 = rpos(pl2()); burst(p0[0] + 16, p0[1] + 16, "#c8b6ff", 30, 90);
      changeArea(it.tp, RESP0[it.tp][0], RESP0[it.tp][1]);
      return;
    }
    if (it.t !== "p") return;
    if (P.hp >= maxHp()) { log("Masz pełne zdrowie.", "#a89c86"); return; }''')
ed('''    if (it.t === "p") return "Leczy " + it.heal + " HP (także w walce)";''', '''    if (it.t === "p") return "Leczy " + it.heal + " HP (tylko poza walką)";
    if (it.t === "s") return "Teleport do miasta (poza walką)";''')
ed('''"Życie nie odnawia się samo – tylko mikstury (H, także w walce) i odpoczynek w mieście."''', '''"Lecz się PRZED walką: mikstury (H), odpoczynek w mieście, kapłan. W walce nie ma leczenia."''')
# every alchemist also sells teleport scrolls to the nearby cities
for a, b in [('herbs: ["pot", "bigpot", "elix", "mpot"]', 'herbs: ["pot", "bigpot", "elix", "mpot", "tp_village", "tp_town"]'),
             ('alch: ["pot", "bigpot", "elix", "mpot"]', 'alch: ["pot", "bigpot", "elix", "mpot", "tp_village", "tp_town", "tp_port"]'),
             ('portm: ["pot", "bigpot", "elix", "gpot", "mpot"]', 'portm: ["pot", "bigpot", "elix", "gpot", "mpot", "tp_town", "tp_port", "tp_fort"]'),
             ('fortm: ["bigpot", "elix", "gpot", "selix", "mpot"]', 'fortm: ["bigpot", "elix", "gpot", "selix", "mpot", "tp_port", "tp_fort", "tp_citadel"]'),
             ('citm: ["elix", "gpot", "selix", "spot", "mpot", "gmpot"]', 'citm: ["elix", "gpot", "selix", "spot", "mpot", "gmpot", "tp_fort", "tp_citadel", "tp_star"]'),
             ('starm: ["gpot", "selix", "spot", "dpot", "mpot", "gmpot"]', 'starm: ["gpot", "selix", "spot", "dpot", "mpot", "gmpot", "tp_citadel", "tp_star", "tp_village"]')]:
    ed(a, b)

# --- loot that does not fit stays on the ground (2 minutes) and is picked up automatically once there is room
ed('''    b.taken = true;
    const got: string[] = [];
    if (b.gold) { P.gold += b.gold; got.push(b.gold + " zł"); }
    for (const it of b.items) if (addItem(it[0], it[1])) got.push(ITEMS[it[0]].n);
    if (got.length) log("Łup: " + got.join(", "), "#f5d98a");''',
'''    b.taken = true;
    const got: string[] = [], left: any[] = [];
    if (b.gold) { P.gold += b.gold; got.push(b.gold + " zł"); b.gold = 0; }
    for (const it of b.items) { if (addItem(it[0], it[1])) got.push(ITEMS[it[0]].n); else left.push(it); }
    if (got.length) log("Łup: " + got.join(", "), "#f5d98a");
    if (left.length) {
      b.items = left; b.taken = false;
      if (b.over) return;
      b.over = true; b.area = P.area; b.x = P.x; b.y = P.y; b.life = 120;
      if (bags.indexOf(b) < 0) bags.push(b);
      log("Plecak pełny! " + left.map((it: any[]) => ITEMS[it[0]].n).join(", ") + " – leży na ziemi przez 2 min. Zrób miejsce, a podniesiesz to automatycznie.", "#ff8a7a");
    }''')
ed('''    if (!trans) { updateMobs(dt); updateShots(dt); }
    for (let i = bags.length - 1; i >= 0; i--) { bags[i].life -= dt; if (bags[i].life <= 0 || bags[i].taken) bags.splice(i, 1); }
  }''', '''    if (!trans) { updateMobs(dt); updateShots(dt); }
    for (const b of bags) if (b.over && !b.taken && !pl.dead && !invFull()) pickBag(b);
    for (let i = bags.length - 1; i >= 0; i--) { bags[i].life -= dt; if (bags[i].life <= 0 && bags[i].over && !bags[i].taken) log("Przepadło z ziemi: " + bags[i].items.map((it: any[]) => ITEMS[it[0]].n).join(", ") + ".", "#a89c86"); if (bags[i].life <= 0 || bags[i].taken) bags.splice(i, 1); }
  }''')
# expose for the server (stat points UI / bags) and the client UI
ed('''    quests: QUESTS, qorder: QORDER, maxLvl: MAXLVL, shops: SHOPS,''', '''    quests: QUESTS, qorder: QORDER, maxLvl: MAXLVL, shops: SHOPS, xpNext, used, invFull,''')
ed('M – mapa, H – mikstura, G – mana.', 'M – mapa, H – mikstura (tylko poza walką – w walce nie ma leczenia), G – mana. Zginiesz – budzisz się w mieście bez części złota i PD.')
open('engine.ts', 'w').write(s)
print('r9 ok')
