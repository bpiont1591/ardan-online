# ARDAN Online

Przeglądarkowa gra MMORPG z trybem wieloosobowym: strona główna, konta graczy, postacie zapisywane na serwerze, autorytatywny serwer gry, czat i drużyny.

**Stos technologiczny:** Node.js 20+, Express 5, WebSocket (`ws`), SQLite (`better-sqlite3`), bcrypt (`bcryptjs`), nodemailer, helmet, express-rate-limit.

## Uruchomienie lokalne

```bash
npm install
npm start                 # http://localhost:3000
```

Baza danych tworzy się sama w pliku `data/ardan.db`.

Jeśli SMTP nie jest skonfigurowane, a serwer działa w trybie deweloperskim (`NODE_ENV` ≠ `production`), **link do resetu hasła jest wypisywany w konsoli serwera**, np.:

```
[ARDAN] SMTP nie jest skonfigurowane – link resetu hasła (tryb deweloperski):
[ARDAN] dla gracz1 <gracz1@example.com>: http://localhost:3000/nowe-haslo?token=...
```

W trybie produkcyjnym bez SMTP link nie jest nigdzie wypisywany, a w logu pojawia się błąd. Dlatego na produkcji SMTP jest wymagane.

### Testy end-to-end

```bash
npm test
```

Test uruchamia własny serwer na porcie 3100 z tymczasową bazą w `/tmp`. Potrzebuje Google Chrome w `/usr/bin/google-chrome` (inną ścieżkę można podać w `CHROME_PATH`).

Co sprawdza:
- rejestrację dwóch kont i tworzenie postaci;
- grę dwoma przeglądarkami: komputer z WASD i telefon ze strzałkami dotykowymi;
- czy gracze widzą się nawzajem;
- czat globalny, regionalny i prywatny, a także limity czatu;
- synchronizację potworów (HP, śmierć, PD);
- drużynę;
- zapis postaci;
- CSRF, rate-limit i hashowanie haseł;
- reset hasła przez link z konsoli.

Zrzuty ekranu trafiają do `shots/`.

### Przebudowa silnika gry (opcjonalnie)

Gotowy silnik jest już w `public/js/engine.js` (klient) i `server/engine.js` (serwer). Przebudowa jest potrzebna tylko po zmianach w `engine-src/`:

```bash
npm run build:engine      # wymaga python3 i TypeScript (tsc)
```

## Zmienne środowiskowe

| Zmienna | Domyślnie | Opis |
|---|---|---|
| `NODE_ENV` | – | `production` na serwerze. Włącza bezpieczne ciasteczka, `trust proxy` i wyłącza wypisywanie linków resetu. |
| `PORT` | `3000` | Port HTTP. |
| `HOST` | `0.0.0.0` | Adres nasłuchu. |
| `BASE_URL` | `http://localhost:PORT` | Publiczny adres strony (np. `https://ardan.pl`), używany w linkach resetu hasła. |
| `DATABASE_PATH` | `./data/ardan.db` | Plik SQLite. **Na hostingu musi leżeć na trwałym dysku lub wolumenie.** |
| `COOKIE_SECURE` | `true` w produkcji | Ciasteczka tylko przez HTTPS. |
| `TRUST_PROXY` | `1` w produkcji | Liczba proxy przed aplikacją (Render/Fly = 1). Potrzebne do poprawnego IP w rate-limitach. |
| `SESSION_DAYS` | `30` | Ważność sesji. |
| `RESET_TOKEN_MINUTES` | `30` | Ważność linku resetu hasła (link jest jednorazowy). |
| `BCRYPT_COST` | `12` | Koszt hashowania haseł. |
| `MAX_CHARACTERS` | `3` | Limit postaci na konto. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | – | Serwer poczty do e-maili z resetem hasła. |
| `MAIL_FROM` | `ARDAN <no-reply@localhost>` | Nadawca e-maili. |

Przykład: `.env.example`. Aplikacja nie wczytuje pliku `.env` sama, więc zmienne ustaw w panelu hostingu albo w powłoce.

## Wdrożenie

Gra trzyma stan w pamięci procesu (świat, potwory, gracze online), a dane w SQLite. Dlatego uruchamiaj **jedną instancję** z **trwałym dyskiem**. Nie skaluj poziomo bez przeniesienia stanu do wspólnej bazy.

### Fly.io (polecane – region Warszawa)

1. Zainstaluj `flyctl` i zaloguj się: `fly auth login`.
2. W `fly.toml` zmień `app` na własną, unikalną nazwę.
3. Utwórz aplikację i wolumen:
   ```bash
   fly launch --no-deploy --copy-config
   fly volumes create ardan_data --size 1 --region waw
   ```
