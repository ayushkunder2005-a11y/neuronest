import express from "express";
import passport from "passport";
import { socialAuthFailure, socialAuthSuccess } from "../controllers/socialAuthController.js";
import {
  authUser,
  forgotPasswordUser,
  resetPasswordUser,
  getMe,
  registerUser,
  syncFirebaseUser,
  updateUserProfile,
} from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

const providerLabels = {
  google: "Google",
  facebook: "Facebook",
  twitter: "Twitter",
};

const ensureStrategy = (provider) => (req, res, next) => {
  if (typeof passport._strategy === "function" && passport._strategy(provider)) {
    return next();
  }
  return socialAuthFailure(
    res,
    `${providerLabels[provider] || provider} login is not configured.`
  );
};

const socialCallback = (provider) => (req, res, next) =>
  passport.authenticate(provider, { session: false }, (err, user, info) => {
    if (err || !user) {
      return socialAuthFailure(
        res,
        err?.message || info?.message || `${providerLabels[provider] || provider} login failed.`
      );
    }
    req.user = user;
    return socialAuthSuccess(req, res);
  })(req, res, next);

// Local auth
router.post("/register", registerUser);
router.post("/login", authUser);

// Firebase sync — stores user in MongoDB after Firebase login/signup
router.post("/firebase-sync", syncFirebaseUser);

// Password reset
router.post("/forgot-password", forgotPasswordUser);
router.post("/reset-password", resetPasswordUser);

// Protected routes
router.get("/me", protect, getMe);
router.put("/profile", protect, updateUserProfile);

// OAuth (passport-based, kept for server-side OAuth if needed)
router.get(
  "/auth/google",
  ensureStrategy("google"),
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get("/auth/google/callback", ensureStrategy("google"), socialCallback("google"));

router.get(
  "/auth/facebook",
  ensureStrategy("facebook"),
  passport.authenticate("facebook", { scope: ["email"] })
);
router.get("/auth/facebook/callback", ensureStrategy("facebook"), socialCallback("facebook"));

router.get("/auth/twitter", ensureStrategy("twitter"), passport.authenticate("twitter"));
router.get("/auth/twitter/callback", ensureStrategy("twitter"), socialCallback("twitter"));

export default router;
