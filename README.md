# BDM Live Coach — aplikacja webowa

Responsywna aplikacja do używania na komputerze i telefonie. Przy powiązaniu Workers AI rozpoznaje mowę w pięciosekundowych fragmentach przez Cloudflare Whisper. Bez tego powiązania używa Web Speech API przeglądarki. Wymaga HTTPS i jawnego uprawnienia mikrofonu. Aplikacja nie tworzy plików audio.

## Uruchom lokalnie

W katalogu `web`:

```powershell
npm install
npm run dev
```

Mikrofon w przeglądarce działa na `localhost` w trybie developerskim.

## Publikacja przez GitHub → Cloudflare Pages (bez Node.js na komputerze)

Szczegółowa instrukcja jest w [CLOUDFLARE_GITHUB.md](./CLOUDFLARE_GITHUB.md). W skrócie: wrzuć zawartość tego katalogu do prywatnego repozytorium GitHub, połącz repo w Cloudflare Pages, ustaw build `npm run build` i output `dist`, a klucz ustaw jako sekret `DEEPSEEK_API_KEY` w Cloudflare. Cloudflare buduje projekt na swoich serwerach.

## Alternatywa: publikacja z komputera z Node.js

W paczce ZIP znajdują się źródła (`src`), funkcja API (`functions`), `package.json` i konfiguracja Cloudflare. Wariant najprostszy do powtarzalnego wdrożenia: rozpakuj paczkę na komputerze z Node.js 20+ i opublikuj z terminala.

1. Zainstaluj Node.js 20 lub nowszy, jeśli nie jest dostępny. Zaloguj się do panelu Cloudflare w przeglądarce.
2. Rozpakuj `BDM-Live-Coach-cloudflare.zip`. Otwórz PowerShell w katalogu `web` — tym, w którym jest `package.json`.
3. Wykonaj poniższe polecenia. Przy `wrangler login` otworzy się autoryzacja Cloudflare w przeglądarce:

   ```powershell
   npm install
   npx wrangler login
   npx wrangler pages project create bdm-live-coach
   npm run secret:set
   npm run deploy
   ```

   Jeśli projekt już istnieje, pomiń `pages project create`. Przy `secret:set` wklej klucz API DeepSeek do terminala, gdy pojawi się prośba. Klucz nie jest zawarty w paczce ani w kodzie strony.
4. Po udanym deployu Wrangler wypisze adres `https://bdm-live-coach.pages.dev` (lub przydzielony adres projektu). Otwórz go w Chrome na komputerze i telefonie. Użytkownicy nie wpisują klucza — zezwalają na mikrofon i naciskają „Rozpocznij nasłuchiwanie”.

**Ważne:** samo przeciągnięcie ZIP-a w formularz „Upload assets” Cloudflare Pages nie wystarczy. To spakowany kod źródłowy: trzeba zainstalować zależności, zbudować aplikację i wdrożyć Pages Functions. Instrukcję komendami powyżej należy wykonać z komputera, który ma Node.js i dostęp do konta Cloudflare.

Klucz API jest przechowywany jako sekret Cloudflare Pages i nigdy nie jest wysyłany do przeglądarki. Krótkie fragmenty dźwięku są przesyłane do Workers AI, gdy powiązanie `AI` jest dostępne. Ostatnie wypowiedzi i krótka pamięć spotkania trafiają do DeepSeek tylko po wykryciu ważnego sygnału. Aplikacja nie używa konta, logowania, tokenu sesji ani browser storage i nie zapisuje kontekstu do bazy; ustawienia retencji dostawców mogą mieć zastosowanie. Jeśli wymagane jest, by żaden dostawca zewnętrzny nie otrzymał audio ani tekstu, nie używaj tej wersji online.

## Pierwsze wdrożenie i klucz serwerowy

Klucz ustawia się jako sekret projektu (najlepiej przed pierwszym uruchomieniem). Z katalogu `web` uruchom:

```powershell
npm run secret:set
```

Wklej klucz DeepSeek w terminalu, gdy Wrangler o to poprosi (nie dodawaj go do plików ani repozytorium). Po zmianie sekretu uruchom ponowne wdrożenie:

```powershell
npm run deploy
```

Można też dodać go w panelu Cloudflare: Workers & Pages → bdm-live-coach → Settings → Variables and Secrets → Add → Secret, nazwa `DEEPSEEK_API_KEY`, wartość klucza. Skonfiguruj sekret dla środowiska Production (oraz Preview tylko, jeśli potrzebne) i wykonaj nowy deploy.

Do lokalnego sprawdzenia Pages Function użyj drugiego terminala w katalogu `web`:

```powershell
npm run dev:pages
```

Sekret lokalny dodaj interaktywnie poleceniem `npx wrangler pages secret put DEEPSEEK_API_KEY --project-name bdm-live-coach` (nie umieszczaj go w pliku `.env` śledzonym przez Git). Zwykły `npm run dev` uruchamia tylko frontend; do testowania endpointu AI użyj `dev:pages`.

### Ochrona publicznego endpointu

Bez logowania każdy, kto pozna publiczny link, może wysyłać żądania obciążające konto DeepSeek lub Workers AI. Przed udostępnieniem linku włącz reguły Cloudflare Rate Limiting na `POST /api/coach` i `POST /api/transcribe`, ustaw limit wydatków/powiadomienia w DeepSeek i monitoruj użycie Workers AI. Ograniczenia po stronie przeglądarki nie powstrzymają nadużyć.

## Telefon i działanie w tle

Dodaj stronę do ekranu głównego z menu Chrome. Podczas nasłuchiwania trzymaj kartę/PWA otwartą. Strona blokuje wygaszanie ekranu, o ile przeglądarka wspiera Screen Wake Lock. Nie można zagwarantować nasłuchiwania po zablokowaniu telefonu, przejściu do innej aplikacji ani przy ubiciu procesu przez system; przetestuj zachowanie na konkretnym urządzeniu.
