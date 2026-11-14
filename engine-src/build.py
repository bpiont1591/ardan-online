import re,sys
L=open('old.ts').read().split('\n')
def ln(i): return L[i-1]
def rng(a,b): return '\n'.join(L[a-1:b])
def f(n): return open(n).read().rstrip('\n')
chk={1477:'  function onDown',1516:'  function onUp',25:'  const GRASS',209:'  const AREAS',226:'  function baseOf',389:'      default:',392:'  function renderArea',403:'  // ---------- DATA',465:'  // ---------- STATE',535:'  // ---------- QUESTS',590:'  // ---------- COMBAT',751:'  function nearestMob',773:'  function updatePlayer',896:'  // ---------- DRAW: ENTITIES',939:'  function label',945:'  function drawMob',1007:'  function drawNpc',1020:'  function drawDecor',1040:'  function drawBag',1048:'  function drawIcon',1104:'  // ---------- DRAW: MAIN',1183:'  function circleBtn',1299:'  function itemDesc',1387:'  function drawShop',1519:'  function onKey',1539:'  function onBlur'}
for k,v in chk.items():
    assert ln(k).startswith(v),(k,ln(k))
for k in [33,210,228,401,463,517,588,677,771,894,938,1006,1039,1070,1181,1291,1386,1464,1538]:
    pass
parts=[rng(1,24),f('a_tiles.ts'),rng(34,208),f('b_gens.ts'),rng(211,225),f('c_base.ts'),rng(229,388),f('c_cases.ts'),rng(389,391),f('c_render.ts'),rng(402,402),f('d_data.ts'),rng(464,464),f('e_state.ts'),rng(518,534),f('f_quests.ts'),rng(589,589),f('g_combat.ts'),rng(678,750),f('h_ctrl.ts'),rng(772,772),f('i_update.ts'),rng(895,895),f('j_human.ts'),rng(939,944),f('k_mob.ts'),rng(1007,1019),f('l_decor.ts'),rng(1040,1047),f('m_icon.ts'),rng(1071,1103),f('n_draw.ts'),rng(1182,1182),f('o_hud.ts'),rng(1292,1298),f('p_panels.ts'),rng(1387,1464),f('q_map.ts'),rng(1465,1476),f('s_input.ts'),rng(1517,1518),f('r_key.ts'),rng(1539,len(L))]
s='\n'.join(parts)
def rep(a,b,cnt=1):
    global s
    n=s.count(a)
    assert n==cnt,(a[:60],n)
    s=s.replace(a,b)
# forest south corridor (deterministic, after spawns)
rep('''    pick("goblin", 7, (x: number) => x > 34);
    return a;''','''    pick("goblin", 7, (x: number) => x > 34);
    line4(22, 30, 22, 39, (x: number, y: number) => { for (let dx = -1; dx <= 1; dx++) { const t = gt(a, x + dx, y); if (t === TREE || t === ROCK || t === FLOWER) st(a, x + dx, y, y >= 38 ? PATH : GRASS); } if (gt(a, x, y) !== BRIDGE) st(a, x, y, PATH); });
    for (let x = 21; x <= 23; x++) { st(a, x, 38, PATH); st(a, x, 39, PATH); a.exits.push({ x, y: 39, to: "swamp", tx: x + 1, ty: 1 }); }
    a.spawns = a.spawns.filter((s2: any[]) => !(Math.abs(s2[1] - 22) <= 1 && s2[2] >= 36));
    return a;''')
rep('const soft = (v: number): boolean => v === GRASS || v === DGRASS || v === FLOWER || v === TREE || v === ROCK;\n        g.fillStyle = "rgba(60,110,40,0.45)";',
    'const soft = (v: number): boolean => v === GRASS || v === DGRASS || v === FLOWER || v === TREE || v === ROCK || v === SNOW || v === MUD || v === SPINE || v === DEADT || v === REED;\n        g.fillStyle = a.base === SNOW ? "rgba(240,246,255,0.75)" : a.base === MUD ? "rgba(70,72,44,0.6)" : "rgba(60,110,40,0.45)";')
rep('''        g.fillStyle = "#2d6db0"; g.fillRect(px, py, TS, TS);
        g.fillStyle = "#8b5e34"; g.fillRect(px, py + 2, TS, TS - 4);''','''        g.fillStyle = a.base === MUD ? "#33493a" : "#2d6db0"; g.fillRect(px, py, TS, TS);
        g.fillStyle = "#8b5e34"; g.fillRect(px, py + 2, TS, TS - 4);''')
