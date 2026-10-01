// src/utils/gamification.js
// Gamification system for tracking streaks, levels, and XP

import { progressApi } from "./api.js";

const getUserId = () => {
  try {
    const raw = window.localStorage.getItem("user") || window.sessionStorage.getItem("user");
    const user = raw ? JSON.parse(raw) : null;
    return user?.uid || user?.firebaseUid || user?._id || user?.id || "default";
  } catch {
    return "default";
  }
};

const getGamificationKey = () => `neuronest_gamification_${getUserId()}`;
const getActivityLogKey = () => `neuronest_activity_log_${getUserId()}`;

// Level thresholds - XP required to reach each level
const LEVEL_THRESHOLDS = [
    0,      // Level 1: 0 XP
    100,    // Level 2: 100 XP
    300,    // Level 3: 300 XP
    600,    // Level 4: 600 XP
    1000,   // Level 5: 1000 XP
    1500,   // Level 6: 1500 XP
    2200,   // Level 7: 2200 XP
    3000,   // Level 8: 3000 XP
    4000,   // Level 9: 4000 XP
    5500,   // Level 10: 5500 XP
    7500,   // Level 11+: Every 2000 XP after
];

// Get today's date as YYYY-MM-DD
const getTodayKey = () => new Date().toISOString().split("T")[0];

// Get yesterday's date as YYYY-MM-DD
const getYesterdayKey = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
};

// Calculate level from total XP
export const calculateLevel = (totalXP) => {
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
        if (totalXP >= LEVEL_THRESHOLDS[i]) {
            return i + 1;
        }
    }
    return 1;
};

// Get XP needed for next level
export const getXPForNextLevel = (level) => {
    if (level >= LEVEL_THRESHOLDS.length) {
        // Beyond defined levels, every 2000 XP
        return LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + (level - LEVEL_THRESHOLDS.length + 1) * 2000;
    }
    return LEVEL_THRESHOLDS[level] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
};

// Get current level's base XP
export const getCurrentLevelXP = (level) => {
    if (level <= 1) return 0;
    if (level > LEVEL_THRESHOLDS.length) {
        return LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + (level - LEVEL_THRESHOLDS.length) * 2000;
    }
    return LEVEL_THRESHOLDS[level - 1] || 0;
};

// Calculate progress percentage to next level
export const getLevelProgress = (totalXP) => {
    const currentLevel = calculateLevel(totalXP);
    const currentLevelXP = getCurrentLevelXP(currentLevel);
    const nextLevelXP = getXPForNextLevel(currentLevel);

    const xpInCurrentLevel = totalXP - currentLevelXP;
    const xpNeededForLevel = nextLevelXP - currentLevelXP;

    return Math.min(100, Math.round((xpInCurrentLevel / xpNeededForLevel) * 100));
};

