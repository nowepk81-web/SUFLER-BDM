// One visible, usable move. The live UI never hides the rest behind a click.
export function glanceAdvice(value, maxLength = 95) {
  let text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const quotedMove = text.match(/(?:zapytaj|zadaj|powiedz|odpowiedz)[^„”"]{0,28}[„"]([^„”"]{8,145})[”"]/i);
  if (quotedMove) text = quotedMove[1].trim();
  text = text
    .replace(/^(?:(?:to |klient(?:ka)? (?:właśnie )?)?(?:ważny|mocny) sygnał|wartość została potwierdzona)[^.!?]*[.!—:]\s*/i, '')
    .replace(/^(?:zapytaj|zadaj pytanie|powiedz|odpowiedz)(?: krótko| teraz)?\s*[:—-]\s*/i, '')
    .trim();
  if (text.length <= maxLength) return text;
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)/g);
  if (sentences) {
    const first = sentences[0].trim();
    if (first.length <= maxLength) return first;
  }
  const firstClause = text.slice(0, maxLength + 1);
  const cut = firstClause.lastIndexOf(' ');
  return `${firstClause.slice(0, cut > maxLength / 2 ? cut : maxLength).trimEnd()}…`;
}
