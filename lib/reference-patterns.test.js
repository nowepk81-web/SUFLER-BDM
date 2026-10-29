import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatReferencePatterns, referencePatterns, selectReferencePatterns } from './reference-patterns.js';

test('dobiera wzorzec do ostatniej rozmowy, nie samą listę dawnych przykładów', () => {
  const selected = selectReferencePatterns('VALUE', 'Klient: Mamy bazę kandydatów, ale do CV trudno potem wrócić.');
  assert.equal(selected[0].id, 'candidate-database');
  assert.equal(selected.length, 2);
  assert.equal(selectReferencePatterns('VALUE', 'Dzień dobry.')[0].id, 'named-value');
});

test('rozróżnia ograniczenie budżetowe, test i praktyczną obiekcję managerów', () => {
  assert.equal(selectReferencePatterns('PRICE', 'Mamy budżet zaplanowany na ten rok.')[0].id, 'budget-cycle');
  assert.equal(selectReferencePatterns('TEST_OR_DECISION', 'Chcemy samodzielnie przetestować system.')[0].id, 'hands-on-test');
  assert.equal(selectReferencePatterns('OBJECTION', 'Managerowie nie uzupełniają kalendarza.')[0].id, 'manager-adoption');
});

test('nie dodaje analogii bez trafienia i ogranicza liczbę wzorców', () => {
  assert.deepEqual(selectReferencePatterns('UNRELATED', 'dowolna wypowiedź'), []);
  assert.ok(selectReferencePatterns('PRICE', 'budżet, koszt, akceptacja, zarząd', '', 99).length <= 2);
  assert.equal(formatReferencePatterns([]), '(brak trafnej analogii)');
});

test('publiczna biblioteka nie zawiera danych kontaktowych ani surowych rozmów', () => {
  const serialized = JSON.stringify(referencePatterns);
  assert.doesNotMatch(serialized, /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\+48\s?\d{3}[\s-]?\d{3}[\s-]?\d{3}/i);
  assert.ok(serialized.length < 15000);
});

test('analogie z wcześniejszych rozmów wymagają właściwego kontekstu', () => {
  assert.equal(selectReferencePatterns('TEST_OR_DECISION', 'Nie będziemy mieli teraz rekrutacji, ciężko mi będzie testować.')[0].id, 'test-without-recruitment');
  assert.equal(selectReferencePatterns('TEST_OR_DECISION', 'Czy po teście automatycznie przyjdzie faktura?')[0].id, 'trial-billing-anxiety');
  assert.equal(selectReferencePatterns('PROCESS_SIGNAL', 'Selekcja jest różna w zależności od stanowiska.')[0].id, 'role-specific-selection');
  assert.equal(selectReferencePatterns('OBJECTION', 'Fajnie to wygląda, ale inni kierownicy muszą tego używać.')[0].id, 'adoption-needs-others');
  assert.ok(!selectReferencePatterns('TEST_OR_DECISION', 'Chcemy testować system.').some(({ id }) => id === 'trial-billing-anxiety'));
});

test('nowe wzorce nie mylą prośby o konkret z brakiem zainteresowania', () => {
  assert.equal(selectReferencePatterns('PRICE', 'Jesteśmy przekonani. Ile to kosztuje? Musimy przedstawić to zarządowi.')[0].id, 'convinced-needs-price-for-approval');
  assert.equal(selectReferencePatterns('PRICE', 'Czy są dodatkowe koszty wdrożenia i opłata jednorazowa?')[0].id, 'extra-costs-before-decision');
  assert.equal(selectReferencePatterns('PROCESS_SIGNAL', 'Ten kandydat byłby świetny w innym projekcie.')[0].id, 'candidate-fits-another-process');
  assert.equal(selectReferencePatterns('VALUE', 'Mamy mało rekrutacji, ale nie wyobrażam sobie pracy bez systemu.')[0].id, 'low-volume-still-values-ats');
  assert.equal(selectReferencePatterns('OBJECTION', 'Mamy mało rekrutacji i nie potrzebuję dodatkowych narzędzi.')[0].id, 'low-volume-no-need');
});
