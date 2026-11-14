'use strict';
// ARDAN – lochy, rzemiosło, zbieractwo, zadania dzienne, nagrody za logowanie i osiągnięcia.
// Rozszerza ARDAN_UI (game-ui.js). Cała logika jest po stronie serwera.
(function () {
  const U = window.ARDAN_UI; if (!U) return;
  const H = U.h, E = U.ext, S = U.state;
  // dungeon loot in the hover / long-press tooltip
  E.tipItem = (t) => { const l = t.closest('[data-dgl]'); const D = X.dg; if (!l || !D) return null; const it = (D.loot || []).find((x) => x.u === l.dataset.dgl); return it ? [it, { from: 'loot' }, l] : null; };
  const { esc, $, el, panel, closePanels, toast, curBody, iconHtml, nameHtml, RAR, CLS_N, SLOT_N, pctW } = H;
  const send = (m) => H.send(m);
  const NETf = () => H.NET();
  const MAT_IC = { herb: 'herb', ore: 'ore', wood: 'wood', crystal: 'crystal' };
  const MAT_N = { herb: 'Ziele lecznicze', ore: 'Ruda żelaza', wood: 'Drewno dębowe', crystal: 'Kryształ mgły' };
  const CRAFT_NPC = { kowal: 'smith', platnerz: 'smith', alchemik: 'alch', zielarka: 'alch', portsmith: 'smith', fortsmith: 'smith', citsmith: 'smith', starsmith: 'smith', portalch: 'alch', fortalch: 'alch', citalch: 'alch', staralch: 'alch' };
  const X = S.x = { objs: {}, dg: null, gate: null, cr: null, dq: null, ach: null, loginToast: false };
  const matIcon = (k, size) => iconHtml({ ic: MAT_IC[k], t: 0, r: k === 'crystal' ? 2 : 0 }, size || 24);
  const fmtT = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return `${h} godz. ${String(m).padStart(2, '0')} min`; };
  const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
  const needHtml = (need, mats) => Object.keys(need).filter((k) => need[k]).map((k) => `<span class="nd ${(mats[k] || 0) >= need[k] ? 'ok' : 'no'}">${matIcon(k, 20)}${need[k]}<small>/${mats[k] || 0}</small></span>`).join('');

  // ---------- world objects: gathering nodes & dungeon gates ----------
  function allObjs() { return Object.keys(X.objs).flatMap((a) => X.objs[a]); }
  function drawObj(g, o, px, py, TS, t) {
    const s = TS / 16, p = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(px + x * s, py + y * s, w * s, h * s); };
    if (o.k === 'gate') {
      p(-6, -14, 28, 30, 'rgba(0,0,0,.25)');
      p(-5, -16, 26, 32, '#5d5866'); p(-3, -14, 22, 30, '#77717f'); p(1, -10, 14, 26, '#0d0a10'); p(3, -12, 10, 2, '#0d0a10');
      p(-5, -17, 26, 3, '#4a4652'); p(6, -20, 4, 4, '#8a2b2b');
      for (const [tx, ty] of [[-5, -4], [19, -4]]) { p(tx, ty, 2, 6, '#3b2a1a'); const f = 0.6 + 0.4 * Math.sin(t * 9 + tx); p(tx - 1, ty - 3, 4, 3, `rgba(255,${150 + 60 * f | 0},40,${0.8})`); p(tx, ty - 5, 2, 2, 'rgba(255,230,120,.9)'); }
      const gl = 0.35 + 0.25 * Math.sin(t * 2); p(2, -8, 12, 22, `rgba(120,80,200,${gl})`);
      g.font = `bold ${Math.round(5.5 * s)}px Inter, sans-serif`; g.textAlign = 'center';
      const lx = px + 8 * s, ly = py - 23 * s, txt = `🕳 ${o.n} (poz. ${o.lv})`;
      const w = g.measureText(txt).width + 8; g.fillStyle = 'rgba(10,6,16,.78)'; g.fillRect(lx - w / 2, ly - 6 * s, w, 8 * s);
      g.fillStyle = '#f2d04b'; g.fillText(txt, lx, ly); g.textAlign = 'left';
      return;
    }
    const gone = !o.r, bob = gone ? 0 : Math.sin(t * 2 + o.x) * 0.4;
    if (o.k === 'herb') {
      if (gone) { p(7, 12, 2, 3, '#5a7a3a'); p(6, 11, 4, 1, '#6f8f45'); return; }
      p(3, 13, 10, 2, 'rgba(0,0,0,.25)'); p(4, 8 + bob, 8, 6, '#3f7a2c'); p(2, 9, 4, 4, '#4f9a34'); p(10, 9, 4, 4, '#4f9a34'); p(5, 5 + bob, 6, 4, '#5fae3c');
      p(5, 6 + bob, 2, 2, '#e85d8a'); p(10, 8, 2, 2, '#e8d35d'); p(3, 10, 1, 1, '#e8d35d'); p(7, 4 + bob, 2, 2, '#9be36b');
      const sp = (t * 1.5 + o.x) % 3; if (sp < 0.6) p(11, 4, 1, 1, '#fff');
    } else if (o.k === 'ore') {
      if (gone) { p(4, 12, 8, 3, '#55525a'); p(5, 11, 4, 1, '#66626b'); return; }
      p(2, 13, 12, 2, 'rgba(0,0,0,.3)'); p(2, 7, 12, 7, '#6d6a72'); p(4, 4, 8, 4, '#85818b'); p(1, 9, 2, 5, '#5a5760'); p(13, 8, 2, 5, '#5a5760');
      p(5, 8, 2, 2, '#d08d48'); p(9, 10, 2, 2, '#d08d48'); p(10, 6, 2, 1, '#e8a86a'); p(4, 4, 4, 1, 'rgba(255,255,255,.4)');
      const sp = (t * 1.3 + o.y) % 2.5; if (sp < 0.5) p(6, 8, 1, 1, '#fff');
    } else if (o.k === 'wood') {
      if (gone) { p(5, 11, 6, 4, '#6a4626'); p(5, 11, 6, 1, '#c79a62'); return; }
      p(1, 13, 14, 2, 'rgba(0,0,0,.25)'); p(1, 9, 14, 4, '#7a4f2a'); p(3, 5, 12, 4, '#8a5a30'); p(1, 9, 14, 1, '#a8743f'); p(3, 5, 12, 1, '#a8743f');
      p(0, 9, 2, 4, '#d8b07a'); p(2, 5, 2, 4, '#d8b07a'); p(0, 10, 1, 1, '#8a5a30'); p(2, 6, 1, 1, '#8a5a30'); p(12, 3, 2, 2, '#4f9a34');
    }
  }
  function onObjTap(o) {
    if (U.inBattle() || X.dg) return;
    send({ t: 'ob', a: 'use', i: o.i });
  }

  // context button for touch users
  let ctxEl = null, ctxAct = null;
  function nearThing() {
    const N = NETf(); if (!N || !N.api) return null;
    let P; try { P = N.api.P(); } catch (e) { return null; }
    for (const o of X.objs[P.area] || []) {
      if (o.k === 'gate' && cheb(o.x, o.y, P.x, P.y) <= 2) return { lab: `🕳 ${o.n}`, o };
      if (o.k !== 'gate' && o.r && cheb(o.x, o.y, P.x, P.y) <= 1) return { lab: `⛏ Zbierz: ${{ herb: 'zioła', ore: 'rudę', wood: 'drewno' }[o.k]} (E)`, o };
    }
    const npcs = N.api.npcs || {};
    for (const k of Object.keys(CRAFT_NPC)) { const n = npcs[k]; if (n && n.area === P.area && cheb(n.x, n.y, P.x, P.y) <= 1) return { lab: CRAFT_NPC[k] === 'smith' ? '⚒ Kuźnia (E)' : '⚗ Pracownia alchemika (E)', type: CRAFT_NPC[k] }; }
    for (const k of Object.keys(npcs)) { const n = npcs[k]; if (n.trade && n.area === P.area && cheb(n.x, n.y, P.x, P.y) <= 2) return { lab: n.trade === 'aukcja' ? '⚖ Dom aukcyjny' : '💰 Sprzedaj przedmioty', trade: n.trade }; }
    return null;
  }
  function tickLogin() {
    const chatOpen = !!document.querySelector('.chat.open');
    if (X.loginEl && (chatOpen || U.inBattle())) { X.loginEl.remove(); X.loginEl = null; X.loginPend = Date.now() + 4000; }
    if (!X.loginPend || Date.now() < X.loginPend || !X.dq || X.dq.login.got) return;
    if (chatOpen || S.open || U.inBattle() || X.dg) return;
    X.loginPend = 0;
    const L = X.dq.login;
    const t = X.loginEl = toast(`🎁 <b>Nagroda za logowanie – dzień ${L.streak}/7</b><br><small>${esc((L.days[L.streak - 1] || {}).n || '')}</small>`, '<button type="button" data-lt="get">Odbierz</button><button type="button" class="no" data-lt="show">Kalendarz</button>', 10000);
    t.addEventListener('click', (e) => { const b = e.target.closest('[data-lt]'); if (!b) return; if (b.dataset.lt === 'get') send({ t: 'dq', a: 'login' }); else openDq(); t.remove(); X.loginEl = null; });
    setTimeout(() => { if (X.loginEl === t) X.loginEl = null; }, 10100);
  }
  function tickCtx() {
    tickLogin();
    if (!ctxEl) return;
    const dlgOpen = !!(window.ARDAN_DEBUG && window.ARDAN_DEBUG.dlg);
    const th = (!U.inBattle() && !X.dg && !S.open && !dlgOpen) ? nearThing() : null;
    ctxAct = th; ctxEl.hidden = !th; if (th && ctxEl.textContent !== th.lab) ctxEl.textContent = th.lab;
  }
  function useCtx() {
    const th = ctxAct; if (!th) return;
    if (th.o) send({ t: 'ob', a: 'use', i: th.o.i }); else if (th.trade) send({ t: 'npc', a: 'open', k: th.trade }); else send({ t: 'craft', a: 'open', type: th.type });
  }

  // ---------- dungeon gate dialog ----------
  function gateHtml(g) {
    const party = (g.party || []).map((m) => `<div class="gm"><i class="dot on"></i><span><b>${esc(m.n)}</b><small>${esc(CLS_N[m.c] || '')} · poz. ${m.l}${m.locked ? ' · <em class="bad">już był dziś</em>' : ''}${m.far ? ' · za daleko' : ''}</small></span></div>`).join('');
    const lv = Array.isArray(g.lv) ? `${g.lv[0]}–${g.lv[1]}` : g.lv;
    return `<div class="dg-gate"><p class="muted">Instancja dla twojej drużyny · zalecany poziom <b>${lv}</b> · komnat: <b>${g.rooms}</b></p>
      <div class="card"><h4>👑 Boss: ${esc(g.bn)}</h4><ul class="mech">${(g.mech || []).map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
      <p class="muted">Najlepsze łupy w grze: elity i boss mają dużą szansę na przedmioty <b style="color:${RAR[2].col}">heroiczne</b> i <b style="color:${RAR[3].col}">legendarne</b>.</p></div>
      ${g.locked ? `<div class="card bad">Już pokonałeś tego bossa dzisiaj. Loch odnowi się za <b>${fmtT(g.reset)}</b> (o północy).</div>` : ''}
      <h4>Drużyna</h4><div class="glist">${party || '<p class="muted">Wchodzisz sam.</p>'}</div>
      ${g.solo ? '<p class="muted warn">⚠ Wejście w pojedynkę jest możliwe, ale bardzo trudne. Zaproś znajomych (dotknij gracza → „Zaproś do drużyny”).</p>' : '<p class="muted">Członkowie drużyny stojący w pobliżu wejdą razem z tobą.</p>'}
      ${g.lvl < (Array.isArray(g.lv) ? g.lv[0] : 1) ? `<p class="muted warn">⚠ Twój poziom (${g.lvl}) jest niższy niż zalecany.</p>` : ''}
      ${DEMO && g.lvl < 14 ? '<div class="row"><button type="button" class="btn sec" data-open="boost">⚡ Demo: przygotuj postać (poziom 14)</button></div>' : ''}
      <div class="row"><button type="button" class="btn" data-dge="${esc(g.id)}" ${g.locked ? 'disabled' : ''}>${g.active ? 'Wróć do lochu' : g.solo ? 'Wejdź sam' : 'Wejdź z drużyną'}</button><button type="button" class="btn sec" data-close>Nie teraz</button></div></div>`;
  }
  function openGate(g) { X.gate = g; panel('dgg', `🕳 ${esc(g.n)}`, gateHtml(g), 'wide'); }

  // ---------- dungeon room overlay ----------
  let dgEl = null;
  const PAL = { goblin: ['#3b2f22', '#46382a', '#2a2018', '#5d4a33'], crypt: ['#25343a', '#2c3f45', '#17242a', '#3e5a60'], tomb: ['#6b5734', '#7a643c', '#4a3b22', '#9a8150'] };
  function drawRoom(c, D) {
    const g = c.getContext('2d'), T = 32, W = 11, Hh = 7; g.imageSmoothingEnabled = false;
    const pal = PAL[D.id] || PAL.goblin, N = NETf();
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const wall = y === 0 || x === 0 || x === W - 1 || y === Hh - 1;
      const h = (x * 7 + y * 13 + D.room * 5) % 4;
      g.fillStyle = wall ? pal[2] : pal[h & 1]; g.fillRect(x * T, y * T, T, T);
      if (wall) { g.fillStyle = pal[3]; g.fillRect(x * T + 2, y * T + 2, T - 4, 6); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x * T, y * T + T - 4, T, 4); }
      else { g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x * T, y * T, T, 1); g.fillRect(x * T, y * T, 1, T); if (h === 3) { g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(x * T + 8, y * T + 10, 6, 4); } }
    }
    const t = performance.now() / 1000;
    for (const tx of [2, 5, 8]) { const f = 0.5 + 0.5 * Math.sin(t * 8 + tx); g.fillStyle = '#3b2a1a'; g.fillRect(tx * T + 14, 10, 4, 14); g.fillStyle = `rgba(255,${140 + 80 * f | 0},40,.95)`; g.fillRect(tx * T + 12, 4, 8, 8); g.fillStyle = 'rgba(255,200,90,.12)'; g.beginPath(); g.arc(tx * T + 16, 10, 28, 0, 7); g.fill(); }
    if (D.boss) { g.fillStyle = 'rgba(160,30,40,.18)'; g.beginPath(); g.arc(5.5 * T, 2.8 * T, 70, 0, 7); g.fill(); }
    // exit door
    g.fillStyle = D.cleared ? '#c9a45c' : '#2a2030'; g.fillRect((W - 1) * T + 4, 3 * T, T - 8, T);
    // party at the entrance
    (D.party || []).forEach((m, i) => { g.save(); g.translate(T * 0.6, T * (2.3 + i * 1.1)); try { N.api.drawChar(g, m.c, null, null, 0); } catch (e) {} g.restore(); });
    for (const gr of D.groups) {
      gr.foes.forEach((f, j) => {
        const sc = f.boss ? (f.sc || 1.6) : 1, k = f.boss ? 1.5 : 1;
        g.save(); g.translate(gr.x * T + j * 18 - 6, gr.y * T - (f.boss ? 18 : 2)); g.scale(k, k);
        if (gr.done) g.globalAlpha = 0.25;
        try { N.api.drawMob(g, f.k); } catch (e) {}
        g.restore();
        void sc;
      });
      if (!gr.done) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 4 + gr.i);
        g.strokeStyle = gr.foes.some((f) => f.boss) ? `rgba(255,80,80,${0.5 + pulse * 0.5})` : `rgba(242,208,75,${0.4 + pulse * 0.5})`; g.lineWidth = 2;
        g.strokeRect(gr.x * T - 8, gr.y * T - 8, 32 + 18 * (gr.foes.length - 1) + 16, 48);
      } else { g.fillStyle = '#ddd'; g.font = 'bold 12px sans-serif'; g.fillText('✔', gr.x * T + 8, gr.y * T + 30); }
    }
  }
  function dgHtml(D) {
    const pips = D.rooms.map((r, i) => `<i class="${r.done ? 'done' : ''} ${i === D.room ? 'cur' : ''} ${r.boss ? 'boss' : ''}" title="${esc(r.n)}">${r.boss ? '👑' : i + 1}</i>`).join('');
    const groups = D.groups.map((g) => `<button type="button" class="dgf ${g.done ? 'done' : ''} ${g.foes.some((f) => f.boss) ? 'boss' : ''}" data-dgf="${g.i}" ${g.done || g.busy ? 'disabled' : ''}>
      <b>${g.done ? '✔ Pokonani' : g.busy ? '⚔ Trwa walka…' : g.foes.some((f) => f.boss) ? '👑 Walcz z bossem' : '⚔ Atakuj grupę'}</b>
      <small>${g.foes.map((f) => `${esc(f.n)} (${f.lvl})`).join(', ')}</small></button>`).join('');
    const party = D.party.map((m) => `<div class="dgp"><b>${esc(m.n)}</b> <small>${esc(CLS_N[m.c] || '')} ${m.l}${m.bt ? ' · walczy' : ''}</small><div class="bar hp"><i style="width:${pctW(m.hp, m.mh)}%"></i><span>${m.hp}/${m.mh}</span></div></div>`).join('');
    const loot = D.loot && D.loot.length ? `<h4>Twoje łupy z lochu</h4><div class="loot">${D.loot.map((it) => `<button type="button" class="lt" data-dgl="${esc(it.u)}">${iconHtml(it, 36)}<span>${nameHtml(it)}<small style="color:${RAR[it.r].col}">${RAR[it.r].n}${it.q > 1 ? ' ×' + it.q : ''}</small></span></button>`).join('')}</div>` : '';
    const fin = D.fin ? `<div class="card win"><h3>🏆 Loch ukończony!</h3><p>${esc(D.bn)} pokonany. Następna próba po północy (czas polski).</p></div>` : '';
    const boss = D.boss && !D.fin ? `<div class="card mechc"><b>👑 ${esc(D.bn)}</b><ul class="mech">${D.mech.map((m) => `<li>${esc(m)}</li>`).join('')}</ul></div>` : '';
    return `<div class="dg-head"><div><b>🕳 ${esc(D.n)}</b><small>Komnata ${D.room + 1}/${D.rooms.length}: ${esc(D.rn)}</small></div><div class="pips">${pips}</div></div>
      <canvas id="dgRoom" width="352" height="224" aria-label="Komnata lochu"></canvas>
      ${fin}${boss}<div class="dgfs">${D.fin ? '' : groups}</div>
      <div class="row">${D.cleared && !D.last && !D.fin ? '<button type="button" class="btn" data-dg="next">Dalej ➜ następna komnata</button>' : ''}<button type="button" class="btn sec ${D.fin ? '' : 'dng'}" data-dg="leave">${D.fin ? 'Wyjdź z lochu' : 'Opuść loch'}</button></div>
      ${loot}<h4>Drużyna</h4><div class="dgparty">${party}</div>
      <p class="muted">Potwory w lochu stoją w miejscu – walka zaczyna się dopiero, gdy wybierzesz grupę. Po śmierci opuszczasz loch.</p>`;
  }
  let dgAnim = 0;
  function renderDg() {
    const D = X.dg;
    if (!D) { if (dgEl) { dgEl.remove(); dgEl = null; cancelAnimationFrame(dgAnim); H.refocus(); } return; }
    if (!dgEl) {
      dgEl = el('<div class="dgv" id="dungeon" role="dialog" aria-label="Loch"><div class="dg-in scroll"></div></div>');
      H.root().insertBefore(dgEl, H.layer());
      dgEl.addEventListener('click', onDgClick);
      closePanels();
      const loop = () => { const c = dgEl && $('#dgRoom', dgEl); if (c && X.dg) drawRoom(c, X.dg); if (dgEl) dgAnim = requestAnimationFrame(loop); };
      dgAnim = requestAnimationFrame(loop);
    }
    const box = $('.dg-in', dgEl), top = box.scrollTop; box.innerHTML = dgHtml(D); box.scrollTop = top;
  }
  function onDgClick(e) {
    const t = e.target, D = X.dg; if (!D) return;
    if (t.id === 'dgRoom') {
      const r = t.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 11, y = (e.clientY - r.top) / r.height * 7;
      let best = null, bd = 9;
      for (const g of D.groups) { if (g.done || g.busy) continue; const d = Math.hypot(g.x + 0.5 + (g.foes.length - 1) * 0.3 - x, g.y + 0.5 - y); if (d < bd) { bd = d; best = g; } }
      if (best && bd < 2.2) send({ t: 'dg', a: 'fight', g: best.i });
      return;
    }
    const f = t.closest('[data-dgf]'); if (f && !f.disabled) { send({ t: 'dg', a: 'fight', g: +f.dataset.dgf }); return; }
    const l = t.closest('[data-dgl]'); if (l) { const it = (D.loot || []).find((x) => x.u === l.dataset.dgl); if (it) H.showDetail(it, { from: 'loot' }); return; }
    const b = t.closest('[data-dg]'); if (!b) return;
    if (b.dataset.dg === 'leave' && !D.fin && !b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'Na pewno wyjść? Postęp przepadnie'; return; }
    send({ t: 'dg', a: b.dataset.dg });
  }

  // ---------- crafting ----------
  let crTab = 'forge';
  function itemsByU() { const G = S.gear || {}; const m = {}; for (const k of Object.keys(G.gear || {})) { const it = G.gear[k]; if (it) m[it.u] = Object.assign({ worn: 1 }, it); } for (const it of G.bag || []) m[it.u] = it; return m; }
  function crHtml() {
    const C = X.cr; if (!C) return '<p class="muted">Wczytywanie…</p>';
    const mats = `<div class="mats">${Object.keys(MAT_N).map((k) => `<span class="mt">${matIcon(k, 22)}<b>${C.mats[k] || 0}</b><small>${esc(MAT_N[k])}</small></span>`).join('')}<span class="mt gold"><b>${C.gold} zł</b></span></div>`;
    const res = C.res && C.res.txt ? `<div class="crres ${C.res.ok ? 'ok' : 'no'}" id="crRes">${C.res.ok ? '✔' : '✖'} ${esc(C.res.txt)}</div>` : '';
    const talk = '<button type="button" class="btn sec sm" data-crt="talk">💬 Porozmawiaj / sklep</button>';
    if (C.open === 'alch') {
      const rows = C.recipes.map((r) => `<div class="crow"><img src="${legacy(r.id)}" width="32" height="32" alt=""><span class="cn"><b>${esc(r.n)}</b><small>masz ${r.have}</small></span><span class="need">${needHtml(r.need, C.mats)}<span class="nd">${r.gold} zł</span></span>
        <span class="cb"><button type="button" class="btn sm" data-brew="${esc(r.id)}" data-q="1" ${r.can ? '' : 'disabled'}>Uwarz</button><button type="button" class="btn sm sec" data-brew="${esc(r.id)}" data-q="5" ${r.can ? '' : 'disabled'}>×5</button></span></div>`).join('');
      return `${mats}${res}<p class="muted">Zioła zbierzesz w lasach i na bagnach (stań obok krzaczka i naciśnij E).</p><div class="clist">${rows}</div><div class="row">${talk}</div>`;
    }
    const tabs = `<div class="utabs"><button type="button" data-crtab="forge" class="${crTab === 'forge' ? 'on' : ''}">Wykuj</button><button type="button" data-crtab="up" class="${crTab === 'up' ? 'on' : ''}">Ulepsz +1…+5</button></div>`;
    if (crTab === 'up') {
      const by = itemsByU();
      const rows = C.up.map((x) => { const it = by[x.u]; if (!it) return ''; return `<div class="crow">${iconHtml(it, 36)}<span class="cn">${nameHtml(it)}<small>${it.worn ? 'założony · ' : ''}${esc(H.slotName(it.s === 'ring' ? 'ring' : it.s, it.c))} · poz. ${it.l}</small></span>
        ${x.up >= C.upMax ? '<span class="need"><span class="nd ok">maks. +5</span></span><span class="cb"></span>' : `<span class="need">${needHtml(x.need, C.mats)}<span class="nd">${x.gold} zł</span><span class="nd ch ${x.chance < 0.6 ? 'risk' : ''}">szansa ${Math.round(x.chance * 100)}%</span></span>
        <span class="cb"><button type="button" class="btn sm" data-up="${esc(x.u)}" ${x.can ? '' : 'disabled'}>+${x.up + 1}</button></span>`}</div>`; }).join('');
      return `${tabs}${mats}${res}<p class="muted">Każdy poziom ulepszenia: +10% statystyk przedmiotu. Szanse: ${C.upChance.map((c, i) => `+${i + 1}: ${Math.round(c * 100)}%`).join(' · ')}. <b>Nieudana próba zabiera tylko materiały i złoto – przedmiot zostaje.</b></p><div class="clist">${rows || '<p class="muted">Nie masz przedmiotów do ulepszenia.</p>'}</div><div class="row">${talk}</div>`;
    }
    const cls = (S.gear && S.gear.cls) || '';
    const rows = C.forge.map((f) => `<div class="crow"><span class="ic"><img src="${H.itemIcon({ ic: FORGE_IC[cls] && FORGE_IC[cls][f.s] || FORGE_IC.x[f.s], t: 1, r: 0 }, 32)}" width="32" height="32" alt=""></span><span class="cn"><b>${esc(H.slotName(f.s, cls))}</b><small>${esc(f.tier)} · na twój poziom</small></span><span class="need">${needHtml(f.need, C.mats)}<span class="nd">${f.gold} zł</span></span>
      <span class="cb"><button type="button" class="btn sm" data-forge="${esc(f.s)}" ${f.can ? '' : 'disabled'}>Wykuj</button></span></div>`).join('');
    return `${tabs}${mats}${res}<p class="muted">Kowal wykuwa losowy przedmiot dla twojej klasy (zwykle zwykły lub unikatowy, czasem lepszy). Rudę znajdziesz w lasach, jaskini i górach.</p><div class="clist">${rows}</div><div class="row">${talk}</div>`;
  }
  const FORGE_IC = { war: { weapon: 'sword', offhand: 'shield', helm: 'helm', armor: 'plate', gloves: 'gauntlet' }, arc: { weapon: 'bow', offhand: 'quiver', helm: 'hood', armor: 'leather', gloves: 'bracer' }, mag: { weapon: 'staff', offhand: 'orb', helm: 'hat', armor: 'robe', gloves: 'glove' }, x: { weapon: 'sword', offhand: 'shield', helm: 'helm', armor: 'plate', gloves: 'gauntlet', boots: 'boots', ring: 'ring', amulet: 'amulet' } };
  for (const c of ['war', 'arc', 'mag']) Object.assign(FORGE_IC[c], { boots: 'boots', ring: 'ring', amulet: 'amulet' });
  const legCache = {};
  function legacy(id) { if (legCache[id]) return legCache[id]; const c = document.createElement('canvas'); c.width = c.height = 32; try { NETf().api.drawIcon(c.getContext('2d'), id, 0, 0, 32); } catch (e) {} return (legCache[id] = c.toDataURL()); }
  function openCraft() { panel('cr', X.cr.open === 'alch' ? `⚗ ${esc(X.cr.npc || 'Alchemik')} – pracownia` : `⚒ ${esc(X.cr.npc || 'Kowal')} – kuźnia`, crHtml(), 'wide'); }
  function refreshCraft() { if (S.open !== 'cr') return openCraft(); const b = curBody(); if (!b) return; const top = b.scrollTop; b.innerHTML = crHtml(); b.scrollTop = top; }

  // ---------- daily quests & login calendar ----------
  function dqHtml() {
    const D = X.dq; if (!D) return '<p class="muted">Wczytywanie…</p>';
    const qs = D.q.map((q) => `<div class="dqq ${q.done ? 'done' : ''} ${q.got ? 'got' : ''}"><div class="dqt"><b>${esc(q.txt)}</b><small>Nagroda: ${q.xp} PD · ${q.gold} zł · materiały</small></div>
      <div class="bar xp"><i style="width:${pctW(q.have, q.need)}%"></i><span>${q.have}/${q.need}</span></div>
      ${q.got ? '<span class="okm">✔ Odebrano</span>' : `<button type="button" class="btn sm" data-dqc="${q.i}" ${q.done ? '' : 'disabled'}>Odbierz</button>`}</div>`).join('');
    const L = D.login, days = L.days.map((d) => `<div class="ld ${d.d < L.streak || (d.d === L.streak && L.got) ? 'got' : ''} ${d.d === L.streak ? 'cur' : ''} ${d.d === 7 ? 'big' : ''}"><b>Dzień ${d.d}</b><span>${d.d === 7 ? '🎁' : d.gold && !d.items && !d.mats ? '💰' : d.mats ? '⛏' : '🧪'}</span><small>${esc(d.n)}</small></div>`).join('');
    return `<p class="muted">Nowe zadania za <b>${fmtT(D.reset)}</b> (północ, czas polski).</p><div class="dql">${qs}</div>
      <h4>Nagrody za logowanie <small>seria: ${L.streak}/7</small></h4><div class="cal">${days}</div>
      <div class="row">${L.got ? '<span class="okm">✔ Dzisiejsza nagroda odebrana – wróć jutro!</span>' : `<button type="button" class="btn" data-dql>🎁 Odbierz nagrodę dnia ${L.streak}</button>`}</div>
      <p class="muted">Zaloguj się 7 dni z rzędu, aby zdobyć unikatowy przedmiot. Przerwa zeruje serię.</p>`;
  }
  function openDq() { panel('dq', '📜 Zadania dzienne', dqHtml(), 'wide'); send({ t: 'dq', a: 'get' }); }
  function refreshDq() { if (S.open !== 'dq') return; const b = curBody(); if (b) { const top = b.scrollTop; b.innerHTML = dqHtml(); b.scrollTop = top; } }

  // ---------- achievements ----------
  function achHtml() {
    const A = X.ach; if (!A) return '<p class="muted">Wczytywanie…</p>';
    const got = A.list.filter((a) => a.got);
    const titles = `<div class="titles"><button type="button" data-ti="" class="${!A.title ? 'on' : ''}">bez tytułu</button>${got.map((a) => `<button type="button" data-ti="${esc(a.id)}" class="${A.title === a.id ? 'on' : ''}">«${esc(a.t)}»</button>`).join('')}</div>`;
    const list = A.list.map((a) => `<div class="ach ${a.got ? 'got' : ''}"><span class="am">${a.got ? '🏆' : '🔒'}</span><span class="an"><b>${esc(a.n)}</b><small>${esc(a.d)} · tytuł «${esc(a.t)}»</small>${a.got ? '' : `<div class="bar xp"><i style="width:${pctW(a.have, a.need)}%"></i><span>${a.have}/${a.need}</span></div>`}</span></div>`).join('');
    return `<p class="muted">Zdobyte: <b>${got.length}/${A.list.length}</b>. Wybrany tytuł widać nad twoją postacią, przy nicku.</p><h4>Twój tytuł</h4>${titles}<h4>Osiągnięcia</h4><div class="achs">${list}</div>`;
  }
  function openAch() { panel('ach', '🏆 Osiągnięcia i tytuły', achHtml(), 'wide'); send({ t: 'ach', a: 'get' }); }
  function refreshAch() { if (S.open !== 'ach') return; const b = curBody(); if (b) { const top = b.scrollTop; b.innerHTML = achHtml(); b.scrollTop = top; } }

  // ---------- wiring ----------
  E.menu = `<button type="button" data-open="dq"><b>📜</b>Zadania dzienne<small>J</small></button><button type="button" data-open="ach"><b>🏆</b>Osiągnięcia<small>O</small></button><button type="button" data-open="dgi"><b>🕳</b>Lochy</button>`;
  function openDgInfo() {
    panel('dgi', '🕳 Lochy drużynowe', `<p class="muted">Lochy to instancje dla drużyny: kilka komnat z elitarnymi potworami i boss z własnymi mechanikami. Każdy loch możesz ukończyć raz dziennie (reset o północy czasu polskiego).</p>
      <div class="glist"><div class="gm"><span><b>Nora Goblinów</b><small>Szepczący Bór · poz. 4–8 · boss Wódz Grzmot</small></span></div>
      <div class="gm"><span><b>Zatopiona Krypta</b><small>Bagna · poz. 10–15 · boss Pani Topieli</small></span></div>
      <div class="gm"><span><b>Grobowiec Sethara</b><small>Ruiny Piasków · poz. 18–24 · boss Arcykapłan Anubhet</small></span></div>
      <div class="gm"><span><b>Kuźnia Płomieni</b><small>Wulkan Ignara · poz. 38–47 · boss Hefar, Kowal Płomieni</small></span></div>
      <div class="gm"><span><b>Serce Otchłani</b><small>Otchłań Zmierzchu · poz. 52–60 · boss Wielki Inkwizytor Otchłani</small></span></div></div>
      <p class="muted">Wejście to kamienna brama z pochodniami na mapie krainy – podejdź i dotknij jej albo naciśnij E.</p>`, 'wide');
  }
  const DEMO = !!window.DEMO_PAGES;
  if (DEMO) E.menu += '<button type="button" data-open="boost"><b>⚡</b>Demo: przygotuj postać<small>poz. 14 + materiały</small></button><button type="button" data-open="boost50"><b>🏰</b>Demo: poziom 50 w nowym mieście<small>Mewia Przystań + łupy</small></button>';
  function boost50() {
    const G = S.gear || {}; closePanels();
    send({ t: '__test', lvl: Math.max(G.lvl || 1, 50), heal: true, gold: (G.gold || 0) + 5000, loot: 8, near: { npc: 'portcap' }, mats: { herb: 40, ore: 60, wood: 20, crystal: 10 }, items: [['gpot', 5], ['selix', 3], ['mpot', 8]] });
    send({ t: 'in', mx: 0, my: 0, acts: [] });
    toast('🏰 <b>Wersja demo:</b> poziom 50, +5000 zł, 8 łupów wysokiego poziomu i eliksiry. Jesteś w Mewiej Przystani – wschodnia brama prowadzi na Wybrzeże Wraków.');
  }
  function boost() {
    const G = S.gear || {}; closePanels();
    send({ t: '__test', lvl: Math.max(G.lvl || 1, 14), heal: true, gold: (G.gold || 0) + 500, mats: { herb: 20, ore: 30, wood: 15, crystal: 5 }, items: [['bigpot', 5], ['mpot', 5]] });
    send({ t: 'in', mx: 0, my: 0, acts: [] });
    toast('⚡ <b>Wersja demo:</b> postać ma poziom 14, +500 zł, mikstury i materiały – możesz od razu wejść do lochu i używać kuźni.');
  }
  E.open = { dq: openDq, ach: openAch, dgi: openDgInfo, boost, boost50 };
  E.key = (lk, open) => {
    if (X.dg && !open) { if (lk === 'j') { openDq(); return true; } if (lk === 'o') { openAch(); return true; } return lk !== 'i'; }
    if (lk === 'j') { if (S.open === 'dq') closePanels(); else openDq(); return true; }
    if (lk === 'o') { if (S.open === 'ach') closePanels(); else openAch(); return true; }
    return false;
  };
  E.click = (t) => {
    const ge = t.closest('[data-dge]'); if (ge && !ge.disabled) { send({ t: 'dg', a: 'enter', id: ge.dataset.dge }); closePanels(); return true; }
    const br = t.closest('[data-brew]'); if (br && !br.disabled) { send({ t: 'craft', a: 'brew', id: br.dataset.brew, q: +br.dataset.q || 1 }); return true; }
    const fo = t.closest('[data-forge]'); if (fo && !fo.disabled) { send({ t: 'craft', a: 'forge', s: fo.dataset.forge }); return true; }
    const up = t.closest('[data-up]'); if (up && !up.disabled) { send({ t: 'craft', a: 'up', u: up.dataset.up }); return true; }
    const ct = t.closest('[data-crtab]'); if (ct) { crTab = ct.dataset.crtab; refreshCraft(); return true; }
    const tk = t.closest('[data-crt]'); if (tk) { closePanels(); send({ t: 'craft', a: 'talk' }); return true; }
    const dc = t.closest('[data-dqc]'); if (dc && !dc.disabled) { send({ t: 'dq', a: 'claim', i: +dc.dataset.dqc }); return true; }
    const dl = t.closest('[data-dql]'); if (dl) { send({ t: 'dq', a: 'login' }); return true; }
    const ti = t.closest('[data-ti]'); if (ti) { send({ t: 'ach', a: 'title', id: ti.dataset.ti }); return true; }
    return false;
  };
  E.onMsg = (m) => {
    const N = NETf();
    switch (m.t) {
      case 'ob': X.objs[m.a] = m.l; N.objs = allObjs(); return true;
      case 'dg':
        if (m.gate) { if (!U.inBattle()) openGate(m); return true; }
        if (m.in) { const was = !!X.dg; X.dg = m; renderDg(); if (!was) toast(`🕳 Wchodzisz do: <b>${esc(m.n)}</b>`); }
        else { X.dg = null; renderDg(); }
        return true;
      case 'craft': X.cr = m; if (U.inBattle()) return true; refreshCraft(); if (m.res && m.res.txt) { const r = $('#crRes'); if (r) { r.classList.remove('pop'); void r.offsetWidth; r.classList.add('pop'); } } return true;
      case 'dq':
        X.dq = m; refreshDq();
        if (!m.login.got && !X.loginToast) { X.loginToast = true; X.loginPend = Date.now() + 2500; }
        if (m.login.got && X.loginEl) { X.loginEl.remove(); X.loginEl = null; }
        return true;
      case 'ach': {
        X.ach = m; const a = m.list.find((x) => x.id === m.title); N.title = a ? a.t : ''; refreshAch(); return true;
      }
      case 'achnew': toast(`🏆 <b>Osiągnięcie: ${esc(m.n)}</b> <small>· tytuł «${esc(m.ti)}» (O)</small>`, '', 3500); return true;
      case 'dqdone': return true;
    }
    return false;
  };
  const baseInit = U.init;
  U.init = function (o) {
    baseInit(o);
    const N = o.NET; N.drawObj = drawObj; N.onObjTap = onObjTap; N.objs = [];
    ctxEl = el('<button type="button" class="ui-ctx" id="uiCtx" hidden></button>'); H.root().appendChild(ctxEl);
    ctxEl.addEventListener('click', () => { useCtx(); H.refocus(); });
    setInterval(tickCtx, 250);
    setInterval(() => { if (S.open === 'dq' && X.dq) { X.dq.reset = Math.max(0, X.dq.reset - 30000); } }, 30000);
    send({ t: 'dq', a: 'get' }); send({ t: 'ach', a: 'get' });
  };
})();
