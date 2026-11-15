'use strict';
// E-mail (password reset). Transports, picked automatically from the environment (or forced with MAIL_TRANSPORT):
//   1. resend – HTTPS API (RESEND_API_KEY)          – works everywhere, also on Render free (port 443)
//   2. brevo  – HTTPS API (BREVO_API_KEY)           – works everywhere, also on Render free (port 443)
//   3. smtp   – SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS (nodemailer)
//      Render free web services block outbound ports 25, 465 and 587 – use port 2525 (Brevo: smtp-relay.brevo.com:2525)
//      or one of the HTTPS APIs above.
// MAIL_FROM sets the sender ("ARDAN <no-reply@your-domain>"); the address must be verified at the provider.
const nodemailer = require('nodemailer');
const cfg = require('./config');

const API = {
  resend: 'https://api.resend.com/emails',
  brevo: 'https://api.brevo.com/v3/smtp/email',
};
const TIMEOUT = 15000;

// "ARDAN <no-reply@x.pl>" -> { name: 'ARDAN', email: 'no-reply@x.pl' }
function parseFrom(from) {
  const m = /^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/.exec(String(from || ''));
  if (m) return { name: (m[1] || '').trim() || undefined, email: m[2].trim() };
  return { email: String(from || '').trim() };
}

function pickTransport(env) {
  const forced = String(env.MAIL_TRANSPORT || '').toLowerCase().trim();
  const has = { resend: !!env.RESEND_API_KEY, brevo: !!env.BREVO_API_KEY, smtp: !!env.SMTP_HOST };
  if (forced && forced !== 'auto') return has[forced] ? forced : null;
  if (has.resend) return 'resend';
  if (has.brevo) return 'brevo';
  if (has.smtp) return 'smtp';
  return null;
}

// createMailer({ env, fetch, nodemailer }) – injectable for tests
function createMailer(opts) {
  const o = opts || {};
  const env = o.env || process.env;
  const fetchFn = o.fetch || (typeof fetch === 'function' ? fetch : null);
  const nm = o.nodemailer || nodemailer;
  const kind = pickTransport(env);
  const from = env.MAIL_FROM || 'ARDAN <no-reply@localhost>';
  let smtp = null;
  if (kind === 'smtp') {
    const port = Number(env.SMTP_PORT) || 587;
    smtp = nm.createTransport({
      host: env.SMTP_HOST, port,
      secure: env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : port === 465, // 465 = implicit TLS, 587/2525 = STARTTLS
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS || '' } : undefined,
      connectionTimeout: TIMEOUT, greetingTimeout: TIMEOUT, socketTimeout: TIMEOUT,
    });
  }
  async function api(url, headers, body) {
    if (!fetchFn) throw new Error('fetch niedostępny (wymagany Node 18+)');
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const t = ctl ? setTimeout(() => ctl.abort(), TIMEOUT) : null;
    try {
      const r = await fetchFn(url, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' }, headers), body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined });
      if (!r.ok) { let msg = ''; try { msg = await r.text(); } catch (e) { /* ignore */ } throw new Error(`${kind} API HTTP ${r.status}: ${String(msg).slice(0, 200)}`); }
      return true;
    } finally { if (t) clearTimeout(t); }
  }
  async function send(m) {
    if (kind === 'resend') return api(API.resend, { Authorization: `Bearer ${env.RESEND_API_KEY}` }, { from, to: [m.to], subject: m.subject, text: m.text, html: m.html });
    if (kind === 'brevo') { const f = parseFrom(from); return api(API.brevo, { 'api-key': env.BREVO_API_KEY }, { sender: { name: f.name || 'ARDAN', email: f.email }, to: [{ email: m.to }], subject: m.subject, textContent: m.text, htmlContent: m.html }); }
    if (kind === 'smtp') { await smtp.sendMail({ from, to: m.to, subject: m.subject, text: m.text, html: m.html }); return true; }
    return false;
  }
  return { kind, from, send, configured: () => !!kind };
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let mailer = createMailer();
const configured = () => mailer.configured();
const transportName = () => mailer.kind;

async function sendResetMail(to, login, link) {
  const text = `Cześć ${login}!\n\nOtrzymaliśmy prośbę o zresetowanie hasła do Twojego konta w grze ARDAN.\n` +
    `Aby ustawić nowe hasło, otwórz link (ważny ${cfg.resetMinutes} minut, jednorazowy):\n\n${link}\n\n` +
    `Jeśli to nie Ty – zignoruj tę wiadomość, Twoje hasło pozostanie bez zmian.\n\n— Kronikarze ARDANU`;
  const html = `<p>Cześć <b>${esc(login)}</b>!</p><p>Otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta w grze ARDAN.</p>` +
    `<p>Aby ustawić nowe hasło, kliknij link (ważny ${cfg.resetMinutes} minut, jednorazowy):</p><p><a href="${esc(link)}">${esc(link)}</a></p>` +
    `<p>Jeśli to nie Ty – zignoruj tę wiadomość, Twoje hasło pozostanie bez zmian.</p><p>— Kronikarze ARDANU</p>`;
  if (!mailer.configured()) {
    if (!cfg.isProd) {
      console.log('\n[ARDAN] Poczta nie jest skonfigurowana – link resetu hasła (tryb deweloperski):');
      console.log(`[ARDAN] dla ${login} <${to}>: ${link}\n`);
    } else {
      console.error('[ARDAN] Poczta nie jest skonfigurowana (RESEND_API_KEY / BREVO_API_KEY / SMTP_HOST) – nie można wysłać e-maila z resetem hasła.');
    }
    return false;
  }
  await mailer.send({ to, subject: 'ARDAN – reset hasła', text, html });
  return true;
}
module.exports = { sendResetMail, configured, transportName, createMailer, pickTransport, parseFrom, _setMailer: (m) => { mailer = m; } };
