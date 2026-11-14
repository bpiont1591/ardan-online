'use strict';
(function () {
  const charId = new URLSearchParams(location.search).get('postac');
  if (!charId || !/^\d+$/.test(charId)) { location.replace('/postacie'); return; }
  const $ = (id) => document.getElementById(id);
  const canvas = $('g'), chat = $('chat'), msgs = $('msgs'), input = $('chatIn'), chan = $('chan');
  const ov = $('overlay');
  const DBG = window.ARDAN_DEBUG = { last: null, me: null, dlg: null }; // read-only view for automated tests
  let ws = null, NET = null, started = false, kicked = false, tab = 'all', lines = [];
  const decode = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  const escN = (s) => String(s).replace(/[^A-Za-z0-9_ĄĆĘŁŃÓŚŹŻąćęłńóśźż]/g, '');

  const rb = (r) => (r === 'admin' ? '<span class="rb adm" title="Administrator">ADM</span>' : r === 'moderator' ? '<span class="rb mod" title="Moderator">MOD</span>' : '');
  function overlay(title, text, buttons, spin) {
    $('ovT').textContent = title; $('ovP').textContent = text || '';
    $('ovB').innerHTML = buttons || '';
    ov.classList.toggle('static', !spin); ov.classList.add('show');
  }
  function hideOverlay() { ov.classList.remove('show'); }

  // ---------- chat UI ----------
  function setOpen(on) {
    chat.classList.toggle('open', on);
    if (on) { if (NET) NET.unread = 0; msgs.scrollTop = msgs.scrollHeight; if (window.matchMedia('(pointer:fine)').matches) setTimeout(() => input.focus(), 0); }
    else { input.blur(); canvas.focus({ preventScroll: true }); }
  }
  function visible(l) { return tab === 'all' || l.ch === tab || (tab === 'p' && l.ch === 'gu') || ((tab === 'w' || tab === 'p') && l.ch === 's'); }
  function render(l) {
    const d = document.createElement('div');
    d.className = 'm c-' + l.ch; d.dataset.ch = l.ch;
    const tm = new Date(l.ts || Date.now()).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    let h = `<span class="t">${tm}</span>`;
    // l.text is already HTML-escaped by the server; nicks are restricted to [A-Za-z0-9_ + PL letters]
    if (l.ch === 's') h += l.text;
    else if (l.ch === 'w') h += l.from === NET.nick ? `do <span class="n" data-n="${escN(l.to)}">${escN(l.to)}</span>: ${l.text}` : `od ${rb(l.role)}<span class="n" data-n="${escN(l.from)}">${escN(l.from)}</span>: ${l.text}`;
    else h += `<span class="ch">${{ g: 'Glob', r: 'Kraina', p: 'Drużyna', gu: 'Gildia' }[l.ch] || ''}</span>${rb(l.role)}<span class="n${l.role ? ' r-' + (l.role === 'admin' ? 'adm' : 'mod') : ''}" data-n="${escN(l.from)}">${escN(l.from)}</span>: ${l.text}`;
    d.innerHTML = h;
    d.style.display = visible(l) ? '' : 'none';
    return d;
  }
  function addChat(l) {
    lines.push(l); const atBottom = msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 40;
    msgs.appendChild(render(l));
    while (msgs.children.length > 150) { msgs.removeChild(msgs.firstChild); lines.shift(); }
    if (atBottom || l.from === (NET && NET.nick)) msgs.scrollTop = msgs.scrollHeight;
    if (NET && NET.api) {
      const t = decode(l.text);
      const col = { g: '#f1e3b8', r: '#a6e6a6', w: '#e7b6ff', s: '#9fc6e8', p: '#aef5ae', gu: '#ffc98a' }[l.ch];
      const pre = l.ch === 's' ? '' : l.ch === 'w' ? (l.from === NET.nick ? `[do ${l.to}] ` : `[od ${l.from}] `) : l.ch === 'p' ? `[drużyna] ${l.from}: ` : l.ch === 'gu' ? `[gildia] ${l.from}: ` : `${l.from}: `;
      const line = pre + t;
      NET.api.log(line.length > 90 ? line.slice(0, 88) + '…' : line, col);
    }
    if (NET && !chat.classList.contains('open') && l.ch !== 's' && l.from !== NET.nick) NET.unread = (NET.unread || 0) + 1;
  }
  document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab; document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b));
    [...msgs.children].forEach((d) => { d.style.display = visible({ ch: d.dataset.ch }) ? '' : 'none'; });
    if (tab === 'r') chan.value = 'r'; else if (tab === 'p') chan.value = 'p'; else if (tab === 'all') chan.value = 'g';
    if (tab === 'w' && !input.value) input.value = '/w ';
    msgs.scrollTop = msgs.scrollHeight;
  }));
  msgs.addEventListener('click', (e) => { const n = e.target.closest('.n'); if (n && n.dataset.n !== (NET && NET.nick)) { input.value = `/w ${n.dataset.n} `; input.focus(); } });
  $('chatClose').addEventListener('click', () => setOpen(false));
  $('chatForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim(); if (!text || !ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify({ t: 'chat', ch: chan.value, text: text.slice(0, 200) }));
    const wm = /^\/w\s+(\S+)\s/.exec(text);
    input.value = wm ? `/w ${wm[1]} ` : '';
  });
  input.addEventListener('focus', () => { if (NET && NET.api) NET.api.clearKeys(); });
  input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') setOpen(false); });
  input.addEventListener('keyup', (e) => e.stopPropagation());
  // engine listens on window: keep typing out of the game
  ['keydown', 'keyup'].forEach((t) => chat.addEventListener(t, (e) => e.stopPropagation()));

  // ---------- network ----------
  function connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws?postac=${charId}`);
    let opened = false;
    ws.onopen = () => { opened = true; };
    ws.onmessage = (ev) => {
      let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg.t === 'init') return start(msg);
      if (msg.t === 'chat') return addChat(msg);
      if (msg.t === 'party') { DBG.party = msg; return party(msg); }
      if (msg.t === 'kick') { kicked = true; overlay('Rozłączono', msg.reason || 'Połączenie zostało zakończone.', '<a href="/postacie">Moje postacie</a>'); return; }
      if (msg.t === 'pong') { $('ping').textContent = `ping ${Date.now() - msg.ts} ms · online ${msg.online}`; return; }
      if (window.ARDAN_UI && started && ARDAN_UI.onMsg(msg)) return;
      if (msg.t === 's') DBG.last = msg; else if (msg.t === 'me') DBG.me = msg.me; else if (msg.t === 'dlg') DBG.dlg = msg.d;
      if (NET && NET.api) NET.api.recv(msg);
    };
    ws.onclose = async (ev) => {
      if (NET && NET.api) NET.api.clearKeys();
      if (kicked) return;
      if (ev.code === 4004) { overlay('Nie znaleziono postaci', 'Ta postać nie istnieje lub należy do innego konta.', '<a href="/postacie">Moje postacie</a>'); return; }
      if (ev.code === 4008) { overlay('Rozłączono', 'Zbyt wiele żądań z tej karty.', '<button type="button" data-reload>Połącz ponownie</button>'); return; }
      if (!opened) {
        const me = await fetch('/api/me', { credentials: 'same-origin' }).catch(() => null);
        const md = me && me.ok ? await me.json().catch(() => ({})) : {};
        if (me && me.ok && !md.user) { location.replace('/logowanie?next=' + encodeURIComponent('/graj?postac=' + charId)); return; }
      }
      overlay('Utracono połączenie', 'Próbuję połączyć ponownie…', '', true);
      const retry = async () => { const r = await fetch('/healthz', { cache: 'no-store' }).catch(() => null); if (r && r.ok) location.reload(); else setTimeout(retry, 3000); };
      setTimeout(retry, 1500);
    };
  }
  document.addEventListener('click', (e) => { if (e.target.matches('[data-reload]')) location.reload(); });
  // the game page must stay put on phones: no pinch/double-tap zoom, no rubber-band scrolling
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((t) => document.addEventListener(t, (e) => e.preventDefault(), { passive: false }));
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) { e.preventDefault(); return; }
    const sc = e.target.closest && e.target.closest('.scroll, .msgs, .bt-log');
    if (!sc || sc.scrollHeight <= sc.clientHeight) e.preventDefault();
  }, { passive: false });
  window.addEventListener('scroll', () => { if (window.scrollX || window.scrollY) window.scrollTo(0, 0); });

  // ---------- party (drużyna) ----------
  const partyEl = $('party');
  const AREA = { village: 'Osada', forest: 'Bór', cave: 'Jaskinia', swamp: 'Bagna', town: 'Srebrnogród', mount: 'Szczyty', desert: 'Ruiny', port: 'Przystań', coast: 'Wybrzeże', fort: 'Żarogród', volcano: 'Wulkan', citadel: 'Cytadela', abyss: 'Otchłań', wolfhills: 'Wzgórza', mine: 'Kopalnia', glacier: 'Lodowiec', steppe: 'Stepy', elfwood: 'Puszcza', sunken: 'Zatopione', star: 'Strażnica', crystal: 'Pustkowia', necro: 'Nekropolia', dragon: 'Gniazdo' };
  const command = (text) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'chat', ch: 'g', text })); };
  function party(msg) {
    const map = {}; for (const m of msg.m) map[m.i] = 1; if (NET) NET.party = map;
    let h = '';
    if (msg.m.length) {
      h += `<h4>Drużyna ${msg.m.length}/5 <button type="button" data-pcmd="/opusc">Opuść</button></h4>`;
      h += msg.m.map((m) => `<div class="pm"><b>${escN(m.n)}</b>${m.n === msg.lead ? ' ★' : ''} <small>poz. ${m.l | 0} · ${AREA[m.a] || ''}</small><div class="bar"><i style="width:${Math.round(100 * Math.max(0, Math.min(1, m.hp / (m.mh || 1))))}%"></i></div></div>`).join('');
    }
    if (msg.inv) h += `<div class="inv"><b>${escN(msg.inv)}</b> zaprasza cię do drużyny.<div><button type="button" data-pcmd="/akceptuj">Dołącz</button><button type="button" class="no" data-pcmd="/odrzuc">Odrzuć</button></div></div>`;
    partyEl.innerHTML = h; partyEl.classList.toggle('show', !!h);
  }
  partyEl.addEventListener('click', (e) => { const b = e.target.closest('[data-pcmd]'); if (b) { command(b.dataset.pcmd); canvas.focus({ preventScroll: true }); } });

  function start(msg) {
    if (started) return; started = true;
    NET = {
      state: msg.me, id: msg.id, nick: msg.nick, unread: 0,
      send: (m) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); },
      onChat: () => setOpen(!chat.classList.contains('open')),
    };
    if (window.ARDAN_UI) {
      NET.onPanel = (k) => ARDAN_UI.panel(k);
      NET.onKey = (k) => ARDAN_UI.key(k);
      NET.onPlayerTap = (o) => ARDAN_UI.playerTap(o);
    }
    createArdan(canvas, { net: NET, font: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" });
    if (window.ARDAN_UI) {
      ARDAN_UI.init({ NET, send: NET.send, cmd: command, openChat: (pre, ch) => { setOpen(true); if (ch) chan.value = ch; if (pre !== undefined) input.value = pre; setTimeout(() => input.focus(), 0); } });
      DBG.ui = ARDAN_UI.state;
    }
    hideOverlay();
    canvas.focus({ preventScroll: true });
    setInterval(() => { if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'ping', ts: Date.now() })); }, 5000);
  }
  connect();
})();
