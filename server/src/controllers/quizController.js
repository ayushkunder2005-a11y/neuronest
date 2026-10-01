import User from "../models/User.js";
import { awardOnChainPoints } from "../services/hederaService.js";

export const evaluateQuiz = async (req, res) => {
    try {
        const { questions, answers } = req.body;
        // Assuming backend passes userId in req.user (from passport auth middleware)
        const userId = req.user?._id;

        if (!questions || !answers) {
            return res.status(400).json({ error: "Missing questions or answers" });
        }

        let correctCount = 0;
        const results = [];

        // Evaluate
        questions.forEach((q, i) => {
            const userAns = answers[i];
            const correctAns = q.correct; // 0-indexed integer
            const isCorrect = userAns === correctAns;

            if (isCorrect) correctCount++;

            results.push({
                questionIndex: i,
                isCorrect,
                userAnswer: userAns,
                correctAnswer: correctAns,
                explanation: q.explanation
            });
        });

        const totalQuestions = questions.length;
        const score = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
        const scorePercentage = Math.round(score * 10) / 10;

        // Feedback logic
        let feedback = "";
        if (score >= 90) feedback = "Excellent work! You've mastered this material.";
        else if (score >= 70) feedback = "Good job! You have a solid understanding.";
        else if (score >= 50) feedback = "Not bad! Review the missed questions to improve.";
        else feedback = "Keep studying! Review the material and try again.";

        // Hedera Reward Logic
        let tokensAwarded = 0;
        if (userId && score > 0) {
            // Fetch user to get Hedera Account ID
            const user = await User.findById(userId);
            if (user && user.hederaAccountId) {
                // Award 1 point per correct answer, or 10 points per quiz?
                // User prompt: "If answer is correct: Increase the user’s score... optionally: call Hedera"
                // Let's award 10 points per correct answer as per user example "score += 10"
                const pointsToAward = correctCount * 10;

                if (pointsToAward > 0) {
                    // Async call - don't block response too long, or await? 
                    // User snippet used 'await'.
                    await awardOnChainPoints(user.hederaAccountId, pointsToAward);
                    tokensAwarded = pointsToAward;
                }
            }
        }

        res.json({
            success: true,
            score,
            scorePercentage,
            correctCount,
            totalQuestions,
            feedback,
            results,
            tokensAwarded, // Return this so frontend can show it
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error("Quiz Evaluation Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};
