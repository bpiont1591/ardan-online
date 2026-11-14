# ARDAN – bezpieczeństwo / Security

Short overview of the protections in the ARDAN server. Regression tests: `npm run test:security` (`test/security.js`, 38 checks), also run first by `npm test`.

## HTTP
- **Headers (helmet):** strict CSP (`default-src 'self'`, `script-src 'self'` – no inline scripts or eval, `script-src-attr 'none'`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, `form-action 'self'`; in production `connect-src` is only the site's own origin plus its wss://). Also nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy, HSTS in production, and no `X-Powered-By`.
- **Cookies:** the session cookie is a random 256-bit token. Only its SHA-256 is stored. The cookie is `HttpOnly; SameSite=Lax; Path=/`, plus `Secure` in production (`COOKIE_SECURE`). Every login rotates the session id, which prevents session fixation. Logout deletes the session, and a password reset logs the account out everywhere.
- **CSRF:** every state-changing `/api` route uses a double-submit token (header `X-CSRF-Token` = cookie, constant-time compare). It also needs a same-origin `Origin` check and accepts only JSON bodies (415 otherwise).
- **Passwords:** bcrypt with cost 12 by default (`BCRYPT_COST`, clamped to 10–15). Passwords must be 8–128 characters with 3 character classes and must not contain the login or the e-mail name. Logins use a dummy hash for unknown accounts, so timing doesn't reveal which accounts exist.
- **Rate limits / lockout:**
  - Per IP: login 10/15 min, register 8/h, forgot 5/h, reset 10/15 min, every API route 240/min (`API_PER_MIN`).
  - Per account: lockout after 8 failed logins for 15 minutes. The lockout map is bounded so it can't be used to exhaust memory.
- **Validation:** strict regexes for login, e-mail and nick (a reserved-nick list is included), type checks (objects/arrays are rejected) and length limits. JSON bodies are capped at 16 kB (413).
- **Errors:** one central error handler returns generic Polish messages. Stack traces are only logged on the server and never sent to the client. Unknown routes return 404 JSON or the 404 page.
- **SQL:** all queries are `better-sqlite3` prepared statements with bound parameters. No SQL is built from strings with user input.

## WebSocket
- **Connecting:** each connection is authenticated with the session cookie and a same-origin `Origin`. The character must belong to the logged-in user.
- **Session checks:** sessions are checked again every 30 s, so logout or a password reset closes live sockets (code 4001).
- **Per-IP caps:** 8 concurrent sockets (`WS_PER_IP`) and 30 connection attempts per minute (`WS_PER_MIN`).
- **Message size and rate:** messages over 8 kB are dropped at the protocol level (`maxPayload`) and messages over 4 kB are ignored. Above 80 messages/s the extra messages are ignored; above 300/s the socket is closed (4008). In-game actions have a budget of 20/s.
- **Message checks:** every handler checks types, ranges, ids (regex) and lengths. Binary frames are ignored.

## Anti-cheat (server-authoritative)
- **Movement:** the client only sends a direction (each axis clamped to −1/0/1). Position, speed and collisions are simulated on the server. A client can't send coordinates, so speed hacks and teleports are impossible by design.
- **Combat:** combat, loot, XP, gold and item passives are calculated on the server. The client only picks an action, which is validated: skill index, level, cooldown and mana.
- **Economy:**
  - Market listing, buying, cancelling, offline seller payouts and player trades run in **one SQLite transaction** together with the save of every character involved. A crash can't duplicate or lose items or gold.
  - Trades check again, right before swapping, that both sides still own every item and the gold.
  - Item ids must be owned, and an item can't be in two places at once (it is removed from the bag when listed).
- **Value sanity:** every tick, gold is clamped to an integer in `[0, 2 000 000 000]` (no overflow or negative gold). Prices are 1–10 000 000. Trade gold must be a safe integer between 0 and the gold the player has. Craft quantities are 1–10.

## XSS
- Chat text is stripped of control/bidi characters, filtered and HTML-escaped on the server. Nicks, logins and guild names/tags are restricted by regex. Everything else from players (guild message of the day, item names) is escaped with `esc()` before rendering. The CSP blocks inline scripts anyway.

## Dependencies
- `npm audit`: 0 known vulnerabilities (2026-11-14).

## Reporting
Please report vulnerabilities privately to the server administrator rather than in the in-game chat.
