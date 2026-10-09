import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectSignal } from './signal-detector.js';

test('detects priority sales moments and stays quiet on ordinary dialogue', () => {
  assert.equal(detectSignal('To jest dla nas naprawdę ważne').type, 'VALUE');
  assert.equal(detectSignal('To dla nas za drogo').priority, 'HIGH');
  assert.equal(detectSignal('Koszty wdrożenia są zbyt wysokie').type, 'PRICE');
  assert.equal(detectSignal('Kiedy możemy rozpocząć wdrożenie?').type, 'IMPLEMENTATION');
  assert.equal(detectSignal('Dzień dobry, słyszymy się dobrze'), null);
  assert.equal(detectSignal(`Proszę zobaczyć w systemie, mamy możliwość ${'pokazać kolejne etapy rekrutacji '.repeat(9)}`).type, 'POSSIBLE_LONG_PRESENTATION');
});

test('rozpoznaje wprost powtórzone pytania i nie myli ceny produktu z wynagrodzeniem', () => {
  assert.deepEqual(detectSignal('Czy może mi Pan wreszcie podać cenę?'), { type: 'PRICE', priority: 'HIGH', intent: 'DIRECT_REQUEST', topic: 'price' });
  assert.equal(detectSignal('Chciałabym dostać test systemu.').intent, 'DIRECT_REQUEST');
  assert.equal(detectSignal('Proszę przesłać umowę.').type, 'BUYING_SIGNAL');
  assert.equal(detectSignal('To brzmi sensownie, przydałoby nam się.').type, 'VALUE');
  assert.equal(detectSignal('Nie mamy dziś czasu na wdrożenie.').type, 'OBJECTION');
  assert.equal(detectSignal('Mam budżet na wynagrodzenia kandydatów.'), null);
  assert.equal(detectSignal('Przeglądamy 400 CV ręcznie.').type, 'PROCESS_SIGNAL');
});

test('zwykłe pytania także uruchamiają analizę, bez znaku zapytania z ASR', () => {
  assert.deepEqual(detectSignal('Czy manager może ocenić kandydata w systemie'), {
    type: 'GENERAL_QUESTION', priority: 'MEDIUM', intent: 'DIRECT_REQUEST',
    topic: 'question:czy manager moze ocenic kandydata w systemie',
  });
  assert.equal(detectSignal('A jak działa wyszukiwanie kandydatów').type, 'GENERAL_QUESTION');
  assert.equal(detectSignal('Jak działa połączenie z kalendarzem?').type, 'GENERAL_QUESTION');
  assert.equal(detectSignal('Czy mnie dobrze słychać?'), null);
  assert.equal(detectSignal('Dzień dobry, słyszymy się dobrze'), null);
});

test('wykrywa naturalne sygnały spotkania bez zakładania mówcy', () => {
  assert.equal(detectSignal('Budzi to mój niepokój, kiedy wysyłamy CV mailem').type, 'OBJECTION');
  assert.equal(detectSignal('Potrzebujemy na gwałt jakiegoś ATS-u').type, 'NEED');
  assert.equal(detectSignal('To jest super').type, 'VALUE');
  assert.equal(detectSignal('Podoba mi się, że to wszystko jest w jednym miejscu').type, 'VALUE');
  assert.equal(detectSignal('To jest szybsza obsługa i nie muszę się zastanawiać').type, 'VALUE');
  assert.equal(detectSignal('W Excelu zbieramy status procesu').type, 'PROCESS_SIGNAL');
  assert.equal(detectSignal('Mamy globalnie Workday jako ATS').type, 'OBJECTION');
});
