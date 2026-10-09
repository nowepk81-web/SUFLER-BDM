import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guardNextMove, onRequestPost } from '../functions/api/coach.js';

test('nie pobiera publicznej bazy wiedzy ani nie dodaje jej linku', async () => {
  const previousFetch = globalThis.fetch;
  const fetched = [];
  let aiPrompt = '';
  globalThis.fetch = async (url, options) => {
    fetched.push(String(url));
    aiPrompt = JSON.parse(options.body).messages[1].content;
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      notify: true, status: 'Manager', quote: null, memory: '',
      cards: [{ label: 'ODPOWIEDZ', message: 'Dostęp zależy od roli managera.', reason: 'Klient pyta o współpracę.', priority: 'HIGH' }],
    }) } }] }), { status: 200 });
  };
  try {
    const request = new Request('https://sufler-bdm.pages.dev/api/coach', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: 'Jaką rolę przydzielić managerowi?', signal: { type: 'MANUAL', intent: 'DIRECT_REQUEST', priority: 'HIGH' } }),
    });
    const response = await onRequestPost({ request, env: { DEEPSEEK_API_KEY: 'test-key' } });
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(fetched.length, 1);
    assert.match(fetched[0], /api\.deepseek\.com/);
    assert.doesNotMatch(aiPrompt, /PUBLICZNA BAZA WIEDZY|Artykuł:/);
    assert.equal(result.source, undefined);
  } finally { globalThis.fetch = previousFetch; }
});

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

test('cena jest jednym pełnym, szybkim do odczytania zdaniem', async () => {
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
    const message = (await response.json()).cards[0].message;
    assert.equal(message, 'START kosztuje 249 zł netto miesięcznie w promocji, później 299 zł.');
    assert.ok(message.length < 140);
  } finally { globalThis.fetch = previousFetch; }
});

test('nowy sygnał potrzeby używa wzorców, ale nie dostaje pełnej oferty', async () => {
  const previousFetch = globalThis.fetch;
  let prompt = '';
  globalThis.fetch = async (_url, options) => {
    prompt = JSON.parse(options.body).messages[1].content;
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      notify: true, status: 'Potrzeba ATS', quote: null, memory: '',
      cards: [{ label: 'DOPYTAJ', message: 'Co dziś najbardziej utrudnia pracę?', reason: 'Poznaj potrzebę.', priority: 'HIGH' }],
    }) } }] }), { status: 200 });
  };
  try {
    const request = new Request('https://sufler-bdm.pages.dev/api/coach', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: 'Potrzebujemy ATS, ale globalnie wdrażamy Workday.', signal: { type: 'NEED', priority: 'HIGH' } }),
    });
    const response = await onRequestPost({ request, env: { DEEPSEEK_API_KEY: 'test-key' } });
    assert.equal(response.status, 200);
    assert.match(prompt, /Firma może potrzebować ATS lokalnie/);
    assert.doesNotMatch(prompt, /Multipublikacja Plus|START 249 zł/);
    assert.ok((await response.json()).timings.aiMs >= 0);
  } finally { globalThis.fetch = previousFetch; }
});

test('metakomentarz AI nie trafia na kartę zamiast pytania', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
    notify: true, status: 'Ważny sygnał', quote: null, memory: '',
    cards: [{ label: 'NASTĘPNY RUCH', message: 'To ważny sygnał — klient mówi o CV. Zapytaj krótko: „Ile CV trafia do rozmowy?”', reason: 'Poznaj skalę.', priority: 'HIGH' }],
  }) } }] }), { status: 200 });
  try {
    const request = new Request('https://sufler-bdm.pages.dev/api/coach', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: 'Mamy wiele CV.', signal: { type: 'PROCESS_SIGNAL', priority: 'MEDIUM' } }),
    });
    const result = await (await onRequestPost({ request, env: { DEEPSEEK_API_KEY: 'test-key' } })).json();
    assert.equal(result.cards[0].message, 'Ile CV trafia do rozmowy?');
    assert.equal(result.cards[0].reason, '');
  } finally { globalThis.fetch = previousFetch; }
});
