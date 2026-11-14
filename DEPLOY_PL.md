# ARDAN – jak wrzucić grę do internetu (krok po kroku, bez programowania)

Efekt: gra pod adresem `https://twoja-nazwa.onrender.com` z kontami graczy, bazą danych i Twoim kontem administratora (panel `/admin`).

**Koszt: 0 zł.** Używamy trzech darmowych usług:

| Usługa | Do czego | Konto |
|---|---|---|
| **GitHub** | przechowuje pliki gry | github.com |
| **Render** | uruchamia serwer gry | render.com |
| **Neon** | trwała baza danych (kopie zapisu gry) | neon.tech |
| Brevo *(opcjonalnie)* | e-maile „nie pamiętam hasła” | brevo.com |

Całość zajmuje ok. 30–40 minut.

---

## Krok 1. Rozpakuj paczkę

1. Rozpakuj `ardan-online.zip` (prawy przycisk → „Wyodrębnij wszystkie”).
2. Powstanie folder **`ardan-online`**. W środku są m.in. foldery `public`, `server`, `scripts` oraz pliki `package.json`, `render.yaml`, `DEPLOY_PL.md`.

## Krok 2. GitHub – konto i repozytorium

1. Wejdź na **https://github.com/signup** i załóż konto (e-mail, hasło, nazwa użytkownika). Potwierdź e-mail kodem.
2. Kliknij **+** (prawy górny róg) → **New repository**.
   - **Repository name:** `ardan-online`
   - Wybierz **Private** (prywatne – nikt nie zobaczy kodu).
   - **Nie** zaznaczaj „Add a README file”.
   - Kliknij **Create repository**.
3. Na stronie nowego repozytorium kliknij link **„uploading an existing file”** (albo **Add file → Upload files**).

GitHub przyjmuje najwyżej 100 plików naraz, więc wrzucisz grę w **dwóch turach**. Pliki trzeba **przeciągnąć myszką** z okna folderu. Przeciągnięty folder zachowuje swoją strukturę, a przycisk „choose your files” nie umie wybrać folderu.

**Tura 1:**
1. Otwórz folder `ardan-online` na komputerze.
2. Przeciągnij **sam folder `public`** na stronę GitHuba.
3. Poczekaj, aż lista plików się wczyta (ok. 58 plików).
4. Na dole kliknij zielone **Commit changes**.

**Tura 2:**
1. Znowu **Add file → Upload files**.
2. Zaznacz w folderze `ardan-online` **wszystko oprócz `public`**, czyli foldery `server`, `scripts` i wszystkie pliki.
3. Przeciągnij to na stronę i kliknij **Commit changes**.

Sprawdź, czy w repozytorium **na samej górze** (nie w podfolderze) widać `package.json`, `render.yaml`, `server`, `public` i `scripts`. Jeśli wszystko wylądowało w folderze `ardan-online/`, usuń repozytorium (**Settings → Delete**) i powtórz krok 2, przeciągając **zawartość** folderu, a nie sam folder.

> Pliki zaczynające się od kropki (`.gitignore`, `.node-version`, `.env.example`) nie są potrzebne do działania gry. Na Macu nie są widoczne – to nic nie szkodzi.

## Krok 3. Neon – darmowa baza danych (trwały zapis)

Darmowy serwer na Renderze **nie ma trwałego dysku**: przy każdym uśpieniu, restarcie i aktualizacji jego pliki znikają. Dlatego gra co 10 minut, a także przy każdym zatrzymaniu serwera, zapisuje kopię całej bazy w Neonie. Po starcie odtwarza ją automatycznie.

1. Wejdź na **https://neon.tech** → **Sign up**. Najprościej wybrać **Continue with GitHub**. Karta płatnicza nie jest potrzebna.
2. Utwórz projekt (**Create project**):
   - **Name:** `ardan`
   - **Region:** **AWS Europe Central 1 (Frankfurt)**, czyli blisko serwera Render.
   - Pozostałe opcje zostaw domyślne → **Create**.
3. Na pulpicie projektu kliknij **Connect**. Skopiuj **Connection string**, czyli tekst zaczynający się od `postgresql://…`. **Zachowaj go**, będzie potrzebny w kroku 5. To jest hasło do bazy, nikomu go nie pokazuj.

## Krok 4. (Opcjonalnie) Brevo – e-maile z resetem hasła

Bez tego gra działa normalnie, tylko przycisk „Nie pamiętam hasła” nie wyśle e-maila.

