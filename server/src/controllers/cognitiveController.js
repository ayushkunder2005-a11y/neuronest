import ChallengeAttempt from "../models/ChallengeAttempt.js";
import CognitiveProfile from "../models/CognitiveProfile.js";
import ThinkingInsight from "../models/ThinkingInsight.js";

/**
 * Cognitive Controller
 * Handles all cognitive shadow operations including profile management,
 * challenge creation, and insight generation.
 */

// @desc   Get or create user's cognitive profile
// @route  GET /api/cognitive/profile
// @access Private
export const getCognitiveProfile = async (req, res) => {
    try {
        const userId = req.user.uid;

        let profile = await CognitiveProfile.findOne({ user: userId });

        // Create new profile if doesn't exist
        if (!profile) {
            profile = await CognitiveProfile.create({
                user: userId,
            });
        }

        res.json({
            success: true,
            profile: profile.getProfileSummary(),
            fullProfile: profile,
        });
    } catch (error) {
        console.error("Error fetching cognitive profile:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch cognitive profile",
            error: error.message,
        });
    }
};

// @desc   Update cognitive profile from interaction data
// @route  POST /api/cognitive/profile/update
// @access Private
export const updateCognitiveProfile = async (req, res) => {
    try {
        const userId = req.user.uid;
        const { interactionData } = req.body;

        if (!interactionData) {
            return res.status(400).json({
                success: false,
                message: "Interaction data is required",
            });
        }

        let profile = await CognitiveProfile.findOne({ user: userId });

        if (!profile) {
            profile = await CognitiveProfile.create({ user: userId });
        }

        // Update profile with new interaction
        profile.updateFromInteraction({
            timestamp: new Date(),
            activityType: interactionData.activityType || "quiz",
            performance: interactionData.performance || 0,
            timeSpent: interactionData.timeSpent || 0,
            keyPatterns: interactionData.keyPatterns || [],
        });

        // Update thinking style metrics based on interaction
        if (interactionData.responseTime) {
            const avgTime = profile.thinkingStyle.averageResponseTime;
            const newAvg = (avgTime * (profile.totalInteractions - 1) + interactionData.responseTime) / profile.totalInteractions;
            profile.thinkingStyle.averageResponseTime = newAvg;

            // Categorize response speed
            if (newAvg < 5) profile.thinkingStyle.responseSpeed = "fast";
            else if (newAvg < 15) profile.thinkingStyle.responseSpeed = "medium";
            else profile.thinkingStyle.responseSpeed = "slow";
        }

        // Update decision pattern (impulsive vs deliberate)
        if (interactionData.accuracy !== undefined && interactionData.responseTime) {
            // Fast + accurate = confident, Fast + inaccurate = impulsive
            // Slow + accurate = deliberate, Slow + inaccurate = overthinking
            const isFast = interactionData.responseTime < 10;
            const isAccurate = interactionData.accuracy > 70;

            if (isFast && !isAccurate) {
                // More impulsive
                profile.thinkingStyle.decisionPattern = Math.max(0, profile.thinkingStyle.decisionPattern - 0.05);
            } else if (!isFast && isAccurate) {
                // More deliberate
                profile.thinkingStyle.decisionPattern = Math.min(1, profile.thinkingStyle.decisionPattern + 0.05);
            }
        }

        // Update cognitive metrics
        if (interactionData.focusScore) {
            const currentFocus = profile.cognitiveMetrics.focusScore;
            profile.cognitiveMetrics.focusScore = (currentFocus * 0.8 + interactionData.focusScore * 0.2);
        }

        await profile.save();

        res.json({
            success: true,
            message: "Cognitive profile updated",
            profile: profile.getProfileSummary(),
        });
    } catch (error) {
        console.error("Error updating cognitive profile:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update cognitive profile",
            error: error.message,
        });
    }
};

// @desc   Create a new challenge
// @route  POST /api/cognitive/challenge/create
// @access Private
export const createChallenge = async (req, res) => {
    try {
        const userId = req.user.uid;
        const { challengeType, difficulty, questions } = req.body;

        if (!challengeType || !questions || questions.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Challenge type and questions are required",
            });
        }

        // Get user's cognitive profile to predict AI Twin responses
        const profile = await CognitiveProfile.findOne({ user: userId });

        if (!profile || profile.totalInteractions < 3) {
            return res.status(400).json({
                success: false,
                message: "Insufficient data to create AI Twin. Complete at least 3 quizzes first.",
            });
        }

        // Create challenge
        const challenge = await ChallengeAttempt.create({
            user: userId,
            challengeType,
            difficulty: difficulty || "intermediate",
            challengeData: {
                title: `${challengeType} Challenge`,
                description: "Compete against your AI Twin!",
                questions,
                timeLimit: req.body.timeLimit || null,
            },
            // AI Twin predictions will be generated when user completes the challenge
            aiTwinResponse: {
                predictedAnswers: [],
                predictedTime: profile.thinkingStyle.averageResponseTime * questions.length,
                confidence: profile.confidenceScore,
                basedOnPatterns: [],
            },
        });

        res.json({
            success: true,
            challenge: {
                id: challenge._id,
                type: challenge.challengeType,
                difficulty: challenge.difficulty,
                questions: challenge.challengeData.questions.map(q => ({
                    question: q.question,
                    options: q.options,
                })),
                timeLimit: challenge.challengeData.timeLimit,
            },
        });
    } catch (error) {
        console.error("Error creating challenge:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create challenge",
            error: error.message,
        });
    }
};

