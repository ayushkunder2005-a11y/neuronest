import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
const AI_TWIN_API = "http://localhost:8002";
import "../styles/aiTwin.css";

const getUserId = () => {
  try {
    const raw = window.localStorage.getItem("user") || window.sessionStorage.getItem("user");
    const user = raw ? JSON.parse(raw) : null;
    return user?.uid || user?.firebaseUid || user?._id || user?.id || "default";
  } catch {
    return "default";
  }
};

const TABS = [
  { id: "overview", label: "Overview", icon: "🧠" },
  { id: "chat", label: "AI Chat", icon: "💬" },
  { id: "knowledge", label: "Knowledge Graph", icon: "🗺️" },
  { id: "predictions", label: "Predictions", icon: "🔮" },
  { id: "planner", label: "Study Planner", icon: "📋" },
  { id: "weaknesses", label: "Weaknesses", icon: "⚡" },
  { id: "memory", label: "Memory Monitor", icon: "🧬" },
  { id: "simulation", label: "Simulation", icon: "🎯" },
];

/* ── helpers ─────────────────────────────────────────────────────────── */
const api = async (path, opts = {}) => {
  const userId = getUserId();
  const sep = path.includes("?") ? "&" : "?";
  const url = `${AI_TWIN_API}${path}${path.includes("userId") ? "" : `${sep}userId=${userId}`}&_t=${Date.now()}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
};

const pct = (v) => `${Math.round(v || 0)}%`;
const clamp = (v, min = 0, max = 100) => Math.max(min, Math.min(max, v || 0));

/* ── MAIN COMPONENT ──────────────────────────────────────────────────── */
export default function AiTwin() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");
  const [profile, setProfile] = useState(null);
  const [knowledge, setKnowledge] = useState(null);
  const [predictions, setPredictions] = useState(null);
  const [plan, setPlan] = useState(null);
  const [mistakes, setMistakes] = useState(null);
  const [decay, setDecay] = useState(null);
  const [simResult, setSimResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [simTopics, setSimTopics] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [focusSession, setFocusSession] = useState(null); // { topic, duration, type }
  const [generating, setGenerating] = useState(false);   // AI plan generation loading

  /* initial load */
  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, k, pred, pl, m, d] = await Promise.all([
        api("/profile"),
        api("/knowledge-graph"),
        api("/predictions"),
        api("/study-plan"),
        api("/mistakes"),
        api("/memory-decay"),
      ]);
      setProfile(p.profile);
      setKnowledge(k);
      setPredictions(pred);
      setPlan(pl);
      setMistakes(m);
      setDecay(d);
    } catch (e) {
      setError("AI Twin Engine not reachable. Make sure the server is running on port 8002.");
      console.error("[AI Twin]", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  /* update a topic mastery */
  const studyTopic = async (topic, action = "study") => {
    try {
      await api("/knowledge-graph", {
        method: "POST",
        body: JSON.stringify({ userId: getUserId(), topic, action }),
      });
      loadAll();
    } catch (e) { console.error(e); }
  };

  /* simulate exam */
  const runSimulation = async () => {
    if (!simTopics.trim()) return;
    try {
      const topics = simTopics.split(",").map(t => t.trim()).filter(Boolean);
      const res = await api("/simulate-exam", {
        method: "POST",
        body: JSON.stringify({ userId: getUserId(), topics }),
      });
      setSimResult(res.simulation);
    } catch (e) { console.error(e); }
  };

  /* log behavior */
  const logSession = async (topic, duration, activity) => {
    try {
      await api("/behavior", {
        method: "POST",
        body: JSON.stringify({ userId: getUserId(), topic, duration, activity }),
      });
    } catch (e) { console.error(e); }
  };

  /* AI auto-generate study plan from knowledge graph */
  const generatePlan = async (durationHours = 2) => {
    setGenerating(true);
    try {
      await api("/auto-generate-plan", {
        method: "POST",
        body: JSON.stringify({ userId: getUserId(), durationHours }),
      });
      await loadAll(); // refresh plan
    } catch (e) {
      console.error("[Auto Plan]", e);
    } finally {
      setGenerating(false);
    }
  };

  /* start a focus session */
  const startFocusSession = (topic, duration, type) => {
    setFocusSession({ topic, duration, type });
  };

  /* end focus session and log it */
  const endFocusSession = async (completed, actualDuration) => {
    if (focusSession) {
      await logSession(focusSession.topic, actualDuration, focusSession.type);
      if (completed && actualDuration > 0) {
        await studyTopic(focusSession.topic, "study");
      }
      setFocusSession(null);
      loadAll();
    }
  };

  /* AI Chat — sends commands to backend, handles plan proposals */
  const sendChatMessage = async (message) => {
    if (chatLoading) return;
    const isObj = typeof message === 'object';
    const textStr = isObj ? message.text : message;
    if (!textStr?.trim() && !isObj) return;

    const userMsg = { role: "user", content: message };
    setChatMessages(prev => [...prev, userMsg]);
    setChatLoading(true);

    const cleanHistory = chatMessages.slice(-20).map(m => ({
      role: m.role,
      content: typeof m.content === 'object' ? m.content.text : m.content
    }));

    try {
      const res = await api("/chat", {
        method: "POST",
        body: JSON.stringify({
          userId: getUserId(),
          message: isObj ? message.text : message,
          imageBase64: isObj ? message.imageBase64 : undefined,
          history: cleanHistory,
        }),
      });
      const aiMsg = { role: "assistant", content: res.response };
      setChatMessages(prev => [...prev, aiMsg]);

      // Show action notifications
      if (res.actions && res.actions.length > 0) {
        for (const action of res.actions) {
          if (action.type === "plan_proposed") {
            // Show accept/reject buttons for plan proposals
            setChatMessages(prev => [...prev, {
              role: "plan_proposal",
              content: action.description,
              plan: res.proposedPlan,
            }]);
          } else if (action.type === "navigate") {
            setTab(action.targetTab);
            setChatMessages(prev => [...prev, {
              role: "system",
              content: `✅ ${action.description}`,
              type: action.type,
            }]);
          } else if (action.type === "start_simulation") {
            setTab("simulation");
            if (action.topics && action.topics.length > 0) {
              setSimTopics(action.topics.join(", "));
            }
            setChatMessages(prev => [...prev, {
              role: "system",
              content: `✅ ${action.description}`,
              type: action.type,
            }]);
          } else {
            setChatMessages(prev => [...prev, {
              role: "system",
              content: `✅ ${action.description}`,
              type: action.type,
            }]);
          }
        }
      }

      // Only refresh if topics were added or plan was accepted (not for proposals)
      const hasDataChange = res.actions?.some(a => a.type === "topics_added" || a.type === "plan_accepted");
      if (hasDataChange) loadAll();
    } catch (e) {
      console.error("[AI Chat]", e);
      setChatMessages(prev => [...prev, {
        role: "assistant",
        content: "I could not connect to the AI Twin engine. Make sure the server is running and Ollama has the gpt-oss:120b-cloud model loaded.",
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  /* Accept or reject a proposed study plan */
  const handlePlanAction = async (accept) => {
    setChatLoading(true);
    try {
      const endpoint = accept ? "/apply-plan" : "/reject-plan";
      await api(endpoint, {
        method: "POST",
        body: JSON.stringify({ userId: getUserId() }),
      });

      // Remove the proposal buttons
      setChatMessages(prev =>
        prev.map(m => m.role === "plan_proposal" ? { ...m, role: "system", content: accept ? "✅ Study plan accepted and applied! Check the Study Planner tab." : "❌ Plan rejected. Tell me what you'd like to change." } : m)
      );

      if (accept) loadAll();
    } catch (e) {
      console.error("[Plan Action]", e);
    } finally {
      setChatLoading(false);
    }
  };

  /* ── RENDER ──────────────────────────────────────────────────────── */
  return (
    <div className="aitwin-page">
      {/* SIDEBAR */}
      <aside className="aitwin-sidebar">
        <button className="aitwin-back" onClick={() => navigate("/dashboard")}>
          ← Dashboard
        </button>
        <div className="aitwin-brand">
          <span className="aitwin-brand-icon">🧠</span>
          <div>
            <h2>AI Twin</h2>
            <p>Your Digital Cognitive Twin</p>
          </div>
        </div>
        <nav className="aitwin-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`aitwin-tab ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              <span className="tab-icon">{t.icon}</span>
              <span className="tab-label">{t.label}</span>
            </button>
          ))}
        </nav>
        <div className="aitwin-sidebar-footer">
          <button
            className="arena-entry-btn"
            onClick={() => navigate("/ai-twin-arena")}
          >
            <span>⚔️</span>
            <span>AI Twin Arena</span>
          </button>
          <button className="refresh-btn" onClick={loadAll}>🔄 Refresh Data</button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="aitwin-main">
        {/* Chat always renders — it doesn't depend on initial data load */}
        {tab === "chat" && <ChatTab messages={chatMessages} onSend={sendChatMessage} onPlanAction={handlePlanAction} loading={chatLoading} />}

        {tab !== "chat" && loading && <LoadingState />}
        {tab !== "chat" && error && <ErrorState msg={error} onRetry={loadAll} />}
        {tab !== "chat" && !loading && !error && (
          <>
            {tab === "overview"    && <OverviewTab profile={profile} knowledge={knowledge} predictions={predictions} />}
            {tab === "knowledge"   && <KnowledgeTab data={knowledge} onStudy={studyTopic} />}
            {tab === "predictions" && <PredictionsTab data={predictions} />}
            {tab === "planner"     && <PlannerTab data={plan} onStartFocus={startFocusSession} onLog={logSession} onGenerate={generatePlan} generating={generating} />}
            {tab === "weaknesses"  && <WeaknessTab data={mistakes} />}
            {tab === "memory"      && <MemoryTab data={decay} onStudy={studyTopic} />}
            {tab === "simulation"  && <SimulationTab result={simResult} topics={simTopics} setTopics={setSimTopics} onRun={runSimulation} />}
          </>
        )}
      </main>

      {/* FOCUS SESSION MODAL */}
      {focusSession && (
        <FocusSessionModal
          topic={focusSession.topic}
          totalMinutes={focusSession.duration}
          type={focusSession.type}
          onEnd={endFocusSession}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════════ */

function LoadingState() {
  return (
    <div className="aitwin-loading">
      <div className="loading-brain">🧠</div>
      <p>Syncing your AI Twin…</p>
    </div>
  );
}

function ErrorState({ msg, onRetry }) {
  return (
    <div className="aitwin-error">
      <span className="error-icon">⚠️</span>
      <p>{msg}</p>
      <button onClick={onRetry}>Retry</button>
    </div>
  );
}

/* ── OVERVIEW ────────────────────────────────────────────────────────── */
function OverviewTab({ profile, knowledge, predictions }) {
  if (!profile) return null;
  const ls = profile.learningStyle || {};
  const sched = profile.studySchedule || {};
  const exam = predictions?.examScore || {};

  return (
    <div className="aitwin-content">
      <header className="tab-header">
        <h1>Digital Profile</h1>
        <p className="subtitle">Your AI Twin's understanding of you</p>
      </header>

      <div className="overview-grid">
        {/* Profile Card */}
        <div className="card glass profile-card">
          <div className="profile-avatar">🧑‍💻</div>
          <h3>{profile.name || "Learner"}</h3>
          <span className="badge">AI Twin Active</span>
          <div className="profile-meta">
            <div className="meta-row">
              <span>Learning Style</span>
              <strong>{ls.preferred || "Adaptive"}</strong>
            </div>
            <div className="meta-row">
              <span>Best Study Time</span>
              <strong>{sched.bestTime || "Evening"}</strong>
            </div>
            <div className="meta-row">
              <span>Avg Focus</span>
              <strong>{sched.avgFocusDuration || 30} min</strong>
            </div>
            <div className="meta-row">
              <span>Total Study</span>
              <strong>{(sched.totalStudyHours || 0).toFixed(1)} hrs</strong>
            </div>
          </div>
        </div>

        {/* Learning Style Breakdown */}
        <div className="card glass">
          <h4>Learning Style Breakdown</h4>
          <div className="style-bars">
            {[
              { label: "Visual", value: (ls.visual || 0) * 100, color: "#7c3aed" },
              { label: "Textual", value: (ls.textual || 0) * 100, color: "#06b6d4" },
              { label: "Practice", value: (ls.practice || 0) * 100, color: "#10b981" },
            ].map(s => (
              <div key={s.label} className="style-bar-row">
                <span>{s.label}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: pct(s.value), background: s.color }} />
                </div>
                <span className="bar-val">{pct(s.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Predictions */}
        <div className="card glass prediction-card">
          <h4>🔮 Quick Forecast</h4>
          <div className="forecast-score">
            <div className="score-ring" style={{ "--pct": clamp(exam.predicted || 0) }}>
              <span>{Math.round(exam.predicted || 0)}</span>
            </div>
            <div>
              <p className="score-label">Predicted Exam Score</p>
              <p className="score-confidence">Confidence: {exam.confidence || "low"}</p>
            </div>
          </div>
          {exam.weakAreas?.length > 0 && (
            <div className="weak-chips">
              {exam.weakAreas.map(w => <span key={w} className="chip danger">{w}</span>)}
            </div>
          )}
        </div>

        {/* Strengths & Weaknesses */}
        <div className="card glass">
          <h4>Strengths & Weaknesses</h4>
          <div className="sw-grid">
            <div className="sw-col">
              <p className="sw-label">💪 Strong</p>
              {(profile.strengths || []).length > 0
                ? profile.strengths.map(s => <span key={s} className="chip success">{s}</span>)
                : <span className="chip muted">Study topics to discover</span>}
            </div>
            <div className="sw-col">
              <p className="sw-label">⚡ Needs Work</p>
              {(profile.weaknesses || []).length > 0
                ? profile.weaknesses.map(w => <span key={w} className="chip warning">{w}</span>)
                : <span className="chip muted">None detected yet</span>}
            </div>
          </div>
        </div>

        {/* Knowledge Summary */}
        <div className="card glass full-width">
          <h4>📊 Knowledge Summary</h4>
          <div className="knowledge-stats">
            <div className="kstat">
              <span className="kstat-val">{knowledge?.totalTopics || 0}</span>
              <span className="kstat-label">Total Topics</span>
            </div>
            <div className="kstat">
              <span className="kstat-val">{pct(knowledge?.averageMastery)}</span>
              <span className="kstat-label">Avg Mastery</span>
            </div>
            <div className="kstat">
              <span className="kstat-val">{sched.sessionsCount || 0}</span>
              <span className="kstat-label">Study Sessions</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── KNOWLEDGE GRAPH ─────────────────────────────────────────────────── */
function KnowledgeTab({ data, onStudy }) {
  if (!data) return null;
  const graph = data.graph || {};

  return (
    <div className="aitwin-content">
      <header className="tab-header">
        <h1>Knowledge Graph</h1>
        <p className="subtitle">Your digital brain map — mastery of each topic</p>
      </header>
      <div className="kg-summary">
        <span className="chip info">{data.totalTopics} Topics</span>
        <span className="chip info">Avg Mastery: {pct(data.averageMastery)}</span>
      </div>
      <div className="kg-tree">
        {Object.entries(graph).map(([cat, catData]) => (
          <KGCategory key={cat} name={cat} data={catData} onStudy={onStudy} />
        ))}
      </div>
    </div>
  );
}

function KGCategory({ name, data, onStudy, depth = 0 }) {
  const [open, setOpen] = useState(true);
  const mastery = data.mastery || 0;
  const children = data.children || {};
  const hasKids = Object.keys(children).length > 0;

  const masteryColor = mastery >= 70 ? "#10b981" : mastery >= 40 ? "#f59e0b" : mastery > 0 ? "#ef4444" : "#4b5563";

  return (
    <div className="kg-node" style={{ marginLeft: depth * 20 }}>
      <div className="kg-node-header" onClick={() => hasKids && setOpen(!open)}>
        <span className="kg-toggle">{hasKids ? (open ? "▼" : "▶") : "•"}</span>
        <span className="kg-name">{name}</span>
        <div className="kg-bar-track">
          <div className="kg-bar-fill" style={{ width: pct(mastery), background: masteryColor }} />
        </div>
        <span className="kg-pct" style={{ color: masteryColor }}>{pct(mastery)}</span>
        <button className="kg-study-btn" onClick={(e) => { e.stopPropagation(); onStudy(name); }} title="Study this topic">📖</button>
      </div>
      {open && hasKids && (
        <div className="kg-children">
          {Object.entries(children).map(([cname, cdata]) => (
            <KGCategory key={cname} name={cname} data={cdata} onStudy={onStudy} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── PREDICTIONS ─────────────────────────────────────────────────────── */
function PredictionsTab({ data }) {
  if (!data) return null;
  const exam = data.examScore || {};
  const burnout = data.burnout || {};
  const curves = data.forgettingCurves || [];
  const speeds = data.learningSpeed || {};

  const burnoutColor = { low: "#10b981", medium: "#f59e0b", high: "#ef4444", critical: "#dc2626" };

  return (
    <div className="aitwin-content">
      <header className="tab-header">
        <h1>Predictions</h1>
        <p className="subtitle">AI-powered forecasts of your learning outcomes</p>
      </header>

      <div className="predictions-grid">
        {/* Exam Score */}
        <div className="card glass">
          <h4>📝 Exam Score Prediction</h4>
          <div className="forecast-score">
            <div className="score-ring large" style={{ "--pct": clamp(exam.predicted || 0) }}>
              <span>{Math.round(exam.predicted || 0)}%</span>
            </div>
            <div>
              <p className="score-confidence">Confidence: <strong>{exam.confidence || "low"}</strong></p>
              {exam.weakAreas?.length > 0 && (
                <div className="weak-chips">
                  <p>Risk areas:</p>
                  {exam.weakAreas.map(w => <span key={w} className="chip danger">{w}</span>)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Burnout Risk */}
        <div className="card glass">
          <h4>🔥 Burnout Risk</h4>
          <div className="burnout-meter">
            <div className="burnout-ring" style={{ "--color": burnoutColor[burnout.risk] || "#10b981", "--pct": clamp(burnout.score || 0) }}>
              <span className="burnout-label">{(burnout.risk || "low").toUpperCase()}</span>
            </div>
            <p className="burnout-detail">{burnout.recentStudyMinutes || 0} min studied recently</p>
            <p className="burnout-tip">{burnout.recommendation}</p>
          </div>
        </div>

        {/* Forgetting Curves */}
        <div className="card glass full-width">
          <h4>📉 Forgetting Curves</h4>
          {curves.length === 0 ? (
            <p className="empty-state">Study some topics to see forgetting curves</p>
          ) : (
            <div className="forget-list">
              {curves.map((c, i) => (
                <div key={i} className={`forget-item ${c.urgency}`}>
                  <span className="forget-topic">{c.topic}</span>
                  <div className="forget-bar-track">
                    <div className="forget-bar-fill" style={{ width: pct(c.retention) }} />
                  </div>
                  <span className="forget-pct">{pct(c.retention)}</span>
                  <span className="forget-days">{c.daysUntilCritical}d left</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Learning Speed */}
        <div className="card glass full-width">
          <h4>⚡ Learning Speed</h4>
          {Object.keys(speeds).length === 0 ? (
            <p className="empty-state">No speed data yet</p>
          ) : (
            <div className="speed-list">
              {Object.entries(speeds).map(([topic, speed]) => (
                <div key={topic} className="speed-item">
                  <span>{topic}</span>
                  <span className={`chip ${speed === "fast" ? "success" : speed === "slow" ? "danger" : "info"}`}>{speed}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── TIMETABLE PLANNER ─────────────────────────────────────────────────── */
function PlannerTab({ data, onStartFocus, onLog, onGenerate, generating }) {
  if (!data) return null;
  const items = data.plan || [];
  const [hours, setHours] = useState(2);
  const [activeFocus, setActiveFocus] = useState(null);

  const daysOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "Today"];

  // Collect UNIQUE period columns, ordered by startTime, deduplicated by periodLabel
  const periodMap = {}; // periodLabel -> {startTime, endTime, periodLabel}
  for (const item of items) {
    const key = item.periodLabel || item.startTime;
    if (!periodMap[key]) {
      periodMap[key] = { startTime: item.startTime, endTime: item.endTime, periodLabel: key };
    }
  }
  // Sort columns by start time
  const allPeriods = Object.values(periodMap).sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Build a map: day -> periodLabel -> item
  const grid = {};
  for (const item of items) {
    const day = item.day || "Today";
    const key = item.periodLabel || item.startTime;
    if (!grid[day]) grid[day] = {};
    grid[day][key] = item;
  }

  // Always show fixed weekdays — empty days show "—" in all cells
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  // Color map for topics
  const topicColors = {};
  const palette = ["#7c3aed","#0891b2","#059669","#d97706","#dc2626","#be185d","#4338ca","#0f766e","#0e7490"];
  [...new Set(items.map(i => i.topic).filter(t => t !== "LUNCH" && t !== "Break"))].forEach((t, i) => { topicColors[t] = palette[i % palette.length]; });

  return (
    <div className="aitwin-content">
      <header className="tab-header">
        <div className="planner-header-row">
          <div>
            <h1>TIME TABLE</h1>
            <p className="subtitle">AI-generated weekly schedule based on your knowledge gaps</p>
          </div>
          <div className="planner-gen-controls">
            <select className="planner-hours-select" value={hours} onChange={e => setHours(Number(e.target.value))} disabled={generating}>
              {[1, 1.5, 2, 3, 4].map(h => <option key={h} value={h}>{h}h session</option>)}
            </select>
            <button className={`planner-ai-btn ${generating ? 'loading' : ''}`} onClick={() => onGenerate(hours)} disabled={generating}>
              {generating ? <>⏳ Generating…</> : <>🤖 AI Generate Plan</>}
            </button>
          </div>
        </div>
      </header>

      {items.length > 0 && (
        <div className="planner-meta">
          <span className="chip info">📅 Total: {data.totalDuration || 0} min</span>
          {data.startTime && <span className="chip info">🕐 {data.startTime} - {data.endTime}</span>}
          <span className="chip info">{data.planCount || items.length} blocks</span>
          {data.planSource === 'ai_chat' && <span className="chip success">From AI Chat</span>}
          {data.planSource === 'auto' && <span className="chip success">Auto-Generated</span>}
        </div>
      )}

      {items.length === 0 ? (
        <div className="planner-empty">
          <div className="planner-empty-icon">🤖</div>
          <h3>No study plan yet</h3>
          <p>Let AI instantly build a personalized timetable from your knowledge graph — picking the topics you need most.</p>
          <div className="planner-empty-controls">
            <select className="planner-hours-select" value={hours} onChange={e => setHours(Number(e.target.value))} disabled={generating}>
              {[1, 1.5, 2, 3, 4].map(h => <option key={h} value={h}>{h} hour session</option>)}
            </select>
            <button className={`planner-ai-btn large ${generating ? 'loading' : ''}`} onClick={() => onGenerate(hours)} disabled={generating}>
              {generating ? '🧠 Building your plan…' : '🤖 Generate AI Study Plan'}
            </button>
          </div>
          <p className="planner-empty-alt">Or go to <strong>AI Chat</strong> and say: <em>"Plan Python and React for 2 hours from 6pm"</em> or upload a timetable image via 📎</p>
        </div>
      ) : (
        <div className="tt-grid-wrapper">
          <div className="tt-grid-scroll">
            <table className="tt-grid-table">
              <thead>
                <tr>
                  <th className="tt-corner-cell">Day / Period</th>
                  {allPeriods.map(p => (
                    <th key={p.periodLabel} className="tt-period-header">
                      <div className="tt-period-label">{p.periodLabel}</div>
                      <div className="tt-period-time">{p.startTime}–{p.endTime}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map(day => (
                  <tr key={day}>
                    <td className="tt-day-cell">{day}</td>
                    {allPeriods.map(p => {
                      const cell = grid[day]?.[p.periodLabel];
                      if (!cell) return <td key={p.periodLabel} className="tt-empty-cell">—</td>;
                      const isBreak = cell.type === "break" || cell.topic === "LUNCH" || cell.topic === "BREAK";
                      const isSpecial = ["LAB","LIBRARY","SPORTS","SEMINAR"].includes(cell.topic?.toUpperCase());
                      const color = isBreak ? "#374151" : topicColors[cell.topic] || "#7c3aed";
                      return (
                        <td
                          key={p.periodLabel}
                          className={`tt-subject-cell ${isBreak ? 'tt-break-cell' : ''} ${isSpecial ? 'tt-special-cell' : ''}`}
                          style={{ "--cell-color": color }}
                          title={cell.reason || cell.topic}
                          onClick={() => !isBreak && setActiveFocus(cell)}
                        >
                          <span className="tt-cell-icon">{cell.icon || (isBreak ? "☕" : "📚")}</span>
                          <span className="tt-cell-topic">{cell.topic}</span>
                          {!isBreak && <span className="tt-cell-duration">{cell.duration}m</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>


          {/* Legend */}
          <div className="tt-legend">
            {Object.entries(topicColors).map(([topic, color]) => (
              <div key={topic} className="tt-legend-item">
                <span className="tt-legend-dot" style={{ background: color }} />
                <span>{topic}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Focus Modal when cell clicked */}
      {activeFocus && (
        <FocusSessionModal
          topic={activeFocus.topic}
          totalMinutes={activeFocus.duration}
          type={activeFocus.type}
          onEnd={(completed, elapsed) => {
            onLog(activeFocus.topic, elapsed, completed, activeFocus.type);
            setActiveFocus(null);
          }}
        />
      )}
    </div>
  );
}


/* ── FOCUS SESSION MODAL ─────────────────────────────────────────────────── */
function FocusSessionModal({ topic, totalMinutes, type, onEnd }) {
  const totalSeconds = totalMinutes * 60;
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!paused && !done) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            setDone(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [paused, done]);

  const elapsed = totalSeconds - secondsLeft;
  const elapsedMinutes = Math.round(elapsed / 60);
  const progress = ((elapsed) / totalSeconds) * 100;

  const fmt = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const circumference = 2 * Math.PI * 90; // radius 90
  const strokeDash = circumference - (progress / 100) * circumference;

  const tips = [
    "🔕 Silence your phone to stay in the zone.",
    "💧 Stay hydrated — sip water during your session.",
    "📝 Take quick notes to boost retention.",
    "👀 Give your eyes a 20-second break every 20 minutes.",
    "🧘 Deep breaths help maintain calm focus.",
  ];
  const tip = tips[Math.floor((totalMinutes) % tips.length)];

  return (
    <div className="focus-overlay">
      <div className="focus-modal">
        {/* Header */}
        <div className="focus-modal-header">
          <div className="focus-badge">{done ? "✅ Complete!" : paused ? "⏸ Paused" : "🎯 Focus Mode"}</div>
          <h2 className="focus-topic">{topic}</h2>
          <span className="focus-type-chip">{(type || "study").replace("_", " ")}</span>
        </div>

        {/* Ring Timer */}
        <div className="focus-ring-wrap">
          <svg className="focus-ring-svg" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="90" className="focus-ring-bg" />
            <circle
              cx="100" cy="100" r="90"
              className="focus-ring-progress"
              style={{
                strokeDasharray: circumference,
                strokeDashoffset: strokeDash,
                stroke: done ? "#10b981" : paused ? "#f59e0b" : "#7c3aed",
              }}
            />
          </svg>
          <div className="focus-ring-center">
            <span className="focus-time">{fmt(secondsLeft)}</span>
            <span className="focus-time-label">{done ? "Done!" : "remaining"}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="focus-progress-bar">
          <div className="focus-progress-fill" style={{ width: `${progress}%`, background: done ? "#10b981" : "#7c3aed" }} />
        </div>
        <p className="focus-progress-text">{Math.round(progress)}% complete · {elapsedMinutes} / {totalMinutes} min</p>

        {/* Tip */}
        {!done && <div className="focus-tip">{tip}</div>}

        {/* Controls */}
        <div className="focus-controls">
          {!done ? (
            <>
              <button
                className={`focus-btn ${paused ? "focus-btn-primary" : "focus-btn-secondary"}`}
                onClick={() => setPaused(p => !p)}
              >
                {paused ? "▶ Resume" : "⏸ Pause"}
              </button>
              <button
                className="focus-btn focus-btn-danger"
                onClick={() => onEnd(false, elapsedMinutes)}
              >
                ✕ End Session
              </button>
            </>
          ) : (
            <button
              className="focus-btn focus-btn-primary"
              onClick={() => onEnd(true, totalMinutes)}
            >
              🎉 Mark Complete & Save
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── WEAKNESS DETECTOR ───────────────────────────────────────────────── */
function WeaknessTab({ data }) {
  if (!data) return null;
  const patterns = data.patterns || [];

  return (
    <div className="aitwin-content">
      <header className="tab-header">
        <h1>Weakness Detector</h1>
        <p className="subtitle">Analysis of your repeated mistake patterns</p>
      </header>
      <div className="planner-meta">
        <span className="chip info">Total Mistakes: {data.totalMistakes || 0}</span>
        <span className="chip info">Unique Patterns: {data.uniquePatterns || 0}</span>
      </div>
      {patterns.length === 0 ? (
        <div className="empty-state">
          <p>No mistake patterns detected yet. Keep practicing!</p>
        </div>
      ) : (
        <div className="weakness-list">
          {patterns.map((p, i) => (
            <div key={i} className={`weakness-item severity-${p.severity}`}>
              <div className="weakness-header">
                <span className={`severity-dot ${p.severity}`} />
                <h4>{p.topic}</h4>
                <span className="chip">{p.type}</span>
                <span className="mistake-count">×{p.count}</span>
              </div>
              {p.description && <p className="weakness-desc">{p.description}</p>}
              <p className="weakness-suggestion">💡 {p.suggestion}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── MEMORY MONITOR ──────────────────────────────────────────────────── */
function MemoryTab({ data, onStudy }) {
  if (!data) return null;
  const items = data.dueForReview || [];

  return (
    <div className="aitwin-content">
      <header className="tab-header">
        <h1>Memory Monitor</h1>
        <p className="subtitle">Spaced repetition — topics fading from memory</p>
      </header>
      <div className="planner-meta">
        <span className="chip info">Due for Review: {data.totalDue || 0}</span>
        <span className={`chip ${data.criticalCount > 0 ? "danger" : "success"}`}>
          Critical: {data.criticalCount || 0}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="empty-state">
          <p>No topics due for review. Your memory is fresh! 🎉</p>
        </div>
      ) : (
        <div className="memory-list">
          {items.map((item, i) => (
            <div key={i} className={`memory-item priority-${item.priority}`}>
              <div className="memory-info">
                <h4>{item.topic}</h4>
                <p className="memory-path">{item.path}</p>
                <div className="memory-stats">
                  <span>Retention: <strong style={{ color: item.retention < 30 ? "#ef4444" : item.retention < 50 ? "#f59e0b" : "#10b981" }}>{pct(item.retention)}</strong></span>
                  <span>·</span>
                  <span>{item.daysSinceStudy?.toFixed(0) || "?"} days ago</span>
                  <span>·</span>
                  <span>{item.reviewCount} reviews</span>
                </div>
              </div>
              <button className="memory-review-btn" onClick={() => onStudy(item.topic, "review")}>
                Review Now
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── EXAM SIMULATION ─────────────────────────────────────────────────── */
function SimulationTab({ result, topics, setTopics, onRun }) {
  return (
    <div className="aitwin-content">
      <header className="tab-header">
        <h1>Exam Simulation</h1>
        <p className="subtitle">Predict how you'd perform on an exam</p>
      </header>

      <div className="sim-input-card card glass">
        <h4>Enter exam topics (comma-separated)</h4>
        <div className="sim-input-row">
          <input
            className="sim-input"
            value={topics}
            onChange={e => setTopics(e.target.value)}
            placeholder="e.g. Python, Arrays, Probability, Algebra"
          />
          <button className="sim-run-btn" onClick={onRun} disabled={!topics.trim()}>
            🎯 Simulate
          </button>
        </div>
      </div>

      {result && (
        <div className="sim-results">
          <div className="card glass sim-overall">
            <div className="score-ring large" style={{ "--pct": clamp(result.overallScore) }}>
              <span>{Math.round(result.overallScore)}%</span>
            </div>
            <div>
              <h3>Overall Predicted Score</h3>
              <p>Questions likely solved: {result.questionsLikelySolved}</p>
              <p>Time management: <strong>{result.timeManagement}</strong></p>
            </div>
          </div>

          <div className="card glass full-width">
            <h4>Topic Breakdown</h4>
            <div className="sim-topic-list">
              {(result.topicResults || []).map((t, i) => (
                <div key={i} className={`sim-topic-item status-${t.status}`}>
                  <span className="sim-topic-name">{t.topic}</span>
                  <div className="sim-topic-bars">
                    <div className="sim-bar-group">
                      <span>Mastery</span>
                      <div className="bar-track"><div className="bar-fill" style={{ width: pct(t.mastery), background: "#7c3aed" }} /></div>
                      <span>{pct(t.mastery)}</span>
                    </div>
                    <div className="sim-bar-group">
                      <span>Retention</span>
                      <div className="bar-track"><div className="bar-fill" style={{ width: pct(t.retention), background: "#06b6d4" }} /></div>
                      <span>{pct(t.retention)}</span>
                    </div>
                    <div className="sim-bar-group">
                      <span>Predicted</span>
                      <div className="bar-track"><div className="bar-fill" style={{ width: pct(t.predictedScore), background: "#10b981" }} /></div>
                      <span>{pct(t.predictedScore)}</span>
                    </div>
                  </div>
                  <span className={`chip ${t.status === "strong" ? "success" : t.status === "moderate" ? "warning" : "danger"}`}>{t.status}</span>
                </div>
              ))}
            </div>
          </div>

          {result.riskAreas?.length > 0 && (
            <div className="card glass full-width">
              <h4>⚠️ Risk Areas</h4>
              <div className="weak-chips">
                {result.riskAreas.map(r => <span key={r} className="chip danger">{r}</span>)}
              </div>
              <p className="sim-recommendation">{result.recommendation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── AI CHAT ─────────────────────────────────────────────────────────── */
function ChatTab({ messages, onSend, onPlanAction, loading }) {
  const [input, setInput] = useState("");
  const [chatImage, setChatImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setChatImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setChatImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSend = () => {
    if (!input.trim() && !chatImage) return;

    if (chatImage) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result.split(',')[1];
        onSend({ text: input.trim(), imageBase64: base64Data });
        setInput("");
        clearImage();
      };
      reader.readAsDataURL(chatImage);
    } else {
      onSend({ text: input.trim() });
      setInput("");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickActions = [
    { label: "Create Timetable", prompt: "I want to create a timetable" },
    { label: "What should I study?", prompt: "Based on my knowledge graph, what should I study next?" },
    { label: "My weak areas", prompt: "What are my weakest areas and how should I improve them?" },
    { label: "Study plan for today", prompt: "Create a study plan for me for the next 2 hours based on my current progress." },
    { label: "Explain a topic", prompt: "Can you teach me about data structures? Start with the basics." },
    { label: "Quiz me", prompt: "Give me a quick quiz on my strongest topics to test my knowledge." },
    { label: "My progress report", prompt: "Give me a summary of my overall learning progress and where I stand." },
  ];

  return (
    <div className="aitwin-content chat-layout">
      <header className="tab-header">
        <h1>AI Twin Chat</h1>
        <p className="subtitle">Talk to your AI Twin — it knows your learning journey</p>
      </header>

      <div className="chat-container">
        <div className="chat-messages">
          {messages.length === 0 && (
            <div className="chat-welcome">
              <div className="chat-welcome-icon">🧠</div>
              <h3>Hello! I am your AI Digital Twin.</h3>
              <p>
                I know your learning profile, strengths, weaknesses, and study patterns.
                Ask me anything — I can help you study, explain topics, create plans,
                and track your progress.
              </p>
              <div className="chat-quick-actions">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    className="quick-action-btn"
                    onClick={() => onSend({ text: action.prompt })}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            if (msg.role === "system") {
              return (
                <div key={i} className="chat-action-notification">
                  <p>{msg.content}</p>
                </div>
              );
            }
            if (msg.role === "plan_proposal") {
              return (
                <div key={i} className="chat-plan-proposal">
                  <div className="chat-plan-proposal-header">
                    <h4>📅 Proposed Study Plan</h4>
                  </div>
                  <p>{msg.content}</p>
                  <div className="chat-plan-actions">
                    <button className="plan-accept-btn" onClick={() => onPlanAction(true)}>
                      ✅ Accept & Apply
                    </button>
                    <button className="plan-reject-btn" onClick={() => onPlanAction(false)}>
                      ❌ Reject
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <div key={i} className={`chat-message ${msg.role}`}>
                <div className="chat-avatar">
                  {msg.role === "user" ? "👤" : "🧠"}
                </div>
                <div className="chat-bubble">
                  <span className="chat-sender">{msg.role === "user" ? "You" : "AI Twin"}</span>
                  <p>{msg.content.text || msg.content}</p>
                  {msg.content.imageBase64 && (
                    <img src={`data:image/jpeg;base64,${msg.content.imageBase64}`} alt="Uploaded" className="chat-image-preview-inline" style={{ maxWidth: "200px", borderRadius: "8px", marginTop: "10px" }} />
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="chat-message assistant">
              <div className="chat-avatar">🧠</div>
              <div className="chat-bubble typing">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area" style={{ flexDirection: "column" }}>
          {imagePreview && (
            <div className="chat-image-preview-container" style={{ position: "relative", marginBottom: "10px", alignSelf: "flex-start" }}>
              <img src={imagePreview} alt="Preview" style={{ height: "60px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.2)" }} />
              <button 
                onClick={clearImage} 
                style={{ position: "absolute", top: "-5px", right: "-5px", background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: "20px", height: "20px", fontSize: "12px", cursor: "pointer" }}
              >✕</button>
            </div>
          )}
          <div style={{ display: "flex", width: "100%", gap: "10px" }}>
            <button 
              className="chat-attach-btn" 
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", padding: "0 15px", cursor: "pointer", color: "#fff" }}
              title="Attach timetable image"
            >
              📎
            </button>
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              style={{ display: "none" }} 
              onChange={handleImageChange} 
            />
            <input
              ref={inputRef}
              className="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask your AI Twin anything..."
              disabled={loading}
              style={{ flex: 1 }}
            />
            <button
              className="chat-send-btn"
              onClick={handleSend}
              disabled={(!input.trim() && !chatImage) || loading}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
