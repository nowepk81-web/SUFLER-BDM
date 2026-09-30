const ALLOWED_REGIONS = /^[a-z0-9-]{2,40}$/;

export function onRequestGet({ env }) {
  return json({ available: Boolean(env.AZURE_SPEECH_KEY && ALLOWED_REGIONS.test(env.AZURE_SPEECH_REGION || '')) });
}

export async function onRequestPost({ request, env }) {
  if (!env.AZURE_SPEECH_KEY || !ALLOWED_REGIONS.test(env.AZURE_SPEECH_REGION || '')) {
    return json({ error: 'Transkrypcja Azure nie jest skonfigurowana.' }, 503);
  }
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'Niedozwolone źródło żądania.' }, 403);
  try {
    const response = await fetch(`https://${env.AZURE_SPEECH_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': env.AZURE_SPEECH_KEY, 'Content-Length': '0' },
    });
    if (!response.ok) return json({ error: 'Azure Speech odrzucił konfigurację lub limit usługi został wyczerpany.' }, 502);
    const token = await response.text();
    if (!token || token.length > 8000) return json({ error: 'Azure Speech nie zwrócił poprawnego tokenu.' }, 502);
    return json({ token, region: env.AZURE_SPEECH_REGION });
  } catch {
    return json({ error: 'Nie można połączyć się z Azure Speech.' }, 502);
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
