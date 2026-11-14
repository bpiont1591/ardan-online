  // ---------- CLASSES ----------
  const CLS: { [k: string]: any } = {
    war: { n: "Wojownik", hp0: 62, hpL: 18, atk0: 5, atkL: 2, defL: 1.3, rng: 1, cd: 0.75, crit: 0.12, dodge: 0.08, res: "Energia", rc: "#e8a33a", mp0: 100, mpL: 0, reg: 7,
      look: { body: "#8a3a2e", skin: "#f0c9a0", hair: "#3a2414", helmet: true }, wk: "sw",
      desc: "Mistrz walki wręcz. Najwięcej życia i obrony, nosi ciężkie zbroje.", st: [5, 3, 5, 1] },
    arc: { n: "Łucznik", hp0: 52, hpL: 14, atk0: 4, atkL: 2.1, defL: 0.95, rng: 6, cd: 0.85, crit: 0.2, dodge: 0.13, res: "Energia", rc: "#e8a33a", mp0: 100, mpL: 0, reg: 7,
      look: { body: "#3f7a3a", skin: "#f0c9a0", hair: "#8a5a2a", hood: true }, wk: "bow",
      desc: "Razi wrogów strzałami z daleka. Częste trafienia krytyczne i uniki.", st: [3, 4, 3, 5] },
    mag: { n: "Mag", hp0: 44, hpL: 11.5, atk0: 6, atkL: 2.4, defL: 0.7, rng: 6, cd: 0.95, crit: 0.1, dodge: 0.08, res: "Mana", rc: "#4a8aff", mp0: 70, mpL: 9, reg: 2.6,
      look: { body: "#4a3a8a", skin: "#f0c9a0", hair: "#d8d8e8", robe: true, wiz: true }, wk: "staff",
      desc: "Ciska zaklęciami zużywającymi manę. Najsilniejsze ataki, ale wątłe ciało.", st: [2, 5, 2, 5] },
  };
  const CLSORDER = ["war", "arc", "mag"];
  const SK: { [k: string]: any[] } = {
    war: [
      { n: "Potężny cios", lvl: 1, cost: 25, cd: 5, ic: "smash", d: "Cios za 220% obrażeń, ogłusza na 1 s." },
      { n: "Wir ostrzy", lvl: 3, cost: 35, cd: 9, ic: "whirl", d: "Rani wszystkich wrogów wokół (160%)." },
      { n: "Okrzyk bojowy", lvl: 5, cost: 40, cd: 22, ic: "shout", d: "Leczy 25% życia, +60% obrony na 8 s." }],
    arc: [
      { n: "Celny strzał", lvl: 1, cost: 25, cd: 6, ic: "aim", d: "Strzała za 260% obrażeń, zasięg 8." },
      { n: "Deszcz strzał", lvl: 3, cost: 40, cd: 10, ic: "rain", d: "Grad strzał na obszar wokół celu (130%)." },
      { n: "Sokole oko", lvl: 5, cost: 35, cd: 20, ic: "eye", d: "Szybsze strzały i +25% kryt. przez 7 s." }],
    mag: [
      { n: "Kula ognia", lvl: 1, cost: 18, cd: 4, ic: "fire", d: "Ognista kula za 240%, rani też sąsiadów." },
      { n: "Nova mrozu", lvl: 3, cost: 30, cd: 10, ic: "frost", d: "Lodowy wybuch wokół (130%), zamraża 2,5 s." },
      { n: "Odnowa", lvl: 5, cost: 35, cd: 16, ic: "heal", d: "Przywraca 40% życia." }],
  };
  const MAXLVL = 30;

  // ---------- STATE ----------
  const SAVE_KEY = "ardan_kroniki_mgiel_v2", OLD_KEY = "ardan_kroniki_mgiel_v1";
  const fresh = (): any => ({ v: 2, cls: "", lvl: 1, xp: 0, hp: 60, mp: 100, gold: 20, area: "village", x: 18, y: 17, inv: [{ id: "pot", n: 3 }], eq: { w: null, a: "shirt" }, q: {}, kills: 0, intro: false, track: "", seen: { village: 1 }, mmz: 1 });
  let P: any = fresh();
  let migrated = false;
  try {
    const ls = window.localStorage;
    const s = ls ? ls.getItem(SAVE_KEY) : null;
    if (s) { const o = JSON.parse(s); if (o && o.lvl && AREAS[o.area]) P = Object.assign(fresh(), o); }
    else {
      const s1 = ls ? ls.getItem(OLD_KEY) : null;
      if (s1) { const o = JSON.parse(s1); if (o && o.lvl && AREAS[o.area]) { P = Object.assign(fresh(), o); P.cls = ""; P.v = 2; migrated = true; P.seen = { village: 1 }; P.seen[P.area] = 1; } }
    }
  } catch (e) { /* no storage */ }
  if (!Array.isArray(P.inv)) P.inv = [];
  P.inv = P.inv.filter((s: any) => s && ITEMS[s.id] && s.n > 0);
  if (!P.eq || typeof P.eq !== "object") P.eq = { w: null, a: null };
  if (P.eq.w && !ITEMS[P.eq.w]) P.eq.w = null;
  if (P.eq.a && !ITEMS[P.eq.a]) P.eq.a = null;
  if (!P.q || typeof P.q !== "object") P.q = {};
  if (!P.seen) P.seen = {};
  P.seen[P.area] = 1;
  if (P.cls && !CLS[P.cls]) P.cls = "";
  P.lvl = clamp(Math.floor(P.lvl) || 1, 1, MAXLVL);
  if (solidT(AREAS[P.area], P.x, P.y)) {
    const a0 = AREAS[P.area]; let done = false;
    for (let r = 1; r < 12 && !done; r++) for (let dy = -r; dy <= r && !done; dy++) for (let dx = -r; dx <= r && !done; dx++) {
      if (!solidT(a0, P.x + dx, P.y + dy)) { P.x += dx; P.y += dy; done = true; }
    }
  }
  let lastSave = 0;
  function save(): void { try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(P)); } catch (e) { /* ignore */ } }

  const pl: any = { fx: P.x, fy: P.y, mt: 1, dir: 0, phase: 0, cd: 0, anim: 0, hit: 0, path: [] as number[][], target: null as any, talk: null as string | null, repath: 0, dead: 0,
    skcd: [0, 0, 0], buffDef: 0, haste: 0, combat: 0, nomp: 0, resp: ["village", 18, 17] };
  const C = (): any => CLS[P.cls || "war"];
  const xpNext = (l: number): number => Math.floor(40 * Math.pow(l, 1.65));
  const maxHp = (): number => Math.round(C().hp0 + (P.lvl - 1) * C().hpL + (P.eq.a ? ITEMS[P.eq.a].def * 2 : 0));
  const maxMp = (): number => Math.round(C().mp0 + (P.lvl - 1) * C().mpL + (P.eq.a && ITEMS[P.eq.a].mp ? ITEMS[P.eq.a].mp : 0));
  const atk = (): number => Math.round(C().atk0 + P.lvl * C().atkL + (P.eq.w ? ITEMS[P.eq.w].atk : 0));
  const def = (): number => Math.round((P.lvl * C().defL + (P.eq.a ? ITEMS[P.eq.a].def : 0)) * (pl.buffDef > 0 ? 1.6 : 1));
  const canUse = (id: string): boolean => { const it = ITEMS[id]; return !it.cls || !P.cls || it.cls.split(" ").indexOf(P.cls) >= 0; };
  const resolve = (id: string): string => { if (id.charAt(0) !== "$") return id; const g = GEAR[P.cls || "war"]; return g[id.charAt(1)][Number(id.charAt(2)) - 1]; };
  if (P.cls) { P.hp = Math.min(P.hp, maxHp()); P.mp = Math.min(typeof P.mp === "number" ? P.mp : maxMp(), maxMp()); }

  const mobs: { [k: string]: any[] } = {};
  Object.keys(AREAS).forEach((k: string) => {
    mobs[k] = AREAS[k].spawns.map((s: any[]) => {
      const d = MON[s[0]];
      return { k: s[0], d, x: s[1], y: s[2], fx: s[1], fy: s[2], hx: s[1], hy: s[2], mt: 1, hp: d.hp, dead: false, rt: 0, cd: 1, wt: R() * 3, aggro: false, hit: 0, dir: 0, anim: 0, frz: 0, sl: d.slam || 0 };
    });
  });
  const bags: any[] = [];
  const fx: any[] = [];
  const msgs: any[] = [];
  const shots: any[] = [];
  const warns: any[] = [];
  const pend: any[] = [];
  let time = 0;
  let banner = 3.5;
  let trans: any = null;
  let panel = "";
  let dlg: any = null;
  let shopId = "", shopTab = "buy", sellPage = 0, invSel = -1, resetArm = 0;
  let selCls = "war", mapTab = "area", qPage = 0;
  let guide: any = null, guideT = 0;
  let touchMode = typeof window !== "undefined" && (("ontouchstart" in window) || (!!window.matchMedia && window.matchMedia("(pointer: coarse)").matches));
  let clickMark: number[] | null = null;
  const keys: { [k: string]: boolean } = {};
  // ---------- INPUT -> INTENTS ----------
  // Devices (keyboard, arrow d-pad, buttons, taps) never move the player directly.
  // Each tick they are sampled into one Intent { mx, my, acts }; the simulation
  // consumes only Intents, so movement is deterministic and a future server
  // can run the same applyIntent() on intents received over the network.
  type Act = { a: string; i?: number; area?: string; id?: string };
  type Intent = { mx: number; my: number; acts: Act[] };
  const actQ: Act[] = [];
  const act = (a: Act): void => { if (actQ.length < 16) actQ.push(a); };
  let extDir: number[] | null = null; // external direction source (tests / replay / network)
  // on-screen arrow d-pad: each touching pointer holds a direction (multi-touch sums them)
  const pad: { cx: number; cy: number; s: number; ptr: { [id: number]: number[] } } = { cx: 0, cy: 0, s: 46, ptr: {} };
  let W = 300, H = 300, S = 1, camX = 0, camY = 0, dpr = 1;
  let ui: any[] = [];
  let hover: any = null;
  let mouse: any = null;
  const isTouch = typeof window !== "undefined" && ("ontouchstart" in window || (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0));
  if (isTouch) touchMode = true;

  const A = (): Area => AREAS[P.area];
  const log = (t: string, c?: string): void => { msgs.push({ t, c: c || "#efe6d2", life: 9 }); if (msgs.length > 6) msgs.shift(); };
  const ftext = (x: number, y: number, t: string, c: string, size?: number): void => { fx.push({ k: "txt", x, y, t, c, life: 1.1, max: 1.1, s: size || 14 }); };
  const burst = (x: number, y: number, c: string, n: number, sp?: number): void => {
    for (let i = 0; i < n; i++) { const an = R() * Math.PI * 2, v = (sp || 60) * (0.4 + R()); fx.push({ k: "p", x, y, vx: Math.cos(an) * v, vy: Math.sin(an) * v - 20, c, life: 0.5 + R() * 0.5, max: 1 }); }
  };
  const rpos = (e: any): number[] => [(e.fx + (e.x - e.fx) * e.mt) * TS, (e.fy + (e.y - e.fy) * e.mt) * TS];
  const pl2 = (): any => ({ fx: pl.fx, fy: pl.fy, x: P.x, y: P.y, mt: pl.mt });
  function pickClass(c: string): void {
    P.cls = c;
    const conv = (id: string): string => {
      for (const sl of ["w", "a"]) { const i = GEAR.war[sl].indexOf(id); if (i >= 0 && !canUse(id)) return GEAR[c][sl][i]; }
      return id;
    };
    if (migrated) {
      P.eq.w = P.eq.w ? conv(P.eq.w) : GEAR[c].w[0];
      P.eq.a = P.eq.a ? conv(P.eq.a) : null;
      P.inv.forEach((s: any) => { s.id = conv(s.id); });
      log("Przeniesiono postać z poprzedniej wersji gry.", "#f5d98a");
      migrated = false;
    } else P.eq.w = GEAR[c].w[0];
    P.hp = maxHp(); P.mp = maxMp(); banner = 3; panel = ""; dlg = null;
    pl.skcd = [0, 0, 0];
    log("Wybrano klasę: " + CLS[c].n + ".", "#f5d98a");
    save();
  }