rep('if (nb(0, -1) === WATER) g.fillRect(px, py + 2, TS, 3);','if (nb(0, -1) === WATER || nb(0, -1) === BOG) g.fillRect(px, py + 2, TS, 3);')
rep('if (nb(0, 1) === WATER) g.fillRect(px, py + TS - 5, TS, 3);','if (nb(0, 1) === WATER || nb(0, 1) === BOG) g.fillRect(px, py + TS - 5, TS, 3);')
rep('''      case TREE: {
        baseOf(g, a, px, py, h);''','''      case TREE: {
        baseOf(g, a, px, py, h);
        if (a.base === SAND) {
          g.fillStyle = "rgba(0,0,0,0.22)"; g.beginPath(); g.ellipse(px + 18, py + 28, 11, 3, 0, 0, Math.PI * 2); g.fill();
          g.strokeStyle = "#8a6238"; g.lineWidth = 4; g.beginPath(); g.moveTo(px + 15, py + 30); g.quadraticCurveTo(px + 13, py + 18, px + 18, py + 8); g.stroke();
          g.fillStyle = "#3f8a3a";
          for (let i = 0; i < 5; i++) { const an = -Math.PI + i * Math.PI / 4 - 0.2; g.beginPath(); g.moveTo(px + 18, py + 8); g.quadraticCurveTo(px + 18 + Math.cos(an) * 10, py + 4 + Math.sin(an) * 8, px + 18 + Math.cos(an) * 15, py + 10 + Math.sin(an) * 6 + 4); g.lineTo(px + 18 + Math.cos(an) * 8, py + 9); g.closePath(); g.fill(); }
          g.fillStyle = "#6a4a2a"; g.fillRect(px + 16, py + 9, 4, 3);
          break;
        }''')
rep('''      case ROOF: {
        g.fillStyle = "#a8432f"; g.fillRect(px, py, TS, TS);
        g.fillStyle = "#8a3424";''','''      case ROOF: case ROOF2: {
        const bl = t === ROOF2, RF = bl ? ROOF2 : ROOF;
        g.fillStyle = bl ? "#3a5fa8" : "#a8432f"; g.fillRect(px, py, TS, TS);
        g.fillStyle = bl ? "#2e4c88" : "#8a3424";''')
rep('''        g.fillStyle = "#c2563f"; for (let r = 0; r < 4; r++) g.fillRect(px, py + r * 8, TS, 1);
        if (nb(0, -1) !== ROOF) { g.fillStyle = "#6a261b"; g.fillRect(px, py, TS, 4); }
        if (nb(-1, 0) !== ROOF) { g.fillStyle = "#7a2d20"; g.fillRect(px, py, 3, TS); }
        if (nb(1, 0) !== ROOF) { g.fillStyle = "#7a2d20"; g.fillRect(px + TS - 3, py, 3, TS); }
        if (nb(0, 1) !== ROOF) { g.fillStyle = "#5a2016"; g.fillRect(px, py + TS - 4, TS, 4); }''','''        g.fillStyle = bl ? "#4f74c0" : "#c2563f"; for (let r = 0; r < 4; r++) g.fillRect(px, py + r * 8, TS, 1);
        if (nb(0, -1) !== RF) { g.fillStyle = bl ? "#22386a" : "#6a261b"; g.fillRect(px, py, TS, 4); }
        if (nb(-1, 0) !== RF) { g.fillStyle = bl ? "#2a4278" : "#7a2d20"; g.fillRect(px, py, 3, TS); }
        if (nb(1, 0) !== RF) { g.fillStyle = bl ? "#2a4278" : "#7a2d20"; g.fillRect(px + TS - 3, py, 3, TS); }
        if (nb(0, 1) !== RF) { g.fillStyle = bl ? "#1c2e5a" : "#5a2016"; g.fillRect(px, py + TS - 4, TS, 4); }''')
rep('if (nb(0, -1) === ROOF) { g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(px, py, TS, 4); }','if (nb(0, -1) === ROOF || nb(0, -1) === ROOF2) { g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(px, py, TS, 4); }')
rep('n.shop === "smith" ? "#7a7f88" : null','n.shop === "smith" || n.shop === "armory" || id === "kapitan" ? "#7a7f88" : null')
rep('SHOPS[shopId]','shopList(shopId)',2)
rep('text(shopId === "smith" ? "Kuźnia Bogumiła" : "Chata Zielarki", x + 14','text(SHOPN[shopId], x + 14')
rep('text(shopId === "smith" ? "Kupiony sprzęt załóż w torbie." : "Miksturę wypijesz przyciskiem z fiolką."','text(shopId === "smith" || shopId === "armory" ? "Sprzęt dla klasy: " + C().n + ". Załóż go w torbie." : "Mikstury: H – leczenie, G – mana/energia."')
rep('function onBlur(): void { for (const k of Object.keys(keys)) keys[k] = false; for (const k of Object.keys(holds)) delete holds[Number(k)]; }','function onBlur(): void { for (const k of Object.keys(keys)) keys[k] = false; for (const k of Object.keys(pad.ptr)) delete pad.ptr[Number(k)]; }')
rep('while (qi < q.length && qi < 3000) {','while (qi < q.length && qi < 8000) {')
rep('log("Witaj w Osadzie Brzozowej!", "#f5d98a");','log("Witaj w Ardanie!", "#f5d98a");')
rep('''  function heldDir(): number[] | null {
    let dx = 0, dy = 0;
    if (keys["ArrowLeft"] || keys["a"]) dx = -1; else if (keys["ArrowRight"] || keys["d"]) dx = 1;
    if (keys["ArrowUp"] || keys["w"]) dy = -1; else if (keys["ArrowDown"] || keys["s"]) dy = 1;
    for (const k of Object.keys(holds)) { const v = holds[Number(k)]; if (v === 0) dy = -1; if (v === 1) dy = 1; if (v === 2) dx = -1; if (v === 3) dx = 1; }
    if (dx === 0 && dy === 0) return null;
    return [dx, dy];
  }
''','')
open('engine.ts','w').write(s)
print('ok', len(s), s.count('\n'))
