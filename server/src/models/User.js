import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const PROVIDERS = ["local", "firebase", "google", "facebook", "twitter"];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: {
      type: String,
      // Password is optional — Firebase-synced users don't have MongoDB passwords
    },
    provider: {
      type: String,
      enum: PROVIDERS,
      default: "local",
    },
    providerId: { type: String },
    avatar: { type: String },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Method to compare passwords
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  return bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model("User", userSchema);
