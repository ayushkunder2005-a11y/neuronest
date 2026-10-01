import Reminder from "../models/Reminder.js";

const REMINDER_FIELDS = ["text", "category", "urgency", "remindAt"];

const normalizeOwner = (owner = {}) => {
  if (owner.userId) {
    return { userId: owner.userId };
  }
  if (owner.clientKey) {
    return { clientKey: owner.clientKey };
  }
  return null;
};

const buildOwnerFilter = (owner) => {
  const normalized = normalizeOwner(owner);
  if (!normalized) {
    throw new Error("Reminder owner context missing");
  }
  if (normalized.userId) {
    return { user: normalized.userId };
  }
  return { clientKey: normalized.clientKey };
};

const sanitizeReminderInput = (payload = {}) => {
  return REMINDER_FIELDS.reduce((acc, field) => {
    if (payload[field] !== undefined) {
      acc[field] = payload[field];
    }
    return acc;
  }, {});
};

const parseRemindAt = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

const serializeReminder = (reminder) => {
  if (!reminder) return null;
  return {
    id: reminder.id || reminder._id?.toString(),
    text: reminder.text,
    category: reminder.category,
    urgency: reminder.urgency,
    remindAt:
      reminder.remindAt instanceof Date
        ? reminder.remindAt.toISOString()
        : reminder.remindAt,
    isTriggered: reminder.isTriggered,
    clientKey: reminder.clientKey || null,
    user: reminder.user || null,
    createdAt:
      reminder.createdAt instanceof Date
        ? reminder.createdAt.toISOString()
        : reminder.createdAt,
    updatedAt:
      reminder.updatedAt instanceof Date
        ? reminder.updatedAt.toISOString()
        : reminder.updatedAt,
  };
};

export const listReminders = async (owner) => {
  const filter = buildOwnerFilter(owner);
  const reminders = await Reminder.find(filter).sort({ remindAt: 1 }).lean();
  return reminders.map(serializeReminder);
};

export const createReminder = async (owner, payload) => {
  const filter = buildOwnerFilter(owner);
  const data = sanitizeReminderInput(payload);
  const remindAt = parseRemindAt(data.remindAt);
  if (!remindAt) {
    throw new Error("remindAt datetime is required");
  }
  const reminder = await Reminder.create({
    ...filter,
    ...data,
    remindAt,
    isTriggered: false,
  });
  return serializeReminder(reminder.toObject());
};

export const updateReminder = async (owner, reminderId, payload) => {
  const filter = buildOwnerFilter(owner);
  const data = sanitizeReminderInput(payload);
  if (data.remindAt) {
    const remindAt = parseRemindAt(data.remindAt);
    if (!remindAt) {
      throw new Error("remindAt datetime is invalid");
    }
    data.remindAt = remindAt;
    data.isTriggered = false;
  }
  const reminder = await Reminder.findOneAndUpdate(
    { _id: reminderId, ...filter },
    { $set: data },
    { new: true }
  ).lean();
  return serializeReminder(reminder);
};

export const deleteReminder = async (owner, reminderId) => {
  const filter = buildOwnerFilter(owner);
  const result = await Reminder.deleteOne({ _id: reminderId, ...filter });
  return result.deletedCount === 1;
};

const DEFAULT_INTERVAL_MS = 60000;
let schedulerHandle = null;
let schedulerBusy = false;

const emitDueReminders = async (io) => {
  if (!io || schedulerBusy) {
    return;
  }
  schedulerBusy = true;
  try {
    const now = new Date();
    const dueReminders = await Reminder.find({
      isTriggered: false,
      remindAt: { $lte: now },
    }).lean();
    if (!dueReminders.length) {
      return;
    }
    const ids = dueReminders.map((reminder) => reminder._id);
    await Reminder.updateMany(
      { _id: { $in: ids } },
      { $set: { isTriggered: true } }
    );
    dueReminders.forEach((reminder) => {
      io.emit(
        "reminder-triggered",
        serializeReminder({ ...reminder, isTriggered: true })
      );
    });
  } catch (err) {
    console.error("[Reminders] Scheduler error:", err.message);
  } finally {
    schedulerBusy = false;
  }
};

export const startReminderScheduler = (io, interval = DEFAULT_INTERVAL_MS) => {
  if (!io || schedulerHandle) {
    return;
  }
  emitDueReminders(io).catch(() => {});
  schedulerHandle = setInterval(() => emitDueReminders(io), interval);
  console.log("[Reminders] Scheduler started");
};

export const stopReminderScheduler = () => {
  if (schedulerHandle) {
    clearInterval(schedulerHandle);
    schedulerHandle = null;
    console.log("[Reminders] Scheduler stopped");
  }
};

export const resolveOwnerKey = (req) => {
  const userId = req.user?._id?.toString() || req.body?.userId || req.query?.userId;
  const clientKey =
    req.header("x-client-key") ||
    req.query?.clientKey ||
    req.body?.clientKey ||
    null;
  return normalizeOwner({ userId, clientKey });
};

export { serializeReminder };
