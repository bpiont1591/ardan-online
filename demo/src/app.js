'use strict';
// ARDAN – demo bez serwera. Konta i postacie w localStorage, świat gry symulowany w przeglądarce
// (ten sam silnik i ta sama logika serwera co w wersji online), inni gracze to boty.
(function () {
  const IMG = window.DEMO_IMG, PAGES = window.DEMO_PAGES;
  const DEMO = window.DEMO = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- routing (hash) ----------
  function parseHash() {
    const h = decodeURIComponent(location.hash.slice(1) || '/');
    if (h[0] !== '/') return { path: null, q: new URLSearchParams(), anchor: h };
    const i = h.indexOf('?');
    return { path: i < 0 ? h : h.slice(0, i), q: new URLSearchParams(i < 0 ? '' : h.slice(i + 1)) };
  }
  DEMO.q = () => parseHash().q;
  const isGame = (p) => !!p && p.startsWith('/graj');
  DEMO.go = function (path) {
    const target = '#' + path;
    if (isGame(path) !== document.body.classList.contains('game-mode')) { location.hash = target; location.reload(); return; }
    if (location.hash === target) route(); else location.hash = target;
  };

  // ---------- fake backend (localStorage) ----------
  const DB_KEY = 'ardan_demo_db_v1', SES_KEY = 'ardan_demo_session_v1';
  function db() { try { const d = JSON.parse(localStorage.getItem(DB_KEY)); if (d && d.users) return d; } catch (e) { /* ignore */ } return { users: [], chars: [], resets: [], nextUser: 1, nextChar: 1 }; }
  function saveDb(d) { localStorage.setItem(DB_KEY, JSON.stringify(d)); }
  const session = () => { const id = Number(localStorage.getItem(SES_KEY)); return db().users.find((u) => u.id === id) || null; };
  const setSession = (id) => { if (id) localStorage.setItem(SES_KEY, String(id)); else localStorage.removeItem(SES_KEY); };
  const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const rnd = (n) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return hex(a.buffer); };
  async function hashPw(pass, salt) {
    const data = new TextEncoder().encode(salt + ':' + pass);
    if (crypto.subtle) {
      // PBKDF2 tylko dla realizmu – prawdziwy serwer używa bcrypt
      const key = await crypto.subtle.importKey('raw', data, 'PBKDF2', false, ['deriveBits']);
      return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 60000, hash: 'SHA-256' }, key, 256));
    }
    let h = 2166136261; for (const b of data) { h ^= b; h = Math.imul(h, 16777619); } return 'f' + (h >>> 0).toString(16);
  }
  const LOGIN_RE = /^[A-Za-z0-9_]{3,20}$/, EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, NICK_RE = /^[A-Za-z0-9_ĄĆĘŁŃÓŚŹŻąćęłńóśźż]{3,16}$/;
  const RESERVED = /^(admin|administrator|moderator|mod|gm|system|ardan|serwer|support)$/i;
  const CLASSES = { war: 'Wojownik', arc: 'Łucznik', mag: 'Mag' };
  const START_WEAPON = { war: 'club', arc: 'sbow', mag: 'wand' };
  const AREA_NAMES = { village: 'Osada Brzozowa', forest: 'Mroczny Bór', cave: 'Jaskinia Cieni', swamp: 'Bagna Żałoby', town: 'Srebrnogród', mount: 'Szczyty Szronu', desert: 'Ruiny Piasków' };
  const newState = (cls) => ({ v: 2, cls, lvl: 1, xp: 0, hp: 9999, mp: 9999, gold: 150, area: 'village', x: 18, y: 17, inv: [{ id: 'pot', n: 3 }], eq: { w: START_WEAPON[cls], a: 'shirt' }, q: {}, kills: 0, intro: false, track: '', seen: { village: 1 }, mmz: 1 });
  const NEWS = window.DEMO_NEWS || [];
  const ok = (data) => ({ ok: true, status: 200, data });
  const bad = (status, error, field) => ({ ok: false, status, data: { error, field } });
  const pwProblem = (p, login) => (A.strength(p, login).s < 2 ? 'Hasło jest za słabe: min. 8 znaków i 3 rodzaje znaków, nie może zawierać loginu.' : null);

  async function backend(path, b) {
    const d = db(), me = session();
    switch (path) {
      case '/me': return ok({ user: me ? { login: me.login, email: me.email } : null });
      case '/stats': return ok({ online: BOT_DEFS.length + 1 });
      case '/news': return ok(NEWS);
      case '/ranking': { const lv = d.chars.map((c) => ({ nick: c.nick, cls: c.cls, lvl: (c.data && c.data.lvl) || c.lvl || 1 })).concat(BOT_DEFS.map((x) => ({ nick: x.nick, cls: x.cls, lvl: x.lvl }))); return ok(window.DEMO_REQUIRE('./ranking').ranking(lv)); }
      case '/register': {
        const login = String(b.login || '').trim(), email = String(b.email || '').trim().toLowerCase();
        if (!LOGIN_RE.test(login)) return bad(400, 'Login: 3–20 znaków, tylko litery bez polskich znaków, cyfry i podkreślnik.', 'login');
        if (!EMAIL_RE.test(email)) return bad(400, 'Podaj poprawny adres e-mail.', 'email');
        const pp = pwProblem(b.password, login); if (pp) return bad(400, pp, 'password');
        if (b.password !== b.password2) return bad(400, 'Hasła nie są takie same.', 'password2');
        if (b.terms !== true) return bad(400, 'Musisz zaakceptować regulamin.', 'terms');
        if (d.users.some((u) => u.login.toLowerCase() === login.toLowerCase())) return bad(409, 'Ten login jest już zajęty.', 'login');
        if (d.users.some((u) => u.email === email)) return bad(409, 'Konto z tym adresem e-mail już istnieje.', 'email');
        const salt = rnd(16);
        const u = { id: d.nextUser++, login, email, salt, hash: await hashPw(b.password, salt), created: Date.now() };
        d.users.push(u); saveDb(d); setSession(u.id);
        return ok({ ok: true });
      }
      case '/login': {
        const id = String(b.login || '').trim().toLowerCase();
        if (!id || !b.password) return bad(400, 'Podaj login i hasło.');
        const u = d.users.find((x) => x.login.toLowerCase() === id || x.email === id);
        if (!u || (await hashPw(b.password, u.salt)) !== u.hash) return bad(401, 'Nieprawidłowy login lub hasło.');
        setSession(u.id); return ok({ ok: true });
      }
      case '/logout': setSession(null); return ok({ ok: true });
      case '/forgot': {
        const email = String(b.email || '').trim().toLowerCase();
        if (!EMAIL_RE.test(email)) return bad(400, 'Podaj poprawny adres e-mail.');
        const generic = { ok: true, message: 'Jeśli konto z tym adresem istnieje, wysłaliśmy na nie link do ustawienia nowego hasła. Sprawdź skrzynkę (także SPAM).' };
        const u = d.users.find((x) => x.email === email);
        if (!u) return ok(Object.assign(generic, { demoNone: true }));
        const token = rnd(24);
        d.resets.push({ token, user: u.id, exp: Date.now() + 30 * 60e3, used: false }); saveDb(d);
        return ok(Object.assign(generic, { demoLink: '#/nowe-haslo?token=' + token, demoLogin: u.login }));
      }
      case '/reset': {
        const r = d.resets.find((x) => x.token === b.token);
        if (!r || r.used || r.exp < Date.now()) return bad(400, 'Link wygasł lub został już użyty. Poproś o nowy.');
        const u = d.users.find((x) => x.id === r.user); if (!u) return bad(400, 'Link jest nieprawidłowy.');
        const pp = pwProblem(b.password, u.login); if (pp) return bad(400, pp, 'password');
        if (b.password !== b.password2) return bad(400, 'Hasła nie są takie same.', 'password2');
        u.salt = rnd(16); u.hash = await hashPw(b.password, u.salt); r.used = true; saveDb(d); setSession(null);
        return ok({ ok: true });
      }
      case '/characters': {
        if (!me) return bad(401, 'Zaloguj się.');
        const mine = d.chars.filter((c) => c.user === me.id);
        if (!b) return ok({ max: 3, characters: mine.map((c) => ({ id: c.id, nick: c.nick, cls: c.cls, lvl: c.data.lvl || 1, area: c.data.area, clsName: CLASSES[c.cls], areaName: AREA_NAMES[c.data.area] || c.data.area, online: false })) });
        const nick = String(b.nick || '').trim(), cls = String(b.cls || '');
        if (!NICK_RE.test(nick)) return bad(400, 'Nick: 3–16 znaków (litery, także polskie, cyfry, podkreślnik).', 'nick');
        if (RESERVED.test(nick)) return bad(400, 'Ten nick jest zarezerwowany.', 'nick');
        if (!CLASSES[cls]) return bad(400, 'Wybierz klasę postaci.', 'cls');
        if (mine.length >= 3) return bad(400, 'Możesz mieć maksymalnie 3 postacie.');
        if (d.chars.some((c) => c.nick.toLowerCase() === nick.toLowerCase()) || BOT_DEFS.some((x) => x.nick.toLowerCase() === nick.toLowerCase())) return bad(409, 'Ten nick jest już zajęty.', 'nick');
        const c = { id: d.nextChar++, user: me.id, nick, cls, data: newState(cls), created: Date.now() };
        d.chars.push(c); saveDb(d);
        return ok({ ok: true, id: c.id });
      }
    }
    return bad(404, 'Nie znaleziono.');
  }

  // ---------- site helpers (jak public/js/site.js) ----------
  const EMBLEM = '<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="eg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset=".5" stop-color="#ffd84a"/><stop offset="1" stop-color="#8a6230"/></linearGradient></defs><path d="M32 3 L56 14 V32 C56 46 45 56 32 61 C19 56 8 46 8 32 V14 Z" fill="#1b1522" stroke="url(#eg)" stroke-width="3"/><path d="M32 12 V50 M24 20 H40 M27 44 L32 52 L37 44" stroke="url(#eg)" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 40 C22 36 26 42 32 40 C38 38 42 43 50 39" stroke="#b9a7ee" stroke-width="2" fill="none" opacity=".7"/></svg>';
  const A = window.ARDAN = { emblem: EMBLEM, user: null };
  A.api = async function (path, body) {
    if (body) await sleep(120 + Math.random() * 180);
    try { return await backend(path, body || null); } catch (e) { console.warn(e); return bad(500, 'Wystąpił błąd. Spróbuj ponownie.'); }
  };
  A.me = async function () { const r = await A.api('/me'); A.user = r.data.user; return A.user; };
  A.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  A.strength = function (p, login) {
    if (!p) return { s: 0, t: '' };
    let k = 0;
    if (/[a-ząćęłńóśźż]/.test(p)) k++; if (/[A-ZĄĆĘŁŃÓŚŹŻ]/.test(p)) k++; if (/[0-9]/.test(p)) k++; if (/[^A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż]/.test(p)) k++;
    let s = 1;
    if (p.length >= 8 && k >= 3) s = 2; else if (p.length >= 6) s = 1;
    if (s === 2 && (p.length >= 12 || k === 4)) s = 3;
    if (s === 3 && p.length >= 14 && k === 4) s = 4;
    if (login && p.toLowerCase().includes(login.toLowerCase())) s = Math.min(s, 1);
    return { s, t: ['', 'Za słabe', 'Wystarczające', 'Silne', 'Bardzo silne'][s] };
  };
  A.meter = function (input, meterEl, labelEl, loginInput) {
    const upd = () => { const r = A.strength(input.value, loginInput && loginInput.value); const i = meterEl.querySelector('i'); i.style.width = (r.s * 25) + '%'; i.style.background = ['#555', '#e0644f', '#e8b04a', '#9bd36a', '#5fd35a'][r.s]; labelEl.textContent = r.t ? 'Siła hasła: ' + r.t : 'Min. 8 znaków, co najmniej 3 rodzaje: małe i wielkie litery, cyfry, symbole.'; };
    input.addEventListener('input', upd); if (loginInput) loginInput.addEventListener('input', upd); upd();
  };
  A.formError = function (form, msg, field) {
    const al = form.querySelector('.alert'); al.className = 'alert err show'; al.textContent = msg;
    form.querySelectorAll('.field').forEach((f) => f.classList.remove('bad'));
    if (field) { const inp = form.querySelector(`[name="${field}"]`); if (inp) { inp.closest('.field') && inp.closest('.field').classList.add('bad'); inp.focus(); } }
  };
  A.formOk = function (form, msg) { const al = form.querySelector('.alert'); al.className = 'alert ok show'; al.textContent = msg; };

  function nav(user, home) {
    const h = document.getElementById('nav'); if (!h) return;
    const L = (id, t) => `<a href="${home ? '#' + id : '#/?s=' + id}">${t}</a>`;
    h.className = 'nav';
    h.innerHTML = `<div class="wrap"><a class="brand" href="#/">${EMBLEM}ARDAN</a>
      <button class="menu-btn" type="button" aria-label="Menu">Menu</button>
      <nav class="links">${L('swiat', 'Świat')}${L('klasy', 'Klasy')}${L('krainy', 'Krainy')}${L('galeria', 'Galeria')}${L('ranking', 'Ranking')}${L('nowosci', 'Nowości')}
      <span class="online-pill"><i></i><span data-online>…</span> online</span>
      ${user ? `<a href="#/postacie">Moje postacie</a><a href="#/" data-logout>Wyloguj (${A.esc(user.login)})</a><a class="btn primary small" href="#/postacie">Graj teraz</a>`
        : `<a href="#/logowanie">Zaloguj się</a><a class="btn primary small" href="#/rejestracja">Załóż konto</a>`}</nav></div>`;
    h.querySelector('.menu-btn').addEventListener('click', () => h.classList.toggle('open'));
    h.querySelectorAll('.links a').forEach((a) => a.addEventListener('click', () => h.classList.remove('open')));
    const lo = h.querySelector('[data-logout]');
    if (lo) lo.addEventListener('click', async (e) => { e.preventDefault(); await A.api('/logout', {}); DEMO.go('/'); });
  }
  function foot() {
    const f = document.getElementById('foot'); if (!f) return;
    f.innerHTML = `<div class="wrap"><div class="cols">
      <div><a class="brand" href="#/">${EMBLEM}ARDAN</a><p style="margin-top:12px">Przeglądarkowa gra MMORPG w klimacie dark fantasy. Mgła powróciła – Ardan potrzebuje bohaterów.</p></div>
      <div><h4>Gra</h4><ul><li><a href="#/postacie">Graj teraz</a></li><li><a href="#/rejestracja">Załóż konto</a></li><li><a href="#/logowanie">Zaloguj się</a></li><li><a href="#/nie-pamietam-hasla">Nie pamiętam hasła</a></li></ul></div>
      <div><h4>Informacje</h4><ul><li><a href="#/?s=swiat">Historia świata</a></li><li><a href="#/?s=nowosci">Nowości</a></li><li><a href="#/regulamin">Regulamin</a></li><li><a href="#/prywatnosc">Polityka prywatności</a></li></ul></div>
      </div><div class="copy">© ${new Date().getFullYear()} ARDAN. Wszelkie prawa zastrzeżone. · Wersja demo – dane zapisują się tylko w tej przeglądarce.</div></div>`;
  }
  async function online() { const r = await A.api('/stats'); document.querySelectorAll('[data-online]').forEach((el) => { el.textContent = r.ok ? String(r.data.online) : '–'; }); }

  // ---------- pages ----------
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
  const INIT = {};
  INIT.home = function (q, u) {
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
    document.getElementById('regions').innerHTML = REG.map((r) => `<article class="card hover region"><img src="${IMG[r[0] + '_m.jpg']}" alt="${r[1]}" width="640" height="360"><div class="body"><h3>${r[1]}</h3><p class="muted" style="margin-bottom:10px">${r[3]}</p><span class="tag">${r[2]}</span>${r[4] ? `<span class="tag boss">Boss: ${r[4]}</span>` : ''}</div></article>`).join('');
    const GAL = [
      ['mount.jpg', 'Szczyty Szronu – walka ze Szronogrzbietem'], ['desert.jpg', 'Ruiny Piasków – Sethar, Król Cieni'], ['cave.jpg', 'Jaskinia Cieni – Upiór Mgieł'],
      ['town.jpg', 'Srebrnogród'], ['swamp.jpg', 'Bagna Żałoby'], ['forest.jpg', 'Mroczny Bór'], ['village.jpg', 'Osada Brzozowa'],
      ['phone_play.jpg', 'Na telefonie – strzałki i przyciski', true], ['phone_map.jpg', 'Pełna mapa krainy', true], ['phone_world.jpg', 'Mapa świata', true],
    ];
    const g = document.getElementById('gallery');
    g.innerHTML = GAL.map((x, i) => `<a href="#galeria" class="${x[2] ? 'tall' : ''}" data-i="${i}"><img src="${IMG[x[2] || i === 0 ? x[0] : x[0].replace('.jpg', '_m.jpg')]}" alt="${x[1]}"><span>${x[1]}</span></a>`).join('');
    const lb = document.getElementById('lb');
    g.addEventListener('click', (e) => { const a = e.target.closest('a'); if (!a) return; e.preventDefault(); e.stopPropagation(); const x = GAL[+a.dataset.i]; lb.querySelector('img').src = IMG[x[0]]; lb.querySelector('p').textContent = x[1]; lb.classList.add('open'); });
    lb.addEventListener('click', (e) => { if (e.target.tagName !== 'IMG') lb.classList.remove('open'); });
    A.api('/ranking').then((r) => initRanking(r.ok ? r.data : null, A.esc));
    A.api('/news').then((r) => {
      const fmt = (d) => new Date(d + 'T12:00:00').toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
      const el = document.getElementById('news'); if (el) el.innerHTML = r.data.map((n) => `<article class="card"><time datetime="${A.esc(n.date)}">${fmt(n.date)}</time><div><h3>${A.esc(n.title)}</h3><p class="muted" style="margin:0">${A.esc(n.text)}</p></div></article>`).join('');
    });
    document.querySelectorAll('[data-play]').forEach((b) => { b.href = u ? '#/postacie' : '#/rejestracja'; });
    const s = q.get('s'); if (s) setTimeout(() => { const el = document.getElementById(s); if (el) el.scrollIntoView(); }, 30);
  };

  function formKit(f) {
    const val = (n) => { const e = f.querySelector(`[name="${n}"]`); return e ? e.value : ''; };
    function busy(on) { const b = f.querySelector('button[type=submit]'); b.disabled = on; if (on) { b.dataset.t = b.textContent; b.textContent = 'Chwileczkę…'; } else if (b.dataset.t) b.textContent = b.dataset.t; }
    async function submit(path, body, onOk) { busy(true); const r = await A.api(path, body); busy(false); if (!r.ok) return A.formError(f, r.data.error || 'Wystąpił błąd. Spróbuj ponownie.', r.data.field); onOk(r.data); }
    return { val, submit };
  }
  const safeNext = (n) => (n && /^\/[a-z0-9\-\/?=&]*$/i.test(n) && !n.startsWith('//') ? n : '/postacie');

  INIT.register = function (q, u) {
    if (u) return DEMO.go('/postacie');
    const f = document.getElementById('f'), { val, submit } = formKit(f);
    A.meter(f.password, f.querySelector('.meter'), document.getElementById('ph'), f.login);
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const login = val('login').trim();
      if (!LOGIN_RE.test(login)) return A.formError(f, 'Login: 3–20 znaków, tylko litery bez polskich znaków, cyfry i podkreślnik.', 'login');
      if (!EMAIL_RE.test(val('email').trim())) return A.formError(f, 'Podaj poprawny adres e-mail.', 'email');
      if (A.strength(val('password'), login).s < 2) return A.formError(f, 'Hasło jest za słabe: min. 8 znaków i 3 rodzaje znaków, nie może zawierać loginu.', 'password');
      if (val('password') !== val('password2')) return A.formError(f, 'Hasła nie są takie same.', 'password2');
      if (!f.terms.checked) return A.formError(f, 'Musisz zaakceptować regulamin.', 'terms');
      submit('/register', { login, email: val('email').trim(), password: val('password'), password2: val('password2'), terms: true }, () => {
        A.formOk(f, 'Konto założone! Za chwilę przejdziesz do tworzenia postaci…');
        setTimeout(() => DEMO.go('/postacie'), 800);
      });
    });
  };
  INIT.login = function (q, u) {
    const next = safeNext(q.get('next'));
    if (u) return DEMO.go(next);
    const f = document.getElementById('f'), { val, submit } = formKit(f);
    if (q.get('reset') === '1') A.formOk(f, 'Hasło zmienione. Zaloguj się nowym hasłem.');
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!val('login').trim() || !val('password')) return A.formError(f, 'Podaj login i hasło.', !val('login').trim() ? 'login' : 'password');
      submit('/login', { login: val('login').trim(), password: val('password') }, () => DEMO.go(next));
    });
  };
  INIT.forgot = function () {
    const f = document.getElementById('f'), { val, submit } = formKit(f);
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!EMAIL_RE.test(val('email').trim())) return A.formError(f, 'Podaj poprawny adres e-mail.', 'email');
      submit('/forgot', { email: val('email').trim() }, (d) => {
        A.formOk(f, d.message);
        const old = document.getElementById('demoMail'); if (old) old.remove();
        const box = document.createElement('div'); box.id = 'demoMail'; box.className = 'demo-mail';
        box.innerHTML = d.demoLink
          ? `<b>✉ W wersji demo link pokazujemy tutaj zamiast maila</b><p>Wiadomość dla konta <b>${A.esc(d.demoLogin)}</b>: „Kliknij, aby ustawić nowe hasło. Link jest ważny 30 minut i działa tylko raz.”</p><a class="btn primary" href="${d.demoLink}">Ustaw nowe hasło →</a>`
          : '<b>✉ Wersja demo</b><p>Nie ma konta z tym adresem w tej przeglądarce, więc żaden mail nie zostałby wysłany. Załóż najpierw konto.</p>';
        f.after(box);
      });
    });
  };
  INIT.reset = function (q) {
    const f = document.getElementById('f'), { val, submit } = formKit(f);
    const token = q.get('token');
    if (token) history.replaceState(null, '', '#/nowe-haslo');
    if (!token) { A.formError(f, 'Brak tokenu w linku. Poproś o nowy link do resetu hasła.'); f.querySelector('button').disabled = true; }
    A.meter(f.password, f.querySelector('.meter'), document.getElementById('ph'));
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      if (A.strength(val('password')).s < 2) return A.formError(f, 'Hasło jest za słabe: min. 8 znaków i 3 rodzaje znaków.', 'password');
      if (val('password') !== val('password2')) return A.formError(f, 'Hasła nie są takie same.', 'password2');
      submit('/reset', { token, password: val('password'), password2: val('password2') }, () => {
        A.formOk(f, 'Hasło zostało zmienione. Przekierowuję do logowania…');
        setTimeout(() => DEMO.go('/logowanie?reset=1'), 900);
      });
    });
  };
  INIT.chars = function (q, u) {
    if (!u) return DEMO.go('/logowanie?next=/postacie');
    const f = document.getElementById('f'), { val, submit } = formKit(f);
    const list = document.getElementById('list');
    const IMGS = { war: 'hero_war.png', arc: 'hero_arc.png', mag: 'hero_mag.png' };
    document.getElementById('hello').textContent = `Witaj, ${u.login}! Wybierz bohatera lub stwórz nowego.`;
    (async () => {
      const r = await A.api('/characters');
      const cs = r.data.characters || [];
      list.innerHTML = cs.length ? cs.map((c) => `<div class="card char"><img src="${IMG[IMGS[c.cls]]}" alt=""><div class="info"><div class="nick">${A.esc(c.nick)}</div><div class="muted">${A.esc(c.clsName)} · poziom ${c.lvl} · ${A.esc(c.areaName)}</div></div><a class="btn primary" href="#/graj?postac=${c.id}">Graj</a></div>`).join('')
        : '<p class="muted" style="text-align:center">Nie masz jeszcze postaci. Stwórz pierwszą poniżej!</p>';
      f.style.display = cs.length >= r.data.max ? 'none' : '';
      if (cs.length >= r.data.max) list.insertAdjacentHTML('beforeend', `<p class="muted" style="text-align:center">Osiągnięto limit ${r.data.max} postaci na konto.</p>`);
    })();
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const cls = (f.querySelector('input[name=cls]:checked') || {}).value;
      const nick = val('nick').trim();
      if (!cls) return A.formError(f, 'Wybierz klasę postaci.');
      if (!NICK_RE.test(nick)) return A.formError(f, 'Nick: 3–16 znaków (litery, także polskie, cyfry, podkreślnik).', 'nick');
      submit('/characters', { nick, cls }, (d) => DEMO.go('/graj?postac=' + d.id));
    });
  };

  let renderSeq = 0;
  async function route() {
    const { path, q, anchor } = parseHash();
    const gameNow = document.body.classList.contains('game-mode');
    if (isGame(path) !== gameNow) { location.reload(); return; }
    if (gameNow) return;
    const main = document.getElementById('main');
    if (anchor) { if (main.dataset.path !== '/') { location.hash = '#/?s=' + anchor; } return; }
    const seq = ++renderSeq;
    const u = await A.me(); if (seq !== renderSeq) return;
    const pg = PAGES[path] || PAGES['/404'];
    document.title = pg.title; document.body.dataset.page = pg.page;
    main.innerHTML = pg.html; main.dataset.path = path;
    window.scrollTo(0, 0);
    nav(u, pg.page === 'home'); foot(); online();
    if (INIT[pg.page]) INIT[pg.page](q, u);
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const lb = document.getElementById('lb'); if (lb) lb.classList.remove('open'); } });

  // ---------- świat gry w przeglądarce ----------
  const BOT_DEFS = [
    { nick: 'Zbyszko', cls: 'war', lvl: 8, a: 'leather' },
    { nick: 'Jagienka', cls: 'arc', lvl: 6 },
    { nick: 'Radogost', cls: 'mag', lvl: 9 },
    { nick: 'Wilczyca', cls: 'arc', lvl: 4 },
    { nick: 'Bolko_z_Boru', cls: 'war', lvl: 3 },
  ];
  DEMO.BOT_DEFS = BOT_DEFS;
  const charsMock = {
    load(charId, userId) {
      if (typeof charId === 'string' && charId[0] === 'b') {
        const i = +charId.slice(1), b = BOT_DEFS[i]; if (!b) return null;
        const st = newState(b.cls); st.lvl = b.lvl; st.intro = true; st.gold = 5000;
        return { id: charId, nick: b.nick, cls: b.cls, data: st, bot: i };
      }
      const c = db().chars.find((x) => x.id === charId && x.user === userId); if (!c) return null;
      const data = JSON.parse(JSON.stringify(c.data || newState(c.cls))); data.cls = c.cls;
      return { id: c.id, nick: c.nick, cls: c.cls, data };
    },
    save(charId, P) {
      if (typeof charId === 'string') return;
      const d = db(); const c = d.chars.find((x) => x.id === charId); if (!c) return;
      c.data = JSON.parse(JSON.stringify(P)); saveDb(d);
    },
  };
  DEMO.charsMock = charsMock;

  const BOT_LINES = [
    ['g', 'Ktoś idzie wieczorem na Upiora Mgieł? Szukam drużyny'],
    ['g', 'Sprzedam łuk z Mrocznego Boru, tanio :)'],
    ['g', 'Gdzie jest Pustelnik Ignacy?'],
    ['g', 'Pustelnik siedzi przy ognisku w Borze, idź za złotą strzałką'],
    ['r', 'Uwaga na wilki przy wyjściu z osady'],
    ['g', 'Wiedźma Moczarów mnie zjadła trzeci raz xD'],
    ['g', 'Ma ktoś mikstury many na zbyciu?'],
    ['g', 'Brawo dla tego, kto ubił Szronogrzbieta!'],
    ['r', 'Kowal Bogumił ma nowy topór, polecam'],
    ['g', 'Jaki poziom na Jaskinię Cieni? 7 wystarczy?'],
    ['g', 'Z 7 dasz radę, tylko weź mikstury'],
    ['g', 'Zbieram ekipę na Ruiny Piasków, piszcie /w Radogost'],
  ];
  const WHISPER_REPLIES = ['Hej! Jasne, pomogę jak tylko skończę zadanie :)', 'Siema! Jestem w osadzie, chodź do studni', 'Dzięki, powodzenia w Ardanie!'];

  function createBots(world) {
    const bots = [];
    let player = null, t = 0, nextLine = 9, lineIdx = 0, inviteAt = -1, greeted = false;
    const say = (b, ch, text) => { if (world.players.get(b.pid) === b) world.chat.handle(b, { ch, text }); };
    function join(i) {
      const ws = { readyState: 1, send() {}, close() {} };
      const p = world.join(ws, { id: 0 }, 'b' + i); if (!p) return;
      const arena = i === 3 || i === 4;
      p.bot = { home: arena ? { x: 18 + i - 3, y: 22 } : { x: 18, y: 17 }, rad: arena ? 2 : 9, t: 0, party: false,
        onTrade(q) { setTimeout(() => { if (world.players.get(p.pid) !== p) return; world.trade.onMsg(p, { t: 'tr', a: 'accept' }); say(p, 'g', `/w ${q.nick} Jasne, pohandlujmy! Zaakceptuję, gdy będziesz gotów.`); }, 1200); },
        onGuildInvite(q, g) { setTimeout(() => { if (world.players.get(p.pid) !== p) return; world.guilds.onMsg(p, { t: 'gd', a: 'accept' }); setTimeout(() => world.chat.commands.gi && world.chat.commands.gi(p, 'Dzięki za zaproszenie do gildii! :)'), 800); }, 2000); },
        recv(msg) {
        if (msg.t === 'tr' && msg.open && msg.them && msg.them.ok && !msg.me.ok) setTimeout(() => { if (p.trade) world.trade.onMsg(p, { t: 'tr', a: 'ok' }); }, 900);
        if (msg.t === 'chat' && msg.ch === 'w' && msg.to === p.nick && msg.from !== p.nick) setTimeout(() => say(p, 'g', `/w ${msg.from} ${WHISPER_REPLIES[Math.floor(Math.random() * WHISPER_REPLIES.length)]}`), 1800 + Math.random() * 1500);
        if (msg.t === 'chat' && msg.ch === 's' && /zaprasza cię do drużyny/.test(msg.text)) setTimeout(() => { if (world.players.get(p.pid) === p && !p.partyId) say(p, 'g', '/akceptuj'); }, 1300);
        if (msg.t === 'dg' && msg.in && !p.bot.inDg) { p.bot.inDg = true; setTimeout(() => say(p, 'p', `Wchodzę z tobą do lochu „${msg.n}”! Wybierz grupę, ja strzelam z tyłu 🏹`), 1200); }
        if (msg.t === 'dg' && msg.in === false) p.bot.inDg = false;
        if (msg.t === 'party') {
          const inP = msg.m.length > 1;
          if (inP && !p.bot.party) setTimeout(() => say(p, 'p', 'Super, że jesteś! Trzymam się blisko, idziemy razem :)'), 1500);
          p.bot.party = inP;
        }
      } };
      bots.push(p);
      seedBot(p, i);
    }
    const store = window.DEMO_REQUIRE('./store'), items = window.DEMO_REQUIRE('./items');
    const SEED_PVP = [[1086, 7, 2], [1012, 3, 3], [1052, 5, 2], [968, 2, 4], [941, 1, 5]];
    function seedBot(p, i) {
      if (i === 3 || i === 4) { const P = p.api.P(); const x = i === 3 ? 17 : 21; if (!p.api.solid('village', x, 22)) { P.x = x; P.y = 22; } }
      const rk = store.get('pvp', {});
      const ac = store.get('achc', {}); if (!ac[p.ckey]) { ac[p.ckey] = { n: p.nick, cls: BOT_DEFS[i].cls, lvl: BOT_DEFS[i].lvl, a: [9, 6, 11, 4, 3][i] }; store.set('achc', ac); }
      if (!rk[p.ckey]) { const [pts, w, l] = SEED_PVP[i]; rk[p.ckey] = { n: p.nick, cls: BOT_DEFS[i].cls, lvl: BOT_DEFS[i].lvl, pts, w, l }; store.set('pvp', rk); }
      if (i === 0 || i === 2) {
        const gd = world.guilds.data(); let g = Object.values(gd.g).find((x) => x.tag === 'SM');
        if (!g && i === 0) g = world.guilds.create(p, 'Strażnicy Mgły', 'SM', true);
        else if (g && !g.m[p.ckey]) world.guilds.add(p, g, i === 0 ? 2 : 1);
        else if (g) { p.guildId = g.id; p.guildTag = g.tag; }
      }
      const mk = world.market.data();
      if (mk.list.filter((x) => x.s === p.ckey).length < 2 && mk.list.length < 14) {
        for (let k = 0; k < 2; k++) { const it = items.randomItem(Math.max(1, BOT_DEFS[i].lvl - 3 + k * 3), k === 1 && Math.random() < 0.5 ? 1 : 0); if (it) world.market.list(p, it, Math.max(5, Math.round(it.v * (1.4 + Math.random())))); }
      }
    }
    let buyT = 40;
    return {
      name: 'bots',
      start() { join(0); join(1); join(2); setTimeout(() => join(3), 7000); setTimeout(() => join(4), 16000); },
      onJoin(p) { if (!p.bot && !String(p.pid).startsWith('pb')) { player = p; t = 0; greeted = false; inviteAt = 20; } },
      onLeave(p) { if (p === player) player = null; },
      onTick(dt) {
        t += dt;
        if (player && !greeted && t > 4 && bots[0]) { greeted = true; say(bots[0], 'g', `Cześć ${player.nick}! Witaj w Ardanie :)`); setTimeout(() => bots[2] && say(bots[2], 'g', 'Zacznij od Sołtysa Radomira, da ci pierwsze zadanie. Strzałka pokaże drogę'), 4500); }
        if (player && inviteAt > 0 && t > inviteAt && bots[1]) { inviteAt = t > 100 ? -1 : t + 70; if (!player.partyId) say(bots[1], 'g', '/zapros ' + player.nick); else inviteAt = -1; }
        if (player && t > buyT && bots.length) {
          buyT = t + 35 + Math.random() * 30;
          const mine = world.market.data().list.filter((x) => x.s === player.ckey);
          if (mine.length && Math.random() < 0.6) { const L = mine[Math.floor(Math.random() * mine.length)]; const b = bots[Math.floor(Math.random() * bots.length)]; if (world.players.get(b.pid) === b && L.pr <= Math.max(400, L.it.v * 4)) world.market.buy(b, L.id); }
        }
        if (t > nextLine && bots.length) { nextLine = t + 14 + Math.random() * 16; const [ch, text] = BOT_LINES[lineIdx++ % BOT_LINES.length]; say(bots[Math.floor(Math.random() * bots.length)], ch, text); }
        for (const b of bots) {
          if (world.players.get(b.pid) !== b) continue;
          if (b.dg && (!player || !player.dg)) { world.onMessage(b, JSON.stringify({ t: 'dg', a: 'leave' })); continue; }
          const B = b.bot, P = b.api.P();
          if (B.party && player && !b.battle && !b.dg && !player.dg) { const Q = player.api.P(); if (Q.area !== P.area) { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!b.api.solid(Q.area, Math.round(Q.x) + dx, Math.round(Q.y) + dy)) { P.area = Q.area; P.x = Math.round(Q.x) + dx; P.y = Math.round(Q.y) + dy; break; } } }
          B.t -= dt; if (B.t > 0) continue;
          let tx = null, ty = null;
          if (B.party && player) { const Q = player.api.P(); if (Q.area === P.area && Math.max(Math.abs(Q.x - P.x), Math.abs(Q.y - P.y)) > 2) { tx = Q.x; ty = Q.y; } }
          if (tx === null && P.area === 'village' && Math.max(Math.abs(B.home.x - P.x), Math.abs(B.home.y - P.y)) > B.rad) { tx = B.home.x; ty = B.home.y; }
          if (tx !== null) { b.mx = Math.sign(tx - P.x); b.my = Math.sign(ty - P.y); if (Math.random() < 0.25) b.mx = b.mx ? b.mx : (Math.random() < 0.5 ? -1 : 1); B.t = 0.35; }
          else if (Math.random() < 0.35) { b.mx = 0; b.my = 0; B.t = 1 + Math.random() * 2.5; }
          else { b.mx = [-1, 0, 1][Math.floor(Math.random() * 3)]; b.my = [-1, 0, 1][Math.floor(Math.random() * 3)]; B.t = 0.5 + Math.random() * 1.6; }
        }
      },
    };
  }

  let world = null;
  function getWorld() {
    if (world) return world;
    const W = window.DEMO_REQUIRE('./game').World;
    const oSend = W.prototype.send;
    W.prototype.send = function (p, msg) { if (p.bot) { p.bot.recv(msg); return; } oSend.call(this, p, msg); };
    W.prototype.broadcast = function (msg) { const s = JSON.stringify(msg); for (const p of this.players.values()) { if (p.bot) p.bot.recv(msg); else if (p.ws.readyState === 1) p.ws.send(s); } };
    world = new W();
    const bots = world.use(createBots(world));
    world.start(); bots.start();
    window.addEventListener('pagehide', () => { try { world.stop(); } catch (e) { /* ignore */ } });
    DEMO.world = world;
    return world;
  }
  // WebSocket zastępczy: łączy klienta gry ze światem w tej samej karcie
  class DemoSocket {
    constructor(charId) {
      this.readyState = 0; this.p = null;
      setTimeout(() => {
        const me = session();
        const w = getWorld();
        this.readyState = 1; if (this.onopen) this.onopen();
        const self = this;
        const srvWs = { readyState: 1, send(s) { if (self.readyState === 1 && self.onmessage) self.onmessage({ data: s }); }, close(code) { srvWs.readyState = 3; self.readyState = 3; if (self.onclose) self.onclose({ code }); } };
        this.p = w.join(srvWs, { id: me ? me.id : -1 }, Number(charId));
      }, 500);
    }
    send(s) { if (this.p && this.readyState === 1) world.onMessage(this.p, s); }
    close() { this.readyState = 3; }
  }
  window.DemoSocket = DemoSocket;

  function badge() { if (document.getElementById('demoBadge')) return; const b = document.createElement('div'); b.id = 'demoBadge'; b.textContent = 'WERSJA DEMO'; b.title = 'Wersja demo: konta i postacie zapisują się tylko w tej przeglądarce, inni gracze to boty.'; document.body.appendChild(b); }

  // ---------- start ----------
  function boot() {
    const { path } = parseHash();
    if (isGame(path)) {
      document.getElementById('cssSite').media = 'not all';
      document.getElementById('cssGame').media = 'all';
      document.querySelector('meta[name=viewport]').setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
      document.body.className = 'game-mode';
      document.body.innerHTML = window.DEMO_GAME_HTML;
      document.title = 'Graj – ARDAN';
      badge();
      window.addEventListener('hashchange', route);
      if (!session()) { DEMO.go('/logowanie?next=' + path + '?postac=' + (DEMO.q().get('postac') || '')); return; }
      window.DEMO_GAME_CLIENT();
      return;
    }
    badge();
    window.addEventListener('hashchange', route);
    route();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
