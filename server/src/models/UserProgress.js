import mongoose from "mongoose";

const userProgressSchema = new mongoose.Schema(
    {
        // Support both authenticated users and client-key based identification
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            sparse: true,
        },
        clientKey: {
            type: String,
            index: true,
            trim: true,
        },

        // Gamification stats
        totalXP: {
            type: Number,
            default: 0,
            min: 0,
        },
        level: {
            type: Number,
            default: 1,
            min: 1,
        },
        streak: {
            type: Number,
            default: 0,
            min: 0,
        },
        longestStreak: {
            type: Number,
            default: 0,
            min: 0,
        },
        exercisesCompleted: {
            type: Number,
            default: 0,
            min: 0,
        },
        tasksCompleted: {
            type: Number,
            default: 0,
            min: 0,
        },
        lastActiveDate: {
            type: String, // YYYY-MM-DD format
            default: "",
        },

        // Activity log - map of date strings to activity data
        activityLog: {
            type: Map,
            of: {
                count: Number,
                types: [String],
            },
            default: {},
        },

        // Task analytics
        taskAnalytics: {
            totalTasks: { type: Number, default: 0 },
            completedTasks: { type: Number, default: 0 },
            categoryStats: { type: Map, of: Object, default: {} },
        },
    },
    { timestamps: true }
);

// Compound indexes for efficient lookups
userProgressSchema.index({ user: 1, clientKey: 1 });
userProgressSchema.index({ clientKey: 1 }, { unique: true, sparse: true });

export default mongoose.model("UserProgress", userProgressSchema);
