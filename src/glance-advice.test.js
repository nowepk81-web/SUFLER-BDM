import { test } from 'node:test';
import assert from 'node:assert/strict';
import { glanceAdvice } from './glance-advice.js';

test('pokazuje gotowe pytanie zamiast metakomentarza', () => {
  assert.equal(glanceAdvice('To ważny sygnał — dużo czasu na przeglądanie CV. Zapytaj krótko: „Ile z tych 150 CV trafia do rozmowy?”'), 'Ile z tych 150 CV trafia do rozmowy?');
  assert.equal(glanceAdvice('Zapytaj: „Co zmieniłoby to w codziennej pracy?”'), 'Co zmieniłoby to w codziennej pracy?');
});

test('nie ukrywa krótkiej rady i ogranicza wielozdaniowy komentarz', () => {
  assert.equal(glanceAdvice('Nie pokazuj kolejnej funkcji. Zatrzymaj się.'), 'Nie pokazuj kolejnej funkcji. Zatrzymaj się.');
  assert.equal(glanceAdvice('Zapytaj, co jest dla Pani ważne. Potem przejdź do kolejnego obszaru. '.repeat(3)), 'Zapytaj, co jest dla Pani ważne.');
});
