import mongoose from "mongoose";

const difficultyLevels = ["beginner", "intermediate", "advanced"];

const trainingActivitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    duration: {
      type: Number,
      required: true,
      min: 1,
    },
    difficulty: {
      type: String,
      enum: difficultyLevels,
      default: "beginner",
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

export default mongoose.model("TrainingActivity", trainingActivitySchema);
export { difficultyLevels };
