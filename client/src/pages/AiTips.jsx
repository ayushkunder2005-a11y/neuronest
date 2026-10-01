import { useEffect, useMemo, useState } from "react";
import AiTipsFooter from "../components/AiTipsFooter";
import AiTipsHeader from "../components/AiTipsHeader";
import ModeSwitcher from "../components/ModeSwitcher";
import TipFeed from "../components/TipFeed";
import TipFilters from "../components/TipFilters";
import UserContextProvider, { useUserContext } from "../context/UserContextProvider";
import { getAiTips } from "../logic/AiTipsEngine";
import "../styles/tips.css";

// Emotion-based tip suggestions
const EMOTION_TIPS = {
  happy: {
    icon: "😊",
    message: "You're in a great mood! Perfect time for challenging tasks.",
    tips: [
      "Take on that difficult problem you've been avoiding",
      "Start a creative project while energy is high",
      "Help a colleague or study partner"
    ]
  },
  sad: {
    icon: "😢",
    message: "Feeling down? Here are some mood boosters.",
    tips: [
      "Take a 5-minute walk outside",
      "Listen to your favorite upbeat song",
      "Reach out to a friend or family member"
    ]
  },
  angry: {
    icon: "😤",
    message: "Let's channel that energy productively.",
    tips: [
      "Do some physical exercise - even 10 jumping jacks help",
      "Write down what's bothering you, then set it aside",
      "Practice box breathing: inhale 4s, hold 4s, exhale 4s"
    ]
  },
  fear: {
    icon: "😰",
    message: "Feeling anxious? Let's calm those nerves.",
    tips: [
      "Break your task into tiny, manageable steps",
      "Focus on what you CAN control right now",
      "Ground yourself: name 5 things you can see"
    ]
  },
  neutral: {
    icon: "😐",
    message: "Steady and calm - great for focused work.",
    tips: [
      "Perfect time for detail-oriented tasks",
      "Review and organize your notes",
      "Plan tomorrow's priorities"
    ]
  }
};

// Quick action categories
const QUICK_ACTIONS = [
  { id: "focus", icon: "🎯", label: "Focus Boost", color: "#3b82f6" },
  { id: "energy", icon: "⚡", label: "Energy Up", color: "#f59e0b" },
  { id: "calm", icon: "🧘", label: "Calm Down", color: "#10b981" },
  { id: "memory", icon: "🧠", label: "Memory Hack", color: "#8b5cf6" },
];

// Daily tips storage key
const FAVORITES_KEY = "neuronest_favorite_tips";
const DAILY_TIP_KEY = "neuronest_daily_tip";

const deriveBrainStatus = (patterns) => {
  if (patterns.lastBreakMinutes > 75 || patterns.interruptions > 3) {
    return "recharge";
  }
  if (patterns.focusBlocks >= 4) {
    return "sharp";
  }
  return "steady";
};

const formatUpdatedTime = () =>
  new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date());

const getTodayKey = () => new Date().toISOString().split("T")[0];

