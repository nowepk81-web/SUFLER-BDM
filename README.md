# BDM Live Coach — aplikacja webowa

Responsywna aplikacja do używania na komputerze i telefonie. Po włączeniu mikrofonu rozpoznaje mowę krótkimi fragmentami (ok. 3 s) przez Cloudflare Workers AI; gdy powiązanie `AI` jest niedostępne, próbuje Web Speech API przeglądarki. Wymaga HTTPS i zgody przeglądarki na mikrofon. Nie zapisuje nagrań ani transkrypcji w bazie. Pilne wskazówki zastępują poprzednie od razu; spóźnione trafiają do listy „Wcześniejsze podpowiedzi”.

## Uruchom lokalnie

W katalogu `bdm sufler/aplikacja`:

```powershell
npm install
npm run dev
npm test
npm run build
```

Mikrofon w przeglądarce działa na `localhost` w trybie developerskim.

## Publikacja przez GitHub → Cloudflare Pages (bez Node.js na komputerze)

Szczegółowa instrukcja jest w [CLOUDFLARE_GITHUB.md](./CLOUDFLARE_GITHUB.md). Obecny projekt to publiczne repozytorium `nowepk81-web/SUFLER-BDM` oraz `sufler-bdm.pages.dev`. Wgraj tylko zawartość folderu `bdm sufler/aplikacja` do katalogu głównego tego repozytorium. Commit w gałęzi `main` wywoła automatyczny build `npm run build` i wdrożenie `dist`. Klucz `DEEPSEEK_API_KEY` pozostaje wyłącznie sekretem Cloudflare.

## Alternatywa: publikacja z komputera z Node.js

W paczce ZIP znajdują się źródła (`src`), funkcja API (`functions`), `package.json` i konfiguracja Cloudflare. Wariant najprostszy do powtarzalnego wdrożenia: rozpakuj paczkę na komputerze z Node.js 20+ i opublikuj z terminala.

1. Zainstaluj Node.js 20 lub nowszy, jeśli nie jest dostępny. Zaloguj się do panelu Cloudflare w przeglądarce.
2. Otwórz PowerShell w katalogu z `package.json`.
3. Wykonaj poniższe polecenia. Przy `wrangler login` otworzy się autoryzacja Cloudflare w przeglądarce:

   ```powershell
   npm install
   npx wrangler login
   npm run secret:set
   npm run deploy
   ```

   Przy `secret:set` wklej klucz API DeepSeek do terminala, gdy pojawi się prośba. Klucz nie jest zawarty w paczce ani w kodzie strony.
4. Po udanym deployu otwórz `https://sufler-bdm.pages.dev`. Użytkownicy nie wpisują klucza — zezwalają na mikrofon i naciskają „Rozpocznij nasłuchiwanie”.

**Ważne:** samo przeciągnięcie ZIP-a w formularz „Upload assets” Cloudflare Pages nie wystarczy. To spakowany kod źródłowy: trzeba zainstalować zależności, zbudować aplikację i wdrożyć Pages Functions. Instrukcję komendami powyżej należy wykonać z komputera, który ma Node.js i dostęp do konta Cloudflare.

Klucz API jest przechowywany jako sekret Cloudflare Pages i nigdy nie jest wysyłany do przeglądarki. Krótkie fragmenty dźwięku są przesyłane do Workers AI, gdy powiązanie `AI` jest dostępne. Ostatnie wypowiedzi i krótka pamięć spotkania trafiają do DeepSeek tylko po wykryciu ważnego sygnału. Aplikacja nie używa konta, logowania, tokenu sesji ani browser storage i nie zapisuje kontekstu do bazy; ustawienia retencji dostawców mogą mieć zastosowanie. Jeśli wymagane jest, by żaden dostawca zewnętrzny nie otrzymał audio ani tekstu, nie używaj tej wersji online.

## Wcześniejsze rozmowy jako pomoc w coachingu

`lib/reference-patterns.js` zawiera krótką, anonimową analizę powtarzających się sytuacji z wcześniejszych spotkań: typ reakcji klienta, ryzyko w reakcji BDM i możliwy kolejny ruch. Po wykryciu ważnego sygnału serwer wybiera maksymalnie dwie pasujące analogie i przekazuje je DeepSeek razem z bieżącymi wypowiedziami. Bieżąca rozmowa ma pierwszeństwo; analogie nie są dowodem na potrzeby aktualnego klienta ani na funkcje eRecruitera. Agent nie „uczy się sam” z nowych spotkań.

