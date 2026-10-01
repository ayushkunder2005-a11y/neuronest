import { useEffect, useRef, useState } from "react";
import "../styles/settings.css";

const SETTINGS_KEY = "NeuroNest-settings";
const USER_KEY = "user";

const DEFAULT_SETTINGS = {
  privacy: {
    aiAssistance: true,
    emotionDetection: true,
    dataUsage: true,
    personalizedRecommendations: true,
  },
  training: {
    difficultyLevel: "adaptive",
    exerciseIntensity: "balanced",
    sessionDuration: 15,
    focusSprintDuration: 6,
  },
};

const DEFAULT_PROFILE = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  avatar: "",
};

const loadSettings = () => {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        privacy: { ...DEFAULT_SETTINGS.privacy, ...parsed.privacy },
        training: { ...DEFAULT_SETTINGS.training, ...parsed.training },
      };
    }
  } catch { }
  return DEFAULT_SETTINGS;
};

const loadProfile = () => {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const stored = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        firstName: parsed.firstName || parsed.name?.split(" ")[0] || "",
        lastName: parsed.lastName || parsed.name?.split(" ").slice(1).join(" ") || "",
        email: parsed.email || "",
        phone: parsed.phone || "",
        avatar: parsed.avatar || "",
      };
    }
  } catch { }
  return DEFAULT_PROFILE;
};

const saveSettings = (settings) => {
  if (typeof window !== "undefined") {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }
};

const saveProfile = (profile) => {
  if (typeof window !== "undefined") {
    const fullName = `${profile.firstName} ${profile.lastName}`.trim();
    localStorage.setItem(USER_KEY, JSON.stringify({ ...profile, name: fullName }));
    window.dispatchEvent(new CustomEvent("user-profile-updated"));
  }
};

