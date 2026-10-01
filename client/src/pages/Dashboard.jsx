import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useGlobalAIMonitor } from "../context/GlobalAIMonitorContext";
import AiTutor from "../components/AiTutor";
import PaymentModal from "../components/PaymentModal";
import { logout as logoutUser } from "../services/auth";
import "../styles/dashboard.css";
import { EXERCISE_STATS_EVENT, loadExerciseStats } from "../utils/exerciseStats";
import { getGamificationStats, initializeFromExerciseStats } from "../utils/gamification";
import { checkPaymentStatus } from "../config/api";

const THEME_KEY = "NeuroNest-theme";
const DEFAULT_USER_PROFILE = { name: "User", avatar: "" };
const formatTime = (date) =>
  new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

const getInitials = (name) => {
  const trimmed = (name || "").trim();
  if (!trimmed) return "NN";
  return trimmed
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
};

const loadStoredUser = () => {
  if (typeof window === "undefined") {
    return DEFAULT_USER_PROFILE;
  }
  const raw = window.localStorage.getItem("user") || window.sessionStorage.getItem("user");
  if (!raw) {
    return DEFAULT_USER_PROFILE;
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      name: parsed?.name?.trim() || DEFAULT_USER_PROFILE.name,
      avatar: typeof parsed?.avatar === "string" ? parsed.avatar : "",
    };
  } catch {
    return DEFAULT_USER_PROFILE;
  }
};

const navItems = [
  { label: "Dashboard", path: "/dashboard", badge: "pro" },
  { label: "Training", path: "/training" },
  { label: "Tasks", path: "/tasks" },
  { label: "Analytics", path: "/analytics" },
  { label: "AI Tips", path: "/ai-tips" },
  { label: "AI Tutor", path: "/ai-tutor" },
  { label: "AI Twin", path: "/ai-twin" },
  { label: "Rewards", path: "/rewards" },
  { label: "Settings", path: "/settings" },
  { label: "Help", path: "/help" },
];

const todayExercises = [
  {
    title: "Memory Matrix",
    icon: "🧩",
    duration: "5 min",
    difficulty: "Medium",
    difficultyColor: "#f59e0b",
    xpReward: 75,
    description: "Remember and recreate the pattern",
    category: "Memory",
    status: "Start",
  },
  {
    title: "Pattern Recognition",
    icon: "🔍",
    duration: "10 min",
    difficulty: "Hard",
    difficultyColor: "#ef4444",
    xpReward: 90,
    description: "Find the hidden patterns",
    category: "Logic",
    status: "Start",
  },
  {
    title: "Speed Math",
    icon: "⚡",
    duration: "7 min",
    difficulty: "Easy",
    difficultyColor: "#22c55e",
    xpReward: 65,
    description: "Quick calculations challenge",
    category: "Math",
    status: "Start",
  },
];

const quickTip =
  "Consistency is key! Try to complete at least one exercise daily to maintain your streak and see faster improvements.";

const EMOTION_TONE = {
  happy: 1,
  surprise: 0.85,
  neutral: 0.6,
  sad: 0.3,
  angry: 0.25,
  disgust: 0.2,
  fear: 0.2,
};

