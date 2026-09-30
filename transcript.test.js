import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeTranscript } from './transcript.js';

test('usuwa powtórzony początek kolejnej transkrypcji Cloudflare', () => {
  const first = mergeTranscript('', 'Dzień dobry, proszę pana');
  const second = mergeTranscript(first.transcript, 'proszę pana, mamy bardzo dużo CV');
  assert.equal(second.transcript, 'Dzień dobry, proszę pana mamy bardzo dużo CV');
  assert.equal(second.added, 'mamy bardzo dużo CV');
  assert.equal(mergeTranscript(second.transcript, 'mamy bardzo dużo CV').added, '');
});

test('nie usuwa odmiennej wypowiedzi i zachowuje limit znaków', () => {
  const result = mergeTranscript('Spotkanie trwa', 'To jest nowy temat', 22);
  assert.equal(result.added, 'To jest nowy temat');
  assert.ok(result.transcript.length <= 22);
});
