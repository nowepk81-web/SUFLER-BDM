const signals = [
  { type: 'PRICE', priority: 'HIGH', pattern: /\b(cen\w*|koszt\w*|drogo|drogo|droz\w*|taniej|budzet\w*|wycen\w*)\b/i },
  { type: 'OBJECTION', priority: 'HIGH', pattern: /\b(nie potrzebujemy|nie jest problem|mamy to poukladane|watpliwosc\w*|obawiam sie|nie przekonuje|nie zadziala|za duzo pracy)\b/i },
  { type: 'BUYING_SIGNAL', priority: 'HIGH', pattern: /\b(kupujemy|wdraz\w*|idziemy we wspolprace|przygotowac umow\w*|podpisac umow\w*|kiedy mozemy zaczac)\b/i },
  { type: 'IMPLEMENTATION', priority: 'HIGH', pattern: /\b(wdrozen\w*|szkolen\w*|uruchom\w*|termin startu|ilu uzytkownik\w*)\b/i },
  { type: 'VALUE', priority: 'HIGH', pattern: /\b(to jest (?:dla nas )?(?:naprawde )?wazne|to byloby wazne|to nam pomoze|tego potrzebujemy|swietne|tego nam brakuje|to rozwiazuje|bardzo nam zalezy|duzo czasu|recznie|reczna selekcja|mamy chaos)\b/i },
  { type: 'TEST_OR_DECISION', priority: 'MEDIUM', pattern: /\b(testowac|przetestowac|kryteria sukcesu|porownujemy systemy|kto podejmuje decyzje|proces decyzyjny)\b/i },
];

export function detectSignal(utterance) {
  const text = String(utterance || '').trim();
  if (!text) return null;
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pl-PL');
  if (text.length >= 260 && /\b(pokaze|pokazemy|prosze zobaczyc|w systemie mamy|mamy mozliwosc|funkcjonalnosc|nastepnie|kolejnym etapem)\b/i.test(normalized)) {
    return { type: 'POSSIBLE_LONG_PRESENTATION', priority: 'MEDIUM' };
  }
  const match = signals.find((signal) => signal.pattern.test(normalized));
  return match ? { type: match.type, priority: match.priority } : null;
}
