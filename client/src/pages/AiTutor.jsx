import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addXP } from "../utils/gamification";
import "../styles/aiTutorV2.css";
const API = "http://localhost:8003";

/* ─── model label shown in topbar ────────────────────────── */
const MODEL_LABEL = "NeuroNest AI";

/* ─── Emotion emoji map ──────────────────────────────────── */
const EMOTION_EMOJI = {
  happy: "😊",
  sad: "😢",
  angry: "😠",
  fear: "😨",
  disgust: "🤢",
  surprise: "😮",
  neutral: "😐",
};

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function AiTutor() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [pdfs, setPdfs] = useState([]);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null); // {type: 'success'|'error', msg: ''}
  const [listening, setListening] = useState(false);
  const [emotion, setEmotion] = useState("Neutral");
  const [showEmotionPanel, setShowEmotionPanel] = useState(false);
  const [activeChat, setActiveChat] = useState(null);
  
  // Brain Optimizer State
  const [currentMode, setCurrentMode] = useState("LEARN");
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Quiz State
  const [quiz, setQuiz] = useState(null);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  const abortRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  /* ── Load PDFs ──────────────────────────────────────────── */
  const loadPdfs = useCallback(async () => {
    try {
      const r = await fetch(`${API}/pdfs`);
      const d = await r.json();
      setPdfs(d.pdfs || []);
    } catch { }
  }, []);

  /* ── Mode config ────────────────────────────────────────── */
  const MODE_CONFIG = {
    LEARN: { emoji: "📚", label: "Learn Mode", color: "#3b82f6" },
    QUIZ:  { emoji: "📝", label: "Quiz Mode",  color: "#f59e0b" },
    FOCUS: { emoji: "🎯", label: "Focus Mode", color: "#10b981" },
    THINK: { emoji: "💡", label: "Think Mode", color: "#8b5cf6" },
    REVIEW:{ emoji: "🔄", label: "Review Mode",color: "#ef4444" },
  };

  const extractMode = (text) => {
    const match = text.match(/^\[MODE:\s*(\w+)\]/);
    return match ? match[1].toUpperCase() : null;
  };

  const stripModeTag = (text) => {
    return text.replace(/^\[MODE:\s*\w+\]\s*\n?/, "").trim();
  };

  useEffect(() => { loadPdfs(); }, [loadPdfs]);

  /* ── Auto resize textarea ──────────────────────────────── */
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 180) + "px";
    }
  }, [input]);

  /* ── Scroll to bottom ──────────────────────────────────── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText]);

  /* ── Greet on mount ────────────────────────────────────── */
  useEffect(() => {
    const hour = new Date().getHours();
    const greeting =
      hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: `${greeting}! I'm **NeuroNest AI** — your brain performance coach. 🧠⚡\n\nI don't just answer questions — I **upgrade how you think**.\n\n- 💡 **Think Mode** — I'll challenge you to reason before I explain\n- 📚 **Learn Mode** — Concepts broken into bite-sized chunks\n- 📝 **Quiz Mode** — Active recall to lock in knowledge\n- 🎯 **Focus Mode** — Complex tasks broken into clear steps\n- 🔄 **Review Mode** — Spaced recall for weak areas\n\nI adapt to your level, ask you to think first, and never let you be a passive learner.\n\nWhat would you like to explore today?`,
      },
    ]);
  }, []);

  /* ── Detect mode activation commands ────────────────────── */
  const MODE_ALIASES = {
    think: "THINK", thinking: "THINK",
    learn: "LEARN", learning: "LEARN", teach: "LEARN",
    quiz: "QUIZ", test: "QUIZ", question: "QUIZ",
    focus: "FOCUS", concentrate: "FOCUS",
    review: "REVIEW", revise: "REVIEW", recall: "REVIEW",
  };

  const detectModeCommand = (text) => {
    const lower = text.toLowerCase().trim();
    // Match: "activate X mode", "switch to X mode", "use X mode", "X mode", "go to X mode", "enable X mode"
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

  /* ── Send ───────────────────────────────────────────────── */
  const sendMessage = useCallback(
    async (text) => {
      const msg = (text || input).trim();
      if (!msg || streaming) return;

      // Check if user is requesting a mode switch
      const requestedMode = detectModeCommand(msg);
      if (requestedMode) {
        setCurrentMode(requestedMode);
        const modeInfo = MODE_CONFIG[requestedMode];
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "user",
            content: msg,
            timestamp: new Date().toISOString(),
          },
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `${modeInfo.emoji} **${modeInfo.label} activated!**\n\nI'm now operating in ${modeInfo.label}. How can I help you?`,
            timestamp: new Date().toISOString(),
            mode: requestedMode,
          },
        ]);
        setInput("");
        return;
      }

      setInput("");
      setStreaming(true);
      setStreamText("");
      const activePdfsNames = pdfs.filter(p => p.active).map(p => p.name);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "user",
          content: msg,
          timestamp: new Date().toISOString(),
          attachments: activePdfsNames.length > 0 ? activePdfsNames : null,
        },
      ]);
      const activePdfIds = pdfs.filter((p) => p.active).map((p) => p.id);
      try {
        const controller = new AbortController();
        abortRef.current = controller;
        const resp = await fetch(`${API}/chat/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: currentMode !== "LEARN" ? `[MODE: ${currentMode}] ${msg}` : msg,
            chatId: activeChat || "",
            activePdfs: activePdfIds,
          }),
          signal: controller.signal,
        });
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "",
          chatId = activeChat;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n").filter((l) => l.startsWith("data: "))) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "meta") {
                chatId = data.chatId;
                if (!activeChat) setActiveChat(chatId);
              } else if (data.type === "token") {
                fullText += data.content;
                setStreamText(fullText);
              } else if (data.type === "done") {
                const cleanText = stripModeTag(fullText);
                const detectedMode = data.mode || extractMode(fullText) || "LEARN";
                setCurrentMode(detectedMode);
                setShowSuggestions(true);
                setMessages((prev) => [
                  ...prev,
                  {
                    id: (Date.now() + 1).toString(),
                    role: "assistant",
                    content: cleanText,
                    timestamp: new Date().toISOString(),
                    mode: detectedMode,
                  },
                ]);
                setStreamText("");
              }
            } catch { }
          }
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              role: "assistant",
              content: "⚠️ Could not reach AI Tutor server.",
              timestamp: new Date().toISOString(),
            },
          ]);
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [input, streaming, activeChat, pdfs]
  );

  const stopStreaming = () => {
    abortRef.current?.abort();
    setStreaming(false);
    if (streamText) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: streamText,
          timestamp: new Date().toISOString(),
        },
      ]);
      setStreamText("");
    }
  };


  /* ── PDF Upload ─────────────────────────────────────────── */
  const uploadPdf = async (file) => {
    if (!file) return;
    const allowedExts = [".pdf", ".txt"];
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!allowedExts.includes(ext)) {
      setUploadStatus({ type: "error", msg: `❌ Only PDF and TXT files are supported.` });
      setTimeout(() => setUploadStatus(null), 4000);
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    setIsUploadingPdf(true);
    setUploadStatus(null);
    try {
      const res = await fetch(`${API}/upload-pdf`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setUploadStatus({ type: "success", msg: `✅ "${file.name}" attached!` });
        setTimeout(() => setUploadStatus(null), 4000);
        loadPdfs();
      } else {
        const errMsg = data.error || `Server returned ${res.status}`;
        setUploadStatus({ type: "error", msg: `❌ Upload failed: ${errMsg}` });
        setTimeout(() => setUploadStatus(null), 6000);
      }
    } catch (e) {
      setUploadStatus({ type: "error", msg: `❌ Cannot reach AI Tutor server on port 8003. Is it running?` });
      setTimeout(() => setUploadStatus(null), 6000);
    } finally {
      setIsUploadingPdf(false);
    }
  };
  const deletePdf = async (id) => {
    await fetch(`${API}/pdfs/${id}`, { method: "DELETE" });
    loadPdfs();
  };
  const togglePdf = async (id) => {
    await fetch(`${API}/pdfs/${id}/toggle`, { method: "POST" });
    loadPdfs();
  };
  const learnFromPdf = () => {
    const activePdf = pdfs.find((p) => p.active);
    if (activePdf) {
      sendMessage(`Please analyze and summarize the PDF document: ${activePdf.name}`);
    }
  };

  const generateQuiz = async () => {
    const activePdf = pdfs.find((p) => p.active);
    if (!activePdf) return;
    
    setGeneratingQuiz(true);
    setQuiz(null);
    setQuizAnswers({});
    setQuizSubmitted(false);
    
    try {
      const resp = await fetch(`${API}/generate-quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfId: activePdf.id })
      });
      const data = await resp.json();
      if (data.success && data.quiz) {
        setQuiz(data.quiz);
      } else {
        alert("Could not generate quiz. " + (data.error || ""));
      }
    } catch (e) {
      alert("Error generating quiz.");
    } finally {
      setGeneratingQuiz(false);
    }
  };

  const handleQuizAnswer = (qIndex, oIndex) => {
    if (quizSubmitted) return;
    setQuizAnswers(prev => ({ ...prev, [qIndex]: oIndex }));
  };

  const submitQuiz = () => {
    setQuizSubmitted(true);
    let correct = 0;
    quiz.questions.forEach((q, i) => {
      if (quizAnswers[i] === q.correctAnswer) correct++;
    });
    
    // Award 10 XP per correct answer
    if (correct > 0) {
      const xpToAward = correct * 10;
      addXP(xpToAward, "ai-tutor-quiz");
      
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: `🎉 You completed the quiz **"${quiz.title}"** and scored **${correct}/${quiz.questions.length}**!\n\nYou earned **+${xpToAward} XP**. Great job learning from this document!`,
          timestamp: new Date().toISOString(),
        }
      ]);
    } else {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: `You completed the quiz **"${quiz.title}"** but didn't get any answers correct. Don't worry, you can always read the document and try again!`,
          timestamp: new Date().toISOString(),
        }
      ]);
    }
  };

  /* ── Voice ──────────────────────────────────────────────── */
  const toggleVoice = () => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      alert("Voice input not supported in this browser");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.continuous = false;
    r.interimResults = true;
    r.lang = "en-US";
    r.onresult = (e) => {
      setInput((prev) => prev + Array.from(e.results).map((x) => x[0].transcript).join(""));
    };
    r.onend = () => setListening(false);
    recognitionRef.current = r;
    r.start();
    setListening(true);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const activePdfCount = pdfs.filter((p) => p.active).length;
  const activePdf = pdfs.find((p) => p.active);
  const emotionEmoji = EMOTION_EMOJI[emotion.toLowerCase()] || "😐";

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */
  return (
    <div className="nn-page">
      {/* ── TOP BAR ──────────────────────────────────────── */}
      <header className="nn-topbar">
        <div className="nn-topbar-brand">
          <div className="nn-brain-icon">🧠</div>
          <div className="nn-brand-text">
            <span className="nn-brand-name">NeuroNest AI</span>
            <span className="nn-brand-sub">NEXT-GENERATION INTELLIGENCE</span>
          </div>
        </div>
        <div className="nn-topbar-right">
          {/* Mode Indicator Badge */}
          {currentMode && MODE_CONFIG[currentMode] && (
            <div className="nn-mode-badge" style={{ 
              background: `${MODE_CONFIG[currentMode].color}22`,
              borderColor: `${MODE_CONFIG[currentMode].color}55`,
            }}>
              <span className="nn-mode-emoji">{MODE_CONFIG[currentMode].emoji}</span>
              <span className="nn-mode-label" style={{ color: MODE_CONFIG[currentMode].color }}>
                {MODE_CONFIG[currentMode].label}
              </span>
            </div>
          )}
          <div className="nn-status-badge">
            <span className="nn-status-dot" />
            <span className="nn-status-label">Online</span>
            <span className="nn-model-badge">{MODEL_LABEL}</span>
          </div>
          <button className="nn-icon-btn" title="Audio settings">🔊</button>
          <button className="nn-icon-btn" title="New chat" onClick={() => { setMessages([]); setCurrentMode("LEARN"); setShowSuggestions(false); }}>＋</button>
          <button className="nn-icon-btn" title="Refresh" onClick={() => window.location.reload()}>↺</button>
        </div>
      </header>

      {/* ── CHAT AREA ────────────────────────────────────── */}
      <div className="nn-messages nn-scrollbar">
        <div className="nn-messages-inner">
          {messages.map((msg) => (
            <ChatBubble key={msg.id} msg={msg} />
          ))}

          {/* Streaming */}
          {streaming && streamText && (
            <div className="nn-msg nn-msg-ai">
              <div className="nn-avatar nn-avatar-ai">
                <span>🧠</span>
              </div>
              <div className="nn-bubble nn-bubble-ai">
                <MdContent content={streamText} />
                <span className="nn-cursor" />
              </div>
            </div>
          )}
          {streaming && !streamText && (
            <div className="nn-msg nn-msg-ai">
              <div className="nn-avatar nn-avatar-ai">
                <span>🧠</span>
              </div>
              <div className="nn-bubble nn-bubble-ai">
                <div className="nn-typing">
                  <span /><span /><span />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />

          {/* Proactive Suggestion Chips */}
          {showSuggestions && !streaming && messages.length > 1 && (
            <div className="nn-suggestions">
              <button className="nn-suggestion-chip" onClick={() => { setShowSuggestions(false); sendMessage("Give me a quick 2-question recall test on what we just covered."); }}>
                🧠 Quick Recall Check
              </button>
              <button className="nn-suggestion-chip" onClick={() => { setShowSuggestions(false); sendMessage("Test my knowledge — give me a challenge question."); }}>
                📝 Test My Knowledge
              </button>
              <button className="nn-suggestion-chip" onClick={() => { setShowSuggestions(false); sendMessage("Summarize what we've covered so far in this conversation."); }}>
                📋 Summarize So Far
              </button>
              <button className="nn-suggestion-chip" onClick={() => { setShowSuggestions(false); sendMessage("I'm ready — teach me the next concept."); }}>
                ➡️ Next Concept
              </button>
              <button className="nn-suggestion-chip" onClick={() => { setShowSuggestions(false); sendMessage("Review my weak areas and help me strengthen them."); }}>
                🔄 Review Weak Areas
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── BOTTOM AREA ──────────────────────────────────── */}
      <div className="nn-bottom">
        {/* PDF Attachment Card */}
        {activePdf && (
          <div className="nn-pdf-area">
            <div className="nn-pdf-card">
              <span className="nn-pdf-icon">📄</span>
              <div className="nn-pdf-info">
                <span className="nn-pdf-name">{activePdf.name}</span>
                <span className="nn-pdf-meta">
                  {activePdf.size ? `${(activePdf.size / 1024).toFixed(1)} KB` : ""}
                  {activePdf.pages ? ` · ✓ Extracted (${activePdf.pages} pages)` : ""}
                </span>
              </div>
              <button className="nn-pdf-remove" onClick={() => deletePdf(activePdf.id)}>✕</button>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="nn-learn-btn" onClick={learnFromPdf}>
                <span>📚</span> Learn from PDF
              </button>
              <button 
                className="nn-learn-btn" 
                onClick={generateQuiz} 
                disabled={generatingQuiz}
                style={{ background: generatingQuiz ? "rgba(255,255,255,0.1)" : "rgba(139, 92, 246, 0.15)" }}
              >
                <span>📝</span> {generatingQuiz ? "Generating..." : "Generate Quiz"}
              </button>
            </div>
          </div>
        )}

        {/* Quiz UI Overlay/Inline */}
        {quiz && (
          <div className="nn-quiz-container">
            <div className="nn-quiz-header">
              <h3>{quiz.title}</h3>
              <button className="nn-pdf-remove" onClick={() => setQuiz(null)}>✕</button>
            </div>
            
            <div className="nn-quiz-questions nn-scrollbar">
              {quiz.questions.map((q, qIndex) => {
                const isAnswered = quizAnswers[qIndex] !== undefined;
                const answeredCorrectly = isAnswered && quizAnswers[qIndex] === q.correctAnswer;
                
                return (
                  <div key={qIndex} className="nn-quiz-q-card">
                    <p className="nn-quiz-q-text"><strong>{qIndex + 1}.</strong> {q.question}</p>
                    <div className="nn-quiz-options">
                      {q.options.map((opt, oIndex) => {
                        const isSelected = quizAnswers[qIndex] === oIndex;
                        const isCorrect = q.correctAnswer === oIndex;
                        
                        let optClass = "nn-quiz-opt";
                        if (isSelected) optClass += " selected";
                        if (quizSubmitted) {
                          if (isCorrect) optClass += " correct";
                          else if (isSelected && !isCorrect) optClass += " incorrect";
                          else optClass += " disabled";
                        }
                        
                        return (
                          <button 
                            key={oIndex} 
                            className={optClass}
                            onClick={() => handleQuizAnswer(qIndex, oIndex)}
                            disabled={quizSubmitted}
                          >
                            <span className="nn-quiz-opt-letter">{["A", "B", "C", "D"][oIndex]}</span>
                            <span className="nn-quiz-opt-text">{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                    {quizSubmitted && (
                      <div className={`nn-quiz-explanation ${answeredCorrectly ? "correct" : "incorrect"}`}>
                        {answeredCorrectly ? "✅ Correct! " : "❌ Incorrect. "}
                        {q.explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            <div className="nn-quiz-footer">
              {!quizSubmitted ? (
                <button 
                  className="nn-quiz-submit-btn" 
                  onClick={submitQuiz}
                  disabled={Object.keys(quizAnswers).length < quiz.questions.length}
                >
                  Submit Quiz ({Object.keys(quizAnswers).length}/{quiz.questions.length})
                </button>
              ) : (
                <div className="nn-quiz-score-banner">
                  Final Score: {Object.keys(quizAnswers).filter(k => quizAnswers[k] === quiz.questions[k].correctAnswer).length} / {quiz.questions.length}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PDF list (non-active PDFs) */}
        {pdfs.filter((p) => !p.active).length > 0 && (
          <div className="nn-pdf-inactive-list">
            {pdfs.filter((p) => !p.active).map((p) => (
              <div key={p.id} className="nn-pdf-inactive-item">
                <span>📄</span>
                <span className="nn-pdf-inactive-name">{p.name}</span>
                <button className="nn-pdf-activate-btn" onClick={() => togglePdf(p.id)}>Activate</button>
                <button className="nn-pdf-inactive-del" onClick={() => deletePdf(p.id)}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Upload status toast */}
        {uploadStatus && (
          <div style={{
            padding: "0.6rem 1rem",
            marginBottom: "0.5rem",
            borderRadius: "10px",
            fontSize: "0.875rem",
            fontWeight: "500",
            background: uploadStatus.type === "success" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
            border: `1px solid ${uploadStatus.type === "success" ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)"}`,
            color: uploadStatus.type === "success" ? "#10b981" : "#ef4444",
          }}>
            {uploadStatus.msg}
          </div>
        )}

        {/* Input Bar */}
        <div className="nn-input-bar">

          {/* Center: Input */}
          <div className="nn-input-center">
            <div className="nn-input-row nn-input-focus">
              <button
                className="nn-input-icon-btn"
                onClick={() => fileInputRef.current?.click()}
                title={isUploadingPdf ? "Attaching PDF..." : "Attach PDF"}
                disabled={isUploadingPdf}
              >
                {isUploadingPdf ? "⏳" : "📎"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt"
                style={{ display: "none" }}
                onChange={(e) => {
                  if (e.target.files?.[0]) uploadPdf(e.target.files[0]);
                  e.target.value = "";
                }}
              />
              <button
                className="nn-input-icon-btn"
                title="Pin"
              >
                📍
              </button>
              <button
                className="nn-input-icon-btn"
                onClick={() => navigate("/ai-voice-tutor")}
                title="Voice input"
              >
                🎧
              </button>
              <textarea
                ref={textareaRef}
                className="nn-textarea"
                placeholder="Ask me anything..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={streaming}
              />
              {streaming ? (
                <button className="nn-send-btn nn-stop-btn" onClick={stopStreaming} title="Stop">
                  ⏹
                </button>
              ) : (
                <button
                  className={`nn-send-btn ${input.trim() ? "nn-send-active" : ""}`}
                  onClick={() => sendMessage()}
                  disabled={!input.trim()}
                  title="Send"
                >
                  ▲
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CHAT BUBBLE
   ═══════════════════════════════════════════════════════════ */
function ChatBubble({ msg }) {
  const isUser = msg.role === "user";
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={`nn-msg ${isUser ? "nn-msg-user" : "nn-msg-ai"}`}>
      {!isUser && (
        <div className="nn-avatar nn-avatar-ai">
          <span>🧠</span>
        </div>
      )}
      <div className={`nn-bubble ${isUser ? "nn-bubble-user" : "nn-bubble-ai"}`}>
        {isUser ? (
          <>
            {msg.attachments && msg.attachments.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                {msg.attachments.map(att => (
                  <div key={att} style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.2)', padding: '4px 8px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    📄 {att}
                  </div>
                ))}
              </div>
            )}
            <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{msg.content}</p>
          </>
        ) : (
          <MdContent content={msg.content} />
        )}
        {!isUser && (
          <button className="nn-copy-btn" onClick={copy}>
            {copied ? "✅ Copied" : "📋 Copy"}
          </button>
        )}
      </div>
      {isUser && (
        <div className="nn-avatar nn-avatar-user">
          <span>👤</span>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MARKDOWN RENDERER — full support: tables, hr, blockquotes
   ═══════════════════════════════════════════════════════════ */
function MdContent({ content }) {
  const lines = content.split("\n");
  const elements = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // ── Code block ────────────────────────────────────────
    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <div key={key++} className="nn-code-block">
          {lang && <div className="nn-code-lang">{lang}</div>}
          <pre className="nn-code-pre"><code>{codeLines.join("\n")}</code></pre>
        </div>
      );
      i++; // skip closing ```
      continue;
    }

    // ── Table (lines with | characters) ───────────────────
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const tableRows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableRows.push(lines[i].trim());
        i++;
      }
      // Filter out separator rows like |---|---|
      const isHeaderSep = (row) => /^\|[\s\-:|]+\|$/.test(row);
      const headerRow = tableRows[0];
      const bodyRows = tableRows.filter((r, idx) => idx !== 0 && !isHeaderSep(r));
      const parseCells = (row) =>
        row.split("|").slice(1, -1).map(c => c.trim());

      elements.push(
        <div key={key++} className="nn-table-wrap">
          <table className="nn-table">
            <thead>
              <tr>
                {parseCells(headerRow).map((cell, ci) => (
                  <th key={ci} className="nn-th">{fmtInline(cell)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr key={ri} className="nn-tr">
                  {parseCells(row).map((cell, ci) => (
                    <td key={ci} className="nn-td">{fmtInline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // ── Horizontal rule ────────────────────────────────────
    if (/^[-*_]{3,}$/.test(trimmed)) {
      elements.push(<div key={key++} className="nn-hr" />);
      i++;
      continue;
    }

    // ── Blockquote ─────────────────────────────────────────
    if (trimmed.startsWith("> ")) {
      const bqLines = [];
      while (i < lines.length && lines[i].trim().startsWith("> ")) {
        bqLines.push(lines[i].trim().slice(2));
        i++;
      }
      elements.push(
        <div key={key++} className="nn-blockquote">
          {bqLines.map((bl, bi) => <p key={bi} className="nn-bq-p">{fmtInline(bl)}</p>)}
        </div>
      );
      continue;
    }

    // ── Headings ───────────────────────────────────────────
    if (trimmed.startsWith("#### ")) {
      elements.push(<h5 key={key++} className="nn-h5">{fmtInline(trimmed.slice(5))}</h5>);
    } else if (trimmed.startsWith("### ")) {
      elements.push(<h4 key={key++} className="nn-h4">{fmtInline(trimmed.slice(4))}</h4>);
    } else if (trimmed.startsWith("## ")) {
      elements.push(<h3 key={key++} className="nn-h3">{fmtInline(trimmed.slice(3))}</h3>);
    } else if (trimmed.startsWith("# ")) {
      elements.push(<h2 key={key++} className="nn-h2">{fmtInline(trimmed.slice(2))}</h2>);
    }
    // ── Lists ──────────────────────────────────────────────
    else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <div key={key++} className="nn-li-row">
          <span className="nn-li-bullet">▸</span>
          <span className="nn-li-text">{fmtInline(trimmed.slice(2))}</span>
        </div>
      );
    } else if (/^\d+\.\s/.test(trimmed)) {
      const dotIdx = trimmed.indexOf(". ");
      const num = trimmed.slice(0, dotIdx);
      elements.push(
        <div key={key++} className="nn-li-row nn-li-num-row">
          <span className="nn-li-num-badge">{num}</span>
          <span className="nn-li-text">{fmtInline(trimmed.slice(dotIdx + 2))}</span>
        </div>
      );
    }
    // ── Empty line ─────────────────────────────────────────
    else if (trimmed === "") {
      elements.push(<div key={key++} className="nn-spacer" />);
    }
    // ── Normal paragraph ───────────────────────────────────
    else {
      elements.push(<p key={key++} className="nn-p">{fmtInline(trimmed)}</p>);
    }

    i++;
  }

  return <div className="nn-md">{elements}</div>;
}

/** Inline formatting: **bold**, *italic*, `code` */
function fmtInline(text) {
  const parts = [];
  let rest = text;
  let k = 0;
  const patterns = [
    { re: /\*\*([^*]+)\*\*/, type: "bold" },
    { re: /\*([^*]+)\*/, type: "italic" },
    { re: /`([^`]+)`/, type: "code" },
  ];

  while (rest.length > 0) {
    let earliest = null, eType = "";
    for (const { re, type } of patterns) {
      const m = rest.match(re);
      if (m && (!earliest || m.index < earliest.index)) {
        earliest = m;
        eType = type;
      }
    }
    if (!earliest) {
      parts.push(<span key={k++}>{rest}</span>);
      break;
    }
    if (earliest.index > 0) parts.push(<span key={k++}>{rest.slice(0, earliest.index)}</span>);
    if (eType === "bold")   parts.push(<strong key={k++}>{earliest[1]}</strong>);
    else if (eType === "italic") parts.push(<em key={k++}>{earliest[1]}</em>);
    else if (eType === "code")   parts.push(<code key={k++} className="nn-inline-code">{earliest[1]}</code>);
    rest = rest.slice(earliest.index + earliest[0].length);
  }
  return parts;
}

