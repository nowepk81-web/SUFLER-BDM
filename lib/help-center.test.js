import { test } from 'node:test';
import assert from 'node:assert/strict';
import { helpCenterIndex } from './help-center-index.js';
import { loadHelpArticle, selectHelpArticle } from './help-center.js';

test('publiczny indeks obejmuje działy bazy, ale nie kopiuje treści artykułów', () => {
  assert.ok(helpCenterIndex.length >= 300);
  assert.ok(helpCenterIndex.every((item) => item.url.startsWith('https://pomoc.erecruiter.pl/pl/articles/')));
  assert.ok(helpCenterIndex.every((item) => !('blocks' in item) && !('text' in item)));
});

test('dobiera artykuł o współpracy z managerem, ale nie zastępuje nim cennika', () => {
  const match = selectHelpArticle('Jaką rolę przydzielić managerowi w systemie?', 'MANUAL');
  assert.match(match.title.toLowerCase(), /manager/);
  assert.equal(selectHelpArticle('Ile kosztuje eRecruiter?', 'PRICE'), null);
});

test('pobiera tylko fragmenty z dopasowanego publicznego artykułu', async () => {
  const item = selectHelpArticle('Jaką rolę przydzielić managerowi?', 'MANUAL');
  const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { articleContent: {
    articleId: item.url.match(/\/articles\/(\d+)/)[1], title: item.title,
    blocks: [{ text: 'Manager może oceniać aplikacje kandydatów w Koncie Biznes.' }, { text: 'Inna ogólna informacja o ustawieniach i konfiguracji.' }],
  } } } })}</script>`;
  const loaded = await loadHelpArticle(item, 'Czy manager może oceniać aplikacje?', async () => new Response(html));
  assert.match(loaded.excerpt, /Manager może oceniać/);
  assert.equal(loaded.url, item.url);
  assert.equal(await loadHelpArticle({ ...item, url: 'https://example.com/private' }, 'manager'), null);
});
