import TrainingActivity from "../models/TrainingActivity.js";
import UserTask from "../models/UserTask.js";

const TASK_FIELDS = ["name", "description", "status"];
const TRAINING_FIELDS = ["title", "duration", "difficulty", "progress", "notes"];

const sanitizePayload = (payload, allowedFields) => {
  if (!payload || typeof payload !== "object") {
    return {};
  }
  return allowedFields.reduce((acc, field) => {
    if (payload[field] !== undefined) {
      acc[field] = payload[field];
    }
    return acc;
  }, {});
};

const requireUserId = (userId) => {
  if (!userId) {
    throw new Error("userId is required");
  }
  return userId;
};

// ---- Task helpers ----
export const createUserTask = async (userId, payload) => {
  const data = sanitizePayload(payload, TASK_FIELDS);
  return UserTask.create({ user: requireUserId(userId), ...data });
};

export const updateUserTask = async (userId, taskId, payload) => {
  const data = sanitizePayload(payload, TASK_FIELDS);
  return UserTask.findOneAndUpdate(
    { _id: taskId, user: requireUserId(userId) },
    { $set: data },
    { new: true }
  );
};

export const deleteUserTask = async (userId, taskId) => {
  const result = await UserTask.deleteOne({
    _id: taskId,
    user: requireUserId(userId),
  });
  return result.deletedCount === 1;
};

export const getUserTasks = (userId) => {
  return UserTask.find({ user: requireUserId(userId) }).sort({
    createdAt: -1,
  });
};

// ---- Training activity helpers ----
export const createTrainingActivity = async (userId, payload) => {
  const data = sanitizePayload(payload, TRAINING_FIELDS);
  return TrainingActivity.create({ user: requireUserId(userId), ...data });
};

export const updateTrainingActivity = async (userId, activityId, payload) => {
  const data = sanitizePayload(payload, TRAINING_FIELDS);
  return TrainingActivity.findOneAndUpdate(
    { _id: activityId, user: requireUserId(userId) },
    { $set: data },
    { new: true }
  );
};

export const deleteTrainingActivity = async (userId, activityId) => {
  const result = await TrainingActivity.deleteOne({
    _id: activityId,
    user: requireUserId(userId),
  });
  return result.deletedCount === 1;
};

export const getTrainingActivities = (userId) => {
  return TrainingActivity.find({ user: requireUserId(userId) }).sort({
    createdAt: -1,
  });
};