// @desc   Complete a challenge and get comparison
// @route  POST /api/cognitive/challenge/:id/complete
// @access Private
export const completeChallenge = async (req, res) => {
    try {
        const userId = req.user.uid;
        const challengeId = req.params.id;
        const { answers, startTime, endTime, answerTimes } = req.body;

        if (!answers || !Array.isArray(answers)) {
            return res.status(400).json({
                success: false,
                message: "Answers are required",
            });
        }

        const challenge = await ChallengeAttempt.findOne({
            _id: challengeId,
            user: userId,
        });

        if (!challenge) {
            return res.status(404).json({
                success: false,
                message: "Challenge not found",
            });
        }

        if (challenge.completed) {
            return res.status(400).json({
                success: false,
                message: "Challenge already completed",
            });
        }

        // Get user's cognitive profile
        const profile = await CognitiveProfile.findOne({ user: userId });

        // Record user's response
        const totalTime = (new Date(endTime) - new Date(startTime)) / 1000;
        challenge.userResponse = {
            answers,
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            totalTime,
            answerTimes: answerTimes || [],
            approach: "", // Will be filled by AI analysis
        };

        // Generate AI Twin predicted responses based on profile
        const predictedAnswers = challenge.challengeData.questions.map((q, idx) => {
            // Simple prediction based on past patterns
            // In production, this would use more sophisticated ML

            // If user tends to be accurate, predict correct answer
            if (profile.cognitiveMetrics.accuracyTrend === "improving") {
                // Randomly choose between correct and a random option
                return Math.random() > 0.3 ? q.correctAnswer : Math.floor(Math.random() * q.options.length);
            }

            // If user is impulsive, predict first or last option more often
            if (profile.thinkingStyle.decisionPattern < 0.3) {
                return Math.random() > 0.5 ? 0 : q.options.length - 1;
            }

            // Default: random prediction
            return Math.floor(Math.random() * q.options.length);
        });

        challenge.aiTwinResponse.predictedAnswers = predictedAnswers;
        challenge.aiTwinResponse.basedOnPatterns = [
            `Response speed: ${profile.thinkingStyle.responseSpeed}`,
            `Decision pattern: ${profile.thinkingStyle.decisionPattern.toFixed(2)}`,
            `Accuracy trend: ${profile.cognitiveMetrics.accuracyTrend}`,
        ];

        // Calculate scores
        challenge.calculateUserScore();
        challenge.calculateAITwinScore();
        challenge.calculateOutcome();

        // Generate comparison data
        const userAccuracy = (challenge.userScore / 100);
        const aiTwinAccuracy = (challenge.aiTwinScore / 100);

        challenge.comparisonData = {
            accuracyComparison: {
                userAccuracy: challenge.userScore,
                aiTwinAccuracy: challenge.aiTwinScore,
                improvement: challenge.userScore - challenge.aiTwinScore,
            },
            timeComparison: {
                userTime: totalTime,
                aiTwinTime: challenge.aiTwinResponse.predictedTime,
                speedChange: totalTime < challenge.aiTwinResponse.predictedTime ? "faster" : "slower",
            },
            approachDifference: {
                description: challenge.userScore > challenge.aiTwinScore
                    ? "You've grown! Your current approach is more effective than your past patterns."
                    : "Your AI Twin (past you) performed similarly. This shows consistency in your thinking style.",
                keyChanges: [],
            },
            questionsWhereDifferent: challenge.challengeData.questions.map((q, idx) => ({
                questionIndex: idx,
                userAnswer: answers[idx],
                aiTwinAnswer: predictedAnswers[idx],
                userCorrect: answers[idx] === q.correctAnswer,
                aiTwinCorrect: predictedAnswers[idx] === q.correctAnswer,
                insight: answers[idx] !== predictedAnswers[idx]
                    ? (answers[idx] === q.correctAnswer
                        ? "You made a better choice than past you!"
                        : "Your AI Twin would have chosen differently")
                    : "Both made the same choice",
            })).filter(item => item.userAnswer !== item.aiTwinAnswer),
        };

        // Generate insights
        const insights = [];

        if (challenge.outcome === "user_won") {
            insights.push({
                type: "improvement",
                title: "You beat your AI Twin!",
                description: `You scored ${challenge.userScore}% vs your AI Twin's ${challenge.aiTwinScore}%. This shows clear growth in your thinking patterns.`,
                confidence: 0.9,
            });
        } else if (challenge.outcome === "tie") {
            insights.push({
                type: "consistency",
                title: "Consistent Performance",
                description: "You and your AI Twin performed similarly, showing stable thinking patterns.",
                confidence: 0.85,
            });
        }

        if (totalTime < challenge.aiTwinResponse.predictedTime * 0.8) {
            insights.push({
                type: "improvement",
                title: "Faster Decision Making",
                description: `You completed this ${Math.round((1 - totalTime / challenge.aiTwinResponse.predictedTime) * 100)}% faster than your typical pace.`,
                confidence: 0.88,
            });
        }

        challenge.insightsGenerated = insights;
        challenge.completed = true;

        await challenge.save();

        // Create thinking insights
        for (const insight of insights) {
            await ThinkingInsight.create({
                user: userId,
                insightType: insight.type,
                title: insight.title,
                description: insight.description,
                confidence: insight.confidence,
                relatedActivity: {
                    activityType: "challenge",
                    activityId: challenge._id,
                },
                dataPoints: [
                    {
                        metric: "score",
                        value: { user: challenge.userScore, aiTwin: challenge.aiTwinScore },
                        timestamp: new Date(),
                    },
                ],
            });
        }

        res.json({
            success: true,
            challenge: {
                id: challenge._id,
                outcome: challenge.outcome,
                userScore: challenge.userScore,
                aiTwinScore: challenge.aiTwinScore,
                comparisonData: challenge.comparisonData,
                insights: challenge.insightsGenerated,
            },
        });
    } catch (error) {
        console.error("Error completing challenge:", error);
        res.status(500).json({
            success: false,
            message: "Failed to complete challenge",
            error: error.message,
        });
    }
};