// Load activity log from localStorage
const loadActivityLog = () => {
    try {
        const raw = localStorage.getItem(getActivityLogKey());
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
};

// Save activity log to localStorage
const saveActivityLog = (log) => {
    localStorage.setItem(getActivityLogKey(), JSON.stringify(log));
};

// Calculate current streak from activity log
export const calculateStreak = () => {
    const log = loadActivityLog();
    const sortedDates = Object.keys(log).sort().reverse();

    if (sortedDates.length === 0) return 0;

    const today = getTodayKey();
    const yesterday = getYesterdayKey();

    // Check if there's activity today or yesterday (streak is alive)
    if (!log[today] && !log[yesterday]) {
        return 0; // Streak broken
    }

    let streak = 0;
    let checkDate = new Date();

    // If no activity today, start from yesterday
    if (!log[today]) {
        checkDate.setDate(checkDate.getDate() - 1);
    }

    // Count consecutive days
    while (true) {
        const dateKey = checkDate.toISOString().split("T")[0];
        if (log[dateKey]) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
        // Safety limit
        if (streak > 365) break;
    }

    return streak;
};

// Record activity for today
export const recordActivity = (activityType = "exercise") => {
    const log = loadActivityLog();
    const today = getTodayKey();

    if (!log[today]) {
        log[today] = { count: 0, types: [] };
    }

    log[today].count += 1;
    if (!log[today].types.includes(activityType)) {
        log[today].types.push(activityType);
    }

    saveActivityLog(log);

    // Dispatch event for UI updates
    window.dispatchEvent(new CustomEvent("gamification-update", {
        detail: { streak: calculateStreak() }
    }));

    return calculateStreak();
};

// Load gamification data
export const loadGamificationData = () => {
    try {
        const raw = localStorage.getItem(getGamificationKey());
        const data = raw ? JSON.parse(raw) : {};

        return {
            totalXP: data.totalXP || 0,
            exercisesCompleted: data.exercisesCompleted || 0,
            longestStreak: data.longestStreak || 0,
            achievements: data.achievements || [],
            lastActive: data.lastActive || null,
        };
    } catch {
        return {
            totalXP: 0,
            exercisesCompleted: 0,
            longestStreak: 0,
            achievements: [],
            lastActive: null,
        };
    }
};

// Save gamification data
export const saveGamificationData = (data) => {
    localStorage.setItem(getGamificationKey(), JSON.stringify(data));
};

// Add XP and update stats
export const addXP = (amount, source = "exercise") => {
    const data = loadGamificationData();
    const previousLevel = calculateLevel(data.totalXP);

    data.totalXP += amount;
    data.exercisesCompleted += 1;
    data.lastActive = getTodayKey();

    const newLevel = calculateLevel(data.totalXP);
    const currentStreak = calculateStreak();

    // Update longest streak if needed
    if (currentStreak > data.longestStreak) {
        data.longestStreak = currentStreak;
    }

    // Record activity
    recordActivity(source);

    saveGamificationData(data);

    // Check for level up
    const leveledUp = newLevel > previousLevel;

    // Dispatch update event
    window.dispatchEvent(new CustomEvent("gamification-update", {
        detail: {
            totalXP: data.totalXP,
            level: newLevel,
            leveledUp,
            previousLevel,
            streak: currentStreak,
            progress: getLevelProgress(data.totalXP),
        }
    }));

    return {
        totalXP: data.totalXP,
        level: newLevel,
        leveledUp,
        previousLevel,
        streak: currentStreak,
        progress: getLevelProgress(data.totalXP),
    };
};

// Get complete stats for display
export const getGamificationStats = () => {
    const data = loadGamificationData();
    const currentStreak = calculateStreak();
    const totalXP = data.totalXP;
    const level = calculateLevel(totalXP);
    const progress = getLevelProgress(totalXP);
    const xpToNextLevel = getXPForNextLevel(level) - totalXP;

    return {
        streak: currentStreak,
        longestStreak: data.longestStreak,
        exercisesCompleted: data.exercisesCompleted,
        totalXP,
        level,
        progress,
        xpToNextLevel,
    };
};

// Initialize with existing exercise stats (for migration)
export const initializeFromExerciseStats = (exerciseStats) => {
    const data = loadGamificationData();

    // Only initialize if we don't have data yet
    if (data.totalXP === 0 && exerciseStats.totalScore > 0) {
        data.totalXP = exerciseStats.totalScore;
        data.exercisesCompleted = exerciseStats.totalCompleted;
        saveGamificationData(data);
    }

    return getGamificationStats();
};

// ============================================
// TASK ANALYTICS
// ============================================

const TASK_ANALYTICS_KEY = "neuronest_task_analytics";

// Load task analytics from localStorage
export const loadTaskAnalytics = () => {
    try {
        const raw = localStorage.getItem(TASK_ANALYTICS_KEY);
        return raw ? JSON.parse(raw) : {
            totalTasks: 0,
            completedTasks: 0,
            categoryStats: {},
            completionHistory: [], // Array of { date, taskId, title, category }
        };
    } catch {
        return {
            totalTasks: 0,
            completedTasks: 0,
            categoryStats: {},
            completionHistory: [],
        };
    }
};

// Save task analytics
const saveTaskAnalytics = (data) => {
    localStorage.setItem(TASK_ANALYTICS_KEY, JSON.stringify(data));
};

// Track task completion
export const trackTaskCompletion = (task) => {
    const analytics = loadTaskAnalytics();
    const today = getTodayKey();

    analytics.completedTasks += 1;

    // Track by category
    if (!analytics.categoryStats[task.category]) {
        analytics.categoryStats[task.category] = { total: 0, completed: 0 };
    }
    analytics.categoryStats[task.category].completed += 1;

    // Add to completion history
    analytics.completionHistory.push({
        date: today,
        taskId: task.id,
        title: task.title,
        category: task.category,
        priority: task.priority,
        duration: task.duration,
    });

    // Keep only last 100 completions
    if (analytics.completionHistory.length > 100) {
        analytics.completionHistory = analytics.completionHistory.slice(-100);
    }

    saveTaskAnalytics(analytics);

    // Dispatch update event
    window.dispatchEvent(new CustomEvent("gamification-update", {
        detail: { taskCompleted: true, taskAnalytics: analytics }
    }));

    return analytics;
};

// Track task creation
export const trackTaskCreation = (category) => {
    const analytics = loadTaskAnalytics();
    analytics.totalTasks += 1;

    if (!analytics.categoryStats[category]) {
        analytics.categoryStats[category] = { total: 0, completed: 0 };
    }
    analytics.categoryStats[category].total += 1;

    saveTaskAnalytics(analytics);
    return analytics;
};

// Get task statistics for display
export const getTaskStats = () => {
    const analytics = loadTaskAnalytics();

    // Also read from actual tasks storage for accurate counts
    let actualTasks = [];
    try {
        const stored = localStorage.getItem("NeuroNest-tasks");
        if (stored) {
            actualTasks = JSON.parse(stored);
        }
    } catch { }

    const actualTotal = actualTasks.length;
    const actualCompleted = actualTasks.filter(t => t.status === "completed").length;
    const actualPending = actualTasks.filter(t => t.status === "pending").length;
    const actualInProgress = actualTasks.filter(t => t.status === "in-progress").length;

    // Use actual counts if available, otherwise fall back to analytics
    const total = actualTotal || analytics.totalTasks;
    const completed = actualTotal ? actualCompleted : analytics.completedTasks;
    const pending = actualTotal ? actualPending : (analytics.totalTasks - analytics.completedTasks);

    return {
        total,
        completed,
        pending,
        inProgress: actualInProgress,
        completionRate: total > 0
            ? Math.round((completed / total) * 100)
            : 0,
        categoryStats: analytics.categoryStats,
    };
};

// ============================================
// WEEKLY PROGRESS
// ============================================

// Get weekly activity data for trends
export const getWeeklyProgress = () => {
    const log = loadActivityLog();
    const taskAnalytics = loadTaskAnalytics();
    const data = loadGamificationData();

    const days = [];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // Get last 7 days
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split("T")[0];
        const dayName = dayNames[date.getDay()];

        const dayLog = log[dateKey] || { count: 0, types: [] };
        const dayTasks = taskAnalytics.completionHistory.filter(t => t.date === dateKey);

        // Calculate productivity based on activities
        const exerciseScore = dayLog.count * 15;
        const taskScore = dayTasks.length * 10;
        const productivityScore = Math.min(100, exerciseScore + taskScore);

        // Calculate focus score (based on exercise count)
        const focusScore = Math.min(100, dayLog.count * 20);

        days.push({
            label: dayName,
            date: dateKey,
            exercises: dayLog.count,
            tasks: dayTasks.length,
            productivity: productivityScore,
            focus: focusScore,
            // Estimate XP (20-50 per exercise average)
            xp: dayLog.count * 35,
        });
    }

    return days;
};

