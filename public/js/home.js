'use strict';
(function () {
  const A = window.ARDAN;
  document.querySelectorAll('[data-emblem]').forEach((e) => { e.innerHTML = A.emblem; });
  document.querySelectorAll('[data-pips]').forEach((e) => { const n = +e.dataset.pips; e.innerHTML = [1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join(''); });
  // liczby świata prosto z serwera (krainy, bossowie, zadania, przedmioty)
  const pl = (n, one, few, many) => (n === 1 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many);
  A.api('/world').then((r) => {
    if (!r.ok || !r.data) return; const W = r.data;
    const set = (sel, v) => document.querySelectorAll(sel).forEach((e) => { e.textContent = v; });
    set('[data-world]', `${W.classes} klasy · ${W.areas} ${pl(W.areas, 'kraina', 'krainy', 'krain')} · ${W.bosses} ${pl(W.bosses, 'boss', 'bossów', 'bossów')} · ${W.quests} ${pl(W.quests, 'zadanie', 'zadania', 'zadań')}`);
    set('[data-wq]', W.quests); set('[data-wb]', W.bosses); set('[data-wi]', `ponad ${Math.floor(W.items / 100) * 100}`);
  });
  // ranking graczy
  function rankHtml(R, tab, esc) {
    const CN = { war: 'Wojownik', arc: 'Łucznik', mag: 'Mag' };
    const rows = (R && R[tab]) || [];
    if (!rows.length) return '<p class="muted">Ranking jest jeszcze pusty – zagraj i zostań pierwszy!</p>';
    const head = tab === 'level' ? '<th class="num">Poziom</th>' : tab === 'pvp' ? '<th class="num">Elo</th><th class="num hide-s">W / P</th>' : '<th class="num">Osiągnięcia</th><th class="num hide-s">Poziom</th>';
    const cell = (r) => tab === 'level' ? `<td class="num">${r.lvl}</td>` : tab === 'pvp' ? `<td class="num"><b>${r.pts}</b></td><td class="num hide-s">${r.w} / ${r.l}</td>` : `<td class="num"><b>${r.a}</b><small>/${R.total || 23}</small></td><td class="num hide-s">${r.lvl}</td>`;
    return `<table><thead><tr><th>#</th><th>Gracz</th><th class="hide-s">Klasa</th>${head}</tr></thead><tbody>${rows.map((r, i) => `<tr><td class="pos">${i + 1}</td><td class="n">${esc(r.n)}<br class="hide-l"><small class="cls-s">${esc(CN[r.cls] || '')}</small></td><td class="hide-s">${esc(CN[r.cls] || '')}</td>${cell(r)}</tr>`).join('')}</tbody></table>`;
  }
  function initRanking(R, esc) {
    const box = document.getElementById('rank'); if (!box) return;
    let tab = 'level';
    const draw = () => { document.getElementById('rankBody').innerHTML = rankHtml(R, tab, esc); box.querySelectorAll('[data-rk]').forEach((b) => b.classList.toggle('on', b.dataset.rk === tab)); };
    box.addEventListener('click', (e) => { const b = e.target.closest('[data-rk]'); if (!b) return; tab = b.dataset.rk; draw(); });
    draw();
  }
  A.api('/ranking').then((r) => {
    initRanking(r.ok ? r.data : null, A.esc);
    const at = document.getElementById('rankAt');
    if (at && r.ok && r.data && r.data.at) {
      const f = (t) => new Date(t).toLocaleString('pl-PL', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
      const h = Math.round((r.data.every || 43200000) / 3600000);
      at.textContent = `Aktualizacja co ${h} h, ostatnia: ${f(r.data.at)} · następna: ${f(r.data.next)}`;
    }
  });
  A.api('/news').then((r) => {
    const list = r.ok ? r.data : [];
    const fmt = (d) => new Date(d + 'T12:00:00').toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById('news').innerHTML = list.map((n) => `<article class="card"><time datetime="${A.esc(n.date)}">${fmt(n.date)}</time><div><h3>${A.esc(n.title)}</h3><p class="muted" style="margin:0">${A.esc(n.text)}</p></div></article>`).join('');
  });
  A.ready.then((u) => { document.querySelectorAll('[data-play]').forEach((b) => { b.href = u ? '/postacie' : '/rejestracja'; }); });
})();
