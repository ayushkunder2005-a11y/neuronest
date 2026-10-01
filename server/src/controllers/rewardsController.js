import AvatarProgress from "../models/AvatarProgress.js";
import Badge from "../models/Badge.js";
import CognitiveProfile from "../models/CognitiveProfile.js";
import TimeCapsule from "../models/TimeCapsule.js";
import UserBadge from "../models/UserBadge.js";

// @desc    Get user's avatar progress
// @route   GET /api/rewards/avatar
// @access  Private
export const getAvatarProgress = async (req, res) => {
    try {
        const avatar = await AvatarProgress.getOrCreate(req.user._id);
        const summary = avatar.getSummary();

        res.json({
            success: true,
            avatar: summary,
        });
    } catch (error) {
        console.error("Error fetching avatar progress:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch avatar progress",
            error: error.message,
        });
    }
};

// @desc    Update avatar XP (called after quiz/challenge)
// @route   POST /api/rewards/avatar/add-xp
// @access  Private
export const addAvatarXP = async (req, res) => {
    try {
        const { amount, source, description } = req.body;

        if (!amount || !source) {
            return res.status(400).json({
                success: false,
                message: "Amount and source are required",
            });
        }

        const avatar = await AvatarProgress.getOrCreate(req.user._id);
        const result = await avatar.addXP(amount, source, description || "");

        res.json({
            success: true,
            result,
            avatar: avatar.getSummary(),
        });
    } catch (error) {
        console.error("Error adding XP:", error);
        res.status(500).json({
            success: false,
            message: "Failed to add XP",
            error: error.message,
        });
    }
};

// @desc    Get all badges (unlocked and locked)
// @route   GET /api/rewards/badges
// @access  Private
export const getUserBadges = async (req, res) => {
    try {
        const { filter = "all" } = req.query;

        // Initialize badges for user if not done
        await UserBadge.initializeForUser(req.user._id);

        // Get badges with details
        const badges = await UserBadge.getUserBadgesWithDetails(req.user._id, filter);

        // Count by status
        const unlockedCount = badges.filter((b) => b.isUnlocked).length;
        const lockedCount = badges.filter((b) => !b.isUnlocked).length;

        res.json({
            success: true,
            badges,
            stats: {
                total: badges.length,
                unlocked: unlockedCount,
                locked: lockedCount,
            },
        });
    } catch (error) {
        console.error("Error fetching badges:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch badges",
            error: error.message,
        });
    }
};

// @desc    Check for badge unlocks
// @route   POST /api/rewards/check-unlocks
// @access  Private
export const checkBadgeUnlocks = async (req, res) => {
    try {
        const userStats = req.body;

        // Ensure badges are initialized
        await UserBadge.initializeForUser(req.user._id);

        // Check all badges
        const newlyUnlocked = await UserBadge.checkAllForUser(req.user._id, userStats);

        res.json({
            success: true,
            newlyUnlocked,
            count: newlyUnlocked.length,
        });
    } catch (error) {
        console.error("Error checking badge unlocks:", error);
        res.status(500).json({
            success: false,
            message: "Failed to check badge unlocks",
            error: error.message,
        });
    }
};

// @desc    Get time capsule timeline
// @route   GET /api/rewards/time-capsule
// @access  Private
export const getTimeCapsule = async (req, res) => {
    try {
        const { limit = 20, skip = 0, sortBy = "timestamp" } = req.query;

        const timeline = await TimeCapsule.getUserTimeline(req.user._id, {
            limit: parseInt(limit),
            skip: parseInt(skip),
            sortBy,
        });

        const stats = await TimeCapsule.getUserStats(req.user._id);

        res.json({
            success: true,
            timeline,
            stats,
        });
    } catch (error) {
        console.error("Error fetching time capsule:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch time capsule",
            error: error.message,
        });
    }
};

// @desc    Get specific capsule entry
// @route   GET /api/rewards/time-capsule/:id
// @access  Private
export const getCapsuleEntry = async (req, res) => {
    try {
        const { id } = req.params;

        const capsule = await TimeCapsule.findOne({ _id: id, user: req.user._id });

        if (!capsule) {
            return res.status(404).json({
                success: false,
                message: "Time capsule entry not found",
            });
        }

        const improvementStats = capsule.getImprovementStats();

        res.json({
            success: true,
            capsule: {
                ...capsule.toObject(),
                improvementStats,
            },
        });
    } catch (error) {
        console.error("Error fetching capsule entry:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch capsule entry",
            error: error.message,
        });
    }
};

