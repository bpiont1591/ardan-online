'use strict';
// Stress: each class wears a full legendary kit (every legendary-only passive) and auto-fights many battles.
// Fails on any server error or a battle that never ends.
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const PORT = 3102, BASE = `http://localhost:${PORT}`;
const W = (ms) => new Promise((r) => setTimeout(r, ms));
const KITS = { war: ['switu', 'egida', 'feniksz', 'tytan', 'kastety', 'wampir', 'sygnet', 'serceo'], arc: ['lewiat', 'nieskon', 'cien', 'lowca', 'wiatr', 'midas', 'wampir', 'okolew'], mag: ['berlo', 'ksiega', 'arcym', 'diadem', 'mitenki', 'wampir', 'sygnet', 'serceo'] };
const MOBS = [['abyss', 'dknight'], ['abyss', 'voidb'], ['abyss', 'morgath'], ['volcano', 'imp']];
async function main() {
  let log = '';
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], { env: { ...process.env, PORT: String(PORT), DATABASE_PATH: `/tmp/ardan-px-${Date.now()}.db`, BASE_URL: BASE, NODE_ENV: 'development', ARDAN_TEST_HOOKS: '1' } });
  srv.stdout.on('data', (d) => { log += d; }); srv.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < 50 && !log.includes('Serwer działa'); i++) await W(100);
  const cj = {}; const hdr = () => Object.entries(cj).map(([k, v]) => `${k}=${v}`).join('; ');
  const call = async (m, p, b) => { const r = await fetch(BASE + p, { method: m, headers: { cookie: hdr(), 'content-type': 'application/json', 'x-csrf-token': decodeURIComponent(cj.ardan_csrf || '') }, body: b ? JSON.stringify(b) : undefined }); for (const s of r.headers.getSetCookie()) { const kv = s.split(';')[0]; cj[kv.split('=')[0]] = kv.slice(kv.indexOf('=') + 1); } return r.json(); };
  await call('GET', '/api/me');
  const s = String(Date.now()).slice(-6);
  await call('POST', '/api/register', { login: 'px' + s, email: `px${s}@example.com`, password: 'Stres-Test-77', password2: 'Stres-Test-77', terms: true });
  let wins = 0, fights = 0, pxLines = {}, bad = 0;
  for (const cls of (process.env.PX_CLS || 'war,arc,mag').split(',')) {
    const c = await call('POST', '/api/characters', { nick: 'Px' + cls + s.slice(-3), cls });
    const ws = new WebSocket(`ws://localhost:${PORT}/ws?postac=${c.id}`, { headers: { cookie: hdr(), origin: BASE } });
    const msgs = []; ws.on('message', (d) => msgs.push(JSON.parse(d.toString())));
    await new Promise((r) => ws.on('open', r)); await W(500);
    const send = (o) => ws.send(JSON.stringify(o));
    send({ t: '__test', lvl: Number(process.env.PX_LVL) || 52, gold: 1000 }); await W(200);
    for (const id of KITS[cls]) { send({ t: '__test', leg: id }); await W(120); }
    await W(500);
    const g = msgs.filter((m) => m.t === 'gear').pop();
    for (const it of g.bag.filter((x) => x.lg)) { send({ t: 'gear', a: 'equip', u: it.u }); await W(150); }
    await W(400); const g2 = msgs.filter((m) => m.t === 'gear').pop(); console.log(cls, 'worn:', Object.values(g2.gear).filter((x) => x && x.lg).map((x) => x.lg).join(','));
    for (let k = 0; k < (Number(process.env.PX_N) || 8); k++) {
      const [area, mob] = MOBS[k % MOBS.length];
      send({ t: '__test', heal: true, near: { area, mob } }); await W(1500);
      send({ t: 'bt', a: 'auto', on: true }); send({ t: 'bt', a: 'speed', v: 3 });
      msgs.length = 0;
      send({ t: 'in', mx: 0, my: 0, acts: [{ a: 'atk' }] });
      const t0 = Date.now(); let end = null;
      while (Date.now() - t0 < 60000) { await W(300); end = msgs.find((m) => m.t === 'bt' && (m.end || m.phase === 'end')); if (end) break; }
      const started = msgs.some((m) => m.t === 'bt' && m.id);
      if (!started) continue;
      fights++; if (!end) bad++; else if (/"win":true/.test(JSON.stringify(end.end || {}))) wins++;
      for (const m of msgs) if (m.t === 'bt' && m.ev) for (const e of m.ev) if (e.k === 'px') { const n = e.txt.slice(2).split(':')[0]; pxLines[n] = (pxLines[n] || 0) + 1; }
      send({ t: 'bt', a: 'close' }); await W(400);
    }
    ws.close();
  }
  srv.kill();
  const errs = (log.match(/error|TypeError|ReferenceError/gi) || []).length;
  console.log(`fights ${fights}, unfinished ${bad}, server errors ${errs}`);
  console.log('passive triggers:', JSON.stringify(pxLines));
  if (errs) console.log(log.split('\n').filter((l) => /rror/.test(l)).slice(0, 10).join('\n'));
  process.exit(errs || bad || !fights ? 1 : 0);
}
main();