4. Ustaw sekrety:
   ```bash
   fly secrets set BASE_URL=https://TWOJA-APKA.fly.dev SMTP_HOST=... SMTP_PORT=587 SMTP_USER=... SMTP_PASS=... MAIL_FROM="ARDAN <no-reply@twojadomena.pl>"
   ```
5. Wdróż: `fly deploy`. Do budowy służy `Dockerfile`, a SQLite trafia do `/data/ardan.db` na wolumenie.
6. Własna domena:
   1. `fly certs add ardan.pl`
   2. Ustaw rekordy DNS według instrukcji z poprzedniego kroku.
   3. Zmień `BASE_URL`.

### Render

1. Wypchnij repozytorium na GitHub/GitLab.
2. W Render: **New → Blueprint**, wskaż repozytorium. Plik `render.yaml` utworzy usługę web z dyskiem `/var/data`. Dysk wymaga płatnego planu – darmowy plan kasuje dane przy restarcie.
3. Uzupełnij zmienne `BASE_URL` i `SMTP_*` w panelu.
4. Własna domena: **Settings → Custom Domains**, potem zmień `BASE_URL`.

WebSockety działają na obu platformach bez dodatkowej konfiguracji. Health check: `GET /healthz`.

### Kopie zapasowe

Rób regularną kopię pliku bazy, np. `sqlite3 /data/ardan.db ".backup /data/backup.db"` uruchamiane z crona albo ręcznie przez `fly ssh console`.

## Architektura

```
server/
  index.js        Express, helmet (CSP), API, pliki statyczne, upgrade WebSocket (/ws?postac=ID)
  config.js       konfiguracja ze zmiennych środowiskowych
  db.js           SQLite: users, sessions, resets, characters
  auth.js         rejestracja, logowanie, wylogowanie, reset hasła, sesje, CSRF, rate-limit
  characters.js   lista i tworzenie postaci, zapis/odczyt stanu
  game.js         świat gry (tick 20 Hz), własność potworów, snapshoty, system "features"
  chat.js         czat: globalny, kraina, /w, moderacja
  party.js        drużyny (feature): zaproszenia, czat drużyny, wspólne PD i zadania
  engine.js       silnik gry (ten sam co w kliencie) uruchamiany bez grafiki
  mail.js, news.js
public/           strona (HTML/CSS/JS), gra (graj.html + js/game-client.js + js/engine.js)
engine-src/       źródła silnika (TypeScript) i skrypty budujące
test/e2e.js       test end-to-end (puppeteer-core)
```

**Serwer autorytatywny:**
- Klient wysyła tylko intencje: kierunek ruchu `{mx,my}` i akcje (atak, umiejętność, rozmowa, zakup itd.).
- Serwer uruchamia dla każdej postaci bezgrafczną kopię silnika z tymi samymi regułami gry, ze wspólnym zestawem potworów na krainę.
- Prędkość ruchu, zasięg ataków i czary, czasy odnowienia, odległość od sklepu/NPC oraz łupy liczy serwer.
- Klient tylko rysuje stan otrzymany 20 razy na sekundę.

**Rozszerzalność:**
- `World.use(feature)` przyjmuje moduły z hookami `onJoin`, `onLeave`, `onTick` oraz komendami czatu. Tak zbudowane są czat i drużyny.
- W ten sam sposób można dodać handel, aukcje, gildie czy PvP:
  1. nowy plik w `server/`;
  2. `world.use(...)`;
  3. komunikaty WS z polem `t`.

**Bezpieczeństwo:**
- hasła: bcrypt (koszt 12), zasady siły hasła sprawdzane po stronie serwera;
- sesje: losowy token w ciasteczku `HttpOnly; SameSite=Lax` (`Secure` w produkcji), a w bazie tylko jego skrót SHA-256;
- CSRF: double-submit cookie + nagłówek `X-CSRF-Token`, kontrola `Origin`, tylko JSON;
- reset hasła: losowy, jednorazowy token ważny 30 min, w bazie tylko skrót; po zmianie hasła wylogowanie ze wszystkich urządzeń; odpowiedź nie zdradza, czy e-mail istnieje;
- limity: logowanie (10 prób / 15 min / IP i 8 nieudanych / konto), rejestracja, reset, wiadomości WS, czat (4 / 6 s, wyciszenie 60 s, długość 200 znaków, escapowanie HTML, filtr wulgaryzmów);
- nagłówki: helmet z restrykcyjnym CSP (bez skryptów inline).

## Licencje zasobów

Czcionki Cinzel i Inter są hostowane lokalnie w `public/fonts/` (licencja SIL Open Font License 1.1). Grafika gry jest rysowana proceduralnie przez silnik.
