export async function onRequestPost({ request, env }) {
  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) return json({ error: 'Usługa AI nie została jeszcze skonfigurowana. Skontaktuj się z administratorem aplikacji.' }, 503);
  const origin = request.headers.get('Origin');
  const ownOrigin = new URL(request.url).origin;
  if (origin && origin !== ownOrigin) return json({ error: 'Niedozwolone źródło żądania.' }, 403);
  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.toLowerCase().includes('application/json')) return json({ error: 'Oczekiwano danych JSON.' }, 415);
  const declaredLength = Number(request.headers.get('Content-Length') || 0);
  if (declaredLength > 20000) return json({ error: 'Żądanie jest zbyt duże.' }, 413);
  const body = await request.json().catch(() => null);
  if (!body || typeof body.context !== 'string' || body.context.length < 3 || body.context.length > 8000) {
    return json({ error: 'Nieprawidłowy kontekst rozmowy.' }, 400);
  }
  const system = `Jesteś BDM Live Coach — dyskretnym coachem BDM prowadzącego spotkania dotyczące ATS eRecruiter. Odpowiadasz po polsku, krótko, naturalnie, gotowymi do wypowiedzenia zdaniami i formą Pani/Pan. Analizuj całą podaną rozmowę. Celem jest najlepszy jeden kolejny ruch, nie maksymalna liczba pytań. Priorytety: 1) jeśli klient rozwija ważny wątek, podaje liczby lub sam buduje business case — pokaż SŁUCHAJ i nie przerywaj; 2) gdy klient nazwie wartość, zatrzymaj się i dopytaj, dlaczego jest ważna; 3) przy niejasnej obiekcji nie broń rozwiązania, najpierw dopytaj; przy cenie pytaj „Z czym porównuje Pani/Pan ten koszt?”; 4) gdy wątek nie rezonuje, odpuść i zmień obszar; 5) gdy klient przejdzie do testu/decyzji/zakupu, zmień etap i ustal kryteria, osoby oraz następne kroki. Nie pytaj ponownie o odpowiedziane rzeczy. Nie wymyślaj funkcji eRecruitera, danych, problemów ani ROI. Transkrypcje wcześniejszych spotkań są wyłącznie wzorcem rozmowy, nie źródłem potwierdzenia funkcji. Gdy wiedza produktowa jest niepewna, powiedz, że trzeba ją potwierdzić. Jeśli handlowiec mówi za długo, powiedz STOP — ZA DUŻO MÓWISZ i podaj konkretny krótki ruch. Zwróć wyłącznie obiekt JSON: {status:string, quote:string|null, cards:[{label:string,message:string,reason:string,priority:"HIGH"|"MEDIUM"|"LOW"}]}. Maksymalnie 3 karty i reakcje łącznie. Jeśli nie ma nowego istotnego sygnału, utrzymaj poprzednią sugestię albo SŁUCHAJ.`;
  const upstream = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'deepseek-flash', temperature: 0.2, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: `Kontekst bieżącego spotkania (rozpoznawanie mowy może zawierać błędy):\n${body.context}` }] })
  });
  if (upstream.status === 401 || upstream.status === 403) return json({ error: 'DeepSeek odrzucił ten klucz API. Sprawdź go i spróbuj ponownie.' }, 401);
  if (upstream.status === 402) return json({ error: 'Konto DeepSeek wymaga doładowania lub aktywacji rozliczeń.' }, 402);
  if (!upstream.ok) return json({ error: 'Serwis AI chwilowo niedostępny.' }, 502);
  const result = await upstream.json();
  let parsed;
  try { parsed = JSON.parse(result.choices?.[0]?.message?.content || ''); } catch { return json({ error: 'Nie udało się odczytać podpowiedzi AI.' }, 502); }
  if (typeof parsed.status !== 'string' || !Array.isArray(parsed.cards)) return json({ error: 'Nieprawidłowy format odpowiedzi AI.' }, 502);
  const cards = parsed.cards.slice(0, 3).filter((card) => card && typeof card.label === 'string' && typeof card.message === 'string' && typeof card.reason === 'string')
    .map((card) => ({ label: card.label.slice(0, 70), message: card.message.slice(0, 380), reason: card.reason.slice(0, 220), priority: ['HIGH', 'MEDIUM', 'LOW'].includes(card.priority) ? card.priority : 'MEDIUM' }));
  return json({ status: parsed.status.slice(0, 130), quote: typeof parsed.quote === 'string' ? parsed.quote.slice(-240) : null, cards }, 200);
}

function json(value, status) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
