// Keep the latest utterance even when it arrives during a request or cooldown.
export function createAnalysisQueue(run, {
  now = Date.now, schedule = setTimeout, cancel = clearTimeout,
  interval = 4000, pause = 850,
} = {}) {
  let timer, pending = '', previous = '', last = -Infinity, busy = false, stopped = false;
  function arm(delay) {
    cancel(timer);
    if (!stopped && pending && !busy) timer = schedule(flush, Math.max(delay, last + interval - now(), 0));
  }
  async function flush() {
    if (stopped || busy || !pending) return;
    const text = pending;
    pending = '';
    if (text === previous) return;
    busy = true; previous = text; last = now();
    try { await run(text); }
    finally { busy = false; arm(0); }
  }
  return {
    push(text, delay = pause) {
      if (stopped) return;
      pending = text.trim();
      arm(delay);
    },
    stop() { stopped = true; pending = ''; cancel(timer); },
  };
}