// @desc   Get user's challenge history
// @route  GET /api/cognitive/challenges
// @access Private
export const getChallenges = async (req, res) => {
    try {
        const userId = req.user.uid;
        const limit = parseInt(req.query.limit) || 10;

        const challenges = await ChallengeAttempt.find({
            user: userId,
            completed: true,
        })
            .sort({ createdAt: -1 })
            .limit(limit)
            .select("challengeType difficulty userScore aiTwinScore outcome createdAt");

        res.json({
            success: true,
            challenges,
        });
    } catch (error) {
        console.error("Error fetching challenges:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch challenges",
            error: error.message,
        });
    }
};

// @desc   Get thinking insights
// @route  GET /api/cognitive/insights
// @access Private
export const getInsights = async (req, res) => {
    try {
        const userId = req.user.uid;
        const limit = parseInt(req.query.limit) || 20;
        const unreadOnly = req.query.unreadOnly === "true";

        const filter = { user: userId };
        if (unreadOnly) {
            filter.isRead = false;
        }

        const insights = await ThinkingInsight.find(filter)
            .sort({ priority: -1, createdAt: -1 })
            .limit(limit);

        const unreadCount = await ThinkingInsight.getUnreadCount(userId);

        res.json({
            success: true,
            insights,
            unreadCount,
        });
    } catch (error) {
        console.error("Error fetching insights:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch insights",
            error: error.message,
        });
    }
};

// @desc   Get performance comparison (Past vs Present)
// @route  GET /api/cognitive/compare
// @access Private
export const getPerformanceComparison = async (req, res) => {
    try {
        const userId = req.user.uid;
        const timeRange = req.query.timeRange || "all"; // "week", "month", "all"

        const profile = await CognitiveProfile.findOne({ user: userId });

        if (!profile) {
            return res.status(404).json({
                success: false,
                message: "Cognitive profile not found",
            });
        }

        // Get challenges for comparison
        let dateFilter = {};
        if (timeRange === "week") {
            dateFilter = { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } };
        } else if (timeRange === "month") {
            dateFilter = { createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } };
        }

        const challenges = await ChallengeAttempt.find({
            user: userId,
            completed: true,
            ...dateFilter,
        }).sort({ createdAt: 1 });

        // Calculate statistics
        const stats = {
            totalChallenges: challenges.length,
            wins: challenges.filter(c => c.outcome === "user_won").length,
            losses: challenges.filter(c => c.outcome === "ai_twin_won").length,
            ties: challenges.filter(c => c.outcome === "tie").length,
            averageScore: challenges.length > 0
                ? challenges.reduce((sum, c) => sum + c.userScore, 0) / challenges.length
                : 0,
            averageImprovement: challenges.length > 0
                ? challenges.reduce((sum, c) => sum + (c.userScore - c.aiTwinScore), 0) / challenges.length
                : 0,
            performanceOverTime: challenges.map(c => ({
                date: c.createdAt,
                userScore: c.userScore,
                aiTwinScore: c.aiTwinScore,
                difference: c.userScore - c.aiTwinScore,
            })),
        };

        res.json({
            success: true,
            comparison: {
                profile: profile.getProfileSummary(),
                stats,
                cognitiveGrowth: {
                    focus: profile.cognitiveMetrics.focusScore,
                    adaptability: profile.cognitiveMetrics.adaptabilityScore,
                    persistence: profile.cognitiveMetrics.persistenceScore,
                },
            },
        });
    } catch (error) {
        console.error("Error fetching performance comparison:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch performance comparison",
            error: error.message,
        });
    }
};
