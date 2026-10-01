import express from "express";
import {
    addAvatarXP,
    checkBadgeUnlocks,
    createTimeCapsule,
    getAvatarProgress,
    getCapsuleEntry,
    getRewardsDashboard,
    getTimeCapsule,
    getUserBadges,
    replayCapsule,
    seedBadges,
    updateAvatarSkills,
} from "../controllers/rewardsController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Avatar routes
router.get("/avatar", getAvatarProgress);
router.post("/avatar/add-xp", addAvatarXP);
router.post("/avatar/update-skills", updateAvatarSkills);

// Badge routes
router.get("/badges", getUserBadges);
router.post("/check-unlocks", checkBadgeUnlocks);
router.post("/seed-badges", seedBadges); // Development only

// Time Capsule routes
router.get("/time-capsule", getTimeCapsule);
router.get("/time-capsule/:id", getCapsuleEntry);
router.post("/time-capsule/:id/replay", replayCapsule);
router.post("/time-capsule/create", createTimeCapsule);

// Dashboard
router.get("/dashboard", getRewardsDashboard);

export default router;
