import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAnalysisQueue } from './analysis-queue.js';

function clock() {
  let time = 0, id = 0;
  const jobs = new Map();
  return {
    now: () => time,
    schedule: (fn, delay) => { jobs.set(++id, { fn, at: time + delay }); return id; },
    cancel: key => jobs.delete(key),
    async advance(ms) {
      const end = time + ms;
      while (true) {
        const next = [...jobs].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        time = next[1].at; jobs.delete(next[0]); next[1].fn();
        await Promise.resolve(); await Promise.resolve();
      }
      time = end;
    },
  };
}

test('pause analyses latest text, then trailing utterance runs without more speech', async () => {
  const timer = clock(), seen = [];
  const queue = createAnalysisQueue(async text => seen.push(text), timer);
  queue.push('Pierwszy fragment');
  await timer.advance(600);
  queue.push('Cała wypowiedź');
  await timer.advance(1200);
  assert.deepEqual(seen, ['Cała wypowiedź']);
  queue.push('Końcówka wypowiedzi');
  await timer.advance(4000);
  assert.deepEqual(seen, ['Cała wypowiedź', 'Końcówka wypowiedzi']);
  queue.push('Końcówka wypowiedzi');
  await timer.advance(4000);
  assert.equal(seen.length, 2);
});

test('speech arriving during AI request is retained; stop cancels queued work', async () => {
  const timer = clock(), seen = [];
  let release;
  const queue = createAnalysisQueue(text => {
    seen.push(text);
    return new Promise(resolve => { release = resolve; });
  }, timer);
  queue.push('A', 0); await timer.advance(0);
  queue.push('B'); await timer.advance(20000);
  assert.deepEqual(seen, ['A']);
  release(); await Promise.resolve(); await timer.advance(0);
  assert.deepEqual(seen, ['A', 'B']);
  queue.push('C'); queue.stop(); release();
  await Promise.resolve(); await timer.advance(30000);
  assert.deepEqual(seen, ['A', 'B']);
});