// @desc    Replay a time capsule challenge
// @route   POST /api/rewards/time-capsule/:id/replay
// @access  Private
export const replayCapsule = async (req, res) => {
    try {
        const { id } = req.params;
        const { answers, time } = req.body;

        if (!answers || !time) {
            return res.status(400).json({
                success: false,
                message: "Answers and time are required",
            });
        }

        const capsule = await TimeCapsule.findOne({ _id: id, user: req.user._id });

        if (!capsule) {
            return res.status(404).json({
                success: false,
                message: "Time capsule entry not found",
            });
        }

        const replayResult = await capsule.replay(answers, time);
        const improvementStats = capsule.getImprovementStats();

        res.json({
            success: true,
            replayResult,
            improvementStats,
        });
    } catch (error) {
        console.error("Error replaying capsule:", error);
        res.status(500).json({
            success: false,
            message: "Failed to replay challenge",
            error: error.message,
        });
    }
};

// @desc    Create time capsule entry from quiz
// @route   POST /api/rewards/time-capsule/create
// @access  Private
export const createTimeCapsule = async (req, res) => {
    try {
        const quizData = req.body;

        if (!quizData.questions || !quizData.answers || quizData.score === undefined) {
            return res.status(400).json({
                success: false,
                message: "Quiz data is incomplete",
            });
        }

        const capsule = await TimeCapsule.createFromQuiz(req.user._id, quizData);

        res.json({
            success: true,
            capsule: capsule.getSummary(),
        });
    } catch (error) {
        console.error("Error creating time capsule:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create time capsule",
            error: error.message,
        });
    }
};

// @desc    Get rewards dashboard summary
// @route   GET /api/rewards/dashboard
// @access  Private
export const getRewardsDashboard = async (req, res) => {
    try {
        // Get avatar
        const avatar = await AvatarProgress.getOrCreate(req.user._id);
        const avatarSummary = avatar.getSummary();

        // Get badges
        await UserBadge.initializeForUser(req.user._id);
        const badges = await UserBadge.getUserBadgesWithDetails(req.user._id, "all");
        const unlockedBadges = badges.filter((b) => b.isUnlocked);
        const recentUnlocks = unlockedBadges
            .sort((a, b) => new Date(b.unlockedAt) - new Date(a.unlockedAt))
            .slice(0, 3);

        // Get time capsule stats
        const timeCapsuleStats = await TimeCapsule.getUserStats(req.user._id);

        // Get cognitive profile for additional stats
        let cognitiveStats = null;
        try {
            const cognitiveProfile = await CognitiveProfile.findOne({ user: req.user._id });
            if (cognitiveProfile) {
                cognitiveStats = {
                    interactions: cognitiveProfile.interactions,
                    maturity: cognitiveProfile.profileMaturity,
                };
            }
        } catch (err) {
            // Cognitive profile might not exist
            console.warn("Cognitive profile not found for user");
        }

        res.json({
            success: true,
            dashboard: {
                avatar: avatarSummary,
                badges: {
                    total: badges.length,
                    unlocked: unlockedBadges.length,
                    recentUnlocks,
                },
                timeCapsule: timeCapsuleStats,
                cognitive: cognitiveStats,
            },
        });
    } catch (error) {
        console.error("Error fetching rewards dashboard:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch rewards dashboard",
            error: error.message,
        });
    }
};

// @desc    Update avatar skills after activity
// @route   POST /api/rewards/avatar/update-skills
// @access  Private
export const updateAvatarSkills = async (req, res) => {
    try {
        const { skillName, performanceData } = req.body;

        if (!skillName || !performanceData) {
            return res.status(400).json({
                success: false,
                message: "Skill name and performance data are required",
            });
        }

        const avatar = await AvatarProgress.getOrCreate(req.user._id);
        const result = await avatar.updateSkillLevel(skillName, performanceData);

        res.json({
            success: true,
            result,
            avatar: avatar.getSummary(),
        });
    } catch (error) {
        console.error("Error updating skills:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update skills",
            error: error.message,
        });
    }
};

// @desc    Seed badges (admin/development use)
// @route   POST /api/rewards/seed-badges
// @access  Private (should add admin check in production)
export const seedBadges = async (req, res) => {
    try {
        const badges = await Badge.seedBadges();

        res.json({
            success: true,
            message: `Seeded ${badges.length} badges`,
            badges: badges.map((b) => ({ id: b.badgeId, name: b.name })),
        });
    } catch (error) {
        console.error("Error seeding badges:", error);
        res.status(500).json({
            success: false,
            message: "Failed to seed badges",
            error: error.message,
        });
    }
};
