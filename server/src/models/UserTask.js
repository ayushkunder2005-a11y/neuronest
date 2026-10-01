import mongoose from "mongoose";

const taskStatus = ["pending", "in-progress", "completed", "archived"];
const taskPriority = ["low", "medium", "high"];
const taskCategory = ["deep", "focus", "light", "repetition"];

const userTaskSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      sparse: true,
      index: true,
    },
    clientKey: {
      type: String,
      index: true,
      trim: true,
    },
    clientId: {
      type: String,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    category: {
      type: String,
      enum: taskCategory,
      default: "focus",
    },
    priority: {
      type: String,
      enum: taskPriority,
      default: "medium",
    },
    status: {
      type: String,
      enum: taskStatus,
      default: "pending",
    },
    duration: {
      type: Number,
      default: 30,
      min: 1,
    },
    deadline: {
      type: String,
      default: "Tomorrow",
    },
    steps: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

// Compound index for efficient queries
userTaskSchema.index({ user: 1, clientKey: 1 });
userTaskSchema.index({ clientKey: 1, createdAt: -1 });

export default mongoose.model("UserTask", userTaskSchema);
export { taskCategory, taskPriority, taskStatus };

