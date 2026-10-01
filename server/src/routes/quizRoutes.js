import express from "express";
import { evaluateQuiz } from "../controllers/quizController.js";
import { protect } from "../middleware/authMiddleware.js"; // Assuming auth middleware exists

const router = express.Router();

router.post("/evaluate", protect, evaluateQuiz);

export default router;
