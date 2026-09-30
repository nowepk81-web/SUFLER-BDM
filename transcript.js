function words(value) {
  return String(value || '').trim().split(/\s+/u).filter(Boolean);
}

function normalized(word) {
  return word.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').toLocaleLowerCase('pl-PL').replace(/[^\p{L}\p{N}]/gu, '');
}

// Batch ASR often repeats the end of the previous fragment. Return only the
// genuinely new tail; never persist or transmit the duplicate prefix.
export function mergeTranscript(current, incoming, maxChars = 8000) {
  const oldText = String(current || '').trim();
  const nextText = String(incoming || '').trim();
  if (!nextText) return { transcript: oldText, added: '' };
  if (!oldText) return { transcript: nextText.slice(-maxChars), added: nextText };
  const prior = words(oldText).slice(-80).map(normalized);
  const fresh = words(nextText);
  const freshNormalized = fresh.map(normalized);
  let overlap = 0;
  for (let size = Math.min(prior.length, fresh.length); size >= 2; size -= 1) {
    if (prior.slice(-size).every((word, index) => word === freshNormalized[index])) {
      overlap = size;
      break;
    }
  }
  const normalizedTail = prior.join(' ');
  const normalizedIncoming = freshNormalized.join(' ');
  if (normalizedIncoming.length > 10 && normalizedTail.endsWith(normalizedIncoming)) overlap = fresh.length;
  const added = fresh.slice(overlap).join(' ').trim();
  return { transcript: added ? `${oldText} ${added}`.slice(-maxChars) : oldText, added };
}
