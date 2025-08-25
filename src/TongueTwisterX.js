import React, { useEffect, useRef, useState } from "react";

// Sample tongue twisters
const SAMPLE_TWISTERS = [
  { id: "es-001", language: "Spanish", locale: "es-ES", flag: "🇪🇸", text: "Tres tristes tigres tragaban trigo en un trigal." },
  { id: "en-001", language: "English", locale: "en-US", flag: "🇺🇸", text: "She sells seashells by the seashore." },
  { id: "fr-001", language: "French", locale: "fr-FR", flag: "🇫🇷", text: "Un chasseur sachant chasser sait chasser sans son chien." },
  { id: "hi-001", language: "Hindi", locale: "hi-IN", flag: "🇮🇳", text: "Kacchā pāpṛā pakā pāpṛā." },
  { id: "zh-001", language: "Mandarin", locale: "zh-CN", flag: "🇨🇳", text: "四是四，十是十，十四是十四，四十是四十。", audio: "/audio/zh-001.mp3" },
];

// Helper functions
function normalizeText(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
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
  const charSim = 1 - dist / maxLen;

  const ta = new Set(A.split(" "));
  const ba = B.split(" ");
  let hit = 0;
  for (const w of ba) if (ta.has(w)) hit++;
  const wordSim = ba.length ? hit / ba.length : 0;

  const score = Math.max(0, Math.min(1, 0.7 * charSim + 0.3 * wordSim));

  return { score, charSim, wordSim };
}

// Main component
export default function TongueTwisterX() {
  const [currentTwister, setCurrentTwister] = useState(() => SAMPLE_TWISTERS[Math.floor(Math.random() * SAMPLE_TWISTERS.length)]);
  const [attempt, setAttempt] = useState(0);
  const [scores, setScores] = useState([]);
  const [recording, setRecording] = useState(false);
  const [permissionError, setPermissionError] = useState("");
  const recognitionRef = useRef(null);
  const audioRef = useRef(null);

  // Initialize SpeechRecognition
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      setPermissionError("SpeechRecognition not supported. Only scoring by text match available.");
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recog = new SR();
    recog.lang = currentTwister.locale;
    recog.continuous = false;
    recog.interimResults = false;
    recog.onresult = e => {
      const transcript = e.results[0][0].transcript;
      const { score, charSim, wordSim } = similarityScore(currentTwister.text, transcript);
      setScores(prev => [...prev, { attempt: attempt + 1, transcript, score: Math.round(score * 100), charSim: Math.round(charSim * 100), wordSim: Math.round(wordSim * 100) }]);
      setAttempt(a => a + 1);
      setRecording(false);
    };
    recog.onerror = e => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setPermissionError("Microphone permission denied. Please allow mic access in your browser settings.");
      } else {
        setPermissionError(`Speech recognition error: ${e.error}`);
      }
      setRecording(false);
    };
    recognitionRef.current = recog;
  }, [currentTwister, attempt]);

  const startRecording = () => {
    if (!recognitionRef.current) {
      setPermissionError("SpeechRecognition not available in this browser.");
      return;
    }
    try {
      setRecording(true);
      setPermissionError("");
      recognitionRef.current.start();
    } catch (e) {
      console.error(e);
      setPermissionError("Mic access failed. Ensure you're on HTTPS and allow microphone permissions.");
      setRecording(false);
    }
  };

  const playAudio = () => {
    if (currentTwister.audio) {
      if (!audioRef.current) audioRef.current = new Audio(currentTwister.audio);
      audioRef.current.play();
    } else {
      const utter = new SpeechSynthesisUtterance(currentTwister.text);
      utter.lang = currentTwister.locale;
      speechSynthesis.speak(utter);
    }
  };

  const newTwister = () => {
    const nextTwister = SAMPLE_TWISTERS[Math.floor(Math.random() * SAMPLE_TWISTERS.length)];
    setCurrentTwister(nextTwister);
    setAttempt(0);
    setScores([]);
    setPermissionError("");
  };

  return (
    <div style={{ padding: "16px", maxWidth: "500px", margin: "auto" }}>
      <h1>TongueTwisterX</h1>
      <h2>To play, press the Warm-up Attempt button and then read today's Twister. You have to submit a warm up attempt without being able to hear the tongue twister nor see it broken down phonetically in your own language.</h2>

      <p>Today's Twister ({currentTwister.flag} {currentTwister.language}):</p>
      <p style={{ fontWeight: "bold" }}>{currentTwister.text}</p>

      {permissionError && <div style={{ color: "red" }}>{permissionError}</div>}

      {attempt === 0 && (
        <div>
          <button onClick={startRecording} disabled={recording}>
            {recording ? "Listening…" : "Warm-up Attempt"}
          </button>
        </div>
      )}

      {attempt > 0 && attempt < 6 && (
        <div>
          <button onClick={playAudio} style={{ marginRight: "8px" }}>Hear Native</button>
          <button onClick={startRecording} disabled={recording}>
            {recording ? "Listening…" : `Attempt ${attempt + 1}/6`}
          </button>
          <button onClick={newTwister} style={{ marginLeft: "8px" }}>New Tongue Twister</button>
        </div>
      )}

      <div>
        {scores.map((s, i) => (
          <div key={i} style={{ border: "1px solid #ccc", padding: "8px", margin: "8px 0" }}>
            <p><strong>Attempt {s.attempt}:</strong> "{s.transcript}"</p>
            <p>Score: {s.score}% (Characters: {s.charSim}%, Words: {s.wordSim}%)</p>
          </div>
        ))}
      </div>

      {attempt >= 6 && (
        <div style={{ padding: "16px", border: "1px solid #000" }}>
          <h2>Final Score: {Math.max(...scores.map(s => s.score))}%</h2>
          <p>Come back tomorrow for a new twister!</p>
          <button onClick={newTwister}>Try a New Tongue Twister</button>
        </div>
      )}
    </div>
  );
}
