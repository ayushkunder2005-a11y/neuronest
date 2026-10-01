import mongoose from "mongoose";

const reminderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    clientKey: {
      type: String,
      index: true,
      trim: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: "focus",
      trim: true,
    },
    urgency: {
      type: String,
      enum: ["low", "normal", "high"],
      default: "normal",
    },
    remindAt: {
      type: Date,
      required: true,
      index: true,
    },
    isTriggered: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

reminderSchema.index({ remindAt: 1, isTriggered: 1 });
reminderSchema.index({ user: 1, remindAt: 1 });
reminderSchema.index({ clientKey: 1, remindAt: 1 });

export default mongoose.model("Reminder", reminderSchema);
