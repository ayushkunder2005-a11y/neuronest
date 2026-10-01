import express from "express";
import {
    completeChallenge,
    createChallenge,
    getChallenges,
    getCognitiveProfile,
    getInsights,
    getPerformanceComparison,
    updateCognitiveProfile,
} from "../controllers/cognitiveController.js";

const router = express.Router();

// Middleware to support both Firebase auth and client-key fallback
const flexibleAuth = (req, res, next) => {
    // Try to get user from Firebase auth if token is present
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        // For now, just use client-key - Firebase verification could be added here
        // This allows the feature to work without Firebase setup
    }

    // Use client-key as user identifier (fallback for unauthenticated users)
    const clientKey = req.headers["x-client-key"];
    if (clientKey) {
        req.clientKey = clientKey;
        // Create a pseudo-user object for controller compatibility
        req.user = {
            uid: clientKey,
            clientKey: clientKey,
            isClientKey: true
        };
        return next();
    }

    // If no auth method available, return error
    return res.status(401).json({
        message: "Not authorized - please provide x-client-key header",
        error: "No authentication method available"
    });
};

// Use flexible auth for all routes
router.use(flexibleAuth);

// Profile routes
router.get("/profile", getCognitiveProfile);
router.post("/profile/update", updateCognitiveProfile);

// Challenge routes
router.post("/challenge/create", createChallenge);
router.post("/challenge/:id/complete", completeChallenge);
router.get("/challenges", getChallenges);

// Insights routes
router.get("/insights", getInsights);

// Comparison routes
router.get("/compare", getPerformanceComparison);

export default router;
