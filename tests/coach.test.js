import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/coach.js';

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
