import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatOfferContext, planPrices } from './offer-knowledge.js';

test('cena katalogowa i ograniczenia planów odpowiadają dostarczonej ofercie', () => {
  assert.equal(planPrices.START.price, 249);
  assert.equal(planPrices.START.afterPromotion, 299);
  assert.equal(planPrices.CORE[0], 999);
  assert.equal(planPrices.PRIME[0], 2299);
  assert.equal(planPrices.ULTIMATE[0], 4999);
  const context = formatOfferContext('PRICE', 'Proszę podać cenę systemu');
  assert.match(context, /START 249 zł/);
  assert.match(context, /CORE od 999 zł/);
  assert.match(context, /ceny katalogowe/i);
});

test('dobiera konkretny moduł bez całej oferty', () => {
  const context = formatOfferContext('MANUAL', 'Czy eRecruiter może publikować na OLX?');
  assert.match(context, /Multipublikacja Plus/);
  assert.doesNotMatch(context, /Pakiet komunikacji SMS/);
});
