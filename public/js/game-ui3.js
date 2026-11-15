'use strict';
// ARDAN – znajomi, blokowanie i wygląd postaci (runda 10). Rozszerza ARDAN_UI; wszystko sprawdza serwer.
(function () {
  const U = window.ARDAN_UI; if (!U) return;
  const H = U.h, E = U.ext, S = U.state;
  const { esc, $, panel, closePanels, toast, curBody, CLS_N, AREA_N } = H;
  const send = (m) => H.send(m);
  const SKN = () => window.ARDAN_SKINS;
  const F = S.fr = { d: null, skin: null, poll: 0 };
  const areaN = (a) => (AREA_N && AREA_N[a]) || a || '';

  // ---------- friends ----------
  function frHtml() {
    const d = F.d;
    if (!d) return '<p class="muted">Wczytywanie…</p>';
    const on = d.f.filter((x) => x.on).length;
    const row = (x) => `<div class="fr ${x.on ? 'on' : 'off'}"><i class="dot" title="${x.on ? 'w grze' : 'poza grą'}"></i>
      <span class="fn"><b>${esc(x.n)}</b><small>${x.on ? `${esc(CLS_N[x.cls] || '')}${x.lvl ? ' · poz. ' + x.lvl : ''} · ${esc(areaN(x.area))}${x.fb ? ' · walczy' : ''}` : 'poza grą'}</small></span>
      <span class="fb2">${x.on ? `<button type="button" data-pa="whisper" data-n="${esc(x.n)}" title="Szepnij">✉</button>` : ''}<button type="button" class="no" data-fr="remove" data-k="${esc(x.k)}" title="Usuń ze znajomych">✕</button></span></div>`;
    return `<form class="fr-add" data-fradd><input name="n" maxlength="20" placeholder="Nick gracza…" autocomplete="off" aria-label="Nick gracza"><button type="submit">➕ Zaproś</button><button type="button" class="no" data-frblock>🚫 Zablokuj</button></form>
      ${d.in.length ? `<h4>Zaproszenia do znajomych <small>(${d.in.length})</small></h4>${d.in.map((x) => `<div class="fr req"><span class="fn"><b>${esc(x.n)}</b><small>chce dodać cię do znajomych</small></span><span class="fb2"><button type="button" data-fr="accept" data-k="${esc(x.k)}">✔ Przyjmij</button><button type="button" class="no" data-fr="decline" data-k="${esc(x.k)}">Odrzuć</button></span></div>`).join('')}` : ''}
      <h4>Znajomi <small>${on} / ${d.f.length} w grze</small></h4>
      ${d.f.length ? d.f.map(row).join('') : '<p class="muted">Nie masz jeszcze znajomych. Wpisz nick powyżej albo dotknij gracza w świecie i wybierz „Dodaj do znajomych”.</p>'}
      ${d.out.length ? `<h4>Wysłane zaproszenia</h4>${d.out.map((x) => `<div class="fr out"><span class="fn"><b>${esc(x.n)}</b><small>czeka na akceptację</small></span><span class="fb2"><button type="button" class="no" data-fr="cancel" data-k="${esc(x.k)}">Anuluj</button></span></div>`).join('')}` : ''}
      <h4>Zablokowani <small>(${d.b.length})</small></h4>
      ${d.b.length ? d.b.map((x) => `<div class="fr blk"><span class="fn"><b>${esc(x.n)}</b><small>nie widzisz jego wiadomości, zaproszenia są odrzucane</small></span><span class="fb2"><button type="button" data-fr="unblock" data-k="${esc(x.k)}">Odblokuj</button></span></div>`).join('') : '<p class="muted">Nikogo nie blokujesz.</p>'}
      <p class="muted small">Zablokowany gracz nie może do ciebie pisać (czat, szept), zapraszać do handlu, drużyny, gildii, znajomych ani wyzywać na pojedynek. Na mapach PvP obowiązują zasady strefy.</p>`;
  }
  function openFr() { panel('fr', '👥 Znajomi', frHtml(), 'fr-panel'); send({ t: 'fr', a: 'get' }); }
  function refreshFr() { if (S.open !== 'fr') return; const b = curBody(); if (!b) return; const inp = b.querySelector('[data-fradd] input'), v = inp ? inp.value : '', foc = inp && document.activeElement === inp; const top = b.scrollTop; b.innerHTML = frHtml(); b.scrollTop = top; const ni = b.querySelector('[data-fradd] input'); if (ni) { ni.value = v; if (foc) ni.focus(); } }
  function badge() { const N = H.NET(); if (N) N.frBadge = F.d ? F.d.in.length : 0; }

  // ---------- skins (Wygląd) ----------
  function skinHtml() {
    const s = F.skin, SK = SKN();
    if (!s || !SK) return '<p class="muted">Wczytywanie…</p>';
    const names = SK.names(s.cls);
    const cards = s.lv.map((lv, i) => {
      const lock = s.lvl < lv, sel = s.cur === i, eff = s.eff === i;
      return `<button type="button" class="skc ${lock ? 'lock' : ''} ${eff ? 'eff' : ''}" data-skin="${i}" ${lock ? 'disabled' : ''} aria-pressed="${eff}">
        <canvas width="112" height="120" data-skc="${i}"></canvas><b>${esc(names[i])}</b><small>${i === 0 ? 'podstawowy' : 'poziom ' + lv}${lock ? ' 🔒' : eff ? (sel ? ' · wybrany' : ' · aktywny') : ''}</small></button>`;
    }).join('');
    return `<p class="muted">Darmowe wyglądy za poziom – każdy kolejny to lepsza zbroja, kolory, a od 60. poziomu poświata i aura. Widać je w świecie, w walce i na liście postaci.</p>
      <label class="chk skauto"><input type="checkbox" data-skauto ${s.cur < 0 ? 'checked' : ''}> Automatycznie najlepszy odblokowany wygląd</label>
      <div class="skgrid">${cards}</div>`;
  }
  function paintSkins() {
    const SK = SKN(), s = F.skin; if (!SK || !s) return;
    const list = [...document.querySelectorAll('canvas[data-skc]')].map((c) => ({ c, cls: s.cls, tier: +c.dataset.skc, o: { scale: 3 } }));
    list.forEach((x) => SK.draw(x.c, x.cls, x.tier, x.o)); SK.animate(list);
  }
  function openSkin() { panel('skin', '✨ Wygląd postaci', skinHtml(), 'wide skin-panel'); paintSkins(); send({ t: 'skin', a: 'get' }); }
  function refreshSkin() { if (S.open !== 'skin') return; const b = curBody(); if (!b) return; const top = b.scrollTop; b.innerHTML = skinHtml(); b.scrollTop = top; paintSkins(); }

  // ---------- wiring ----------
  E.menu += '<button type="button" data-open="fr"><b>👥</b>Znajomi<small>L</small></button><button type="button" data-open="skin"><b>✨</b>Wygląd<small>K</small></button>';
  E.open.fr = openFr; E.open.skin = openSkin;
  E.plExtra = (o) => {
    const d = F.d, k = d && d.f.find((x) => x.n === o.n), bl = d && d.b.find((x) => x.n === o.n);
    return `${k ? '' : `<button type="button" data-frp="add" data-n="${esc(o.n)}">👥 Dodaj do znajomych</button>`}${bl ? `<button type="button" data-frp="unblock" data-k="${esc(bl.k)}">✔ Odblokuj</button>` : `<button type="button" class="no" data-frp="block" data-n="${esc(o.n)}">🚫 Zablokuj</button>`}`;
  };
  const pKey = E.key;
  E.key = (lk, open) => {
    if (lk === 'l' && (!open || S.open === 'fr')) { if (S.open === 'fr') closePanels(); else openFr(); return true; }
    if (lk === 'k' && (!open || S.open === 'skin')) { if (S.open === 'skin') closePanels(); else openSkin(); return true; }
    return pKey ? pKey(lk, open) : false;
  };
  const pClick = E.click;
  E.click = (t, back) => {
    const f = t.closest('[data-fr]'); if (f) { send({ t: 'fr', a: f.dataset.fr, k: f.dataset.k }); return true; }
    const fp = t.closest('[data-frp]'); if (fp) { const a = fp.dataset.frp; if (a === 'unblock') send({ t: 'fr', a, k: fp.dataset.k }); else send({ t: 'fr', a, n: fp.dataset.n }); closePanels(); return true; }
    const fb = t.closest('[data-frblock]'); if (fb) { const i = back.querySelector('[data-fradd] input'); const n = i && i.value.trim(); if (n) { send({ t: 'fr', a: 'block', n }); i.value = ''; } else toast('Wpisz nick gracza, którego chcesz zablokować.'); return true; }
    const sk = t.closest('[data-skin]'); if (sk && !sk.disabled) { send({ t: 'skin', a: 'set', k: +sk.dataset.skin }); return true; }
    const sa = t.closest('[data-skauto]'); if (sa) { send({ t: 'skin', a: 'set', k: sa.checked ? -1 : (F.skin ? F.skin.eff : 0) }); return true; }
    return pClick ? pClick(t, back) : false;
  };
  // the add-friend form (submit events are not routed through E.click)
  document.addEventListener('submit', (e) => { const f = e.target.closest && e.target.closest('[data-fradd]'); if (!f) return; e.preventDefault(); const n = f.n.value.trim(); if (n) { send({ t: 'fr', a: 'add', n }); f.n.value = ''; } }, true);
  const pMsg = E.onMsg;
  E.onMsg = (m) => {
    if (m.t === 'fr') {
      if (m.on) { toast(`👥 Twój znajomy <b>${esc(m.on)}</b> jest teraz w grze <small>(${esc(areaN(m.area))})</small>.`, '', 4000); return true; }
      if (m.req) { const t = toast(`👥 <b>${esc(m.req)}</b> zaprasza cię do znajomych.`, `<button type="button" data-frt="accept">Przyjmij</button><button type="button" class="no" data-frt="decline">Odrzuć</button>`, 20000); t.addEventListener('click', (e) => { const b = e.target.closest('[data-frt]'); if (!b) return; send({ t: 'fr', a: b.dataset.frt, k: m.k }); t.remove(); }); return true; }
      F.d = m; badge(); refreshFr(); return true;
    }
    if (m.t === 'skin') { F.skin = m; refreshSkin(); if (m.unlocked) toast(`✨ <b>Nowy wygląd odblokowany</b> (poziom ${m.unlocked}) – zobacz go w oknie „Wygląd” (K).`, '<button type="button" data-open-skin>Pokaż</button>', 9000).addEventListener('click', (e) => { if (e.target.closest('[data-open-skin]')) { e.currentTarget.remove(); if (!U.inBattle()) openSkin(); } }); return true; }
    return pMsg ? pMsg(m) : false;
  };
  const baseInit = U.init;
  U.init = function (o) {
    baseInit(o);
    send({ t: 'fr', a: 'get' });
    // land / online status of friends stays fresh while the window is open
    setInterval(() => { if (S.open === 'fr') send({ t: 'fr', a: 'get' }); }, 5000);
  };
})();
