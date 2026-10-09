import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, ArrowRight, CircleHelp, Mic, MicOff, RotateCcw, Settings2, ShieldCheck, Sparkles, X } from 'lucide-react';
import './styles.css';
import { createAnalysisQueue } from './analysis-queue.js';
import { detectSignal } from './signal-detector.js';
import { startCloudflareSpeech } from './cloudflare-speech.js';
import { mergeTranscript } from './transcript.js';
import { glanceAdvice } from './glance-advice.js';

const quietState = { status: 'Słucham', quote: null, cards: [{ label: 'SŁUCHAJ', message: 'Słucham.', reason: '', priority: 'LOW' }] };
const initialState = { status: 'Gotowy', quote: null, cards: [{ label: 'START', message: 'Włącz nasłuch.', reason: '', priority: 'LOW' }] };
const emptyMetrics = () => ({ fragments: 0, asrTimed: 0, asrMs: 0, signals: 0, analyses: 0, aiResponses: 0, shown: 0, quiet: 0, stale: 0, skipped: 0, errors: 0, aiMs: 0 });

async function probeCloudflare() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch('/api/transcribe', { cache: 'no-store', signal: controller.signal });
    return response.ok && Boolean((await response.json()).available);
  } catch { return false; }
  finally { clearTimeout(timer); }
}

function makeRecognizer() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  const recognition = new SpeechRecognition();
  recognition.lang = 'pl-PL'; recognition.continuous = true; recognition.interimResults = true; recognition.maxAlternatives = 1;
  return recognition;
}

