import React, { useEffect, useRef, useState } from "react";

// Sample tongue twisters
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
  { id: "pl-001", language: "Polish", locale: "pl-PL", flag: "🇵🇱", text: "Stół z powyłamywanymi nogami." },
];

// ... keep normalizeText, levenshtein, similarityScore as before ...

export default function TongueTwisterX() {
  const [index, setIndex] = useState(0); // ✅ start at first twister
  const [currentTwister, setCurrentTwister] = useState(SAMPLE_TWISTERS[0]);
  const [attempt, setAttempt] = useState(0);
  const [scores, setScores] = useState([]);
  const [recording, setRecording] = useState(false);
  const [permissionError, setPermissionError] = useState("");
  const recognitionRef = useRef(null);
  const audioRef = useRef(null);

  // Update recognition when currentTwister changes
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

  // ✅ Rotate through all twisters in order
  const newTwister = () => {
    const nextIndex = (index + 1) % SAMPLE_TWISTERS.length;
    setIndex(nextIndex);
    setCurrentTwister(SAMPLE_TWISTERS[nextIndex]);
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
