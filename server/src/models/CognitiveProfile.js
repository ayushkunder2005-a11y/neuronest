import mongoose from "mongoose";

/**
 * CognitiveProfile Schema
 * Stores a user's cognitive fingerprint extracted from their interactions
 * with the NeuroNest platform. Used to model thinking patterns and create
 * an AI Twin that can predict user behavior.
 */
const cognitiveProfileSchema = new mongoose.Schema(
    {
        // User ID - can be Firebase UID or client-key string
        user: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },

        // Thinking Style Metrics
        thinkingStyle: {
            responseSpeed: {
                type: String,
                enum: ["fast", "medium", "slow"],
                default: "medium",
            },
            averageResponseTime: {
                type: Number, // in seconds
                default: 0,
            },
            decisionPattern: {
                type: Number, // 0 = impulsive, 1 = deliberate
                min: 0,
                max: 1,
                default: 0.5,
            },
            riskTolerance: {
                type: Number, // 0 = conservative, 1 = adventurous
                min: 0,
                max: 1,
                default: 0.5,
            },
            errorPatterns: [
                {
                    type: {
                        type: String, // e.g., "rushing", "overthinking", "pattern_recognition"
                    },
                    frequency: {
                        type: Number,
                        min: 0,
                        max: 1,
                    },
                },
            ],
        },

        // Learning Preferences
        learningPreferences: {
            visualLearner: {
                type: Number,
                min: 0,
                max: 1,
                default: 0.33,
            },
            auditoryLearner: {
                type: Number,
                min: 0,
                max: 1,
                default: 0.33,
            },
            practicalLearner: {
                type: Number,
                min: 0,
                max: 1,
                default: 0.33,
            },
            preferredDifficulty: {
                type: String,
                enum: ["beginner", "intermediate", "advanced", "adaptive"],
                default: "adaptive",
            },
        },

        // Cognitive Performance Metrics
        cognitiveMetrics: {
            focusScore: {
                type: Number,
                min: 0,
                max: 100,
                default: 50,
            },
            adaptabilityScore: {
                type: Number,
                min: 0,
                max: 100,
                default: 50,
            },
            persistenceScore: {
                type: Number,
                min: 0,
                max: 100,
                default: 50,
            },
            accuracyTrend: {
                type: String,
                enum: ["improving", "stable", "declining", "insufficient_data"],
                default: "insufficient_data",
            },
        },

        // Historical Interaction Summary
        interactionHistory: [
            {
                timestamp: {
                    type: Date,
                    default: Date.now,
                },
                activityType: {
                    type: String, // e.g., "quiz", "challenge", "training"
                },
                performance: {
                    type: Number, // 0-100 score
                    min: 0,
                    max: 100,
                },
                timeSpent: {
                    type: Number, // in seconds
                },
                keyPatterns: [String], // extracted patterns from this interaction
            },
        ],

        // Profile Metadata
        totalInteractions: {
            type: Number,
            default: 0,
            min: 0,
        },
        profileMaturity: {
            type: String,
            enum: ["building", "developing", "mature", "expert"],
            default: "building",
        },
        lastUpdated: {
            type: Date,
            default: Date.now,
        },
        confidenceScore: {
            type: Number, // How confident we are in the profile accuracy
            min: 0,
            max: 1,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

// Methods
cognitiveProfileSchema.methods.updateFromInteraction = function (interactionData) {
    this.totalInteractions += 1;
    this.lastUpdated = new Date();

    // Update profile maturity based on interaction count
    if (this.totalInteractions >= 50) {
        this.profileMaturity = "expert";
        this.confidenceScore = Math.min(0.95, this.confidenceScore + 0.05);
    } else if (this.totalInteractions >= 20) {
        this.profileMaturity = "mature";
        this.confidenceScore = Math.min(0.8, this.confidenceScore + 0.04);
    } else if (this.totalInteractions >= 5) {
        this.profileMaturity = "developing";
        this.confidenceScore = Math.min(0.6, this.confidenceScore + 0.03);
    }

    // Add to interaction history (keep last 100)
    this.interactionHistory.push(interactionData);
    if (this.interactionHistory.length > 100) {
        this.interactionHistory.shift();
    }
};

cognitiveProfileSchema.methods.getProfileSummary = function () {
    return {
        maturity: this.profileMaturity,
        interactions: this.totalInteractions,
        confidence: this.confidenceScore,
        thinkingStyle: this.thinkingStyle,
        learningPreferences: this.learningPreferences,
        cognitiveMetrics: this.cognitiveMetrics,
    };
};

export default mongoose.model("CognitiveProfile", cognitiveProfileSchema);