export default function Dashboard() {
  const { isEnabled: isMonitorEnabled } = useGlobalAIMonitor();
  const navigate = useNavigate();
  const location = useLocation();
  const [exerciseStats, setExerciseStats] = useState(() => loadExerciseStats());
  const [userProfile, setUserProfile] = useState(() => loadStoredUser());
  const [currentTime, setCurrentTime] = useState(() => formatTime(new Date()));
  const [emotionFeed, setEmotionFeed] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [aiTutorPaid, setAiTutorPaid] = useState(
    () => localStorage.getItem("nn-aittutor-paid") === "true"
  );
  const [gamificationStats, setGamificationStats] = useState(() => {
    const stats = getGamificationStats();
    return stats;
  });
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") {
      return "dark";
    }
    const stored = window.localStorage.getItem(THEME_KEY);
    return stored === "light" || stored === "dark" ? stored : "dark";
  });
  // Distraction detection state
  const [isDistracted, setIsDistracted] = useState(false);
  const [distractionReason, setDistractionReason] = useState("");
  const [headPose, setHeadPose] = useState("center");

  // Initialize gamification from exercise stats and listen for updates
  useEffect(() => {
    // Sync with exercise stats
    const stats = initializeFromExerciseStats(exerciseStats);
    setGamificationStats(stats);

    // Listen for gamification updates
    const handleGamificationUpdate = () => {
      setGamificationStats(getGamificationStats());
    };
    window.addEventListener("gamification-update", handleGamificationUpdate);
    return () => window.removeEventListener("gamification-update", handleGamificationUpdate);
  }, [exerciseStats]);

  // Sync payment status with backend on mount
  useEffect(() => {
    checkPaymentStatus()
      .then((status) => {
        if (status && status.active) {
          setAiTutorPaid(true);
          localStorage.setItem("nn-aittutor-paid", "true");
        } else {
          setAiTutorPaid(false);
          localStorage.setItem("nn-aittutor-paid", "false");
        }
      })
      .catch((err) => {
        console.warn("Could not check payment status:", err.message);
      });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    window.localStorage.setItem(THEME_KEY, theme);
    document.body.dataset.dashboardTheme = theme;
    return () => {
      if (document.body.dataset.dashboardTheme === theme) {
        delete document.body.dataset.dashboardTheme;
      }
    };
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const handleLogout = () => {
    logoutUser();
    navigate("/", { replace: true });
  };

  const today = useMemo(
    () =>
      new Intl.DateTimeFormat("en", {
        weekday: "long",
        month: "short",
        day: "numeric",
      }).format(new Date()),
    []
  );
  const todayKey = useMemo(() => new Date().toISOString().split("T")[0], []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const handleStatsUpdate = () => {
      setExerciseStats(loadExerciseStats());
    };
    const handleUserUpdate = () => {
      setUserProfile(loadStoredUser());
    };
    const handleEmotion = (evt) => {
      if (!evt?.detail) return;
      setEmotionFeed((prev) => {
        const next = prev.concat(evt.detail);
        const MAX = 40;
        return next.length > MAX ? next.slice(next.length - MAX) : next;
      });
    };
    const tick = () => setCurrentTime(formatTime(new Date()));
    // Distraction detection listener
    const handleDistraction = (evt) => {
      if (!evt?.detail) return;
      setIsDistracted(evt.detail.distracted || false);
      setDistractionReason(evt.detail.reason || "");
      setHeadPose(evt.detail.headPose || "center");
    };
    window.addEventListener(EXERCISE_STATS_EVENT, handleStatsUpdate);
    window.addEventListener("storage", handleStatsUpdate);
    window.addEventListener("storage", handleUserUpdate);
    window.addEventListener("user-profile-updated", handleUserUpdate);
    window.addEventListener("emotion-live-update", handleEmotion);
    window.addEventListener("distraction-live-update", handleDistraction);
    window.addEventListener("distraction-update", handleDistraction);
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.removeEventListener(EXERCISE_STATS_EVENT, handleStatsUpdate);
      window.removeEventListener("storage", handleStatsUpdate);
      window.removeEventListener("storage", handleUserUpdate);
      window.removeEventListener("user-profile-updated", handleUserUpdate);
      window.removeEventListener("emotion-live-update", handleEmotion);
      window.removeEventListener("distraction-live-update", handleDistraction);
      window.removeEventListener("distraction-update", handleDistraction);
      window.clearInterval(timer);
    };
  }, []);

  const todaysHistory = useMemo(() => {
    const history = Array.isArray(exerciseStats.history) ? exerciseStats.history : [];
    return history.filter((entry) => entry.date === todayKey);
  }, [exerciseStats.history, todayKey]);
  const completedTodayMap = useMemo(() => {
    const map = Object.create(null);
    todaysHistory.forEach((entry) => {
      map[entry.title] = true;
    });
    return map;
  }, [todaysHistory]);
  const exercisesCompletedToday = todaysHistory.length;
  const todayScore = todaysHistory.reduce((sum, entry) => sum + (entry.score || 0), 0);
  const totalDailyExercises = todayExercises.length;
  const exerciseProgressPercent = totalDailyExercises
    ? Math.min(100, (exercisesCompletedToday / totalDailyExercises) * 100)
    : 0;
  const DAILY_GOAL = 500;
  const scoreProgressPercent = Math.min(100, (todayScore / DAILY_GOAL) * 100);
  const exerciseProgressLabel = `${exercisesCompletedToday}/${totalDailyExercises}`;
  const dailyGoalLabel = todayScore >= DAILY_GOAL
    ? `${todayScore} pts (Goal Reached 🔥)`
    : `${todayScore}/${DAILY_GOAL} pts`;
  const moodInsights = useMemo(() => {
    if (!isMonitorEnabled || !emotionFeed.length) {
      return {
        primaryEmotion: "Offline",
        primaryShare: 0,
        secondaryEmotion: "--",
        secondaryShare: 0,
        avgConfidence: 0,
        microCues: [
          { label: "Camera Status", value: "Disabled" },
          { label: "Emotion Feed", value: "Offline" },
          { label: "Live Sync", value: "Waiting..." }
        ],
        trendLabel: "Inactive - Camera Disabled",
        live: false
      };
    }

    const counts = {};
    let totalRealEmotions = 0;
    let confidenceSum = 0;

    emotionFeed.forEach(entry => {
      const e = (entry.emotion || "neutral").toLowerCase();
      counts[e] = (counts[e] || 0) + 1;
      totalRealEmotions += 1;
      confidenceSum += (Number(entry.confidence) || 0);
    });

    const avgConfidence = totalRealEmotions > 0
      ? Math.round(Math.min(100, Math.max(0, confidenceSum / totalRealEmotions)))
      : 0;

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    const formatName = (str) => str.charAt(0).toUpperCase() + str.slice(1);

    const primaryEmotion = sorted[0] ? formatName(sorted[0][0]) : "Neutral";
    const primaryShare = sorted[0] ? Math.round((sorted[0][1] / totalRealEmotions) * 100) : 0;

    const secondaryEmotion = sorted[1] ? formatName(sorted[1][0]) : "None";
    const secondaryShare = sorted[1] ? Math.round((sorted[1][1] / totalRealEmotions) * 100) : 0;

    const lastEmotionName = emotionFeed[emotionFeed.length - 1]?.emotion || "neutral";
    const lastEmotion = formatName(lastEmotionName);

    return {
      primaryEmotion,
      primaryShare,
      secondaryEmotion,
      secondaryShare,
      avgConfidence,
      microCues: [
        { label: "Top Emotion", value: primaryEmotion },
        { label: "Intensity", value: avgConfidence > 70 ? "High" : avgConfidence > 40 ? "Steady" : "Low" },
        { label: "Live State", value: lastEmotion }
      ],
      trendLabel: `Live: ${lastEmotion}`,
      live: true
    };
  }, [isMonitorEnabled, emotionFeed]);

  const { primaryEmotion, primaryShare, secondaryEmotion, secondaryShare, avgConfidence, microCues, trendLabel } = moodInsights;
  const isLiveMoodRing = isMonitorEnabled && emotionFeed.length > 0;

  const statCards = useMemo(
    () => [
      {
        label: "Current Streak",
        value: gamificationStats.streak > 0 ? `${gamificationStats.streak} day${gamificationStats.streak !== 1 ? "s" : ""}` : "Start today!",
        icon: "🔥",
        accent: "streak",
        subtext: gamificationStats.longestStreak > 0 ? `Best: ${gamificationStats.longestStreak} days` : null,
      },
      {
        label: "Exercises Done",
        value: String(gamificationStats.exercisesCompleted || exerciseStats.totalCompleted || 0),
        icon: "💪",
        accent: "memory",
        subtext: "Keep it up!",
      },
      {
        label: "Total XP",
        value: String(gamificationStats.totalXP || exerciseStats.totalScore || 0),
        icon: "⭐",
        accent: "score",
        subtext: `${gamificationStats.xpToNextLevel} XP to next level`,
      },
      {
        label: "Level",
        value: String(gamificationStats.level || 1),
        icon: "🏆",
        accent: "level",
        progress: gamificationStats.progress || 0,
        subtext: `${gamificationStats.progress || 0}% to Level ${(gamificationStats.level || 1) + 1}`,
      },
    ],
    [gamificationStats, exerciseStats.totalCompleted, exerciseStats.totalScore]
  );

  const handleExerciseAction = (exercise) => {
    if (completedTodayMap[exercise.title]) {
      return;
    }
    const query = new URLSearchParams({ module: exercise.title }).toString();
    navigate(`/training?${query}`);
  };

  const handleViewAllExercises = () => {
    navigate("/training");
  };

  const handleAiTutorClick = () => {
    if (aiTutorPaid) {
      navigate("/ai-tutor");
    } else {
      setShowPaymentModal(true);
    }
  };

  const handlePaymentSuccess = () => {
    localStorage.setItem("nn-aittutor-paid", "true");
    setAiTutorPaid(true);
    setShowPaymentModal(false);
    navigate("/ai-tutor");
  };

  return (
    <div className={`brain-dashboard ${theme}`}>
      <aside className="brain-sidebar">
        <div className="sidebar-brand">
          <span className="logo-dot">Neuro</span>
          <div>
            <h2>NeuroNest</h2>
            <p>Cognitive Training Platform</p>
          </div>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const isAiTutor = item.path === "/ai-tutor";
            return (
              <button
                type="button"
                key={item.path}
                onClick={() => isAiTutor ? handleAiTutorClick() : navigate(item.path)}
                className={`nav-item ${isActive ? "active" : ""}`}
              >
                {item.label}
                {item.badge && <span className="nav-badge">{item.badge}</span>}
                {isAiTutor && !aiTutorPaid && <span className="nav-badge" style={{ background: "linear-gradient(135deg,#c084fc,#818cf8)" }}>PREMIUM</span>}
              </button>
            );
          })}
        </nav>
        <button type="button" className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      <main className="brain-content">
        <header className="brain-header">
          <div>
            <p className="eyebrow">Ready to boost your brain today?</p>
            <h1>
              Welcome back, <span>{userProfile.name}</span>
            </h1>
          </div>
          <div className="header-actions">
            <div className="user-pill">
              <div className="user-avatar">
                {userProfile.avatar ? (
                  <img src={userProfile.avatar} alt="Profile avatar" />
                ) : (
                  <span>{getInitials(userProfile.name)}</span>
                )}
              </div>
              <div className="user-meta">
                <p className="user-name">{userProfile.name}</p>
                <small>Profile</small>
              </div>
            </div>
            <button
              type="button"
              className="theme-switcher"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              <span className="theme-indicator" data-theme={theme} />
              <span className="theme-label">
                {theme === "dark" ? "Dark" : "Light"} mode
              </span>
            </button>
            <div className="header-date">
              <span>{today}</span>
              <span className="header-time">{currentTime}</span>
            </div>
          </div>
        </header>

        {/* Distraction Alert Banner */}
        {isDistracted && (
          <div className="distraction-alert-banner">
            <span className="alert-icon">⚠️</span>
            <div className="alert-content">
              <strong>Distraction Detected!</strong>
              <p>{distractionReason || "Please focus on the screen"}</p>
            </div>
            <span className="head-pose-indicator">Head: {headPose}</span>
          </div>
        )}

        <section className="stat-grid">
          {statCards.map((card) => (
            <article key={card.label} className={`stat-card ${card.accent}`}>
              <span className="stat-icon">{card.icon}</span>
              <p className="stat-value">{card.value}</p>
              <p className="stat-label">{card.label}</p>
              {card.progress !== undefined && (
                <div className="stat-progress">
                  <div
                    className="stat-progress-fill"
                    style={{ width: `${card.progress}%` }}
                  />
                </div>
              )}
              {card.subtext && <p className="stat-subtext">{card.subtext}</p>}
            </article>
          ))}
        </section>

        <section className="focus-layout">
          <article className="panel exercise-panel">
            <div className="panel-head">
              <h2>Today&apos;s Exercises</h2>
              <button type="button" className="outline-btn" onClick={handleViewAllExercises}>
                View all
              </button>
            </div>
            <ul className="exercise-list">
              {todayExercises.map((exercise) => {
                const isCompleted = Boolean(completedTodayMap[exercise.title]);
                const label = isCompleted ? "✓ Done" : exercise.status;
                return (
                  <li key={exercise.title} className={`exercise-item ${isCompleted ? "completed" : ""}`}>
                    <div className="exercise-icon">{exercise.icon}</div>
                    <div className="exercise-info">
                      <div className="exercise-header">
                        <p className="exercise-title">{exercise.title}</p>
                        <span
                          className="difficulty-badge"
                          style={{ backgroundColor: `${exercise.difficultyColor}20`, color: exercise.difficultyColor }}
                        >
                          {exercise.difficulty}
                        </span>
                      </div>
                      <p className="exercise-description">{exercise.description}</p>
                      <div className="exercise-meta">
                        <span className="meta-item">⏱️ {exercise.duration}</span>
                        <span className="meta-item">⭐ +{exercise.xpReward} XP</span>
                        <span className="meta-item category-tag">{exercise.category}</span>
                      </div>
                    </div>
                    <button
                      className={`pill ${isCompleted ? "success" : "primary"}`}
                      type="button"
                      onClick={() => handleExerciseAction(exercise)}
                      disabled={isCompleted}
                    >
                      {label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </article>

          <div className="right-stack">
            <article className="panel">
              <div className="panel-head">
                <h4>Daily Progress</h4>
              </div>
              <div className="progress-group">
                <div className="progress-row">
                  <span>Exercises</span>
                  <span>{exerciseProgressLabel}</span>
                </div>
                <div className="progress-track">
                  <div className="progress-bar" style={{ inlineSize: `${exerciseProgressPercent}%` }} />
                </div>
              </div>
              <div className="progress-group">
                <div className="progress-row">
                  <span>Daily Goal</span>
                  <span>{dailyGoalLabel}</span>
                </div>
                <div className="progress-track">
                  <div className="progress-bar secondary" style={{ inlineSize: `${scoreProgressPercent}%` }} />
                </div>
              </div>
            </article>

            <article className="panel quick-tip">
              <h4>Quick Tip</h4>
              <p>{quickTip}</p>
            </article>

            <article className="panel mood-ring-panel">
              <div className="panel-head">
                <h4>Cognitive Mood Ring</h4>
                <span className={`trend-chip ${isLiveMoodRing ? "live" : ""}`}>{trendLabel}</span>
              </div>
              <div className={`mood-ring ${!isLiveMoodRing ? "inactive" : ""}`}>
                <div
                  className="mood-ring-visual"
                  style={{
                    background: `conic-gradient(#7c3aed 0 ${isLiveMoodRing ? primaryShare : 100}%, #10b981 ${isLiveMoodRing ? primaryShare : 100}% 100%)`,
                  }}
                >
                  <div className="mood-ring-core">
                    <strong>{isLiveMoodRing ? primaryShare : 0}%</strong>
                    <span>{isLiveMoodRing ? primaryEmotion : "Offline"}</span>
                  </div>
                </div>
                <ul className="mood-legend">
                  <li>
                    <span className="dot logic" />
                    <div>
                      <p>Primary: {isLiveMoodRing ? primaryEmotion : "None"}</p>
                      <strong>{isLiveMoodRing ? primaryShare : 0}%</strong>
                    </div>
                  </li>
                  <li>
                    <span className="dot emotion" />
                    <div>
                      <p>Secondary: {isLiveMoodRing ? secondaryEmotion : "None"}</p>
                      <strong>{isLiveMoodRing ? secondaryShare : 0}%</strong>
                    </div>
                  </li>
                  <li>
                    <span className="dot stress" />
                    <div>
                      <p>Detection Confidence</p>
                      <strong>{isLiveMoodRing ? avgConfidence : 0}%</strong>
                    </div>
                  </li>
                </ul>
              </div>
              <ul className="micro-cues">
                {microCues.map((entry) => (
                  <li key={entry.label}>
                    <span>{entry.label}</span>
                    <strong>{entry.value}</strong>
                  </li>
                ))}
              </ul>
            </article>

            <article className="panel streak-panel">
              <h4>🔥 Streak Bonus!</h4>
              <p>
                {gamificationStats.streak > 0
                  ? `You're on a ${gamificationStats.streak}-day streak! ${gamificationStats.streak >= 7 ? "Amazing dedication!" : "Keep it up to unlock special rewards."}`
                  : "Start your streak today! Complete an exercise to begin."}
              </p>
              <div className="streak-dots">
                {Array.from({ length: Math.max(7, gamificationStats.streak) }).map((_, idx) => (
                  <span key={idx} className={idx < gamificationStats.streak ? "filled" : ""} />
                ))}
              </div>
              {gamificationStats.longestStreak > gamificationStats.streak && (
                <p className="streak-best">Best streak: {gamificationStats.longestStreak} days</p>
              )}
            </article>
          </div>
        </section>

        <section className="ai-monitor-section">
          <div className="panel-head ai-monitor-head">
            <div>
              <p className="eyebrow">Real-time focus support</p>
              <h2>AI Tutor & Emotion Monitor</h2>
            </div>
            <p className="camera-note">
              Camera permission required for the OpenCV  coaching feed.
            </p>
          </div>
          <AiTutor className="ai-monitor-card" />
        </section>
      </main>

      {/* Payment Modal */}
      {showPaymentModal && (
        <PaymentModal
          onClose={() => setShowPaymentModal(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}
