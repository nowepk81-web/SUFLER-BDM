const TARGET_SAMPLE_RATE = 16_000;
const CHUNK_SECONDS = 3.6;

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
  let worklet;
  let stopped = false;
  let sampleParts = [];
  let sampleCount = 0;
  let pending = [];
  let active = 0;
  let nextId = 0;
  let deliverId = 0;
  let previousTail = new Float32Array(0);
  const completed = new Map();
  const controllers = new Set();
  const deliver = () => {
    while (completed.has(deliverId)) {
      const result = completed.get(deliverId);
      completed.delete(deliverId++);
      if (stopped) continue;
      if (result.error) onError(result.error, result.code);
      else {
        if (result.text) onText(result.text);
        onStatus('Nasłuch działa · Cloudflare rozpoznaje mowę');
      }
    }
  };
  const sendNext = () => {
    while (!stopped && active < 2 && pending.length) {
      const item = pending.shift();
      active += 1;
      const controller = new AbortController();
      controllers.add(controller);
      const timeout = setTimeout(() => controller.abort(), 18000);
      (async () => {
        let result;
        try {
          const response = await fetch('/api/transcribe', { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: item.wav, signal: controller.signal });
          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            const problem = new Error(data.error || 'Błąd transkrypcji Cloudflare.');
            problem.code = data.code;
            throw problem;
          }
          const data = await response.json();
          result = { text: typeof data.text === 'string' ? data.text : '' };
        } catch (error) { result = { error: error.message || 'Nie udało się rozpoznać mowy.', code: error.code }; }
        finally {
          clearTimeout(timeout);
          controllers.delete(controller);
          active -= 1;
          completed.set(item.id, result);
          deliver();
          sendNext();
        }
      })();
    }
  };
  const acceptSamples = (samples) => {
    if (stopped) return;
    let energy = 0;
    for (let i = 0; i < samples.length; i += 8) energy += samples[i] * samples[i];
    const rms = Math.sqrt(energy / Math.ceil(samples.length / 8));
    if (rms < 0.00025) { previousTail = new Float32Array(0); onStatus('Mikrofon działa · cisza'); return; }
    const wav = wavFromSamples(previousTail.length ? [previousTail, samples] : [samples], context.sampleRate);
    previousTail = samples.slice(-Math.round(context.sampleRate * 0.4));
    if (pending.length >= 4) {
      const dropped = pending.shift();
      completed.set(dropped.id, { text: '' });
      deliver();
      onStatus('Transkrypcja nie nadąża · pominięto fragment');
    }
    pending.push({ id: nextId++, wav });
    onStatus('Rozpoznaję wypowiedź…');
    sendNext();
  };
  try {
    context = new AudioContextType();
    await context.resume();
    if (context.state !== 'running') throw new Error('Przeglądarka wstrzymała mikrofon. Dotknij przycisku ponownie.');
    source = context.createMediaStreamSource(stream);
    if (context.audioWorklet && window.AudioWorkletNode) {
      try {
        await context.audioWorklet.addModule('/audio-capture-worklet.js');
        worklet = new AudioWorkletNode(context, 'capture-chunks');
        worklet.port.onmessage = (event) => acceptSamples(event.data);
        source.connect(worklet);
        worklet.connect(context.destination);
      } catch { worklet?.disconnect(); worklet = null; }
    }
    if (!worklet) {
      processor = context.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (event) => {
        if (stopped) return;
        const samples = new Float32Array(event.inputBuffer.getChannelData(0));
        sampleParts.push(samples);
        sampleCount += samples.length;
        if (sampleCount < context.sampleRate * CHUNK_SECONDS) return;
        const total = new Float32Array(sampleCount);
        let offset = 0;
        for (const part of sampleParts) { total.set(part, offset); offset += part.length; }
        sampleParts = []; sampleCount = 0;
        acceptSamples(total);
      };
      source.connect(processor);
      processor.connect(context.destination);
    }
    onStatus(`Mikrofon działa · ${worklet ? 'AudioWorklet' : 'tryb zgodności'} · czekam na mowę`);
  } catch (error) {
    stopped = true;
    stream.getTracks().forEach((track) => track.stop());
    source?.disconnect(); processor?.disconnect(); worklet?.disconnect();
    await context?.close().catch(() => {});
    throw error;
  }
  return {
    stop() {
      stopped = true;
      pending = []; sampleParts = []; completed.clear();
      for (const controller of controllers) controller.abort();
      if (processor) processor.onaudioprocess = null;
      if (worklet) worklet.port.onmessage = null;
      source.disconnect(); processor?.disconnect(); worklet?.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      context.close().catch(() => {});
    },
  };
}
