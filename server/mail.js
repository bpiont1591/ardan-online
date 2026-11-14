'use strict';
const nodemailer = require('nodemailer');
const cfg = require('./config');

let transport = null;
if (cfg.smtp.host) {
  transport = nodemailer.createTransport({
    host: cfg.smtp.host, port: cfg.smtp.port, secure: cfg.smtp.secure,
    auth: cfg.smtp.user ? { user: cfg.smtp.user, pass: cfg.smtp.pass } : undefined,
  });
}
const configured = () => !!transport;

async function sendResetMail(to, login, link) {
  const text = `Cześć ${login}!\n\nOtrzymaliśmy prośbę o zresetowanie hasła do Twojego konta w grze ARDAN.\n` +
    `Aby ustawić nowe hasło, otwórz link (ważny ${cfg.resetMinutes} minut, jednorazowy):\n\n${link}\n\n` +
    `Jeśli to nie Ty – zignoruj tę wiadomość, Twoje hasło pozostanie bez zmian.\n\n— Kronikarze ARDANU`;
  if (!transport) {
    if (!cfg.isProd) {
      console.log('\n[ARDAN] SMTP nie jest skonfigurowane – link resetu hasła (tryb deweloperski):');
      console.log(`[ARDAN] dla ${login} <${to}>: ${link}\n`);
    } else {
      console.error('[ARDAN] SMTP nie jest skonfigurowane – nie można wysłać e-maila z resetem hasła.');
    }
    return false;
  }
  await transport.sendMail({ from: cfg.smtp.from, to, subject: 'ARDAN – reset hasła', text });
  return true;
}
module.exports = { sendResetMail, configured };
