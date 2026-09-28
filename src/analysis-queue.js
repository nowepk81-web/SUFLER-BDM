// Keep the most important pending event. An urgent event can interrupt a slower,
// lower-priority AI request; ordinary dialogue never overwrites it.
export function createAnalysisQueue(run, {
  now = Date.now, schedule = setTimeout, cancel = clearTimeout,
  interval = 4000, pause = 650,
} = {}) {
  const weight = (priority) => ({ HIGH: 2, MEDIUM: 1, LOW: 0 })[priority] ?? 1;
  let timer, pending = null, previous = '', last = -Infinity, busy = false, stopped = false;
  let currentAbort = null, currentPriority = 'LOW';
  function arm(delay) {
    cancel(timer);
    if (!stopped && pending && !busy) {
      const cooldown = pending.priority === 'HIGH' ? 0 : last + interval - now();
      timer = schedule(flush, Math.max(delay, cooldown, 0));
    }
  }
  async function flush() {
    if (stopped || busy || !pending) return;
    const { text, priority } = pending;
    pending = null;
    if (text === previous) return;
    busy = true; previous = text; last = now(); currentPriority = priority;
    const abort = new AbortController();
    currentAbort = abort;
    try { await run(text, abort.signal); }
    catch { /* The caller reports a recoverable network error if needed. */ }
    finally { busy = false; currentAbort = null; arm(0); }
  }
  return {
    push(text, delay = pause, priority = 'MEDIUM') {
      if (stopped) return;
      const cleaned = String(text || '').trim();
      if (!cleaned) return;
      if (!pending || weight(priority) >= weight(pending.priority)) pending = { text: cleaned, priority };
      if (busy && weight(priority) > weight(currentPriority)) currentAbort?.abort();
      arm(priority === 'HIGH' ? 0 : delay);
    },
    stop() { stopped = true; pending = null; cancel(timer); currentAbort?.abort(); },
  };
}