function App() {
  const [listening, setListening] = useState(false);
  const [state, setState] = useState(initialState);
  const [pastSuggestions, setPastSuggestions] = useState([]);
  const [metrics, setMetrics] = useState(emptyMetrics);
  const pastSuggestionsRef = useRef([]);
  const [autoArchive, setAutoArchive] = useState(true);
  const [ordinaryQuestions, setOrdinaryQuestions] = useState(true);
  useEffect(() => { pastSuggestionsRef.current = pastSuggestions; }, [pastSuggestions]);
  const [error, setError] = useState('');
  const [transcript, setTranscript] = useState('');
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [manualTopic, setManualTopic] = useState('');
  const [apiMode, setApiMode] = useState('AI uruchomi się po sygnale');
  const [speechStatus, setSpeechStatus] = useState('Mikrofon wyłączony');
  const [cloudflareAvailable, setCloudflareAvailable] = useState(null);
  const [starting, setStarting] = useState(false);
  const [interimText, setInterimText] = useState('');
  const recognizer = useRef(null);
  const cloudflareCapture = useRef(null);
  const startGeneration = useRef(0);
  const transcribeFailures = useRef(0);
  const transcriptRef = useRef('');
  const lastRequest = useRef(0);
  const endByUser = useRef(false);
  const wakeLock = useRef(null);
  const displayedAt = useRef(0);
  const displayedMessage = useRef('');
  const requestGeneration = useRef(0);
  const requestInFlight = useRef(false);
  const analysisQueue = useRef(null);
  const interimRef = useRef('');
  const displayTimer = useRef(null);
  const archiveTimer = useRef(null);
  const activeSuggestion = useRef(null);
  const autoArchiveRef = useRef(true);
  const ordinaryQuestionsRef = useRef(true);
  const pendingSuggestion = useRef(null);
  const finalResultCount = useRef(0);
  const recentFinals = useRef([]);
  const restartTimer = useRef(null);
  const startupTimer = useRef(null);
  const restartAttempts = useRef(0);
  const recentUtterances = useRef([]);
  const meetingSummary = useRef('');
  const lastSignalAt = useRef({});
  const topicRequests = useRef({});
  const latestSignalTime = useRef(0);
  const metricRef = useRef(emptyMetrics());
  const recordMetric = useCallback((patch) => {
    const next = { ...metricRef.current };
    for (const [key, value] of Object.entries(patch)) next[key] = (next[key] || 0) + value;
    metricRef.current = next;
    setMetrics(next);
  }, []);

  const archiveSuggestion = useCallback(() => {
    clearTimeout(archiveTimer.current);
    const current = activeSuggestion.current;
    if (!current) return;
    activeSuggestion.current = null;
    setPastSuggestions((previous) => [
      { ...current, archivedAt: Date.now() },
      ...previous.filter((item) => item.topic !== current.topic),
    ].slice(0, 8));
    setState(quietState);
  }, []);

  const displaySuggestion = useCallback((next) => {
    const previous = activeSuggestion.current;
    if (previous && previous.topic !== next.topic) {
      setPastSuggestions((items) => [{ ...previous, archivedAt: Date.now() }, ...items.filter((item) => item.topic !== previous.topic)].slice(0, 8));
    }
    activeSuggestion.current = next;
    displayedAt.current = Date.now();
    displayedMessage.current = next.cards[0].message;
    setState(next);
    clearTimeout(archiveTimer.current);
    if (autoArchiveRef.current) archiveTimer.current = setTimeout(archiveSuggestion, 60000);
  }, [archiveSuggestion]);

  // Keep the entire card, including its quote, stable while the user reads.
  const showSuggestion = useCallback((next) => {
    const message = next.cards?.[0]?.message;
    if (!message) return;
    if (activeSuggestion.current && message === displayedMessage.current) {
      clearTimeout(displayTimer.current); pendingSuggestion.current = null;
      if (next.repeatCount > (activeSuggestion.current?.repeatCount || 1)) displaySuggestion(next);
      return;
    }
    const now = Date.now();
    const urgent = next.cards?.[0]?.priority === 'HIGH';
    if (!urgent && displayedAt.current && now - displayedAt.current < 10000) {
      pendingSuggestion.current = next;
      clearTimeout(displayTimer.current);
      displayTimer.current = setTimeout(() => {
        const latest = pendingSuggestion.current;
        pendingSuggestion.current = null;
        if (!latest || endByUser.current) return;
        displaySuggestion(latest);
      }, 10000 - (now - displayedAt.current));
      return;
    }
    clearTimeout(displayTimer.current); pendingSuggestion.current = null;
    displaySuggestion(next);
  }, [displaySuggestion]);

  const elapsed = `${String(Math.floor(sessionSeconds / 60)).padStart(2, '0')}:${String(sessionSeconds % 60).padStart(2, '0')}`;

  const askApi = useCallback(async (payloadText, interruptSignal) => {
    let payload;
    try { payload = JSON.parse(payloadText); } catch { return; }
    const now = Date.now();
    lastRequest.current = now;
    requestInFlight.current = true;
    recordMetric({ analyses: 1 });
    const generation = requestGeneration.current;
    const controller = new AbortController();
    const interrupt = () => controller.abort();
    interruptSignal?.addEventListener('abort', interrupt, { once: true });
    if (interruptSignal?.aborted) controller.abort();
    const timeout = setTimeout(() => controller.abort(), 20000);
    setApiMode('Analizuję wypowiedź…');
    try {
      const response = await fetch('/api/coach', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) {
        const problem = await response.json().catch(() => ({}));
        if (generation !== requestGeneration.current) return;
        setApiMode('błąd połączenia');
        recordMetric({ errors: 1 });
        setError(problem.error || 'DeepSeek chwilowo nie odpowiada.');
        return;
      }
      const data = await response.json();
      if (generation !== requestGeneration.current) return;
      if (Number.isFinite(data.timings?.aiMs)) recordMetric({ aiMs: data.timings.aiMs, aiResponses: 1 });
      if (typeof data.memory === 'string') meetingSummary.current = data.memory.slice(0, 500);
      if ((payload.signal?.priority === 'HIGH' || payload.signal?.type === 'GENERAL_QUESTION') && data.cards?.[0]) data.cards[0].priority = 'HIGH';
      data.topic = payload.signal?.topic || payload.signal?.type || 'manual';
      data.repeatCount = payload.signal?.requestCount || 1;
      const age = Date.now() - (payload.signal?.detectedAt || now);
      const outdated = payload.signal?.type !== 'MANUAL' && (age > 22000 || (age > 8500 && latestSignalTime.current > (payload.signal?.detectedAt || now)));
      if (data.notify !== false && data.cards?.[0] && outdated) {
        recordMetric({ stale: 1 });
        setPastSuggestions((items) => [{ ...data, archivedAt: Date.now(), status: 'Wróć, jeśli temat nadal aktualny' }, ...items.filter((item) => item.topic !== data.topic)].slice(0, 8));
      } else if (data.notify !== false) { recordMetric({ shown: 1 }); showSuggestion(data); }
      else if (data.repeatCount > 1) {
        const earlier = activeSuggestion.current?.topic === data.topic ? activeSuggestion.current : pastSuggestionsRef.current.find((item) => item.topic === data.topic);
        if (earlier) showSuggestion({ ...earlier, status: 'Sygnał pojawił się ponownie', repeatCount: data.repeatCount });
      } else recordMetric({ quiet: 1 });
      setApiMode('AI połączone'); setError('');
    } catch {
      if (generation !== requestGeneration.current) return;
      if (interruptSignal?.aborted) return;
      setApiMode('AI chwilowo niedostępne');
      recordMetric({ errors: 1 });
      setError('Nie udało się pobrać podpowiedzi AI. Nasłuch trwa; spróbuję przy kolejnym ważnym sygnale.');
    } finally {
      clearTimeout(timeout);
      interruptSignal?.removeEventListener('abort', interrupt);
      if (generation === requestGeneration.current) requestInFlight.current = false;
    }
  }, [showSuggestion, recordMetric]);

  const acceptFinalText = useCallback((finalChunk) => {
    if (endByUser.current || !finalChunk.trim()) return;
    const now = Date.now();
    const normalized = finalChunk.trim().toLocaleLowerCase('pl-PL').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    recentFinals.current = recentFinals.current.filter((entry) => now - entry.time < 18000);
    const duplicate = normalized.length > 10 && recentFinals.current.some((entry) => entry.text === normalized);
    if (!duplicate) {
      const previous = recentUtterances.current.at(-1) || '';
      const merged = mergeTranscript(transcriptRef.current, finalChunk);
      if (merged.added) {
        recentFinals.current.push({ text: normalized, time: now });
        transcriptRef.current = merged.transcript;
        recentUtterances.current.push(merged.added);
        recentUtterances.current = recentUtterances.current.slice(-12);
        const earlier = recentUtterances.current.slice(-3, -1).join(' ');
        const boundarySignal = previous && !detectSignal(previous) ? detectSignal(`${previous.slice(-100)} ${merged.added.slice(0, 150)}`) : null;
        const presentation = detectSignal(`${earlier.slice(-320)} ${merged.added}`);
        const signal = detectSignal(merged.added) || boundarySignal || (presentation?.type === 'POSSIBLE_LONG_PRESENTATION' ? presentation : null);
        if (signal && (signal.type !== 'GENERAL_QUESTION' || ordinaryQuestionsRef.current)) {
          recordMetric({ signals: 1 });
          const topic = signal.topic || signal.type;
          const previousRequest = topicRequests.current[topic];
          const requestCount = previousRequest ? Math.min(previousRequest.count + 1, 9) : 1;
          topicRequests.current[topic] = { count: requestCount, time: now };
          signal.requestCount = requestCount;
          const direct = signal.intent === 'DIRECT_REQUEST' || signal.type === 'BUYING_SIGNAL';
          const cooldown = signal.type === 'GENERAL_QUESTION' ? 6000 : direct && requestCount > 1 ? 0 : signal.priority === 'HIGH' ? 6000 : 20000;
          const questionGap = signal.type !== 'GENERAL_QUESTION' || now - (lastSignalAt.current.__generalQuestion || 0) >= 6000;
          if (questionGap && now - (lastSignalAt.current[topic] || 0) >= cooldown) {
            lastSignalAt.current[topic] = now;
            latestSignalTime.current = now;
            signal.detectedAt = now;
            if (signal.type === 'GENERAL_QUESTION') lastSignalAt.current.__generalQuestion = now;
            const context = recentUtterances.current.join('\n').slice(-3600);
            analysisQueue.current?.push(JSON.stringify({ summary: meetingSummary.current, context, signal, lastAdvice: displayedMessage.current }), signal.priority === 'HIGH' ? 0 : signal.type === 'GENERAL_QUESTION' ? 150 : 650, signal.priority);
          }
        }
      }
    }
    setTranscript(transcriptRef.current);
    setInterimText('');
  }, [recordMetric]);

  const onResult = useCallback((event) => {
    if (endByUser.current) return;
    let finalChunk = '';
    let interim = '';
    // Only consume finalized result indexes once during each recognition run.
    const startIndex = Math.max(event.resultIndex, finalResultCount.current);
    for (let i = startIndex; i < event.results.length; i += 1) {
      const part = event.results[i][0]?.transcript || '';
      if (event.results[i].isFinal) {
        finalChunk += ` ${part}`;
        finalResultCount.current = i + 1;
      }
    }
    for (let i = 0; i < event.results.length; i += 1) {
      if (!event.results[i].isFinal) interim += ` ${event.results[i][0]?.transcript || ''}`;
    }
    interimRef.current = interim.trim();
    setInterimText(interimRef.current);
    if (finalChunk.trim()) {
      setSpeechStatus('Mowa rozpoznawana przez przeglądarkę');
      recordMetric({ fragments: 1 });
      acceptFinalText(finalChunk);
    }
  }, [acceptFinalText, recordMetric]);

  useEffect(() => {
    let active = true;
    probeCloudflare().then((available) => { if (active) setCloudflareAvailable(available); });
    return () => { active = false; };
  }, []);

  const start = useCallback(async ({ forceBrowser = false, preserveSession = false } = {}) => {
    setError('');
    setStarting(true);
    setSpeechStatus('Sprawdzam transkrypcję i mikrofon…');
    const generation = ++startGeneration.current;
    if (!preserveSession) {
      analysisQueue.current?.stop();
      analysisQueue.current = createAnalysisQueue(askApi, { onDiscard: () => recordMetric({ skipped: 1 }) });
    }
    interimRef.current = '';
    endByUser.current = false;
    if (!preserveSession) {
      clearTimeout(archiveTimer.current);
      activeSuggestion.current = null;
      setPastSuggestions([]);
      displayedAt.current = 0; displayedMessage.current = ''; lastRequest.current = 0;
      recentUtterances.current = []; meetingSummary.current = ''; lastSignalAt.current = {}; topicRequests.current = {};
      recentFinals.current = [];
      latestSignalTime.current = 0; metricRef.current = emptyMetrics(); setMetrics(metricRef.current);
    }
    finalResultCount.current = 0; restartAttempts.current = 0;
    transcribeFailures.current = 0;
    const useCloudflare = !forceBrowser && (cloudflareAvailable === true || await probeCloudflare());
    if (generation !== startGeneration.current) return;
    if (!forceBrowser) setCloudflareAvailable(useCloudflare);
    if (useCloudflare) {
      try {
        const capture = await startCloudflareSpeech({
          onText: (text) => { transcribeFailures.current = 0; acceptFinalText(text); },
          onTiming: ({ durationMs, success, dropped }) => {
            if (dropped) recordMetric({ skipped: 1 });
            else recordMetric({ fragments: 1, asrTimed: success ? 1 : 0, asrMs: success ? durationMs : 0, errors: success ? 0 : 1 });
          },
          onStatus: (status) => {
            setSpeechStatus(status);
            if (status.startsWith('Nasłuch działa')) { transcribeFailures.current = 0; setError(''); }
          },
          onError: (message, code) => {
            transcribeFailures.current += 1;
            setSpeechStatus('Błąd rozpoznawania w Cloudflare');
            if (code === 'QUOTA' || code === 'CAPACITY' || transcribeFailures.current >= 3) {
              cloudflareCapture.current?.stop(); cloudflareCapture.current = null;
              setCloudflareAvailable(false);
              setSpeechStatus('Sprawdzam zapasową transkrypcję…');
              setError('Cloudflare chwilowo niedostępny. Przełączam na zapasową transkrypcję.');
              start({ forceBrowser: true, preserveSession: true });
            } else {
              setSpeechStatus('Nasłuch trwa · ponawiam transkrypcję');
            }
          },
        });
        if (generation !== startGeneration.current || endByUser.current) { capture.stop(); return; }
        cloudflareCapture.current = capture;
        setStarting(false); setListening(true);
        if (!preserveSession) setState(quietState);
        if ('wakeLock' in navigator) {
          const lock = await navigator.wakeLock.request('screen').catch(() => null);
          if (endByUser.current) lock?.release?.(); else wakeLock.current = lock;
        }
      } catch (problem) {
        if (generation !== startGeneration.current) return;
        setStarting(false); setListening(false); setSpeechStatus('Mikrofon lub transkrypcja niedostępne');
        setError(problem.message || 'Nie udało się uruchomić mikrofonu. Sprawdź zgodę przeglądarki.');
      }
      return;
    }
    const speech = makeRecognizer();
    if (!speech) {
      setStarting(false); setSpeechStatus('Transkrypcja niedostępna');
      setError('Transkrypcja Cloudflare jest niedostępna, a ta przeglądarka nie obsługuje zapasowego rozpoznawania mowy.');
      return;
    }
    speech.onresult = onResult;
    speech.onspeechend = () => {
      // No API call on silence by itself; only a detected meaningful signal triggers AI.
    };
    speech.onerror = (event) => {
      clearTimeout(startupTimer.current);
      if (event.error === 'network') {
        setError('Usługa rozpoznawania mowy przeglądarki jest niedostępna. Transkrypcja Cloudflare wymaga powiązania AI w projekcie.');
      } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError(`Rozpoznawanie mowy: ${event.error}. Sprawdź uprawnienia mikrofonu.`);
      }
      if (['network', 'not-allowed', 'service-not-allowed', 'audio-capture'].includes(event.error)) {
        analysisQueue.current?.stop(); clearTimeout(displayTimer.current); requestGeneration.current += 1;
        endByUser.current = true; setListening(false); setStarting(false); setSpeechStatus('Rozpoznawanie mowy przerwane');
        setState((current) => ({ ...current, status: 'Nasłuch przerwany' }));
        wakeLock.current?.release?.(); wakeLock.current = null;
      }
    };
    speech.onstart = () => { clearTimeout(startupTimer.current); setStarting(false); setListening(true); setSpeechStatus('Mikrofon działa · czekam na mowę'); };
    speech.onaudiostart = () => setSpeechStatus('Mikrofon działa · czekam na mowę');
    speech.onend = () => {
      if (endByUser.current || recognizer.current !== speech) { setListening(false); return; }
      // Reset result indexes for the new browser recognition run, but retain
      // a short duplicate guard because Chrome may replay the last final text.
      finalResultCount.current = 0;
      const delay = Math.min(700 * (2 ** restartAttempts.current), 5000);
      restartAttempts.current = Math.min(restartAttempts.current + 1, 3);
      clearTimeout(restartTimer.current);
      restartTimer.current = setTimeout(() => {
        if (endByUser.current || recognizer.current !== speech) return;
        try { speech.start(); restartAttempts.current = 0; }
        catch { setError('Przeglądarka przerwała rozpoznawanie. Uruchom nasłuch ponownie.'); setListening(false); setSpeechStatus('Rozpoznawanie mowy przerwane'); }
      }, delay);
    };
    recognizer.current = speech;
    try {
      speech.start(); setSpeechStatus('Uruchamiam mikrofon przeglądarki…'); if (!preserveSession) setState(quietState);
      startupTimer.current = setTimeout(() => {
        if (recognizer.current !== speech || endByUser.current) return;
        endByUser.current = true;
        speech.abort();
        setStarting(false); setListening(false); setSpeechStatus('Rozpoznawanie mowy nie uruchomiło się');
        setState((current) => ({ ...current, status: 'Nasłuch przerwany' }));
        setError('Przeglądarka nie uruchomiła rozpoznawania mowy. Sprawdź mikrofon albo włącz transkrypcję Cloudflare.');
      }, 8000);
      if ('wakeLock' in navigator) {
        const lock = await navigator.wakeLock.request('screen').catch(() => null);
        if (endByUser.current) lock?.release?.(); else wakeLock.current = lock;
      }
    } catch { setError('Nie udało się włączyć mikrofonu. Sprawdź uprawnienia witryny i HTTPS.'); setListening(false); setStarting(false); setSpeechStatus('Mikrofon niedostępny'); }
  }, [onResult, acceptFinalText, askApi, cloudflareAvailable, recordMetric]);

  const stop = useCallback(() => {
    startGeneration.current += 1;
    analysisQueue.current?.stop(); clearTimeout(displayTimer.current); clearTimeout(archiveTimer.current); clearTimeout(restartTimer.current); clearTimeout(startupTimer.current); pendingSuggestion.current = null;
    requestGeneration.current += 1; requestInFlight.current = false;
    cloudflareCapture.current?.stop(); cloudflareCapture.current = null;
    endByUser.current = true; recognizer.current?.stop(); recognizer.current = null;
    wakeLock.current?.release?.(); wakeLock.current = null; setListening(false); setStarting(false); setInterimText(''); setSpeechStatus('Mikrofon wyłączony'); setState((current) => ({ ...current, status: 'Nasłuchiwanie zatrzymane' }));
  }, []);

  useEffect(() => {
    if (!listening) return undefined;
    const id = window.setInterval(() => setSessionSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [listening]);
  useEffect(() => () => { endByUser.current = true; startGeneration.current += 1; analysisQueue.current?.stop(); clearTimeout(displayTimer.current); clearTimeout(archiveTimer.current); clearTimeout(restartTimer.current); clearTimeout(startupTimer.current); requestGeneration.current += 1; cloudflareCapture.current?.stop(); recognizer.current?.stop(); wakeLock.current?.release?.(); }, []);

  const resetSession = () => { stop(); activeSuggestion.current = null; setPastSuggestions([]); displayedAt.current = 0; displayedMessage.current = ''; lastRequest.current = 0; transcriptRef.current = ''; recentUtterances.current = []; meetingSummary.current = ''; lastSignalAt.current = {}; topicRequests.current = {}; latestSignalTime.current = 0; metricRef.current = emptyMetrics(); setMetrics(metricRef.current); setTranscript(''); setSessionSeconds(0); setState(initialState); setError(''); };
  const toggleAutoArchive = () => {
    const enabled = !autoArchiveRef.current;
    autoArchiveRef.current = enabled;
    setAutoArchive(enabled);
    clearTimeout(archiveTimer.current);
    if (enabled && activeSuggestion.current) {
      const remaining = Math.max(0, 60000 - (Date.now() - displayedAt.current));
      archiveTimer.current = setTimeout(archiveSuggestion, remaining);
    }
  };
  const manualPrompt = (value = manualTopic) => {
    const text = value.trim(); if (!text) return;
    const context = [...recentUtterances.current.slice(-10), `Hasło lub pytanie BDM: ${text}`].join('\n').slice(-3600);
    const payload = JSON.stringify({ context, summary: meetingSummary.current, lastAdvice: displayedMessage.current, signal: { type: 'MANUAL', intent: 'DIRECT_REQUEST', topic: 'manual', priority: 'HIGH', requestCount: 1, detectedAt: Date.now() } });
    if (listening) analysisQueue.current?.push(payload, 0, 'HIGH'); else askApi(payload);
    setManualTopic('');
  };
  const suggestNow = () => {
    const context = recentUtterances.current.slice(-10).join('\n').slice(-3600);
    if (context.length < 3) { setError('Jeszcze nie rozpoznano wypowiedzi. Sprawdź status mikrofonu lub wpisz hasło niżej.'); return; }
    const payload = JSON.stringify({ context, summary: meetingSummary.current, lastAdvice: displayedMessage.current, signal: { type: 'MANUAL', intent: 'DIRECT_REQUEST', topic: 'manual-now', priority: 'HIGH', requestCount: 1, detectedAt: Date.now() } });
    if (listening) analysisQueue.current?.push(payload, 0, 'HIGH'); else askApi(payload);
  };

  return <main className={`app-shell ${listening ? 'live-layout' : ''}`}>
    <header className="topbar">
      <a className="brand" href="#" aria-label="BDM Live Coach — strona główna"><span className="brand-mark"><Activity size={19}/></span><span>BDM <b>LIVE COACH</b></span></a>
      <div className="top-actions"><span className={`service-pill ${listening ? 'is-live' : ''}`}><span className="status-dot"/>{listening ? `NA ŻYWO · ${elapsed}` : 'GOTOWY'}</span><button className="icon-button" title="Ustawienia" onClick={() => setSettingsOpen(true)}><Settings2 size={19}/></button></div>
    </header>

    <section className="hero">
      <div className="eyebrow"><span className="eyebrow-line"/> ASYSTENT SPOTKAŃ B2B <span className="eyebrow-line"/></div>
      {!listening && <><h1>Skup się na<br/><em>rozmowie.</em></h1><p>Cichy coach eRecruiter, który podpowiada tylko wtedy, gdy może pomóc.</p></>}
      {listening && <p className="live-summary">Nasłuch trwa. Podpowiedź po minucie zmniejszy się i pozostanie niżej na ekranie.</p>}
      <button className={`listen-button ${listening ? 'stop-button' : ''}`} onClick={listening ? stop : () => start()} disabled={starting}>
        <span className="listen-icon">{listening ? <MicOff size={19}/> : <Mic size={19}/>}</span>{starting ? 'Uruchamiam mikrofon…' : listening ? 'Zatrzymaj nasłuchiwanie' : 'Rozpocznij nasłuchiwanie'}
      </button>
      <div className="trust-row"><span><ShieldCheck size={14}/> Bez zapisu w aplikacji</span><i/><span>Bez dźwięków i wibracji</span><i/><span>{apiMode}</span></div>
      <p className="speech-status" role="status">{speechStatus}</p>
      {error && <div className="error-banner"><CircleHelp size={17}/><span>{error}</span><button onClick={() => setError('')} aria-label="Zamknij"><X size={16}/></button></div>}
    </section>

    <section className="coach-section">
      <div className="section-heading"><h2>Teraz</h2><div className="heading-actions"><button className="suggest-now" onClick={suggestNow} disabled={!listening && !recentUtterances.current.length}><Sparkles size={15}/> Podpowiedz teraz</button><button className="subtle-button" onClick={resetSession} title="Nowa sesja"><RotateCcw size={15}/> Nowa sesja</button></div></div>
      <article className={`insight-card glance-card ${state === quietState ? 'is-quiet' : ''} ${state.repeatCount > 1 ? 'is-repeated' : ''}`} aria-live="polite">
        {state.repeatCount > 1 && <span className="repeat-chip">↻ Powtórzony temat</span>}
        <p className="glance-message">{glanceAdvice(state.cards?.[0]?.message, state.topic === 'price' ? 120 : 95)}</p>
        {listening && activeSuggestion.current && <button className="dismiss-advice" onClick={() => { clearTimeout(displayTimer.current); pendingSuggestion.current = null; archiveSuggestion(); }}>Odłóż</button>}
      </article>
      {pastSuggestions.length > 0 && <section className="past-signals" aria-label="Wcześniejsze podpowiedzi"><div className="past-signals-title">Wcześniej · {pastSuggestions.length}</div>{pastSuggestions.map((item, index) => <div className={`past-signal glance-history ${item.repeatCount > 1 ? 'is-repeated' : ''}`} key={`${item.topic}-${index}`}><span>{item.repeatCount > 1 ? '↻ ' : ''}{glanceAdvice(item.cards?.[0]?.message, item.topic === 'price' ? 120 : 95)}</span></div>)}</section>}
      <details className="context-debug"><summary>Kontekst (opcjonalnie)</summary><div className="context-panel">{transcript || interimText ? `${transcript.slice(-1200)} ${interimText}`.trim() : 'Ostatni fragment rozmowy pojawi się tutaj po włączeniu nasłuchu.'}</div></details>
    </section>

    <section className="quick-input"><div className="quick-title"><span>ALBO</span><b>Potrzebujesz podpowiedzi od razu?</b></div><div className="input-row"><input value={manualTopic} onChange={(e) => setManualTopic(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && manualPrompt()} placeholder="Wpisz hasło lub krótki cytat klienta…"/><button onClick={() => manualPrompt()} disabled={!manualTopic.trim()}>Podpowiedz <ArrowRight size={15}/></button></div><div className="chips">{['Cena', 'Test', 'Selekcja', 'Manager', 'RODO'].map((topic) => <button key={topic} onClick={() => manualPrompt(topic)}>{topic}</button>)}</div></section>

    <footer className="footer"><div className="footer-left"><span className="footer-logo">BDM / COACH · v2.9</span><span>zbudowany dla lepszych rozmów</span></div><button onClick={() => setSettingsOpen(true)}><CircleHelp size={14}/> Jak to działa</button></footer>
    {settingsOpen && <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}><section className="settings-modal" onClick={(e) => e.stopPropagation()}>
      <div className="modal-head"><div><span className="section-kicker">USTAWIENIA I PRYWATNOŚĆ</span><h3>Gotowy od razu po otwarciu.</h3></div><button className="icon-button" onClick={() => setSettingsOpen(false)}><X size={18}/></button></div>
      <p>Nie musisz zakładać konta ani wpisywać klucza API. Przy pierwszym uruchomieniu zezwól na dostęp do mikrofonu.</p>
      <label className="question-mode"><input type="checkbox" checked={ordinaryQuestions} onChange={(event) => { ordinaryQuestionsRef.current = event.target.checked; setOrdinaryQuestions(event.target.checked); }}/><span>Reaguj także na zwykłe pytania podczas rozmowy</span></label>
      <label className="question-mode"><input type="checkbox" checked={autoArchive} onChange={toggleAutoArchive}/><span>Przenoś podpowiedź do historii po 60 sekundach</span></label>
      <div className="privacy-item"><ShieldCheck size={17}/><span>Klucz DeepSeek pozostaje w Cloudflare. Audio trafia do usługi transkrypcji, a ostatni kontekst do DeepSeek po sygnale lub naciśnięciu „Podpowiedz teraz”. Dostawcy mogą stosować własne zasady retencji.</span></div>
      <div className="privacy-item"><Sparkles size={17}/><span>Coach korzysta z anonimowych analiz wcześniejszych rozmów, nie z surowych transkrypcji. Ceny katalogowe pochodzą wyłącznie z oferty z 01.04.2026. Funkcje i warunki trzeba potwierdzić; publiczna baza wiedzy nie jest pobierana.</span></div>
      <div className="privacy-item"><Mic size={17}/><span>Cloudflare rozpoznaje krótkie fragmenty audio; po awarii działa zapasowy mechanizm przeglądarki. Aplikacja nie zapisuje nagrania ani historii po zamknięciu karty.</span></div>
      <div className="diagnostics"><strong>Diagnostyka bieżącej karty (bez treści rozmowy)</strong><span>Fragmenty: {metrics.fragments} · sygnały: {metrics.signals} · analizy: {metrics.analyses}</span><span>Karty: {metrics.shown} · cisza AI: {metrics.quiet} · spóźnione: {metrics.stale} · pominięte: {metrics.skipped} · błędy: {metrics.errors}</span><span>Średni czas transkrypcji: {metrics.asrTimed ? Math.round(metrics.asrMs / metrics.asrTimed / 100) / 10 : '—'} s · odpowiedź AI: {metrics.aiResponses ? Math.round(metrics.aiMs / metrics.aiResponses / 100) / 10 : '—'} s</span></div>
      <button className="modal-close" onClick={() => setSettingsOpen(false)}>Gotowe</button>
    </section></div>}
  </main>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
