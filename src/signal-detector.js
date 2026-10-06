// Tani filtr kandydatów do analizy. Nie podejmuje decyzji za coacha: mówca
// może być nieznany, a transkrypcja może zawierać błędy.
const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').toLocaleLowerCase('pl-PL').replace(/\s+/g, ' ').trim();

function found(text, pattern) { return pattern.test(text); }

export function detectSignal(utterance) {
  const raw = String(utterance || '').trim();
  if (raw.length < 5) return null;
  const text = normalize(raw);
  const signal = (type, priority, intent = 'MENTION', topic = type) => ({ type, priority, intent, topic });

  if (found(text, /\b(kupujemy|wdrazamy|jestesmy zdecydowani|podjelismy decyzje|idziemy we wspolprace|prosze (przygotowac|przeslac|wyslac) umow[ey]|podpiszmy umowe|akceptujemy oferte)\b/)) {
    return signal('BUYING_SIGNAL', 'HIGH', 'COMMITMENT', 'decision');
  }

  const priceQuestion = found(text, /\b(ile (to|system|e ?recruiter|abonament)? ?kosztuje|jaka (jest |bedzie )?cena|jaki (jest )?koszt|ile (za|placimy)|za ile|kwota abonamentu)\b/) || found(text, /\b(czy|prosze|chce|poprosze|mozna|moglibyscie)\b.{0,90}\b(cen\w*|koszt\w*|wycen\w*)\b/);
  const priceObjection = found(text, /\b(za drogo|droz[sz]\w*|cena (jest |wydaje sie )?(za )?wysoka|koszt (jest |wydaje sie )?(za )?wysoki|koszty? wdrozenia (sa |jest )?(zbyt |za )?wysok\w*|nie mamy budzetu|nie stac nas)\b/);
  const priceMention = found(text, /\b(cen[ayęieo]?|koszt\w*|abonament\w*|wycen\w*|budzet\w*)\b/);
  const hiringCostOnly = found(text, /\b(wynagrodzen\w*|pensj\w*|zarobk\w*|stawki kandydat\w*|budzet na stanowisk\w*)\b/) && !found(text, /\b(system\w*|e ?recruiter\w*|abonament\w*|ofert[ayę]|wycen\w*)\b/);
  if (priceQuestion || priceObjection || (priceMention && !hiringCostOnly && found(text, /\b(system\w*|e ?recruiter\w*|abonament\w*|ofert[ayę]|wycen\w*)\b/))) {
    return signal('PRICE', 'HIGH', priceQuestion ? 'DIRECT_REQUEST' : priceObjection ? 'OBJECTION' : 'MENTION', 'price');
  }

  const testRequest = found(text, /\b(chce|chcialabym|chcialbym|mozemy|moge|prosze|poprosze|dostane|otrzymam|czy jest)\b.{0,55}\b(test\w*|przetest\w*|dostep\w* (?:do )?(?:systemu|wersji testowej)|demo)\b|\b(test\w*|przetest\w*)\b.{0,40}\b(chce|mozemy|moge|prosze|poprosze|dostane|otrzymam)\b/);
  if (testRequest) return signal('TEST_OR_DECISION', 'HIGH', 'DIRECT_REQUEST', 'test');

  const objection = found(text, /\b(nie potrzebujemy|nie jest (to )?problem|mamy to poukladane|to nam niepotrzebne|nie przekonuje|nie zadziala|nie mamy (dzis |dzisiaj |teraz )?czasu na wdrozenie|obawiam sie|watpliwosc\w*|za duzo pracy|nie ma sensu|nie widze wartosci)\b/);
  if (objection) return signal('OBJECTION', 'HIGH', 'OBJECTION', 'objection');

  const implementation = found(text, /\b(wdrozenie|uruchomienie|szkolenia|ilu uzytkownik\w*|kiedy (mozemy|moglibysmy) (zaczac|uruchomic)|jak dlugo trwa wdrozenie|kto bedzie mial dostep)\b/);
  if (implementation) return signal('IMPLEMENTATION', 'HIGH', /\?|\b(kiedy|jak|ilu|kto)\b/.test(text) ? 'DIRECT_REQUEST' : 'MENTION', 'implementation');

  if (raw.length >= 230 && found(text, /\b(pokaze|pokazemy|prosze zobaczyc|w systemie mamy|mamy mozliwosc|funkcjonalnosc|nastepnie|kolejnym etapem)\b/)) {
    return signal('POSSIBLE_LONG_PRESENTATION', 'MEDIUM', 'MONOLOGUE_CANDIDATE', 'presentation');
  }

  const value = found(text, /\b(to (jest|byloby|brzmi) (dla nas )?(bardzo |naprawde )?(wazne|przydatne|sensownie|swietne)|to nam (pomoze|pomogloby|ulatwi|ulatwiloby)|tego (wlasnie )?potrzebujemy|tego nam brakuje|to rozwiazuje|bardzo nam zalezy|przydaloby nam sie|to by mi pomoglo|zabiera (nam )?(bardzo )?duzo czasu)\b/);
  if (value) return signal('VALUE', 'HIGH', 'VALUE_CLAIM', 'value');

  if (found(text, /\b(testowac|przetestowac|kryteria (wyboru|sukcesu)|porownujemy (systemy|ats)|proces decyzyjny)\b/)) {
    return signal('TEST_OR_DECISION', 'MEDIUM', 'MENTION', 'test');
  }

  if (found(text, /\b(robimy to recznie|robimy recznie|przepisujemy do excela|wklejamy do excela|duzo cv|setki cv|\d{2,4} cv|nie nadazamy|gubimy kandydat\w*)\b/)) {
    return signal('PROCESS_SIGNAL', 'MEDIUM', 'PROCESS_FACT', 'process');
  }
  // ASR often omits the question mark. Catch ordinary questions too, but skip
  // technical small talk; DeepSeek still decides whether the speaker needs help.
  const ordinaryQuestion = /(?:^|[.!?]\s*|\ba\s+|\bprosze\s+(?:powiedziec|wyjasnic)\s+|\bchcial(?:abym|bym)\s+zapytac\s+)(?:czy|jak|jaka|jaki|jakie|kiedy|gdzie|ile|dlaczego|ktory|ktora|ktore|w jaki sposob|co|po co)\b/.test(text) || raw.endsWith('?');
  const smallTalk = /\b(slychac|widac (mnie|ekran)|dzien dobry|jak sie pan(?:i)? ma|czy polaczenie dziala)\b/.test(text);
  if (ordinaryQuestion && !smallTalk && text.split(' ').length >= 4) {
    return signal('GENERAL_QUESTION', 'MEDIUM', 'DIRECT_REQUEST', `question:${text.slice(0, 90)}`);
  }
  return null;
}
