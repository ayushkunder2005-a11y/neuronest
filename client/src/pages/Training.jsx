import { useEffect, useState } from "react";
import FocusGames from "../components/training/FocusGames";
import LogicGames from "../components/training/LogicGames";
import MemoryGames from "../components/training/MemoryGames";
import MentalRecoveryGames from "../components/training/MentalRecoveryGames";
import { recordExerciseCompletion } from "../utils/exerciseStats";
import "../styles/training.css";
import "../styles/trainingGames.css";

// Age Groups Configuration
const AGE_GROUPS = [
  {
    id: "toddler",
    name: "Toddler",
    ageRange: "2-5 years",
    icon: "🧒",
    color: "#ff6b9d",
    description: "Fun & colorful games",
    difficultyMultiplier: 0.3,
    durationMultiplier: 0.3,
    language: "simple",
    visualStyle: "colorful"
  },
  {
    id: "child",
    name: "Child",
    ageRange: "6-12 years",
    icon: "👦",
    color: "#4ecdc4",
    description: "Engaging challenges",
    difficultyMultiplier: 0.6,
    durationMultiplier: 0.6,
    language: "clear",
    visualStyle: "fun"
  },
  {
    id: "teen",
    name: "Teen",
    ageRange: "13-17 years",
    icon: "🧑",
    color: "#6366f1",
    description: "Competitive training",
    difficultyMultiplier: 0.85,
    durationMultiplier: 0.85,
    language: "casual",
    visualStyle: "modern"
  },
  {
    id: "adult",
    name: "Adult",
    ageRange: "18-45 years",
    icon: "👨‍💼",
    color: "#8b5cf6",
    description: "Performance focused",
    difficultyMultiplier: 1.0,
    durationMultiplier: 1.0,
    language: "professional",
    visualStyle: "clean"
  }
];

// Training Modes Configuration
const TRAINING_MODES = [
  {
    id: "fun",
    name: "Fun Mode",
    icon: "🎮",
    color: "#f59e0b",
    description: "Play & enjoy! Focus on entertainment with light challenges",
    gamification: "high",
    analytics: "low",
    benefits: ["Stress relief", "Entertainment", "Casual learning"]
  },
  {
    id: "learning",
    name: "Learning Mode",
    icon: "📚",
    color: "#10b981",
    description: "Build skills progressively with guided exercises",
    gamification: "medium",
    analytics: "medium",
    benefits: ["Skill building", "Study improvement", "Knowledge retention"]
  },
  {
    id: "performance",
    name: "Performance Mode",
    icon: "🏆",
    color: "#8b5cf6",
    description: "Push your limits with advanced challenges & detailed analytics",
    gamification: "low",
    analytics: "high",
    benefits: ["Peak performance", "Productivity boost", "Cognitive optimization"]
  }
];

// Cognitive Goals
const COGNITIVE_GOALS = [
  { id: "study", name: "Study Improvement", icon: "📖", description: "Better focus & memory for learning" },
  { id: "productivity", name: "Productivity", icon: "⚡", description: "Sharper mind for work tasks" },
  { id: "emotional", name: "Emotional Balance", icon: "🧘", description: "Mental clarity & stress relief" },
  { id: "general", name: "General Fitness", icon: "🧠", description: "Overall cognitive health" }
];

