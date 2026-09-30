// Anonimowe, ręcznie opracowane wzorce z wcześniejszych rozmów. To nie jest
// baza klientów ani potwierdzenie funkcji produktu. Nie dodawać tu cytatów,
// nazw firm, nazwisk, danych kontaktowych ani surowych transkrypcji.
export const referencePatterns = [
  {
    id: 'named-value', signals: ['VALUE'], general: true,
    keywords: [],
    client: 'Klient sam nazywa coś użytecznym lub ważnym.',
    bdm: 'W poprzednich rozmowach BDM bywał skłonny przejść od razu do kolejnej funkcji.',
    move: 'Zatrzymaj prezentację i sprawdź, co dokładnie stanowi wartość oraz jak ważna jest ona dla decyzji.'
  },
  {
    id: 'candidate-database', signals: ['VALUE'],
    keywords: ['baza', 'kandydat', 'cv', 'ponown'],
    client: 'Klient widzi wartość w ponownym wykorzystaniu kandydatów lub porządku w ich historii.',
    bdm: 'Po takim sygnale łatwo zacząć pokazywać kolejne opcje zamiast pogłębić znaczenie.',
    move: 'Zapytaj, przy jakich rekrutacjach powrót do wcześniejszych kandydatów zrobiłby największą różnicę.'
  },
  {
    id: 'manual-work', signals: ['VALUE'],
    keywords: ['reczn', 'selekcj', 'przeglad', 'duzo cv', 'czas'],
    client: 'Klient opisuje ręczny etap lub obciążenie selekcją.',
    bdm: 'W historii pojawiały się długie opisy rozwiązania, zanim klient określił wagę sytuacji.',
    move: 'Sprawdź częstotliwość, skalę i konsekwencję własnymi słowami klienta; nie wyliczaj ROI za niego.'
  },
  {
    id: 'price-comparison', signals: ['PRICE'], general: true,
    keywords: [],
    client: 'Cena bywa zwykłą prośbą o informację, a nie od razu obiekcją. W rozmowach zdarzało się, że klient pytał o kwotę, żeby zdecydować, czy w ogóle warto kontynuować.',
    bdm: 'Odkładanie odpowiedzi i wielokrotne pytanie o punkt odniesienia może zatrzymać rozmowę.',
    move: 'Jeśli klient prosi o cenę, podaj znaną cenę katalogową lub zakres z zastrzeżeniem wariantu. Potem zapytaj tylko o jedną informację niezbędną do wyceny. Pytanie o porównanie ma sens przy rzeczywistej obiekcji „drogo”, nie jako warunek podania kwoty.'
  },
  {
    id: 'budget-cycle', signals: ['PRICE'],
    keywords: ['budzet', 'rok', 'planowan', 'srodki'],
    client: 'Klient ma budżet zaplanowany na dany okres; to może być ograniczenie terminu, nie odrzucenie wartości.',
    bdm: 'Sama propozycja tańszego wariantu nie wyjaśnia procesu budżetowego.',
    move: 'Ustal, kiedy i przez kogo będzie podejmowana najbliższa decyzja budżetowa.'
  },
  {
    id: 'external-approval', signals: ['PRICE', 'TEST_OR_DECISION'],
    keywords: ['akcept', 'zatwierdz', 'zarzad', 'decyz'],
    client: 'Osoba na spotkaniu może potrzebować zgody innej osoby lub podmiotu.',
    bdm: 'Prezentacja kolejnych funkcji nie rozwiązuje niejasności co do ścieżki akceptacji.',
    move: 'Zapytaj, kto zatwierdza wydatek i jakich argumentów potrzebuje do decyzji.'
  },
  {
    id: 'hands-on-test', signals: ['TEST_OR_DECISION'],
    keywords: ['test', 'sprawdz', 'zobacz', 'praktyc', 'samodzieln'],
    client: 'Klient może po prostu chcieć dostać dostęp i samodzielnie sprawdzić system.',
    bdm: 'Zbyt wiele pytań o kryteria przed odpowiedzią na prośbę o test zamienia pomoc w przeszkodę.',
    move: 'Najpierw odpowiedz, jak można przejść do sprawdzenia systemu, bez wymyślania warunków testu. Potem zaproponuj jedno lekkie pytanie o obszar, który warto sprawdzić; dalsze kryteria można ustalić później.'
  },
  {
    id: 'test-not-used', signals: ['TEST_OR_DECISION'],
    keywords: ['nie mial', 'nie zdaz', 'brak czasu', 'nie testow', 'przedluz'],
    client: 'Klient miał dostęp do testu, ale nie zdążył użyć go wystarczająco.',
    bdm: 'Brak użycia nie dowodzi braku wartości ani gotowości do zakupu.',
    move: 'Nie wnioskuj o braku zainteresowania. Ustal, czy klient chce kontynuować test, co mu przeszkodziło i jaki prosty krok pomoże go rzeczywiście użyć.'
  },
  {
    id: 'manager-adoption', signals: ['OBJECTION', 'IMPLEMENTATION'],
    keywords: ['manager', 'menadzer', 'kalendar', 'termin', 'dostep'],
    client: 'Klient kwestionuje praktyczne korzystanie przez managerów, np. aktualność kalendarzy.',
    bdm: 'Dalszy pokaz wariantów może ominąć sedno obiekcji dotyczącej codziennej pracy.',
    move: 'Zapytaj, jak managerowie naprawdę pracują dziś i który wariant byłby dla nich wykonalny.'
  },
  {
    id: 'one-recruiter', signals: ['VALUE', 'TEST_OR_DECISION'],
    keywords: ['jedna osoba', 'samodzieln', 'malo rekrut', 'niewiele rekrut', 'obciazen'],
    client: 'Nawet przy niewielkiej liczbie rekrutacji jedna osoba może odczuwać ciężar całego procesu.',
    bdm: 'Sama liczba projektów nie wystarcza, by ocenić wartość usprawnienia.',
    move: 'Sprawdź, który etap najbardziej obciąża tę osobę i co test powinien potwierdzić.'
  },
  {
    id: 'process-works', signals: ['OBJECTION'],
    keywords: ['pouklad', 'nie potrzeb', 'nie jest problem', 'dziala', 'wystarcz'],
    client: 'Klient uważa obecny sposób pracy za wystarczająco dobry.',
    bdm: 'Forsowanie bólu w tym samym wątku osłabia rozmowę.',
    move: 'Uznaj to i zapytaj, czy jest inny obszar, w którym usprawnienie byłoby przydatne.'
  },
  {
    id: 'other-project-dependency', signals: ['IMPLEMENTATION', 'TEST_OR_DECISION'],
    keywords: ['erp', 'projekt', 'przyszl', 'pozniej', 'termin', 'wdrozen'],
    client: 'Wdrożenie ATS może zależeć od innego projektu lub wewnętrznego harmonogramu.',
    bdm: 'Tworzenie sztucznej pilności nie usuwa zależności.',
    move: 'Ustal, co musi wydarzyć się wcześniej i kiedy warto wrócić do decyzji.'
  },
  {
    id: 'legal-uncertainty', signals: ['OBJECTION', 'IMPLEMENTATION'],
    keywords: ['rodo', 'zgod', 'prawn', 'dane', 'transkrypc'],
    client: 'Pojawia się pytanie o zgodność, zgodę lub sposób przetwarzania danych.',
    bdm: 'W dawnych rozmowach padały niezweryfikowane przypuszczenia zamiast pewnej odpowiedzi.',
    move: 'Nie improwizuj odpowiedzi prawnej ani funkcji produktu; doprecyzuj pytanie i obiecaj weryfikację.'
  },
  {
    id: 'purchase-next-step', signals: ['BUYING_SIGNAL'], general: true,
    keywords: [],
    client: 'Klient deklaruje gotowość do dalszych formalnych kroków.',
    bdm: 'Dalsze przekonywanie może spowolnić decyzję.',
    move: 'Przejdź do zakresu, osób, terminu i formalności; nie wracaj do sprzedaży zasadności.'
  },
  {
    id: 'long-presentation', signals: ['POSSIBLE_LONG_PRESENTATION'], general: true,
    keywords: [],
    client: 'Brak nowej reakcji klienta przy długiej prezentacji.',
    bdm: 'Monolog może przysłonić to, co klient uznaje za ważne.',
    move: 'Zrób pauzę i zapytaj, co z pokazanych rzeczy ma dla klienta znaczenie; tylko jeśli to rzeczywiście mówi BDM.'
  }
];

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').toLocaleLowerCase('pl-PL');
}

