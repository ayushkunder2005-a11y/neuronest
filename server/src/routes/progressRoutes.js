import express from "express";
import UserProgress from "../models/UserProgress.js";

const router = express.Router();

// Helper to get owner key from request (user ID or client key)
const resolveOwnerKey = (req) => {
    if (req.user?._id) {
        return { user: req.user._id };
    }
    const clientKey = req.headers["x-client-key"];
    if (clientKey) {
        return { clientKey };
    }
    return null;
};

// Calculate level from XP
const calculateLevel = (totalXP) => {
    const thresholds = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500, 7500];
    for (let i = thresholds.length - 1; i >= 0; i--) {
        if (totalXP >= thresholds[i]) {
            return i + 1;
        }
    }
    return 1;
};

// GET /api/progress - Get user's progress
router.get("/", async (req, res) => {
    try {
        const owner = resolveOwnerKey(req);
        if (!owner) {
            return res.status(400).json({ message: "Missing user context. Provide x-client-key header." });
        }

        let progress = await UserProgress.findOne(owner);

        if (!progress) {
            // Return default progress if none exists
            return res.json({
                totalXP: 0,
                level: 1,
                streak: 0,
                longestStreak: 0,
                exercisesCompleted: 0,
                tasksCompleted: 0,
                activityLog: {},
                taskAnalytics: { totalTasks: 0, completedTasks: 0, categoryStats: {} },
            });
        }

        res.json({
            totalXP: progress.totalXP,
            level: progress.level,
            streak: progress.streak,
            longestStreak: progress.longestStreak,
            exercisesCompleted: progress.exercisesCompleted,
            tasksCompleted: progress.tasksCompleted,
            lastActiveDate: progress.lastActiveDate,
            activityLog: Object.fromEntries(progress.activityLog || new Map()),
            taskAnalytics: {
                totalTasks: progress.taskAnalytics?.totalTasks || 0,
                completedTasks: progress.taskAnalytics?.completedTasks || 0,
                categoryStats: Object.fromEntries(progress.taskAnalytics?.categoryStats || new Map()),
            },
        });
    } catch (err) {
        console.error("[Progress] GET error:", err);
        res.status(500).json({ message: err.message });
    }
});

// POST /api/progress/sync - Full sync from client
router.post("/sync", async (req, res) => {
    try {
        const owner = resolveOwnerKey(req);
        if (!owner) {
            return res.status(400).json({ message: "Missing user context. Provide x-client-key header." });
        }

        const { totalXP, streak, longestStreak, exercisesCompleted, activityLog, taskAnalytics } = req.body;

        const updateData = {
            ...owner,
            totalXP: totalXP || 0,
            level: calculateLevel(totalXP || 0),
            streak: streak || 0,
            longestStreak: longestStreak || 0,
            exercisesCompleted: exercisesCompleted || 0,
            lastActiveDate: new Date().toISOString().split("T")[0],
        };

        if (activityLog) {
            updateData.activityLog = activityLog;
        }
        if (taskAnalytics) {
            updateData.taskAnalytics = taskAnalytics;
            updateData.tasksCompleted = taskAnalytics.completedTasks || 0;
        }

        const progress = await UserProgress.findOneAndUpdate(
            owner,
            { $set: updateData },
            { upsert: true, new: true }
        );

        res.json({
            success: true,
            totalXP: progress.totalXP,
            level: progress.level,
            streak: progress.streak,
        });
    } catch (err) {
        console.error("[Progress] Sync error:", err);
        res.status(500).json({ message: err.message });
    }
});

// POST /api/progress/exercise - Record exercise completion
router.post("/exercise", async (req, res) => {
    try {
        const owner = resolveOwnerKey(req);
        if (!owner) {
            return res.status(400).json({ message: "Missing user context. Provide x-client-key header." });
        }

        const { xpEarned, exerciseId, exerciseName } = req.body;
        const today = new Date().toISOString().split("T")[0];

        // Get or create progress
        let progress = await UserProgress.findOne(owner);
        if (!progress) {
            progress = new UserProgress({ ...owner });
        }

        // Update XP and exercises
        progress.totalXP = (progress.totalXP || 0) + (xpEarned || 0);
        progress.exercisesCompleted = (progress.exercisesCompleted || 0) + 1;
        progress.level = calculateLevel(progress.totalXP);
        progress.lastActiveDate = today;

        // Update activity log
        if (!progress.activityLog) {
            progress.activityLog = new Map();
        }
        const dayLog = progress.activityLog.get(today) || { count: 0, types: [] };
        dayLog.count += 1;
        if (exerciseId && !dayLog.types.includes(exerciseId)) {
            dayLog.types.push(exerciseId);
        }
        progress.activityLog.set(today, dayLog);

        // Calculate streak
        const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
        if (progress.lastActiveDate === yesterday || progress.activityLog.has(yesterday)) {
            progress.streak = (progress.streak || 0) + 1;
        } else if (progress.lastActiveDate !== today) {
            progress.streak = 1;
        }
        if (progress.streak > (progress.longestStreak || 0)) {
            progress.longestStreak = progress.streak;
        }

        await progress.save();

        res.json({
            success: true,
            totalXP: progress.totalXP,
            level: progress.level,
            streak: progress.streak,
            exercisesCompleted: progress.exercisesCompleted,
        });
    } catch (err) {
        console.error("[Progress] Exercise error:", err);
        res.status(500).json({ message: err.message });
    }
});

// POST /api/progress/task - Record task completion
router.post("/task", async (req, res) => {
    try {
        const owner = resolveOwnerKey(req);
        if (!owner) {
            return res.status(400).json({ message: "Missing user context. Provide x-client-key header." });
        }

        const { taskId, category, isCreation } = req.body;

        let progress = await UserProgress.findOne(owner);
        if (!progress) {
            progress = new UserProgress({ ...owner });
        }

        if (!progress.taskAnalytics) {
            progress.taskAnalytics = { totalTasks: 0, completedTasks: 0, categoryStats: new Map() };
        }

        if (isCreation) {
            // Task created
            progress.taskAnalytics.totalTasks = (progress.taskAnalytics.totalTasks || 0) + 1;
        } else {
            // Task completed
            progress.taskAnalytics.completedTasks = (progress.taskAnalytics.completedTasks || 0) + 1;
            progress.tasksCompleted = (progress.tasksCompleted || 0) + 1;
        }

        // Update category stats
        if (category) {
            const catStats = progress.taskAnalytics.categoryStats.get(category) || { total: 0, completed: 0 };
            if (isCreation) {
                catStats.total += 1;
            } else {
                catStats.completed += 1;
            }
            progress.taskAnalytics.categoryStats.set(category, catStats);
        }

        await progress.save();

        res.json({
            success: true,
            tasksCompleted: progress.tasksCompleted,
            taskAnalytics: {
                totalTasks: progress.taskAnalytics.totalTasks,
                completedTasks: progress.taskAnalytics.completedTasks,
            },
        });
    } catch (err) {
        console.error("[Progress] Task error:", err);
        res.status(500).json({ message: err.message });
    }
});

export default router;
