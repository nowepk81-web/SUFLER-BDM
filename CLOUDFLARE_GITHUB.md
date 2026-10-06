# Publikacja BDM Live Coach z GitHub przez Cloudflare Pages

W tym wariancie Cloudflare buduje aplikację z repozytorium. Na komputerze nie trzeba instalować Node.js. Obecna aplikacja działa w projekcie `sufler-bdm` pod `https://sufler-bdm.pages.dev`, połączonym z repozytorium `nowepk81-web/SUFLER-BDM`. Klucz DeepSeek nie może trafić do repozytorium.

## 1. Aktualizuj istniejące repozytorium GitHub

1. Rozpakuj dostarczoną paczkę ZIP na komputerze. Do GitHub dodawaj **rozpakowane pliki i foldery**, nie sam plik ZIP.
2. W repozytorium `SUFLER-BDM` zastąp pliki o tych samych ścieżkach zawartością paczki: `src/`, `functions/`, `lib/`, `public/`, `package.json`, `index.html`, `vite.config.js`, `wrangler.toml`, `README.md`, `CLOUDFLARE_GITHUB.md`.
3. Upewnij się, że `package.json`, `src/` i `functions/` znajdują się **w głównym katalogu repozytorium**, bez dodatkowego poziomu `aplikacja/`.
4. Zatwierdź zmiany w gałęzi `main`. Cloudflare automatycznie pobierze commit i wdroży nową wersję.

Nie wgrywaj `node_modules`, `dist`, `.dev.vars`, `pnpm-lock.yaml`, surowych transkrypcji ani `oferta cała.pdf`. Repozytorium jest publiczne; ceny katalogowe z oferty są zapisane w `lib/offer-knowledge.js` i będą widoczne w kodzie.

## 2. Sprawdź istniejącą konfigurację Cloudflare Pages

W **Workers & Pages → sufler-bdm → Settings** sprawdź: gałąź produkcyjna `main`, polecenie budowania `npm run build`, katalog wynikowy `dist`, katalog główny `/`. Wdrożenie musi zawierać Pages Functions `/api/coach` i `/api/transcribe`. Nie twórz drugiego projektu, jeśli `sufler-bdm` już działa.

## 3. Dodaj klucz DeepSeek jako sekret

Otwórz **Workers & Pages → sufler-bdm → Settings → Variables and Secrets** (czasem sekcja nazywa się **Environment variables**).

1. Wybierz **Add**, typ **Secret**.
2. Ustaw nazwę dokładnie `DEEPSEEK_API_KEY` i wklej wartość klucza DeepSeek. Jeśli sekret już istnieje, nie dodawaj go ponownie.
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
3. Po kilku sekundach mówienia otwórz **Pokaż kontekst** i sprawdź, czy pojawia się tekst. Status pod przyciskiem pokaże, która usługa rozpoznaje mowę.
4. Jeśli tekst jest widoczny, ale nie ma porad, wypowiedz testowe zdanie „Czy może mi Pan podać cenę systemu?”. Po istotnym sygnale powinna pojawić się krótka podpowiedź. Gdy jest błąd AI, sprawdź sekret `DEEPSEEK_API_KEY` i konto DeepSeek. Domyślnie aplikacja pozostaje przy „Słuchaj”.

Użytkownicy nie muszą mieć kont Cloudflare, GitHub ani DeepSeek i nie wpisują klucza. Każdy posiadający adres może używać publicznej aplikacji. Bez logowania nie da się całkowicie powstrzymać obcych osób przed wywoływaniem API, więc ustaw limity wydatków/powiadomienia DeepSeek oraz dostępne w planie reguły rate limiting Cloudflare.

## Aktualizacje

Każdy commit do gałęzi produkcyjnej (np. `main`) uruchomi nowy build i deploy. Inne gałęzie mogą tworzyć wdrożenia Preview.

Anonimowe wzorce z wcześniejszych rozmów są w `lib/reference-patterns.js`. Zmiana tego pliku i commit również uruchamia aktualizację. Do repozytorium nie wgrywaj surowych transkrypcji ani pliku `BDM_REFERENCE_TRANSCRIPTS.md`: zawierają dane klientów, a repozytorium może być publiczne.

## Dane i prywatność

Aplikacja nie używa logowania ani sesji użytkownika i nie zapisuje transkryptu do bazy. Gdy działa powiązanie Workers AI, krótkie fragmenty audio trafiają do Cloudflare w celu transkrypcji. Gdy Cloudflare zawiedzie, usługa rozpoznawania mowy przeglądarki może przetwarzać audio według własnych zasad. Tekst trafia do DeepSeek tylko po wykryciu istotnego sygnału. Nie można zagwarantować braku retencji po stronie dostawców.

## Wersja 2.4 — Cloudflare i przeglądarka

Po wdrożeniu stopka pokazuje `v2.4`. Ta wersja nie korzysta z konta Microsoft ani API Azure. Jeśli wcześniej wgrano v2.3, usuń w GitHub pliki `functions/api/azure-speech.js`, `src/azure-speech.js` oraz `tests/azure-speech.test.js`; samo wgranie ZIP nie usuwa starych plików. Starsze paczki zachowano w katalogu wydań.

## Wersja 2.5 — historia sygnałów

Po wdrożeniu stopka pokazuje `v2.5`. Podpowiedź automatycznie przechodzi po 60 sekundach do zwiniętej listy pod głównym kaflem. Przycisk `Auto 60 s` włącza i wyłącza automat, a `Odłóż` przenosi kartę od razu. Powtórzony sygnał ma czerwone oznaczenie. Odpowiedzi nie są obcinane po 120 znakach.

Przy ręcznym wgrywaniu do GitHub zachowaj strukturę katalogów: `src/main.jsx`, `src/styles.css` i `functions/api/coach.js` muszą pozostać w swoich folderach. Pliki o tych samych nazwach wrzucone do głównego katalogu repozytorium nie aktualizują aplikacji.

## Wersja 2.6 — publiczna baza wiedzy eRecruiter

Aplikacja ma indeks publicznych artykułów z `https://pomoc.erecruiter.pl/pl/` w `lib/help-center-index.js`. Przy pasującym temacie funkcja `functions/api/coach.js` pobiera fragment właściwego artykułu i podaje źródło DeepSeek. Nie potrzeba osobnego klucza API, logowania ani zmian w ustawieniach Cloudflare. Jeśli baza wiedzy chwilowo nie odpowiada, coach korzysta z zapisanej wiedzy ofertowej. Przy wgrywaniu na GitHub dodaj również `lib/help-center.js`, `lib/help-center-index.js` i `scripts/sync-help-center.mjs` w ich folderach. Stopka aplikacji pokaże `v2.6` po wdrożeniu.
