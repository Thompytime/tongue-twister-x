import React, { useEffect, useRef, useState } from "react";

/**
 * TongueTwisterX (ordered cycle, extra languages, Mandarin audio support)
 *
 * Put zh-001.mp3 at: public/audio/zh-001.mp3
 */

// Tongue twisters (ordered list)
const SAMPLE_TWISTERS = [
  { id: "es-001", language: "Spanish", locale: "es-ES", flag: "🇪🇸", text: "Tres tristes tigres tragaban trigo en un trigal." },
  { id: "en-001", language: "English", locale: "en-US", flag: "🇺🇸", text: "She sells seashells by the seashore." },
  { id: "fr-001", language: "French", locale: "fr-FR", flag: "🇫🇷", text: "Un chasseur sachant chasser sait chasser sans son chien." },
  { id: "hi-001", language: "Hindi", locale: "hi-IN", flag: "🇮🇳", text: "कच्चा पापड़ा पका पापड़ा।" },
  { id: "zh-001", language: "Mandarin", locale: "zh-CN", flag: "🇨🇳", text: "四是四，十是十，十四是十四，四十是四十。", audio: "/audio/zh-001.mp3" },
  { id: "it-001", language: "Italian", locale: "it-IT", flag: "🇮🇹", text: "Trentatré trentini entrarono a Trento, tutti e trentatré trotterellando." },
  { id: "nl-001", language: "Dutch", locale: "nl-NL", flag: "🇳🇱", text: "De kat krabt de krullen van de trap." },
  { id: "de-001", language: "German", locale: "de-DE", flag: "🇩🇪", text: "Fischers Fritz fischt frische Fische, frische Fische fischt Fischers Fritz." },
  { id: "pt-001", language: "Portuguese", locale: "pt-PT", flag: "🇵🇹", text: "O rato roeu a roupa do rei de Roma." },
  { id: "fi-001", language: "Finnish", locale: "fi-FI", flag: "🇫🇮", text: "Vesihiisi sihisi hississä." },
  { id: "pl-001", language: "Polish", locale: "pl-PL", flag: "🇵🇱", text: "Chrząszcz brzmi w trzcinie w Szczebrzeszynie." },
];

