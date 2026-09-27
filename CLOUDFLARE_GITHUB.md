# Publikacja BDM Live Coach z GitHub przez Cloudflare Pages

W tym wariancie Cloudflare buduje aplikację z repozytorium. Na komputerze nie trzeba instalować Node.js. Potrzebne są: konto GitHub, konto Cloudflare i klucz DeepSeek. Klucz nie może trafić do repozytorium.

## 1. Utwórz repozytorium GitHub

1. Pobierz i rozpakuj `BDM-Live-Coach-github.zip`.
2. Na GitHub wybierz **New repository**. Zalecane ustawienie: **Private**.
3. Utwórz repozytorium bez dodawania README, `.gitignore` ani licencji (są już w paczce).
4. Dodaj do repozytorium zawartość folderu `web` — tak, aby `package.json`, `src/` i `functions/` znajdowały się w katalogu głównym repozytorium, nie w dodatkowym folderze `web/`.
5. Zatwierdź zmiany (Commit). Klucz DeepSeek wpisuje się wyłącznie w Cloudflare, nigdy w GitHub.

## 2. Połącz GitHub z Cloudflare Pages

1. Zaloguj się do Cloudflare Dashboard → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
2. Wybierz GitHub i autoryzuj dostęp Cloudflare tylko do repozytorium aplikacji.
3. Wybierz utworzone repozytorium i skonfiguruj build:
   - Project name: `bdm-live-coach` (albo inna dostępna nazwa),
   - Production branch: `main` (lub nazwa głównej gałęzi),
   - Framework preset: **Vite**,
   - Build command: `npm run build`,
   - Build output directory: `dist`,
   - Root directory: `/` (domyślna; repozytorium ma zawierać bezpośrednio pliki z folderu `web`).
4. Kliknij **Save and Deploy**. Cloudflare zainstaluje zależności i zbuduje stronę. Funkcje `/api/coach` i `/api/transcribe` zostaną wdrożone razem z Pages.

## 3. Dodaj klucz DeepSeek jako sekret

Po utworzeniu projektu otwórz **Workers & Pages → bdm-live-coach → Settings → Variables and Secrets** (czasem sekcja nazywa się **Environment variables**).

1. Wybierz **Add**, typ **Secret**.
2. Ustaw nazwę dokładnie `DEEPSEEK_API_KEY` i wklej wartość klucza DeepSeek.
3. Zastosuj sekret do **Production**. Preview dodaj tylko, jeśli chcesz testować wdrożenia preview.
4. Zapisz zmiany i wykonaj **Retry deployment** lub nowy commit, aby uruchomić nowy deploy ze skonfigurowanym sekretem.

Sekret jest dostępny tylko dla funkcji serwerowej. Nie dodawaj go jako zmiennej `VITE_*`, do `src/`, do GitHub Secrets (nie są tu potrzebne) ani do repozytorium.

## 4. Włącz transkrypcję Cloudflare

Plik `wrangler.toml` zawiera powiązanie Workers AI o nazwie `AI`. Po wdrożeniu wejdź w **Workers & Pages → sufler-bdm → Settings → Bindings** i sprawdź, czy widnieje tam Workers AI `AI`. Jeśli nie, dodaj je ręcznie: **Add → Workers AI**, nazwa `AI`, następnie uruchom nowy deploy. [Instrukcja Cloudflare](https://developers.cloudflare.com/pages/functions/bindings/#workers-ai).

Po otwarciu `https://sufler-bdm.pages.dev/api/transcribe` powinien pojawić się tekst `{"available":true}`. Jeśli jest `false`, aplikacja użyje usługi rozpoznawania mowy przeglądarki, która u niektórych użytkowników zgłasza błąd `network`.

Workers AI nalicza użycie modelu rozpoznawania mowy; Cloudflare opisuje dzienny darmowy przydział i stawki na [stronie cen](https://developers.cloudflare.com/workers-ai/platform/pricing/). Publiczne endpointy `/api/transcribe` i `/api/coach` warto objąć limitami żądań w Cloudflare.

## 5. Sprawdź działanie

1. Otwórz domenę `*.pages.dev` pokazaną w Cloudflare.
2. Zezwól przeglądarce na mikrofon i uruchom nasłuch.
3. Po około 5 sekundach mówienia otwórz **Pokaż kontekst** i sprawdź, czy pojawia się tekst. Status pod przyciskiem pokaże, która usługa rozpoznaje mowę.
4. Jeśli tekst jest widoczny, ale nie ma porad, sprawdź sekret `DEEPSEEK_API_KEY` i konto DeepSeek. Porady pojawiają się tylko po istotnym sygnale w rozmowie.

Użytkownicy nie muszą mieć kont Cloudflare, GitHub ani DeepSeek i nie wpisują klucza. Każdy posiadający adres może używać publicznej aplikacji. Bez logowania nie da się całkowicie powstrzymać obcych osób przed wywoływaniem API, więc ustaw limity wydatków/powiadomienia DeepSeek oraz dostępne w planie reguły rate limiting Cloudflare.

## Aktualizacje

Każdy commit do gałęzi produkcyjnej (np. `main`) uruchomi nowy build i deploy. Inne gałęzie mogą tworzyć wdrożenia Preview.

Anonimowe wzorce z wcześniejszych rozmów są w `lib/reference-patterns.js`. Zmiana tego pliku i commit również uruchamia aktualizację. Do repozytorium nie wgrywaj surowych transkrypcji ani pliku `BDM_REFERENCE_TRANSCRIPTS.md`: zawierają dane klientów, a repozytorium może być publiczne.

## Dane i prywatność

Aplikacja nie używa logowania ani sesji użytkownika i nie zapisuje transkryptu do bazy. Gdy działa powiązanie Workers AI, krótkie fragmenty audio trafiają do Cloudflare w celu transkrypcji. Gdy go nie ma, usługa rozpoznawania mowy przeglądarki może przetwarzać audio według własnych zasad. Tekst trafia do DeepSeek tylko po wykryciu istotnego sygnału. Nie można zagwarantować braku retencji po stronie dostawców.
