import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advicePreview } from './advice-preview.js';

test('krótka rada jest pełna, a długa ma czytelny skrót', () => {
  assert.deepEqual(advicePreview('Zapytaj, co jest najważniejsze.'), { text: 'Zapytaj, co jest najważniejsze.', shortened: false });
  const long = 'START kosztuje 249 zł netto miesięcznie. ' + 'Kolejne warunki zależą od zakresu. '.repeat(8);
  assert.deepEqual(advicePreview(long, 75), { text: 'START kosztuje 249 zł netto miesięcznie.', shortened: true });
  assert.ok(advicePreview('bardzo długa wypowiedź '.repeat(20), 75).text.endsWith('…'));
});
