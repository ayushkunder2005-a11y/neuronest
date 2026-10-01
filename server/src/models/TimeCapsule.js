import mongoose from "mongoose";

const timeCapsuleSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        timestamp: {
            type: Date,
            required: true,
            default: Date.now,
            index: true,
        },
        challengeType: {
            type: String,
            required: true,
            enum: ["quiz", "cognitive_challenge", "exercise"],
            default: "quiz",
        },
        topic: {
            type: String,
            default: "General",
        },
        difficulty: {
            type: String,
            enum: ["easy", "medium", "hard"],
            default: "medium",
        },
        questions: [
            {
                question: String,
                options: [String],
                correct: mongoose.Schema.Types.Mixed,
                explanation: String,
            },
        ],
        originalAnswers: [mongoose.Schema.Types.Mixed],
        originalScore: {
            type: Number,
            required: true,
            min: 0,
            max: 100,
        },
        originalTime: {
            type: Number,
            required: true, // Time in seconds
        },
        originalMetrics: {
            avgResponseTime: Number,
            consistency: Number,
            focusScore: Number,
        },
        replayAttempts: [
            {
                replayDate: { type: Date, default: Date.now },
                score: { type: Number, required: true },
                time: { type: Number, required: true },
                answers: [mongoose.Schema.Types.Mixed],
                improvement: Number, // % improvement from original
                timeImprovement: Number, // % faster/slower
            },
        ],
        tags: [String],
        notes: {
            type: String,
            default: "",
        },
    },
    { timestamps: true }
);

// Compound index for efficient queries
timeCapsuleSchema.index({ user: 1, timestamp: -1 });

// Record a replay attempt
timeCapsuleSchema.methods.replay = async function (newAnswers, newTime) {
    // Calculate score
    let correctCount = 0;
    for (let i = 0; i < this.questions.length; i++) {
        if (newAnswers[i] === this.questions[i].correct) {
            correctCount++;
        }
    }

    const newScore = Math.round((correctCount / this.questions.length) * 100);

    // Calculate improvements
    const scoreImprovement = newScore - this.originalScore;
    const timeImprovement = ((this.originalTime - newTime) / this.originalTime) * 100;

    // Add replay attempt
    this.replayAttempts.push({
        replayDate: new Date(),
        score: newScore,
        time: newTime,
        answers: newAnswers,
        improvement: scoreImprovement,
        timeImprovement: Math.round(timeImprovement),
    });

    await this.save();

    return {
        newScore,
        scoreImprovement,
        timeImprovement,
        originalScore: this.originalScore,
        originalTime: this.originalTime,
    };
};

// Get improvement stats
timeCapsuleSchema.methods.getImprovementStats = function () {
    if (this.replayAttempts.length === 0) {
        return {
            hasReplays: false,
            replayCount: 0,
        };
    }

    const replays = this.replayAttempts;
    const latestReplay = replays[replays.length - 1];

    const avgReplayScore = replays.reduce((sum, r) => sum + r.score, 0) / replays.length;
    const bestReplay = replays.reduce((best, r) => (r.score > best.score ? r : best), replays[0]);

    return {
        hasReplays: true,
        replayCount: replays.length,
        latestReplay: {
            score: latestReplay.score,
            improvement: latestReplay.improvement,
            date: latestReplay.replayDate,
        },
        bestReplay: {
            score: bestReplay.score,
            improvement: bestReplay.improvement,
            date: bestReplay.replayDate,
        },
        avgReplayScore: Math.round(avgReplayScore),
        avgImprovement: Math.round(avgReplayScore - this.originalScore),
    };
};

// Get summary for timeline display
timeCapsuleSchema.methods.getSummary = function () {
    const improvementStats = this.getImprovementStats();

    return {
        id: this._id,
        timestamp: this.timestamp,
        challengeType: this.challengeType,
        topic: this.topic,
        difficulty: this.difficulty,
        questionCount: this.questions.length,
        originalScore: this.originalScore,
        originalTime: this.originalTime,
        replayCount: this.replayAttempts.length,
        improvement: improvementStats.hasReplays ? improvementStats.avgImprovement : null,
        tags: this.tags,
    };
};

// Static method to create time capsule from quiz result
timeCapsuleSchema.statics.createFromQuiz = async function (userId, quizData) {
    const capsule = await this.create({
        user: userId,
        timestamp: new Date(),
        challengeType: "quiz",
        topic: quizData.topic || "General",
        difficulty: quizData.difficulty || "medium",
        questions: quizData.questions,
        originalAnswers: quizData.answers,
        originalScore: quizData.score,
        originalTime: quizData.time,
        originalMetrics: {
            avgResponseTime: quizData.avgResponseTime || null,
            consistency: quizData.consistency || null,
            focusScore: quizData.focusScore || null,
        },
        tags: quizData.tags || [],
    });

    return capsule;
};

// Get user's timeline (paginated)
timeCapsuleSchema.statics.getUserTimeline = async function (
    userId,
    options = { limit: 20, skip: 0, sortBy: "timestamp" }
) {
    const { limit, skip, sortBy } = options;

    const capsules = await this.find({ user: userId })
        .sort({ [sortBy]: -1 })
        .skip(skip)
        .limit(limit);

    const total = await this.countDocuments({ user: userId });

    return {
        capsules: capsules.map((c) => c.getSummary()),
        total,
        hasMore: total > skip + limit,
    };
};

// Get stats for time capsule feature
timeCapsuleSchema.statics.getUserStats = async function (userId) {
    const capsules = await this.find({ user: userId });

    if (capsules.length === 0) {
        return {
            totalCapsules: 0,
            totalReplays: 0,
            avgImprovement: 0,
        };
    }

    const totalReplays = capsules.reduce((sum, c) => sum + c.replayAttempts.length, 0);

    const capsulesWithReplays = capsules.filter((c) => c.replayAttempts.length > 0);
    const avgImprovement =
        capsulesWithReplays.length > 0
            ? capsulesWithReplays.reduce((sum, c) => {
                const stats = c.getImprovementStats();
                return sum + stats.avgImprovement;
            }, 0) / capsulesWithReplays.length
            : 0;

    return {
        totalCapsules: capsules.length,
        totalReplays,
        avgImprovement: Math.round(avgImprovement),
        oldestCapsule: capsules[capsules.length - 1]?.timestamp || null,
        newestCapsule: capsules[0]?.timestamp || null,
    };
};

const TimeCapsule = mongoose.model("TimeCapsule", timeCapsuleSchema);

export default TimeCapsule;
