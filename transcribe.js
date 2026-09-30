const MAX_AUDIO_BYTES = 500_000;

export function onRequestGet({ env }) {
  return json({ available: Boolean(env.AI) });
}

export async function onRequestPost({ request, env }) {
  if (!env.AI) return json({ error: 'Transkrypcja Cloudflare nie jest skonfigurowana.' }, 503);
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'Niedozwolone źródło żądania.' }, 403);
  if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('audio/wav')) {
    return json({ error: 'Oczekiwano fragmentu dźwięku WAV.' }, 415);
  }
  const declaredLength = Number(request.headers.get('Content-Length') || 0);
  if (declaredLength > MAX_AUDIO_BYTES) return json({ error: 'Fragment dźwięku jest zbyt duży.' }, 413);
  const audio = await request.arrayBuffer();
  if (audio.byteLength < 44 || audio.byteLength > MAX_AUDIO_BYTES) return json({ error: 'Nieprawidłowy rozmiar dźwięku.' }, 400);
  const header = new Uint8Array(audio, 0, 12);
  if (String.fromCharCode(...header.slice(0, 4)) !== 'RIFF' || String.fromCharCode(...header.slice(8, 12)) !== 'WAVE') {
    return json({ error: 'Nieprawidłowy format dźwięku.' }, 400);
  }
  try {
    const bytes = new Uint8Array(audio);
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    }
    const result = await env.AI.run('@cf/openai/whisper-large-v3-turbo', {
      audio: btoa(binary), task: 'transcribe', language: 'pl', vad_filter: false,
      condition_on_previous_text: false,
    });
    return json({ text: typeof result?.text === 'string' ? result.text.trim().slice(0, 1000) : '' });
  } catch (problem) {
    const detail = String(problem?.message || '');
    const code = Number(problem?.code || problem?.status || 0);
    if (code === 3036 || /daily free allocation|quota|neurons|limit exceeded/i.test(detail)) {
      return json({ error: 'Wyczerpano dzienny limit transkrypcji Cloudflare. Przełączam na rozpoznawanie przeglądarki.', code: 'QUOTA' }, 429);
    }
    if (code === 3040 || /capacity|too many requests|rate limit/i.test(detail)) {
      return json({ error: 'Cloudflare jest chwilowo przeciążony. Przełączam na rozpoznawanie przeglądarki.', code: 'CAPACITY' }, 503);
    }
    console.error('Transkrypcja Workers AI:', code || 'UNKNOWN', detail.slice(0, 180));
    return json({ error: 'Cloudflare nie rozpoznał fragmentu dźwięku.', code: 'TRANSCRIPTION_FAILED' }, 502);
  }
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
