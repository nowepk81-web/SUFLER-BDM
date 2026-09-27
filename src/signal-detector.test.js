import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectSignal } from './signal-detector.js';

test('detects priority sales moments and stays quiet on ordinary dialogue', () => {
  assert.equal(detectSignal('To jest dla nas naprawdę ważne').type, 'VALUE');
  assert.equal(detectSignal('To dla nas za drogo').priority, 'HIGH');
  assert.equal(detectSignal('Koszty wdrożenia są zbyt wysokie').type, 'PRICE');
  assert.equal(detectSignal('Kiedy możemy rozpocząć wdrożenie?').type, 'IMPLEMENTATION');
  assert.equal(detectSignal('Dzień dobry, słyszymy się dobrze'), null);
  assert.equal(detectSignal(`Proszę zobaczyć w systemie, mamy możliwość ${'pokazać kolejne etapy rekrutacji '.repeat(9)}`).type, 'POSSIBLE_LONG_PRESENTATION');
});
