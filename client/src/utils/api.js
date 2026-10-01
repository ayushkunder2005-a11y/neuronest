// API utility for making requests to the server
// Uses x-client-key header for user identification



const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const CLIENT_KEY_STORAGE = "neuronest_client_key";

// Generate or retrieve a unique client key
export const getClientKey = () => {
    let clientKey = localStorage.getItem(CLIENT_KEY_STORAGE);
    if (!clientKey) {
        // Generate a unique key using timestamp and random string
        clientKey = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem(CLIENT_KEY_STORAGE, clientKey);
    }
    return clientKey;
};

// Common headers for all API requests
const getHeaders = () => ({
    "Content-Type": "application/json",
    "x-client-key": getClientKey(),
});

// GET request
export const apiGet = async (endpoint) => {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "GET",
            headers: getHeaders(),
        });
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`[API] GET ${endpoint} failed:`, error);
        throw error;
    }
};

// POST request
export const apiPost = async (endpoint, data) => {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`[API] POST ${endpoint} failed:`, error);
        throw error;
    }
};

// PATCH request
export const apiPatch = async (endpoint, data) => {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "PATCH",
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`[API] PATCH ${endpoint} failed:`, error);
        throw error;
    }
};

// DELETE request
export const apiDelete = async (endpoint) => {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "DELETE",
            headers: getHeaders(),
        });
        if (!response.ok && response.status !== 204) {
            throw new Error(`API error: ${response.status}`);
        }
        return true;
    } catch (error) {
        console.error(`[API] DELETE ${endpoint} failed:`, error);
        throw error;
    }
};

// ============================================
// PROGRESS API
// ============================================

export const progressApi = {
    // Get user's progress from server
    async getProgress() {
        return apiGet("/api/progress");
    },

    // Sync all progress to server
    async syncProgress(data) {
        return apiPost("/api/progress/sync", data);
    },

    // Record exercise completion
    async recordExercise(xpEarned, exerciseId, exerciseName) {
        return apiPost("/api/progress/exercise", { xpEarned, exerciseId, exerciseName });
    },

    // Record task action (creation or completion)
    async recordTask(taskId, category, isCreation = false) {
        return apiPost("/api/progress/task", { taskId, category, isCreation });
    },
};

// ============================================
// TASKS API
// ============================================

export const tasksApi = {
    // Get all tasks
    async getTasks() {
        return apiGet("/api/tasks");
    },

    // Create a new task
    async createTask(task) {
        return apiPost("/api/tasks", task);
    },

    // Update a task
    async updateTask(id, updates) {
        return apiPatch(`/api/tasks/${id}`, updates);
    },

    // Delete a task
    async deleteTask(id) {
        return apiDelete(`/api/tasks/${id}`);
    },

    // Sync all tasks to server
    async syncTasks(tasks) {
        return apiPost("/api/tasks/sync", { tasks });
    },
};

// ============================================
// REMINDERS API
// ============================================

export const remindersApi = {
    // Get all reminders
    async getReminders() {
        return apiGet("/api/reminders");
    },

    // Create a reminder
    async createReminder(reminder) {
        return apiPost("/api/reminders", {
            text: reminder.title,
            category: reminder.category || "focus",
            urgency: reminder.urgency || "normal",
            remindAt: reminder.time,
        });
    },

    // Update a reminder
    async updateReminder(id, updates) {
        return apiPatch(`/api/reminders/${id}`, updates);
    },

    // Delete a reminder
    async deleteReminder(id) {
        return apiDelete(`/api/reminders/${id}`);
    },
};
