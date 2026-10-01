import express from "express";
import { logEmotion, getEmotionLogs, getEmotionSummary } from "../controllers/emotionController.js";

const router = express.Router();

// POST /api/emotion/log   — save a reading
router.post("/log", logEmotion);

// GET  /api/emotion/logs  — fetch recent logs
router.get("/logs", getEmotionLogs);

// GET  /api/emotion/summary — aggregated stats for analytics
router.get("/summary", getEmotionSummary);

export default router;
