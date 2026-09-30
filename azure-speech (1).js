export async function probeAzureSpeech() {
  try {
    const response = await fetch('/api/azure-speech', { cache: 'no-store' });
    return response.ok && Boolean((await response.json()).available);
  } catch { return false; }
}

async function getToken() {
  const response = await fetch('/api/azure-speech', { method: 'POST', cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.token || !data.region) throw new Error(data.error || 'Azure Speech jest niedostępny.');
  return data;
}

export async function startAzureSpeech({ onText, onStatus, onError }) {
  const [{ token, region }, sdk] = await Promise.all([getToken(), import('microsoft-cognitiveservices-speech-sdk')]);
  const config = sdk.SpeechConfig.fromAuthorizationToken(token, region);
  config.speechRecognitionLanguage = 'pl-PL';
  const audio = sdk.AudioConfig.fromDefaultMicrophoneInput();
  const recognizer = new sdk.SpeechRecognizer(config, audio);
  let stopped = false;
  let failed = false;
  const fail = (message) => {
    if (stopped || failed) return;
    failed = true;
    onError(message || 'Azure Speech przerwał rozpoznawanie.');
  };
  recognizer.recognizing = (_sender, event) => {
    if (!stopped && event.result?.text) onStatus('Azure rozpoznaje mowę…');
  };
  recognizer.recognized = (_sender, event) => {
    if (stopped) return;
    if (event.result?.reason === sdk.ResultReason.RecognizedSpeech && event.result.text?.trim()) {
      onText(event.result.text.trim());
      onStatus('Nasłuch działa · Azure rozpoznaje mowę');
    }
  };
  recognizer.canceled = (_sender, event) => {
    if (event.reason !== sdk.CancellationReason.EndOfStream) fail('Azure Speech przerwał rozpoznawanie.');
  };
  recognizer.sessionStopped = () => { if (!stopped) fail('Sesja Azure Speech zakończyła się przedwcześnie.'); };
  const refresh = setInterval(async () => {
    if (stopped) return;
    try { recognizer.authorizationToken = (await getToken()).token; }
    catch { fail('Nie udało się odnowić połączenia z Azure Speech.'); }
  }, 8 * 60 * 1000);
  try {
    await new Promise((resolve, reject) => recognizer.startContinuousRecognitionAsync(resolve, reject));
    onStatus('Nasłuch działa · Azure rozpoznaje mowę');
  } catch (error) {
    stopped = true;
    clearInterval(refresh);
    recognizer.close();
    audio.close();
    throw new Error(`Azure Speech nie uruchomił mikrofonu: ${String(error).slice(0, 120)}`);
  }
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(refresh);
      recognizer.stopContinuousRecognitionAsync(() => recognizer.close(), () => recognizer.close());
      audio.close();
    },
  };
}
