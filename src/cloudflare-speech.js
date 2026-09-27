const TARGET_SAMPLE_RATE = 16_000;
const CHUNK_SECONDS = 5;

function wavFromSamples(parts, sampleRate) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const input = new Float32Array(total);
  let position = 0;
  for (const part of parts) { input.set(part, position); position += part.length; }
  const ratio = sampleRate / TARGET_SAMPLE_RATE;
  const length = Math.floor(input.length / ratio);
  const wav = new ArrayBuffer(44 + length * 2);
  const view = new DataView(wav);
  const writeString = (at, value) => { for (let i = 0; i < value.length; i += 1) view.setUint8(at + i, value.charCodeAt(i)); };
  writeString(0, 'RIFF'); view.setUint32(4, 36 + length * 2, true); writeString(8, 'WAVE');
  writeString(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, TARGET_SAMPLE_RATE, true);
  view.setUint32(28, TARGET_SAMPLE_RATE * 2, true); view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); writeString(36, 'data'); view.setUint32(40, length * 2, true);
  for (let i = 0; i < length; i += 1) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.max(start + 1, Math.floor((i + 1) * ratio)));
    let sum = 0;
    for (let j = start; j < end; j += 1) sum += input[j];
    const sample = Math.max(-1, Math.min(1, sum / (end - start)));
    view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return wav;
}

export async function startCloudflareSpeech({ onText, onStatus, onError }) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Mikrofon wymaga bezpiecznego połączenia HTTPS i zgody przeglądarki.');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true }, video: false });
  const AudioContextType = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextType) { stream.getTracks().forEach((track) => track.stop()); throw new Error('Brak obsługi nagrywania dźwięku.'); }
  let context;
  let source;
  let processor;
  let stopped = false;
  let sampleParts = [];
  let sampleCount = 0;
  let pending = [];
  let sending = false;
  const controllers = new Set();
  const sendNext = async () => {
    if (sending || stopped || !pending.length) return;
    sending = true;
    const wav = pending.shift();
    const controller = new AbortController();
    controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch('/api/transcribe', { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: wav, signal: controller.signal });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Błąd transkrypcji Cloudflare.');
      }
      const data = await response.json();
      if (!stopped && data.text) onText(data.text);
      if (!stopped) onStatus('Nasłuch działa · Cloudflare rozpoznaje mowę');
    } catch (error) {
      if (!stopped) onError(error.message || 'Nie udało się rozpoznać mowy.');
    } finally {
      clearTimeout(timeout);
      controllers.delete(controller);
      sending = false;
      if (!stopped) sendNext();
    }
  };
  try {
    context = new AudioContextType();
    await context.resume();
    if (context.state !== 'running') throw new Error('Przeglądarka wstrzymała mikrofon. Dotknij przycisku ponownie.');
    source = context.createMediaStreamSource(stream);
    processor = context.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (event) => {
      if (stopped) return;
      const samples = new Float32Array(event.inputBuffer.getChannelData(0));
      sampleParts.push(samples);
      sampleCount += samples.length;
      if (sampleCount < context.sampleRate * CHUNK_SECONDS) return;
      const wav = wavFromSamples(sampleParts, context.sampleRate);
      sampleParts = []; sampleCount = 0;
      if (pending.length >= 2) pending.shift();
      pending.push(wav);
      onStatus('Przesyłam krótki fragment do rozpoznania…');
      sendNext();
    };
    source.connect(processor);
    processor.connect(context.destination);
    onStatus('Mikrofon działa · czekam na pierwszy fragment');
  } catch (error) {
    stopped = true;
    stream.getTracks().forEach((track) => track.stop());
    source?.disconnect(); processor?.disconnect();
    await context?.close().catch(() => {});
    throw error;
  }
  return {
    stop() {
      stopped = true;
      pending = []; sampleParts = [];
      for (const controller of controllers) controller.abort();
      processor.onaudioprocess = null;
      source.disconnect(); processor.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      context.close().catch(() => {});
    },
  };
}
