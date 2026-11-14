'use strict';
// Admin / moderator panel. All data comes from /api/admin/* which checks the role on the server.
(function () {
  const A = window.ARDAN, $ = (s, r) => (r || document).querySelector(s), esc = (s) => A.esc(String(s == null ? '' : s));
  const ROLE_N = { gracz: 'Gracz', moderator: 'Moderator', admin: 'Administrator' };
  const CH_N = { g: 'Globalny', r: 'Kraina', w: 'Prywatny', p: 'Drużyna', gu: 'Gildia' };
  let me = null, durN = {}, act = null;
  const fmt = (t) => (t ? new Date(t).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–');
  const left = (u) => { if (u === null || u === undefined) return 'na stałe'; const m = Math.max(0, Math.ceil((u - Date.now()) / 60e3)); return m < 60 ? `${m} min` : m < 2880 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${Math.floor(m / 1440)} dni`; };
  function flash(t, bad) { const m = $('#msg'); m.textContent = t; m.className = 'adm-msg ' + (bad ? 'bad' : 'good'); m.hidden = false; clearTimeout(flash.t); flash.t = setTimeout(() => { m.hidden = true; }, 5000); }
  const badge = (r) => (r && r !== 'gracz' ? `<span class="rb ${esc(r)}">${r === 'admin' ? 'ADM' : 'MOD'}</span>` : '');

  function userCard(u) {
    const st = [];
    if (u.ban) st.push(`<span class="tag ban">Zablokowany · ${esc(left(u.ban.until))}</span>`);
    if (u.mute) st.push(`<span class="tag mute">Wyciszony · ${esc(left(u.mute.until))}</span>`);
    const online = u.chars.some((c) => c.online);
    if (online) st.push('<span class="tag on">W grze</span>');
    const can = me && (me.role === 'admin' ? u.role !== 'admin' : u.role === 'gracz') && u.login !== me.login;
    const btn = (a, t, cls) => `<button type="button" class="btn small ${cls || ''}" data-act="${a}" data-id="${u.id}" data-login="${esc(u.login)}">${t}</button>`;
    return `<article class="card ucard">
      <div class="uh"><div><b>${esc(u.login)}</b> ${badge(u.role)}<div class="muted small">${esc(u.email)} · konto od ${fmt(u.created)} · ostatnio ${fmt(u.last)}</div></div><div class="tags">${st.join('')}</div></div>
      <div class="chars">${u.chars.map((c) => `<span class="ch ${c.online ? 'on' : ''}">${esc(c.nick)} <small>poz. ${c.lvl | 0}</small></span>`).join('') || '<span class="muted small">Brak postaci</span>'}</div>
      ${u.ban ? `<p class="small why">Blokada: ${esc(u.ban.reason)} (${esc(u.ban.by || '')})</p>` : ''}${u.mute ? `<p class="small why">Wyciszenie: ${esc(u.mute.reason)} (${esc(u.mute.by || '')})</p>` : ''}
      ${can ? `<div class="acts">${u.mute ? btn('unmute', 'Zdejmij wyciszenie') : btn('mute', 'Wycisz', 'warn')}${u.ban ? btn('unban', 'Odblokuj') : btn('ban', 'Zablokuj konto', 'bad')}${online ? btn('kick', 'Wyrzuć z gry') : ''}
        ${me.role === 'admin' ? `<select data-role="${u.id}" aria-label="Rola">${['gracz', 'moderator', 'admin'].map((r) => `<option value="${r}" ${r === u.role ? 'selected' : ''}>${ROLE_N[r]}</option>`).join('')}</select>` : ''}</div>` : ''}
    </article>`;
  }
  async function search(q) {
    const r = await A.api('/admin/search?q=' + encodeURIComponent(q || ''));
    if (!r.ok) return flash(r.data.error || 'Błąd.', true);
    $('#players').innerHTML = r.data.users.map(userCard).join('') || '<p class="muted">Nic nie znaleziono.</p>';
  }
  async function chat(q) {
    const r = await A.api('/admin/chat?q=' + encodeURIComponent(q || '') + '&limit=150');
    if (!r.ok) return flash(r.data.error || 'Błąd.', true);
    $('#chat').innerHTML = r.data.lines.map((l) => `<div class="cl"><span class="t">${fmt(l.ts)}</span><span class="c c-${esc(l.ch)}">${esc(CH_N[l.ch] || l.ch)}${l.target ? ' → ' + esc(l.target) : ''}</span><b>${esc(l.nick)}</b><span class="tx">${esc(l.text)}</span>${l.user_id ? `<button type="button" class="btn small warn" data-act="mute" data-id="${l.user_id}" data-login="${esc(l.nick)}" data-quote="${esc(l.text.slice(0, 80))}">Wycisz</button>` : ''}</div>`).join('') || '<p class="muted">Brak wiadomości.</p>';
  }
  async function active() {
    const r = await A.api('/admin/active'); if (!r.ok) return flash(r.data.error || 'Błąd.', true);
    const row = (x, k) => `<tr><td><b>${esc(x.login)}</b></td><td>${esc(left(x.until))}</td><td>${esc(x.reason)}</td><td>${esc(x.by_login || '')}</td><td>${fmt(x.created)}</td><td><button type="button" class="btn small" data-act="${k}" data-id="${x.user_id}" data-login="${esc(x.login)}">${k === 'unmute' ? 'Zdejmij' : 'Odblokuj'}</button></td></tr>`;
    const tbl = (rows, k, t) => `<h3>${t} <small class="muted">(${rows.length})</small></h3>${rows.length ? `<div class="tw"><table><thead><tr><th>Konto</th><th>Pozostało</th><th>Powód</th><th>Nałożył</th><th>Od</th><th></th></tr></thead><tbody>${rows.map((x) => row(x, k)).join('')}</tbody></table></div>` : '<p class="muted">Brak.</p>'}`;
    $('#active').innerHTML = tbl(r.data.bans, 'unban', 'Zablokowane konta') + tbl(r.data.mutes, 'unmute', 'Wyciszenia na czacie');
    $('#stats').innerHTML = `<span><b>${r.data.bans.length}</b> blokad</span><span><b>${r.data.mutes.length}</b> wyciszeń</span>`;
  }
  async function audit() {
    const r = await A.api('/admin/audit'); if (!r.ok) return flash(r.data.error || 'Błąd.', true);
    const AN = { mute: 'Wyciszenie', unmute: 'Zdjęcie wyciszenia', ban: 'Blokada konta', unban: 'Odblokowanie', kick: 'Wyrzucenie z gry', role: 'Zmiana roli' };
    $('#audit').innerHTML = `<div class="tw"><table><thead><tr><th>Kiedy</th><th>Kto</th><th>Akcja</th><th>Konto</th><th>Szczegóły</th><th>Skąd</th></tr></thead><tbody>${r.data.entries.map((e) => `<tr><td>${fmt(e.ts)}</td><td>${esc(e.actor_login)}</td><td>${esc(AN[e.action] || e.action)}</td><td>${esc(e.target_login || '')}</td><td>${esc(e.detail)}</td><td>${esc(e.via)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Pusto.</td></tr>'}</tbody></table></div>`;
  }
  const loaders = { players: () => search($('#searchF [name=q]').value), chat: () => chat($('#chatF [name=q]').value), active, audit };
  function tab(t) {
    document.querySelectorAll('.adm-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    document.querySelectorAll('[data-pane]').forEach((p) => { p.hidden = p.dataset.pane !== t; });
    loaders[t]();
  }
  function openAct(a, id, login, quote) {
    if (a === 'unmute' || a === 'unban') return run(a, { userId: id });
    act = { a, id };
    $('#actT').textContent = { mute: 'Wyciszenie na czacie', ban: 'Blokada konta', kick: 'Wyrzucenie z gry' }[a];
    $('#actS').textContent = `Konto: ${login}` + (quote ? ` · „${quote}”` : '');
    $('#durF').hidden = a === 'kick';
    const durs = Object.keys(durN).filter((d) => a !== 'ban' || d !== 'perm' || me.role === 'admin');
    $('#durs').innerHTML = durs.map((d, i) => `<label class="dur"><input type="radio" name="dur" value="${d}" ${i === (a === 'ban' ? 2 : 1) ? 'checked' : ''}><span>${esc(d === 'perm' ? 'Na stałe' : d)}</span></label>`).join('');
    $('#reason').value = ''; $('#reason').required = a !== 'kick';
    $('#modal').hidden = false; setTimeout(() => $('#reason').focus(), 30);
  }
  async function run(a, body) {
    const r = await A.api('/admin/' + a, body);
    if (!r.ok) flash(r.data.error || 'Błąd.', true); else flash(r.data.txt || 'Gotowe.');
    const cur = document.querySelector('.adm-tabs .on').dataset.tab; loaders[cur](); if (cur !== 'active') active();
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]'); if (t) return tab(t.dataset.tab);
    const b = e.target.closest('[data-act]'); if (b) return openAct(b.dataset.act, Number(b.dataset.id), b.dataset.login, b.dataset.quote);
    if (e.target.closest('[data-close]') || e.target.id === 'modal') { $('#modal').hidden = true; act = null; }
    const rl = e.target.closest('[data-reload]'); if (rl) loaders[rl.dataset.reload]();
  });
  document.addEventListener('change', (e) => { const s = e.target.closest('[data-role]'); if (s) run('role', { userId: Number(s.dataset.role), role: s.value }); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('#modal').hidden = true; });
  $('#actF').addEventListener('submit', (e) => {
    e.preventDefault(); if (!act) return;
    const d = $('#actF [name=dur]:checked');
    run(act.a, { userId: act.id, dur: d ? d.value : undefined, reason: $('#reason').value });
    $('#modal').hidden = true; act = null;
  });
  $('#searchF').addEventListener('submit', (e) => { e.preventDefault(); search(e.target.q.value); });
  $('#chatF').addEventListener('submit', (e) => { e.preventDefault(); chat(e.target.q.value); });
  A.ready.then(async () => {
    const r = await A.api('/admin/me');
    if (!r.ok) { document.querySelector('main').innerHTML = `<div class="card adm-deny"><h1>Brak dostępu</h1><p>${esc(r.data.error || 'Ta strona jest tylko dla moderatorów i administratorów.')}</p><a class="btn" href="/">Strona główna</a></div>`; return; }
    me = r.data; durN = r.data.durN;
    $('#who').innerHTML = `Zalogowano jako <b>${esc(me.login)}</b> ${badge(me.role)} · ${esc(ROLE_N[me.role])}`;
    if (me.role === 'admin') document.querySelector('[data-admin]').hidden = false;
    search(''); active();
  });
})();
