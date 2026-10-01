import { addXP } from "./gamification";

const getUserId = () => {
  try {
    const raw = window.localStorage.getItem("user") || window.sessionStorage.getItem("user");
    const user = raw ? JSON.parse(raw) : null;
    return user?.uid || user?.firebaseUid || user?._id || user?.id || "default";
  } catch {
    return "default";
  }
};

const getExerciseStatsKey = () => `NeuroNest-exerciseStats_${getUserId()}`;
const EXERCISE_STATS_EVENT = "neuronest:exercise-stats";

const SCORE_MAP = {
  "Memory Matrix": 75,
  "Pattern Recognition": 90,
  "Speed Math": 65,
};

const DEFAULT_STATS = {
  totalCompleted: 0,
  totalScore: 0,
  perExercise: {},
  moduleStats: {},
  history: [],
};

export const loadExerciseStats = () => {
  if (typeof window === "undefined") {
    return { ...DEFAULT_STATS };
  }
  try {
    const raw = window.localStorage.getItem(getExerciseStatsKey());
    if (!raw) {
      return { ...DEFAULT_STATS };
    }
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_STATS,
      ...parsed,
      perExercise: { ...DEFAULT_STATS.perExercise, ...parsed?.perExercise },
      moduleStats: { ...DEFAULT_STATS.moduleStats, ...parsed?.moduleStats },
      history: Array.isArray(parsed?.history) ? parsed.history : [],
    };
  } catch {
    return { ...DEFAULT_STATS };
  }
};

const persistExerciseStats = (stats) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(getExerciseStatsKey(), JSON.stringify(stats));
  const event = new CustomEvent(EXERCISE_STATS_EVENT);
  window.dispatchEvent(event);
};

export const recordExerciseCompletion = (title, scoreOverride, exerciseId) => {
  if (typeof window === "undefined") {
    return;
  }
  const current = loadExerciseStats();
  const awardedScore = typeof scoreOverride === "number" ? scoreOverride : SCORE_MAP[title] || 50;
  const todayKey = new Date().toISOString().split("T")[0];
  const updatedHistory = [
    ...current.history,
    { title, date: todayKey, score: awardedScore, timestamp: Date.now(), exerciseId },
  ].slice(-200);

  const moduleId = exerciseId ? exerciseId.split("-")[0] : "unknown";

  const nextStats = {
    ...current,
    totalCompleted: current.totalCompleted + 1,
    totalScore: current.totalScore + awardedScore,
    perExercise: {
      ...current.perExercise,
      [title]: (current.perExercise?.[title] || 0) + 1,
    },
    moduleStats: {
      ...current.moduleStats,
      [moduleId]: {
        completed: (current.moduleStats?.[moduleId]?.completed || 0) + 1,
        xp: (current.moduleStats?.[moduleId]?.xp || 0) + awardedScore,
      },
    },
    history: updatedHistory,
  };
  persistExerciseStats(nextStats);

  // Update gamification stats (add XP and record activity for streak)
  addXP(awardedScore, "exercise");
};

export { EXERCISE_STATS_EVENT };

