'use strict';
// ARDAN – interfejs gry: walka turowa, ekwipunek, rynek, handel, gildie, PvP.
// Wszystko liczy serwer; ten plik tylko wyświetla stan i wysyła wybory gracza.
(function () {
  const SLOT_N = { helm: 'Hełm', armor: 'Zbroja', gloves: 'Rękawice', boots: 'Buty', weapon: 'Broń', offhand: 'Druga ręka', ring: 'Pierścień', ring1: 'Pierścień', ring2: 'Pierścień', amulet: 'Amulet' };
  const OFF_N = { war: 'Tarcza', arc: 'Kołczan', mag: 'Kula mocy' };
  const CLS_N = { war: 'Wojownik', arc: 'Łucznik', mag: 'Mag' };
  const RAR = [{ n: 'zwykły', col: '#d9d2c3' }, { n: 'unikatowy', col: '#f2d04b' }, { n: 'heroiczny', col: '#59a8ff' }, { n: 'legendarny', col: '#ff8a3d' }];
  const TIER_COL = ['#9a6b3c', '#b9c2cb', '#9fb2e8', '#8fbf6a', '#9fe6ff', '#ffb347', '#e8a33a', '#7fe9ff', '#ff6a2a', '#ffe9a8', '#c58cff'];
  const STAT_N = { atk: 'Atak', def: 'Obrona', hp: 'Życie', mp: 'Mana / energia', crit: 'Cios krytyczny', dodge: 'Unik' };
  const PCT = { crit: 1, dodge: 1 };
  const SKL = { 1: 650, 2: 330, 3: 120 };
  const AREA_N = { village: 'Osada Brzozowa', forest: 'Mroczny Bór', cave: 'Jaskinia Cieni', swamp: 'Bagna Żałoby', town: 'Srebrnogród', mount: 'Szczyty Szronu', desert: 'Ruiny Piasków', port: 'Mewia Przystań', coast: 'Wybrzeże Wraków', fort: 'Twierdza Żarogród', volcano: 'Wulkan Ignara', citadel: 'Cytadela Świtu', abyss: 'Otchłań Zmierzchu', wolfhills: 'Wilcze Wzgórza', mine: 'Kopalnia Krasnoludów', glacier: 'Lodowiec Wichrów', steppe: 'Spalone Stepy', elfwood: 'Szmaragdowa Puszcza', sunken: 'Zatopione Miasto', star: 'Gwiezdna Strażnica', crystal: 'Kryształowe Pustkowia', necro: 'Nekropolia Valgaru', dragon: 'Smocze Gniazdo' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (s, r) => (r || document).querySelector(s);
  const pctW = (v, m) => Math.round(100 * Math.max(0, Math.min(1, v / (m || 1))));

  let NET = null, send = () => {}, cmd = () => {}, openChat = () => {};
  const S = window.ARDAN_UI_STATE = { bt: null, gear: null, mk: null, gd: null, tr: null, pvp: null, trInv: null, npc: null, open: '' };
  let root, layer;
  const EXT = { onMsg: null, key: null, click: null, open: {}, menu: '' };

  // ---------- pixel icons ----------
  const iconCache = {};
  // item passives (mirror of server/passives.js – names and descriptions only)
  const PXN = {"ls":["Wampiryzm","{v}% zadanych obrażeń przywraca życie",0],"stun":["Ogłuszenie","{v}% szans na ogłuszenie celu przy trafieniu",0],"thorns":["Ciernie","{v}% otrzymanych obrażeń wraca do atakującego",0],"xturn":["Pośpiech","{v}% szans na dodatkowy atak w turze",0],"critd":["Okrucieństwo","+{v}% obrażeń krytycznych",0],"regen":["Źródło","+{v} many / energii co turę",0],"boss":["Pogromca","+{v}% obrażeń przeciw bossom i elitom",0],"poison":["Trucizna","{v}% szans na zatrucie celu (3 tury, 15% ataku na turę)",0],"shield":["Bariera","na start walki tarcza pochłaniająca {v} obrażeń",0],"hregen":["Odnowa","+{v}% maks. życia co turę",0],"exec":["Egzekucja","+{v}% obrażeń przeciw wrogom poniżej 30% życia",0],"block":["Blok","{v}% szans na zablokowanie połowy obrażeń",0],"first":["Inicjatywa","+{v}% obrażeń w pierwszej rundzie walki",0],"phoenix":["Feniks","raz na walkę powstajesz z {v}% życia po śmierci",1],"chain":["Łańcuch","{v}% szans, że atak trafi także drugiego wroga (60%)",1],"echo":["Echo mocy","{v}% szans, że umiejętność nie zużyje many / energii",1],"frost":["Lodowy dotyk","{v}% szans na zamrożenie celu (nie działa na bossy)",1],"soul":["Żniwiarz dusz","zabicie wroga przywraca {v}% życia",1],"berserk":["Szał","+1% obrażeń za każde 2% brakującego życia (maks. +{v}%)",1],"mirror":["Lustro","{v}% szans na odbicie całego ciosu w atakującego",1]};
  const pxLine = (k, v) => { const P = PXN[k]; return P ? `<div class="px${P[2] ? ' leg' : ''}"><b>✦ ${esc(P[0])}</b> – ${esc(P[1].replace('{v}', v))}</div>` : ''; };
  function drawPix(g, ic, metal, gem) {
    const p = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    const wood = '#7a4f2a', dark = '#1a1420', gold = '#d8b25a', lite = 'rgba(255,255,255,.55)';
    switch (ic) {
      case 'herb': p(7, 8, 2, 7, '#3f7a2c'); p(3, 5, 4, 3, '#5fae3c'); p(9, 4, 4, 3, '#5fae3c'); p(5, 1, 6, 4, '#7fd04e'); p(4, 9, 3, 2, '#4f9a34'); p(9, 9, 3, 2, '#4f9a34'); p(7, 2, 2, 2, '#e85d8a'); p(4, 5, 1, 1, '#e8d35d'); p(11, 4, 1, 1, '#e8d35d'); break;
      case 'ore': p(3, 6, 10, 8, '#6d6a72'); p(4, 4, 7, 3, '#85818b'); p(2, 9, 2, 4, '#5a5760'); p(5, 7, 2, 2, '#c98a4a'); p(9, 9, 2, 2, '#c98a4a'); p(7, 11, 2, 1, '#e0a56a'); p(5, 4, 3, 1, lite); break;
      case 'wood': p(2, 5, 12, 4, '#8a5a30'); p(2, 10, 12, 4, '#7a4f2a'); p(2, 5, 12, 1, '#a8743f'); p(2, 10, 12, 1, '#a8743f'); p(1, 5, 2, 4, '#d8b07a'); p(1, 10, 2, 4, '#d8b07a'); p(1, 6, 1, 1, '#8a5a30'); p(1, 11, 1, 1, '#8a5a30'); break;
      case 'crystal': p(7, 1, 2, 2, '#c9f3ff'); p(6, 3, 4, 4, '#7fd8ff'); p(5, 7, 6, 4, '#4fb6e8'); p(6, 11, 4, 2, '#3a8fc8'); p(7, 13, 2, 2, '#2c6fa0'); p(6, 4, 1, 4, '#fff'); p(3, 9, 2, 3, '#7fd8ff'); p(11, 8, 2, 3, '#7fd8ff'); break;
      case 'sword': p(7, 1, 2, 10, metal); p(7, 1, 1, 10, lite); p(7, 0, 2, 1, metal); p(4, 11, 8, 2, gold); p(7, 13, 2, 2, wood); p(6, 15, 4, 1, gold); break;
      case 'axe': p(7, 3, 2, 12, wood); p(9, 2, 4, 6, metal); p(12, 1, 2, 8, metal); p(13, 1, 1, 8, lite); p(5, 3, 2, 3, metal); p(7, 2, 2, 1, gold); break;
      case 'bow': for (const [x, y] of [[5, 1], [6, 1], [7, 2], [8, 3], [9, 4], [9, 5], [10, 6], [10, 7], [10, 8], [10, 9], [9, 10], [9, 11], [8, 12], [7, 13], [6, 14], [5, 14]]) p(x, y, 2, 1, x > 8 ? metal : wood);
        p(5, 1, 1, 14, '#eee6d0'); p(9, 7, 1, 2, gold); break;
      case 'staff': p(7, 4, 2, 12, wood); p(6, 4, 4, 1, gold); p(5, 0, 6, 4, metal); p(6, -0, 4, 5, metal); p(6, 1, 2, 2, lite); break;
      case 'wand': p(7, 6, 2, 9, wood); p(7, 1, 2, 5, metal); p(5, 3, 6, 1, metal); p(6, 2, 4, 3, metal); p(7, 3, 1, 1, '#fff'); break;
      case 'club': p(7, 6, 3, 9, wood); p(6, 1, 5, 6, wood); p(6, 1, 1, 6, 'rgba(0,0,0,.25)'); break;
      case 'shield': p(3, 2, 10, 8, metal); p(4, 10, 8, 2, metal); p(5, 12, 6, 1, metal); p(6, 13, 4, 1, metal); p(7, 14, 2, 1, metal); p(3, 2, 10, 1, lite); p(7, 4, 2, 8, gem); p(5, 6, 6, 2, gem); break;
      case 'quiver': p(5, 5, 6, 10, wood); p(5, 7, 6, 1, gold); p(5, 12, 6, 1, gold); p(6, 1, 1, 4, '#ddd'); p(8, 0, 1, 5, '#ddd'); p(10, 1, 1, 4, '#ddd'); p(5, 0, 2, 2, gem); p(8, 0, 1, 1, gem); p(10, 0, 2, 2, gem); p(4, 4, 8, 1, metal); break;
      case 'orb': p(6, 1, 4, 1, metal); p(4, 2, 8, 1, metal); p(3, 3, 10, 6, metal); p(4, 9, 8, 1, metal); p(6, 10, 4, 1, metal); p(5, 3, 2, 2, '#fff'); p(8, 5, 3, 3, gem); p(5, 12, 6, 2, gold); p(4, 14, 8, 1, gold); break;
      case 'plate': case 'leather': {
        const c = ic === 'plate' ? metal : '#8a5a32';
        p(3, 3, 10, 9, c); p(1, 3, 3, 3, c); p(12, 3, 3, 3, c); p(6, 3, 4, 2, dark); p(3, 11, 10, 2, ic === 'plate' ? '#5a3a1a' : metal); p(4, 13, 8, 2, c); p(3, 3, 1, 9, lite); if (ic === 'plate') p(7, 6, 2, 4, gem); break;
      }
      case 'robe': p(5, 2, 6, 4, metal); p(4, 6, 8, 4, metal); p(3, 10, 10, 5, metal); p(2, 4, 3, 5, metal); p(11, 4, 3, 5, metal); p(6, 2, 4, 2, dark); p(4, 8, 8, 1, gold); p(7, 9, 2, 6, gem); break;
      case 'helm': p(4, 3, 8, 2, metal); p(3, 5, 10, 6, metal); p(4, 8, 8, 1, dark); p(7, 8, 2, 4, metal); p(3, 11, 2, 2, metal); p(11, 11, 2, 2, metal); p(5, 3, 2, 2, lite); p(7, 1, 2, 2, gem); break;
      case 'hood': p(5, 2, 6, 3, metal); p(3, 5, 10, 8, metal); p(5, 7, 6, 5, dark); p(2, 12, 12, 2, metal); p(5, 2, 2, 2, lite); break;
      case 'hat': p(1, 12, 14, 2, metal); p(7, 1, 2, 2, metal); p(6, 3, 4, 3, metal); p(5, 6, 6, 3, metal); p(4, 9, 8, 3, metal); p(4, 10, 8, 1, gold); p(9, 0, 2, 2, metal); p(7, 7, 2, 2, gem); break;
      case 'gauntlet': case 'glove': case 'bracer': {
        const c = ic === 'glove' ? '#6a4a8a' : ic === 'bracer' ? '#8a5a32' : metal;
        p(4, 5, 7, 7, c); p(4, 2, 1, 4, c); p(6, 1, 1, 5, c); p(8, 1, 1, 5, c); p(10, 2, 1, 4, c); p(11, 7, 2, 3, c); p(3, 12, 9, 3, ic === 'gauntlet' ? gold : metal); p(6, 7, 3, 2, gem); break;
      }
      case 'boots': p(4, 2, 5, 9, metal); p(4, 11, 9, 3, metal); p(4, 14, 10, 1, '#2a1a10'); p(3, 2, 7, 2, gold); p(4, 4, 1, 7, lite); break;
      case 'ring': p(5, 6, 6, 1, metal); p(4, 7, 1, 5, metal); p(11, 7, 1, 5, metal); p(5, 12, 6, 1, metal); p(5, 7, 1, 1, lite); p(6, 2, 4, 4, gem); p(7, 1, 2, 1, gem); p(6, 2, 1, 1, '#fff'); break;
      case 'amulet': for (const [x, y] of [[3, 1], [4, 3], [5, 5], [6, 7], [12, 1], [11, 3], [10, 5], [9, 7]]) p(x, y, 1, 2, gold); p(6, 9, 4, 5, metal); p(5, 10, 6, 3, metal); p(7, 10, 2, 3, gem); p(6, 9, 1, 1, '#fff'); break;
      case 'hammer': p(7, 5, 2, 10, wood); p(3, 1, 10, 5, metal); p(3, 1, 10, 1, lite); p(2, 2, 1, 3, metal); p(13, 2, 1, 3, metal); p(7, 2, 2, 3, gem); p(6, 14, 4, 1, gold); break;
      case 'sabre': p(9, 1, 2, 2, metal); p(8, 3, 2, 3, metal); p(7, 6, 2, 4, metal); p(7, 3, 1, 7, lite); p(4, 10, 8, 2, gold); p(6, 12, 2, 3, wood); p(5, 15, 4, 1, gold); break;
      case 'spear': p(7, 4, 2, 12, wood); p(6, 0, 4, 2, metal); p(7, 2, 2, 2, metal); p(5, 4, 6, 1, gold); p(7, 0, 1, 3, lite); p(7, 6, 2, 1, gem); break;
      case 'xbow': p(2, 5, 12, 2, wood); p(7, 2, 2, 12, wood); p(2, 7, 1, 2, metal); p(13, 7, 1, 2, metal); p(3, 8, 10, 1, '#d8d2c0'); p(7, 0, 2, 2, metal); p(6, 9, 4, 2, gem); break;
      case 'scepter': p(7, 6, 2, 9, gold); p(5, 1, 6, 5, metal); p(6, 2, 4, 3, gem); p(6, 2, 1, 1, '#fff'); p(4, 3, 1, 2, gold); p(11, 3, 1, 2, gold); p(6, 14, 4, 1, gold); break;
      case 'buckler': p(4, 3, 8, 10, metal); p(3, 5, 10, 6, metal); p(6, 6, 4, 4, gold); p(7, 7, 2, 2, gem); p(4, 3, 3, 1, lite); break;
      case 'dagger': p(7, 1, 2, 8, metal); p(7, 1, 1, 8, lite); p(5, 9, 6, 1, gold); p(7, 10, 2, 4, wood); p(6, 14, 4, 1, gold); p(7, 11, 2, 1, gem); break;
      case 'tome': p(3, 2, 10, 12, '#5a2a6a'); p(4, 3, 8, 10, '#7a3a8a'); p(12, 3, 1, 10, '#efe6d2'); p(5, 6, 6, 4, gold); p(7, 7, 2, 2, gem); p(3, 2, 10, 1, gold); break;
      case 'cloak': p(5, 1, 6, 3, metal); p(4, 4, 8, 4, metal); p(3, 8, 10, 7, metal); p(6, 1, 4, 2, dark); p(7, 4, 2, 2, gold); p(3, 8, 1, 7, lite); p(7, 9, 2, 5, gem); break;
      case 'mask': p(3, 4, 10, 7, metal); p(4, 11, 8, 2, metal); p(4, 6, 3, 2, dark); p(9, 6, 3, 2, dark); p(7, 8, 2, 3, gem); p(3, 4, 10, 1, lite); break;
      case 'circlet': p(2, 7, 12, 2, gold); p(3, 6, 2, 1, gold); p(11, 6, 2, 1, gold); p(7, 3, 2, 4, gold); p(7, 4, 2, 2, gem); p(3, 7, 1, 1, gem); p(12, 7, 1, 1, gem); break;
      case 'talisman': p(7, 1, 2, 4, gold); p(4, 5, 8, 8, metal); p(5, 4, 6, 10, metal); p(6, 6, 4, 4, gem); p(7, 7, 1, 1, '#fff'); p(5, 13, 6, 1, gold); break;
      default: p(4, 4, 8, 8, metal);
    }
  }
  function itemIcon(it, size) {
    const key = it.ic + '|' + it.t + '|' + it.r + '|' + size;
    if (iconCache[key]) return iconCache[key];
    const c = document.createElement('canvas'); c.width = c.height = 16;
    const g = c.getContext('2d');
    drawPix(g, it.ic, TIER_COL[it.t] || '#b9c2cb', (RAR[it.r] || RAR[0]).col);
    const o = document.createElement('canvas'); o.width = o.height = size;
    const og = o.getContext('2d'); og.imageSmoothingEnabled = false; og.drawImage(c, 0, 0, size, size);
    return (iconCache[key] = o.toDataURL());
  }
  function legacyIcon(id, size) {
    const key = 'L' + id + size; if (iconCache[key]) return iconCache[key];
    const c = document.createElement('canvas'); c.width = c.height = size;
    try { NET.api.drawIcon(c.getContext('2d'), id, 0, 0, size); } catch (e) {}
    return (iconCache[key] = c.toDataURL());
  }
  const slotOf = (it) => (it.s === 'ring' ? 'ring' : it.s);
  const slotName = (s, cls) => (s === 'offhand' && cls && OFF_N[cls] ? OFF_N[cls] : SLOT_N[s] || s);
  function statLines(st, cmp) {
    return Object.keys(STAT_N).filter((k) => st[k] || (cmp && cmp[k])).map((k) => {
      const v = st[k] || 0, d = cmp ? v - (cmp[k] || 0) : 0;
      return `<div class="st"><span>${STAT_N[k]}</span><b>+${v}${PCT[k] ? '%' : ''}</b>${cmp && d ? `<i class="${d > 0 ? 'up' : 'dn'}">${d > 0 ? '▲' : '▼'}${Math.abs(d)}</i>` : ''}</div>`;
    }).join('');
  }
  const qty = (it) => (it.s === 'mat' && (it.q || 1) > 1 ? `<i class="qn">${it.q}</i>` : '');
  const iconHtml = (it, size, extra) => `<span class="ic r${it.r}" ${extra || ''}><img src="${itemIcon(it, size || 40)}" alt="" width="${size || 40}" height="${size || 40}"></span>`;
  const nameHtml = (it) => `<b class="in" style="color:${(RAR[it.r] || RAR[0]).col}">${esc(it.n)}</b>`;
  const meta = (it) => it.s === 'mat' ? `Materiał rzemieślniczy · ×${it.q || 1}` : `${slotName(slotOf(it), it.c)} · ${it.c ? CLS_N[it.c] : 'wszystkie klasy'} · poz. ${it.l}`;

  // ---------- generic layer ----------
  function el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function panel(id, title, body, cls) {
    closePanels(true);
    S.open = id;
    const d = el(`<div class="ui-back" data-panel="${id}"><section class="ui-panel ${cls || ''}" role="dialog" aria-label="${esc(title)}"><header><h3>${title}</h3><button type="button" class="ui-x" data-close aria-label="Zamknij">✕</button></header><div class="ui-body scroll">${body}</div></section></div>`);
    layer.appendChild(d);
    if (NET && NET.api) NET.api.clearKeys();
    return d;
  }
  function closePanels(keepTop) {
    layer.querySelectorAll('.ui-back').forEach((x) => x.remove());
    if (!keepTop) { closeDetail(); S.open = ''; refocus(); }
  }
  function refocus() { const c = document.getElementById('g'); if (c && !document.activeElement.matches('input,select,textarea')) c.focus({ preventScroll: true }); }
  function toast(html, buttons, ms) {
    const t = el(`<div class="ui-toast">${html}${buttons ? `<div class="tb">${buttons}</div>` : ''}</div>`);
    const box = $('#uiToasts'); box.appendChild(t); while (box.children.length > 3) box.removeChild(box.firstChild);
    if (ms !== 0) setTimeout(() => t.remove(), ms || 4500);
    return t;
  }
  const curBody = () => layer.querySelector('.ui-back .ui-body');

  // ---------- item detail ----------
  let detail = null;
  function closeDetail() { if (detail) { detail.remove(); detail = null; } }
  // ---- item tooltip: mouse hover (desktop) / long-press (touch); clicking still opens the action dialog
  let tip = null, lpT = 0, lpFired = 0, lpXY = null;
  function itemFromEl(t) {
    if (!t || !t.closest) return null;
    const G = S.gear;
    const sl = t.closest('[data-slot]'); if (sl) { const it = G && G.gear[sl.dataset.slot]; return it ? [it, { from: 'worn' }, sl] : null; }
    const bi = t.closest('[data-bag],[data-tradd]'); if (bi) { const u = bi.dataset.bag || bi.dataset.tradd; const it = G && (G.bag || []).find((x) => x.u === u); return it ? [it, { from: 'bag' }, bi] : null; }
    const mr = t.closest('[data-mk]'); if (mr && S.mk) { const mine = !!mr.dataset.mine; const x = (mine ? S.mk.mine : S.mk.list).find((y) => String(y.id) === mr.dataset.mk); return x ? [x.it, { from: 'market', seller: mine ? '' : x.sn, pr: x.pr }, mr] : null; }
    const tri = t.closest('[data-tri]'); if (tri && S.tr) { const side = tri.dataset.mine ? S.tr.me : S.tr.them; const it = side && side.items.find((x) => x.u === tri.dataset.tri); return it ? [it, { from: 'trade' }, tri] : null; }
    const lt = t.closest('[data-loot]'); if (lt && bt) { const it = (bt.lastLoot || []).find((x) => x.u === lt.dataset.loot); return it ? [it, { from: 'loot' }, lt] : null; }
    if (EXT.tipItem) return EXT.tipItem(t) || null;
    return null;
  }
  function hideTip() { if (tip) { tip.hidden = true; tip.dataset.u = ''; } }
  function showTip(it, ctx, anchor, touch) {
    if (detail) return;
    if (!tip) { tip = el('<div class="ui-tip" id="uiTip" role="tooltip" hidden></div>'); root.appendChild(tip); }
    if (tip.dataset.u !== it.u || tip.hidden) {
      tip.innerHTML = `<div class="dcard tipc r${it.r|0}" style="border-color:${RAR[it.r].col}">${cardBody(it, ctx)}<div class="dm tiph">${touch ? 'Puść palec i dotknij, aby wybrać akcję.' : 'Kliknij, aby wybrać akcję.'}</div></div>`;
      tip.dataset.u = it.u;
    }
    tip.hidden = false;
    const r = anchor.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight, m = 8;
    tip.style.left = '0px'; tip.style.top = '0px'; tip.style.maxHeight = (vh - m * 2) + 'px';
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = r.right + 10; if (x + w > vw - m) x = r.left - w - 10; if (x < m) x = Math.max(m, Math.min(vw - w - m, r.left + r.width / 2 - w / 2));
    let y = r.top; if (touch || x === Math.max(m, Math.min(vw - w - m, r.left + r.width / 2 - w / 2))) { y = r.top - h - 10; if (y < m) y = r.bottom + 10; }
    y = Math.max(m, Math.min(vh - h - m, y)); x = Math.max(m, Math.min(vw - w - m, x));
    tip.style.left = Math.round(x) + 'px'; tip.style.top = Math.round(y) + 'px';
  }
  function initTips() {
    root.addEventListener('pointerover', (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      const f = itemFromEl(e.target); if (f) showTip(f[0], f[1], f[2], false); else hideTip();
    });
    root.addEventListener('pointerleave', hideTip);
    root.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') { hideTip(); return; }
      hideTip(); clearTimeout(lpT); lpFired = 0;
      const f = itemFromEl(e.target); if (!f) return;
      lpXY = [e.clientX, e.clientY];
      lpT = setTimeout(() => { const g = itemFromEl(e.target); if (g && g[2].isConnected) { lpFired = Date.now(); showTip(g[0], g[1], g[2], true); if (navigator.vibrate) try { navigator.vibrate(12); } catch (x) {} } }, 420);
    });
    root.addEventListener('pointermove', (e) => { if (lpXY && Math.abs(e.clientX - lpXY[0]) + Math.abs(e.clientY - lpXY[1]) > 12) { clearTimeout(lpT); lpXY = null; } });
    const end = () => { clearTimeout(lpT); lpXY = null; };
    root.addEventListener('pointerup', end); root.addEventListener('pointercancel', () => { end(); });
    root.addEventListener('click', (e) => { if (lpFired && Date.now() - lpFired < 1500 && itemFromEl(e.target)) { e.stopPropagation(); e.preventDefault(); lpFired = 0; } }, true);
    root.addEventListener('contextmenu', (e) => { if (itemFromEl(e.target)) e.preventDefault(); });
    window.addEventListener('scroll', hideTip, true);
  }
  // full item card (shared by the action dialog and the hover / long-press tooltip)
  function cardBody(it, ctx) {
    const G = S.gear || {}, cls = G.cls;
    let worn = null;
    if (ctx.from !== 'worn' && G.gear && it.s !== 'mat') { const s = slotOf(it); worn = s === 'ring' ? (G.gear.ring1 || G.gear.ring2) : G.gear[s]; }
    const okCls = !it.c || it.c === cls, okLvl = (G.lvl || 1) >= it.l;
    return `<div class="dh">${iconHtml(it, 48)}<div>${nameHtml(it)}<small style="color:${RAR[it.r].col}">${RAR[it.r].n}</small></div></div>
      ${it.s === 'mat' ? `<div class="dm">Materiał rzemieślniczy · ilość: <b>${it.q || 1}</b></div><div class="dm">Przydaje się u kowala i alchemika. Można go sprzedać handlarzowi lub wystawić u aukcjonera.</div>` : `<div class="dm">${esc(slotName(slotOf(it), it.c))}${it.up ? ` · ulepszenie +${it.up}` : ''}</div>
      <div class="dm ${okCls ? '' : 'bad'}">Klasa: ${it.c ? CLS_N[it.c] : 'wszystkie'}</div>
      <div class="dm ${okLvl ? '' : 'bad'}">Wymagany poziom: ${it.l}</div>`}
      <div class="dst">${statLines(it.st || {}, worn ? worn.st : (it.s !== 'mat' && ctx.from !== 'worn' ? {} : null))}</div>
      ${worn ? `<div class="dm cmp">Porównanie z: ${nameHtml(worn)}</div>` : (it.s !== 'mat' && ctx.from !== 'worn' && G.gear ? '<div class="dm cmp">Nic nie masz w tym miejscu – każda statystyka to zysk.</div>' : '')}
      ${Array.isArray(it.px) && it.px.length ? `<div class="pxs">${it.px.map((x) => pxLine(x[0], x[1])).join('')}</div>` : ''}
      ${it.lore ? `<div class="dm lore">„${esc(it.lore)}”</div>` : ''}
      ${ctx.seller ? `<div class="dm">Sprzedający: ${esc(ctx.seller)}</div>` : ''}
      ${ctx.pr ? `<div class="dm">Cena: <b class="gold">${ctx.pr} zł</b></div>` : ''}
      ${it.s !== 'mat' ? durHtml(it) : ''}
      <div class="dm">Wartość: ${it.v} zł</div>`;
  }
  // durability (round 7): worn gear loses durability on every death; at 0 it gives no stats until repaired
  const durOf = (it) => { const dm = it.dm > 0 ? it.dm : 100; return { d: Number.isFinite(it.d) ? Math.max(0, Math.min(dm, it.d)) : dm, dm }; };
  function durHtml(it) {
    const { d, dm } = durOf(it), k = d / dm, col = d === 0 ? '#ff6a5a' : k < 0.3 ? '#ffa04a' : k < 0.6 ? '#ffd25a' : '#8fe08a';
    return `<div class="dm dur">Wytrzymałość: <b style="color:${col}">${d}/${dm}</b><i class="durbar"><i style="width:${Math.round(k * 100)}%;background:${col}"></i></i></div>${d === 0 ? '<div class="dm bad">⚠ Zepsuty – nie daje żadnych statystyk. Napraw go u kowala lub płatnerza w mieście.</div>' : k < 0.3 ? '<div class="dm warn">Mocno zużyty – odwiedź kowala, zanim się zepsuje.</div>' : ''}`;
  }
  function showDetail(it, ctx) {
    closeDetail(); hideTip();
    const G = S.gear || {}, cls = G.cls;
    const okCls = !it.c || it.c === cls, okLvl = (G.lvl || 1) >= it.l;
    let acts = '';
    if (ctx.from === 'bag') {
      if (it.s !== 'mat') acts += `<button type="button" data-ia="equip" ${okCls && okLvl ? '' : 'disabled'}>Załóż</button>`;
      if (S.tr && S.tr.open) acts += `<button type="button" data-ia="trade">Dodaj do wymiany</button>`;
      // selling only through NPCs: the auction house (Aukcjoner) or a merchant (Handlarz) window must be open
      if (S.open === 'mk' && S.mk && !S.mk.closed) acts += `<div class="sellrow"><label>Cena <input type="number" inputmode="numeric" min="1" max="999999" id="mkPrice" value="${Math.max(2, it.v * 2)}"> zł</label><button type="button" data-ia="list">Wystaw na aukcji</button></div>`;
      if (S.open === 'skup' && S.npc) acts += `<button type="button" data-ia="sell">Sprzedaj: ${esc(S.npc.n)} (${Math.max(1, Math.floor(it.v / 2))} zł)</button>`;
      acts += `<button type="button" class="sec dng" data-ia="drop">Wyrzuć</button>`;
    } else if (ctx.from === 'worn') acts += `<button type="button" data-ia="unequip">Zdejmij</button>`;
    else if (ctx.from === 'market') acts += ctx.mine ? `<button type="button" data-ia="cancel">Wycofaj ofertę</button>` : `<button type="button" data-ia="buy" ${(S.gear && S.gear.gold >= ctx.pr) ? '' : 'disabled'}>Kup za ${ctx.pr} zł</button>`;
    else if (ctx.from === 'tradeMine') acts += `<button type="button" data-ia="trrem">Usuń z wymiany</button>`;
    detail = el(`<div class="ui-detail"><div class="dcard r${it.r|0}" style="border-color:${RAR[it.r].col}">
      <button type="button" class="ui-x" data-dclose aria-label="Zamknij">✕</button>
      ${cardBody(it, Object.assign({}, ctx, { pr: 0 }))}
      <div class="da">${acts}</div></div></div>`);
    detail.addEventListener('click', (e) => {
      if (e.target === detail || e.target.closest('[data-dclose]')) return closeDetail();
      const b = e.target.closest('[data-ia]'); if (!b || b.disabled) return;
      const a = b.dataset.ia;
      if (a === 'equip') send({ t: 'gear', a: 'equip', u: it.u });
      else if (a === 'unequip') send({ t: 'gear', a: 'unequip', slot: ctx.slot });
      else if (a === 'sell') send({ t: 'npc', a: 'sell', u: it.u });
      else if (a === 'drop') { if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'Na pewno wyrzucić?'; return; } send({ t: 'gear', a: 'drop', u: it.u }); }
      else if (a === 'list') { const pr = Math.floor(+$('#mkPrice', detail).value || 0); if (pr < 1) return; send({ t: 'mk', a: 'sell', u: it.u, pr }); setTimeout(() => send({ t: 'mk', a: 'browse', f: mkF }), 150); }
      else if (a === 'buy') { send({ t: 'mk', a: 'buy', id: ctx.id }); setTimeout(() => send({ t: 'mk', a: 'browse', f: mkF }), 150); }
      else if (a === 'cancel') { send({ t: 'mk', a: 'cancel', id: ctx.id }); setTimeout(() => send({ t: 'mk', a: 'browse', f: mkF }), 150); }
      else if (a === 'trade') send({ t: 'tr', a: 'add', u: it.u });
      else if (a === 'trrem') send({ t: 'tr', a: 'rem', u: it.u });
      closeDetail();
    });
    layer.appendChild(detail);
  }

  // ---------- equipment ----------
  const DOLL = [['amulet', 'helm', 'ring1'], ['weapon', '@', 'offhand'], ['gloves', 'armor', 'ring2'], [null, 'boots', null]];
  function eqHtml() {
    const G = S.gear; if (!G) return '<p class="muted">Wczytywanie ekwipunku…</p>';
    let doll = '';
    for (const row of DOLL) for (const s of row) {
      if (s === null) { doll += '<i></i>'; continue; }
      if (s === '@') { doll += `<div class="portrait"><canvas id="eqPortrait" width="96" height="96"></canvas><small>${esc(CLS_N[G.cls] || '')} · poz. ${G.lvl}</small></div>`; continue; }
      const it = G.gear && G.gear[s];
      doll += `<button type="button" class="slot ${it ? 'r' + it.r : 'empty'}${it && durOf(it).d === 0 ? ' broken' : ''}" data-slot="${s}" title="${esc(slotName(s, G.cls))}">${it ? `<img src="${itemIcon(it, 40)}" alt="${esc(it.n)}" width="40" height="40">` : `<span>${esc(slotName(s, G.cls))}</span>`}</button>`;
    }
    const st = G.st || {};
    const stats = [['Atak', st.atk], ['Obrona', st.def], ['Życie', st.hp], [st.res || 'Mana', st.mp], ['Cios krytyczny', (st.crit || 0) + '%'], ['Unik', (st.dodge || 0) + '%']]
      .map(([k, v]) => `<div class="st"><span>${k}</span><b>${v}</b></div>`).join('');
    const bag = (G.bag || []).map((it) => `<button type="button" class="bi r${it.r}" data-bag="${esc(it.u)}"><img src="${itemIcon(it, 40)}" alt="${esc(it.n)}" width="40" height="40">${qty(it)}</button>`).join('');
    const nb = (G.bag || []).length, pad = nb === 0 ? 8 : (8 - nb % 8) % 8;
    const inv = (G.inv || []).map((x) => { const d = NET.api.items[x.id]; if (!d) return ''; const usable = d.heal || d.mana || d.buff; return `<div class="li"><img src="${legacyIcon(x.id, 28)}" alt="" width="28" height="28"><span>${esc(d.n)}${x.n > 1 ? ` <small>×${x.n}</small>` : ''}</span>${usable ? `<button type="button" data-use="${esc(x.id)}">Użyj</button>` : ''}</div>`; }).join('');
    return `<div class="eq-top"><div class="doll">${doll}</div><div class="eq-st"><h4>Statystyki</h4>${stats}<div class="st gold"><span>Złoto</span><b>${G.gold} zł</b></div></div></div>
      <h4>Torba <small>${(G.bag || []).length}/${G.max || 40}</small></h4><div class="bag">${bag}${'<span class="bi none"></span>'.repeat(pad)}</div>
      ${(G.bag || []).length ? '' : '<p class="muted">Torba jest pusta – pokonuj potwory, by zdobywać przedmioty.</p>'}
      <h4>Przedmioty i mikstury</h4><div class="legacy">${inv || '<p class="muted">Brak.</p>'}</div>`;
  }
  function paintPortrait() {
    const c = $('#eqPortrait'); if (!c || !S.gear) return;
    const g = c.getContext('2d'); g.clearRect(0, 0, 96, 96); g.imageSmoothingEnabled = false;
    g.save(); g.translate(16, 6); g.scale(2, 2);
    try { const P = NET.api.P(); NET.api.drawChar(g, S.gear.cls, P.eq && P.eq.w, P.eq && P.eq.a, 0); } catch (e) {}
    g.restore();
  }
  function openEq() { panel('eq', 'Ekwipunek', eqHtml(), 'wide'); paintPortrait(); send({ t: 'gear', a: 'get' }); }
  function refreshEq() { if (S.open !== 'eq') return; const b = curBody(); if (!b) return; const top = b.scrollTop; b.innerHTML = eqHtml(); b.scrollTop = top; paintPortrait(); }

  // ---------- market ----------
  let mkF = { slot: '', cls: '', rar: '', q: '', lvl: 0, sort: 'new' }, mkTab = 'all';
  function mkRow(x, mine) {
    return `<button type="button" class="mrow" data-mk="${x.id}" data-mine="${mine ? 1 : ''}">${iconHtml(x.it, 36)}<span class="mn">${nameHtml(x.it)}<small>${esc(meta(x.it))}</small></span><span class="ms">${mine ? 'Twoja oferta' : esc(x.sn)}</span><span class="mp">${x.pr} zł</span></button>`;
  }
  function mkHtml() {
    const M = S.mk;
    const tabs = `<div class="utabs"><button type="button" data-mtab="all" class="${mkTab === 'all' ? 'on' : ''}">Przeglądaj</button><button type="button" data-mtab="mine" class="${mkTab === 'mine' ? 'on' : ''}">Moje oferty${M && M.mine ? ` (${M.mine.length})` : ''}</button><button type="button" data-mtab="sell" class="${mkTab === 'sell' ? 'on' : ''}">Wystaw</button></div>`;
    if (!M) return tabs + '<p class="muted">Wczytywanie ofert…</p>';
    const gold = `<p class="muted">Masz <b class="gold">${M.gold} zł</b> · podatek od sprzedaży ${Math.round((M.tax < 1 ? M.tax * 100 : M.tax))}% · maks. 10 ofert.</p>`;
    if (mkTab === 'mine') return tabs + gold + (M.mine.length ? `<div class="mlist">${M.mine.map((x) => mkRow(x, true)).join('')}</div>` : '<p class="muted">Nie masz wystawionych przedmiotów.</p>');
    if (mkTab === 'sell') {
      const bag = (S.gear && S.gear.bag) || [];
      return tabs + gold + '<p class="muted">Wybierz przedmiot lub materiały z torby, ustaw cenę i wystaw w domu aukcyjnym (materiały wystawiasz całym stosem).</p>' + (bag.length ? `<div class="bag">${bag.map((it) => `<button type="button" class="bi r${it.r}" data-bag="${esc(it.u)}"><img src="${itemIcon(it, 40)}" alt="${esc(it.n)}" width="40" height="40">${qty(it)}</button>`).join('')}</div>` : '<p class="muted">Torba jest pusta.</p>');
    }
    const opt = (v, l, cur) => `<option value="${v}" ${String(cur) === String(v) ? 'selected' : ''}>${l}</option>`;
    const f = `<div class="mf">
      <select data-f="slot" aria-label="Rodzaj">${opt('', 'Wszystkie rodzaje', mkF.slot)}${['weapon', 'offhand', 'helm', 'armor', 'gloves', 'boots', 'ring', 'amulet'].map((s) => opt(s, SLOT_N[s], mkF.slot)).join('')}${opt('mat', 'Materiały', mkF.slot)}</select>
      <select data-f="cls" aria-label="Klasa">${opt('', 'Każda klasa', mkF.cls)}${opt('war', 'Wojownik', mkF.cls)}${opt('arc', 'Łucznik', mkF.cls)}${opt('mag', 'Mag', mkF.cls)}${opt('all', 'Dla wszystkich klas', mkF.cls)}</select>
      <select data-f="rar" aria-label="Rzadkość">${opt('', 'Każda rzadkość', mkF.rar)}${RAR.map((r, i) => opt(i, r.n, mkF.rar)).join('')}</select>
      <select data-f="sort" aria-label="Sortowanie">${opt('new', 'Najnowsze', mkF.sort)}${opt('cheap', 'Najtańsze', mkF.sort)}${opt('lvl', 'Najwyższy poziom', mkF.sort)}</select>
      <input data-f="q" type="search" placeholder="Szukaj nazwy…" value="${esc(mkF.q)}" maxlength="30" aria-label="Szukaj">
      <label class="chk"><input type="checkbox" data-f="lvl" ${mkF.lvl ? 'checked' : ''}> Na mój poziom</label></div>`;
    return tabs + f + gold + (M.list.length ? `<div class="mlist">${M.list.map((x) => mkRow(x, false)).join('')}</div><p class="muted">${M.total > M.list.length ? `Pokazano ${M.list.length} z ${M.total}.` : `Ofert: ${M.total}.`}</p>` : '<p class="muted">Brak ofert spełniających kryteria.</p>');
  }
  // the auction house opens only next to an auctioneer (server-checked); the menu/R key shows where to find one
  function openMk() { if (S.open === 'mk') return; openHand(); send({ t: 'npc', a: 'open', k: 'aukcja' }); }
  function showMk() { panel('mk', `Dom aukcyjny${S.mk && S.mk.npc ? ' · ' + esc(S.mk.npc) : ''}`, mkHtml(), 'wide'); send({ t: 'gear', a: 'get' }); }
  // ---------- merchants (Handlarz / Aukcjoner NPCs) ----------
  function tradeNpcs() { const N = (NET.api && NET.api.npcs) || {}; return Object.keys(N).filter((k) => N[k].trade).map((k) => N[k]); }
  function handHtml() {
    const rows = {}; for (const n of tradeNpcs()) { (rows[n.area] = rows[n.area] || []).push(n); }
    const list = Object.keys(rows).map((a) => `<div class="li"><span><b>${esc(AREA_N[a] || a)}</b><br><small>${rows[a].map((n) => `${esc(n.n)} – ${n.trade === 'aukcja' ? 'dom aukcyjny' : 'skup przedmiotów'}`).join('<br>')}</small></span></div>`).join('');
    return `<p class="muted">Przedmiotów nie sprzedajesz z ekwipunku. Odszukaj w mieście <b>handlarza</b> (odkupuje przedmioty i łupy za połowę wartości) albo <b>aukcjonera</b> (wystawiasz przedmioty innym graczom i kupujesz ich oferty). Podejdź do niego i porozmawiaj (E).</p><div class="legacy">${list || '<p class="muted">Brak kupców.</p>'}</div>`;
  }
  function openHand() { panel('hand', 'Handel u kupców', handHtml(), 'wide'); }
  function skupHtml() {
    const N = S.npc; if (!N) return '<p class="muted">Wczytywanie…</p>';
    const G = S.gear || {}, bag = G.bag || [], pr = (it) => Math.max(1, Math.floor((it.v || 0) / 2));
    const commons = bag.filter((it) => it.r === 0 && it.s !== 'mat');
    const sum = commons.reduce((n, it) => n + pr(it), 0);
    return `<p class="muted">${esc(N.n)} odkupi każdy przedmiot za połowę jego wartości. Masz <b class="gold">${G.gold != null ? G.gold : N.gold} zł</b>. Kliknij przedmiot, aby go sprzedać.</p>
      ${bag.length ? `<div class="bag">${bag.map((it) => `<button type="button" class="bi r${it.r}" data-bag="${esc(it.u)}"><img src="${itemIcon(it, 40)}" alt="${esc(it.n)}" width="40" height="40">${qty(it)}<small class="pr">${pr(it)}</small></button>`).join('')}</div>` : '<p class="muted">Torba jest pusta.</p>'}
      <div class="da" style="margin-top:12px">
        ${commons.length ? `<button type="button" data-np="common">Sprzedaj zwykłe przedmioty (${commons.length}) · ${sum} zł</button>` : ''}
        ${N.junk && N.junk.n ? `<button type="button" class="sec" data-np="junk">Sprzedaj łupy (${N.junk.n}) · ${N.junk.sum} zł</button>` : ''}</div>`;
  }
  // ---- blacksmith repairs (Kowal / Płatnerz) ----
  function repHtml() {
    const N = S.rep; if (!N) return '<p class="muted">Wczytywanie…</p>';
    const G = S.gear || {}, gold = G.gold != null ? G.gold : N.gold;
    const rows = N.items.map((x) => { const k = x.d / x.dm, col = x.d === 0 ? '#ff6a5a' : k < 0.3 ? '#ffa04a' : k < 0.6 ? '#ffd25a' : '#8fe08a';
      return `<div class="li rep"><span><b style="color:${RAR[x.r] ? RAR[x.r].col : '#fff'}">${esc(x.n)}</b>${x.sl ? ` <small>(${esc(slotName(x.sl === 'ring1' || x.sl === 'ring2' ? 'ring' : x.sl, G.cls))}, założony)</small>` : ' <small>(w torbie)</small>'}<br><small>Wytrzymałość <b style="color:${col}">${x.d}/${x.dm}</b>${x.d === 0 ? ' · <em class="bad">zepsuty</em>' : ''}</small></span>
        ${x.c > 0 ? `<button type="button" data-rep="${esc(x.u)}" ${gold >= x.c ? '' : 'disabled'}>Napraw · ${x.c} zł</button>` : '<small class="okm">✓ sprawny</small>'}</div>`; }).join('');
    return `<p class="muted">${esc(N.n)} naprawi twój ekwipunek. Po każdej śmierci założone przedmioty tracą 10 pkt wytrzymałości, a zepsute (0) nie dają statystyk. Masz <b class="gold">${gold} zł</b>.</p>
      <div class="legacy">${rows || '<p class="muted">Nie masz ekwipunku do naprawy.</p>'}</div>
      <div class="da" style="margin-top:12px">${N.all > 0 ? `<button type="button" class="btn" data-rep="*" ${gold >= N.all ? '' : 'disabled'}>⚒ Napraw wszystko · ${N.all} zł</button>` : '<span class="okm">✓ Cały ekwipunek jest sprawny.</span>'}</div>`;
  }
  function refreshRep() { if (S.open !== 'rep') return; const b = curBody(); if (!b) return; const top = b.scrollTop; b.innerHTML = repHtml(); b.scrollTop = top; }
  function refreshSkup() { if (S.open !== 'skup') return; const b = curBody(); if (!b) return; const top = b.scrollTop; b.innerHTML = skupHtml(); b.scrollTop = top; }
  function onNpcUi(msg) {
    if (msg.k === 'naprawa') {
      if (msg.closed) { S.rep = null; if (S.open === 'rep') closePanels(); return; }
      S.rep = msg; if (S.gear) S.gear.gold = msg.gold;
      if (S.open !== 'rep') { panel('rep', `⚒ Naprawa · ${esc(msg.n)}`, repHtml(), 'wide'); send({ t: 'gear', a: 'get' }); } else refreshRep();
      return;
    }
    if (msg.closed) { if (msg.k === 'skup') { S.npc = null; if (S.open === 'skup') closePanels(); } return; }
    if (msg.k === 'skup') { S.npc = msg; if (S.gear) S.gear.gold = msg.gold; if (S.open !== 'skup') { panel('skup', `Skup · ${esc(msg.n)}`, skupHtml(), 'wide'); send({ t: 'gear', a: 'get' }); } else refreshSkup(); }
  }
  function refreshMk() { if (S.open !== 'mk') return; const b = curBody(); if (!b) return; const ae = document.activeElement, q = ae && ae.dataset && ae.dataset.f === 'q'; const top = b.scrollTop; b.innerHTML = mkHtml(); b.scrollTop = top; if (q) { const i = $('[data-f="q"]', b); i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }

  // ---------- trade ----------
  function trHtml() {
    const T = S.tr;
    if (!T || !T.open) return '<p class="muted">Aby handlować, dotknij innego gracza w świecie gry i wybierz „Handel”.</p>';
    const col = (side, mine) => `<div class="tcol ${side.ok ? 'ok' : ''}"><h4>${mine ? 'Twoja oferta' : esc(T.them.n)}${side.ok ? ' <span class="okm">✓ akceptuje</span>' : ''}</h4>
      <div class="bag sm">${side.items.map((it) => `<button type="button" class="bi r${it.r}" data-tri="${esc(it.u)}" data-mine="${mine ? 1 : ''}"><img src="${itemIcon(it, 36)}" alt="${esc(it.n)}" width="36" height="36"></button>`).join('') || '<span class="muted">brak przedmiotów</span>'}</div>
      ${mine ? `<label class="tg">Złoto: <input type="number" inputmode="numeric" min="0" id="trGold" value="${side.gold}"> zł</label>` : `<div class="tg">Złoto: <b class="gold">${side.gold} zł</b></div>`}</div>`;
    const bag = ((S.gear && S.gear.bag) || []).filter((it) => !T.me.items.some((x) => x.u === it.u));
    return `<div class="tcols">${col(T.me, true)}${col(T.them, false)}</div>
      <h4>Dodaj z torby</h4><div class="bag sm">${bag.map((it) => `<button type="button" class="bi r${it.r}" data-tradd="${esc(it.u)}"><img src="${itemIcon(it, 36)}" alt="${esc(it.n)}" width="36" height="36"></button>`).join('') || '<span class="muted">Torba jest pusta.</span>'}</div>
      <p class="muted">Każda zmiana oferty cofa akceptację obu stron. Wymiana nastąpi, gdy obaj zaakceptujecie.</p>
      <div class="row"><button type="button" class="btn" data-tr="ok" ${T.me.ok ? 'disabled' : ''}>${T.me.ok ? 'Zaakceptowano' : 'Akceptuj wymianę'}</button><button type="button" class="btn sec" data-tr="cancel">Anuluj</button></div>`;
  }
  function openTr() { panel('tr', 'Handel', trHtml(), 'wide'); }
  function refreshTr() { if (S.open !== 'tr') return; const b = curBody(); if (!b) return; if (document.activeElement && document.activeElement.id === 'trGold') return; b.innerHTML = trHtml(); }

  // ---------- guild ----------
  function gdHtml() {
    const D = S.gd;
    if (!D) return '<p class="muted">Wczytywanie…</p>';
    if (!D.g) {
      return (D.inv ? `<div class="card inv"><b>${esc(D.inv.from)}</b> zaprasza cię do gildii <b>${esc(D.inv.name)} [${esc(D.inv.tag)}]</b>.<div class="row"><button type="button" class="btn" data-gd="accept">Dołącz</button><button type="button" class="btn sec" data-gd="decline">Odrzuć</button></div></div>` : '') +
        `<p class="muted">Nie należysz do żadnej gildii. Załóż własną albo poproś znajomego o zaproszenie.</p>
        <form class="card gform" id="gdCreate"><h4>Załóż gildię</h4>
        <label>Nazwa gildii<input name="name" maxlength="24" minlength="3" required placeholder="np. Strażnicy Mgły"></label>
        <label>Skrót (2–4 znaki, nad głową)<input name="tag" maxlength="4" minlength="2" required placeholder="SM"></label>
        <p class="muted">Koszt założenia: <b class="gold">${D.cost} zł</b>${S.gear ? ` · masz ${S.gear.gold} zł` : ''}</p>
        <button type="submit" class="btn">Załóż gildię</button></form>`;
    }
    const g = D.g, my = g.my;
    const mem = g.members.slice().sort((a, b) => b.r - a.r || (b.on ? 1 : 0) - (a.on ? 1 : 0)).map((m) => {
      const self = m.n === NET.nick;
      let b = '';
      if (!self && my === 2) b += m.r === 0 ? `<button type="button" data-gk="promote" data-k="${esc(m.k)}">Awansuj</button>` : m.r === 1 ? `<button type="button" data-gk="demote" data-k="${esc(m.k)}">Degraduj</button>` : '';
      if (!self && my >= 1 && m.r < my) b += `<button type="button" class="dng" data-gk="kick" data-k="${esc(m.k)}">Wyrzuć</button>`;
      return `<div class="gm"><i class="dot ${m.on ? 'on' : ''}"></i><span><b>${esc(m.n)}</b><small>${esc(g.ranks[m.r])} · ${esc(CLS_N[m.c] || '')} · poz. ${m.l || '?'}</small></span><span class="ga">${b}</span></div>`;
    }).join('');
    return `<div class="ghead"><span class="gtag">[${esc(g.tag)}]</span><div><b>${esc(g.name)}</b><small>Twoja ranga: ${esc(g.ranks[my])} · członków: ${g.members.length} · online: ${g.members.filter((m) => m.on).length}</small></div></div>
      <div class="card motd"><h4>Wiadomość dnia</h4>${my >= 1 ? `<form id="gdMotd" class="row"><input name="text" maxlength="140" value="${esc(g.motd)}" placeholder="Napisz wiadomość dla gildii…"><button type="submit" class="btn sm">Zapisz</button></form>` : `<p>${esc(g.motd) || '<span class="muted">Brak.</span>'}</p>`}</div>
      <h4>Członkowie</h4><div class="glist">${mem}</div>
      ${my >= 1 ? `<form id="gdInv" class="row"><input name="n" maxlength="16" placeholder="Nick gracza do zaproszenia" required><button type="submit" class="btn sm">Zaproś</button></form>` : ''}
      <div class="row"><button type="button" class="btn sec" data-gd="chat">💬 Czat gildii</button><button type="button" class="btn sec dng" data-gd="leave">Opuść gildię</button></div>`;
  }
  function openGd() { panel('gd', 'Gildia', gdHtml(), 'wide'); send({ t: 'gd', a: 'get' }); }
  function refreshGd() { if (S.open !== 'gd') return; const b = curBody(); if (!b) return; const ae = document.activeElement; if (ae && ae.matches && ae.matches('input,textarea') && b.contains(ae)) return; b.innerHTML = gdHtml(); }

  // ---------- PvP ----------
  function myZone() { try { const P = NET.api.P(); return NET.api.pvpAt(P.area, P.x, P.y); } catch (e) { return null; } }
  function nearPlayers() {
    const P = NET.api.P(), o = NET.api.others(), r = [];
    for (const k of Object.keys(o)) { const x = o[k]; if (x.area === P.area && !x.dead && Math.max(Math.abs(x.x - P.x), Math.abs(x.y - P.y)) <= 8) r.push(Object.assign({ i: k }, x)); }
    return r;
  }
  function pvpHtml() {
    const z = myZone();
    const zones = NET.api.zones.map((q) => `<li>${q.lethal ? '<b class="bad">⚔ mapa PvP</b>' : 'arena'}: ${esc(q.n)}${q.lethal ? '' : ' – ' + esc(AREA_N[q.area] || q.area)}</li>`).join('');
    const near = z ? nearPlayers().filter((x) => NET.api.pvpAt(x.area, x.x, x.y) && !(NET.party && NET.party[x.i]) && !x.fb) : [];
    const R = S.pvp;
    const rows = R ? R.rank.map((x) => `<tr class="${x.me ? 'me' : ''}"><td>${x.i}</td><td>${esc(x.n)}</td><td>${esc(CLS_N[x.cls] || '')}</td><td>${x.lvl || ''}</td><td><b>${x.pts}</b></td><td>${x.w}/${x.l}</td></tr>`).join('') : '';
    return `<div class="card ${z ? 'zone-on' : ''}">${z ? (z.lethal ? `⚔ Jesteś na mapie PvP: <b>${esc(z.n)}</b>. Możesz zaatakować innych graczy – przegrany ginie (traci 10% złota i wytrzymałość ekwipunku, przedmiotów nikt nie zabiera).` : `⚔ Jesteś na arenie: <b>${esc(z.n)}</b>. Możesz wyzwać innych graczy na pojedynek o punkty rankingu (bez śmierci).`) : 'Jesteś w strefie bezpiecznej – tu nikt cię nie zaatakuje. Walki z graczami są możliwe tylko tutaj:'}<ul class="zl">${z ? '' : zones}</ul></div>
      ${z ? `<h4>Gracze w pobliżu</h4>${near.length ? near.map((x) => `<div class="gm"><span><b>${x.gt ? '[' + esc(x.gt) + '] ' : ''}${esc(x.n)}</b><small>${esc(CLS_N[x.c] || '')} · poz. ${x.l}</small></span><span class="ga"><button type="button" data-duel="${esc(x.i)}">${z.lethal ? '⚔ Zaatakuj' : '⚔ Wyzwij'}</button></span></div>`).join('') : '<p class="muted">Nikogo nie ma w pobliżu na arenie.</p>'}` : ''}
      <h4>Ranking PvP</h4>${R ? `<table class="rank"><thead><tr><th>#</th><th>Gracz</th><th>Klasa</th><th>Poz.</th><th>Pkt</th><th>W/P</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="muted">Brak pojedynków.</td></tr>'}</tbody></table>${R.mine && !R.rank.some((x) => x.me) ? `<p class="muted">Twoje miejsce: ${R.mine.i} (${R.mine.pts} pkt)</p>` : ''}` : '<p class="muted">Wczytywanie rankingu…</p>'}
      <p class="muted">Areny: każdy zaczyna z 1000 punktami, wygrana z silniejszym daje więcej punktów, przegrany zostaje z 1 pż. Mapy PvP: walka na śmierć; gracze poniżej 10. poziomu są chronieni, nie można atakować graczy słabszych o więcej niż 10 poziomów, a tego samego gracza można zaatakować ponownie dopiero po 3 minutach.</p>`;
  }
  function openPvp() { panel('pvp', 'PvP i ranking', pvpHtml(), 'wide'); send({ t: 'pvp', a: 'rank' }); }
  function refreshPvp() { if (S.open !== 'pvp') return; const b = curBody(); if (b) b.innerHTML = pvpHtml(); }

  // ---------- menu & player popup ----------
  function openMenu() {
    panel('menu', 'Menu', `<div class="mgrid">
      <button type="button" data-open="eq"><b>🎒</b>Ekwipunek<small>I</small></button>
      <button type="button" data-open="mk"><b>⚖</b>Handel u kupców<small>R</small></button>
      <button type="button" data-open="gd"><b>🛡</b>Gildia<small>U</small></button>
      <button type="button" data-open="pvp"><b>⚔</b>PvP i ranking<small>P</small></button>
      <button type="button" data-open="tr"><b>🤝</b>Handel</button>
      <button type="button" data-open="chat"><b>💬</b>Czat<small>C</small></button>${EXT.menu}</div>
      <p class="muted">Walka: dotknij potwora albo stań obok i naciśnij atak. Gracza dotknij, aby handlować, zaprosić lub wyzwać. Zioła, rudę i drewno zbierasz klawiszem E (lub przyciskiem „Zbierz”), stojąc obok.</p>`, 'menu');
  }
  function playerTap(o) {
    const z = myZone() && NET.api.pvpAt(o.area, o.x, o.y);
    const inGd = S.gd && S.gd.g;
    panel('pl', `${o.gt ? '[' + esc(o.gt) + '] ' : ''}${esc(o.n)}`, `<p class="muted">${esc(CLS_N[o.c] || '')} · poziom ${o.l}${o.fb ? ' · teraz walczy' : ''}</p>
      <div class="plist">
        <button type="button" data-pa="duel" data-i="${esc(o.i)}" ${z && !o.fb ? '' : 'disabled'}>${z && z.lethal ? '⚔ Zaatakuj (walka na śmierć)' : '⚔ Wyzwij na pojedynek'}${z ? '' : '<small>strefa bezpieczna – tylko na mapach PvP i arenach</small>'}</button>
        <button type="button" data-pa="trade" data-i="${esc(o.i)}">🤝 Handel</button>
        <button type="button" data-pa="party" data-n="${esc(o.n)}">◆ Zaproś do drużyny</button>
        ${inGd && S.gd.g.my >= 1 ? `<button type="button" data-pa="guild" data-n="${esc(o.n)}">🛡 Zaproś do gildii</button>` : ''}
        <button type="button" data-pa="whisper" data-n="${esc(o.n)}">✉ Szepnij</button></div>`, 'menu');
  }

  // ---------- battle ----------
  let bt = null; // { el, st, q:[], busy, fx }
  function fighterCard(f, me) {
    const mine = f.id === me;
    const st = [f.stun ? '<i title="ogłuszony">💫</i>' : '', f.frz ? '<i title="zamrożony">❄</i>' : '', f.burn ? '<i title="płonie">🔥</i>' : '', f.buf && f.buf.def ? '<i title="obrona">🛡</i>' : '', f.buf && f.buf.crit ? '<i title="celność">🎯</i>' : ''].join('');
    return `<div class="bf ${f.side ? 'en' : 'al'} ${mine ? 'me' : ''} ${!f.alive ? 'dead' : ''} ${f.fled ? 'fled' : ''} ${f.boss ? 'boss' : ''}" data-f="${esc(f.id)}">
      <div class="bspr"><canvas width="96" height="96" data-spr="${esc(f.id)}"></canvas><span class="bst">${st}</span>${f.side === 0 && f.ready ? '<span class="rdy" title="gotowy">✓</span>' : ''}</div>
      <div class="bn">${f.gt ? '<span class="gt">[' + esc(f.gt) + ']</span> ' : ''}${esc(f.n)} <small>${f.lvl}</small>${f.elite ? ' <em class="el">elita</em>' : ''}${f.boss ? ' <em class="bo">boss</em>' : ''}</div>
      <div class="bar hp"><i style="width:${pctW(f.hp, f.mhp)}%"></i><span>${f.hp}/${f.mhp}</span></div>
      ${f.kind === 'p' ? `<div class="bar mp ${f.cls === 'mag' ? '' : 'en'}"><i style="width:${pctW(f.mp, f.mmp)}%"></i><span>${f.mp}/${f.mmp}</span></div>` : ''}</div>`;
  }
  function paintSprites(st) {
    for (const f of st.f) {
      const c = bt.el.querySelector(`canvas[data-spr="${CSS.escape(f.id)}"]`); if (!c) continue;
      const g = c.getContext('2d'); g.clearRect(0, 0, 96, 96); g.imageSmoothingEnabled = false;
      g.save();
      if (f.kind === 'm') {
        const sc = (NET.api.mon[f.k] && NET.api.mon[f.k].sc) || 1, k = f.boss ? 2.5 : 2 / Math.max(1, sc * 0.8);
        g.translate(48 - 16 * k, 88 - 30 * k); g.scale(k, k); try { NET.api.drawMob(g, f.k); } catch (e) {}
      } else { g.translate(16, 20); g.scale(2, 2); try { NET.api.drawChar(g, f.cls, f.w, f.a, f.side ? 1 : 0); } catch (e) {} }
      g.restore();
    }
  }
  function skillBtns(me) {
    const sk = (NET.api.sk[me.cls] || []).concat((NET.api.skx && NET.api.skx[me.cls]) || []), lv = [1, 3, 5, 15, 30, 45];
    const cost = ({ war: [25, 35, 40, 45, 55, 70], arc: [25, 40, 35, 40, 55, 70], mag: [18, 30, 35, 40, 60, 75] })[me.cls] || [0, 0, 0, 0, 0, 0];
    const nextLock = lv.findIndex((l, i) => sk[i] && me.lvl < l);
    return sk.slice(0, 6).map((s, i) => {
      if (me.lvl < lv[i] && i !== nextLock) return '';
      const lock = me.lvl < lv[i], cd = me.cds ? me.cds[i] : 0, noMp = me.mp < cost[i];
      return `<button type="button" class="ba sk${i >= 3 ? ' hi' : ''}" data-ba="sk" data-i="${i}" title="${esc(s.d || '')}" ${lock || cd > 0 || noMp ? 'disabled' : ''}><b>${i + 1}</b>${esc(s.n)}<small>${lock ? 'od poz. ' + lv[i] : cd > 0 ? 'odnowienie: ' + cd : cost[i] + ' ' + (me.cls === 'mag' ? 'many' : 'energii')}</small></button>`;
    }).join('');
  }
  function potCount(ids) { const inv = (S.gear && S.gear.inv) || []; let n = 0; for (const x of inv) if (ids.indexOf(x.id) >= 0) n += x.n || 1; return n; }
  function renderBattle(st) {
    if (!bt) {
      bt = { el: null, st: null, q: [], busy: false, tgt: null, chosen: false, timer: 0 };
      bt.el = el(`<div class="bt" id="battle" role="dialog" aria-label="Walka"><div class="bt-in">
        <div class="bt-top"><b id="btTitle"></b><span id="btRound"></span><div class="bt-timer"><i id="btTime"></i></div></div><div class="bt-mech" id="btMech" hidden></div>
        <div class="bt-field"><div class="bt-side en" id="btEn"></div><div class="bt-vs">VS</div><div class="bt-side al" id="btAl"></div></div>
        <div class="bt-log scroll" id="btLog" aria-live="polite"></div>
        <div class="bt-acts" id="btActs"></div>
        <div class="bt-opts"><label class="chk"><input type="checkbox" id="btAuto"> Walka automatyczna</label><span class="spd">Tempo: <button type="button" data-spd="1">×1</button><button type="button" data-spd="2">×2</button><button type="button" data-spd="3">×3</button></span></div>
        <div class="bt-end" id="btEnd" hidden></div></div></div>`);
      root.appendChild(bt.el);
      bt.el.addEventListener('click', onBattleClick);
      $('#btAuto', bt.el).addEventListener('change', (e) => { const on = e.target.checked; try { localStorage.setItem('ardan_auto', on ? '1' : '0'); } catch (x) {} send({ t: 'bt', a: 'auto', on }); });
      bt.timer = setInterval(tickTimer, 200);
      closePanels(); closeDetail();
      if (NET.api) NET.api.clearKeys();
    }
    bt.st = st; bt.recvAt = Date.now();
    const me = st.f.find((f) => f.id === st.me) || {};
    $('#btTitle', bt.el).textContent = st.kind === 'pvp' ? '⚔ Pojedynek PvP' : st.title ? '⚔ ' + st.title : '⚔ Walka';
    { const mm = $('#btMech', bt.el); mm.hidden = !st.mech; if (st.mech) mm.textContent = '👑 Mechaniki bossa: ' + st.mech.join(' · '); }
    $('#btRound', bt.el).textContent = st.phase === 'end' ? 'Koniec walki' : `Runda ${st.round}`;
    $('#btEn', bt.el).innerHTML = st.f.filter((f) => f.side === 1).map((f) => fighterCard(f, st.me)).join('');
    $('#btAl', bt.el).innerHTML = st.f.filter((f) => f.side === 0).map((f) => fighterCard(f, st.me)).join('');
    paintSprites(st);
    const en = st.f.filter((f) => f.side !== me.side && f.alive && !f.fled);
    if (!bt.tgt || !en.some((f) => f.id === bt.tgt)) bt.tgt = en.length ? en.slice().sort((a, b) => a.hp - b.hp)[0].id : null;
    bt.el.querySelectorAll('.bf.en').forEach((c) => c.classList.toggle('tgt', c.dataset.f === bt.tgt));
    $('#btAuto', bt.el).checked = !!me.auto;
    bt.el.querySelectorAll('[data-spd]').forEach((b) => b.classList.toggle('on', +b.dataset.spd === st.speed));
    const canAct = st.phase === 'choose' && me.alive && !me.fled && !me.ready && !me.auto && !me.stun && !me.frz;
    const acts = $('#btActs', bt.el);
    if (st.phase === 'choose' && me.ready && !me.auto) acts.innerHTML = '<div class="wait">Wybrano ruch – czekam na pozostałych…</div>';
    else if (st.phase === 'choose' && me.auto) acts.innerHTML = '<div class="wait">Walka automatyczna – postać sama wybiera ruchy.</div>';
    else if (st.phase !== 'choose') acts.innerHTML = '<div class="wait">Trwa runda…</div>';
    else {
      const hp = potCount(['pot', 'bigpot', 'elix', 'gpot', 'selix', 'spot', 'dpot']), mp = potCount(['mpot', 'gmpot']);
      acts.innerHTML = `<button type="button" class="ba atk" data-ba="atk" ${canAct ? '' : 'disabled'}><b>⚔</b>Atak<small>Spacja</small></button>${skillBtns(me)}
        <button type="button" class="ba" data-ba="pot" ${canAct && hp ? '' : 'disabled'}><b>❤</b>Mikstura<small>×${hp} (H)</small></button>
        ${me.cls === 'mag' ? `<button type="button" class="ba" data-ba="mpot" ${canAct && mp ? '' : 'disabled'}><b>✦</b>Mana<small>×${mp} (G)</small></button>` : ''}
        <button type="button" class="ba fl" data-ba="flee" ${canAct && st.kind !== 'pvp' ? '' : 'disabled'}><b>🏃</b>Ucieczka<small>${st.kind === 'pvp' ? 'niemożliwa' : 'X'}</small></button>`;
    }
    if (st.phase === 'end' && st.end) showEnd(st);
  }
  function showEnd(st) {
    const e = st.end, box = $('#btEnd', bt.el);
    let h;
    if (e.pvp && e.lethal) h = `<h2 class="${e.win ? 'win' : 'lose'}">${e.win ? 'Zwycięstwo!' : 'Zginąłeś'}</h2><p>${e.win ? `Zabijasz gracza ${esc(e.vs)} w strefie PvP.` : `Zabija cię ${esc(e.vs)}. Tracisz 10% złota, a założony ekwipunek traci wytrzymałość. Budzisz się w najbliższym mieście.`}</p>`;
    else if (e.pvp) h = `<h2 class="${e.win ? 'win' : 'lose'}">${e.win ? 'Zwycięstwo!' : 'Porażka'}</h2><p>${e.win ? 'Pokonujesz' : 'Przegrywasz z'} ${esc(e.vs)}.</p><p class="big">${e.pts > 0 ? '+' : ''}${e.pts} pkt rankingu · razem ${e.total}</p>`;
    else if (e.win) h = `<h2 class="win">Zwycięstwo!</h2><p class="big">+${e.xp} PD · +${e.gold} zł</p>${e.lvlUp ? `<p class="lvl">Awans na poziom ${e.lvlUp}!</p>` : ''}
      ${e.loot && e.loot.length ? `<h4>Łup</h4><div class="loot">${e.loot.map((it) => `<button type="button" class="lt" data-loot="${esc(it.u)}">${iconHtml(it, 40)}<span>${nameHtml(it)}<small style="color:${RAR[it.r].col}">${RAR[it.r].n}</small></span></button>`).join('')}</div>` : '<p class="muted">Tym razem bez przedmiotów.</p>'}`;
    else if (e.dead) h = '<h2 class="lose">Polegasz…</h2><p>Odrodzisz się w osadzie.</p>';
    else if (e.fled) h = '<h2>Ucieczka</h2><p>Udało ci się uciec z walki.</p>';
    else h = '<h2>Koniec walki</h2>';
    box.innerHTML = `<div class="endc">${h}<button type="button" class="btn" data-ba="close">Zamknij</button></div>`;
    box.hidden = false; bt.lastLoot = e.loot || [];
    $('#btActs', bt.el).innerHTML = '';
    const c = $('[data-ba="close"]', box); if (c && window.matchMedia('(pointer:fine)').matches) c.focus({ preventScroll: true });
  }
  function closeBattle() { if (!bt) return; clearInterval(bt.timer); bt.el.remove(); bt = null; S.bt = null; refocus(); }
  function logLine(txt, k) {
    const L = $('#btLog', bt.el); if (!L) return;
    const d = document.createElement('div'); d.className = 'l ' + (k || ''); d.textContent = txt; L.appendChild(d);
    while (L.children.length > 60) L.removeChild(L.firstChild);
    L.scrollTop = L.scrollHeight;
  }
  function floatNum(id, txt, cls) {
    const c = bt.el.querySelector(`.bf[data-f="${CSS.escape(id)}"]`); if (!c) return;
    const s = document.createElement('span'); s.className = 'fnum ' + cls; s.textContent = txt; c.appendChild(s);
    c.classList.remove('hit'); void c.offsetWidth; if (cls === 'dmg' || cls === 'crit') c.classList.add('hit');
    setTimeout(() => s.remove(), 900);
  }
  function setHp(id, hp) {
    const st = bt.st; const f = st && st.f.find((x) => x.id === id); if (!f) return;
    f.hp = hp; const c = bt.el.querySelector(`.bf[data-f="${CSS.escape(id)}"] .bar.hp`); if (!c) return;
    c.querySelector('i').style.width = pctW(hp, f.mhp) + '%'; c.querySelector('span').textContent = `${hp}/${f.mhp}`;
  }
  function playEvents(msg, done) {
    const evs = msg.ev.slice(); const step = SKL[msg.speed] || 650;
    $('#btActs', bt.el).innerHTML = '<div class="wait">Trwa runda…</div>';
    logLine(`— Runda ${msg.round} —`, 'rd');
    const next = () => {
      if (!bt) return;
      const e = evs.shift(); if (!e) return done();
      logLine(e.txt, e.k);
      if (e.t && e.hp !== undefined) setHp(e.t, e.hp);
      if (e.k === 'hit') floatNum(e.t, '-' + e.v, 'dmg'); else if (e.k === 'crit') floatNum(e.t, '-' + e.v + '!', 'crit');
      else if (e.k === 'miss') floatNum(e.t, 'unik', 'miss'); else if (e.k === 'heal') floatNum(e.t, '+' + e.v, 'heal');
      else if (e.k === 'mana') floatNum(e.t, '+' + e.v, 'mana'); else if (e.k === 'burn') floatNum(e.t, '-' + e.v, 'dmg');
      else if (e.k === 'px') { if (e.v && e.t) floatNum(e.t, '-' + e.v, 'dmg'); else floatNum(e.a, '✦', 'px'); }
      else if (e.k === 'die') { const c = bt.el.querySelector(`.bf[data-f="${CSS.escape(e.t)}"]`); if (c) c.classList.add('dead'); }
      if (e.a) { const c = bt.el.querySelector(`.bf[data-f="${CSS.escape(e.a)}"]`); if (c) { c.classList.remove('act'); void c.offsetWidth; c.classList.add('act'); } }
      setTimeout(next, step);
    };
    next();
  }
  function pumpBattle() {
    if (!bt || bt.busy) return;
    const m = bt.q.shift(); if (!m) return;
    if (m.ev && m.ev.length) { bt.busy = true; bt.st = Object.assign({}, bt.st || m, { speed: m.speed }); playEvents(m, () => { bt.busy = false; renderBattle(m); pumpBattle(); }); }
    else { renderBattle(m); pumpBattle(); }
  }
  function onBattle(msg) {
    if (msg.phase === 'none') { if (bt && (!bt.st || bt.st.phase !== 'end')) closeBattle(); return; }
    S.bt = msg;
    if (!bt) { renderBattle(msg); logLine(msg.kind === 'pvp' ? 'Pojedynek się rozpoczyna!' : 'Walka się rozpoczyna! Wybierz ruch.', 'rd'); return; }
    bt.q.push(msg); pumpBattle();
  }
  function choose(c) {
    if (!bt || !bt.st || bt.st.phase !== 'choose') return;
    const me = bt.st.f.find((f) => f.id === bt.st.me); if (!me || me.ready || me.auto) return;
    c.t = bt.tgt; send({ t: 'bt', a: 'act', c });
    me.ready = true; $('#btActs', bt.el).innerHTML = '<div class="wait">Wybrano ruch – czekam na pozostałych…</div>';
  }
  function onBattleClick(e) {
    const t = e.target;
    const f = t.closest('.bf.en'); if (f && !f.classList.contains('dead')) { bt.tgt = f.dataset.f; bt.el.querySelectorAll('.bf.en').forEach((c) => c.classList.toggle('tgt', c === f)); return; }
    const sp = t.closest('[data-spd]'); if (sp) { const v = +sp.dataset.spd; try { localStorage.setItem('ardan_speed', v); } catch (x) {} send({ t: 'bt', a: 'speed', v }); bt.el.querySelectorAll('[data-spd]').forEach((b) => b.classList.toggle('on', b === sp)); return; }
    const lt = t.closest('[data-loot]'); if (lt) { const it = (bt.lastLoot || []).find((x) => x.u === lt.dataset.loot); if (it) showDetail(it, { from: 'loot' }); return; }
    const b = t.closest('[data-ba]'); if (!b || b.disabled) return;
    const a = b.dataset.ba;
    if (a === 'close') return closeBattle();
    if (a === 'sk') choose({ a: 'sk', i: +b.dataset.i }); else choose({ a });
  }
  function tickTimer() {
    if (!bt || !bt.st) return;
    const st = bt.st, i = $('#btTime', bt.el);
    if (st.phase !== 'choose' || bt.busy) { i.style.width = '0%'; return; }
    const left = Math.max(0, st.dl - (Date.now() - bt.recvAt));
    i.style.width = (100 * left / 20000) + '%';
  }

  // ---------- messages ----------
  function onMsg(msg) {
    switch (msg.t) {
      case 'bt': onBattle(msg); return true;
      case 'gear': S.gear = msg; refreshEq(); if (S.open === 'mk' && mkTab === 'sell') refreshMk(); refreshSkup(); refreshTr(); if (S.open === 'gd') refreshGd(); return true;
      case 'mk':
        if (msg.closed) { S.mk = null; if (S.open === 'mk') openHand(); return true; }
        S.mk = msg; if (S.gear) S.gear.gold = msg.gold;
        if (msg.o && S.open !== 'mk') showMk(); else refreshMk(); return true;
      case 'npcui': onNpcUi(msg); return true;
      case 'tr':
        if (msg.inv) {
          const t = toast(`<b>${esc(msg.inv)}</b> chce z tobą handlować.`, '<button type="button" data-ta="accept">Handluj</button><button type="button" class="no" data-ta="decline">Odrzuć</button>', 15000);
          t.addEventListener('click', (e) => { const b = e.target.closest('[data-ta]'); if (!b) return; send({ t: 'tr', a: b.dataset.ta }); t.remove(); });
          return true;
        }
        { const was = S.tr && S.tr.open; S.tr = msg;
          if (msg.open && !was && !bt) openTr(); else if (!msg.open && was && S.open === 'tr') closePanels(); else refreshTr(); }
        return true;
      case 'gd': {
        const hadInv = S.gd && S.gd.inv; S.gd = msg; NET.gtag = msg.g ? msg.g.tag : '';
        if (msg.inv && !hadInv && S.open !== 'gd') {
          const t = toast(`<b>${esc(msg.inv.from)}</b> zaprasza cię do gildii <b>${esc(msg.inv.name)} [${esc(msg.inv.tag)}]</b>.`, '<button type="button" data-ga="accept">Dołącz</button><button type="button" class="no" data-ga="decline">Odrzuć</button>', 20000);
          t.addEventListener('click', (e) => { const b = e.target.closest('[data-ga]'); if (!b) return; send({ t: 'gd', a: b.dataset.ga }); t.remove(); });
        }
        refreshGd(); return true;
      }
      case 'pvp': S.pvp = msg; refreshPvp(); return true;
    }
    return EXT.onMsg ? !!EXT.onMsg(msg) : false;
  }
  let lastZone = null;
  function onState() {
    // zone badge (round 7): always visible – safe map / arena (friendly duels) / PvP map (lethal)
    const z = myZone(); let area = ''; try { area = NET.api.P().area; } catch (e) {}
    const key = area + '|' + (z ? z.n : '');
    if (key !== lastZone) {
      lastZone = key; const p = $('#uiZone'); p.hidden = !area;
      p.className = 'ui-zone ' + (z ? (z.lethal ? 'pvp' : 'arena') : 'safe');
      p.textContent = z ? (z.lethal ? `☠ Strefa PvP: ${z.n} – gracze mogą cię zaatakować` : `⚔ Pojedynki: ${z.n}`) : '🛡 Strefa bezpieczna';
      p.title = z ? (z.lethal ? 'Mapa PvP: gracze od 10. poziomu mogą się atakować (różnica maks. 10 poziomów). Przegrany ginie: traci 10% złota i wytrzymałość ekwipunku.' : 'Arena: pojedynki o punkty rankingu, bez śmierci.') : 'Tu inni gracze nie mogą cię zaatakować.';
      if (S.open === 'pvp') refreshPvp();
    }
  }

  // ---------- input ----------
  function key(k) {
    const lk = k.length === 1 ? k.toLowerCase() : k;
    if (bt) {
      if (lk === 'Escape' && bt.st && bt.st.phase === 'end') closeBattle();
      else if (lk === 'Enter' && bt.st && bt.st.phase === 'end') closeBattle();
      else if (lk === ' ' || lk === 'f') choose({ a: 'atk' });
      else if (lk >= '1' && lk <= '6' && lk.length === 1) { const b = bt.el.querySelector(`[data-ba="sk"][data-i="${+lk - 1}"]`); if (b && !b.disabled) choose({ a: 'sk', i: +lk - 1 }); }
      else if (lk === 'h') { const b = bt.el.querySelector('[data-ba="pot"]'); if (b && !b.disabled) choose({ a: 'pot' }); }
      else if (lk === 'g') { const b = bt.el.querySelector('[data-ba="mpot"]'); if (b && !b.disabled) choose({ a: 'mpot' }); }
      else if (lk === 'x') { const b = bt.el.querySelector('[data-ba="flee"]'); if (b && !b.disabled) choose({ a: 'flee' }); }
      else if (lk === 'a') { const c = $('#btAuto', bt.el); c.checked = !c.checked; c.dispatchEvent(new Event('change')); }
      return true;
    }
    if (detail) { if (lk === 'Escape') closeDetail(); return true; }
    if (EXT.key && EXT.key(lk, !!S.open)) return true;
    if (S.open) {
      if (lk === 'Escape' || (lk === 'i' && S.open === 'eq') || (lk === 'r' && (S.open === 'mk' || S.open === 'hand' || S.open === 'skup' || S.open === 'rep')) || (lk === 'u' && S.open === 'gd') || (lk === 'p' && S.open === 'pvp')) { closePanels(); return true; }
      if (lk === 'i') { openEq(); return true; } if (lk === 'r') { openMk(); return true; } if (lk === 'u') { openGd(); return true; } if (lk === 'p') { openPvp(); return true; }
      return true;
    }
    if (lk === 'i') { openEq(); return true; }
    if (lk === 'r') { openMk(); return true; }
    if (lk === 'u') { openGd(); return true; }
    if (lk === 'p') { openPvp(); return true; }
    return false;
  }
  function onLayerClick(e) {
    const t = e.target;
    const back = t.closest('.ui-back');
    if (t.classList.contains('ui-back') || t.closest('[data-close]')) return closePanels();
    if (!back) return;
    const op = t.closest('[data-open]'); if (op) { const k = op.dataset.open; if (k === 'chat') { closePanels(); openChat(''); return; } const fn = ({ eq: openEq, mk: openMk, gd: openGd, pvp: openPvp, tr: openTr })[k] || EXT.open[k]; if (fn) fn(); return; }
    if (EXT.click && EXT.click(t, back)) return;
    const sl = t.closest('[data-slot]'); if (sl && S.gear) { const it = S.gear.gear[sl.dataset.slot]; if (it) showDetail(it, { from: 'worn', slot: sl.dataset.slot }); return; }
    const bi = t.closest('[data-bag]'); if (bi && S.gear) { const it = S.gear.bag.find((x) => x.u === bi.dataset.bag); if (it) showDetail(it, { from: 'bag' }); return; }
    const us = t.closest('[data-use]'); if (us) { send({ t: 'in', mx: 0, my: 0, acts: [{ a: 'use', id: us.dataset.use }] }); setTimeout(() => send({ t: 'gear', a: 'get' }), 200); return; }
    const mt = t.closest('[data-mtab]'); if (mt) { mkTab = mt.dataset.mtab; refreshMk(); return; }
    const rp = t.closest('[data-rep]'); if (rp && !rp.disabled && S.rep) { send(rp.dataset.rep === '*' ? { t: 'npc', a: 'repair' } : { t: 'npc', a: 'repair', u: rp.dataset.rep }); return; }
    const np = t.closest('[data-np]'); if (np && !np.disabled && S.npc) {
      if (np.dataset.np === 'junk') send({ t: 'npc', a: 'junk' });
      else { const us = ((S.gear && S.gear.bag) || []).filter((it) => it.r === 0 && it.s !== 'mat').map((it) => it.u); if (!np.dataset.sure) { np.dataset.sure = 1; np.textContent = `Na pewno sprzedać ${us.length} szt.?`; return; } send({ t: 'npc', a: 'sellmany', us }); }
      return;
    }
    const mr = t.closest('[data-mk]'); if (mr && S.mk) { const mine = !!mr.dataset.mine; const x = (mine ? S.mk.mine : S.mk.list).find((y) => String(y.id) === mr.dataset.mk); if (x) showDetail(x.it, { from: 'market', id: x.id, pr: x.pr, mine, seller: mine ? '' : x.sn }); return; }
    const tri = t.closest('[data-tri]'); if (tri && S.tr) { const side = tri.dataset.mine ? S.tr.me : S.tr.them; const it = side.items.find((x) => x.u === tri.dataset.tri); if (it) showDetail(it, { from: tri.dataset.mine ? 'tradeMine' : 'loot' }); return; }
    const tra = t.closest('[data-tradd]'); if (tra) { send({ t: 'tr', a: 'add', u: tra.dataset.tradd }); return; }
    const trb = t.closest('[data-tr]'); if (trb && !trb.disabled) { send({ t: 'tr', a: trb.dataset.tr }); if (trb.dataset.tr === 'cancel') closePanels(); return; }
    const gd = t.closest('[data-gd]'); if (gd) {
      const a = gd.dataset.gd;
      if (a === 'chat') { closePanels(); openChat('', 'gu'); return; }
      if (a === 'leave' && !gd.dataset.sure) { gd.dataset.sure = 1; gd.textContent = 'Na pewno opuścić?'; return; }
      send({ t: 'gd', a }); return;
    }
    const gk = t.closest('[data-gk]'); if (gk) { send({ t: 'gd', a: gk.dataset.gk, k: gk.dataset.k }); return; }
    const du = t.closest('[data-duel]'); if (du) { send({ t: 'pvp', a: 'duel', id: du.dataset.duel }); closePanels(); return; }
    const pa = t.closest('[data-pa]'); if (pa && !pa.disabled) {
      const a = pa.dataset.pa; closePanels();
      if (a === 'duel') send({ t: 'pvp', a: 'duel', id: pa.dataset.i });
      else if (a === 'trade') send({ t: 'tr', a: 'req', id: pa.dataset.i });
      else if (a === 'party') cmd('/zapros ' + pa.dataset.n);
      else if (a === 'guild') send({ t: 'gd', a: 'invite', n: pa.dataset.n });
      else if (a === 'whisper') openChat('/w ' + pa.dataset.n + ' ');
    }
  }
  function onLayerChange(e) {
    const f = e.target.dataset && e.target.dataset.f;
    if (f) { mkF[f] = f === 'lvl' ? (e.target.checked ? 1 : 0) : e.target.value; send({ t: 'mk', a: 'browse', f: mkF }); return; }
    if (e.target.id === 'trGold') send({ t: 'tr', a: 'gold', v: Math.max(0, Math.floor(+e.target.value || 0)) });
  }
  let qT = 0;
  function onLayerInput(e) { if (e.target.dataset && e.target.dataset.f === 'q') { clearTimeout(qT); qT = setTimeout(() => { mkF.q = e.target.value; send({ t: 'mk', a: 'browse', f: mkF }); }, 300); } }
  function onLayerSubmit(e) {
    e.preventDefault();
    const fm = e.target, d = Object.fromEntries(new FormData(fm).entries());
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (fm.id === 'gdCreate') send({ t: 'gd', a: 'create', name: String(d.name || '').trim(), tag: String(d.tag || '').trim() });
    else if (fm.id === 'gdInv') { send({ t: 'gd', a: 'invite', n: String(d.n || '').trim() }); fm.reset(); }
    else if (fm.id === 'gdMotd') { send({ t: 'gd', a: 'motd', text: String(d.text || '') }); document.activeElement.blur(); }
  }

  function init(o) {
    NET = o.NET; send = o.send; cmd = o.cmd; openChat = o.openChat;
    root = document.createElement('div'); root.id = 'ui'; document.body.appendChild(root);
    layer = document.createElement('div'); layer.id = 'uiLayer'; root.appendChild(layer);
    root.insertAdjacentHTML('beforeend', '<div id="uiToasts" class="ui-toasts"></div><div id="uiZone" class="ui-zone" hidden></div>');
    layer.addEventListener('click', onLayerClick);
    initTips();
    layer.addEventListener('change', onLayerChange);
    layer.addEventListener('input', onLayerInput);
    layer.addEventListener('submit', onLayerSubmit);
    // keep keys typed in panels out of the game
    ['keydown', 'keyup'].forEach((t) => root.addEventListener(t, (e) => { if (e.target.matches('input,select,textarea')) { e.stopPropagation(); if (e.key === 'Escape' && t === 'keydown') e.target.blur(); } }));
    let auto = '0', spd = '1'; try { auto = localStorage.getItem('ardan_auto') || '0'; spd = localStorage.getItem('ardan_speed') || '1'; } catch (e) {}
    if (auto === '1') send({ t: 'bt', a: 'auto', on: true });
    if (+spd > 1) send({ t: 'bt', a: 'speed', v: +spd });
    send({ t: 'gear', a: 'get' }); send({ t: 'gd', a: 'get' });
    setInterval(onState, 400);
  }
  window.ARDAN_UI = {
    init, onMsg, key, playerTap,
    panel: (k) => { if (bt) return; if (S.open === (k === 'inv' ? 'eq' : k)) return closePanels(); const fn = ({ inv: openEq, eq: openEq, menu: openMenu, mk: openMk, gd: openGd, pvp: openPvp, tr: openTr })[k] || EXT.open[k]; if (fn) fn(); },
    state: S, inBattle: () => !!bt, close: closePanels,
    ext: EXT,
    h: { el, panel, closePanels, toast, curBody, esc, $, iconHtml, nameHtml, itemIcon, showDetail, refocus, RAR, CLS_N, SLOT_N, AREA_N, pctW, slotName,
      send: (m) => send(m), cmd: (c) => cmd(c), NET: () => NET, root: () => root, layer: () => layer, refreshEq: () => refreshEq(), refreshMk: () => refreshMk() },
  };
})();