1. Załóż konto na **https://www.brevo.com**. Plan darmowy pozwala wysłać 300 e-maili dziennie.
2. Dodaj i potwierdź adres nadawcy: **Senders, Domains & Dedicated IPs → Senders → Add a sender**. Może to być Twój zwykły e-mail.
3. Wejdź w **SMTP & API → zakładka SMTP** i zapisz:
   - **Login**, np. `abc123@smtp-brevo.com` → to będzie `SMTP_USER`;
   - kliknij **Generate a new SMTP key** i skopiuj klucz → to będzie `SMTP_PASS`.
4. Serwer to `smtp-relay.brevo.com`. Port wpiszesz **2525**, bo darmowy Render blokuje zwykłe porty pocztowe (25, 465, 587).

## Krok 5. Render – uruchomienie gry

1. Wejdź na **https://render.com** → **Get Started** → **GitHub**, czyli zaloguj się kontem z kroku 2.
2. Kliknij **New +** → **Blueprint**.
3. Kliknij **Connect GitHub** / **Configure account**:
   - pozwól Renderowi zobaczyć repozytorium `ardan-online` (**Only select repositories → ardan-online → Install**);
   - wybierz repozytorium z listy i kliknij **Connect**.
4. Render przeczyta plik `render.yaml` i pokaże usługę **ardan-online (Free)**. Podaj nazwę Blueprintu, np. `ardan`.
5. Wypełnij zmienne, o które Render zapyta:

| Zmienna | Co wpisać |
|---|---|
| `DATABASE_URL` | connection string z Neona (krok 3) |
| `ADMIN_LOGIN` | Twój login administratora, np. `piotr` (3–20 znaków: litery bez polskich znaków, cyfry, `_`) |
| `ADMIN_EMAIL` | Twój e-mail |
| `ADMIN_PASSWORD` | **mocne** hasło: min. 8 znaków, w tym 3 rodzaje (małe, wielkie, cyfry, symbole) i bez loginu w środku |
| `SMTP_HOST` | `smtp-relay.brevo.com` albo puste (bez Brevo) |
| `SMTP_USER`, `SMTP_PASS` | dane z Brevo (krok 4) albo puste |
| `MAIL_FROM` | np. `ARDAN <twoj@email.pl>` (adres potwierdzony w Brevo) albo puste |

   `SESSION_SECRET` Render wygeneruje sam. `SMTP_PORT=2525` i reszta są już ustawione.

6. Kliknij **Apply** / **Deploy Blueprint**. Pierwsza budowa trwa 3–6 minut. Postęp widać w **Logs**. Na końcu powinien się pojawić napis:
   ```
   [ARDAN] Utworzono konto (admin): piotr. Zaloguj się i wejdź na /admin.
   [ARDAN] Serwer działa: https://ardan-online-xxxx.onrender.com
   ```
7. Adres gry jest na górze strony usługi, np. **https://ardan-online-xxxx.onrender.com**. To jest link do rozesłania graczom.

> Jeśli Render poprosi o kartę przy Blueprincie, możesz zamiast tego użyć **New + → Web Service** i wybrać repozytorium. Ustaw:
> - **Language:** Node
> - **Build Command:** `npm ci --omit=dev`
> - **Start Command:** `npm start`
> - **Instance Type:** Free
>
> Potem w **Environment** dodaj ręcznie zmienne z tabeli powyżej oraz: `NODE_ENV=production`, `TRUST_PROXY=1`, `SESSION_SECRET=` (długi losowy ciąg znaków, np. 40 dowolnych liter i cyfr), `SMTP_PORT=2525`.

## Krok 6. Wejście do panelu administratora

1. Otwórz `https://twoj-adres.onrender.com/logowanie` i zaloguj się danymi `ADMIN_LOGIN` / `ADMIN_PASSWORD`.
2. W menu pojawi się **Panel**. Możesz też wejść bezpośrednio na **`/admin`**.
3. Co znajdziesz w panelu:
   - **Gracze** – wyszukiwanie po loginie, e-mailu lub nicku. Na każdym koncie są przyciski: **Wycisz** (15 min / 1 h / 24 h / 7 dni / na stałe, z powodem), **Zdejmij wyciszenie**, **Zablokuj konto** (czasowo lub na stałe), **Odblokuj** i **Wyrzuć z gry**. Admin może też zmienić **rolę**: Gracz / Moderator / Administrator.
   - **Czat** – ostatnie wiadomości. Przycisk **Wycisz** przy wiadomości wycisza autora jednym kliknięciem.
   - **Kary** – aktywne wyciszenia i blokady.
   - **Dziennik** – kto, kogo, kiedy i dlaczego ukarał (widzi go tylko administrator).
