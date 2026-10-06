// Creates a small index of public article titles and URLs, never a copy of the articles.
// Run manually: node scripts/sync-help-center.mjs
import { writeFile } from 'node:fs/promises';

const origin = 'https://pomoc.erecruiter.pl';
const start = `${origin}/pl/`;
const queued = [];
const visited = new Set();
const articles = new Map();

async function loadPage(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  const html = await response.text();
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error(`No article catalog: ${url}`);
  return JSON.parse(match[1]).props.pageProps;
}

function localUrl(raw, kind) {
  const url = new URL(raw, origin);
  if (url.hostname !== 'pomoc.erecruiter.pl' || !url.pathname.startsWith(`/pl/${kind}/`)) return null;
  return `${origin}${url.pathname}`;
}

function collect(collection) {
  if (!collection) return;
  for (const article of collection.articleSummaries || []) {
    const url = localUrl(article.url, 'articles');
    if (url && article.title) articles.set(url, {
      title: article.title.trim(), url, collection: collection.name || '',
      updated: (article.lastUpdatedDate || '').slice(0, 10),
    });
  }
  for (const child of collection.subcollections || []) {
    const url = localUrl(child.url, 'collections');
    if (url && !visited.has(url)) queued.push(url);
  }
}

const home = (await loadPage(start)).home;
for (const collection of home.collections || []) {
  const url = localUrl(collection.url, 'collections');
  if (url) queued.push(url);
}
let failures = 0;
while (queued.length) {
  const batch = queued.splice(0, 5).filter((url) => !visited.has(url));
  batch.forEach((url) => visited.add(url));
  const results = await Promise.allSettled(batch.map(loadPage));
  for (let i = 0; i < results.length; i += 1) {
    if (results[i].status === 'fulfilled') collect(results[i].value.collection);
    else { failures += 1; process.stderr.write(`${batch[i]}: ${results[i].reason}\n`); }
  }
}
if (articles.size < 150 || failures > 0) throw new Error(`Index incomplete: ${articles.size} articles, ${failures} failed collections`);
const index = [...articles.values()].sort((a, b) => a.title.localeCompare(b.title, 'pl'));
const source = `// Public article metadata from ${start}; refreshed ${new Date().toISOString().slice(0, 10)}.\n` +
  `// Text of articles is fetched only when relevant; no full articles are bundled.\n` +
  `export const helpCenterIndex = ${JSON.stringify(index, null, 2)};\n`;
await writeFile(new URL('../lib/help-center-index.js', import.meta.url), source, 'utf8');
process.stdout.write(`Indexed ${index.length} public eRecruiter articles.\n`);
