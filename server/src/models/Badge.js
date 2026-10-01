import mongoose from "mongoose";

const badgeSchema = new mongoose.Schema(
    {
        badgeId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
        },
        icon: {
            type: String,
            required: true, // Emoji or icon class
        },
        category: {
            type: String,
            required: true,
            enum: ["logic_speed", "focus_control", "consistency", "achievement"],
        },
        description: {
            type: String,
            required: true,
        },
        criteria: {
            type: {
                type: String,
                required: true,
                enum: [
                    "avg_speed",
                    "consistency_score",
                    "streak_days",
                    "quiz_count",
                    "perfect_score",
                    "ai_twin_wins",
                    "improvement",
                    "completion",
                ],
            },
            threshold: Number, // Numeric threshold (e.g., 60 seconds, 90%)
            count: Number, // How many times to meet threshold
            comparison: {
                type: String,
                enum: ["less_than", "greater_than", "equals"],
                default: "greater_than",
            },
        },
        rarity: {
            type: String,
            enum: ["common", "rare", "epic", "legendary"],
            default: "common",
        },
        unlockedBy: {
            type: Number,
            default: 0, // Count of users who unlocked this badge
        },
        isActive: {
            type: Boolean,
            default: true, // Can deactivate badges
        },
    },
    { timestamps: true }
);

// Static method to seed initial badges
badgeSchema.statics.seedBadges = async function () {
    const badges = [
        // Logic Speed Badges
        {
            badgeId: "quick_thinker",
            name: "Quick Thinker",
            icon: "⚡",
            category: "logic_speed",
            description: "Complete 5 quizzes averaging <60s per question",
            criteria: {
                type: "avg_speed",
                threshold: 60,
                count: 5,
                comparison: "less_than",
            },
            rarity: "common",
        },
        {
            badgeId: "lightning_brain",
            name: "Lightning Brain",
            icon: "🚀",
            category: "logic_speed",
            description: "Complete 10 quizzes averaging <45s per question",
            criteria: {
                type: "avg_speed",
                threshold: 45,
                count: 10,
                comparison: "less_than",
            },
            rarity: "rare",
        },
        {
            badgeId: "speed_demon",
            name: "Speed Demon",
            icon: "💨",
            category: "logic_speed",
            description: "Complete 20 quizzes averaging <30s per question",
            criteria: {
                type: "avg_speed",
                threshold: 30,
                count: 20,
                comparison: "less_than",
            },
            rarity: "epic",
        },

        // Focus Control Badges
        {
            badgeId: "focused_mind",
            name: "Focused Mind",
            icon: "🎯",
            category: "focus_control",
            description: "Achieve 80%+ consistency score for 5 sessions",
            criteria: {
                type: "consistency_score",
                threshold: 80,
                count: 5,
                comparison: "greater_than",
            },
            rarity: "common",
        },
        {
            badgeId: "zen_master",
            name: "Zen Master",
            icon: "🧘",
            category: "focus_control",
            description: "Achieve 90%+ consistency score for 10 sessions",
            criteria: {
                type: "consistency_score",
                threshold: 90,
                count: 10,
                comparison: "greater_than",
            },
            rarity: "rare",
        },
        {
            badgeId: "flow_state",
            name: "Flow State",
            icon: "🔮",
            category: "focus_control",
            description: "Achieve 95%+ consistency score for 20 sessions",
            criteria: {
                type: "consistency_score",
                threshold: 95,
                count: 20,
                comparison: "greater_than",
            },
            rarity: "legendary",
        },

        // Consistency Badges
        {
            badgeId: "committed_learner",
            name: "Committed Learner",
            icon: "📅",
            category: "consistency",
            description: "Maintain a 5-day streak",
            criteria: {
                type: "streak_days",
                threshold: 5,
                count: 1,
                comparison: "greater_than",
            },
            rarity: "common",
        },
        {
            badgeId: "on_fire",
            name: "On Fire",
            icon: "🔥",
            category: "consistency",
            description: "Maintain a 10-day streak",
            criteria: {
                type: "streak_days",
                threshold: 10,
                count: 1,
                comparison: "greater_than",
            },
            rarity: "rare",
        },
        {
            badgeId: "unstoppable",
            name: "Unstoppable",
            icon: "⭐",
            category: "consistency",
            description: "Maintain a 30-day streak",
            criteria: {
                type: "streak_days",
                threshold: 30,
                count: 1,
                comparison: "greater_than",
            },
            rarity: "legendary",
        },

        // Achievement Badges
        {
            badgeId: "first_steps",
            name: "First Steps",
            icon: "🎓",
            category: "achievement",
            description: "Complete your first quiz",
            criteria: {
                type: "quiz_count",
                threshold: 1,
                count: 1,
                comparison: "greater_than",
            },
            rarity: "common",
        },
        {
            badgeId: "perfectionist",
            name: "Perfectionist",
            icon: "💯",
            category: "achievement",
            description: "Score 100% on any quiz",
            criteria: {
                type: "perfect_score",
                threshold: 100,
                count: 1,
                comparison: "equals",
            },
            rarity: "rare",
        },
        {
            badgeId: "ai_vanquisher",
            name: "AI Vanquisher",
            icon: "🤖",
            category: "achievement",
            description: "Beat your AI Twin 5 times",
            criteria: {
                type: "ai_twin_wins",
                threshold: 5,
                count: 1,
                comparison: "greater_than",
            },
            rarity: "epic",
        },
        {
            badgeId: "growth_mindset",
            name: "Growth Mindset",
            icon: "📈",
            category: "achievement",
            description: "Show 20%+ improvement in any metric",
            criteria: {
                type: "improvement",
                threshold: 20,
                count: 1,
                comparison: "greater_than",
            },
            rarity: "rare",
        },
    ];

    for (const badge of badges) {
        await this.findOneAndUpdate({ badgeId: badge.badgeId }, badge, {
            upsert: true,
            new: true,
        });
    }

    console.log(`✅ Seeded ${badges.length} badges`);
    return badges;
};

// Get all badges
badgeSchema.statics.getAllBadges = async function () {
    return await this.find({ isActive: true }).sort({ category: 1, rarity: 1 });
};

// Get badges by category
badgeSchema.statics.getBadgesByCategory = async function (category) {
    return await this.find({ category, isActive: true }).sort({ rarity: 1 });
};

const Badge = mongoose.model("Badge", badgeSchema);

export default Badge;