4. Moderatorów mianujesz w zakładce **Gracze**: przy koncie wybierz rolę **Moderator**. Gracz najpierw musi założyć konto.
5. Komendy na czacie w grze (dla moderatorów i adminów):
   ```
   /mute nick 1h powód        (czasy: 15m, 1h, 24h, 7d, perm)
   /unmute nick
   /ban nick 7d powód         (na stałe: perm – tylko administrator)
   /unban nick
   /kick nick powód
   ```
   Twoje wiadomości na czacie mają czerwoną plakietkę **ADM**, a moderatorów niebieską **MOD**.

## Jak to działa i jakie są ograniczenia (uczciwie)

- **Usypianie:** darmowy serwer Render zasypia po 15 minutach bez graczy. Pierwsze wejście po przerwie trwa ok. 1 minuty (Render pokazuje ekran ładowania). Potem gra działa normalnie.
- **Zapis danych:** konta, postacie, rynek i gildie są zapisywane w Neonie co 10 minut oraz przy każdym zatrzymaniu serwera (uśpienie, aktualizacja, restart).
  - **Normalne uśpienie i aktualizacja nie gubią danych.**
  - Przy nagłej awarii serwera (bez zatrzymania) można stracić najwyżej ostatnie ~10 minut gry.
  - Neon trzyma 7 ostatnich kopii.
- **Limity Neona (darmowo):** 1 GB miejsca (gra zużywa kilka MB) i 100 godzin obliczeniowych miesięcznie (CU-hours). Przy 10-minutowym zapisie to wystarcza nawet przy graczach online przez cały dzień. Jeśli limit się skończy, kopie przestaną się zapisywać do końca miesiąca, a gra będzie działać dalej. Wtedy ustaw w Renderze `SNAPSHOT_MINUTES=20`.
- **Limit Rendera:** 750 godzin miesięcznie na darmowe usługi. To wystarcza na jedną grę działającą cały miesiąc.
- **Darmowa baza Postgres od Rendera wygasa po 30 dniach.** Dlatego używamy Neona, który nie wygasa.

**Kiedy warto zapłacić:** gdy gra ma stałych graczy i nie chcesz ani usypiania, ani zależności od Neona.
- W Renderze zmień plan usługi na **Starter** (ok. 7 USD/mies.) i dodaj **Disk** 1 GB (ok. 0,25 USD/mies.) z punktem montowania `/var/data`.
- Ustaw `DATA_DIR=/var/data`. `DATABASE_URL` możesz wtedy usunąć.
- Gotowa konfiguracja jest w pliku `render.disk.yaml` (przy nowym Blueprincie wpisz go w pole **Blueprint Path**).
- Codzienne kopie zapasowe trafiają wtedy do `/var/data/backups` (7 ostatnich), a Render dodatkowo robi codzienny snapshot dysku.
- Fly.io (plik `fly.toml`) też działa z trwałym dyskiem, ale wymaga podania karty.

## Aktualizacja gry

Wrzuć zmienione pliki do repozytorium na GitHubie (**Add file → Upload files**, zastępując stare). Render sam zbuduje i uruchomi nową wersję w kilka minut, a dane zostają.

## Gdy coś nie działa

- **„Deploy failed”**:
  - otwórz **Logs** i sprawdź pierwszą czerwoną linijkę;
  - najczęstsza przyczyna to pliki w podfolderze zamiast w głównym folderze repozytorium (patrz krok 2).
- **Brak konta administratora**:
  - w logach będzie powód, np. `ADMIN_PASSWORD: Hasło jest za słabe`;
  - popraw zmienną w **Environment** i kliknij **Manual Deploy → Deploy latest commit**.
- **„Nie udało się połączyć z Postgresem”**:
  - sprawdź, czy `DATABASE_URL` jest skopiowany w całości (od `postgresql://` do końca);
  - serwer celowo nie startuje, żeby nie nadpisać danych pustą bazą.
- **Zapomniane hasło admina bez Brevo**:
  1. zmień w Renderze `ADMIN_LOGIN` na nowy login, a `ADMIN_EMAIL` na **inny** adres (na starym jest już stare konto, więc nowe konto nie zostanie utworzone), i ustaw nowe `ADMIN_PASSWORD`;
  2. zrób **Manual Deploy**; powstanie nowe konto administratora;
  3. stare konto możesz potem zablokować w panelu.
