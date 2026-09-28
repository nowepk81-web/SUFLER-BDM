// Opracowano z dostarczonego przez użytkownika „oferta cała.pdf”, aktualizacja 01.04.2026.
// To są ceny katalogowe netto miesięcznie, nie indywidualna oferta ani rabat.
// Uwaga: repozytorium GitHub jest publiczne — nie dodawaj tu poufnych warunków klienta.

export const OFFER_DATE = '01.04.2026';

const userBands = ['1–5', '6–10', '11–15', '16–20', '21–25', '26–30', '31–40', '41–50', '51–75', '76–100', '101–150', '151–200', '201–250', '251–300', '301–400', '401–500', '501–600'];

export const planPrices = {
  START: { price: 249, afterPromotion: 299, users: 5, projects: 15 },
  CORE: [999, 1299, 1589, 1859, 2088, 2309, 2669, 2969, 3569, 4119, 5119, 6019, 6819, 7519, 8719, 9819, 10819],
  PRIME: [2299, 2699, 3079, 3439, 3759, 4039, 4519, 4919, 5719, 6429, 7759, 8959, 10039, 10989, 12589, 14039, 15389],
  ULTIMATE: [4999, 5499, 5979, 6429, 6829, 7179, 7779, 8279, 9279, 10189, 11849, 13349, 14689, 15879, 17879, 19689, 21379],
};

const coreFacts = [
  'START: 5 dostępów (1 Administrator, 2 Rekruter, 2 Użytkownik), do 15 projektów rekrutacyjnych rocznie; bez rozszerzenia pakietu użytkowników. CORE, PRIME i ULTIMATE: nieograniczona liczba projektów; przedziały liczby użytkowników.',
  'We wszystkich wersjach: formularze aplikacyjne z pytaniami i filtrowaniem odpowiedzi, etapy i widok Kanban, notatki i oceny 1–5, tagi, rozpoznanie ponownej aplikacji, dodanie CV z dysku.',
  'We wszystkich wersjach: zarządzanie zgodami i klauzulami, monitoring czasu przetwarzania, przypomnienia o usuwaniu danych, obsługa żądań kandydatów i uprawnienia do danych. Nie składaj interpretacji prawnych.',
  'We wszystkich wersjach: bezpośrednia publikacja na Pracuj.pl w kreatorze ogłoszeń i bezpłatnych portalach współpracujących, wysłanie ogłoszenia do samodzielnie dodanych źródeł, monitoring skuteczności źródeł. Płatne portale współpracujące, np. OLX, są w module Multipublikacja Plus.',
  'We wszystkich wersjach: wtyczka eRecruiter Sourcing do zapisywania kandydatów z LinkedIn, e-mail i szablony, odbiór wiadomości w systemie, Planer spotkań, e-mailowe przypomnienia i anulowanie, ocena aplikacji przez biznes, aplikacja mobilna, podstawowe raporty, API, generowanie treści ogłoszeń i preselekcja AI.',
  'Spotkania z notyfikacją SMS w pakiecie: START 20, CORE 20, PRIME 50, ULTIMATE 100; możliwe rozszerzenie. Pakiet swobodnej komunikacji SMS jest osobnym modułem.',
  'PRIME i ULTIMATE zawierają Kreator Stron Karier / integrację z istniejącą stroną, Asystenta AI (podsumowanie CV i feedback) oraz Raporty Expert z AI Insights. W START i CORE są to odpowiednio moduły dodatkowe, jeśli wskazano w ofercie.',
  'ULTIMATE zawiera moduł Wakatu oraz obsługę 5 spółek; w PRIME obsługa wielu spółek jest dodatkowym modułem. Multirekrutacje są w ULTIMATE.',
  'Wsparcie na chacie i baza wiedzy są we wszystkich wersjach. Dedykowany opiekun jest w CORE, PRIME i ULTIMATE; brak go w START.',
];

