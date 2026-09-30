import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/transcribe.js';

function wav() {
  const bytes = new Uint8Array(46);
  bytes.set([82, 73, 70, 70], 0);
  bytes.set([87, 65, 86, 69], 8);
  return bytes;
}

function context(run) {
  return {
    request: new Request('https://example.com/api/transcribe', { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: wav() }),
    env: { AI: { run } },
  };
}

test('transkrypcja nie używa VAD dla krótkich fragmentów', async () => {
  let options;
  const response = await onRequestPost(context(async (_model, input) => { options = input; return { text: ' Dzień dobry ' }; }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).text, 'Dzień dobry');
  assert.equal(options.vad_filter, false);
  assert.equal(options.language, 'pl');
});

test('limit Cloudflare ma rozpoznawalny kod dla przełączenia awaryjnego', async () => {
  const response = await onRequestPost(context(async () => { throw new Error('You have used up your daily free allocation of 10,000 neurons'); }));
  assert.equal(response.status, 429);
  assert.equal((await response.json()).code, 'QUOTA');
});