function hasKeyword(text, keyword) {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}`, 'u').test(text);
}

export function selectReferencePatterns(signalType, context, summary = '', limit = 2) {
  const normalizedContext = normalize(context);
  const recent = normalizedContext.slice(-900);
  const memory = normalize(summary);
  const scored = referencePatterns
    .filter((pattern) => pattern.signals.includes(signalType))
    .map((pattern) => {
      const matching = pattern.keywords.filter((keyword) => hasKeyword(normalizedContext, keyword));
      if (!matching.length && !pattern.general) return null;
      const recentHits = matching.filter((keyword) => hasKeyword(recent, keyword)).length;
      const memoryHits = pattern.keywords.filter((keyword) => hasKeyword(memory, keyword)).length;
      return { pattern, score: (pattern.general ? 1 : 3) + recentHits * 3 + (matching.length - recentHits) + Math.min(memoryHits, 2) };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(0, Math.min(Number(limit) || 0, 2))).map(({ pattern }) => pattern);
}

export function formatReferencePatterns(patterns) {
  if (!patterns.length) return '(brak trafnej analogii)';
  return patterns.map((pattern) =>
    `- Wzorzec: ${pattern.client} Ryzyko zaobserwowane u BDM: ${pattern.bdm} Możliwy ruch: ${pattern.move}`
  ).join('\n');
}
