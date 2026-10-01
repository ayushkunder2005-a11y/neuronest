import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import useGeminiAudio from "../hooks/useGeminiAudio";
import { askJarvis } from "../services/jarvisService";

const tones = ["encouraging", "Socratic", "exam-focused"];
const modalities = ["voice", "text", "example", "visual"];

export default function AIPremiumTutor({ onScheduleReminder, onRequestHumanTutor }) {
  const [profile, setProfile] = useState({
    subjectLevel: "",
    goal: "",
    learningStyle: "",
  });
  const [diagnostic, setDiagnostic] = useState({
    subject: "",
    priorKnowledge: "",
    learningGoal: "",
    preferredPace: "standard",
  });
  const [tone, setTone] = useState(tones[0]);
  const [commandInput, setCommandInput] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [isSidebarOpen] = useState(true);
  const [chatMessages, setChatMessages] = useState([
    {
      role: "ai",
      text: "Jarvis Premium Tutor online. Ask a question or upload study material for narration.",
    },
  ]);
  const [knowledgeAssets, setKnowledgeAssets] = useState([]);
  const [jarvisVoiceEnabled, setJarvisVoiceEnabled] = useState(false);
  const [jarvisVoiceStatus, setJarvisVoiceStatus] = useState("Jarvis voice idle.");
  const [jarvisSpeaking, setJarvisSpeaking] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);
  const [jarvisVoice, setJarvisVoice] = useState(null);

  const [uploadedPdfName, setUploadedPdfName] = useState("");
  const [pdfStatusMessage, setPdfStatusMessage] = useState("");
  const [mediaFileNames, setMediaFileNames] = useState([]);
  const [mediaStatusMessage, setMediaStatusMessage] = useState("");
  const pdfInputRef = useRef(null);
  const mediaInputRef = useRef(null);
  const jarvisVoiceRef = useRef(null);
  const audioHistoryCursorRef = useRef(0);

  const {
    startSession,
    stopSession,
    sendTutorCommand,
    status,
    error,
    currentTurn,
    history,
    sessionTranscript,
    lessonPlan,
    proficiencyProfile,
    recommendedResources,
  } = useGeminiAudio({
    profile,
    diagnostic,
    tutorTone: tone,
  });

  const resolveAssetKind = useCallback((filename = "") => {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (!ext) return "asset";
    if (["pdf", "ppt", "pptx", "doc", "docx", "txt"].includes(ext)) return "document";
    if (["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp"].includes(ext)) return "visual";
    if (["mp4", "mov", "avi", "mp3", "wav", "m4a", "aac", "ogg"].includes(ext)) return "media";
    return "asset";
  }, []);

  const registerAsset = useCallback(
    (name, kind) => {
      if (!name) return;
      const assetKind = kind || resolveAssetKind(name);
      setKnowledgeAssets((prev) => {
        if (prev.some((asset) => asset.name === name)) {
          return prev;
        }
        return [...prev, { name, kind: assetKind }];
      });
    },
    [resolveAssetKind]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      setJarvisVoiceStatus("Jarvis voice unavailable in this environment.");
      return;
    }
    const synth = window.speechSynthesis || null;
    jarvisVoiceRef.current = synth;
    const supported = Boolean(synth);
    setTtsSupported(supported);
    if (!supported) {
      setJarvisVoiceStatus("Browser cannot play Jarvis voice; text coaching only.");
      return;
    }
    const hydrateVoice = () => {
      const voices = synth.getVoices?.() || [];
      if (!voices.length) return;
      const preferred =
        voices.find((voice) => /Daniel|Brian|UK|en-GB|Male|Jarvis/i.test(voice.name)) || voices[0];
      setJarvisVoice(preferred);
    };
    hydrateVoice();
    synth.onvoiceschanged = hydrateVoice;
    setJarvisVoiceStatus("Jarvis voice ready. Enable it when you want narrated lessons.");
    return () => {
      synth.onvoiceschanged = null;
      synth?.cancel();
    };
  }, []);

  const toggleJarvisVoice = useCallback(() => {
    if (!ttsSupported) {
      setJarvisVoiceStatus("Browser cannot enable Jarvis voice.");
      return;
    }
    setJarvisVoiceEnabled((prev) => {
      const next = !prev;
      setJarvisVoiceStatus(
        next ? "Jarvis voice armed. Next answers will be narrated." : "Jarvis voice muted."
      );
      if (!next) {
        jarvisVoiceRef.current?.cancel?.();
        setJarvisSpeaking(false);
      }
      return next;
    });
  }, [ttsSupported]);

  const speakJarvis = useCallback(
    (text) => {
      if (!jarvisVoiceEnabled || !ttsSupported || !jarvisVoiceRef.current || !text) {
        return;
      }
      if (typeof window === "undefined" || typeof window.SpeechSynthesisUtterance === "undefined") {
        setJarvisVoiceStatus("Speech synthesis unsupported in this environment.");
        return;
      }
      const synth = jarvisVoiceRef.current;
      synth.cancel();
      try {
        const utterance = new window.SpeechSynthesisUtterance(text);
        if (jarvisVoice) {
          utterance.voice = jarvisVoice;
        }
        utterance.pitch = 0.9;
        utterance.rate = 1.02;
        utterance.volume = 0.92;
        utterance.onstart = () => {
          setJarvisSpeaking(true);
          setJarvisVoiceStatus("Jarvis is teaching out loud...");
        };
        utterance.onend = () => {
          setJarvisSpeaking(false);
          setJarvisVoiceStatus("Jarvis voice idle.");
        };
        synth.speak(utterance);
      } catch {
        setJarvisVoiceStatus("Unable to start Jarvis voice. Keeping responses in text.");
        setJarvisSpeaking(false);
      }
    },
    [jarvisVoice, jarvisVoiceEnabled, ttsSupported]
  );

  const handleJarvisTeach = useCallback(() => {
    const hasAssets = knowledgeAssets.length > 0;
    const highlight = hasAssets
      ? knowledgeAssets.slice(-3).map((asset) => asset.name).join(", ")
      : null;
    const script = hasAssets
      ? `Synchronizing Jarvis voice with ${highlight}. I'll narrate a walkthrough using those uploads.`
      : "Upload a PDF, PPTX, or visual so Jarvis can teach directly from it.";
    setChatMessages((prev) => [...prev, { role: "ai", text: script, source: "jarvis" }]);
    speakJarvis(script);
  }, [knowledgeAssets, speakJarvis]);

  useEffect(() => stopSession, [stopSession]);

  useEffect(() => {
    if (!history.length) {
      audioHistoryCursorRef.current = 0;
      return;
    }
    if (history.length < audioHistoryCursorRef.current) {
      audioHistoryCursorRef.current = 0;
    }
    if (audioHistoryCursorRef.current === history.length) {
      return;
    }
    const newTurns = history.slice(audioHistoryCursorRef.current);
    audioHistoryCursorRef.current = history.length;
    if (!newTurns.length) return;
    setChatMessages((prev) => {
      const merged = [...prev];
      newTurns.forEach(({ user, model }) => {
        if (user) merged.push({ role: "user", text: user, source: "voice" });
        if (model) merged.push({ role: "ai", text: model, source: "voice" });
      });
      return merged;
    });
  }, [history]);

  const summary = useMemo(
    () => ({
      turns: history.length,
      resources: recommendedResources.length,
      transcriptLength: sessionTranscript.length,
    }),
    [history.length, recommendedResources.length, sessionTranscript.length]
  );

  const conversation = useMemo(() => {
    const base = chatMessages.length
      ? chatMessages
      : [{ role: "ai", text: "Welcome back! How can I help today?" }];
    const enriched = [...base];
    if (currentTurn.user) {
      enriched.push({ role: "user", text: currentTurn.user, transient: true });
    }
    if (currentTurn.model) {
      enriched.push({ role: "ai", text: currentTurn.model, transient: true });
    }
    return enriched;
  }, [chatMessages, currentTurn.model, currentTurn.user]);

  const generateJarvisReply = useCallback(
    (prompt) => {
      const toneHooks = {
        encouraging: "Let's tackle it together with steady momentum.",
        Socratic: "I'll question each assumption until the insight lands.",
        "exam-focused": "Targeting exam-ready precision for this answer.",
      };
      const contextBits = [
        knowledgeAssets.length
          ? `Referencing ${knowledgeAssets.slice(-3).map((asset) => asset.name).join(", ")}.`
          : "No uploads detected, so I'll lean on my internal knowledge base.",
        diagnostic.subject && `Focus: ${diagnostic.subject}.`,
        (diagnostic.learningGoal || profile.goal) &&
          `Goal: ${diagnostic.learningGoal || profile.goal}.`,
        profile.learningStyle && `Style preference: ${profile.learningStyle}.`,
        diagnostic.preferredPace !== "standard" &&
          diagnostic.preferredPace &&
          `Pace set to ${diagnostic.preferredPace}.`,
      ]
        .filter(Boolean)
        .join(" ");
      return `${toneHooks[tone] || toneHooks.encouraging} ${contextBits} Here's how we'll handle "${prompt}": 1) clarify the core idea, 2) apply it with an example, and 3) run a Jarvis comprehension check.`;
    },
    [
      diagnostic.learningGoal,
      diagnostic.preferredPace,
      diagnostic.subject,
      knowledgeAssets,
      profile.goal,
      profile.learningStyle,
      tone,
    ]
  );

  const handleProfileChange = (field, value) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const handleDiagnosticChange = (field, value) => {
    setDiagnostic((prev) => ({ ...prev, [field]: value }));
  };

  const handleCommand = (command, payload = {}) => {
    sendTutorCommand(command, {
      profile,
      diagnostic,
      tone,
      ...payload,
    });
  };

  const handleConsoleSubmit = (event) => {
    event?.preventDefault();
    if (!commandInput.trim()) return;
    handleCommand(commandInput.trim());
    setCommandInput("");
  };

  const handleChatSubmit = async (event) => {
    event?.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    setChatMessages((prev) => [...prev, { role: "user", text: trimmed, source: "chat" }]);
    setChatInput("");
    try {
      const reply = await askJarvis(trimmed);
      setChatMessages((prev) => [...prev, { role: "ai", text: reply, source: "jarvis" }]);
      speakJarvis(reply);
    } catch (err) {
      const fallback = generateJarvisReply(trimmed);
      setChatMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: `${fallback} (Jarvis API offline - using local fallback.)`,
          source: "fallback",
        },
      ]);
      speakJarvis(fallback);
    }
    if (isLive) {
      handleCommand("chat-exchange", { message: trimmed });
    }
  };

  const isLive = status === "connected" || status === "connecting";

  const toggleVoiceSession = () => {
    if (isLive) {
      stopSession();
    } else {
      startSession();
    }
  };

  const exportSessionJson = () => {
    const payload = {
      profile,
      diagnostic,
      history,
      sessionTranscript,
      lessonPlan,
      proficiencyProfile,
      recommendedResources,
    };
    if (typeof window === "undefined") return payload;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "ai-premium-tutor-session.json";
    link.click();
    URL.revokeObjectURL(link.href);
    return payload;
  };

  const exportSessionText = () => {
    if (typeof window === "undefined") return sessionTranscript;
    const blob = new Blob([sessionTranscript], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "ai-premium-tutor-session.txt";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleUploadPdfClick = () => {
    setPdfStatusMessage("");
    pdfInputRef.current?.click();
  };

  const handlePdfSelection = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) {
      setPdfStatusMessage("No file selected.");
      return;
    }
    const names = files.map((file) => file.name);
    setUploadedPdfName(names.join(", "));
    setPdfStatusMessage(
      names.length === 1
        ? `${names[0]} ready for Jarvis voice mode.`
        : `${names.length} documents ready for Jarvis voice mode.`
    );
    names.forEach((name) => registerAsset(name));
    event.target.value = "";
  };

  const handleAttachMediaClick = () => {
    setMediaStatusMessage("");
    mediaInputRef.current?.click();
  };

  const handleMediaSelection = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) {
      setMediaStatusMessage("No files selected.");
      return;
    }
    const names = files.map((file) => file.name);
    setMediaFileNames(names);
    setMediaStatusMessage(
      names.length === 1
        ? `${names[0]} synced to the Jarvis knowledge vault.`
        : `${names.length} files synced to the Jarvis knowledge vault.`
    );
    names.forEach((name) => registerAsset(name));
    event.target.value = "";
  };


  return (
    <div className={`premium-tutor-shell chatgpt-clone ${isSidebarOpen ? "sidebar-open" : ""}`}>
      <aside className="chat-sidebar">
        <div className="sidebar-header">
            <h3>AI Tutor Controls</h3>
        </div>
        <div className="sidebar-content">
        <div className="premium-summary-grid">
        <section>
          <h4>Session Intelligence</h4>
          <p>Turns: {summary.turns}</p>
          <p>Transcript length: {summary.transcriptLength} characters</p>
          <p>Resources suggested: {summary.resources}</p>
          <div className="export-row">
            <button type="button" onClick={exportSessionText}>
              Export Transcript (txt)
            </button>
            <button type="button" onClick={exportSessionJson}>
              Export Data (json)
            </button>
          </div>
        </section>

        <section>
          <h4>Insights</h4>
          <div className="insight-block">
            <h5>Lesson Plan</h5>
            <pre>{lessonPlan ? JSON.stringify(lessonPlan, null, 2) : "No lesson plan yet."}</pre>
          </div>
        </section>

        <section>
          <h4>Proficiency Profile</h4>
          <pre>{proficiencyProfile ? JSON.stringify(proficiencyProfile, null, 2) : "No data yet."}</pre>
        </section>

        <section>
          <h4>Resources</h4>
          {recommendedResources.length ? (
            <ul>
              {recommendedResources.map((resource, index) => (
                <li key={`${resource.title}-${index}`}>
                  {resource.title} ({resource.type})
                </li>
              ))}
            </ul>
          ) : (
            <p>No resources yet.</p>
          )}
        </section>
      </div>
      </div>
      </aside>
      <main className="chat-main">
        <div className="chat-window">
             {conversation.map((entry, index) => (
              <div key={`${entry.role}-${index}`} className={`premium-message ${entry.role}`}>
                <div className="premium-avatar">{entry.role === "ai" ? "AI" : "You"}</div>
                <div className="premium-bubble">{entry.text}</div>
              </div>
            ))}
        </div>
        <div className="chat-input-area">
        <form className="chatgpt-prompt" onSubmit={handleChatSubmit}>
          <input
            className="prompt-input"
            type="text"
            placeholder="Ask anything..."
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
          />
          <button
            type="button"
            className={`prompt-icon mic ${isLive ? "active" : ""}`}
            onClick={toggleVoiceSession}
            aria-label={isLive ? "Stop voice tutor" : "Start voice tutor"}
          >
            <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 14 0h-2Zm-5 8a1 1 0 0 0 1-1v-2h-2v2a1 1 0 0 0 1 1Z"
              />
            </svg>
          </button>
          <button type="submit" className="prompt-icon-send" aria-label="Send prompt">
            <span>&#10148;</span>
          </button>
        </form>
        <div className="hero-meta">
          <span>AI can make mistakes. Consider checking important information.</span>
        </div>
        </div>
      </main>
    </div>
  );
}
