import mongoose from "mongoose";

const avatarProgressSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
            index: true,
        },
        currentStage: {
            type: String,
            enum: ["novice", "explorer", "scholar", "master", "sage"],
            default: "novice",
        },
        totalXP: {
            type: Number,
            default: 0,
            min: 0,
        },
        skillLevels: {
            logicSpeed: { type: Number, default: 0, min: 0, max: 100 },
            focusControl: { type: Number, default: 0, min: 0, max: 100 },
            memoryRetention: { type: Number, default: 0, min: 0, max: 100 },
            adaptability: { type: Number, default: 0, min: 0, max: 100 },
        },
        lastXPGain: {
            type: Date,
            default: null,
        },
        xpHistory: [
            {
                date: { type: Date, default: Date.now },
                amount: { type: Number, required: true },
                source: {
                    type: String,
                    required: true,
                    enum: ["quiz", "challenge", "streak", "achievement"],
                },
                description: String,
            },
        ],
        streakDays: {
            type: Number,
            default: 0,
        },
        lastActivityDate: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

// XP thresholds for each stage
const STAGE_THRESHOLDS = {
    novice: 0,
    explorer: 101,
    scholar: 301,
    master: 601,
    sage: 1001,
};

// Get stage name from XP
avatarProgressSchema.methods.getStageFromXP = function () {
    const xp = this.totalXP;
    if (xp >= STAGE_THRESHOLDS.sage) return "sage";
    if (xp >= STAGE_THRESHOLDS.master) return "master";
    if (xp >= STAGE_THRESHOLDS.scholar) return "scholar";
    if (xp >= STAGE_THRESHOLDS.explorer) return "explorer";
    return "novice";
};

// Get XP needed for next stage
avatarProgressSchema.methods.getNextStageRequirement = function () {
    const currentStage = this.currentStage;
    const stageOrder = ["novice", "explorer", "scholar", "master", "sage"];
    const currentIndex = stageOrder.indexOf(currentStage);

    if (currentIndex === stageOrder.length - 1) {
        return { nextStage: null, xpNeeded: 0, isMaxStage: true };
    }

    const nextStage = stageOrder[currentIndex + 1];
    const nextThreshold = STAGE_THRESHOLDS[nextStage];
    const xpNeeded = nextThreshold - this.totalXP;

    return {
        nextStage,
        nextThreshold,
        xpNeeded: Math.max(0, xpNeeded),
        isMaxStage: false,
    };
};

// Add XP and check for stage upgrade
avatarProgressSchema.methods.addXP = async function (amount, source, description = "") {
    const previousXP = this.totalXP;
    const previousStage = this.currentStage;

    this.totalXP += amount;
    this.lastXPGain = new Date();

    // Add to history
    this.xpHistory.push({
        date: new Date(),
        amount,
        source,
        description,
    });

    // Check for stage upgrade
    const newStage = this.getStageFromXP();
    const stagedUp = newStage !== previousStage;

    if (stagedUp) {
        this.currentStage = newStage;
    }

    await this.save();

    return {
        stagedUp,
        previousStage,
        newStage: this.currentStage,
        previousXP,
        newXP: this.totalXP,
        xpGained: amount,
    };
};

// Update specific skill level based on performance
avatarProgressSchema.methods.updateSkillLevel = async function (skillName, performanceData) {
    if (!this.skillLevels.hasOwnProperty(skillName)) {
        throw new Error(`Invalid skill name: ${skillName}`);
    }

    // Calculate new skill level based on performance
    // performanceData = { score, speed, consistency, etc. }
    let skillIncrease = 0;

    switch (skillName) {
        case "logicSpeed":
            // Based on response time
            if (performanceData.avgResponseTime < 30) skillIncrease = 5;
            else if (performanceData.avgResponseTime < 60) skillIncrease = 3;
            else skillIncrease = 1;
            break;

        case "focusControl":
            // Based on consistency
            if (performanceData.consistency >= 90) skillIncrease = 5;
            else if (performanceData.consistency >= 80) skillIncrease = 3;
            else skillIncrease = 1;
            break;

        case "memoryRetention":
            // Based on accuracy over time
            if (performanceData.accuracy >= 90) skillIncrease = 5;
            else if (performanceData.accuracy >= 75) skillIncrease = 3;
            else skillIncrease = 1;
            break;

        case "adaptability":
            // Based on performance across difficulties
            if (performanceData.crossDifficultyScore >= 85) skillIncrease = 5;
            else if (performanceData.crossDifficultyScore >= 70) skillIncrease = 3;
            else skillIncrease = 1;
            break;
    }

    // Update skill level (cap at 100)
    this.skillLevels[skillName] = Math.min(100, this.skillLevels[skillName] + skillIncrease);

    await this.save();

    return {
        skillName,
        newLevel: this.skillLevels[skillName],
        increase: skillIncrease,
    };
};

// Update streak
avatarProgressSchema.methods.updateStreak = async function () {
    const now = new Date();
    const lastActivity = this.lastActivityDate;

    if (!lastActivity) {
        // First activity
        this.streakDays = 1;
        this.lastActivityDate = now;
        await this.save();
        return { streakDays: 1, isNewStreak: true };
    }

    const daysSinceLastActivity = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));

    if (daysSinceLastActivity === 0) {
        // Same day, no change
        return { streakDays: this.streakDays, isNewStreak: false };
    } else if (daysSinceLastActivity === 1) {
        // Consecutive day, increase streak
        this.streakDays += 1;
        this.lastActivityDate = now;
        await this.save();
        return { streakDays: this.streakDays, isNewStreak: false };
    } else {
        // Streak broken, reset
        this.streakDays = 1;
        this.lastActivityDate = now;
        await this.save();
        return { streakDays: 1, isNewStreak: true, streakBroken: true };
    }
};

// Get avatar summary
avatarProgressSchema.methods.getSummary = function () {
    const nextStageInfo = this.getNextStageRequirement();

    return {
        currentStage: this.currentStage,
        totalXP: this.totalXP,
        skillLevels: this.skillLevels,
        streakDays: this.streakDays,
        nextStage: nextStageInfo,
        recentXPGains: this.xpHistory.slice(-5).reverse(), // Last 5 XP gains
    };
};

// Static method to get or create avatar for user
avatarProgressSchema.statics.getOrCreate = async function (userId) {
    let avatar = await this.findOne({ user: userId });

    if (!avatar) {
        avatar = await this.create({
            user: userId,
            currentStage: "novice",
            totalXP: 0,
        });
    }

    return avatar;
};

const AvatarProgress = mongoose.model("AvatarProgress", avatarProgressSchema);

export default AvatarProgress;