// ============================================
// DYNAMIC REPORT GENERATION
// ============================================

// Generate a report from real data
export const generateDynamicReport = () => {
    const stats = getGamificationStats();
    const taskStats = getTaskStats();
    const weeklyProgress = getWeeklyProgress();
    const today = new Date();

    // Calculate weekly averages
    const avgProductivity = weeklyProgress.length > 0
        ? Math.round(weeklyProgress.reduce((sum, d) => sum + d.productivity, 0) / weeklyProgress.length)
        : 0;
    const avgFocus = weeklyProgress.length > 0
        ? Math.round(weeklyProgress.reduce((sum, d) => sum + d.focus, 0) / weeklyProgress.length)
        : 0;
    const totalExercisesThisWeek = weeklyProgress.reduce((sum, d) => sum + d.exercises, 0);
    const totalTasksThisWeek = weeklyProgress.reduce((sum, d) => sum + d.tasks, 0);

    // Generate cognitive summary based on performance
    let cognitiveSummary = "";
    if (stats.streak >= 7) {
        cognitiveSummary = `Excellent consistency with a ${stats.streak}-day streak! `;
    } else if (stats.streak >= 3) {
        cognitiveSummary = `Good momentum building with your ${stats.streak}-day streak. `;
    } else {
        cognitiveSummary = "Focus on building daily training habits. ";
    }

    if (avgProductivity >= 70) {
        cognitiveSummary += "Strong productivity scores indicate effective cognitive training. ";
    } else if (avgProductivity >= 40) {
        cognitiveSummary += "Moderate productivity - consider increasing training frequency. ";
    } else {
        cognitiveSummary += "Room for improvement in daily training engagement. ";
    }

    if (taskStats.completionRate >= 80) {
        cognitiveSummary += "Excellent task completion rate shows strong executive function.";
    } else if (taskStats.completionRate >= 50) {
        cognitiveSummary += "Good task management with room for improvement.";
    } else {
        cognitiveSummary += "Focus on completing more tasks to build productivity habits.";
    }

    // Generate recommendations based on data
    const recommendations = [];

    if (stats.streak < 3) {
        recommendations.push("Build a daily training habit - aim for at least one exercise per day.");
    }
    if (totalExercisesThisWeek < 7) {
        recommendations.push("Increase training frequency to at least one exercise per day.");
    }
    if (taskStats.pending > taskStats.completed) {
        recommendations.push("Focus on completing pending tasks before adding new ones.");
    }
    if (avgFocus < 50) {
        recommendations.push("Try Focus Training exercises to improve concentration.");
    }
    if (recommendations.length < 3) {
        recommendations.push("Maintain your current training routine for consistent progress.");
    }
    if (recommendations.length < 3) {
        recommendations.push("Challenge yourself with harder difficulty exercises.");
    }

    return {
        reportId: `RPT-${today.getTime().toString().slice(-6)}`,
        userId: "U-001",
        date: today.toISOString().split("T")[0],
        generatedAt: today.toISOString(),
        cognitiveSummary,
        recommendations: recommendations.slice(0, 3),

        // Core stats
        level: stats.level,
        totalXP: stats.totalXP,
        streak: stats.streak,
        longestStreak: stats.longestStreak,
        exercisesCompleted: stats.exercisesCompleted,
        progress: stats.progress,

        // Task stats
        tasksTotal: taskStats.total,
        tasksCompleted: taskStats.completed,
        tasksPending: taskStats.pending,
        taskCompletionRate: taskStats.completionRate,

        // Weekly stats
        weeklyProgress,
        avgProductivity,
        avgFocus,
        exercisesThisWeek: totalExercisesThisWeek,
        tasksThisWeek: totalTasksThisWeek,

        // Derived scores (for backward compatibility but now using live data)
        // Make IQ score update fluidly with every XP earned - baseline 0 per user preference
        iqScore: Math.min(100, Math.floor(stats.totalXP / 10) + Math.floor(avgFocus / 2)),
        // Use today's true productivity rather than a 7-day diluted average
        productivityScore: weeklyProgress.length > 0 ? weeklyProgress[weeklyProgress.length - 1].productivity : avgProductivity,
    };
};