const modules = [
  { keys: ['karier', 'stron', 'intranet'], fact: 'Wyszukiwarka ofert pracy / Kreator Stron Karier lub integracja z istniejącą stroną Kariera/Intranet: w PRIME i ULTIMATE w pakiecie, w START/CORE moduł od 369 zł netto/mies. Strona Kariery PRO: moduł dla CORE/PRIME/ULTIMATE od 899 zł netto/mies.; konfiguracja przez eksperta 3990 zł jednorazowo.' },
  { keys: ['raport', 'kpi', 'insight', 'analityk'], fact: 'Raporty Expert z AI Insights: w PRIME i ULTIMATE w pakiecie, w START/CORE moduł od 449 zł netto/mies. Cykliczne pakiety danych do analizy: osobny moduł dla CORE/PRIME/ULTIMATE od 729 zł netto/mies.' },
  { keys: ['asystent ai', 'feedback', 'podsumowan'], fact: 'Asystent AI (podsumowanie CV, mocne strony, obszary weryfikacji, generowanie feedbacku): w PRIME i ULTIMATE w pakiecie, w START/CORE moduł od 289 zł netto/mies.' },
  { keys: ['polecen', 'rekomendac'], fact: 'Moduł Poleceń Pracowniczych: opcjonalny we wszystkich wersjach, od 569 zł netto/mies.; obejmuje stronę ofert, linki poleceń i widoczność osoby polecającej.' },
  { keys: ['olx', 'multipublik', 'gowo', 'infoprac'], fact: 'Multipublikacja Plus: opcjonalna we wszystkich wersjach, 490 zł netto/mies. katalogowo; obejmuje m.in. bezpośrednią publikację na OLX, GoWork i Infopraca. Nie zakładaj, że publikacja w płatnym portalu jest bez dodatkowych opłat samego portalu.' },
  { keys: ['sms'], fact: 'Pakiet komunikacji SMS do kandydatów: opcjonalny, od 79 zł netto/mies. za 150 SMS. Spotkania z notyfikacją SMS mają pakiet w wersji systemu oraz płatne rozszerzenia.' },
  { keys: ['satysfakc', 'nps', 'ankiet'], fact: 'Badanie Satysfakcji Kandydatów (NPS, ankiety i raport): w ULTIMATE w pakiecie; w START/CORE/PRIME moduł od 489 zł netto/mies.' },
  { keys: ['onboard', 'preboard', 'nowego pracownika'], fact: 'Moduł Onboardingu jest opcjonalny we wszystkich wersjach, od 569 zł netto/mies.; obejmuje ścieżki, zadania i przypomnienia dla HR, przełożonego i nowej osoby.' },
  { keys: ['wakat', 'wniosk'], fact: 'Moduł Wakatu (wnioski i akceptacje) jest w ULTIMATE w pakiecie; w START/CORE/PRIME opcjonalny od 409 zł netto/mies.' },
  { keys: ['spół', 'spol', 'podmiot'], fact: 'Obsługa wielu spółek: ULTIMATE zawiera 5 spółek; PRIME ma możliwość dokupienia modułu. Dodatkowy podmiot powiązany dla PRIME/ULTIMATE: 990 zł netto/mies. katalogowo.' },
  { keys: ['automatyzac', 'workflow', 'voicebot'], fact: 'HR Workflows: jeden proces automatyzacji w planie Freemium; plany S/M/L katalogowo 499/699/1299 zł netto/mies., dodatkowo opłata aktywacyjna 199 zł w tych planach. Zakres automatyzacji zależy od planu; nie obiecuj konkretnej bez weryfikacji.' },
  { keys: ['spotkan', 'teams', 'meet', 'zoom'], fact: 'Planer spotkań, integracja spotkań online z Microsoft Teams (MS 365 Business), Google Meet i Zoom są we wszystkich wersjach. Wbudowany Moduł Spotkań Rekrutacyjnych to opcja za 290 zł netto/mies.' },
  { keys: ['marketplace'], fact: 'Integracje HR Marketplace: opcjonalne we wszystkich wersjach, 199 zł netto/mies. katalogowo za jedno narzędzie oraz 199 zł jednorazowej opłaty aktywacyjnej.' },
  { keys: ['jezyk', 'angielsk', 'obcojez'], fact: 'Dodatkowy język prowadzenia rekrutacji: opcjonalny we wszystkich wersjach, 390 zł netto/mies. katalogowo.' },
  { keys: ['opiekun', 'wsparci', 'chat'], fact: 'Wsparcie na chacie i baza wiedzy są w każdej wersji. Dedykowany opiekun jest w CORE, PRIME i ULTIMATE; START go nie obejmuje.' },
];

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').toLocaleLowerCase('pl-PL');
}

export function formatOfferContext(signalType, context = '') {
  const text = normalize(context);
  const matched = modules.filter((module) => module.keys.some((key) => text.includes(normalize(key)))).slice(0, 3);
  const lines = [`Źródło produktowe: pełna oferta eRecruiter z ${OFFER_DATE}; ceny katalogowe netto za miesiąc, nie indywidualna wycena.`];
  if (signalType === 'PRICE' || /cen|koszt|budzet|wycen|ile plac/.test(text)) {
    lines.push('Cennik bazowy: START 249 zł netto/mies. (po okresie promocji 299 zł), CORE od 999 zł, PRIME od 2299 zł, ULTIMATE od 4999 zł. CORE/PRIME/ULTIMATE zależą od przedziału liczby użytkowników; moduły dodatkowe mogą zwiększać cenę. Nie obiecuj rabatu ani konkretnego wariantu bez poznania zakresu.');
    lines.push(`Przedziały użytkowników: ${userBands.join(', ')}. Ceny CORE: ${planPrices.CORE.join(', ')}. PRIME: ${planPrices.PRIME.join(', ')}. ULTIMATE: ${planPrices.ULTIMATE.join(', ')}. Kolejne 100 użytkowników >600: CORE +1000, PRIME +1350, ULTIMATE +1690 zł netto/mies.`);
  }
  if (signalType !== 'PRICE') lines.push(...coreFacts.slice(0, 2));
  if (/rodo|zgod|dane|bezpiecz/.test(text)) lines.push(coreFacts[2]);
  if (/publik|oglosz|olx|pracuj|linkedin|zrod/.test(text)) lines.push(coreFacts[3]);
  if (/planer|kalendar|spotkan|mail|menadzer|manager|biznes|raport|ai|preselek/.test(text)) lines.push(coreFacts[4]);
  if (/sms/.test(text)) lines.push(coreFacts[5]);
  if (/prime|ultimate|wersj|pakiet/.test(text)) lines.push(coreFacts[6], coreFacts[7]);
  lines.push(...matched.map((module) => module.fact));
  return lines.join('\n').slice(0, 4200);
}
