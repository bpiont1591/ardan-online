# ARDAN Online

Przeglądarkowa gra MMORPG z trybem wieloosobowym: strona główna, konta graczy, postacie zapisywane na serwerze, autorytatywny serwer gry, czat i drużyny.

**Stos technologiczny:** Node.js 20+, Express 5, WebSocket (`ws`), SQLite (`better-sqlite3`), bcrypt (`bcryptjs`), nodemailer, helmet, express-rate-limit.

## Uruchomienie lokalne

```bash
npm install
npm start                 # http://localhost:3000
```

Baza danych tworzy się sama w pliku `data/ardan.db`.

Jeśli poczta nie jest skonfigurowana, a serwer działa w trybie deweloperskim (`NODE_ENV` ≠ `production`), **link do resetu hasła jest wypisywany w konsoli serwera**, np.:

```
[ARDAN] Poczta nie jest skonfigurowana – link resetu hasła (tryb deweloperski):
[ARDAN] dla gracz1 <gracz1@example.com>: http://localhost:3000/nowe-haslo?token=...
```

W trybie produkcyjnym bez poczty link nie jest nigdzie wypisywany, a w logu pojawia się błąd. Dlatego na produkcji poczta jest wymagana.

**Poczta na darmowym Renderze:** Render (plan Free) blokuje wychodzące porty SMTP 25, 465 i 587. Najprościej użyć API HTTPS: ustaw `BREVO_API_KEY` (Brevo → SMTP & API → API Keys) **albo** `RESEND_API_KEY` oraz `MAIL_FROM` z adresem zweryfikowanym u dostawcy. Alternatywnie SMTP Brevo na porcie 2525: `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=2525`, `SMTP_USER` (login SMTP z panelu Brevo), `SMTP_PASS` (klucz SMTP). Wybór transportu jest automatyczny (Resend API → Brevo API → SMTP) lub wymuszony przez `MAIL_TRANSPORT`.

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
| `NODE_ENV` | – | `production` na serwerze. Włącza bezpieczne ciasteczka, HSTS i `trust proxy`, a wyłącza haki testowe i wypisywanie linków resetu. |
| `PORT` / `HOST` | `3000` / `0.0.0.0` | Port i adres nasłuchu. |
| `BASE_URL` | `RENDER_EXTERNAL_URL` lub `http://localhost:PORT` | Publiczny adres strony, używany w linkach resetu i w CSP. Na Renderze ustawia się sam. |
| `DATA_DIR` | `./data` | Folder z bazą `ardan.db` i kopiami `backups/`. **Na hostingu z dyskiem wskaż trwały wolumen** (np. `/var/data`, `/data`). |
| `DATABASE_PATH` | `DATA_DIR/ardan.db` | Pełna ścieżka pliku SQLite (nadpisuje `DATA_DIR`). |
| `DATABASE_URL` | – | Opcjonalny Postgres (np. Neon) jako trwały zapis kopii bazy dla hostingu **bez dysku**. Szczegóły niżej. |
| `SNAPSHOT_MINUTES` | `10` | Co ile minut wysyłać kopię do Postgresa (tylko jeśli coś się zmieniło). Kopia idzie też zawsze przy zamknięciu. |
| `BACKUP_HOURS` / `BACKUP_KEEP` | `24` / `7` | Rotowane kopie pliku bazy w `DATA_DIR/backups` (i liczba kopii w Postgresie). |
| `ADMIN_LOGIN`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | – | Pierwszy administrator, tworzony przy starcie, jeśli nie istnieje. Istniejące konto dostaje rolę admin, a hasło nie jest zmieniane. |
| `SESSION_SECRET` | – | Klucz HMAC do identyfikatorów sesji w bazie (zalecany). |
| `COOKIE_SECURE` | `true` w produkcji | Ciasteczka tylko przez HTTPS. |
| `TRUST_PROXY` | `1` w produkcji | Liczba proxy przed aplikacją (Render/Fly = 1). |
| `SESSION_DAYS` / `RESET_TOKEN_MINUTES` | `30` / `30` | Ważność sesji i jednorazowego linku resetu. |
| `BCRYPT_COST` | `12` (zakres 10–15) | Koszt hashowania haseł. |
| `MAX_CHARACTERS` | `3` | Limit postaci na konto. |
| `API_PER_MIN`, `WS_PER_MIN`, `WS_PER_IP` | `240`, `30`, `8` | Limity nadużyć na adres IP. |
| `BREVO_API_KEY` / `RESEND_API_KEY` | – | Poczta przez API HTTPS (działa na darmowym Renderze). `MAIL_TRANSPORT` = `auto` (domyślnie) / `brevo` / `resend` / `smtp`. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | – | Poczta do resetu hasła, np. Brevo: `smtp-relay.brevo.com`, port `2525` (darmowy Render blokuje porty 25/465/587). |

Lokalnie można użyć pliku `.env` w katalogu projektu (wzór: `.env.example`). Zmienne ustawione w systemie mają pierwszeństwo.