`lib/offer-knowledge.js` zawiera wyłącznie ceny katalogowe z oferty z 01.04.2026. Jest to jawny plik w publicznym repozytorium. **Nie dodawaj tu poufnych rabatów ani warunków konkretnego klienta.** Przed podaniem ceny należy potwierdzić jej aktualność. Plik nie potwierdza funkcji, dostępności w pakiecie, warunków testu ani integracji.

Publiczna baza wiedzy eRecruiter nie jest już pobierana ani dołączana do zapytań AI. Na pytanie o niepotwierdzony fakt produktowy coach powinien podpowiedzieć, by go sprawdzić, zamiast wymyślać odpowiedź. Anonimowe analizy dawnych rozmów nadal pomagają dobrać sposób reakcji, ale nie są źródłem faktów o produkcie.

Wersja 2.8 analizuje zwykłe pytania oraz naturalnie wyrażone obawy, potrzeby i wartości. Przycisk „Podpowiedz teraz” analizuje ostatni rozpoznany kontekst bez pisania. Główna karta pokazuje skrót, pełną radę można rozwinąć. Po 60 sekundach karta trafia do listy wcześniejszych podpowiedzi. W ustawieniach są liczniki i średnie czasy etapów z bieżącej karty, bez zapisu treści rozmowy. Skrócenie fragmentu audio z 3,6 do 3 sekund wymaga sprawdzenia jakości transkrypcji na docelowych urządzeniach.

Surowe transkrypcje, nazwiska, nazwy firm i dane kontaktowe **nie są częścią aplikacji ani paczki wdrożeniowej**. Nie dodawaj ich do publicznego repozytorium GitHub. W tej wersji nie ma formularza wgrywania nowych rozmów: aby dodać kolejny sprawdzony wzorzec, zanonimizuj go, dopisz do `lib/reference-patterns.js` i zatwierdź zmianę w repozytorium. Cloudflare wdroży aktualizację automatycznie. Biblioteka jest jawna dla osób mających dostęp do kodu repozytorium, dlatego powinna zawierać tylko ogólne obserwacje.

## Pierwsze wdrożenie i klucz serwerowy

Klucz ustawia się jako sekret projektu (najlepiej przed pierwszym uruchomieniem). Z katalogu `aplikacja` uruchom:

```powershell
npm run secret:set
```

Wklej klucz DeepSeek w terminalu, gdy Wrangler o to poprosi (nie dodawaj go do plików ani repozytorium). Po zmianie sekretu uruchom ponowne wdrożenie:

```powershell
npm run deploy
```

Można też dodać go w panelu Cloudflare: Workers & Pages → sufler-bdm → Settings → Variables and Secrets → Add → Secret, nazwa `DEEPSEEK_API_KEY`, wartość klucza. Skonfiguruj sekret dla środowiska Production (oraz Preview tylko, jeśli potrzebne) i wykonaj nowy deploy.

Do lokalnego sprawdzenia Pages Function użyj drugiego terminala w katalogu `aplikacja`:

```powershell
npm run dev:pages
```

Sekret lokalny do testowania funkcji można podać w ignorowanym pliku `.dev.vars`; nie dodawaj go do GitHub. Zwykły `npm run dev` uruchamia tylko frontend; do testowania endpointu AI użyj `dev:pages`.

### Ochrona publicznego endpointu

Bez logowania każdy, kto pozna publiczny link, może wysyłać żądania obciążające konto DeepSeek lub Workers AI. Przed udostępnieniem linku włącz reguły Cloudflare Rate Limiting na `POST /api/coach` i `POST /api/transcribe`, ustaw limit wydatków/powiadomienia w DeepSeek i monitoruj użycie Workers AI. Ograniczenia po stronie przeglądarki nie powstrzymają nadużyć. Przed użyciem na firmowych spotkaniach sprawdź zasady organizacji i wymagane poinformowanie uczestników o przetwarzaniu dźwięku i tekstu przez zewnętrznych dostawców.

## Telefon i działanie w tle

Dodaj stronę do ekranu głównego z menu Chrome. Podczas nasłuchiwania trzymaj kartę/PWA otwartą. Strona blokuje wygaszanie ekranu, o ile przeglądarka wspiera Screen Wake Lock. Nie można zagwarantować nasłuchiwania po zablokowaniu telefonu, przejściu do innej aplikacji ani przy ubiciu procesu przez system; przetestuj zachowanie na konkretnym urządzeniu. Aplikacja słyszy dźwięk z mikrofonu, **nie pobiera bezpośrednio ścieżki audio z Teams**.
