import express from "express";
import UserTask from "../models/UserTask.js";

const router = express.Router();

// Helper to get owner key from request
const resolveOwnerKey = (req) => {
    if (req.user?._id) {
        return { user: req.user._id };
    }
    const clientKey = req.headers["x-client-key"];
    if (clientKey) {
        return { clientKey };
    }
    return null;
};

// GET /api/tasks - Get all tasks for user
router.get("/", async (req, res) => {
    try {
        const owner = resolveOwnerKey(req);
        if (!owner) {
            return res.status(400).json({ message: "Missing user context. Provide x-client-key header." });
        }

        // For client key users, we need to match by a clientKey field
        const query = owner.user ? { user: owner.user } : { clientKey: owner.clientKey };
        const tasks = await UserTask.find(query).sort({ createdAt: -1 });

        res.json(tasks.map((t) => ({
            id: t._id.toString(),
            title: t.name,
            description: t.description,
            category: t.category || "focus",
            priority: t.priority || "medium",
            status: t.status,
            duration: t.duration || 30,
            deadline: t.deadline || "Tomorrow",
            steps: t.steps || [],
            createdAt: t.createdAt,
        })));
    } catch (err) {
        console.error("[Tasks] GET error:", err);
        res.status(500).json({ message: err.message });
    }
});

// POST /api/tasks - Create a new task
router.post("/", async (req, res) => {
    try {
        const owner = resolveOwnerKey(req);
        if (!owner) {
            return res.status(400).json({ message: "Missing user context. Provide x-client-key header." });
        }

        const { title, description, category, priority, duration, deadline, steps } = req.body;

        const task = new UserTask({
            ...owner,
            name: title,
            description: description || "",
            category: category || "focus",
            priority: priority || "medium",
            duration: duration || 30,
            deadline: deadline || "Tomorrow",
            steps: steps || [],
            status: "pending",
        });

        await task.save();

        res.status(201).json({
            id: task._id.toString(),
            title: task.name,
            description: task.description,
            category: task.category,
            priority: task.priority,
            status: task.status,
            duration: task.duration,
            deadline: task.deadline,
            steps: task.steps,
            createdAt: task.createdAt,
        });
    } catch (err) {
        console.error("[Tasks] POST error:", err);
        res.status(400).json({ message: err.message });
    }
});

// PATCH /api/tasks/:id - Update a task
router.patch("/:id", async (req, res) => {
    try {
        const owner = resolveOwnerKey(req);
        if (!owner) {
            return res.status(400).json({ message: "Missing user context. Provide x-client-key header." });
        }

        const query = owner.user
            ? { _id: req.params.id, user: owner.user }
            : { _id: req.params.id, clientKey: owner.clientKey };

        const updates = {};
        if (req.body.title !== undefined) updates.name = req.body.title;
        if (req.body.description !== undefined) updates.description = req.body.description;
        if (req.body.category !== undefined) updates.category = req.body.category;
        if (req.body.priority !== undefined) updates.priority = req.body.priority;
        if (req.body.status !== undefined) updates.status = req.body.status;
        if (req.body.duration !== undefined) updates.duration = req.body.duration;
        if (req.body.deadline !== undefined) updates.deadline = req.body.deadline;
        if (req.body.steps !== undefined) updates.steps = req.body.steps;

        const task = await UserTask.findOneAndUpdate(query, { $set: updates }, { new: true });

        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        res.json({
            id: task._id.toString(),
            title: task.name,
            description: task.description,
            category: task.category,
            priority: task.priority,
            status: task.status,
            duration: task.duration,
            deadline: task.deadline,
            steps: task.steps,
        });
    } catch (err) {
        console.error("[Tasks] PATCH error:", err);
        res.status(400).json({ message: err.message });
    }
});

// DELETE /api/tasks/:id - Delete a task
router.delete("/:id", async (req, res) => {
    try {
        const owner = resolveOwnerKey(req);
        if (!owner) {
            return res.status(400).json({ message: "Missing user context. Provide x-client-key header." });
        }

        const query = owner.user
            ? { _id: req.params.id, user: owner.user }
            : { _id: req.params.id, clientKey: owner.clientKey };

        const result = await UserTask.findOneAndDelete(query);

        if (!result) {
            return res.status(404).json({ message: "Task not found" });
        }

        res.status(204).send();
    } catch (err) {
        console.error("[Tasks] DELETE error:", err);
        res.status(400).json({ message: err.message });
    }
});

// POST /api/tasks/sync - Bulk sync tasks from client
router.post("/sync", async (req, res) => {
    try {
        const owner = resolveOwnerKey(req);
        if (!owner) {
            return res.status(400).json({ message: "Missing user context. Provide x-client-key header." });
        }

        const { tasks } = req.body;
        if (!Array.isArray(tasks)) {
            return res.status(400).json({ message: "tasks must be an array" });
        }

        const query = owner.user ? { user: owner.user } : { clientKey: owner.clientKey };

        // Get existing tasks
        const existingTasks = await UserTask.find(query);
        const existingIds = new Set(existingTasks.map((t) => t._id.toString()));

        const results = [];
        for (const task of tasks) {
            // Check if task exists by matching old id pattern or MongoDB id
            const existingTask = existingTasks.find(
                (t) => t._id.toString() === task.id || t.clientId === task.id
            );

            if (existingTask) {
                // Update existing
                existingTask.name = task.title;
                existingTask.description = task.description || "";
                existingTask.category = task.category || "focus";
                existingTask.priority = task.priority || "medium";
                existingTask.status = task.status || "pending";
                existingTask.duration = task.duration || 30;
                existingTask.deadline = task.deadline || "Tomorrow";
                existingTask.steps = task.steps || [];
                await existingTask.save();
                results.push({ oldId: task.id, newId: existingTask._id.toString(), action: "updated" });
            } else {
                // Create new
                const newTask = new UserTask({
                    ...owner,
                    clientId: task.id, // Store original client ID for matching
                    name: task.title,
                    description: task.description || "",
                    category: task.category || "focus",
                    priority: task.priority || "medium",
                    status: task.status || "pending",
                    duration: task.duration || 30,
                    deadline: task.deadline || "Tomorrow",
                    steps: task.steps || [],
                });
                await newTask.save();
                results.push({ oldId: task.id, newId: newTask._id.toString(), action: "created" });
            }
        }

        res.json({ success: true, synced: results.length, results });
    } catch (err) {
        console.error("[Tasks] Sync error:", err);
        res.status(500).json({ message: err.message });
    }
});

export default router;