// ---------- Helpers ----------
function normalizeText(s) {
  if (!s) return "";
  return s.toLowerCase().normalize("NFC").replace(/[.,!?;:()"“”'’\-—…]/g, "").replace(/\s+/g, " ").trim();
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function similarityScore(target, said) {
  const A = normalizeText(target);
  const B = normalizeText(said);
  if (!A || !B) return { score: 0, charSim: 0, wordSim: 0 };

  const dist = levenshtein(A, B);
  const maxLen = Math.max(A.length, B.length);
  const charSim = maxLen ? (1 - dist / maxLen) : 0;

  const ta = new Set(A.split(" "));
  const ba = B.split(" ");
  let hit = 0;
  for (const w of ba) if (ta.has(w)) hit++;
  const wordSim = ba.length ? hit / ba.length : 0;

  const score = Math.max(0, Math.min(1, 0.7 * charSim + 0.3 * wordSim));
  return { score, charSim, wordSim };
}

// ---------- Component ----------
export default function TongueTwisterX() {
  const [twisterIndex, setTwisterIndex] = useState(0);
  const currentTwister = SAMPLE_TWISTERS[twisterIndex];

  const [attempt, setAttempt] = useState(0);
  const [scores, setScores] = useState([]);
  const [recording, setRecording] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [permissionError, setPermissionError] = useState("");
  const [maxAttempts] = useState(6);

  const recognitionRef = useRef(null);
  const audioRef = useRef(null);
  const timeoutRef = useRef(null);

  // ---------- Recognition Setup ----------
  useEffect(() => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (audioRef.current) { try { audioRef.current.pause(); audioRef.current.currentTime = 0; } catch {} audioRef.current = null; }

    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      setPermissionError("SpeechRecognition not supported.");
      recognitionRef.current = null;
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recog = new SR();
    recog.lang = currentTwister.locale;
    recog.continuous = false;
    recog.interimResults = false;

    recog.onresult = (e) => {
      clearTimeout(timeoutRef.current);
      const transcript = e.results[0][0].transcript;
      const { score, charSim, wordSim } = similarityScore(currentTwister.text, transcript);
      setScores((prev) => [...prev, { attempt: attempt + 1, transcript, score: Math.round(score*100), charSim: Math.round(charSim*100), wordSim: Math.round(wordSim*100) }]);
      setAttempt((a) => a + 1);
      setRecording(false);
      setStatusMessage("");
    };

    recog.onerror = (e) => {
      clearTimeout(timeoutRef.current);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setPermissionError("Microphone permission denied.");
      } else if (e.error === "no-speech") {
        setStatusMessage("No speech detected.");
      } else if (e.error === "network") {
        setStatusMessage("Network issue with recognition service.");
      } else if (e.error !== "aborted") {
        setStatusMessage(`Speech recognition error: ${e.error}`);
      }
      setRecording(false);
    };

    recog.onend = () => { 
      clearTimeout(timeoutRef.current); 
      if (recording) { setRecording(false); setStatusMessage("Listening stopped."); } 
    };

    recognitionRef.current = recog;
    return () => { try { recog.abort(); clearTimeout(timeoutRef.current); } catch {} };
  }, [currentTwister.locale, currentTwister.id, attempt, recording]);

  // ---------- Handlers ----------
  const startRecording = () => {
    if (!recognitionRef.current) { setPermissionError("SpeechRecognition not available."); return; }
    try {
      setRecording(true);
      setPermissionError("");
      setStatusMessage("Listening...");
      recognitionRef.current.start();

      timeoutRef.current = setTimeout(() => {
        if (recording) {
          try { recognitionRef.current.abort(); } catch {}
          setRecording(false);
          setStatusMessage("Timed out. Please try again.");
        }
      }, 12000);
    } catch (e) {
      console.error(e);
      setPermissionError("Mic access failed.");
      setRecording(false);
      setStatusMessage("");
    }
  };

  const toggleRecording = () => {
    if (recording) {
      try { recognitionRef.current?.abort(); } catch {}
      setRecording(false);
      setStatusMessage("Stopped listening.");
    } else {
      startRecording();
    }
  };

  const playAudio = () => {
    if (currentTwister.audio) {
      if (!audioRef.current) audioRef.current = new Audio(currentTwister.audio);
      audioRef.current.play().catch(() => speakTTS());
      return;
    }
    speakTTS();
  };

  const speakTTS = () => {
    const utter = new SpeechSynthesisUtterance(currentTwister.text);
    utter.lang = currentTwister.locale;
    const all = window.speechSynthesis?.getVoices?.() || [];
    const match = all.find((v) => v.lang?.toLowerCase() === currentTwister.locale.toLowerCase());
    if (match) utter.voice = match;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  };

  const newTwister = () => {
    setTwisterIndex((prev) => (prev + 1) % SAMPLE_TWISTERS.length);
    setAttempt(0);
    setScores([]);
    setPermissionError("");
    setStatusMessage("");
  };

  const refreshTwister = () => {
    try { recognitionRef.current?.abort(); } catch {}
    clearTimeout(timeoutRef.current);
    setRecording(false);
    setStatusMessage("");
    setAttempt(0);
    setScores([]);
    setPermissionError("");
  };

  const styles = { container: { padding: 16, maxWidth: 560, margin: "auto", lineHeight: 1.4 }, card: { border: "1px solid #ddd", borderRadius: 8, padding: 12, margin: "8px 0" }, row: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "8px 0" }, button: { padding: "8px 12px", borderRadius: 8, border: "1px solid #999", background: "#f7f7f7", cursor: "pointer" }, primary: { background: "#2563eb", color: "white", border: "1px solid #1e40af" }, accent: { background: "#16a34a", color: "white", border: "1px solid #14532d" } };

  return (
    <div style={styles.container}>
      <h1>TongueTwisterX</h1>
      <h2>To play, press the Warm-up Attempt button and then read today's Twister. You have to submit a warm up attempt without being able to hear the tongue twister nor see it broken down phonetically in your own language.</h2>

      <div style={styles.card}>
        <p>Today's Twister ({currentTwister.flag} {currentTwister.language}):</p>
        <p style={{ fontWeight: "bold", fontSize: 18 }}>{currentTwister.text}</p>
      </div>

      {permissionError && <div style={{ color: "red", margin: "8px 0" }}>{permissionError}</div>}
      {statusMessage && <div style={{ color: "blue", margin: "8px 0" }}>{statusMessage}</div>}

      {attempt === 0 && (
        <div style={styles.row}>
          <button style={{ ...styles.button, ...styles.primary }} onClick={startRecording} disabled={recording}>
            {recording ? "Listening…" : "Warm-up Attempt"}
          </button>
        </div>
      )}

      {attempt > 0 && attempt < maxAttempts && (
        <div style={styles.row}>
          <button style={{ ...styles.button, ...styles.accent }} onClick={playAudio}>Hear Native</button>
          <button style={{ ...styles.button, ...styles.primary }} onClick={toggleRecording}>
            {recording ? "Stop Listening…" : `Attempt ${attempt + 1}/${maxAttempts}`}
          </button>
          <button style={styles.button} onClick={newTwister}>New Tongue Twister</button>
          <button style={styles.button} onClick={refreshTwister}>Refresh Twister</button>
        </div>
      )}

      <div>
        {scores.map((s, i) => (
          <div key={i} style={styles.card}>
            <p><strong>Attempt {s.attempt}:</strong> "{s.transcript}"</p>
            <p>Score: {s.score}% <small>(Characters: {s.charSim}%, Words: {s.wordSim}%)</small></p>
          </div>
        ))}
      </div>

      {attempt >= maxAttempts && (
        <div style={styles.card}>
          <h2>Final Score: {Math.max(...scores.map(s => s.score))}%</h2>
          <p>Come back tomorrow for a new twister!</p>
          <div style={styles.row}>
            <button style={styles.button} onClick={newTwister}>Try a New Tongue Twister</button>
          </div>
        </div>
      )}
    </div>
  );
}
