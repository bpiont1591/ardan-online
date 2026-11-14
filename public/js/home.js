'use strict';
(function () {
  const A = window.ARDAN;
  document.querySelectorAll('[data-emblem]').forEach((e) => { e.innerHTML = A.emblem; });
  document.querySelectorAll('[data-pips]').forEach((e) => { const n = +e.dataset.pips; e.innerHTML = [1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join(''); });
  const REG = [
    ['village', 'Osada Brzozowa', 'Poziom 1', 'Spokojna wioska na skraju lasu. Tu Sołtys Radomir, Kowal Bogumił i Zielarka Wiesława pomogą stawiać pierwsze kroki.', null],
    ['forest', 'Mroczny Bór', 'Poziomy 3–6', 'Gęsty las pełen wilków, dzików i goblinów. Przy ognisku czeka Pustelnik Ignacy, który pamięta, skąd przyszła mgła.', null],
    ['cave', 'Jaskinia Cieni', 'Poziomy 7–12', 'Ciemne korytarze, pająki i szkielety. W najgłębszej sali czai się źródło mgły.', 'Upiór Mgieł'],
    ['swamp', 'Bagna Żałoby', 'Poziomy 10–16', 'Grząskie moczary spowite oparem. Topielce, błędne ogniki i trolle strzegą chaty dawnej znachorki.', 'Wiedźma Moczarów'],
    ['town', 'Srebrnogród', 'Bezpieczne miasto', 'Warowne miasto o srebrnych dachach. Płatnerz, alchemiczka, kapłanka i Kapitan Bronisław – serce Ardanu.', null],
    ['mount', 'Szczyty Szronu', 'Poziomy 14–22', 'Mroźne przełęcze, śnieżne wilki i lodowe żywiołaki. Na płaskowyżu śpi lodowy smok.', 'Szronogrzbiet'],
    ['desert', 'Ruiny Piasków', 'Poziomy 18–26', 'Oaza, skorpiony i mumie, a za nimi świątynia dawnego królestwa – i jego nieumarły władca.', 'Sethar, Król Cieni'],
  ];
  document.getElementById('regions').innerHTML = REG.map((r) => `<article class="card hover region"><img src="/img/${r[0]}_m.jpg" alt="${r[1]}" loading="lazy" width="640" height="360"><div class="body"><h3>${r[1]}</h3><p class="muted" style="margin-bottom:10px">${r[3]}</p><span class="tag">${r[2]}</span>${r[4] ? `<span class="tag boss">Boss: ${r[4]}</span>` : ''}</div></article>`).join('');
  const GAL = [
    ['mount.jpg', 'Szczyty Szronu – walka ze Szronogrzbietem'], ['desert.jpg', 'Ruiny Piasków – Sethar, Król Cieni'], ['cave.jpg', 'Jaskinia Cieni – Upiór Mgieł'],
    ['town.jpg', 'Srebrnogród'], ['swamp.jpg', 'Bagna Żałoby'], ['forest.jpg', 'Mroczny Bór'], ['village.jpg', 'Osada Brzozowa'],
    ['phone_play.jpg', 'Na telefonie – strzałki i przyciski', true], ['phone_map.jpg', 'Pełna mapa krainy', true], ['phone_world.jpg', 'Mapa świata', true],
  ];
  const g = document.getElementById('gallery');
  g.innerHTML = GAL.map((x, i) => `<a href="/img/${x[0]}" class="${x[2] ? 'tall' : ''}" data-i="${i}"><img src="/img/${x[2] || i === 0 ? x[0] : x[0].replace('.jpg', '_m.jpg')}" alt="${x[1]}" loading="lazy"><span>${x[1]}</span></a>`).join('');
  const lb = document.getElementById('lb');
  g.addEventListener('click', (e) => { const a = e.target.closest('a'); if (!a) return; e.preventDefault(); const x = GAL[+a.dataset.i]; lb.querySelector('img').src = '/img/' + x[0]; lb.querySelector('p').textContent = x[1]; lb.classList.add('open'); });
  lb.addEventListener('click', (e) => { if (e.target.tagName !== 'IMG') lb.classList.remove('open'); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') lb.classList.remove('open'); });
  A.api('/news').then((r) => {
    const list = r.ok ? r.data : [];
    const fmt = (d) => new Date(d + 'T12:00:00').toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById('news').innerHTML = list.map((n) => `<article class="card"><time datetime="${A.esc(n.date)}">${fmt(n.date)}</time><div><h3>${A.esc(n.title)}</h3><p class="muted" style="margin:0">${A.esc(n.text)}</p></div></article>`).join('');
  });
  A.ready.then((u) => { document.querySelectorAll('[data-play]').forEach((b) => { b.href = u ? '/postacie' : '/rejestracja'; }); });
})();