// ============================================
// DYNAMIC ANALYTICS DATA
// ============================================

// Get trend split based on actual task categories
export const getTrendSplit = () => {
    const taskAnalytics = loadTaskAnalytics();
    // categoryStats is the actual key saved by trackTaskCreation/trackTaskCompletion
    const categories = taskAnalytics.categoryStats || {};

    // Each category has { total, completed } shape
    const total = Object.values(categories).reduce((sum, cat) => sum + (cat.total || 0), 0);

    if (total === 0) {
        // Return default split if no data
        return [
            { label: "Deep work", share: 25, color: "#8b5cf6" },
            { label: "Light tasks", share: 25, color: "#38bdf8" },
            { label: "Repetition", share: 25, color: "#34d399" },
            { label: "Focus tasks", share: 25, color: "#f97316" },
        ];
    }

    const pct = (key) => total > 0 ? Math.round((categories[key]?.total || 0) / total * 100) : 25;

    return [
        { label: "Deep work",   share: pct("deep"),       color: "#8b5cf6" },
        { label: "Light tasks", share: pct("light"),      color: "#38bdf8" },
        { label: "Repetition",  share: pct("repetition"), color: "#34d399" },
        { label: "Focus tasks", share: pct("focus"),      color: "#f97316" },
    ];
};

