import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guardNextMove, onRequestPost } from '../functions/api/coach.js';

test('do DeepSeek trafia tylko bieżący kontekst i trafna anonimowa analogia', async () => {
  const previousFetch = globalThis.fetch;
  let upstreamBody;
  globalThis.fetch = async (_url, options) => {
    upstreamBody = JSON.parse(options.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      notify: true, status: 'Budżet do ustalenia', quote: 'Mamy budżet zaplanowany', memory: 'Budżet jest zaplanowany.',
      cards: [{ label: 'DOPYTAJ', message: 'Kiedy zapada kolejna decyzja budżetowa?', reason: 'Poznaj termin.', priority: 'HIGH' }]
    }) } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const request = new Request('https://sufler-bdm.pages.dev/api/coach', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: 'Mamy budżet zaplanowany na ten rok.', summary: '', signal: { type: 'PRICE', priority: 'HIGH' } })
    });
    const response = await onRequestPost({ request, env: { DEEPSEEK_API_KEY: 'test-key' } });
    assert.equal(response.status, 200);
    const prompt = upstreamBody.messages[1].content;
    assert.match(prompt, /Mamy budżet zaplanowany na ten rok/);
    assert.match(prompt, /decyzja budżetowa|decyzję budżetową/);
    assert.doesNotMatch(prompt, /aktualność kalendarzy|ponownym wykorzystaniu kandydatów/);
    assert.equal((await response.json()).cards.length, 1);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('powtórzona prośba o cenę nie wpada w pętlę pytań', () => {
  const result = guardNextMove({
    signal: { type: 'PRICE', intent: 'DIRECT_REQUEST', requestCount: 2 },
    lastAdvice: 'Z czym porównuje Pani ten koszt?', notify: true,
    cards: [{ label: 'DOPYTAJ', message: 'Z czym porównuje Pani ten koszt?', reason: 'Wyjaśnij.', priority: 'HIGH' }],
  });
  assert.equal(result.notify, true);
  assert.match(result.cards[0].message, /249 zł/);
  assert.doesNotMatch(result.cards[0].message, /Z czym porównuje/);
});

test('prośba o test nie jest blokowana obowiązkowymi kryteriami', () => {
  const result = guardNextMove({
    signal: { type: 'TEST_OR_DECISION', intent: 'DIRECT_REQUEST', requestCount: 1 },
    lastAdvice: '', notify: true,
    cards: [{ label: 'DOPYTAJ', message: 'Po czym Pani pozna, że test się udał?', reason: 'Ustal kryteria.', priority: 'HIGH' }],
  });
  assert.equal(result.notify, true);
  assert.match(result.cards[0].message, /sprawdzenia systemu/);
  assert.doesNotMatch(result.cards[0].message, /Po czym/);
});

test('pełna odpowiedź o cenie nie jest ucinana po 120 znakach', async () => {
  const previousFetch = globalThis.fetch;
  const fullAnswer = 'START kosztuje 249 zł netto miesięcznie w promocji, później 299 zł. CORE zaczyna się od 999 zł. Ostateczny wariant dobierzemy do liczby użytkowników i potrzebnych funkcji.';
  globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
    notify: true, status: 'Cena', quote: null, memory: '',
    cards: [{ label: 'ODPOWIEDZ', message: fullAnswer, reason: 'Klient zapytał wprost o cenę.', priority: 'HIGH' }],
  }) } }] }), { status: 200 });
  try {
    const request = new Request('https://sufler-bdm.pages.dev/api/coach', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: 'Ile kosztuje system?', signal: { type: 'PRICE', intent: 'DIRECT_REQUEST', priority: 'HIGH' } }),
    });
    const response = await onRequestPost({ request, env: { DEEPSEEK_API_KEY: 'test-key' } });
    assert.equal((await response.json()).cards[0].message, fullAnswer);
  } finally { globalThis.fetch = previousFetch; }
});
