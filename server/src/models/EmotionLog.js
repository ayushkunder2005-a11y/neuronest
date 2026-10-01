import mongoose from "mongoose";

const emotionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  emotion: { type: String, required: true },
  confidence: { type: Number, default: 0 },
  distracted: { type: Boolean, default: false },
  headPose: { type: String, default: "unknown" },
  sessionId: { type: String, default: null },   // optional — group a monitoring session
  timestamp: { type: Date, default: Date.now },
});

emotionSchema.index({ user: 1, timestamp: -1 });
emotionSchema.index({ timestamp: -1 });

const EmotionLog = mongoose.model("EmotionLog", emotionSchema);
export default EmotionLog;
