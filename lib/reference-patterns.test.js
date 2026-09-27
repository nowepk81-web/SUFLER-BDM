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

test('publiczna biblioteka nie zawiera wskazanych nazw klientów ani surowych rozmów', () => {
  const serialized = JSON.stringify(referencePatterns);
  assert.doesNotMatch(serialized, /Przemysław|Kuźnicki|Sosnowski|Navitel|Polent|Port Północny|Belin|JAF|DLH/i);
  assert.ok(serialized.length < 15000);
});
