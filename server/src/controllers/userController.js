import asyncHandler from "express-async-handler";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { buildAuthResponse, serializeUser } from "../utils/userResponse.js";
import generateToken from "../utils/generateToken.js";
import sendEmail from "../utils/sendEmail.js";

// Register user (local email/password)
export const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const exists = await User.findOne({ email });
  if (exists) return res.status(400).json({ message: "User exists" });
  const user = await User.create({ name, email, password, provider: "local" });
  if (user) {
    res.status(201).json(buildAuthResponse(user));
  } else res.status(400).json({ message: "Invalid user data" });
});

// Login (local email/password)
export const authUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }
  if (!user.password) {
    return res.status(400).json({
      message: `This account is linked to ${user.provider || "a social"} login. Please sign in with ${user.provider || "your provider"}.`,
    });
  }
  if (await user.matchPassword(password)) {
    res.json(buildAuthResponse(user));
  } else {
    res.status(401).json({ message: "Invalid credentials" });
  }
});

// Sync Firebase user to MongoDB (called after every Firebase login/signup)
// Creates or updates user in MongoDB, returns JWT + user data
export const syncFirebaseUser = asyncHandler(async (req, res) => {
  const { firebaseUid, email, displayName, photoURL, provider } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  let user = await User.findOne({ email });

  if (user) {
    // Update existing user with latest info ONLY if they don't already have it
    // This prevents overwriting custom profiles saved via Settings.jsx
    if (displayName && !user.name) user.name = displayName;
    if (photoURL && !user.avatar) user.avatar = photoURL;
    if (firebaseUid && !user.providerId) user.providerId = firebaseUid;
    await user.save();
  } else {
    // Create new user in MongoDB
    user = await User.create({
      name: displayName || email.split("@")[0],
      email,
      provider: provider || "local",
      providerId: firebaseUid || "",
      avatar: photoURL || "",
    });
  }

  res.json({
    token: generateToken(user._id),
    user: serializeUser(user),
  });
});

// Get current user profile (JWT protected)
export const getMe = asyncHandler(async (req, res) => {
  if (!req.user) {
    return res.status(404).json({ message: "User not found" });
  }
  res.json({ user: serializeUser(req.user) });
});

// Update user profile (PUT /api/users/profile)
export const updateUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    user.name = req.body.name || user.name;
    if (req.body.avatar !== undefined) {
      user.avatar = req.body.avatar;
    }
    
    // Only local accounts should update passwords this way
    if (req.body.password && user.provider === "local") {
      user.password = req.body.password;
    }

    const updatedUser = await user.save();
    res.json({ user: serializeUser(updatedUser) });
  } else {
    res.status(404);
    throw new Error("User not found");
  }
});

// Forgot password — sends an email with the reset link
export const forgotPasswordUser = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.json({ message: "If an account exists, a reset link has been generated." });
  }

  const resetToken = generateToken(user._id);
  const resetUrl = `http://localhost:3000/reset-password?token=${resetToken}`;

  const message = `You are receiving this email because you (or someone else) requested a password reset for your Neuronest account.\n\nPlease click on the following link, or paste this into your browser to complete the process:\n\n${resetUrl}\n\nIf you did not request this, please ignore this email and your password will remain unchanged.`;

  try {
    await sendEmail({
      email: user.email,
      subject: "Neuronest - Password Reset Request",
      message,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2>Password Reset Request</h2>
          <p>You are receiving this email because you (or someone else) requested a password reset for your Neuronest account.</p>
          <p>Please click on the button below to complete the process:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
          </div>
          <p>Or paste this link into your browser:</p>
          <p style="word-break: break-all; color: #64748b;">${resetUrl}</p>
          <p style="margin-top: 40px; font-size: 12px; color: #94a3b8;">If you did not request this, please ignore this email and your password will remain unchanged.</p>
        </div>
      `,
    });
    res.json({ message: "If an account exists, a reset link has been generated." });
  } catch (err) {
    console.error("Email could not be sent", err);
    return res.status(500).json({ message: "Email could not be sent" });
  }
});

// Reset password — validates token and updates password
export const resetPasswordUser = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ message: "Token and new password are required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: "Password has been successfully reset" });
  } catch (err) {
    console.error("Token verification failed:", err);
    return res.status(400).json({ message: "Invalid or expired token" });
  }
});
