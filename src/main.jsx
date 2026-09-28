import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, ArrowRight, Check, ChevronDown, CircleHelp, Mic, MicOff, Radio, RotateCcw, Settings2, ShieldCheck, Sparkles, X } from 'lucide-react';
import './styles.css';
import { createAnalysisQueue } from './analysis-queue.js';
import { detectSignal } from './signal-detector.js';
import { startCloudflareSpeech } from './cloudflare-speech.js';
import { mergeTranscript } from './transcript.js';

const quietState = { status: 'Spokojnie słucham', quote: null, cards: [{ label: 'SŁUCHAJ', message: 'Prowadź rozmowę naturalnie. Odezwę się przy ważnym sygnale.', reason: 'Bez podpowiedzi po każdym zdaniu.', priority: 'LOW' }] };
const initialState = { status: 'Gotowy do spotkania', quote: null, cards: [{ label: 'JAK ZACZĄĆ', message: 'Włącz nasłuch, gdy spotkanie się rozpocznie.', reason: 'Aplikacja poprosi o dostęp do mikrofonu.', priority: 'LOW' }] };

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
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
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

  // Keep the entire card, including its quote, stable while the user reads.
  const showSuggestion = useCallback((next) => {
    const message = next.cards?.[0]?.message;
    if (!message) return;
    if (message === displayedMessage.current) {
      clearTimeout(displayTimer.current); pendingSuggestion.current = null; return;
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
        displayedAt.current = Date.now();
        displayedMessage.current = latest.cards[0].message;
        setState(latest);
      }, 10000 - (now - displayedAt.current));
      return;
    }
    clearTimeout(displayTimer.current); pendingSuggestion.current = null;
    displayedAt.current = now;
    displayedMessage.current = message;
    setState(next);
  }, []);

  const elapsed = `${String(Math.floor(sessionSeconds / 60)).padStart(2, '0')}:${String(sessionSeconds % 60).padStart(2, '0')}`;

  const askApi = useCallback(async (payloadText, interruptSignal) => {
    let payload;
    try { payload = JSON.parse(payloadText); } catch { return; }
    const now = Date.now();
    lastRequest.current = now;
    requestInFlight.current = true;
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
        setError(problem.error || 'DeepSeek chwilowo nie odpowiada.');
        return;
      }
      const data = await response.json();
      if (generation !== requestGeneration.current) return;
      if (typeof data.memory === 'string') meetingSummary.current = data.memory.slice(0, 500);
      if (payload.signal?.priority === 'HIGH' && data.cards?.[0]) data.cards[0].priority = 'HIGH';
      if (data.notify !== false) showSuggestion(data);
      setApiMode('AI połączone'); setError('');
    } catch {
      if (generation !== requestGeneration.current) return;
      if (interruptSignal?.aborted) return;
      setApiMode('AI chwilowo niedostępne');
      setError('Nie udało się pobrać podpowiedzi AI. Nasłuch trwa; spróbuję przy kolejnym ważnym sygnale.');
    } finally {
      clearTimeout(timeout);
      interruptSignal?.removeEventListener('abort', interrupt);
      if (generation === requestGeneration.current) requestInFlight.current = false;
    }
  }, [showSuggestion]);

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
        const signal = detectSignal(merged.added) || (merged.added.length < 100 ? detectSignal(`${previous.slice(-90)} ${merged.added}`) : null);
        if (signal) {
          const topic = signal.topic || signal.type;
          const previousRequest = topicRequests.current[topic];
          const requestCount = previousRequest && now - previousRequest.time < 120000 ? Math.min(previousRequest.count + 1, 9) : 1;
          topicRequests.current[topic] = { count: requestCount, time: now };
          signal.requestCount = requestCount;
          const direct = signal.intent === 'DIRECT_REQUEST' || signal.type === 'BUYING_SIGNAL';
          const cooldown = direct && requestCount > 1 ? 0 : signal.priority === 'HIGH' ? 6000 : 20000;
          if (now - (lastSignalAt.current[topic] || 0) >= cooldown) {
            lastSignalAt.current[topic] = now;
            const context = recentUtterances.current.join('\n').slice(-3600);
            analysisQueue.current?.push(JSON.stringify({ summary: meetingSummary.current, context, signal, lastAdvice: displayedMessage.current }), signal.priority === 'HIGH' ? 0 : 650, signal.priority);
          }
        }
      }
    }
    setTranscript(transcriptRef.current);
    setInterimText('');
  }, []);

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
      acceptFinalText(finalChunk);
    }
  }, [acceptFinalText]);

  useEffect(() => {
    let active = true;
    probeCloudflare().then((available) => { if (active) setCloudflareAvailable(available); });
    return () => { active = false; };
  }, []);

  const start = useCallback(async () => {
    setError('');
    setStarting(true);
    setSpeechStatus('Sprawdzam transkrypcję i mikrofon…');
    const generation = ++startGeneration.current;
    analysisQueue.current?.stop();
    analysisQueue.current = createAnalysisQueue(askApi);
    interimRef.current = '';
    endByUser.current = false;
    displayedAt.current = 0; displayedMessage.current = ''; lastRequest.current = 0;
    recentUtterances.current = []; meetingSummary.current = ''; lastSignalAt.current = {}; topicRequests.current = {};
    finalResultCount.current = 0; recentFinals.current = []; restartAttempts.current = 0;
    transcribeFailures.current = 0;
    const useCloudflare = cloudflareAvailable === true || await probeCloudflare();
    if (generation !== startGeneration.current) return;
    setCloudflareAvailable(useCloudflare);
    if (useCloudflare) {
      try {
        const capture = await startCloudflareSpeech({
          onText: (text) => { transcribeFailures.current = 0; acceptFinalText(text); },
          onStatus: (status) => {
            setSpeechStatus(status);
            if (status.startsWith('Nasłuch działa')) { transcribeFailures.current = 0; setError(''); }
          },
          onError: (message) => {
            transcribeFailures.current += 1;
            setSpeechStatus('Błąd rozpoznawania w Cloudflare');
            setError(message);
            if (transcribeFailures.current >= 3) {
              endByUser.current = true;
              cloudflareCapture.current?.stop(); cloudflareCapture.current = null;
              analysisQueue.current?.stop(); setListening(false);
              setState((current) => ({ ...current, status: 'Nasłuch przerwany' }));
            }
          },
        });
        if (generation !== startGeneration.current || endByUser.current) { capture.stop(); return; }
        cloudflareCapture.current = capture;
        setStarting(false); setListening(true);
        setState(quietState);
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
      setError('Ta przeglądarka nie obsługuje rozpoznawania mowy, a Cloudflare AI nie jest włączone.');
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
      speech.start(); setSpeechStatus('Uruchamiam mikrofon przeglądarki…'); setState(quietState);
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
  }, [onResult, acceptFinalText, askApi, cloudflareAvailable]);

  const stop = useCallback(() => {
    startGeneration.current += 1;
    analysisQueue.current?.stop(); clearTimeout(displayTimer.current); clearTimeout(restartTimer.current); clearTimeout(startupTimer.current); pendingSuggestion.current = null;
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
  useEffect(() => () => { endByUser.current = true; startGeneration.current += 1; analysisQueue.current?.stop(); clearTimeout(displayTimer.current); clearTimeout(restartTimer.current); clearTimeout(startupTimer.current); requestGeneration.current += 1; cloudflareCapture.current?.stop(); recognizer.current?.stop(); wakeLock.current?.release?.(); }, []);

  const resetSession = () => { stop(); displayedAt.current = 0; displayedMessage.current = ''; lastRequest.current = 0; transcriptRef.current = ''; recentUtterances.current = []; meetingSummary.current = ''; lastSignalAt.current = {}; topicRequests.current = {}; setTranscript(''); setSessionSeconds(0); setState(initialState); setError(''); };
  const manualPrompt = (value = manualTopic) => {
    const text = value.trim(); if (!text) return;
    const context = [...recentUtterances.current.slice(-10), `Hasło lub pytanie BDM: ${text}`].join('\n').slice(-3600);
    const payload = JSON.stringify({ context, summary: meetingSummary.current, lastAdvice: displayedMessage.current, signal: { type: 'MANUAL', intent: 'DIRECT_REQUEST', topic: 'manual', priority: 'HIGH', requestCount: 1 } });
    if (listening) analysisQueue.current?.push(payload, 0, 'HIGH'); else askApi(payload);
    setManualTopic('');
  };

  return <main className={`app-shell ${listening ? 'live-layout' : ''}`}>
    <header className="topbar">
      <a className="brand" href="#" aria-label="BDM Live Coach — strona główna"><span className="brand-mark"><Activity size={19}/></span><span>BDM <b>LIVE COACH</b></span></a>
      <div className="top-actions"><span className={`service-pill ${listening ? 'is-live' : ''}`}><span className="status-dot"/>{listening ? `NA ŻYWO · ${elapsed}` : 'GOTOWY'}</span><button className="icon-button" title="Ustawienia" onClick={() => setSettingsOpen(true)}><Settings2 size={19}/></button></div>
    </header>

    <section className="hero">
      <div className="eyebrow"><span className="eyebrow-line"/> ASYSTENT SPOTKAŃ B2B <span className="eyebrow-line"/></div>
      {!listening && <><h1>Skup się na<br/><em>rozmowie.</em></h1><p>Cichy coach eRecruiter, który podpowiada tylko wtedy, gdy może pomóc.</p></>}
      {listening && <p className="live-summary">Nasłuch trwa. Ważna podpowiedź pozostanie widoczna, dopóki jej nie odłożysz.</p>}
      <button className={`listen-button ${listening ? 'stop-button' : ''}`} onClick={listening ? stop : start} disabled={starting}>
        <span className="listen-icon">{listening ? <MicOff size={19}/> : <Mic size={19}/>}</span>{starting ? 'Uruchamiam mikrofon…' : listening ? 'Zatrzymaj nasłuchiwanie' : 'Rozpocznij nasłuchiwanie'}
      </button>
      <div className="trust-row"><span><ShieldCheck size={14}/> Bez zapisu w aplikacji</span><i/><span>Bez dźwięków i wibracji</span><i/><span>{apiMode}</span></div>
      <p className="speech-status" role="status">{speechStatus}</p>
      {error && <div className="error-banner"><CircleHelp size={17}/><span>{error}</span><button onClick={() => setError('')} aria-label="Zamknij"><X size={16}/></button></div>}
    </section>

    <section className="coach-section">
      <div className="section-heading"><div><div className="section-kicker"><Radio size={14}/> PODPOWIEDŹ NA TERAZ</div><h2>Twój następny ruch</h2></div><button className="subtle-button" onClick={resetSession} title="Nowa sesja"><RotateCcw size={15}/> Nowa sesja</button></div>
      <article className={`insight-card ${state === quietState ? 'is-quiet' : ''}`}>
        <div className="insight-top"><span className="priority-mark"><Sparkles size={15}/></span><span className="status-label">{state.status}</span><span className="live-pulse"/></div>
        {state.quote && <blockquote>„{state.quote}”</blockquote>}
        {state.cards?.slice(0, 3).map((card, index) => <div className={`suggestion ${index === 0 ? 'primary-suggestion' : ''}`} key={`${card.label}-${index}`}>
          <div className="suggestion-label">{card.label}</div><p>{card.message}</p><div className="why-line"><ArrowRight size={13}/>{card.reason}</div>
        </div>)}
        <div className="card-foot"><span><Check size={13}/> {listening ? 'Podpowiedź zostaje na ekranie.' : 'Krótko. Naturalnie. Do użycia od razu.'}</span><div className="card-actions">{listening && state !== quietState && <button onClick={() => { clearTimeout(displayTimer.current); pendingSuggestion.current = null; displayedMessage.current = ''; setState(quietState); }}>Odłóż</button>}<button onClick={() => setExpanded(!expanded)}>{expanded ? 'Mniej' : 'Pokaż kontekst'}<ChevronDown size={14} className={expanded ? 'rotate' : ''}/></button></div></div>
        {expanded && <div className="context-panel">{transcript || interimText ? `${transcript.slice(-1200)} ${interimText}`.trim() : 'Gdy nasłuch jest aktywny, ostatni fragment rozmowy pojawi się tutaj. Nie zapisujemy go po zakończeniu sesji.'}</div>}
      </article>
    </section>

    <section className="quick-input"><div className="quick-title"><span>ALBO</span><b>Potrzebujesz podpowiedzi od razu?</b></div><div className="input-row"><input value={manualTopic} onChange={(e) => setManualTopic(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && manualPrompt()} placeholder="Wpisz hasło lub krótki cytat klienta…"/><button onClick={() => manualPrompt()} disabled={!manualTopic.trim()}>Podpowiedz <ArrowRight size={15}/></button></div><div className="chips">{['Cena', 'Test', 'Selekcja', 'Manager', 'RODO'].map((topic) => <button key={topic} onClick={() => manualPrompt(topic)}>{topic}</button>)}</div></section>

    <footer className="footer"><div className="footer-left"><span className="footer-logo">BDM / COACH</span><span>zbudowany dla lepszych rozmów</span></div><button onClick={() => setSettingsOpen(true)}><CircleHelp size={14}/> Jak to działa</button></footer>
    {settingsOpen && <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}><section className="settings-modal" onClick={(e) => e.stopPropagation()}><div className="modal-head"><div><span className="section-kicker">USTAWIENIA I PRYWATNOŚĆ</span><h3>Gotowy od razu po otwarciu.</h3></div><button className="icon-button" onClick={() => setSettingsOpen(false)}><X size={18}/></button></div><p>Nie musisz zakładać konta ani wpisywać klucza API. Aplikacja używa klucza skonfigurowanego bezpiecznie po stronie serwera Cloudflare. Przy pierwszym uruchomieniu zezwól na dostęp do mikrofonu.</p><div className="privacy-item"><ShieldCheck size={17}/><span>Klucz DeepSeek jest przechowywany jako sekret w Cloudflare, nie trafia do przeglądarki. Tekst rozmowy jest przekazywany do DeepSeek po wykryciu istotnego sygnału; dostawcy usług mogą stosować własne zasady retencji.</span></div><div className="privacy-item"><Sparkles size={17}/><span>Przy ważnym sygnale coach może wykorzystać pasujące, anonimowe wzorce z wcześniejszych rozmów. Bieżąca rozmowa ma pierwszeństwo. Surowe transkrypcje i dane klientów nie są częścią aplikacji.</span></div><div className="privacy-item"><Mic size={17}/><span>Gdy dostępna jest transkrypcja Cloudflare, krótkie fragmenty dźwięku trafiają do Workers AI bez zapisywania nagrania przez aplikację. W innym przypadku rozpoznawanie mowy przeglądarki może przekazywać audio do swojego dostawcy. Nasłuch działa tylko po naciśnięciu przycisku i zgodzie na mikrofon.</span></div><button className="modal-close" onClick={() => setSettingsOpen(false)}>Gotowe</button></section></div>}
  </main>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