// Get dynamic insights based on activity
export const getDynamicInsights = () => {
    const stats = getGamificationStats();
    const taskStats = getTaskStats();
    const weeklyProgress = getWeeklyProgress();

    const insights = [];
    const hour = new Date().getHours();

    // Time-based insights
    if (hour >= 9 && hour <= 11) {
        insights.push("Peak focus window active: 9:00 AM to 11:30 AM is optimal for deep work.");
    } else if (hour >= 14 && hour <= 16) {
        insights.push("Afternoon focus period: Good time for focused tasks before evening wind-down.");
    } else if (hour >= 20) {
        insights.push("Evening recovery: Light tasks and review work best now.");
    }

    // Streak-based insights
    if (stats.streak >= 7) {
        insights.push(`Strong consistency: ${stats.streak}-day streak shows excellent habit formation.`);
    } else if (stats.streak >= 3) {
        insights.push(`Building momentum with ${stats.streak}-day streak. Keep it going!`);
    } else if (stats.streak === 0) {
        insights.push("Start today to build your streak. Consistency improves cognitive performance.");
    }

    // Task insights
    if (taskStats.pending > taskStats.completed) {
        insights.push(`${taskStats.pending} pending tasks detected. Focus on completion over creation.`);
    }
    if (taskStats.completionRate >= 80) {
        insights.push("Excellent task completion rate! Executive function is strong.");
    }

    // Weekly progress insights
    if (weeklyProgress.length > 0) {
        const avgProductivity = weeklyProgress.reduce((sum, d) => sum + d.productivity, 0) / weeklyProgress.length;
        if (avgProductivity >= 70) {
            insights.push("Strong weekly productivity. Current training routine is effective.");
        } else if (avgProductivity < 40) {
            insights.push("Low productivity trend. Consider shorter, more frequent training sessions.");
        }
    }

    // XP-based insights
    if (stats.totalXP >= 500) {
        insights.push(`${stats.totalXP} XP earned! Consistent effort builds lasting cognitive improvements.`);
    }

    // Ensure we always have at least 3 insights
    while (insights.length < 3) {
        const fillers = [
            "Regular training improves focus and memory retention.",
            "Short repetition loops stabilize recall ratings.",
            "Task quality improves after a 10-minute recovery block.",
            "Mix different exercise types for balanced cognitive development.",
        ];
        insights.push(fillers[insights.length % fillers.length]);
    }

    return insights.slice(0, 5);
};

// Get cognitive axes based on training progress
export const getCognitiveAxes = () => {
    const stats = getGamificationStats();
    const taskStats = getTaskStats();
    const weeklyProgress = getWeeklyProgress();

    // Calculate from actual data
    const avgFocus = weeklyProgress.length > 0
        ? Math.round(weeklyProgress.reduce((sum, d) => sum + d.focus, 0) / weeklyProgress.length)
        : 50;
    const avgProductivity = weeklyProgress.length > 0
        ? Math.round(weeklyProgress.reduce((sum, d) => sum + d.productivity, 0) / weeklyProgress.length)
        : 50;

    // Memory: based on exercises and streak
    const memoryScore = Math.min(100, 40 + Math.floor(stats.exercisesCompleted / 2) + stats.streak * 2);

    // Focus: from weekly data
    const focusScore = avgFocus > 0 ? avgFocus : 50;

    // Speed: based on XP accumulation rate
    const speedScore = Math.min(100, 40 + Math.floor(stats.totalXP / 50));

    // Planning: based on task completion rate
    const planningScore = Math.min(100, 40 + taskStats.completionRate * 0.5);

    // Resilience: based on streak and longest streak
    const resilienceScore = Math.min(100, 40 + stats.streak * 3 + stats.longestStreak);

    return [
        { label: "Memory", value: Math.round(memoryScore) },
        { label: "Focus", value: Math.round(focusScore) },
        { label: "Speed", value: Math.round(speedScore) },
        { label: "Planning", value: Math.round(planningScore) },
        { label: "Resilience", value: Math.round(resilienceScore) },
    ];
};

