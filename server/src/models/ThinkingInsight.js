import mongoose from "mongoose";

/**
 * ThinkingInsight Schema
 * Stores AI-generated insights about user's cognitive patterns and learning behaviors.
 * These insights help users understand how they think and learn.
 */
const thinkingInsightSchema = new mongoose.Schema(
    {
        // User ID - can be Firebase UID or client-key string
        user: {
            type: String,
            required: true,
            index: true,
        },

        insightType: {
            type: String,
            enum: ["growth", "pattern", "recommendation", "comparison", "achievement"],
            required: true,
        },

        title: {
            type: String,
            required: true,
            trim: true,
        },

        description: {
            type: String,
            required: true,
        },

        // Supporting evidence for the insight
        dataPoints: [
            {
                metric: String, // e.g., "accuracy", "response_time", "consistency"
                value: mongoose.Schema.Types.Mixed,
                timestamp: Date,
                context: String,
            },
        ],

        // AI confidence in this insight
        confidence: {
            type: Number,
            min: 0,
            max: 1,
            required: true,
        },

        // Whether this insight has actionable recommendations
        actionable: {
            type: Boolean,
            default: false,
        },

        // Specific recommendation if actionable
        recommendation: {
            action: String, // What the user should do
            expectedBenefit: String, // What they'll gain
            difficulty: {
                type: String,
                enum: ["easy", "moderate", "challenging"],
            },
        },

        // Metadata
        isRead: {
            type: Boolean,
            default: false,
        },

        priority: {
            type: String,
            enum: ["low", "medium", "high"],
            default: "medium",
        },

        // Related challenge or activity that triggered this insight
        relatedActivity: {
            activityType: String, // "challenge", "quiz", "training"
            activityId: mongoose.Schema.Types.ObjectId,
        },

        // Expiration (some insights may become outdated)
        expiresAt: {
            type: Date,
            default: null, // null means never expires
        },

        generatedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

// Index for efficient querying
thinkingInsightSchema.index({ user: 1, insightType: 1 });
thinkingInsightSchema.index({ user: 1, isRead: 1 });
thinkingInsightSchema.index({ user: 1, priority: -1, createdAt: -1 });

// Methods
thinkingInsightSchema.methods.markAsRead = function () {
    this.isRead = true;
    return this.save();
};

// Static methods
thinkingInsightSchema.statics.getUnreadCount = async function (userId) {
    return this.countDocuments({ user: userId, isRead: false });
};

thinkingInsightSchema.statics.getRecentInsights = async function (userId, limit = 10) {
    return this.find({ user: userId })
        .sort({ priority: -1, createdAt: -1 })
        .limit(limit);
};

thinkingInsightSchema.statics.getActionableInsights = async function (userId) {
    return this.find({ user: userId, actionable: true, isRead: false })
        .sort({ priority: -1, createdAt: -1 });
};

export default mongoose.model("ThinkingInsight", thinkingInsightSchema);
