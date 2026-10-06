import { helpCenterIndex } from './help-center-index.js';

const origin = 'https://pomoc.erecruiter.pl';
const generic = new Set('eRecruiter system rekrutacja rekrutacji kandydat kandydatow aplikacja aplikacji prosze mozna jakie jaki jest sa mamy temu przez oraz ktory ktora kiedy gdzie teraz pan pani klient powiedzial zrobic dziala dzialanie'.toLowerCase().split(' '));

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').toLocaleLowerCase('pl-PL');
}

function terms(value) {
  return [...new Set((normalize(value).match(/[a-z0-9]{4,}/g) || []).filter((word) => !generic.has(word)))];
}

function rank(query, item) {
  const title = normalize(item.title);
  const collection = normalize(item.collection);
  let score = 0;
  let hits = 0;
  for (const word of terms(query)) {
    const root = word.length > 6 ? word.slice(0, 6) : word;
    if (title.includes(root)) { score += 5; hits += 1; }
    else if (collection.includes(root)) score += 1;
  }
  if (!hits) return 0;
  if (/\[stara sciezka\]|archiwal/i.test(normalize(item.title))) score -= 4;
  return score + Math.min(hits, 3) + (item.updated?.startsWith('2026') ? 0.2 : 0);
}

export function selectHelpArticle(query, signalType = '') {
  // The dated offer is the source for package availability and prices.
  if (signalType === 'PRICE' && !/olx|sms|manager|formular|raport|publik|test|wdro|integrac/i.test(query)) return null;
  return helpCenterIndex.map((item) => ({ ...item, score: rank(query, item) }))
    .filter((item) => item.score >= 6)
    .sort((a, b) => b.score - a.score || b.updated.localeCompare(a.updated))[0] || null;
}

function safeArticleUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === 'pomoc.erecruiter.pl' && parsed.pathname.startsWith('/pl/articles/');
  } catch { return false; }
}

export async function loadHelpArticle(item, query, fetcher = fetch) {
  if (!item || !safeArticleUrl(item.url)) return null;
  const response = await fetcher(item.url, { signal: AbortSignal.timeout(3000) });
  if (!response.ok) return null;
  const html = await response.text();
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return null;
  const article = JSON.parse(match[1]).props?.pageProps?.articleContent;
  if (!article?.blocks || article.articleId !== item.url.match(/\/articles\/(\d+)/)?.[1]) return null;
  const queryTerms = terms(query);
  const blocks = article.blocks.map((block, index) => ({
    index,
    text: String(block.text || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ').trim(),
  })).filter((block) => block.text.length > 20 && block.text.length < 1500);
  const scored = blocks.map((block) => ({ ...block, score: queryTerms.filter((term) => normalize(block.text).includes(term.length > 6 ? term.slice(0, 6) : term)).length }));
  const best = scored.filter((block) => block.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
  const chosen = best.length ? best.sort((a, b) => a.index - b.index) : blocks.slice(0, 3);
  const excerpt = chosen.map((block) => block.text).join('\n').slice(0, 1500);
  return excerpt ? { title: article.title || item.title, url: item.url, updated: item.updated, excerpt } : null;
}

export const helpCenterUrl = origin + '/pl/';