// Get task category breakdown with stats
export const getTaskCategoryBreakdown = () => {
    const taskAnalytics = loadTaskAnalytics();
    // categoryStats is the actual key saved by trackTaskCreation/trackTaskCompletion
    const categories = taskAnalytics.categoryStats || {};

    const formatCategory = (key, label) => {
        // Each entry has { total, completed } shape
        const cat = categories[key] || { total: 0, completed: 0 };
        const total = cat.total || 0;
        const completed = cat.completed || 0;
        const completionPct = total > 0 ? Math.round(completed / total * 100) : 0;

        return {
            label,
            stats: [
                `${total} task${total !== 1 ? "s" : ""}`,
                `${completionPct}% done`,
                completed >= (total - completed) ? "On track" : "Needs focus"
            ]
        };
    };

    return [
        formatCategory("deep", "Deep thinking"),
        formatCategory("light", "Light tasks"),
        formatCategory("repetition", "Repetition"),
        formatCategory("focus", "Focus tasks"),
    ];
};

// Get milestones based on progress
export const getMilestones = () => {
    const stats = getGamificationStats();
    const taskStats = getTaskStats();

    const milestones = [];

    if (stats.streak >= 7) {
        milestones.push(`✅ 7-day streak achieved (current: ${stats.streak} days)`);
    } else {
        milestones.push(`⏳ 7-day streak: ${stats.streak}/7 days`);
    }

    if (stats.totalXP >= 500) {
        milestones.push(`✅ 500 XP milestone reached (total: ${stats.totalXP})`);
    } else {
        milestones.push(`⏳ 500 XP milestone: ${stats.totalXP}/500 XP`);
    }

    if (taskStats.completionRate >= 80) {
        milestones.push(`✅ 80% task completion rate maintained`);
    } else {
        milestones.push(`⏳ 80% completion rate: ${taskStats.completionRate}%/80%`);
    }

    return milestones;
};

// ============================================
// SERVER SYNC
// ============================================

// Sync progress to server (fire and forget)
export const syncToServer = async () => {
    try {
        const data = loadGamificationData();
        const activityLog = loadActivityLog();
        const taskAnalytics = loadTaskAnalytics();

        await progressApi.syncProgress({
            totalXP: data.totalXP,
            streak: calculateStreak(),
            longestStreak: data.longestStreak,
            exercisesCompleted: data.exercisesCompleted,
            activityLog,
            taskAnalytics,
        });
        console.log("[Gamification] Synced to server");
    } catch (error) {
        console.warn("[Gamification] Server sync failed (offline mode):", error.message);
    }
};

// Load progress from server and merge with local
export const loadFromServer = async () => {
    try {
        const serverData = await progressApi.getProgress();

        // Get local data
        const localData = loadGamificationData();

        // Merge: Use server data if it has more progress, otherwise keep local
        if (serverData.totalXP > localData.totalXP) {
            localData.totalXP = serverData.totalXP;
            localData.exercisesCompleted = serverData.exercisesCompleted;
            localData.longestStreak = Math.max(localData.longestStreak, serverData.longestStreak);
            saveGamificationData(localData);

            // Update activity log from server if available
            if (serverData.activityLog && Object.keys(serverData.activityLog).length > 0) {
                const localLog = loadActivityLog();
                const mergedLog = { ...localLog, ...serverData.activityLog };
                localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(mergedLog));
            }

            // Update task analytics from server if available
            if (serverData.taskAnalytics && serverData.taskAnalytics.completedTasks > 0) {
                const localAnalytics = loadTaskAnalytics();
                if (serverData.taskAnalytics.completedTasks > localAnalytics.completedTasks) {
                    localStorage.setItem(TASK_ANALYTICS_KEY, JSON.stringify(serverData.taskAnalytics));
                }
            }

            // Dispatch update for UI refresh
            window.dispatchEvent(new CustomEvent("gamification-update", {
                detail: getGamificationStats()
            }));

            console.log("[Gamification] Loaded from server:", serverData);
        }

        return serverData;
    } catch (error) {
        console.warn("[Gamification] Failed to load from server (offline mode):", error.message);
        return null;
    }
};

// Enhanced addXP that also syncs to server
export const addXPWithSync = async (amount, exerciseId, exerciseName) => {
    // First update locally
    const result = addXP(amount, exerciseId || "exercise");

    // Then sync to server (non-blocking)
    try {
        await progressApi.recordExercise(amount, exerciseId, exerciseName);
        console.log("[Gamification] Exercise recorded on server");
    } catch (error) {
        console.warn("[Gamification] Failed to record exercise on server:", error.message);
    }

    return result;
};

// Initialize: load from server on app start
export const initializeGamification = async () => {
    // First try to load from server
    await loadFromServer();

    // Return current stats
    return getGamificationStats();
};