## Administrator i moderacja

- **Role:** `gracz` < `moderator` < `admin`. Rola jest sprawdzana na serwerze przy każdym żądaniu `/api/admin/*`, przy każdej komendzie czatu i przy samej stronie `/admin` (niezalogowany → logowanie, gracz → 403).
- **Pierwszy admin:**
  - ustaw zmienne `ADMIN_LOGIN`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` przed pierwszym startem;
  - albo z konsoli: `npm run make-admin -- <login>` nadaje rolę istniejącemu kontu, `--role moderator` nadaje inną rolę;
  - nowe konto z losowym hasłem: `--create --email adres`.
- **Panel `/admin`:** wyszukiwanie kont i postaci, wyciszenia (15 min, 1 h, 24 h, 7 dni lub na stałe, z powodem), blokady kont (czasowe; stałe tylko admin), wyrzucenie z gry, nadawanie ról (tylko admin), log czatu z wyciszaniem jednym kliknięciem, lista aktywnych kar i dziennik akcji (tylko admin).
- **Komendy w grze:** `/mute nick 1h powód`, `/unmute nick`, `/ban nick 7d powód`, `/unban nick`, `/kick nick powód`.
- **Zasady:** moderator może karać tylko graczy, a admin – graczy i moderatorów. Nie da się ukarać siebie, a ostatniego admina nie da się zdegradować.
- **Skutki kar:**
  - blokada natychmiast zamyka połączenia gracza, usuwa jego sesje i blokuje logowanie z komunikatem;
  - wyciszony gracz dostaje komunikat z pozostałym czasem i powodem, a jego wiadomości (także prywatne, drużynowe i gildyjne) nikomu nie są dostarczane.
- **Ślad akcji:** każda akcja trafia do tabeli `audit` (kto, kogo, co, powód, skąd: panel/czat/konsola). Log czatu (ostatnie 20 000 wiadomości) służy wyłącznie moderacji.

## Baza danych

- **SQLite (better-sqlite3)** w trybie WAL z `synchronous=NORMAL` i `busy_timeout`.
- **Migracje:** numerowane, uruchamiane automatycznie przy starcie (`PRAGMA user_version`). Nowe zmiany schematu dopisuje się na końcu listy w `server/db.js`.
- **Kopie zapasowe:**
  - co `BACKUP_HOURS` (domyślnie codziennie) spójna kopia online trafia do `DATA_DIR/backups/ardan-RRRR-MM-DD-GG-MM.db`, a trzymanych jest `BACKUP_KEEP` ostatnich;
  - ręcznie: `npm run backup`.
- **Hosting bez trwałego dysku (Render free):**
  - po ustawieniu `DATABASE_URL` cała baza jest co `SNAPSHOT_MINUTES` i przy każdym zamknięciu kompresowana i zapisywana w tabeli `ardan_snapshots` w Postgresie (np. Neon free);
  - po starcie z pustym dyskiem jest automatycznie odtwarzana.
  - Gra dalej działa na szybkim, lokalnym SQLite, więc nie trzeba było przepisywać całego serwera na asynchroniczny Postgres.
  - **Ograniczenie:** po nagłej awarii (bez zamknięcia) można stracić do `SNAPSHOT_MINUTES` ostatnich zmian. Uśpienie, restart i aktualizacja nie gubią danych.
  - Jeśli `DATABASE_URL` jest ustawiony, a Postgres nie odpowiada przy starcie produkcyjnym, serwer nie startuje, żeby nie nadpisać danych pustą bazą.

## Wdrożenie

**Instrukcja krok po kroku dla osoby bez doświadczenia: [`DEPLOY_PL.md`](DEPLOY_PL.md)** (GitHub → Neon → Render Blueprint → `/admin`). Paczkę do wgrania buduje `npm run pack` (`dist/ardan-online.zip`).

Gra trzyma stan świata w pamięci procesu. Uruchamiaj **jedną instancję**.

| Opcja | Koszt | Trwałość danych | Uwagi |
|---|---|---|---|
| Render Free + Neon Free (`render.yaml`) | 0 zł | kopia co 10 min + przy każdym zamknięciu | usypianie po 15 min bez graczy (start ok. 1 min), 750 h/mies. |
| Render Starter + dysk (`render.disk.yaml`) | ok. 7,25 USD/mies. | pełna (dysk + codzienne kopie + snapshoty Rendera) | bez usypiania, polecane przy stałych graczach |
| Fly.io + wolumen (`fly.toml`, `Dockerfile`) | kilka USD/mies., wymaga karty | pełna | region Warszawa |
| Docker / VPS | zależnie od hostingu | pełna (wolumen `/data`) | `docker build -t ardan . && docker run -p 8080:8080 -v ardan:/data --env-file .env ardan` |

Instalacja zależności na serwerze: `npm ci --omit=dev --ignore-scripts`. better-sqlite3 ma gotowe pliki binarne, więc nie potrzeba kompilatora. Health check: `GET /healthz`.

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
