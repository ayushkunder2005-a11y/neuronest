import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
const API = "http://localhost:8003";



/* ═══════════════════════════════════════════════════════════════
   AI VOICE TUTOR — JARVIS-STYLE VOICE-ONLY INTERFACE
   No chat. Just speak, listen, and learn.
   ═══════════════════════════════════════════════════════════════ */
export default function AiVoiceTutor() {
  const navigate = useNavigate();

  /* ── State ────────────────────────────────────────────────── */
  const [status, setStatus] = useState("idle"); // idle | listening | thinking | speaking
  const [transcript, setTranscript] = useState("");
  const [aiText, setAiText] = useState("");
  const [history, setHistory] = useState([]); // {role, content}[]
  const [chatId, setChatId] = useState("");
  const [pdfs, setPdfs] = useState([]);
  const [showPdfPanel, setShowPdfPanel] = useState(false);
  const [statusLabel, setStatusLabel] = useState("Tap the mic to start talking");

  /* ── Lesson mode (break-by-break PDF teaching) ──────── */
  const [lessonId, setLessonId] = useState("");
  const [lessonSections, setLessonSections] = useState([]);
  const [currentSection, setCurrentSection] = useState(0);
  const [totalSections, setTotalSections] = useState(0);
  const [lessonActive, setLessonActive] = useState(false);
  const [lessonComplete, setLessonComplete] = useState(false);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonLoading, setLessonLoading] = useState(false);

  const synthRef = useRef(window.speechSynthesis);
  const recognitionRef = useRef(null);
  const abortRef = useRef(null);
  const fileInputRef = useRef(null);
  const pendingUtterRef = useRef(null);

  /* ── Mode system ─────────────────────────────────────────── */
  const [currentMode, setCurrentMode] = useState("LEARN");
  const MODE_CONFIG = {
    LEARN: { emoji: "📚", label: "Learn Mode" },
    QUIZ:  { emoji: "📝", label: "Quiz Mode" },
    FOCUS: { emoji: "🎯", label: "Focus Mode" },
    THINK: { emoji: "💡", label: "Think Mode" },
    REVIEW:{ emoji: "🔄", label: "Review Mode" },
  };
  const MODE_ALIASES = {
    think: "THINK", thinking: "THINK",
    learn: "LEARN", learning: "LEARN", teach: "LEARN",
    quiz: "QUIZ", test: "QUIZ", question: "QUIZ",
    focus: "FOCUS", concentrate: "FOCUS",
    review: "REVIEW", revise: "REVIEW", recall: "REVIEW",
  };
  const detectModeCommand = (text) => {
    const lower = text.toLowerCase().trim();
    const patterns = [
      /(?:activate|switch\s+to|use|go\s+to|enable|start|set)\s+(\w+)\s+mode/i,
      /^(\w+)\s+mode$/i,
    ];
    for (const pattern of patterns) {
      const match = lower.match(pattern);
      if (match) {
        const key = match[1].toLowerCase();
        if (MODE_ALIASES[key]) return MODE_ALIASES[key];
      }
    }
    return null;
  };

  /* ── Load PDFs ───────────────────────────────────────────── */
  const loadPdfs = useCallback(async () => {
    try { const r = await fetch(`${API}/pdfs`); const d = await r.json(); setPdfs(d.pdfs || []); } catch {}
  }, []);
  useEffect(() => { loadPdfs(); }, [loadPdfs]);

  /* ── Cleanup ─────────────────────────────────────────────── */
  useEffect(() => () => {
    synthRef.current?.cancel();
    recognitionRef.current?.abort?.();
    abortRef.current?.abort();
  }, []);

  /* ── Speak text aloud ────────────────────────────────────── */
  const speak = useCallback((text) => {
    if (!text) return;
    synthRef.current.cancel();
    const clean = text
      .replace(/```[\s\S]*?```/g, ". code example omitted. ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/#{1,6}\s/g, "")
      .replace(/[*_~]/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\n+/g, ". ");
    const utter = new SpeechSynthesisUtterance(clean);
    utter.rate = 1.05;
    utter.pitch = 1;
    utter.lang = "en-US";
    // Try to pick a nice voice
    const voices = synthRef.current.getVoices();
    const preferred = voices.find(v => v.name.includes("Google") && v.lang.startsWith("en")) ||
                      voices.find(v => v.name.includes("Microsoft") && v.name.includes("Male") && v.lang.startsWith("en")) ||
                      voices.find(v => v.lang.startsWith("en"));
    if (preferred) utter.voice = preferred;
    utter.onstart = () => { setStatus("speaking"); setStatusLabel("Jarvis is speaking..."); };
    utter.onend = () => { setStatus("idle"); setStatusLabel("Tap the mic to continue"); };
    utter.onerror = () => { setStatus("idle"); setStatusLabel("Tap the mic to continue"); };
    pendingUtterRef.current = utter;
    synthRef.current.speak(utter);
  }, []);

  const stopSpeaking = useCallback(() => {
    synthRef.current?.cancel();
    setStatus("idle");
    setStatusLabel("Tap the mic to continue");
  }, []);

  /* ── Send to AI (streaming) ──────────────────────────────── */
  const sendToAI = useCallback(async (text) => {
    if (!text.trim()) return;

    // Check for mode activation command
    const requestedMode = detectModeCommand(text);
    if (requestedMode) {
      setCurrentMode(requestedMode);
      const modeInfo = MODE_CONFIG[requestedMode];
      const announcement = `${modeInfo.emoji} ${modeInfo.label} activated! I'm now in ${modeInfo.label}. How can I help you?`;
      setHistory(prev => [...prev, { role: "user", content: text }, { role: "assistant", content: announcement }]);
      setAiText(announcement);
      speak(announcement);
      return;
    }

    setStatus("thinking");
    setStatusLabel("Jarvis is thinking...");
    setAiText("");
    const activePdfIds = pdfs.filter(p => p.active).map(p => p.id);
    const newHistory = [...history, { role: "user", content: text }];
    setHistory(newHistory);

    try {
      const controller = new AbortController();
      abortRef.current = controller;
      const bodyPayload = {
        message: currentMode !== "LEARN" ? `[MODE: ${currentMode}] ${text}` : text,
        chatId,
        activePdfs: activePdfIds,
      };
      if (lessonId) bodyPayload.lessonId = lessonId;
      const resp = await fetch(`${API}/voice-tutor/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
        signal: controller.signal,
      });
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n").filter(l => l.startsWith("data: "))) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "meta") { if (!chatId) setChatId(data.chatId); }
            else if (data.type === "token") { fullText += data.content; setAiText(fullText); }
            else if (data.type === "done") {
              setHistory(prev => [...prev, { role: "assistant", content: fullText }]);
              speak(fullText);
            }
          } catch {}
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        setStatus("idle");
        setStatusLabel("Connection error. Tap mic to retry.");
      }
    }
  }, [chatId, history, pdfs, speak, lessonId]);

  /* ── Voice recognition ───────────────────────────────────── */
  const startListening = useCallback(() => {
    if (status === "listening") {
      recognitionRef.current?.stop();
      setStatus("idle");
      setStatusLabel("Tap the mic to start talking");
      return;
    }
    if (status === "speaking") { stopSpeaking(); }
    if (status === "thinking") return;

    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      setStatusLabel("Speech recognition not supported in this browser");
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.continuous = false;
    r.interimResults = true;
    r.lang = "en-US";
    let finalText = "";
    r.onstart = () => { setStatus("listening"); setStatusLabel("Listening... speak now"); setTranscript(""); };
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interim = t;
      }
      setTranscript(finalText + interim);
    };
    r.onend = () => {
      setStatus("idle");
      if (finalText.trim()) {
        setTranscript(finalText.trim());
        sendToAI(finalText.trim());
      } else {
        setStatusLabel("Didn't catch that. Tap the mic to try again.");
      }
    };
    r.onerror = (e) => {
      setStatus("idle");
      if (e.error === "no-speech") setStatusLabel("No speech detected. Tap the mic to try again.");
      else setStatusLabel("Mic error. Try again.");
    };
    recognitionRef.current = r;
    r.start();
  }, [status, stopSpeaking, sendToAI]);

  /* ── PDF helpers ─────────────────────────────────────────── */
  const uploadPdf = async (file) => {
    const fd = new FormData(); fd.append("file", file);
    try { await fetch(`${API}/upload-pdf`, { method: "POST", body: fd }); loadPdfs(); } catch {}
  };
  const deletePdf = async (id) => { await fetch(`${API}/pdfs/${id}`, { method: "DELETE" }); loadPdfs(); };
  const togglePdf = async (id) => { await fetch(`${API}/pdfs/${id}/toggle`, { method: "POST" }); loadPdfs(); };
  const activePdfCount = pdfs.filter(p => p.active).length;

  /* ── Start a lesson (break-by-break) ────────────────────── */
  const startLesson = async () => {
    const activePdfIds = pdfs.filter(p => p.active).map(p => p.id);
    if (activePdfIds.length === 0) return;
    setLessonLoading(true);
    try {
      const r = await fetch(`${API}/voice-tutor/start-lesson`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activePdfs: activePdfIds }),
      });
      const d = await r.json();
      if (d.success) {
        setLessonId(d.lessonId);
        setLessonSections(d.sections || []);
        setCurrentSection(0);
        setTotalSections(d.totalSections);
        setLessonActive(true);
        setLessonComplete(false);
        setLessonTitle(d.title || "Lesson");
        setShowPdfPanel(false);
        // Auto-send to trigger first section teaching
        setTimeout(() => sendToAI("Teach me section 1 of this document. Start the lesson from the beginning."), 300);
      }
    } catch (e) {
      console.error("Start lesson failed:", e);
    } finally {
      setLessonLoading(false);
    }
  };

  /* ── Advance to next section ───────────────────────────────── */
  const advanceSection = async () => {
    if (!lessonId) return;
    try {
      const r = await fetch(`${API}/voice-tutor/next-section`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId }),
      });
      const d = await r.json();
      if (d.success) {
        setCurrentSection(d.currentSection);
        if (d.lessonComplete) {
          setLessonComplete(true);
          sendToAI("I have finished all sections. Can you give me a summary and final quiz?");
        } else {
          sendToAI(`I am ready for the next section. Please teach me section ${d.currentSection + 1}.`);
        }
      }
    } catch (e) {
      console.error("Next section failed:", e);
    }
  };

  /* ── New session ─────────────────────────────────────────── */
  const newSession = () => {
    stopSpeaking();
    abortRef.current?.abort();
    setChatId("");
    setHistory([]);
    setAiText("");
    setTranscript("");
    setStatus("idle");
    setStatusLabel("Tap the mic to start talking");
    // Clear lesson state
    setLessonId("");
    setLessonSections([]);
    setCurrentSection(0);
    setTotalSections(0);
    setLessonActive(false);
    setLessonComplete(false);
    setLessonTitle("");
  };

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */
  const orbSize = status === "listening" ? 220 : status === "speaking" ? 200 : status === "thinking" ? 190 : 180;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

        @keyframes jOrbitSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes jPulse { 0%,100% { transform: scale(1); opacity:.7; } 50% { transform: scale(1.08); opacity:1; } }
        @keyframes jListenPulse { 0%,100% { transform: scale(1); box-shadow: 0 0 40px rgba(6,182,212,.3); } 50% { transform: scale(1.06); box-shadow: 0 0 80px rgba(6,182,212,.6); } }
        @keyframes jSpeakPulse { 0%,100% { transform: scale(1); box-shadow: 0 0 40px rgba(124,58,237,.3); } 50% { transform: scale(1.04); box-shadow: 0 0 60px rgba(124,58,237,.5); } }
        @keyframes jThinkPulse { 0%,100% { transform: scale(.96); opacity:.6; } 50% { transform: scale(1.02); opacity:1; } }
        @keyframes jRing1 { 0%,100% { transform: scale(1); opacity:.15; } 50% { transform: scale(1.3); opacity:0; } }
        @keyframes jRing2 { 0%,100% { transform: scale(1); opacity:.1; } 50% { transform: scale(1.5); opacity:0; } }
        @keyframes jFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes jFadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes jWave { 0%,100% { height: 8px; } 50% { height: 28px; } }

        .j-page { 
          height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center;
          background: radial-gradient(ellipse at 50% 0%, #0d1530 0%, #080b18 50%, #050710 100%);
          font-family: 'Inter', system-ui, sans-serif; color: #e2e8f0; overflow:hidden; position:relative;
        }
        .j-page::before {
          content:''; position:absolute; inset:0;
          background: radial-gradient(600px circle at 50% 40%, rgba(6,182,212,.06) 0%, transparent 70%);
          pointer-events:none;
        }
        .j-stars { position:absolute; inset:0; overflow:hidden; pointer-events:none; }
        .j-star { position:absolute; width:2px; height:2px; background:#fff; border-radius:50%; opacity:.3; }

        .j-topbar {
          position:absolute; top:0; left:0; right:0; display:flex; align-items:center;
          padding: 16px 24px; z-index:10;
        }
        .j-back { background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.08); color:#94a3b8;
          padding:8px 16px; border-radius:10px; font-size:.82rem; cursor:pointer; transition:all .2s;
          font-family:inherit; display:flex; align-items:center; gap:6px; }
        .j-back:hover { background:rgba(6,182,212,.1); border-color:rgba(6,182,212,.3); color:#67e8f9; }
        .j-title { flex:1; text-align:center; font-size:.9rem; font-weight:500; color:#64748b; }
        .j-topActions { display:flex; gap:8px; }
        .j-topBtn { background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.08); color:#94a3b8;
          padding:8px 14px; border-radius:10px; font-size:.82rem; cursor:pointer; transition:all .2s;
          font-family:inherit; display:flex; align-items:center; gap:6px; }
        .j-topBtn:hover { background:rgba(6,182,212,.1); border-color:rgba(6,182,212,.3); color:#67e8f9; }
        .j-badge { background:rgba(6,182,212,.15); color:#67e8f9; padding:2px 8px; border-radius:10px; font-size:.7rem; font-weight:600; }

        /* Orb container */
        .j-orb-area { position:relative; display:flex; align-items:center; justify-content:center;
          width:300px; height:300px; margin-bottom:32px; }

        .j-orb {
          width: ${orbSize}px; height: ${orbSize}px; border-radius:50%; cursor:pointer;
          position:relative; z-index:2; transition: width .4s, height .4s;
          display:flex; align-items:center; justify-content:center;
        }
        .j-orb-idle { 
          background: radial-gradient(circle at 35% 35%, #1e3a5f, #0c1929);
          box-shadow: 0 0 40px rgba(6,182,212,.2), inset 0 0 30px rgba(6,182,212,.1);
          animation: jFloat 4s ease-in-out infinite;
        }
        .j-orb-listening { 
          background: radial-gradient(circle at 35% 35%, #0e4a6e, #042f4e);
          box-shadow: 0 0 60px rgba(6,182,212,.4);
          animation: jListenPulse 1.5s ease-in-out infinite;
        }
        .j-orb-thinking { 
          background: radial-gradient(circle at 35% 35%, #1a1a4e, #0a0a2e);
          box-shadow: 0 0 40px rgba(124,58,237,.3);
          animation: jThinkPulse 1.2s ease-in-out infinite;
        }
        .j-orb-speaking { 
          background: radial-gradient(circle at 35% 35%, #2d1b69, #150d3a);
          box-shadow: 0 0 60px rgba(124,58,237,.4);
          animation: jSpeakPulse 2s ease-in-out infinite;
        }

        .j-orb-ring { position:absolute; border-radius:50%; border:1px solid rgba(6,182,212,.15);
          pointer-events:none; }
        .j-orb-ring1 { width:260px; height:260px; animation: jOrbitSpin 20s linear infinite; }
        .j-orb-ring2 { width:320px; height:320px; animation: jOrbitSpin 30s linear infinite reverse; }
        .j-ring-dot { position:absolute; width:4px; height:4px; border-radius:50%; background:#06b6d4; }
        .j-ring-dot-1 { top:0; left:50%; transform:translateX(-50%); }
        .j-ring-dot-2 { bottom:0; left:50%; transform:translateX(-50%); }
        .j-ring-dot-3 { left:0; top:50%; transform:translateY(-50%); }

        .j-pulse-ring { position:absolute; border-radius:50%; border:1px solid rgba(6,182,212,.1); pointer-events:none; }
        .j-pulse-ring1 { width:220px; height:220px; animation: jRing1 3s ease-out infinite; }
        .j-pulse-ring2 { width:220px; height:220px; animation: jRing2 3s ease-out infinite 1s; }

        .j-orb-icon { font-size:3.5rem; filter:drop-shadow(0 0 20px rgba(6,182,212,.5)); z-index:3;
          user-select:none; }

        /* Voice wave bars inside orb when listening */
        .j-wave-bars { display:flex; align-items:center; gap:4px; height:40px; }
        .j-wave-bar { width:4px; border-radius:2px; background:linear-gradient(to top, #06b6d4, #7c3aed); }

        /* Status text */
        .j-status { font-size:.9rem; color:#64748b; margin-bottom:8px; letter-spacing:.02em;
          animation: jFadeIn .4s ease; }
        .j-transcript { 
          font-size:1.1rem; color:#e2e8f0; max-width:600px; text-align:center;
          line-height:1.6; margin-bottom:16px; min-height:28px;
          animation: jFadeIn .4s ease; font-weight:300;
        }
        .j-ai-text {
          font-size:.88rem; color:#94a3b8; max-width:550px; text-align:center;
          line-height:1.6; max-height:120px; overflow-y:auto; margin-bottom:16px;
          font-weight:300; scrollbar-width:none;
        }
        .j-ai-text::-webkit-scrollbar { display:none; }

        /* Bottom controls */
        .j-controls { display:flex; align-items:center; gap:16px; margin-top:8px; }
        .j-mic-btn { 
          width:64px; height:64px; border-radius:50%; border:none; cursor:pointer;
          display:flex; align-items:center; justify-content:center; font-size:1.6rem;
          transition: all .25s; position:relative; z-index:5;
        }
        .j-mic-idle { 
          background: linear-gradient(135deg, #06b6d4, #0891b2);
          box-shadow: 0 4px 24px rgba(6,182,212,.3);
        }
        .j-mic-idle:hover { transform:scale(1.08); box-shadow: 0 6px 32px rgba(6,182,212,.5); }
        .j-mic-listening { 
          background: linear-gradient(135deg, #ef4444, #dc2626);
          box-shadow: 0 4px 24px rgba(239,68,68,.4);
          animation: jPulse 1.5s ease-in-out infinite;
        }
        .j-mic-disabled {
          background: rgba(255,255,255,.06);
          box-shadow: none; cursor:not-allowed; opacity:.5;
        }

        .j-ctrl-btn {
          width:44px; height:44px; border-radius:50%; border:1px solid rgba(255,255,255,.08);
          background:rgba(255,255,255,.04); color:#94a3b8; cursor:pointer; font-size:1rem;
          display:flex; align-items:center; justify-content:center; transition:all .2s;
        }
        .j-ctrl-btn:hover { background:rgba(6,182,212,.1); border-color:rgba(6,182,212,.3); color:#67e8f9; }

        /* PDF Panel */
        .j-pdf-panel {
          position:absolute; bottom:120px; right:24px; width:280px;
          background:rgba(15,15,35,.9); border:1px solid rgba(255,255,255,.08);
          border-radius:16px; padding:16px; backdrop-filter:blur(20px);
          animation: jFadeIn .3s ease; z-index:20;
        }
        .j-pdf-title { font-size:.8rem; font-weight:600; color:#67e8f9; margin-bottom:12px;
          text-transform:uppercase; letter-spacing:.06em; }
        .j-pdf-upload { width:100%; padding:10px; border-radius:10px; border:1px dashed rgba(255,255,255,.12);
          background:transparent; color:#94a3b8; font-size:.82rem; cursor:pointer; text-align:center;
          transition:all .2s; font-family:inherit; }
        .j-pdf-upload:hover { border-color:rgba(6,182,212,.4); color:#67e8f9; }
        .j-pdf-item { display:flex; align-items:center; gap:8px; padding:8px; border-radius:8px;
          margin-top:6px; background:rgba(255,255,255,.03); font-size:.78rem; }
        .j-pdf-toggle { width:16px; height:16px; border-radius:4px; cursor:pointer; border:none;
          display:flex; align-items:center; justify-content:center; font-size:.6rem; color:#fff;
          flex-shrink:0; transition:all .15s; }
        .j-pdf-on { background:#06b6d4; }
        .j-pdf-off { background:transparent; border:1px solid rgba(255,255,255,.15); }
        .j-pdf-name { flex:1; color:#94a3b8; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .j-pdf-del { background:none; border:none; color:#f87171; cursor:pointer; font-size:.65rem; padding:2px; }

        /* Hint at bottom */
        .j-hint { position:absolute; bottom:20px; font-size:.7rem; color:#3b4559; letter-spacing:.02em; }

        /* Lesson mode UI */
        .j-lesson-bar {
          position:absolute; top:64px; left:50%; transform:translateX(-50%);
          background:rgba(15,15,35,.85); border:1px solid rgba(6,182,212,.2);
          border-radius:16px; padding:10px 20px; backdrop-filter:blur(16px);
          display:flex; align-items:center; gap:14px; z-index:12;
          animation: jFadeIn .4s ease;
        }
        .j-lesson-progress {
          display:flex; align-items:center; gap:6px;
        }
        .j-lesson-dot {
          width:10px; height:10px; border-radius:50%; transition:all .3s;
        }
        .j-lesson-dot-done { background:#06b6d4; box-shadow:0 0 8px rgba(6,182,212,.4); }
        .j-lesson-dot-active { background:#7c3aed; box-shadow:0 0 12px rgba(124,58,237,.5); animation: jPulse 1.5s ease infinite; }
        .j-lesson-dot-pending { background:rgba(255,255,255,.12); }
        .j-lesson-label {
          font-size:.78rem; color:#94a3b8; white-space:nowrap;
        }
        .j-lesson-section-name {
          font-size:.82rem; color:#67e8f9; font-weight:500;
          max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        }
        .j-next-btn {
          background:linear-gradient(135deg, #06b6d4, #7c3aed);
          border:none; color:#fff; padding:8px 18px; border-radius:12px;
          font-size:.82rem; font-weight:600; cursor:pointer;
          transition:all .25s; font-family:inherit;
          display:flex; align-items:center; gap:6px;
        }
        .j-next-btn:hover { transform:scale(1.05); box-shadow: 0 4px 20px rgba(6,182,212,.3); }
        .j-start-lesson-btn {
          background:linear-gradient(135deg, #06b6d4, #0891b2);
          border:none; color:#fff; padding:8px 16px; border-radius:12px;
          font-size:.82rem; font-weight:600; cursor:pointer;
          transition:all .25s; font-family:inherit;
          display:flex; align-items:center; gap:6px;
          box-shadow: 0 4px 16px rgba(6,182,212,.2);
        }
        .j-start-lesson-btn:hover { transform:scale(1.05); box-shadow: 0 6px 24px rgba(6,182,212,.4); }
        .j-start-lesson-btn:disabled { opacity:.5; cursor:not-allowed; transform:none; }
        .j-lesson-complete {
          background:rgba(6,182,212,.08); border:1px solid rgba(6,182,212,.2);
          border-radius:16px; padding:8px 18px; text-align:center;
          animation: jFadeIn .5s ease;
        }
        .j-lesson-complete-text { color:#67e8f9; font-size:.85rem; font-weight:600; }
      `}</style>

      <div className="j-page">
        {/* Decorative stars */}
        <div className="j-stars">
          {Array.from({ length: 40 }, (_, i) => (
            <div key={i} className="j-star" style={{
              left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.4 + 0.1,
              width: Math.random() > 0.8 ? 3 : 2, height: Math.random() > 0.8 ? 3 : 2,
            }} />
          ))}
        </div>

        {/* Top bar */}
        <div className="j-topbar">
          <button className="j-back" onClick={() => navigate("/ai-tutor")}>
            ← AI Tutor
          </button>
          <div className="j-title">
            {history.length > 0 ? `${Math.ceil(history.length / 2)} exchanges` : "AI Voice Tutor"}
          </div>
          <div className="j-topActions">
            {activePdfCount > 0 && <span className="j-badge">📎 {activePdfCount} PDF</span>}
            {activePdfCount > 0 && !lessonActive && (
              <button
                className="j-start-lesson-btn"
                onClick={startLesson}
                disabled={lessonLoading || status === "thinking"}
              >
                {lessonLoading ? "Loading..." : "📖 Start Lesson"}
              </button>
            )}
            <button className="j-topBtn" onClick={() => setShowPdfPanel(!showPdfPanel)}>📄 PDFs</button>
            <button className="j-topBtn" onClick={newSession}>🔄 New</button>
          </div>
        </div>

        {/* Lesson progress bar */}
        {lessonActive && totalSections > 0 && (
          <div className="j-lesson-bar">
            <div className="j-lesson-progress">
              {lessonSections.map((s, i) => (
                <div
                  key={i}
                  className={`j-lesson-dot ${i < currentSection ? 'j-lesson-dot-done' : i === currentSection ? 'j-lesson-dot-active' : 'j-lesson-dot-pending'}`}
                  title={s.title}
                />
              ))}
            </div>
            <span className="j-lesson-label">
              {lessonComplete ? "Complete!" : `${currentSection + 1} / ${totalSections}`}
            </span>
            <span className="j-lesson-section-name">
              {lessonComplete ? "All done!" : lessonSections[currentSection]?.title || ""}
            </span>
          </div>
        )}

        {/* Central Orb */}
        <div className="j-orb-area">
          <div className="j-orb-ring j-orb-ring1">
            <div className="j-ring-dot j-ring-dot-1" />
            <div className="j-ring-dot j-ring-dot-2" />
          </div>
          <div className="j-orb-ring j-orb-ring2">
            <div className="j-ring-dot j-ring-dot-3" />
          </div>
          {(status === "listening" || status === "speaking") && (
            <>
              <div className="j-pulse-ring j-pulse-ring1" />
              <div className="j-pulse-ring j-pulse-ring2" />
            </>
          )}
          <div
            className={`j-orb j-orb-${status}`}
            onClick={status === "idle" || status === "listening" ? startListening : status === "speaking" ? stopSpeaking : undefined}
            title={status === "idle" ? "Click to speak" : status === "listening" ? "Click to stop" : status === "speaking" ? "Click to stop" : "Thinking..."}
          >
            {status === "listening" ? (
              <div className="j-wave-bars">
                {[0, 150, 300, 450, 200].map((d, i) => (
                  <div key={i} className="j-wave-bar" style={{ animation: `jWave .8s ease-in-out ${d}ms infinite` }} />
                ))}
              </div>
            ) : status === "thinking" ? (
              <span className="j-orb-icon" style={{ animation: "jPulse 1s ease-in-out infinite" }}>🧠</span>
            ) : status === "speaking" ? (
              <span className="j-orb-icon">🔊</span>
            ) : (
              <span className="j-orb-icon">🎙️</span>
            )}
          </div>
        </div>

        {/* Status label */}
        <div className="j-status" key={statusLabel}>{statusLabel}</div>

        {/* Transcript (what user said) */}
        {transcript && status !== "idle" && (
          <div className="j-transcript" key={transcript}>"{transcript}"</div>
        )}
        {status === "idle" && transcript && (
          <div className="j-transcript" style={{ color: "#64748b", fontSize: ".85rem" }}>You said: "{transcript}"</div>
        )}

        {/* AI response text (subtle, since it's being spoken) */}
        {aiText && (status === "speaking" || status === "thinking") && (
          <div className="j-ai-text">{aiText.slice(-300)}</div>
        )}

        {/* Bottom controls */}
        <div className="j-controls">
          <button
            className="j-ctrl-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Upload PDF"
          >📎</button>

          <button
            className={`j-mic-btn ${status === "listening" ? "j-mic-listening" : status === "thinking" ? "j-mic-disabled" : "j-mic-idle"}`}
            onClick={status === "idle" || status === "listening" ? startListening : status === "speaking" ? () => { stopSpeaking(); startListening(); } : undefined}
            disabled={status === "thinking"}
          >
            {status === "listening" ? "⏹" : "🎤"}
          </button>

          {status === "speaking" && (
            <button className="j-ctrl-btn" onClick={stopSpeaking} title="Stop speaking">🔇</button>
          )}
          {status !== "speaking" && (
            <button className="j-ctrl-btn" onClick={newSession} title="New session">🔄</button>
          )}
          {/* Next Section button in lesson mode */}
          {lessonActive && !lessonComplete && status === "idle" && history.length > 0 && (
            <button className="j-next-btn" onClick={advanceSection}>
              Next Section →
            </button>
          )}
          {lessonActive && lessonComplete && status === "idle" && (
            <div className="j-lesson-complete">
              <span className="j-lesson-complete-text">🎉 Lesson Complete!</span>
            </div>
          )}
        </div>

        {/* Hidden file input */}
        <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: "none" }}
          onChange={e => { if (e.target.files?.[0]) uploadPdf(e.target.files[0]); e.target.value = ""; }} />

        {/* PDF Panel */}
        {showPdfPanel && (
          <div className="j-pdf-panel">
            <div className="j-pdf-title">📎 Knowledge Base</div>
            <button className="j-pdf-upload" onClick={() => fileInputRef.current?.click()}>
              + Upload PDF
            </button>
            {pdfs.length === 0 && <p style={{ fontSize: ".75rem", color: "#4b5563", marginTop: 8 }}>No PDFs uploaded yet</p>}
            {pdfs.map(p => (
              <div key={p.id} className="j-pdf-item">
                <button className={`j-pdf-toggle ${p.active ? "j-pdf-on" : "j-pdf-off"}`} onClick={() => togglePdf(p.id)}>
                  {p.active ? "✓" : ""}
                </button>
                <span className="j-pdf-name">{p.name}</span>
                <button className="j-pdf-del" onClick={() => deletePdf(p.id)}>✕</button>
              </div>
            ))}
          </div>
        )}

        <div className="j-hint">Powered by Ollama · Voice-only Interactive Tutor</div>
      </div>
    </>
  );
}