function AiTipsContent() {
  const { userType, currentMode, setCurrentMode, usagePatterns } = useUserContext();
  const [tips, setTips] = useState([]);
  const [status, setStatus] = useState("loading");
  const [activeFilter, setActiveFilter] = useState("all");
  const [completedTips, setCompletedTips] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(formatUpdatedTime);
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const [currentEmotion, setCurrentEmotion] = useState("neutral");
  const [showEmotionTips, setShowEmotionTips] = useState(true);
  const [dailyTip, setDailyTip] = useState(null);
  const [activeQuickAction, setActiveQuickAction] = useState(null);

  // Listen for emotion updates
  useEffect(() => {
    const handleEmotionUpdate = (event) => {
      if (event.detail?.emotion) {
        setCurrentEmotion(event.detail.emotion.toLowerCase());
      }
    };
    window.addEventListener("emotion-live-update", handleEmotionUpdate);
    return () => window.removeEventListener("emotion-live-update", handleEmotionUpdate);
  }, []);

  // Load tips
  useEffect(() => {
    setStatus("loading");
    const handle = setTimeout(() => {
      const nextTips = getAiTips({
        mode: currentMode,
        userType,
        patterns: usagePatterns,
        now: new Date(),
      });
      setTips(nextTips);
      setStatus(nextTips.length ? "ready" : "empty");
      setLastUpdated(formatUpdatedTime());

      // Set daily tip
      const todayKey = getTodayKey();
      const storedDaily = localStorage.getItem(DAILY_TIP_KEY);
      if (storedDaily) {
        try {
          const parsed = JSON.parse(storedDaily);
          if (parsed.date === todayKey) {
            setDailyTip(parsed.tip);
          } else if (nextTips.length > 0) {
            const randomTip = nextTips[Math.floor(Math.random() * nextTips.length)];
            setDailyTip(randomTip);
            localStorage.setItem(DAILY_TIP_KEY, JSON.stringify({ date: todayKey, tip: randomTip }));
          }
        } catch {
          if (nextTips.length > 0) {
            const randomTip = nextTips[Math.floor(Math.random() * nextTips.length)];
            setDailyTip(randomTip);
            localStorage.setItem(DAILY_TIP_KEY, JSON.stringify({ date: todayKey, tip: randomTip }));
          }
        }
      } else if (nextTips.length > 0) {
        const randomTip = nextTips[Math.floor(Math.random() * nextTips.length)];
        setDailyTip(randomTip);
        localStorage.setItem(DAILY_TIP_KEY, JSON.stringify({ date: todayKey, tip: randomTip }));
      }
    }, 150);
    return () => clearTimeout(handle);
  }, [currentMode, userType, usagePatterns]);

  // Save favorites to localStorage
  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }, [favorites]);

  const brainStatus = useMemo(() => deriveBrainStatus(usagePatterns), [usagePatterns]);

  const visibleTips = useMemo(() => {
    let filtered = tips.filter((tip) =>
      activeFilter === "all" ? true : tip.category === activeFilter
    );

    // Filter by quick action if active
    if (activeQuickAction) {
      filtered = filtered.filter((tip) => {
        if (activeQuickAction === "focus") return tip.type === "focus";
        if (activeQuickAction === "energy") return tip.type === "productivity";
        if (activeQuickAction === "calm") return tip.type === "recovery";
        if (activeQuickAction === "memory") return tip.type === "memory";
        return true;
      });
    }

    return filtered.filter((tip) => !completedTips.includes(tip.id));
  }, [activeFilter, completedTips, tips, activeQuickAction]);

  const handleDone = (tipId) => {
    setCompletedTips((prev) => (prev.includes(tipId) ? prev : prev.concat(tipId)));
  };

  const toggleFavorite = (tipId) => {
    setFavorites((prev) =>
      prev.includes(tipId)
        ? prev.filter((id) => id !== tipId)
        : [...prev, tipId]
    );
  };

  const emotionData = EMOTION_TIPS[currentEmotion] || EMOTION_TIPS.neutral;

  const emptyMessage =
    status === "loading"
      ? "Loading tips..."
      : "No tips match the current filter. Switch mode or reset filters.";

  return (
    <div className="tips-shell">
      <AiTipsHeader currentMode={currentMode} userType={userType} brainStatus={brainStatus} />

      {/* Daily Tip Highlight */}
      {dailyTip && (
        <section className="daily-tip-banner">
          <div className="daily-tip-icon">💡</div>
          <div className="daily-tip-content">
            <span className="daily-label">Tip of the Day</span>
            <h3>{dailyTip.title}</h3>
            <p>{dailyTip.description}</p>
          </div>
          <button
            className={`favorite-btn ${favorites.includes(dailyTip.id) ? "active" : ""}`}
            onClick={() => toggleFavorite(dailyTip.id)}
            title={favorites.includes(dailyTip.id) ? "Remove from favorites" : "Add to favorites"}
          >
            {favorites.includes(dailyTip.id) ? "❤️" : "🤍"}
          </button>
        </section>
      )}

      {/* Quick Actions */}
      <section className="quick-actions-section">
        <h3>Quick Actions</h3>
        <div className="quick-actions-grid">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.id}
              className={`quick-action-card ${activeQuickAction === action.id ? "active" : ""}`}
              style={{ "--action-color": action.color }}
              onClick={() => setActiveQuickAction(
                activeQuickAction === action.id ? null : action.id
              )}
            >
              <span className="action-icon">{action.icon}</span>
              <span className="action-label">{action.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Emotion-Based Tips */}
      {showEmotionTips && (
        <section className="emotion-tips-section">
          <header>
            <div className="emotion-header">
              <span className="emotion-icon-large">{emotionData.icon}</span>
              <div>
                <h3>Based on Your Mood: <span className="emotion-name">{currentEmotion}</span></h3>
                <p>{emotionData.message}</p>
              </div>
            </div>
            <button
              className="close-emotion-tips"
              onClick={() => setShowEmotionTips(false)}
              title="Hide emotion tips"
            >
              ✕
            </button>
          </header>
          <ul className="emotion-tips-list">
            {emotionData.tips.map((tip, index) => (
              <li key={index}>
                <span className="tip-bullet">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Favorites Section */}
      {favorites.length > 0 && (
        <section className="favorites-section">
          <h3>⭐ Your Favorite Tips ({favorites.length})</h3>
          <div className="favorites-list">
            {tips.filter((tip) => favorites.includes(tip.id)).map((tip) => (
              <div key={tip.id} className="favorite-tip-card">
                <div className="favorite-tip-content">
                  <strong>{tip.title}</strong>
                  <p>{tip.description}</p>
                </div>
                <button
                  className="remove-favorite"
                  onClick={() => toggleFavorite(tip.id)}
                >
                  ❌
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="tips-grid">
        <article className="tips-card">
          <h3>Tip Controls</h3>
          <p className="mood-note">Filter by category and switch mode to refresh tips.</p>
          <TipFilters activeFilter={activeFilter} onChange={setActiveFilter} />
          <div className="mood-note">Mode</div>
          <ModeSwitcher currentMode={currentMode} onChange={setCurrentMode} />
          <div className="basic-coaching">
            <h4>Usage Patterns</h4>
            <ul>
              <li>🎯 Focus blocks: {usagePatterns.focusBlocks}</li>
              <li>☕ Last break: {usagePatterns.lastBreakMinutes} min ago</li>
              <li>🔔 Interruptions: {usagePatterns.interruptions}</li>
            </ul>
          </div>

          {/* Stats Summary */}
          <div className="tips-stats">
            <div className="stat-item">
              <span className="stat-value">{tips.length}</span>
              <span className="stat-label">Total Tips</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{completedTips.length}</span>
              <span className="stat-label">Completed</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{favorites.length}</span>
              <span className="stat-label">Favorites</span>
            </div>
          </div>
        </article>

        <TipFeed
          tips={visibleTips}
          onDone={handleDone}
          emptyMessage={emptyMessage}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
        />
      </section>

      <AiTipsFooter
        lastUpdatedLabel={lastUpdated}
        completedCount={completedTips.length}
        totalCount={tips.length}
      />
    </div>
  );
}

export default function AiTips() {
  return (
    <UserContextProvider>
      <AiTipsContent />
    </UserContextProvider>
  );
}
