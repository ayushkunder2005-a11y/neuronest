import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
const ARENA_API = "http://localhost:8002";
import "../styles/aiTwinArena.css";
import { addXP, recordActivity } from "../utils/gamification";

const getUserId = () => {
  try {
    const raw = window.localStorage.getItem("user") || window.sessionStorage.getItem("user");
    const user = raw ? JSON.parse(raw) : null;
    return user?.uid || user?.firebaseUid || user?._id || user?.id || "default";
  } catch {
    return "default";
  }
};

/* ── Arena API helpers ──────────────────────────────────────────────── */
const arenaApi = async (path, body) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90000); // 90s — large model needs time
  try {
    const res = await fetch(`${ARENA_API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, userId: getUserId() }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Arena API ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
};

/* ── Constants ──────────────────────────────────────────────────────── */

const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced", "Elite"];
const DOMAINS = ["Coding", "Logic", "Mathematics", "Science", "General Knowledge", "Verbal", "Debate"];

const LEVELS = [
  { name: "Beginner", icon: "🌱", min: 0 },
  { name: "Learner", icon: "📚", min: 200 },
  { name: "Challenger", icon: "🔥", min: 500 },
  { name: "Advanced", icon: "⚡", min: 1000 },
  { name: "Elite", icon: "💎", min: 2000 },
  { name: "Genius", icon: "🧠", min: 4000 },
];

const TITLES = {
  logic: "Logic Master",
  speed: "Speed Demon",
  accuracy: "Precision Hunter",
  strategy: "Grand Strategist",
  reflex: "Reflex King",
};

function getLevel(xp) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].min) return LEVELS[i];
  }
  return LEVELS[0];
}

/* ── Battle questions bank ──────────────────────────────────────────── */
function generateQuestion(domain, difficulty) {
  const diffMult = { Beginner: 1, Intermediate: 2, Advanced: 3, Elite: 4 };
  const d = diffMult[difficulty] || 1;

  const banks = {
    Coding: [
      { q: "What does `typeof null` return in JavaScript?", a: "object", opts: ["null", "object", "undefined", "string"], twin: "object", explanation: "This is a famous JavaScript quirk — typeof null returns 'object' due to a legacy bug in JS." },
      { q: "Which data structure uses LIFO (Last In, First Out)?", a: "Stack", opts: ["Queue", "Stack", "Heap", "Tree"], twin: "Stack", explanation: "A Stack follows LIFO — the last element pushed is the first one popped." },
      { q: "What is the time complexity of binary search?", a: "O(log n)", opts: ["O(n)", "O(n²)", "O(log n)", "O(1)"], twin: "O(log n)", explanation: "Binary search halves the search space each step, giving O(log n) complexity." },
      { q: "What does CSS `z-index` control?", a: "Stacking order", opts: ["Width", "Stacking order", "Opacity", "Position"], twin: "Stacking order", explanation: "z-index controls the stacking order of positioned elements along the z-axis." },
      { q: "In Python, what is a list comprehension?", a: "A concise way to create lists", opts: ["A sorting algorithm", "A concise way to create lists", "A class method", "An import statement"], twin: "A concise way to create lists", explanation: "List comprehension provides a compact syntax: [expr for item in iterable]." },
    ],
    Logic: [
      { q: "If all roses are flowers, and all flowers need water, do all roses need water?", a: "Yes", opts: ["Yes", "No", "Cannot determine", "Sometimes"], twin: "Yes", explanation: "Transitive logic: Roses → Flowers → Need water, therefore Roses → Need water." },
      { q: "A bat and ball cost $1.10. The bat costs $1 more than the ball. How much is the ball?", a: "$0.05", opts: ["$0.10", "$0.05", "$0.15", "$0.20"], twin: "$0.05", explanation: "Ball=$0.05, Bat=$1.05. Total=$1.10. Many say $0.10 — that's the cognitive trap!" },
      { q: "What is the next number in: 2, 6, 12, 20, 30, ___?", a: "42", opts: ["36", "40", "42", "44"], twin: "42", explanation: "Pattern: n*(n+1) → 1×2, 2×3, 3×4, 4×5, 5×6, 6×7=42." },
      { q: "If today is Wednesday, what day will it be 100 days from now?", a: "Friday", opts: ["Monday", "Thursday", "Friday", "Saturday"], twin: "Friday", explanation: "100 mod 7 = 2. Wednesday + 2 days = Friday." },
    ],
    Mathematics: [
      { q: "What is the derivative of sin(x)?", a: "cos(x)", opts: ["sin(x)", "cos(x)", "-cos(x)", "tan(x)"], twin: "cos(x)", explanation: "d/dx[sin(x)] = cos(x) — a fundamental calculus result." },
      { q: "How many prime numbers exist between 1 and 20?", a: "8", opts: ["6", "7", "8", "9"], twin: "8", explanation: "Primes: 2,3,5,7,11,13,17,19 = 8 primes." },
      { q: "What is 15% of 240?", a: "36", opts: ["30", "32", "36", "40"], twin: "36", explanation: "15% of 240 = 0.15 × 240 = 36." },
    ],
    General_Knowledge: [
      { q: "What is the powerhouse of the cell?", a: "Mitochondria", opts: ["Nucleus", "Ribosome", "Mitochondria", "Golgi Apparatus"], twin: "Mitochondria", explanation: "Mitochondria produce ATP through cellular respiration — the cell's energy currency." },
      { q: "Which planet has the most moons?", a: "Saturn", opts: ["Jupiter", "Saturn", "Uranus", "Neptune"], twin: "Saturn", explanation: "Saturn leads with 146 confirmed moons as of recent discoveries." },
      { q: "Who painted the Mona Lisa?", a: "Leonardo da Vinci", opts: ["Michelangelo", "Raphael", "Leonardo da Vinci", "Picasso"], twin: "Leonardo da Vinci", explanation: "Leonardo da Vinci painted the Mona Lisa between 1503–1519." },
    ],
    Science: [
      { q: "What is the speed of light in a vacuum (approx)?", a: "3×10⁸ m/s", opts: ["3×10⁶ m/s", "3×10⁷ m/s", "3×10⁸ m/s", "3×10⁹ m/s"], twin: "3×10⁸ m/s", explanation: "Light travels at approximately 299,792,458 m/s ≈ 3×10⁸ m/s." },
      { q: "What does DNA stand for?", a: "Deoxyribonucleic Acid", opts: ["Deoxyribonucleic Acid", "Dynamic Nucleic Acid", "Dual Nucleotide Array", "Direct Neural Amplifier"], twin: "Deoxyribonucleic Acid", explanation: "DNA (Deoxyribonucleic Acid) carries the genetic blueprint of all living organisms." },
    ],
    Verbal: [
      { q: "What is the synonym of 'Ephemeral'?", a: "Transient", opts: ["Permanent", "Transient", "Ancient", "Massive"], twin: "Transient", explanation: "Ephemeral means lasting for a very short time — synonymous with transient, fleeting." },
      { q: "Complete the analogy: Doctor : Hospital :: Teacher : ___", a: "School", opts: ["Library", "Office", "School", "Lab"], twin: "School", explanation: "Just as a Doctor works in a Hospital, a Teacher works in a School." },
    ],
    Debate: [
      { q: "Should AI be given legal rights? State your position and key argument.", a: "Open", opts: null, twin: "AI systems lack consciousness and subjective experience. Legal rights require moral agency. Until AGI demonstrates genuine self-awareness and suffering, rights would be premature — though regulations protecting against misuse are essential.", explanation: "This is a philosophical debate. Points considered: consciousness, moral agency, societal impact, and regulatory frameworks." },
      { q: "Is remote work more productive than office work? Argue your stance.", a: "Open", opts: null, twin: "Research shows mixed results. Remote work increases autonomy and reduces commute fatigue, boosting deep-work productivity. However, collaboration, spontaneous creativity, and team cohesion often suffer. Hybrid models tend to capture the best of both.", explanation: "Strong debate answers balance evidence, acknowledge counterpoints, and conclude clearly." },
    ],
  };

  const domainKey = domain.replace(" ", "_");
  const pool = banks[domainKey] || banks.Logic;
  return pool[Math.floor(Math.random() * pool.length)];
}



/* ── Scoring helpers ────────────────────────────────────────────────── */
function evaluateAnswer(userAnswer, correctAnswer, isOpen) {
  if (isOpen) {
    const wordCount = userAnswer.trim().split(/\s+/).length;
    if (wordCount < 3) return { score: 20, label: "Too brief", color: "#ef4444" };
    if (wordCount < 10) return { score: 55, label: "Basic answer", color: "#f59e0b" };
    if (wordCount < 25) return { score: 75, label: "Good effort", color: "#06b6d4" };
    return { score: 90, label: "Excellent!", color: "#10b981" };
  }
  const isCorrect = userAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
  return isCorrect
    ? { score: 100, label: "Correct! ✓", color: "#10b981" }
    : { score: 0, label: "Incorrect ✗", color: "#ef4444" };
}

/* ══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════════ */
export default function AiTwinArena() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState("lobby");
  const [difficulty, setDifficulty] = useState("Intermediate");
  const [domain, setDomain] = useState("Logic");
  const [uploadFile, setUploadFile] = useState(null);

  // Session state
  const [question, setQuestion] = useState(null);
  const [userInput, setUserInput] = useState("");
  const [selectedOpt, setSelectedOpt] = useState(null);
  const [result, setResult] = useState(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [sessionResults, setSessionResults] = useState([]);
  const [sessionQuestions, setSessionQuestions] = useState([]);
  const sessionStart = useRef(Date.now());

  // AI loading & source tracking
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSource, setAiSource] = useState(null); // 'ollama' | 'fallback'
  const [aiError, setAiError] = useState(null);

  // Profile / XP
  const [profile, setProfile] = useState(() => {
    const saved = localStorage.getItem(`arena_profile_${getUserId()}`);
    return saved ? JSON.parse(saved) : {
      xp: 0, streak: 0, accuracy: 0, sessions: 0,
      totalAnswered: 0, correctAnswers: 0,
      titles: [], weakAreas: [], strongAreas: [], history: [],
    };
  });

  const saveProfile = useCallback((updated) => {
    setProfile(updated);
    localStorage.setItem(`arena_profile_${getUserId()}`, JSON.stringify(updated));
  }, []);

  /* ── Launch Battle Mode (calls Ollama API) ──────────────────────── */
  const launchArena = useCallback(async () => {
    setResult(null);
    setUserInput("");
    setSelectedOpt(null);
    setAiError(null);
    setQuestion(null);
    setQuestionCount(prev => prev + 1);
    setPhase("arena");
    setAiLoading(true);
    try {
      let data;
      if (uploadFile) {
        const formData = new FormData();
        formData.append("domain", domain);
        formData.append("difficulty", difficulty);
        formData.append("userId", getUserId());
        formData.append("file", uploadFile);

        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 90000);
        const res = await fetch(`${ARENA_API}/arena/challenge-pdf`, {
          method: "POST",
          body: formData,
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`PDF API ${res.status}`);
        data = await res.json();
      } else {
        data = await arenaApi("/arena/question", { domain, difficulty, mode: "battle" });
      }
      
      const q = data.question || {};
      setQuestion({
        q: q.question,
        a: q.answer,
        opts: q.options || null,
        twin: q.twin_answer || q.answer,
        explanation: q.explanation || "",
      });
      setAiSource(q.source || "ollama");
    } catch (e) {
      setAiError("Could not reach Ollama. Using local question.");
      const fb = generateQuestion(domain, difficulty);
      setQuestion(fb);
      setAiSource("fallback");
    } finally {
      if (uploadFile) setUploadFile(null); // Clear file after use
      setAiLoading(false);
    }
  }, [domain, difficulty, uploadFile]);

  /* ── Submit answer (calls Ollama /arena/evaluate for smart feedback) */
  const submitAnswer = useCallback(async () => {
    const answer = selectedOpt || userInput;
    if (!answer.trim()) return;

    let evaluation;
    let correct = false;
    const isOpen = question?.opts === null;

    try {
      const data = await arenaApi("/arena/evaluate", {
        question: question?.q,
        correctAnswer: question?.a,
        userAnswer: answer,
        twinAnswer: question?.twin,
        isOpen,
        domain,
      });
      const ev = data.evaluation || {};
      evaluation = { score: ev.score ?? 0, label: ev.label ?? "Evaluated", color: ev.score >= 80 ? "#10b981" : ev.score >= 50 ? "#f59e0b" : "#ef4444", feedback: ev.feedback, strengths: ev.strengths, improvements: ev.improvements };
      correct = ev.winner === "user" || (ev.score >= 80);
    } catch {
      evaluation = evaluateAnswer(answer, question?.a || "", isOpen);
      correct = evaluation.score >= 80;
    }
    const xpEarned = correct ? (difficulty === "Elite" ? 50 : difficulty === "Advanced" ? 30 : difficulty === "Intermediate" ? 20 : 10) : 5;

    const updatedProfile = {
      ...profile,
      xp: profile.xp + xpEarned,
      totalAnswered: profile.totalAnswered + 1,
      correctAnswers: profile.correctAnswers + (correct ? 1 : 0),
      accuracy: Math.round(((profile.correctAnswers + (correct ? 1 : 0)) / (profile.totalAnswered + 1)) * 100),
    };
    if (updatedProfile.accuracy >= 85 && !updatedProfile.titles.includes(TITLES.accuracy)) updatedProfile.titles.push(TITLES.accuracy);
    saveProfile(updatedProfile);
    // Also feed Arena XP into the main gamification system (Progress Intelligence)
    if (xpEarned > 0) addXP(xpEarned, "arena");
    setResult({ evaluation, xpEarned, correct, answer, twinAnswer: question?.twin || "" });
    setSessionResults(prev => [...prev, { correct, score: evaluation.score, domain }]);
    setSessionQuestions(prev => [...prev, {
      question: question?.q,
      options: question?.opts || [],
      correct: question?.a,
      explanation: question?.explanation || "",
      userAnswer: answer,
    }]);
  }, [selectedOpt, userInput, question, profile, difficulty, domain, saveProfile]);

  /* ── Next question ──────────────────────────────────────────────── */
  const nextChallenge = useCallback(() => {
    setResult(null); setUserInput(""); setSelectedOpt(null);
    launchArena();
  }, [launchArena]);

  /* ── End session ─────────────────────────────────────────────────── */
  const endSession = useCallback(async () => {
    const avg = sessionResults.length ? Math.round(sessionResults.reduce((s, r) => s + r.score, 0) / sessionResults.length) : 0;
    const updatedProfile = {
      ...profile,
      sessions: profile.sessions + 1,
      streak: avg >= 70 ? profile.streak + 1 : 0,
      history: [...(profile.history || []).slice(-9), { date: new Date().toLocaleDateString(), mode: "battle", domain, difficulty, score: avg, questions: sessionResults.length }],
    };
    saveProfile(updatedProfile);
    recordActivity("arena");

    // Save session to Time Capsule if at least one question was answered
    if (sessionQuestions.length > 0) {
      try {
        const token = localStorage.getItem("token") || "";
        const elapsedSeconds = Math.round((Date.now() - sessionStart.current) / 1000);
        await fetch("http://localhost:5000/api/rewards/time-capsule/create", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({
            topic: domain,
            difficulty: difficulty.toLowerCase(),
            questions: sessionQuestions.map(sq => ({
              question: sq.question,
              options: sq.options || [],
              correct: sq.correct,
              explanation: sq.explanation || "",
            })),
            answers: sessionQuestions.map(sq => sq.userAnswer),
            score: avg,
            time: elapsedSeconds,
          }),
        });
        console.log("[Time Capsule] Session saved successfully ✓");
      } catch (e) {
        console.warn("[Time Capsule] Failed to save session:", e.message);
      }
    }

    sessionStart.current = Date.now();
    setSessionResults([]); setSessionQuestions([]); setQuestionCount(0);
    setPhase("evolution");
  }, [sessionResults, sessionQuestions, profile, domain, difficulty, saveProfile]);

  const level = getLevel(profile.xp);
  const nextLevel = LEVELS.find(l => l.min > profile.xp);
  const xpToNext = nextLevel ? nextLevel.min - profile.xp : 0;
  const xpProgress = nextLevel ? ((profile.xp - level.min) / (nextLevel.min - level.min)) * 100 : 100;


  /* ══ RENDER ══════════════════════════════════════════════════════ */
  return (
    <div className="arena-page">
      {/* Header */}
      <header className="arena-header">
        <button className="arena-back-btn" onClick={() => navigate("/ai-twin")}>
          ← AI Twin
        </button>
        <div className="arena-title-block">
          <span className="arena-header-icon">⚔️</span>
          <div>
            <h1>AI Twin Arena</h1>
            <p>Cognitive Simulation & Competitive Intelligence</p>
          </div>
        </div>
        <div className="arena-header-profile">
          <div className="arena-xp-bar-mini">
            <span className="arena-level-icon">{level.icon}</span>
            <div className="arena-xp-track">
              <div className="arena-xp-fill" style={{ width: `${xpProgress}%` }} />
            </div>
            <span className="arena-xp-label">{profile.xp} XP</span>
          </div>
          <span className="arena-level-name">{level.name}</span>
        </div>
      </header>

      <div className="arena-body">
        {/* ── LOBBY ── */}
        {phase === "lobby" && (
          <div className="arena-lobby">

            {/* Hero */}
            <div className="arena-lobby-hero">
              <div className="arena-hero-glow" />
              <div className="arena-hero-icon-wrap">
                <span className="arena-hero-icon-bg">⚔️</span>
              </div>
              <h2>AI Twin Battle Arena</h2>
              <p>Face your AI Twin in head-to-head quiz battles across coding, logic, math & more. Earn XP. Climb levels. Dominate.</p>
            </div>

            {/* Battle feature card */}
            <div className="arena-battle-card">
              <div className="arena-battle-card-left">
                <div className="arena-battle-badge">⚔️ Battle Mode</div>
                <p className="arena-battle-desc">Quiz battles, logic challenges, coding duels &amp; debate matches — go head-to-head with your AI Twin and see who wins.</p>
                <div className="arena-battle-tags">
                  <span>🧠 Quiz</span><span>🔢 Logic</span><span>💻 Coding</span><span>💬 Debate</span>
                </div>
              </div>
              <div className="arena-battle-card-right">
                <div className="arena-vs-mini">
                  <div className="arena-vs-player"><span>🤖</span><small>AI Twin</small></div>
                  <div className="arena-vs-label">VS</div>
                  <div className="arena-vs-player"><span>👤</span><small>You</small></div>
                </div>
              </div>
            </div>

            {/* Configure + Launch */}
            <div className="arena-setup-panel">
              <div className="arena-setup-row">
                <div className="arena-setup-group">
                  <label>⚡ Difficulty</label>
                  <div className="arena-btn-group">
                    {DIFFICULTIES.map(d => (
                      <button
                        key={d}
                        className={`arena-opt-btn ${difficulty === d ? "active" : ""}`}
                        onClick={() => setDifficulty(d)}
                      >{d}</button>
                    ))}
                  </div>
                </div>
                <div className="arena-setup-group">
                  <label>🎯 Domain</label>
                  <div className="arena-btn-group domain-group">
                    {DOMAINS.map(d => (
                      <button
                        key={d}
                        className={`arena-opt-btn ${domain === d ? "active" : ""}`}
                        onClick={() => setDomain(d)}
                      >{d}</button>
                    ))}
                  </div>
                </div>
                <div className="arena-setup-group" style={{ width: "100%", marginTop: "15px" }}>
                  <label>📄 Challenge from PDF (Optional)</label>
                  <input 
                    type="file" 
                    accept=".pdf" 
                    onChange={(e) => setUploadFile(e.target.files[0])} 
                    style={{ background: "rgba(255,255,255,0.05)", padding: "10px", borderRadius: "12px", border: "1px dashed rgba(255,255,255,0.2)", color: "#fff", width: "100%", outline: "none", cursor: "pointer", fontFamily: "inherit"}} 
                  />
                </div>
              </div>
              <button className="arena-launch-btn" onClick={launchArena}>
                ⚔️ Enter the Battle
              </button>
            </div>

            {/* Stats row */}
            <div className="arena-lobby-stats">
              <div className="arena-stat-card">
                <span className="stat-icon">🏆</span>
                <div>
                  <div className="stat-val">{profile.xp}</div>
                  <div className="stat-label">Total XP</div>
                </div>
              </div>
              <div className="arena-stat-card">
                <span className="stat-icon">🎯</span>
                <div>
                  <div className="stat-val">{profile.accuracy}%</div>
                  <div className="stat-label">Accuracy</div>
                </div>
              </div>
              <div className="arena-stat-card">
                <span className="stat-icon">🔥</span>
                <div>
                  <div className="stat-val">{profile.streak}</div>
                  <div className="stat-label">Win Streak</div>
                </div>
              </div>
              <div className="arena-stat-card">
                <span className="stat-icon">⚡</span>
                <div>
                  <div className="stat-val">{profile.sessions}</div>
                  <div className="stat-label">Sessions</div>
                </div>
              </div>
            </div>

            {/* Titles */}
            {profile.titles.length > 0 && (
              <div className="arena-titles-bar">
                <span className="titles-label">🏅 Your Titles:</span>
                {profile.titles.map(t => (
                  <span key={t} className="arena-title-badge">{t}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ARENA — AI LOADING SPINNER ── */}
        {phase === "arena" && aiLoading && (
          <div className="arena-ai-loading">
            <div className="ai-loading-orb">
              <div className="ai-orb-pulse" />
              <span className="ai-orb-icon">✨</span>
            </div>
            <div className="ai-loading-text">
              <span className="ai-loading-title">Ollama & Gemini are synthesizing your challenge...</span>
              <span className="ai-loading-sub">Powered by <strong>Ensemble AI</strong> — may take 15-30s</span>
            </div>
          </div>
        )}

        {/* ── ARENA ERROR BANNER ── */}
        {phase === "arena" && aiError && (
          <div className="arena-ai-error">
            <span>⚠️</span> {aiError} <span className="arena-ai-source-badge fallback">📦 Static Fallback</span>
          </div>
        )}

        {/* ── ARENA — BATTLE MODE ── */}
        {phase === "arena" && !aiLoading && question && (
          <>
            {aiSource && (
              <div className="arena-ai-badge-row">
                <span className={`arena-ai-source-badge ${aiSource}`}>
                  {aiSource === "ensemble" ? "✨ Ensemble AI (Ollama + Gemini)" : aiSource === "ollama" ? "🤖 Ollama AI" : "📦 Fallback"}
                </span>
                {(aiSource === "ollama" || aiSource === "ensemble") && <span className="arena-model-label">gpt-oss:120b-cloud</span>}
              </div>
            )}
            <BattleArena
              question={question}
              selectedOpt={selectedOpt}
              setSelectedOpt={setSelectedOpt}
              userInput={userInput}
              setUserInput={setUserInput}
              result={result}
              onSubmit={submitAnswer}
              onNext={nextChallenge}
              onEndSession={endSession}
              questionCount={questionCount}
              difficulty={difficulty}
              domain={domain}
              mode="battle"
              profile={profile}
            />
          </>
        )}

        {/* ── EVOLUTION REPORT ── */}
        {phase === "evolution" && (
          <EvolutionReport
            profile={profile}
            level={level}
            nextLevel={nextLevel}
            xpToNext={xpToNext}
            xpProgress={xpProgress}
            onBack={() => setPhase("lobby")}
          />
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   BATTLE ARENA
   ══════════════════════════════════════════════════════════════════════ */
function BattleArena({ question, selectedOpt, setSelectedOpt, userInput, setUserInput, result, onSubmit, onNext, onEndSession, questionCount, difficulty, domain, mode, simTimeLeft, simRunning, profile }) {
  const isOpen = question.opts === null;
  const inputRef = useRef(null);
  const [twinLocked, setTwinLocked] = useState(false);

  useEffect(() => { if (isOpen && inputRef.current) inputRef.current.focus(); }, [isOpen]);

  useEffect(() => {
    setTwinLocked(false);
    if (!result) {
      const delay = Math.floor(Math.random() * 4000) + 2000;
      const timer = setTimeout(() => setTwinLocked(true), delay);
      return () => clearTimeout(timer);
    }
  }, [question, result]);

  return (
    <div className="arena-zone">
      <div className="arena-zone-header">
        <div className="arena-zone-meta">
          <span className="arena-mode-tag">{mode === "simulation" ? "🎯 SIMULATION" : "⚔️ BATTLE"}</span>
          <span className="arena-domain-tag">{domain}</span>
          <span className="arena-difficulty-tag">{difficulty}</span>
          <span className="arena-q-count">Q{questionCount}</span>
        </div>
        {mode === "simulation" && (
          <div className={`sim-timer ${simTimeLeft <= 10 ? "urgent" : ""}`}>
            ⏱ {simTimeLeft}s
          </div>
        )}
      </div>

      <div className="arena-vs-layout">
        {/* AI TWIN block */}
        <div className="arena-competitor ai-twin-competitor">
          <div className="competitor-avatar">🤖</div>
          <div className="competitor-name">AI Twin</div>
          {result && (
            <div className="competitor-answer revealed">
              <span className="answer-label">Answer:</span>
              <span className="answer-text">{question.twin}</span>
              <span className="answer-verdict correct">✓ Correct</span>
            </div>
          )}
          {!result && (
            <div className={`competitor-answer ${twinLocked ? "locked" : "thinking"}`} style={twinLocked ? { color: "#10b981", fontWeight: "600", border: "1px dashed #10b981", background: "rgba(16,185,129,0.05)" } : {}}>
              {twinLocked ? (
                <>
                  <span className="locked-icon">🔒</span>
                  <span>AI Twin has locked an answer!</span>
                </>
              ) : (
                <>
                  <span className="thinking-dots"><span/><span/><span/></span>
                  <span>Thinking…</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* VS divider */}
        <div className="arena-vs-divider">
          <span className="vs-text">VS</span>
        </div>

        {/* USER block */}
        <div className="arena-competitor user-competitor">
          <div className="competitor-avatar">👤</div>
          <div className="competitor-name">You</div>
          {result ? (
            <div className={`competitor-answer revealed ${result.correct ? "correct" : "wrong"}`}>
              <span className="answer-label">Your Answer:</span>
              <span className="answer-text">{result.answer}</span>
              <span className={`answer-verdict ${result.correct ? "correct" : "incorrect"}`}>
                {result.evaluation.label}
              </span>
            </div>
          ) : (
            <div className="competitor-input-zone">
              {isOpen ? (
                <textarea
                  ref={inputRef}
                  className="arena-textarea"
                  value={userInput}
                  onChange={e => setUserInput(e.target.value)}
                  placeholder="Type your answer here..."
                  rows={3}
                />
              ) : (
                <div className="arena-options">
                  {question.opts.map(opt => (
                    <button
                      key={opt}
                      className={`arena-option ${selectedOpt === opt ? "selected" : ""}`}
                      onClick={() => setSelectedOpt(opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Question */}
      <div className="arena-question-card">
        <div className="arena-question-icon">❓</div>
        <p className="arena-question-text">{question.q}</p>
      </div>

      {/* Result block */}
      {result && (
        <div className="arena-result-block">
          <div className="result-score-row">
            <div className="result-score-circle" style={{ "--score-color": result.evaluation.color }}>
              <span>{result.evaluation.score}</span>
              <small>/ 100</small>
            </div>
            <div className="result-details">
              <div className="result-verdict" style={{ color: result.evaluation.color }}>
                {result.evaluation.label}
              </div>
              {result.correct
                ? <div className="result-winner">🏆 You Win This Round!</div>
                : <div className="result-loser">🤖 AI Twin Wins!</div>
              }
              <div className="result-xp">+{result.correct ? "XP earned" : "5"} XP</div>
            </div>
          </div>
          {question.explanation && (
            <div className="result-explanation">
              <span className="exp-icon">💡</span>
              <p>{question.explanation}</p>
            </div>
          )}
          <div className="arena-action-row">
            <button className="arena-next-btn" onClick={onNext}>Next Challenge →</button>
            <button className="arena-end-btn" onClick={onEndSession}>End Session</button>
          </div>
        </div>
      )}

      {!result && (
        <div className="arena-submit-row">
          <button
            className="arena-submit-btn"
            onClick={onSubmit}
            disabled={!selectedOpt && !userInput.trim()}
          >
            ⚔️ Submit Answer
          </button>
          <button className="arena-end-btn" onClick={onEndSession}>End Session</button>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   PROBLEM ARENA
   ══════════════════════════════════════════════════════════════════════ */
function ProblemArena({ problem, userInput, setUserInput, result, onSubmit, onNext, onEndSession, questionCount, domain }) {
  return (
    <div className="arena-zone">
      <div className="arena-zone-header">
        <div className="arena-zone-meta">
          <span className="arena-mode-tag">🧩 PROBLEM ARENA</span>
          <span className="arena-domain-tag">{domain}</span>
          <span className="arena-q-count">Problem #{questionCount}</span>
        </div>
      </div>

      <div className="problem-arena-layout">
        <div className="problem-card">
          <div className="problem-title-row">
            <span className="problem-icon">🧩</span>
            <h3>{problem.title}</h3>
          </div>
          <p className="problem-statement">{problem.problem}</p>
          {problem.criteria && (
            <div className="problem-criteria">
              <span className="criteria-label">📊 Evaluation criteria:</span>
              <div className="criteria-tags">
                {problem.criteria.map(c => <span key={c} className="criteria-tag">{c}</span>)}
              </div>
            </div>
          )}
        </div>

        {/* AI Twin answer */}
        <div className="problem-twin-block">
          <div className="twin-block-header">
            <span>🤖 AI Twin's Approach</span>
            {!result && <span className="twin-hidden-badge">Hidden until you submit</span>}
          </div>
          {result ? (
            <p className="twin-answer-text">{problem.twinAnswer}</p>
          ) : (
            <div className="twin-redacted">▓▓▓ ▓▓▓▓▓▓ ▓▓▓ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓</div>
          )}
        </div>

        {/* User answer */}
        {!result ? (
          <textarea
            className="arena-textarea large"
            value={userInput}
            onChange={e => setUserInput(e.target.value)}
            placeholder="Explain your approach, reasoning, and answer in detail..."
            rows={6}
          />
        ) : (
          <div className="problem-comparison">
            <div className="comparison-half user-half">
              <h4>Your Answer</h4>
              <p>{userInput}</p>
            </div>
            <div className="comparison-half twin-half">
              <h4>AI Twin's Answer</h4>
              <p>{problem.twinAnswer}</p>
            </div>
          </div>
        )}

        {result && (
          <div className="arena-result-block">
            <div className="result-score-row">
              <div className="result-score-circle" style={{ "--score-color": result.evaluation.color }}>
                <span>{result.evaluation.score}</span><small>/ 100</small>
              </div>
              <div className="result-details">
                <div className="result-verdict" style={{ color: result.evaluation.color }}>{result.evaluation.label}</div>
                <div className="result-xp">+{Math.round(result.evaluation.score / 5)} XP earned</div>
              </div>
            </div>
            <div className="arena-action-row">
              <button className="arena-next-btn" onClick={onNext}>Next Problem →</button>
              <button className="arena-end-btn" onClick={onEndSession}>End Session</button>
            </div>
          </div>
        )}

        {!result && (
          <div className="arena-submit-row">
            <button className="arena-submit-btn" onClick={onSubmit} disabled={!userInput.trim()}>
              🧩 Submit Answer
            </button>
            <button className="arena-end-btn" onClick={onEndSession}>End Session</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   STRATEGY ARENA
   ══════════════════════════════════════════════════════════════════════ */
function StrategyArena({ strategy, userInput, setUserInput, result, onSubmit, onNext, onEndSession, domain }) {
  const [userAction, setUserAction] = useState(null); // accept | reject | modify

  const handleAction = (action) => {
    setUserAction(action);
    if (action === "accept") {
      setUserInput("I accept the strategy plan.");
    } else if (action === "reject") {
      setUserInput("I reject this strategy plan.");
    }
  };

  return (
    <div className="arena-zone">
      <div className="arena-zone-header">
        <div className="arena-zone-meta">
          <span className="arena-mode-tag">🗺️ STRATEGY ARENA</span>
          <span className="arena-domain-tag">{domain}</span>
        </div>
      </div>

      <div className="strategy-arena-layout">
        <div className="strategy-plan-card">
          <div className="strategy-plan-header">
            <span className="strategy-icon">🗺️</span>
            <div>
              <h3>{strategy.title}</h3>
              <p className="strategy-focus">{strategy.focus}</p>
            </div>
          </div>
          <ul className="strategy-steps">
            {strategy.steps.map((step, i) => (
              <li key={i} className="strategy-step">
                <span className="step-num">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
          {strategy.weakness && (
            <div className="strategy-weakness-tip">
              <span>⚠️</span>
              <p>{strategy.weakness}</p>
            </div>
          )}
        </div>

        {!result && (
          <div className="strategy-action-group">
            <p className="strategy-prompt">What do you want to do with this plan?</p>
            <div className="strategy-action-btns">
              <button
                className={`strategy-action-btn accept ${userAction === "accept" ? "selected" : ""}`}
                onClick={() => handleAction("accept")}
              >✅ Accept Plan</button>
              <button
                className={`strategy-action-btn reject ${userAction === "reject" ? "selected" : ""}`}
                onClick={() => handleAction("reject")}
              >❌ Reject Plan</button>
              <button
                className={`strategy-action-btn modify ${userAction === "modify" ? "selected" : ""}`}
                onClick={() => handleAction("modify")}
              >✏️ Modify Plan</button>
            </div>

            {(userAction === "modify" || userAction === "reject") && (
              <textarea
                className="arena-textarea"
                value={userInput}
                onChange={e => setUserInput(e.target.value)}
                placeholder={userAction === "modify" ? "Describe your modifications..." : "Why do you reject this plan? What would you do instead?"}
                rows={4}
              />
            )}

            {userAction && (
              <button
                className="arena-submit-btn"
                onClick={onSubmit}
                disabled={userAction !== "accept" && !userInput.trim()}
              >
                🗺️ Submit Decision
              </button>
            )}
          </div>
        )}

        {result && (
          <div className="arena-result-block">
            <div className="result-verdict" style={{ color: "#10b981" }}>
              ✅ Decision recorded! Your AI Twin has learned from your choices.
            </div>
            <div className="result-xp">+25 XP earned</div>
            <div className="arena-action-row">
              <button className="arena-next-btn" onClick={onNext}>New Strategy →</button>
              <button className="arena-end-btn" onClick={onEndSession}>End Session</button>
            </div>
          </div>
        )}

        <button className="arena-end-btn" style={{ marginTop: "1rem" }} onClick={onEndSession}>End Session</button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   REFLEX ARENA
   ══════════════════════════════════════════════════════════════════════ */
function ReflexArena({ challenge, userInput, setUserInput, result, reflexTime, reflexActive, onSubmit, onNext, onEndSession, questionCount }) {
  const inputRef = useRef(null);
  useEffect(() => { if (reflexActive && inputRef.current) inputRef.current.focus(); }, [reflexActive]);

  const handleKey = (e) => {
    if (e.key === "Enter") onSubmit();
  };

  return (
    <div className="arena-zone reflex-zone">
      <div className="arena-zone-header">
        <div className="arena-zone-meta">
          <span className="arena-mode-tag reflex-tag">⚡ REFLEX ARENA</span>
          <span className="arena-q-count">Q{questionCount}</span>
        </div>
      </div>

      <div className="reflex-center">
        <div className={`reflex-question-card ${reflexActive ? "active-pulse" : ""}`}>
          <div className="reflex-icon">⚡</div>
          <p className="reflex-question">{challenge.q}</p>
          {reflexActive && <p className="reflex-timer-hint">Answer as FAST as possible!</p>}
        </div>

        {!result ? (
          <div className="reflex-input-row">
            <input
              ref={inputRef}
              className="reflex-input"
              value={userInput}
              onChange={e => setUserInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Type answer and press Enter..."
              disabled={!reflexActive}
            />
            <button className="arena-submit-btn" onClick={onSubmit} disabled={!userInput.trim() || !reflexActive}>
              ⚡ Go!
            </button>
          </div>
        ) : (
          <div className="reflex-result">
            <div className="reflex-time-display">
              <span className="reflex-time-val">{reflexTime?.toFixed(2)}s</span>
              <span className="reflex-time-label">Response Time</span>
            </div>
            <div className="result-verdict" style={{ color: result.evaluation.color, fontSize: "1.2rem", fontWeight: 700 }}>
              {result.evaluation.label}
            </div>
            <div className="result-score-mini">Score: {result.evaluation.score} / 100</div>
            <div className="arena-action-row">
              <button className="arena-next-btn" onClick={onNext}>Next ⚡</button>
              <button className="arena-end-btn" onClick={onEndSession}>End Session</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   EVOLUTION REPORT
   ══════════════════════════════════════════════════════════════════════ */
function EvolutionReport({ profile, level, nextLevel, xpToNext, xpProgress, onBack }) {
  const recentHistory = (profile.history || []).slice(-5).reverse();

  return (
    <div className="evolution-report">
      <div className="evolution-header">
        <div className="evolution-hero-icon">🧬</div>
        <h2>Evolution Report</h2>
        <p>Your AI Twin has updated its model based on this session</p>
      </div>

      {/* Level card */}
      <div className="evo-level-card">
        <div className="evo-level-icon">{level.icon}</div>
        <div className="evo-level-info">
          <div className="evo-level-name">{level.name}</div>
          <div className="evo-xp">{profile.xp} XP</div>
          <div className="evo-xp-bar-track">
            <div className="evo-xp-bar-fill" style={{ width: `${xpProgress}%` }} />
          </div>
          {nextLevel && <div className="evo-next-level">{xpToNext} XP to {nextLevel.name}</div>}
        </div>
      </div>

      {/* Stats grid */}
      <div className="evo-stats-grid">
        <div className="evo-stat">
          <span className="evo-stat-val">{profile.accuracy}%</span>
          <span className="evo-stat-label">Accuracy</span>
        </div>
        <div className="evo-stat">
          <span className="evo-stat-val">{profile.totalAnswered}</span>
          <span className="evo-stat-label">Answered</span>
        </div>
        <div className="evo-stat">
          <span className="evo-stat-val">{profile.correctAnswers}</span>
          <span className="evo-stat-label">Correct</span>
        </div>
        <div className="evo-stat">
          <span className="evo-stat-val">{profile.streak}</span>
          <span className="evo-stat-label">🔥 Streak</span>
        </div>
      </div>

      {/* Titles */}
      {profile.titles.length > 0 && (
        <div className="evo-section">
          <h4>🏅 Earned Titles</h4>
          <div className="evo-titles">
            {profile.titles.map(t => <span key={t} className="arena-title-badge">{t}</span>)}
          </div>
        </div>
      )}

      {/* Recent sessions */}
      {recentHistory.length > 0 && (
        <div className="evo-section">
          <h4>📊 Recent Sessions</h4>
          <div className="evo-history">
            {recentHistory.map((h, i) => (
              <div key={i} className="evo-history-row">
                <span className="evo-h-date">{h.date}</span>
                <span className="evo-h-mode">{h.mode}</span>
                <span className="evo-h-domain">{h.domain}</span>
                <span className="evo-h-diff">{h.difficulty}</span>
                <span className={`evo-h-score ${h.score >= 80 ? "good" : h.score >= 60 ? "mid" : "low"}`}>{h.score}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Twin update message */}
      <div className="evo-twin-message">
        <div className="evo-twin-avatar">🤖</div>
        <div className="evo-twin-speech">
          <strong>AI Twin Update:</strong> {
            profile.accuracy >= 80
              ? "You're performing exceptionally well. I'm raising the difficulty to keep pushing you forward."
              : profile.accuracy >= 60
              ? "Good progress detected. I've identified patterns in your weak areas and will target them next session."
              : "I've noticed some struggle patterns. Let's focus on the fundamentals first — I'll adapt the challenges accordingly."
          }
        </div>
      </div>

      <button className="arena-launch-btn" onClick={onBack}>
        ← Return to Arena Lobby
      </button>
    </div>
  );
}
