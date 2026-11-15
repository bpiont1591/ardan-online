'use strict';
(function () {
  const EMBLEM = '<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="eg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset=".5" stop-color="#ffd84a"/><stop offset="1" stop-color="#8a6230"/></linearGradient></defs><path d="M32 3 L56 14 V32 C56 46 45 56 32 61 C19 56 8 46 8 32 V14 Z" fill="#1b1522" stroke="url(#eg)" stroke-width="3"/><path d="M32 12 V50 M24 20 H40 M27 44 L32 52 L37 44" stroke="url(#eg)" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 40 C22 36 26 42 32 40 C38 38 42 43 50 39" stroke="#b9a7ee" stroke-width="2" fill="none" opacity=".7"/></svg>';
  const A = window.ARDAN = { emblem: EMBLEM, user: null, csrf: null };
  function cookie(n) { const m = document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)')); return m ? decodeURIComponent(m[1]) : ''; }
  A.api = async function (path, body, method) {
    const opt = { method: method || (body ? 'POST' : 'GET'), headers: {}, credentials: 'same-origin' };
    if (body) { opt.headers['Content-Type'] = 'application/json'; opt.headers['X-CSRF-Token'] = cookie('ardan_csrf') || A.csrf || ''; opt.body = JSON.stringify(body); }
    let r, data = {};
    try { r = await fetch('/api' + path, opt); data = await r.json().catch(() => ({})); }
    catch (e) { return { ok: false, status: 0, data: { error: 'Brak połączenia z serwerem.' } }; }
    return { ok: r.ok, status: r.status, data };
  };
  A.me = async function () { const r = await A.api('/me'); A.csrf = r.data.csrf || cookie('ardan_csrf'); A.user = r.ok ? r.data.user : null; return A.user; };
  A.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  A.qs = (k) => new URLSearchParams(location.search).get(k);

  function nav(user) {
    const h = document.getElementById('nav'); if (!h) return;
    const home = location.pathname === '/' || location.pathname === '/index.html';
    const L = (hash, t) => `<a href="${home ? '' : '/'}${hash}">${t}</a>`;
    h.className = 'nav';
    h.innerHTML = `<div class="wrap"><a class="brand" href="/">${EMBLEM}ARDAN</a>
      <button class="menu-btn" type="button" aria-label="Menu">Menu</button>
      <nav class="links">${L('#swiat', 'Świat')}${L('#ranking', 'Ranking')}${L('#nowosci', 'Nowości')}
      <span class="online-pill"><i></i><span data-online>…</span> online</span>
      ${user ? `${user.role === 'admin' || user.role === 'moderator' ? '<a href="/admin">Panel</a>' : ''}<a href="/postacie">Moje postacie</a><a href="/logowanie" role="button" data-logout>Wyloguj (${A.esc(user.login)})</a><a class="btn primary small" href="/postacie">Graj teraz</a>`
        : `<a href="/logowanie">Zaloguj się</a><a class="btn primary small" href="/rejestracja">Załóż konto</a>`}</nav></div>`;
    h.querySelector('.menu-btn').addEventListener('click', () => h.classList.toggle('open'));
    h.querySelectorAll('.links a').forEach((a) => a.addEventListener('click', () => h.classList.remove('open')));
    const lo = h.querySelector('[data-logout]');
    if (lo) lo.addEventListener('click', async (e) => { e.preventDefault(); await A.api('/logout', {}); location.href = '/'; });
  }
  function foot() {
    const f = document.getElementById('foot'); if (!f) return;
    f.innerHTML = `<div class="wrap"><div class="cols">
      <div><a class="brand" href="/">${EMBLEM}ARDAN</a><p style="margin-top:12px">Przeglądarkowa gra MMORPG w klimacie dark fantasy. Mgła powróciła – Ardan potrzebuje bohaterów.</p></div>
      <div><h4>Gra</h4><ul><li><a href="/postacie">Graj teraz</a></li><li><a href="/rejestracja">Załóż konto</a></li><li><a href="/logowanie">Zaloguj się</a></li><li><a href="/nie-pamietam-hasla">Nie pamiętam hasła</a></li></ul></div>
      <div><h4>Informacje</h4><ul><li><a href="/#swiat">Historia świata</a></li><li><a href="/#nowosci">Nowości</a></li><li><a href="/regulamin">Regulamin</a></li><li><a href="/prywatnosc">Polityka prywatności</a></li></ul></div>
      </div><div class="copy">© ${new Date().getFullYear()} ARDAN. Wszelkie prawa zastrzeżone.</div></div>`;
  }
  async function online() {
    const r = await A.api('/stats');
    document.querySelectorAll('[data-online]').forEach((el) => { el.textContent = r.ok ? String(r.data.online) : '–'; });
  }
  // password strength 0..4 (mirrors server rules)
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
  A.ready = (async () => { const u = await A.me(); nav(u); foot(); online(); setInterval(online, 20000); return u; })();
})();
