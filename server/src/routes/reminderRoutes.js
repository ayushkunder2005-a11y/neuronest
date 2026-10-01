import express from "express";
import {
  createReminder,
  deleteReminder,
  listReminders,
  resolveOwnerKey,
  updateReminder,
} from "../services/reminderService.js";

const router = express.Router();

const ensureOwner = (req, res) => {
  const owner = resolveOwnerKey(req);
  if (!owner) {
    res.status(400).json({
      message:
        "Missing user context. Provide an authenticated user or x-client-key header.",
    });
    return null;
  }
  return owner;
};

router.get("/", async (req, res) => {
  try {
    const owner = ensureOwner(req, res);
    if (!owner) return;
    const reminders = await listReminders(owner);
    res.json(reminders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const owner = ensureOwner(req, res);
    if (!owner) return;
    const reminder = await createReminder(owner, req.body || {});
    res.status(201).json(reminder);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.patch("/:reminderId", async (req, res) => {
  try {
    const owner = ensureOwner(req, res);
    if (!owner) return;
    const reminder = await updateReminder(owner, req.params.reminderId, req.body || {});
    if (!reminder) {
      return res.status(404).json({ message: "Reminder not found" });
    }
    res.json(reminder);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/:reminderId", async (req, res) => {
  try {
    const owner = ensureOwner(req, res);
    if (!owner) return;
    const removed = await deleteReminder(owner, req.params.reminderId);
    if (!removed) {
      return res.status(404).json({ message: "Reminder not found" });
    }
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