const saveProfileToBackend = async (profile) => {
  if (typeof window === "undefined") return;
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  if (!token) return;
  
  const fullName = `${profile.firstName} ${profile.lastName}`.trim();
  try {
    const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api").replace(/\/$/, "");
    await fetch(`${API_BASE}/users/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ name: fullName, avatar: profile.avatar })
    });
  } catch (err) {
    console.error("Failed to save profile to backend:", err);
  }
};

const getInitials = (firstName, lastName) => {
  const first = (firstName || "").trim()[0] || "";
  const last = (lastName || "").trim()[0] || "";
  return (first + last).toUpperCase() || "NN";
};

export default function Settings() {
  const [activeTab, setActiveTab] = useState("profile");
  const [settings, setSettings] = useState(() => loadSettings());
  const [profile, setProfile] = useState(() => loadProfile());
  const [saveMessage, setSaveMessage] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    saveProfile(profile);
  }, [profile]);

  const updatePrivacy = (key, value) => {
    setSettings((prev) => ({
      ...prev,
      privacy: { ...prev.privacy, [key]: value },
    }));
    showSaveConfirmation();
  };

  const updateTraining = (key, value) => {
    setSettings((prev) => ({
      ...prev,
      training: { ...prev.training, [key]: value },
    }));
    showSaveConfirmation();
  };

  const updateProfile = (key, value) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
  };

  const handleProfileBlur = () => {
    showSaveConfirmation();
  };

  const showSaveConfirmation = () => {
    setSaveMessage("Changes saved");
    setTimeout(() => setSaveMessage(""), 2000);
  };

  const handleResetProgress = () => {
    localStorage.removeItem("NeuroNest-exercise-stats");
    setShowResetConfirm(false);
    setSaveMessage("Training progress reset");
    setTimeout(() => setSaveMessage(""), 2500);
  };

  const handleClearAllData = () => {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("NeuroNest")) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
    setSettings(DEFAULT_SETTINGS);
    setShowClearConfirm(false);
    setSaveMessage("All data cleared");
    setTimeout(() => setSaveMessage(""), 2500);
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 15 * 1024 * 1024) {
        alert("File must be under 15MB");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_SIZE = 250;
          let width = img.width;
          let height = img.height;

          // Scale maintaining aspect ratio
          if (width > height) {
            if (width > MAX_SIZE) {
              height = Math.round((height * MAX_SIZE) / width);
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width = Math.round((width * MAX_SIZE) / height);
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          // Get highly compressed JPEG (0.8 quality)
          const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
          setProfile((prev) => ({ ...prev, avatar: dataUrl }));
          showSaveConfirmation();
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const renderToggle = (checked, onChange, label, description) => (
    <div className="toggle-row">
      <div className="toggle-info">
        <span className="toggle-label">{label}</span>
        {description && <span className="toggle-desc">{description}</span>}
      </div>
      <label className="switch">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="slider" />
      </label>
    </div>
  );

  const renderProfileTab = () => (
    <div className="settings-section profile-section">
      <div className="section-header">
        <h2>Personal info</h2>
        <p>Update your profile, contact details, and preferences to personalize your experience.</p>
      </div>

      {/* Profile Picture */}
      <div className="profile-picture-section">
        <div className="profile-avatar-wrapper">
          {profile.avatar ? (
            <img src={profile.avatar} alt="Profile" className="profile-avatar-img" />
          ) : (
            <div className="profile-avatar-placeholder">
              {getInitials(profile.firstName, profile.lastName)}
            </div>
          )}
        </div>
        <div className="profile-picture-info">
          <h4>Profile picture</h4>
          <p>PNG, JPEG under 15MB</p>
        </div>
        <button
          type="button"
          className="upload-btn"
          onClick={() => fileInputRef.current?.click()}
        >
          <span className="upload-icon">↑</span> Upload
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          onChange={handleAvatarUpload}
          style={{ display: "none" }}
        />
      </div>

      {/* Name Fields */}
      <div className="form-row">
        <div className="form-field">
          <label>First name</label>
          <input
            type="text"
            value={profile.firstName}
            onChange={(e) => updateProfile("firstName", e.target.value)}
            onBlur={handleProfileBlur}
            placeholder="Enter first name"
          />
        </div>
        <div className="form-field">
          <label>Last name</label>
          <input
            type="text"
            value={profile.lastName}
            onChange={(e) => updateProfile("lastName", e.target.value)}
            onBlur={handleProfileBlur}
            placeholder="Enter last name"
          />
        </div>
      </div>

      {/* Save Button */}
      <div className="profile-actions">
        <button
          type="button"
          className="save-profile-btn"
          onClick={async () => {
            saveProfile(profile);
            await saveProfileToBackend(profile);
            showSaveConfirmation();
          }}
        >
          Save Profile
        </button>
      </div>
    </div>
  );

  const renderPrivacyTab = () => (
    <div className="settings-section">
      <div className="section-header">
        <h2>🔒 Privacy Controls</h2>
        <p>Manage how NeuroNest uses AI and your data</p>
      </div>

      <div className="settings-card">
        <h3>AI Features</h3>
        {renderToggle(
          settings.privacy.aiAssistance,
          (val) => updatePrivacy("aiAssistance", val),
          "AI Assistance",
          "Enable AI-powered tips, coaching insights, and personalized guidance"
        )}
        {renderToggle(
          settings.privacy.emotionDetection,
          (val) => updatePrivacy("emotionDetection", val),
          "Emotion Detection",
          "Allow camera-based emotion monitoring for cognitive insights"
        )}
      </div>

      <div className="settings-card">
        <h3>Data & Analytics</h3>
        {renderToggle(
          settings.privacy.dataUsage,
          (val) => updatePrivacy("dataUsage", val),
          "Usage Analytics",
          "Help improve NeuroNest by sharing anonymous usage data"
        )}
        {renderToggle(
          settings.privacy.personalizedRecommendations,
          (val) => updatePrivacy("personalizedRecommendations", val),
          "Personalized Recommendations",
          "Receive exercise recommendations based on your performance"
        )}
      </div>

      <div className="settings-card info-card">
        <div className="info-icon">ℹ️</div>
        <div>
          <p><strong>Your privacy matters</strong></p>
          <p>All emotion detection runs locally on your device. Camera data is never uploaded or stored.</p>
        </div>
      </div>
    </div>
  );

  const renderTrainingTab = () => (
    <div className="settings-section">
      <div className="section-header">
        <h2>🎯 Training Preferences</h2>
        <p>Customize your cognitive training experience</p>
      </div>

      <div className="settings-card">
        <h3>Difficulty Level</h3>
        <p className="card-desc">Set your preferred challenge level for exercises</p>
        <div className="option-grid">
          {["easy", "medium", "hard", "adaptive"].map((level) => (
            <button
              key={level}
              type="button"
              className={`option-btn ${settings.training.difficultyLevel === level ? "active" : ""}`}
              onClick={() => updateTraining("difficultyLevel", level)}
            >
              {level === "easy" && "🌱 "}
              {level === "medium" && "⚡ "}
              {level === "hard" && "🔥 "}
              {level === "adaptive" && "🧠 "}
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-card">
        <h3>Exercise Intensity</h3>
        <p className="card-desc">Control how challenging each session feels</p>
        <div className="option-grid three-col">
          {["low", "balanced", "high"].map((intensity) => (
            <button
              key={intensity}
              type="button"
              className={`option-btn ${settings.training.exerciseIntensity === intensity ? "active" : ""}`}
              onClick={() => updateTraining("exerciseIntensity", intensity)}
            >
              {intensity === "low" && "😌 Low"}
              {intensity === "balanced" && "⚖️ Balanced"}
              {intensity === "high" && "💪 High"}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-card">
        <h3>Session Duration</h3>
        <p className="card-desc">Default duration for training sessions</p>
        <div className="slider-row">
          <input
            type="range"
            min="5"
            max="30"
            step="5"
            value={settings.training.sessionDuration}
            onChange={(e) => updateTraining("sessionDuration", Number(e.target.value))}
            className="settings-slider"
          />
          <span className="slider-value">{settings.training.sessionDuration} min</span>
        </div>
      </div>

      <div className="settings-card">
        <h3>Focus Sprint Duration</h3>
        <p className="card-desc">Preferred length for focus sprint exercises</p>
        <div className="slider-row">
          <input
            type="range"
            min="3"
            max="15"
            step="3"
            value={settings.training.focusSprintDuration}
            onChange={(e) => updateTraining("focusSprintDuration", Number(e.target.value))}
            className="settings-slider"
          />
          <span className="slider-value">{settings.training.focusSprintDuration} min</span>
        </div>
      </div>
    </div>
  );

  const renderAccountTab = () => (
    <div className="settings-section">
      <div className="section-header">
        <h2>⚙️ Account & Data</h2>
        <p>Manage your account and reset options</p>
      </div>

      <div className="settings-card">
        <h3>Reset Training Progress</h3>
        <p className="card-desc">Clear all exercise history, scores, and streaks. This cannot be undone.</p>
        {!showResetConfirm ? (
          <button
            type="button"
            className="danger-btn"
            onClick={() => setShowResetConfirm(true)}
          >
            Reset Progress
          </button>
        ) : (
          <div className="confirm-actions">
            <span className="confirm-text">Are you sure?</span>
            <button type="button" className="confirm-btn" onClick={handleResetProgress}>
              Yes, Reset
            </button>
            <button type="button" className="cancel-btn" onClick={() => setShowResetConfirm(false)}>
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="settings-card danger-zone">
        <h3>Clear All Local Data</h3>
        <p className="card-desc">Remove all NeuroNest data from this browser including settings, progress, and preferences.</p>
        {!showClearConfirm ? (
          <button
            type="button"
            className="danger-btn severe"
            onClick={() => setShowClearConfirm(true)}
          >
            Clear All Data
          </button>
        ) : (
          <div className="confirm-actions">
            <span className="confirm-text warning">⚠️ This will delete everything!</span>
            <button type="button" className="confirm-btn severe" onClick={handleClearAllData}>
              Yes, Clear All
            </button>
            <button type="button" className="cancel-btn" onClick={() => setShowClearConfirm(false)}>
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="settings-card">
        <h3>Export Data</h3>
        <p className="card-desc">Download a copy of your training data and preferences.</p>
        <button type="button" className="secondary-btn" disabled>
          Coming Soon
        </button>
      </div>
    </div>
  );

  return (
    <div className="settings-shell">
      <header className="settings-hero">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Customize Your Experience</h1>
          <p>Profile, privacy, training preferences, and account management</p>
        </div>
        {saveMessage && <span className="save-msg">✓ {saveMessage}</span>}
      </header>

      <nav className="settings-tabs">
        <button
          type="button"
          className={`tab-btn ${activeTab === "profile" ? "active" : ""}`}
          onClick={() => setActiveTab("profile")}
        >
          👤 Profile
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "privacy" ? "active" : ""}`}
          onClick={() => setActiveTab("privacy")}
        >
          🔒 Privacy
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "training" ? "active" : ""}`}
          onClick={() => setActiveTab("training")}
        >
          🎯 Training
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "account" ? "active" : ""}`}
          onClick={() => setActiveTab("account")}
        >
          ⚙️ Account
        </button>
      </nav>

      <main className="settings-content">
        {activeTab === "profile" && renderProfileTab()}
        {activeTab === "privacy" && renderPrivacyTab()}
        {activeTab === "training" && renderTrainingTab()}
        {activeTab === "account" && renderAccountTab()}
      </main>
    </div>
  );
}
