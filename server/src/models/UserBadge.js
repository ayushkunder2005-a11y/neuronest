import mongoose from "mongoose";
import Badge from "./Badge.js";

const userBadgeSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        badgeId: {
            type: String,
            required: true,
            index: true,
        },
        isUnlocked: {
            type: Boolean,
            default: false,
        },
        progress: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
        },
        currentCount: {
            type: Number,
            default: 0, // How many times criteria met so far
        },
        unlockedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

// Compound index for user + badge
userBadgeSchema.index({ user: 1, badgeId: 1 }, { unique: true });

// Check if badge criteria is met and unlock if so
userBadgeSchema.methods.checkUnlock = async function (userStats) {
    if (this.isUnlocked) {
        return { unlocked: false, alreadyUnlocked: true };
    }

    // Get badge definition
    const badge = await Badge.findOne({ badgeId: this.badgeId });
    if (!badge) {
        throw new Error(`Badge not found: ${this.badgeId}`);
    }

    const { criteria } = badge;
    let metCriteria = false;

    switch (criteria.type) {
        case "avg_speed":
            // Check if user has met avg speed threshold enough times
            if (userStats.avgSpeed && criteria.comparison === "less_than") {
                if (userStats.avgSpeed < criteria.threshold) {
                    this.currentCount += 1;
                }
            }
            metCriteria = this.currentCount >= criteria.count;
            break;

        case "consistency_score":
            // Check consistency score
            if (userStats.consistencyScore && criteria.comparison === "greater_than") {
                if (userStats.consistencyScore >= criteria.threshold) {
                    this.currentCount += 1;
                }
            }
            metCriteria = this.currentCount >= criteria.count;
            break;

        case "streak_days":
            // Check streak
            if (userStats.streakDays && criteria.comparison === "greater_than") {
                metCriteria = userStats.streakDays >= criteria.threshold;
            }
            break;

        case "quiz_count":
            // Check total quiz count
            if (userStats.totalQuizzes && criteria.comparison === "greater_than") {
                metCriteria = userStats.totalQuizzes >= criteria.threshold;
            }
            break;

        case "perfect_score":
            // Check for perfect score
            if (userStats.latestScore === 100) {
                metCriteria = true;
            }
            break;

        case "ai_twin_wins":
            // Check AI Twin wins
            if (userStats.aiTwinWins && criteria.comparison === "greater_than") {
                metCriteria = userStats.aiTwinWins >= criteria.threshold;
            }
            break;

        case "improvement":
            // Check improvement percentage
            if (userStats.improvementPercentage && criteria.comparison === "greater_than") {
                metCriteria = userStats.improvementPercentage >= criteria.threshold;
            }
            break;

        case "completion":
            // Check if specific milestone completed
            metCriteria = userStats.completedMilestone === true;
            break;
    }

    if (metCriteria) {
        this.isUnlocked = true;
        this.unlockedAt = new Date();
        this.progress = 100;
        await this.save();

        // Increment badge unlock count
        await Badge.findOneAndUpdate({ badgeId: this.badgeId }, { $inc: { unlockedBy: 1 } });

        return { unlocked: true, badge };
    }

    // Update progress
    this.updateProgress(userStats, criteria);
    await this.save();

    return { unlocked: false, progress: this.progress };
};

// Update progress percentage
userBadgeSchema.methods.updateProgress = function (userStats, criteria) {
    let progress = 0;

    switch (criteria.type) {
        case "avg_speed":
        case "consistency_score":
            // Progress based on count
            progress = (this.currentCount / criteria.count) * 100;
            break;

        case "streak_days":
            progress = Math.min(100, (userStats.streakDays / criteria.threshold) * 100);
            break;

        case "quiz_count":
            progress = Math.min(100, (userStats.totalQuizzes / criteria.threshold) * 100);
            break;

        case "ai_twin_wins":
            progress = Math.min(100, (userStats.aiTwinWins / criteria.threshold) * 100);
            break;

        case "improvement":
            progress = Math.min(100, (userStats.improvementPercentage / criteria.threshold) * 100);
            break;

        case "perfect_score":
        case "completion":
            progress = userStats.latestScore || 0;
            break;
    }

    this.progress = Math.round(Math.min(100, progress));
};

// Static method to initialize badges for a user
userBadgeSchema.statics.initializeForUser = async function (userId) {
    const allBadges = await Badge.find({ isActive: true });

    const userBadges = [];
    for (const badge of allBadges) {
        const existingBadge = await this.findOne({ user: userId, badgeId: badge.badgeId });

        if (!existingBadge) {
            const userBadge = await this.create({
                user: userId,
                badgeId: badge.badgeId,
                isUnlocked: false,
                progress: 0,
                currentCount: 0,
            });
            userBadges.push(userBadge);
        }
    }

    return userBadges;
};

// Get all badges for user with details
userBadgeSchema.statics.getUserBadgesWithDetails = async function (userId, filter = "all") {
    const userBadges = await this.find({ user: userId });
    const badgeDetails = await Badge.find({ isActive: true });

    const badgeMap = {};
    badgeDetails.forEach((badge) => {
        badgeMap[badge.badgeId] = badge.toObject();
    });

    const enrichedBadges = userBadges.map((ub) => ({
        ...ub.toObject(),
        badgeInfo: badgeMap[ub.badgeId] || null,
    }));

    // Filter
    if (filter === "unlocked") {
        return enrichedBadges.filter((b) => b.isUnlocked);
    } else if (filter === "locked") {
        return enrichedBadges.filter((b) => !b.isUnlocked);
    }

    return enrichedBadges;
};

// Check all badges for user and unlock any that are newly earned
userBadgeSchema.statics.checkAllForUser = async function (userId, userStats) {
    const userBadges = await this.find({ user: userId, isUnlocked: false });

    const newlyUnlocked = [];

    for (const userBadge of userBadges) {
        const result = await userBadge.checkUnlock(userStats);
        if (result.unlocked) {
            newlyUnlocked.push({
                ...userBadge.toObject(),
                badgeInfo: result.badge,
            });
        }
    }

    return newlyUnlocked;
};

const UserBadge = mongoose.model("UserBadge", userBadgeSchema);

export default UserBadge;
