import { useState, useEffect, useCallback } from "react";
import { getToken } from "../config/api";
import "../styles/rewards.css";

const API_BASE = "http://localhost:5000/api";

// Authenticated fetch helper
const authFetch = async (endpoint) => {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
};

export default function Rewards() {
  const [activeTab, setActiveTab] = useState("badges");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Badges state — fetched from API
  const [badges, setBadges] = useState([]);
  const [badgeStats, setBadgeStats] = useState({ total: 0, unlocked: 0, locked: 0 });

  // Time capsule state — fetched from API
  const [capsules, setCapsules] = useState([]);
  const [capsuleStats, setCapsuleStats] = useState(null);

  // Fetch all rewards data from MongoDB
  const fetchRewardsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch dashboard (avatar + badge summary + capsule stats)
      const dashboardData = await authFetch("/rewards/dashboard");

      if (dashboardData.success) {
        const { dashboard } = dashboardData;

        // Set capsule stats
        if (dashboard.timeCapsule) {
          setCapsuleStats(dashboard.timeCapsule);
        }
      }

      // Fetch full badge list with per-user progress
      const badgesData = await authFetch("/rewards/badges");
      if (badgesData.success) {
        setBadges(badgesData.badges || []);
        setBadgeStats(badgesData.stats || { total: 0, unlocked: 0, locked: 0 });
      }

      // Fetch time capsule timeline
      try {
        const capsuleData = await authFetch("/rewards/time-capsule");
        if (capsuleData.success) {
          setCapsules(capsuleData.timeline || []);
        }
      } catch {
        // Time capsule might not have entries yet — non-critical
        setCapsules([]);
      }
    } catch (err) {
      console.error("Error fetching rewards:", err);
      setError(err.message || "Failed to load rewards data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRewardsData();
  }, [fetchRewardsData]);


  // Render Badges Section — now from MongoDB
  const renderBadges = () => (
    <div className="badges-section">
      <div className="badges-header">
        <h3>Achievement Badges</h3>
        <span className="badge-count">
          {badgeStats.unlocked}/{badgeStats.total}
        </span>
      </div>
      <div className="badges-grid">
        {badges.length > 0 ? (
          badges.map((badge) => {
            const info = badge.badgeInfo || {};
            const isUnlocked = badge.isUnlocked;
            const progress = badge.progress || 0;

            return (
              <div
                key={badge.badgeId || badge._id}
                className={`badge-card ${isUnlocked ? "unlocked" : "locked"}`}
                title={info.description || ""}
              >
                <div className="badge-icon">
                  {info.icon || "🏅"}
                </div>
                <div className="badge-name">{info.name || badge.badgeId}</div>
                {!isUnlocked && (
                  <div className="badge-progress">
                    <div className="progress-bar small">
                      <div className="progress-fill purple" style={{ width: `${progress}%` }} />
                    </div>
                    <span style={{ fontWeight: "bold", color: "#a78bfa" }}>{progress}%</span>
                  </div>
                )}
                {isUnlocked && <span className="badge-earned">✓ Earned</span>}
                {info.rarity && (
                  <span className={`badge-rarity ${info.rarity}`}>
                    {info.rarity}
                  </span>
                )}
              </div>
            );
          })
        ) : (
          <p style={{ color: "var(--text-secondary)", textAlign: "center", gridColumn: "1 / -1" }}>
            No badges available yet. Complete activities to start earning badges!
          </p>
        )}
      </div>
    </div>
  );

  // Render Time Capsule Section — now from MongoDB
  const renderTimeCapsule = () => (
    <div className="capsule-section">
      <h3>⏳ Time Capsule</h3>
      <p className="capsule-subtitle">Replay past challenges to see your growth</p>
      <div className="capsule-list">
        {capsules.length > 0 ? (
          capsules.map((capsule) => (
            <div key={capsule._id} className="capsule-card">
              <div className="capsule-date">
                {new Date(capsule.timestamp || capsule.createdAt).toLocaleDateString()}
              </div>
              <div className="capsule-topic">{capsule.topic || capsule.subject || "Quiz"}</div>
              <div className="capsule-stats">
                <span className="capsule-score">
                  Score: {capsule.originalScore ?? capsule.score ?? 0}%
                </span>
                {capsule.replays?.length > 0 && (
                  <span className="capsule-replays">
                    🔄 {capsule.replays.length} replay{capsule.replays.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <button className="replay-btn">Replay Challenge</button>
            </div>
          ))
        ) : (
          <p style={{ color: "var(--text-secondary)", textAlign: "center" }}>
            Complete quizzes to start building your time capsule!
          </p>
        )}
      </div>
    </div>
  );

  // Loading state
  if (loading) {
    return (
      <div className="rewards-page">
        <header className="rewards-header">
          <h1>🏆 Your Cognitive Journey</h1>
          <p>Loading your rewards...</p>
        </header>
        <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
          <div className="loading-spinner" style={{
            width: "40px",
            height: "40px",
            border: "4px solid rgba(255,255,255,0.1)",
            borderTop: "4px solid #a78bfa",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }} />
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rewards-page">
        <header className="rewards-header">
          <h1>🏆 Your Cognitive Journey</h1>
          <p>Track progress, earn badges, and reflect on your growth</p>
        </header>
        <div style={{
          textAlign: "center",
          padding: "2rem",
          color: "#ef4444",
          background: "rgba(239,68,68,0.1)",
          borderRadius: "12px",
          margin: "2rem auto",
          maxWidth: "500px",
        }}>
          <p style={{ marginBottom: "1rem" }}>⚠️ {error}</p>
          <button
            onClick={fetchRewardsData}
            style={{
              padding: "0.5rem 1.5rem",
              background: "#a78bfa",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "0.9rem",
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rewards-page">
      {/* Header */}
      <header className="rewards-header">
        <h1>🏆 Your Cognitive Journey</h1>
        <p>Track progress, earn badges, and reflect on your growth</p>
      </header>

      {/* Tab Navigation */}
      <nav className="rewards-tabs">
        <button
          className={`tab-btn ${activeTab === "badges" ? "active" : ""}`}
          onClick={() => setActiveTab("badges")}
        >
          🏅 Badges
        </button>
        <button
          className={`tab-btn ${activeTab === "capsule" ? "active" : ""}`}
          onClick={() => setActiveTab("capsule")}
        >
          ⏳ Time Capsule
        </button>
      </nav>

      {/* Content */}
      <main className="rewards-content">
        {activeTab === "badges" && renderBadges()}
        {activeTab === "capsule" && renderTimeCapsule()}
      </main>
    </div>
  );
}
