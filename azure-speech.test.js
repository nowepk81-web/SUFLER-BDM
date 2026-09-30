import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet, onRequestPost } from '../functions/api/azure-speech.js';

test('Azure jest pomijany, jeśli brakuje klucza lub regionu', async () => {
  assert.deepEqual(await onRequestGet({ env: {} }).json(), { available: false });
  const response = await onRequestPost({ request: new Request('https://example.com/api/azure-speech', { method: 'POST' }), env: {} });
  assert.equal(response.status, 503);
});

test('nie przyjmuje żądania tokenu z innego pochodzenia', async () => {
  const response = await onRequestPost({
    request: new Request('https://example.com/api/azure-speech', { method: 'POST', headers: { Origin: 'https://obca.example' } }),
    env: { AZURE_SPEECH_KEY: 'test', AZURE_SPEECH_REGION: 'westeurope' },
  });
  assert.equal(response.status, 403);
});

test('nie tworzy adresu usługi z niepoprawnego regionu', async () => {
  assert.deepEqual(await onRequestGet({ env: { AZURE_SPEECH_KEY: 'test', AZURE_SPEECH_REGION: 'x.example/path' } }).json(), { available: false });
});