// Training modules with interactive exercises
const TRAINING_MODULES = [
  {
    id: "focus",
    title: "Focus Training",
    icon: "🎯",
    description: "Improve concentration and attention span",
    benefits: ["Studying longer", "Listening better", "Avoiding distractions"],
    exercises: [
      {
        id: "focus-symbols",
        name: "Symbol Hunter",
        duration: 3,
        difficulty: "Easy",
        description: "Find specific symbols while ignoring distractions",
        xp: 50,
        type: "game"
      },
      {
        id: "focus-reaction",
        name: "Reaction Test",
        duration: 5,
        difficulty: "Medium",
        description: "Tap or choose the correct item as fast as possible",
        xp: 75,
        type: "game"
      },
      {
        id: "focus-distraction",
        name: "Distraction Dodge",
        duration: 5,
        difficulty: "Hard",
        description: "Resist clicking moving or flashing decoys",
        xp: 100,
        type: "game"
      },
    ],
  },
  {
    id: "memory",
    title: "Memory Training",
    icon: "🧠",
    description: "Enhance short and long-term memory",
    benefits: ["Remembering lessons", "Recalling names", "Following instructions"],
    exercises: [
      {
        id: "memory-cards",
        name: "Card Match",
        duration: 4,
        difficulty: "Easy",
        description: "Remember where cards or symbols are placed",
        xp: 60,
        type: "game"
      },
      {
        id: "memory-sequence",
        name: "Sequence Recall",
        duration: 6,
        difficulty: "Medium",
        description: "Repeat numbers, colors, or patterns in order",
        xp: 80,
        type: "game"
      },
      {
        id: "memory-pattern",
        name: "Pattern Memory",
        duration: 8,
        difficulty: "Hard",
        description: "Remember items after a short delay - progressive difficulty",
        xp: 100,
        type: "game"
      },
    ],
  },
  {
    id: "logic",
    title: "Logic & Reasoning",
    icon: "🧩",
    description: "Strengthen problem-solving skills",
    benefits: ["Math skills", "Critical thinking", "Decision-making"],
    exercises: [
      {
        id: "logic-pattern",
        name: "Pattern Finder",
        duration: 3,
        difficulty: "Easy",
        description: "Find what comes next in a sequence",
        xp: 50,
        type: "game"
      },
      {
        id: "logic-puzzle",
        name: "Logic Puzzles",
        duration: 6,
        difficulty: "Medium",
        description: "Solve if-then type problems",
        xp: 85,
        type: "game"
      },
      {
        id: "logic-number",
        name: "Number Grid",
        duration: 8,
        difficulty: "Hard",
        description: "Basic math and visual logic challenges",
        xp: 100,
        type: "game"
      },
    ],
  },
  {
    id: "relaxation",
    title: "Mental Recovery",
    icon: "🧘",
    description: "Reduce stress and restore mental clarity",
    benefits: ["Calming the mind", "Better focus", "Stress reduction"],
    exercises: [
      {
        id: "relax-alpha",
        name: "Alpha Waves Meditation",
        duration: 5,
        difficulty: "Easy",
        description: "Soothing binaural beats and visuals to calm your mind",
        xp: 50,
        type: "game"
      },
      {
        id: "relax-breath",
        name: "Guided Breathing",
        duration: 3,
        difficulty: "Easy",
        description: "Slow breathing to calm your mind with visual guide",
        xp: 30,
        type: "game"
      },
      {
        id: "relax-mindful",
        name: "Mindful Moment",
        duration: 5,
        difficulty: "Easy",
        description: "Focus on calming sounds, words, or visuals",
        xp: 40,
        type: "game"
      },
      {
        id: "relax-body",
        name: "Body Scan",
        duration: 5,
        difficulty: "Medium",
        description: "Progressive relaxation to reset your brain",
        xp: 35,
        type: "game"
      },
    ],
  },
];

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export default function Training() {
  const [selectedModule, setSelectedModule] = useState(null);
  const [activeExercise, setActiveExercise] = useState(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [completedExercises, setCompletedExercises] = useState([]);
  const [showComplete, setShowComplete] = useState(false);
  const [lastScore, setLastScore] = useState(0);

  // User Profile State with localStorage persistence
  const [userProfile, setUserProfile] = useState(() => {
    try {
      const stored = localStorage.getItem("NeuroNest-user-profile");
      if (stored) return JSON.parse(stored);
    } catch { }
    return {
      ageGroup: null,
      trainingMode: "learning",
      cognitiveGoal: "general",
      advancementLevel: 1,
      setupComplete: false
    };
  });

  const [showProfileSetup, setShowProfileSetup] = useState(!userProfile.setupComplete);

  const [dailyProgress, setDailyProgress] = useState(() => {
    try {
      const stored = localStorage.getItem("NeuroNest-training-progress");
      if (stored) {
        const data = JSON.parse(stored);
        const today = new Date().toDateString();
        if (data.date === today) return data;
      }
    } catch { }
    return { date: new Date().toDateString(), completed: 0, streak: 0, minutes: 0, xp: 0 };
  });

  // Timer effect for non-game exercises
  useEffect(() => {
    if (!timerRunning || timeRemaining <= 0 || activeExercise?.type === "game") return;
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          handleExerciseComplete({ score: activeExercise?.xp || 0 });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timerRunning, timeRemaining, activeExercise]);

  // Save progress
  useEffect(() => {
    localStorage.setItem("NeuroNest-training-progress", JSON.stringify(dailyProgress));
  }, [dailyProgress]);

  // Save user profile
  useEffect(() => {
    localStorage.setItem("NeuroNest-user-profile", JSON.stringify(userProfile));
  }, [userProfile]);

  // Get current age group config
  const currentAgeGroup = AGE_GROUPS.find(g => g.id === userProfile.ageGroup) || AGE_GROUPS[3];
  const currentMode = TRAINING_MODES.find(m => m.id === userProfile.trainingMode) || TRAINING_MODES[1];

  // Adapt exercise based on user profile
  const getAdaptedExercise = (exercise) => {
    const durationMultiplier = currentAgeGroup.durationMultiplier;
    const adaptedDuration = Math.max(1, Math.round(exercise.duration * durationMultiplier));

    // Adjust XP based on mode
    let xpMultiplier = 1;
    if (currentMode.id === "performance") xpMultiplier = 1.5;
    if (currentMode.id === "fun") xpMultiplier = 0.8;

    return {
      ...exercise,
      duration: adaptedDuration,
      xp: Math.round(exercise.xp * xpMultiplier),
      adaptedFor: currentAgeGroup.name
    };
  };

  // Update user profile
  const updateProfile = (updates) => {
    setUserProfile(prev => ({ ...prev, ...updates }));
  };

  // Complete profile setup
  const completeSetup = () => {
    if (userProfile.ageGroup) {
      updateProfile({ setupComplete: true });
      setShowProfileSetup(false);
    }
  };

  const handleExerciseComplete = (result) => {
    if (activeExercise) {
      const earnedXP = result?.score || activeExercise.xp;
      setLastScore(earnedXP);
      setCompletedExercises((prev) => [...prev, activeExercise.id]);
      setDailyProgress((prev) => ({
        ...prev,
        completed: prev.completed + 1,
        minutes: prev.minutes + activeExercise.duration,
        streak: prev.streak + 1,
        xp: (prev.xp || 0) + earnedXP,
      }));
      // Record globally for Analytics and Dashboard
      recordExerciseCompletion(activeExercise.name, earnedXP);
      setShowComplete(true);
      setTimeout(() => setShowComplete(false), 3000);
    }
  };

  const startExercise = (exercise) => {
    setActiveExercise(exercise);
    if (exercise.type !== "game") {
      setTimeRemaining(exercise.duration * 60);
      setTimerRunning(false);
    }
  };

  const toggleTimer = () => {
    setTimerRunning(!timerRunning);
  };

  const resetExercise = () => {
    if (activeExercise) {
      setTimeRemaining(activeExercise.duration * 60);
      setTimerRunning(false);
    }
  };

  const exitExercise = () => {
    setActiveExercise(null);
    setTimerRunning(false);
    setTimeRemaining(0);
  };

  const progress = timeRemaining > 0 && activeExercise
    ? ((activeExercise.duration * 60 - timeRemaining) / (activeExercise.duration * 60)) * 100
    : 0;

  // Game View - Render appropriate game component
  if (activeExercise && activeExercise.type === "game") {
    const moduleId = activeExercise.id.split("-")[0];

    const GameComponent = {
      focus: FocusGames,
      memory: MemoryGames,
      logic: LogicGames,
      relax: MentalRecoveryGames
    }[moduleId];

    if (GameComponent) {
      return (
        <>
          <GameComponent
            exerciseId={activeExercise.id}
            onComplete={(result) => {
              handleExerciseComplete(result);
              exitExercise();
            }}
            onExit={exitExercise}
          />
          {showComplete && (
            <div className="completion-overlay">
              <div className="completion-card">
                <span className="celebration">🎉</span>
                <h2>Exercise Complete!</h2>
                <p>Great job! You earned <strong>{lastScore} XP</strong></p>
                <button onClick={exitExercise}>Continue Training</button>
              </div>
            </div>
          )}
        </>
      );
    }
  }

  // Timer-based Exercise View (fallback for non-game exercises)
  if (activeExercise && activeExercise.type !== "game") {
    return (
      <div className="training-shell exercise-mode">
        <div className="exercise-container">
          <button className="back-btn" onClick={exitExercise}>
            ← Back to Training
          </button>

          <div className="exercise-header">
            <h1>{activeExercise.name}</h1>
            <p>{activeExercise.description}</p>
            <span className={`difficulty-badge ${activeExercise.difficulty.toLowerCase()}`}>
              {activeExercise.difficulty}
            </span>
          </div>

          <div className="timer-section">
            <div className="timer-ring">
              <svg viewBox="0 0 200 200">
                <circle className="timer-bg" cx="100" cy="100" r="90" />
                <circle
                  className="timer-progress"
                  cx="100"
                  cy="100"
                  r="90"
                  style={{
                    strokeDasharray: 565.48,
                    strokeDashoffset: 565.48 * (1 - progress / 100),
                  }}
                />
              </svg>
              <div className="timer-display">
                <span className="time">{formatTime(timeRemaining)}</span>
                <span className="label">{timerRunning ? "Focus..." : "Ready"}</span>
              </div>
            </div>
          </div>

          <div className="exercise-controls">
            <button className={`control-btn ${timerRunning ? "pause" : "start"}`} onClick={toggleTimer}>
              {timerRunning ? "⏸️ Pause" : "▶️ Start"}
            </button>
            <button className="control-btn reset" onClick={resetExercise}>
              🔄 Reset
            </button>
          </div>

          <div className="exercise-tips">
            <h3>💡 Tips for this exercise</h3>
            <ul>
              <li>Find a quiet, distraction-free environment</li>
              <li>Sit comfortably with good posture</li>
              <li>Focus on your breathing if you lose concentration</li>
              <li>Don't worry if your mind wanders - gently refocus</li>
            </ul>
          </div>
        </div>

        {showComplete && (
          <div className="completion-overlay">
            <div className="completion-card">
              <span className="celebration">🎉</span>
              <h2>Exercise Complete!</h2>
              <p>Great job! You've completed {activeExercise.name}</p>
              <p className="xp-earned">+{activeExercise.xp} XP</p>
              <button onClick={exitExercise}>Continue Training</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Module Detail View
  if (selectedModule) {
    const module = TRAINING_MODULES.find((m) => m.id === selectedModule);
    return (
      <div className="training-shell">
        <header className="training-hero">
          <button className="back-btn" onClick={() => setSelectedModule(null)}>
            ← Back to Modules
          </button>
          <div className="hero-content">
            <span className="module-icon">{module.icon}</span>
            <div>
              <h1>{module.title}</h1>
              <p>{module.description}</p>
            </div>
          </div>
        </header>

        {/* Benefits Section */}
        <section className="benefits-section">
          <h3>What it helps with:</h3>
          <div className="benefits-list">
            {module.benefits.map((benefit, i) => (
              <span key={i} className="benefit-tag">✓ {benefit}</span>
            ))}
          </div>
        </section>

        <section className="exercises-section">
          <h2>Choose an Exercise</h2>
          <div className="exercises-grid">
            {module.exercises.map((exercise) => {
              const isCompleted = completedExercises.includes(exercise.id);
              return (
                <article
                  key={exercise.id}
                  className={`exercise-card ${isCompleted ? "completed" : ""}`}
                  onClick={() => !isCompleted && startExercise(exercise)}
                >
                  <div className="exercise-header-row">
                    <h3>{exercise.name}</h3>
                    {isCompleted && <span className="completed-badge">✓</span>}
                  </div>
                  <p>{exercise.description}</p>
                  <div className="exercise-meta">
                    <span className="duration">⏱️ {exercise.duration} min</span>
                    <span className={`difficulty ${exercise.difficulty.toLowerCase()}`}>
                      {exercise.difficulty}
                    </span>
                    <span className="xp-badge">+{exercise.xp} XP</span>
                  </div>
                  {!isCompleted && (
                    <button className="start-btn">Start Exercise</button>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  // Main Training View
  return (
    <div className="training-shell">
      <header className="training-hero">
        <div>
          <p className="eyebrow">Training</p>
          <h1>Brain Training Center</h1>
          <p>Choose a training module to enhance your cognitive abilities</p>
        </div>
      </header>

      {/* Progress Stats */}
      <section className="stats-section">
        <div className="stat-card">
          <span className="stat-icon">🔥</span>
          <div>
            <p className="stat-value">{dailyProgress.streak}</p>
            <p className="stat-label">Day Streak</p>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">✅</span>
          <div>
            <p className="stat-value">{dailyProgress.completed}</p>
            <p className="stat-label">Exercises Today</p>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">⏱️</span>
          <div>
            <p className="stat-value">{dailyProgress.minutes}</p>
            <p className="stat-label">Minutes Trained</p>
          </div>
        </div>
        <div className="stat-card accent">
          <span className="stat-icon">⭐</span>
          <div>
            <p className="stat-value">{dailyProgress.xp || 0}</p>
            <p className="stat-label">XP Earned</p>
          </div>
        </div>
      </section>

      {/* Level of Advancement Section */}
      <section className="level-advancement-section">
        <div className="level-header">
          <h2>📊 Level of Advancement</h2>
          <div className="current-level-badge" style={{ background: `linear-gradient(135deg, ${currentAgeGroup.color}, ${currentMode.color})` }}>
            Level {userProfile.advancementLevel}
          </div>
        </div>

        {/* Current Profile Summary */}
        {userProfile.setupComplete && !showProfileSetup && (
          <div className="profile-summary">
            <div className="profile-item" style={{ borderColor: currentAgeGroup.color }}>
              <span className="profile-icon">{currentAgeGroup.icon}</span>
              <div>
                <strong>{currentAgeGroup.name}</strong>
                <span>{currentAgeGroup.ageRange}</span>
              </div>
            </div>
            <div className="profile-item" style={{ borderColor: currentMode.color }}>
              <span className="profile-icon">{currentMode.icon}</span>
              <div>
                <strong>{currentMode.name}</strong>
                <span>{currentMode.description.split('!')[0]}</span>
              </div>
            </div>
            <button
              className="edit-profile-btn"
              onClick={() => setShowProfileSetup(true)}
            >
              ✏️ Edit
            </button>
          </div>
        )}

        {/* Profile Setup / Edit */}
        {showProfileSetup && (
          <div className="profile-setup">
            {/* Age Group Selection */}
            <div className="setup-section">
              <h3>🎂 Select Your Age Group</h3>
              <p className="setup-hint">Exercises will be adapted to your age for optimal training</p>
              <div className="age-group-grid">
                {AGE_GROUPS.map((group) => (
                  <button
                    key={group.id}
                    className={`age-group-card ${userProfile.ageGroup === group.id ? 'selected' : ''}`}
                    style={{
                      '--group-color': group.color,
                      borderColor: userProfile.ageGroup === group.id ? group.color : 'transparent'
                    }}
                    onClick={() => updateProfile({ ageGroup: group.id })}
                  >
                    <span className="group-icon">{group.icon}</span>
                    <strong>{group.name}</strong>
                    <span className="age-range">{group.ageRange}</span>
                    <span className="group-desc">{group.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Training Mode Selection */}
            <div className="setup-section">
              <h3>🎯 Choose Training Mode</h3>
              <p className="setup-hint">Different modes focus on different aspects of brain training</p>
              <div className="mode-grid">
                {TRAINING_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    className={`mode-card ${userProfile.trainingMode === mode.id ? 'selected' : ''}`}
                    style={{
                      '--mode-color': mode.color,
                      borderColor: userProfile.trainingMode === mode.id ? mode.color : 'transparent'
                    }}
                    onClick={() => updateProfile({ trainingMode: mode.id })}
                  >
                    <span className="mode-icon">{mode.icon}</span>
                    <div className="mode-info">
                      <strong>{mode.name}</strong>
                      <span className="mode-desc">{mode.description}</span>
                      <div className="mode-benefits">
                        {mode.benefits.map((b, i) => (
                          <span key={i} className="mode-benefit-tag">✓ {b}</span>
                        ))}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Cognitive Goal Selection */}
            <div className="setup-section">
              <h3>🎯 Your Primary Goal</h3>
              <div className="goal-grid">
                {COGNITIVE_GOALS.map((goal) => (
                  <button
                    key={goal.id}
                    className={`goal-card ${userProfile.cognitiveGoal === goal.id ? 'selected' : ''}`}
                    onClick={() => updateProfile({ cognitiveGoal: goal.id })}
                  >
                    <span className="goal-icon">{goal.icon}</span>
                    <strong>{goal.name}</strong>
                    <span className="goal-desc">{goal.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Complete Setup Button */}
            <div className="setup-actions">
              <button
                className="complete-setup-btn"
                onClick={completeSetup}
                disabled={!userProfile.ageGroup}
              >
                {userProfile.setupComplete ? 'Save Changes' : 'Start Training'} →
              </button>
              {userProfile.setupComplete && (
                <button
                  className="cancel-setup-btn"
                  onClick={() => setShowProfileSetup(false)}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}

        {/* Level Progress */}
        {userProfile.setupComplete && !showProfileSetup && (
          <div className="level-progress">
            <div className="progress-bar-container">
              <div
                className="progress-bar-fill"
                style={{
                  width: `${(dailyProgress.xp % 500) / 5}%`,
                  background: `linear-gradient(90deg, ${currentAgeGroup.color}, ${currentMode.color})`
                }}
              />
            </div>
            <p className="progress-text">
              {dailyProgress.xp % 500} / 500 XP to Level {userProfile.advancementLevel + 1}
            </p>
          </div>
        )}
      </section>

      {/* Training Modules */}
      <section className="modules-section">
        <h2>Training Modules</h2>
        <div className="modules-grid">
          {TRAINING_MODULES.map((module) => (
            <article
              key={module.id}
              className="module-card"
              onClick={() => setSelectedModule(module.id)}
            >
              <span className="module-icon">{module.icon}</span>
              <h3>{module.title}</h3>
              <p>{module.description}</p>
              <div className="module-benefits">
                {module.benefits.slice(0, 2).map((b, i) => (
                  <span key={i} className="mini-benefit">{b}</span>
                ))}
              </div>
              <div className="module-meta">
                <span>{module.exercises.length} exercises</span>
                <span className="arrow">→</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Quick Start */}
      <section className="quick-start-section">
        <h2>Quick Start</h2>
        <p>Jump into a recommended exercise based on available time</p>
        <div className="quick-options">
          <button
            className="quick-btn"
            onClick={() => {
              setSelectedModule("focus");
              startExercise(TRAINING_MODULES[0].exercises[0]);
            }}
          >
            <span>🎯</span>
            <div>
              <strong>Symbol Hunter</strong>
              <small>Quick attention boost</small>
            </div>
          </button>
          <button
            className="quick-btn"
            onClick={() => {
              setSelectedModule("memory");
              startExercise(TRAINING_MODULES[1].exercises[0]);
            }}
          >
            <span>🧠</span>
            <div>
              <strong>Card Match</strong>
              <small>Memory training</small>
            </div>
          </button>
          <button
            className="quick-btn"
            onClick={() => {
              setSelectedModule("relaxation");
              startExercise(TRAINING_MODULES[3].exercises[0]);
            }}
          >
            <span>🧘</span>
            <div>
              <strong>Guided Breathing</strong>
              <small>Calm your mind</small>
            </div>
          </button>
        </div>
      </section>

      {/* Tips Section */}
      <section className="tips-section">
        <h2>💡 Training Tips</h2>
        <div className="tips-grid">
          <div className="tip-card">
            <h4>Consistency is Key</h4>
            <p>Train for 15-20 minutes daily rather than long occasional sessions.</p>
          </div>
          <div className="tip-card">
            <h4>Start Easy</h4>
            <p>Begin with easier exercises and gradually increase difficulty.</p>
          </div>
          <div className="tip-card">
            <h4>Track Progress</h4>
            <p>Monitor your stats to stay motivated and see improvement.</p>
          </div>
          <div className="tip-card">
            <h4>Rest When Needed</h4>
            <p>Use relaxation exercises when feeling mentally fatigued.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
