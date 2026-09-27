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
4. Kliknij **Save and Deploy**. Cloudflare zainstaluje zależności i zbuduje stronę. Funkcja `/api/coach` znajduje się w `functions/api/coach.js` i zostanie wdrożona razem z Pages.

## 3. Dodaj klucz DeepSeek jako sekret

Po utworzeniu projektu otwórz **Workers & Pages → bdm-live-coach → Settings → Variables and Secrets** (czasem sekcja nazywa się **Environment variables**).

1. Wybierz **Add**, typ **Secret**.
2. Ustaw nazwę dokładnie `DEEPSEEK_API_KEY` i wklej wartość klucza DeepSeek.
3. Zastosuj sekret do **Production**. Preview dodaj tylko, jeśli chcesz testować wdrożenia preview.
4. Zapisz zmiany i wykonaj **Retry deployment** lub nowy commit, aby uruchomić nowy deploy ze skonfigurowanym sekretem.

Sekret jest dostępny tylko dla funkcji serwerowej. Nie dodawaj go jako zmiennej `VITE_*`, do `src/`, do GitHub Secrets (nie są tu potrzebne) ani do repozytorium.

## 4. Sprawdź działanie

1. Otwórz domenę `*.pages.dev` pokazaną w Cloudflare.
2. Zezwól przeglądarce na mikrofon i uruchom nasłuch.
3. Jeśli pojawi się błąd, sprawdź w Cloudflare, czy sekret `DEEPSEEK_API_KEY` został zapisany dla właściwego środowiska i czy konto DeepSeek może wykonywać zapytania.

Użytkownicy nie muszą mieć kont Cloudflare, GitHub ani DeepSeek i nie wpisują klucza. Każdy posiadający adres może używać publicznej aplikacji. Bez logowania nie da się całkowicie powstrzymać obcych osób przed wywoływaniem API, więc ustaw limity wydatków/powiadomienia DeepSeek oraz dostępne w planie reguły rate limiting Cloudflare.

## Aktualizacje

Każdy commit do gałęzi produkcyjnej (np. `main`) uruchomi nowy build i deploy. Inne gałęzie mogą tworzyć wdrożenia Preview.

## Dane i prywatność

Aplikacja nie używa logowania ani sesji użytkownika i nie zapisuje transkryptu do bazy. Tekst rozpoznany przez przeglądarkę jest wysyłany do funkcji Cloudflare, a następnie do DeepSeek. Usługa rozpoznawania mowy przeglądarki może przetwarzać audio według własnych zasad. Nie można zagwarantować braku retencji po stronie tych dostawców.
