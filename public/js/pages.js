'use strict';
(function () {
  const A = window.ARDAN;
  const page = document.body.dataset.page;
  const f = document.getElementById('f');
  const val = (n) => { const e = f.querySelector(`[name="${n}"]`); return e ? e.value : ''; };
  const safeNext = (n) => (n && /^\/[a-z0-9\-\/?=&]*$/i.test(n) && !n.startsWith('//') ? n : '/postacie');
  function busy(on) { const b = f.querySelector('button[type=submit]'); b.disabled = on; if (on) { b.dataset.t = b.textContent; b.textContent = 'Chwileczkę…'; } else if (b.dataset.t) b.textContent = b.dataset.t; }
  async function submit(path, body, onOk) {
    busy(true);
    const r = await A.api(path, body);
    busy(false);
    if (!r.ok) return A.formError(f, r.data.error || 'Wystąpił błąd. Spróbuj ponownie.', r.data.field);
    onOk(r.data);
  }

  if (page === 'register') {
    A.ready.then((u) => { if (u) location.href = '/postacie'; });
    A.meter(f.password, f.querySelector('.meter'), document.getElementById('ph'), f.login);
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const login = val('login').trim();
      if (!/^[A-Za-z0-9_]{3,20}$/.test(login)) return A.formError(f, 'Login: 3–20 znaków, tylko litery bez polskich znaków, cyfry i podkreślnik.', 'login');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val('email').trim())) return A.formError(f, 'Podaj poprawny adres e-mail.', 'email');
      if (A.strength(val('password'), login).s < 2) return A.formError(f, 'Hasło jest za słabe: min. 8 znaków i 3 rodzaje znaków, nie może zawierać loginu.', 'password');
      if (val('password') !== val('password2')) return A.formError(f, 'Hasła nie są takie same.', 'password2');
      if (!f.terms.checked) return A.formError(f, 'Musisz zaakceptować regulamin.', 'terms');
      submit('/register', { login, email: val('email').trim(), password: val('password'), password2: val('password2'), terms: true }, () => {
        A.formOk(f, 'Konto założone! Za chwilę przejdziesz do tworzenia postaci…');
        setTimeout(() => { location.href = '/postacie'; }, 700);
      });
    });
  }
  if (page === 'login') {
    const next = safeNext(A.qs('next'));
    A.ready.then((u) => { if (u) location.href = next; });
    if (A.qs('reset') === '1') A.formOk(f, 'Hasło zmienione. Zaloguj się nowym hasłem.');
    if (A.qs('wyloguj') === '1') A.formOk(f, 'Sesja wygasła. Zaloguj się ponownie.');
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!val('login').trim() || !val('password')) return A.formError(f, 'Podaj login i hasło.', !val('login').trim() ? 'login' : 'password');
      submit('/login', { login: val('login').trim(), password: val('password') }, () => { location.href = next; });
    });
  }
  if (page === 'forgot') {
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val('email').trim())) return A.formError(f, 'Podaj poprawny adres e-mail.', 'email');
      submit('/forgot', { email: val('email').trim() }, (d) => { A.formOk(f, d.message); f.querySelector('button').disabled = true; });
    });
  }
  if (page === 'reset') {
    const token = A.qs('token');
    // remove token from the address bar / referrers
    if (token) history.replaceState(null, '', '/nowe-haslo');
    if (!token) { A.formError(f, 'Brak tokenu w linku. Poproś o nowy link do resetu hasła.'); f.querySelector('button').disabled = true; }
    A.meter(f.password, f.querySelector('.meter'), document.getElementById('ph'));
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      if (A.strength(val('password')).s < 2) return A.formError(f, 'Hasło jest za słabe: min. 8 znaków i 3 rodzaje znaków.', 'password');
      if (val('password') !== val('password2')) return A.formError(f, 'Hasła nie są takie same.', 'password2');
      submit('/reset', { token, password: val('password'), password2: val('password2') }, () => {
        A.formOk(f, 'Hasło zostało zmienione. Przekierowuję do logowania…');
        setTimeout(() => { location.href = '/logowanie?reset=1'; }, 900);
      });
    });
  }
  if (page === 'chars') {
    const list = document.getElementById('list');
    const IMG = { war: 'hero_war', arc: 'hero_arc', mag: 'hero_mag' };
    async function load() {
      const r = await A.api('/characters');
      if (r.status === 401) { location.href = '/logowanie?next=/postacie'; return; }
      const cs = r.data.characters || [];
      list.innerHTML = cs.length ? cs.map((c) => `<div class="card char"><img src="/img/${IMG[c.cls]}.png" alt=""><div class="info"><div class="nick">${A.esc(c.nick)}</div><div class="muted">${A.esc(c.clsName)} · poziom ${c.lvl} · ${A.esc(c.areaName)}${c.online ? ' · <b style="color:#7be07b">w grze</b>' : ''}</div></div><a class="btn primary" href="/graj?postac=${c.id}">Graj</a></div>`).join('')
        : '<p class="muted" style="text-align:center">Nie masz jeszcze postaci. Stwórz pierwszą poniżej!</p>';
      f.style.display = cs.length >= r.data.max ? 'none' : '';
      if (cs.length >= r.data.max) list.insertAdjacentHTML('beforeend', `<p class="muted" style="text-align:center">Osiągnięto limit ${r.data.max} postaci na konto.</p>`);
    }
    A.ready.then((u) => { if (!u) { location.href = '/logowanie?next=/postacie'; return; } document.getElementById('hello').textContent = `Witaj, ${u.login}! Wybierz bohatera lub stwórz nowego.`; load(); });
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const cls = (f.querySelector('input[name=cls]:checked') || {}).value;
      const nick = val('nick').trim();
      if (!cls) return A.formError(f, 'Wybierz klasę postaci.');
      if (!/^[A-Za-z0-9_ĄĆĘŁŃÓŚŹŻąćęłńóśźż]{3,16}$/.test(nick)) return A.formError(f, 'Nick: 3–16 znaków (litery, także polskie, cyfry, podkreślnik).', 'nick');
      submit('/characters', { nick, cls }, (d) => { location.href = '/graj?postac=' + d.id; });
    });
  }
})();
