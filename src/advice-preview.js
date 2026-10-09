// The full answer stays available under "Rozwiń"; the main card is glanceable.
export function advicePreview(value, maxLength = 145) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return { text, shortened: false };
  const firstSentence = text.match(/^.*?[.!?](?=\s|$)/)?.[0];
  if (firstSentence && firstSentence.length <= maxLength) return { text: firstSentence, shortened: true };
  const prefix = text.slice(0, maxLength + 1);
  const cut = prefix.lastIndexOf(' ');
  return { text: `${prefix.slice(0, cut > maxLength / 2 ? cut : maxLength).trimEnd()}…`, shortened: true };
}
