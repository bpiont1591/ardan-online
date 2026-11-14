'use strict';
// Postgres snapshot persistence test (needs a Postgres URL in PG_TEST_URL; skipped otherwise).
// Simulates Render free: register -> shutdown (final snapshot) -> local disk wiped -> restart restores everything.
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const URL_ = process.env.PG_TEST_URL;
if (!URL_) { console.log('PG_TEST_URL not set – Postgres snapshot test skipped.'); process.exit(0); }
const PORT = 3105, BASE = `http://localhost:${PORT}`;
const W = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? '  PASS ' : '  FAIL ') + m); };
const dir = `/tmp/ardan-pgs-${Date.now()}`;
function boot() {
  let log = '';
  const env = { ...process.env, PORT: String(PORT), DATA_DIR: dir, BASE_URL: BASE, NODE_ENV: 'development', DATABASE_URL: URL_, SNAPSHOT_MINUTES: '1', ADMIN_LOGIN: 'wladca', ADMIN_EMAIL: 'wladca@example.com', ADMIN_PASSWORD: 'Korona-Ardanu-77' };
  delete env.DATABASE_PATH;
  const p = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'start.js')], { env });
  p.stdout.on('data', (d) => { log += d; }); p.stderr.on('data', (d) => { log += d; });
  return { p, log: () => log, ready: async () => { for (let i = 0; i < 100 && !log.includes('Serwer działa'); i++) await W(100); } };
}
async function main() {
  const { Pool } = require('pg'); const pool = new Pool({ connectionString: URL_ });
  await pool.query('DROP TABLE IF EXISTS ardan_snapshots');
  let s = boot(); await s.ready();
  ok(/brak kopii/.test(s.log()), 'first start: no snapshot yet, empty database');
  const c = {}; const call = async (m, p, b) => { const r = await fetch(BASE + p, { method: m, headers: { cookie: Object.entries(c).map(([k, v]) => `${k}=${v}`).join('; '), 'content-type': 'application/json', 'x-csrf-token': decodeURIComponent(c.ardan_csrf || '') }, body: b ? JSON.stringify(b) : undefined }); for (const x of r.headers.getSetCookie()) { const kv = x.split(';')[0]; c[kv.split('=')[0]] = kv.slice(kv.indexOf('=') + 1); } return { status: r.status, data: await r.json().catch(() => ({})) }; };
  await call('GET', '/api/me');
  let r = await call('POST', '/api/register', { login: 'trwaly', email: 'trwaly@example.com', password: 'Trwale-Dane-55', password2: 'Trwale-Dane-55', terms: true });
  ok(r.status === 200, 'register account');
  r = await call('POST', '/api/characters', { nick: 'Trwalek', cls: 'war' }); ok(r.status === 200, 'create character');
  s.p.kill('SIGTERM'); await W(2500);
  const n = (await pool.query('SELECT count(*)::int n FROM ardan_snapshots')).rows[0].n;
  ok(n >= 1, `snapshot written to Postgres on shutdown (${n})`);
  fs.rmSync(dir, { recursive: true, force: true }); // "redeploy": local disk is gone
  s = boot(); await s.ready();
  ok(/Przywrócono bazę z Postgresa/.test(s.log()), 'restart restores the database from Postgres');
  for (const k of Object.keys(c)) delete c[k];
  await call('GET', '/api/me');
  r = await call('POST', '/api/login', { login: 'trwaly', password: 'Trwale-Dane-55' }); ok(r.status === 200, 'account survived the wipe');
  r = await call('GET', '/api/characters'); ok(r.data.characters && r.data.characters.some((x) => x.nick === 'Trwalek'), 'character survived the wipe');
  r = await call('POST', '/api/login', { login: 'wladca', password: 'Korona-Ardanu-77' }); ok(r.status === 200, 'admin account intact');
  s.p.kill('SIGTERM'); await W(1500); await pool.end();
  console.log(`\nPostgres snapshots: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
