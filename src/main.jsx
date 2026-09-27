import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, ArrowRight, Check, ChevronDown, CircleHelp, Mic, MicOff, Radio, RotateCcw, Settings2, ShieldCheck, Sparkles, X } from 'lucide-react';
import './styles.css';

const initialState = { status: 'Gotowy do spotkania', quote: null, cards: [{ label: 'JAK ZACZĄĆ', message: 'Naciśnij „Rozpocznij nasłuchiwanie”, gdy spotkanie się zacznie.', reason: 'Słucham tylko po uruchomieniu i za Twoją zgodą.', priority: 'LOW' }] };

function localCoach(text) {
  const t = text.toLocaleLowerCase('pl-PL');
  const state = (status, label, message, reason, quote = text) => ({ status, quote: quote?.slice(-220) || null, cards: [{ label, message, reason, priority: 'HIGH' }] });
  if (/za drogo|drogo|cena|koszt/.test(t)) return state('Cena · najpierw zrozum obiekcję', '🛑 NIE BROŃ CENY', 'Z czym porównuje Pani ten koszt?', 'Najpierw ustal punkt odniesienia.');
  if (/wdrażamy|kupujemy|umowę|idziemy we współpracę|proszę przygotować umowę/.test(t)) return state('Decyzja · przejdź do kolejnych kroków', '➡️ ZMIEŃ ETAP', 'Co musi się wydarzyć po Państwa stronie, żebyśmy mogli przejść dalej?', 'Klient sygnalizuje decyzję — dopnij proces.');
  if (/test|przetestować|demo/.test(t)) return state('Test · ustal kryteria sukcesu', '⭐ ZADAJ TERAZ', 'Po czym po dwóch tygodniach pozna Pani, że system rzeczywiście pomaga?', 'Test powinien potwierdzić konkretną wartość.');
  if (/świetne|ważne|potrzebujemy|pomogłoby|tego nam brakuje/.test(t)) return state('Wartość · zatrzymaj się przy niej', '🛑 STOP — ZNALAZŁEŚ WARTOŚĆ', 'Co dokładnie byłoby w tym dla Pani najważniejsze?', 'Klient sam wskazał wartość — pogłęb ją.');
  if (/nie potrzebujemy|nie jest problem|mamy to poukładane/.test(t)) return state('Ten wątek nie rezonuje', '↪️ ODPUŚĆ TEN WĄTEK', 'W takim razie gdzie widzi Pani większy potencjał usprawnienia?', 'Nie twórz sztucznego problemu.');
  if (/cv|ręcznie|czasochłonne|chaos|zabiera czasu/.test(t)) return state('Proces · poznaj skalę', '⭐ ZADAJ TERAZ', 'Jak dużo czasu to dzisiaj wymaga?', 'Nie licz korzyści za klienta — pozwól mu opisać skalę.');
  return { status: 'Rozpoznanie potrzeb · słuchaj', quote: null, cards: [{ label: '✅ SŁUCHAJ', message: 'Daj klientowi dokończyć myśl i zbierz kontekst.', reason: 'Zmieniaj sugestię dopiero, gdy pojawi się nowy sygnał.', priority: 'MEDIUM' }] };
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
  const [apiMode, setApiMode] = useState('Reguły lokalne');
  const recognizer = useRef(null);
  const transcriptRef = useRef('');
  const lastRequest = useRef(0);
  const endByUser = useRef(false);
  const wakeLock = useRef(null);
  const displayedAt = useRef(0);
  const displayedMessage = useRef('');
  const requestGeneration = useRef(0);
  const requestInFlight = useRef(false);

  // Keep the entire card, including its quote, stable while the user reads.
  const showSuggestion = useCallback((next) => {
    const message = next.cards?.[0]?.message;
    if (!message || message === displayedMessage.current) return;
    const now = Date.now();
    if (displayedAt.current && now - displayedAt.current < 30000) return;
    displayedAt.current = now;
    displayedMessage.current = message;
    setState(next);
  }, []);

  const support = useMemo(() => Boolean(window.SpeechRecognition || window.webkitSpeechRecognition), []);
  const elapsed = `${String(Math.floor(sessionSeconds / 60)).padStart(2, '0')}:${String(sessionSeconds % 60).padStart(2, '0')}`;

  const askApi = useCallback(async (context) => {
    const now = Date.now();
    if (requestInFlight.current || now - lastRequest.current < 12000) return;
    if (displayedAt.current && now - displayedAt.current < 30000) return;
    lastRequest.current = now;
    requestInFlight.current = true;
    const generation = requestGeneration.current;
    try {
      const response = await fetch('/api/coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ context }) });
      if (!response.ok) {
        const problem = await response.json().catch(() => ({}));
        if (generation !== requestGeneration.current) return;
        setApiMode('błąd połączenia');
        setError(problem.error || 'DeepSeek chwilowo nie odpowiada.');
        showSuggestion(localCoach(context.slice(-1200)));
        return;
      }
      const data = await response.json();
      if (generation !== requestGeneration.current) return;
      showSuggestion(data); setApiMode('AI połączone'); setError('');
    } catch {
      if (generation !== requestGeneration.current) return;
      setApiMode('Reguły lokalne · brak połączenia');
      showSuggestion(localCoach(context.slice(-1200)));
    } finally {
      if (generation === requestGeneration.current) requestInFlight.current = false;
    }
  }, [showSuggestion]);

  const onResult = useCallback((event) => {
    if (endByUser.current) return;
    let finalChunk = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const part = event.results[i][0]?.transcript || '';
      if (event.results[i].isFinal) finalChunk += ` ${part}`;
    }
    if (finalChunk.trim()) {
      transcriptRef.current = `${transcriptRef.current} ${finalChunk}`.trim().slice(-8000);
      setTranscript(transcriptRef.current);
      askApi(transcriptRef.current);
    }
  }, [askApi]);

  const start = useCallback(async () => {
    setError('');
    const speech = makeRecognizer();
    if (!speech) { setError('Ta przeglądarka nie obsługuje rozpoznawania mowy. Spróbuj Chrome lub Edge.'); return; }
    speech.onresult = onResult;
    speech.onerror = (event) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') setError(`Rozpoznawanie mowy: ${event.error}. Sprawdź uprawnienia mikrofonu i połączenie.`);
      if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(event.error)) {
        endByUser.current = true; setListening(false); wakeLock.current?.release?.(); wakeLock.current = null;
      }
    };
    speech.onend = () => { if (!endByUser.current) { try { speech.start(); } catch { /* browser is still transitioning */ } } else setListening(false); };
    recognizer.current = speech; endByUser.current = false;
    displayedAt.current = 0; displayedMessage.current = ''; lastRequest.current = 0;
    try {
      speech.start(); setListening(true); setState({ status: 'Nasłuchuję spotkania', quote: null, cards: [{ label: '✅ SŁUCHAJ', message: 'Spotkanie trwa. Nie przerywaj klientowi.', reason: 'Sugestie pokażą się, gdy pojawi się ważny sygnał.', priority: 'LOW' }] });
      if ('wakeLock' in navigator) wakeLock.current = await navigator.wakeLock.request('screen').catch(() => null);
    } catch { setError('Nie udało się włączyć mikrofonu. Sprawdź uprawnienia witryny i HTTPS.'); setListening(false); }
  }, [onResult]);

  const stop = useCallback(() => {
    requestGeneration.current += 1; requestInFlight.current = false;
    endByUser.current = true; recognizer.current?.stop(); recognizer.current = null;
    wakeLock.current?.release?.(); wakeLock.current = null; setListening(false); setState((current) => ({ ...current, status: 'Nasłuchiwanie zatrzymane' }));
  }, []);

  useEffect(() => {
    if (!listening) return undefined;
    const id = window.setInterval(() => setSessionSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [listening]);
  useEffect(() => () => { endByUser.current = true; recognizer.current?.stop(); wakeLock.current?.release?.(); }, []);

  const resetSession = () => { stop(); displayedAt.current = 0; displayedMessage.current = ''; lastRequest.current = 0; transcriptRef.current = ''; setTranscript(''); setSessionSeconds(0); setState(initialState); setError(''); };
  const manualPrompt = () => {
    const text = manualTopic.trim(); if (!text) return;
    setState(localCoach(text)); setTranscript(text); transcriptRef.current = text; setManualTopic('');
  };

  return <main className="app-shell">
    <header className="topbar">
      <a className="brand" href="#" aria-label="BDM Live Coach — strona główna"><span className="brand-mark"><Activity size={19}/></span><span>BDM <b>LIVE COACH</b></span></a>
      <div className="top-actions"><span className={`service-pill ${listening ? 'is-live' : ''}`}><span className="status-dot"/>{listening ? `NA ŻYWO · ${elapsed}` : 'GOTOWY'}</span><button className="icon-button" title="Ustawienia" onClick={() => setSettingsOpen(true)}><Settings2 size={19}/></button></div>
    </header>

    <section className="hero">
      <div className="eyebrow"><span className="eyebrow-line"/> ASYSTENT SPOTKAŃ B2B <span className="eyebrow-line"/></div>
      <h1>{listening ? <>Jestem na<br/><em>nasłuchu.</em></> : <>Skup się na<br/><em>rozmowie.</em></>}</h1>
      <p>{listening ? 'Analizuję przebieg spotkania. Wróć tu po krótką, konkretną podpowiedź.' : 'Cichy coach eRecruiter, który podpowiada najlepszy następny ruch.'}</p>
      <button className={`listen-button ${listening ? 'stop-button' : ''}`} onClick={listening ? stop : start}>
        <span className="listen-icon">{listening ? <MicOff size={19}/> : <Mic size={19}/>}</span>{listening ? 'Zatrzymaj nasłuchiwanie' : 'Rozpocznij nasłuchiwanie'}
      </button>
      <div className="trust-row"><span><ShieldCheck size={14}/> Bez zapisu spotkania</span><i/><span>Bez dźwięków i wibracji</span><i/><span>{apiMode}</span></div>
      {!support && <p className="browser-warning">Ta przeglądarka nie obsługuje mowy na żywo. Otwórz aplikację w Chrome.</p>}
      {error && <div className="error-banner"><CircleHelp size={17}/><span>{error}</span><button onClick={() => setError('')} aria-label="Zamknij"><X size={16}/></button></div>}
    </section>

    <section className="coach-section">
      <div className="section-heading"><div><div className="section-kicker"><Radio size={14}/> PODPOWIEDŹ NA TERAZ</div><h2>Twój następny ruch</h2></div><button className="subtle-button" onClick={resetSession} title="Nowa sesja"><RotateCcw size={15}/> Nowa sesja</button></div>
      <article className="insight-card">
        <div className="insight-top"><span className="priority-mark"><Sparkles size={15}/></span><span className="status-label">{state.status}</span><span className="live-pulse"/></div>
        {state.quote && <blockquote>„{state.quote}”</blockquote>}
        {state.cards?.slice(0, 3).map((card, index) => <div className={`suggestion ${index === 0 ? 'primary-suggestion' : ''}`} key={`${card.label}-${index}`}>
          <div className="suggestion-label">{card.label}</div><p>{card.message}</p><div className="why-line"><ArrowRight size={13}/>{card.reason}</div>
        </div>)}
        <div className="card-foot"><span><Check size={13}/> Krótko. Naturalnie. Do użycia od razu.</span><button onClick={() => setExpanded(!expanded)}>{expanded ? 'Mniej' : 'Pokaż kontekst'}<ChevronDown size={14} className={expanded ? 'rotate' : ''}/></button></div>
        {expanded && <div className="context-panel">{transcript ? transcript.slice(-1200) : 'Gdy nasłuch jest aktywny, ostatni fragment rozmowy pojawi się tutaj. Nie zapisujemy go po zakończeniu sesji.'}</div>}
      </article>
    </section>

    <section className="quick-input"><div className="quick-title"><span>ALBO</span><b>Potrzebujesz podpowiedzi od razu?</b></div><div className="input-row"><input value={manualTopic} onChange={(e) => setManualTopic(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && manualPrompt()} placeholder="Wpisz hasło lub krótki cytat klienta…"/><button onClick={manualPrompt} disabled={!manualTopic.trim()}>Podpowiedz <ArrowRight size={15}/></button></div><div className="chips">{['Cena', 'Test', 'Selekcja', 'Manager', 'RODO'].map((topic) => <button key={topic} onClick={() => { setManualTopic(topic); setState(localCoach(topic)); }}>{topic}</button>)}</div></section>

    <footer className="footer"><div className="footer-left"><span className="footer-logo">BDM / COACH</span><span>zbudowany dla lepszych rozmów</span></div><button onClick={() => setSettingsOpen(true)}><CircleHelp size={14}/> Jak to działa</button></footer>
    {settingsOpen && <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}><section className="settings-modal" onClick={(e) => e.stopPropagation()}><div className="modal-head"><div><span className="section-kicker">USTAWIENIA I PRYWATNOŚĆ</span><h3>Gotowy od razu po otwarciu.</h3></div><button className="icon-button" onClick={() => setSettingsOpen(false)}><X size={18}/></button></div><p>Nie musisz zakładać konta ani wpisywać klucza API. Aplikacja używa klucza skonfigurowanego bezpiecznie po stronie serwera Cloudflare. Przy pierwszym uruchomieniu zezwól na dostęp do mikrofonu.</p><div className="privacy-item"><ShieldCheck size={17}/><span>Klucz DeepSeek jest przechowywany jako sekret w Cloudflare, nie trafia do przeglądarki. Tekst rozmowy jest przekazywany do DeepSeek w celu wygenerowania sugestii; dostawcy usług mogą stosować własne zasady retencji.</span></div><div className="privacy-item"><Mic size={17}/><span>Aplikacja nie tworzy nagrania. Rozpoznawanie mowy przeglądarki może przekazywać audio do jej dostawcy. Nasłuch działa tylko po naciśnięciu przycisku i zgodzie na mikrofon.</span></div><button className="modal-close" onClick={() => setSettingsOpen(false)}>Gotowe</button></section></div>}
  </main>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
