import mongoose from "mongoose";

/**
 * ChallengeAttempt Schema
 * Tracks challenges where users compete against their AI Twin.
 * Stores both user and AI Twin responses for comparison.
 */
const challengeAttemptSchema = new mongoose.Schema(
    {
        // User ID - can be Firebase UID or client-key string
        user: {
            type: String,
            required: true,
            index: true,
        },

        challengeType: {
            type: String,
            enum: ["quiz", "problem_solving", "speed_test", "reasoning", "memory"],
            required: true,
        },

        difficulty: {
            type: String,
            enum: ["beginner", "intermediate", "advanced"],
            default: "intermediate",
        },

        // Challenge Data
        challengeData: {
            title: {
                type: String,
                required: true,
            },
            description: String,
            questions: [
                {
                    question: String,
                    options: [String],
                    correctAnswer: Number,
                    topic: String,
                    difficulty: String,
                },
            ],
            timeLimit: Number, // in seconds, null for untimed
        },

        // User's Response
        userResponse: {
            answers: [Number], // indices of selected answers
            startTime: Date,
            endTime: Date,
            totalTime: Number, // in seconds
            answerTimes: [Number], // time per question in seconds
            approach: String, // AI-analyzed description of user's approach
        },

        // AI Twin's Predicted Response (based on cognitive profile)
        aiTwinResponse: {
            predictedAnswers: [Number],
            predictedTime: Number,
            confidence: Number, // how confident the prediction is
            basedOnPatterns: [String], // which patterns were used for prediction
        },

        // Scoring
        userScore: {
            type: Number,
            min: 0,
            max: 100,
            default: 0,
        },

        aiTwinScore: {
            type: Number,
            min: 0,
            max: 100,
            default: 0,
        },

        // Detailed Comparison
        comparisonData: {
            accuracyComparison: {
                userAccuracy: Number,
                aiTwinAccuracy: Number,
                improvement: Number, // positive = user improved from past
            },
            timeComparison: {
                userTime: Number,
                aiTwinTime: Number,
                speedChange: String, // "faster", "slower", "similar"
            },
            approachDifference: {
                description: String, // qualitative analysis
                keyChanges: [String], // specific behavioral changes
            },
            questionsWhereDifferent: [
                {
                    questionIndex: Number,
                    userAnswer: Number,
                    aiTwinAnswer: Number,
                    userCorrect: Boolean,
                    aiTwinCorrect: Boolean,
                    insight: String,
                },
            ],
        },

        // Generated Insights
        insightsGenerated: [
            {
                type: String, // "improvement", "regression", "consistency", "new_pattern"
                title: String,
                description: String,
                confidence: Number,
            },
        ],

        // Challenge Outcome
        outcome: {
            type: String,
            enum: ["user_won", "ai_twin_won", "tie", "incomplete"],
            default: "incomplete",
        },

        completed: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

// Calculate the outcome based on scores
challengeAttemptSchema.methods.calculateOutcome = function () {
    const scoreDiff = this.userScore - this.aiTwinScore;

    if (Math.abs(scoreDiff) < 5) {
        this.outcome = "tie";
    } else if (scoreDiff > 0) {
        this.outcome = "user_won";
    } else {
        this.outcome = "ai_twin_won";
    }

    return this.outcome;
};

// Calculate user score based on correct answers
challengeAttemptSchema.methods.calculateUserScore = function () {
    if (!this.challengeData.questions || !this.userResponse.answers) {
        return 0;
    }

    let correct = 0;
    const total = this.challengeData.questions.length;

    this.challengeData.questions.forEach((q, idx) => {
        if (this.userResponse.answers[idx] === q.correctAnswer) {
            correct++;
        }
    });

    this.userScore = Math.round((correct / total) * 100);
    return this.userScore;
};

// Calculate AI Twin score based on predicted answers
challengeAttemptSchema.methods.calculateAITwinScore = function () {
    if (!this.challengeData.questions || !this.aiTwinResponse.predictedAnswers) {
        return 0;
    }

    let correct = 0;
    const total = this.challengeData.questions.length;

    this.challengeData.questions.forEach((q, idx) => {
        if (this.aiTwinResponse.predictedAnswers[idx] === q.correctAnswer) {
            correct++;
        }
    });

    this.aiTwinScore = Math.round((correct / total) * 100);
    return this.aiTwinScore;
};

export default mongoose.model("ChallengeAttempt", challengeAttemptSchema);
