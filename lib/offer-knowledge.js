// Wyłącznie ceny katalogowe z oferty dostarczonej przez użytkownika (01.04.2026).
// Nie jest to potwierdzenie funkcji, dostępności, rabatu ani warunków testu.
export const OFFER_DATE = '01.04.2026';

export const planPrices = {
  START: { price: 249, afterPromotion: 299 },
  CORE: [999, 1299, 1589, 1859, 2088, 2309, 2669, 2969, 3569, 4119, 5119, 6019, 6819, 7519, 8719, 9819, 10819],
  PRIME: [2299, 2699, 3079, 3439, 3759, 4039, 4519, 4919, 5719, 6429, 7759, 8959, 10039, 10989, 12589, 14039, 15389],
  ULTIMATE: [4999, 5499, 5979, 6429, 6829, 7179, 7779, 8279, 9279, 10189, 11849, 13349, 14689, 15879, 17879, 19689, 21379],
};

const modulePrices = [
  { keys: ['olx', 'multipublik'], fact: 'Multipublikacja Plus: 490 zł netto/mies. katalogowo; opłaty portalu mogą być osobne.' },
  { keys: ['sms'], fact: 'Pakiet komunikacji SMS: od 79 zł netto/mies. za 150 SMS.' },
  { keys: ['onboard'], fact: 'Moduł Onboardingu: od 569 zł netto/mies.' },
  { keys: ['polecen'], fact: 'Moduł Poleceń Pracowniczych: od 569 zł netto/mies.' },
  { keys: ['raport', 'insight'], fact: 'Raporty Expert z AI Insights: moduł od 449 zł netto/mies.' },
  { keys: ['stron', 'karier'], fact: 'Kreator Stron Karier / integracja: moduł od 369 zł netto/mies.' },
  { keys: ['asystent ai'], fact: 'Asystent AI: moduł od 289 zł netto/mies.' },
];

const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').toLocaleLowerCase('pl-PL');

export function formatOfferContext(signalType, context = '') {
  const text = normalize(context);
  // No price material is sent for normal coaching or product questions.
  if (signalType !== 'PRICE' && !/\b(ile kosztuje|jaka cena|jaki koszt|cennik|wycena|podaj cene)\b/.test(text)) return '';
  const lines = [
    `Źródło cen: oferta z ${OFFER_DATE}. Kwoty katalogowe netto/mies., nie indywidualna wycena. Przed podaniem klientowi potwierdź aktualność.`,
    'START 249 zł netto/mies. w promocji, później 299 zł; CORE od 999 zł; PRIME od 2299 zł; ULTIMATE od 4999 zł. Cena zależy od wariantu i liczby użytkowników.',
  ];
  const matched = modulePrices.filter((item) => item.keys.some((key) => text.includes(normalize(key)))).slice(0, 2);
  lines.push(...matched.map((item) => item.fact));
  return lines.join('\n');
}
