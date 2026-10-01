import { useEffect, useMemo, useState } from "react";
import { useReminders } from "../context/ReminderContext";
import "../styles/tasks.css";
import { tasksApi } from "../utils/api";
import { syncToServer, trackTaskCompletion, trackTaskCreation } from "../utils/gamification";

// Load settings from localStorage
const loadSettings = () => {
  try {
    const stored = localStorage.getItem("NeuroNest-settings");
    if (stored) return JSON.parse(stored);
  } catch { }
  return { training: { difficultyLevel: "adaptive", exerciseIntensity: "balanced" } };
};

const CATEGORIES = [
  { id: "all", label: "All Tasks", icon: "📋" },
  { id: "deep", label: "Deep Work", icon: "🧠", load: "high" },
  { id: "focus", label: "Focus Tasks", icon: "🎯", load: "medium" },
  { id: "light", label: "Light Tasks", icon: "✨", load: "low" },
  { id: "repetition", label: "Practice", icon: "🔄", load: "medium" },
];

const PRIORITY_OPTIONS = [
  { id: "all", label: "All Priorities" },
  { id: "high", label: "🔴 High" },
  { id: "medium", label: "🟡 Medium" },
  { id: "low", label: "🟢 Low" },
];

const STATUS_OPTIONS = [
  { id: "all", label: "All Status" },
  { id: "pending", label: "Pending" },
  { id: "in-progress", label: "In Progress" },
  { id: "completed", label: "Completed" },
];

const TASKS_STORAGE_KEY = "NeuroNest-tasks";

// Load tasks from localStorage
const loadTasks = () => {
  try {
    const stored = localStorage.getItem(TASKS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch { }
  // Return default tasks if nothing stored
  return [
    {
      id: "1",
      title: "Draft cognition report summary",
      category: "deep",
      priority: "high",
      status: "pending",
      duration: 45,
      deadline: "Today 5:30 PM",
      steps: ["Review key insights", "Write summary", "Add action items"],
    },
    {
      id: "2",
      title: "Clear email inbox",
      category: "light",
      priority: "medium",
      status: "pending",
      duration: 15,
      deadline: "Today 6:00 PM",
      steps: ["Flag urgent", "Reply to top 3", "Archive old threads"],
    },
  ];
};

export default function Tasks() {
  const [activeTab, setActiveTab] = useState("board");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tasks, setTasks] = useState(loadTasks);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", category: "focus", priority: "medium", duration: 30 });
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [newReminder, setNewReminder] = useState({ title: "", detail: "", time: "" });
  const { reminders, addReminder, deleteReminder, getPendingReminders } = useReminders();
  const settings = loadSettings();

  // Load tasks from server on mount, then save to localStorage as cache
  useEffect(() => {
    const loadFromServer = async () => {
      try {
        const serverTasks = await tasksApi.getTasks();
        if (serverTasks && serverTasks.length > 0) {
          setTasks(serverTasks);
          localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(serverTasks));
          console.log("[Tasks] Loaded from server:", serverTasks.length, "tasks");
        }
      } catch (error) {
        console.warn("[Tasks] Failed to load from server, using local cache:", error.message);
      }
    };
    loadFromServer();
  }, []);

  // Save tasks to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (categoryFilter !== "all" && task.category !== categoryFilter) return false;
      if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
      if (statusFilter !== "all" && task.status !== statusFilter) return false;
      return true;
    });
  }, [tasks, categoryFilter, priorityFilter, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const pending = tasks.filter((t) => t.status === "pending").length;
    const inProgress = tasks.filter((t) => t.status === "in-progress").length;
    const totalDuration = tasks.filter((t) => t.status !== "completed").reduce((sum, t) => sum + t.duration, 0);
    return { total, completed, pending, inProgress, totalDuration };
  }, [tasks]);

  const getCategoryInfo = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[0];

  const handleStatusChange = (taskId, newStatus) => {
    setTasks((prev) => {
      const updatedTasks = prev.map((task) => {
        if (task.id === taskId) {
          const updatedTask = { ...task, status: newStatus };
          // Track completion in analytics when task is completed
          if (newStatus === "completed" && task.status !== "completed") {
            trackTaskCompletion(updatedTask);
            syncToServer(); // Sync progress to server
          }
          // Sync status change to server
          tasksApi.updateTask(taskId, { status: newStatus }).catch((err) =>
            console.warn("[Tasks] Failed to sync status:", err.message)
          );
          return updatedTask;
        }
        return task;
      });
      return updatedTasks;
    });
  };

  const handleAddTask = async () => {
    if (!newTask.title.trim()) return;
    const task = {
      id: Date.now().toString(),
      ...newTask,
      status: "pending",
      deadline: "Tomorrow",
      steps: [],
      createdAt: new Date().toISOString(),
    };
    setTasks((prev) => [...prev, task]);
    // Track task creation in analytics
    trackTaskCreation(task.category);
    syncToServer(); // Sync progress to server

    // Create on server (in background)
    try {
      const serverTask = await tasksApi.createTask(task);
      // Update local task with server ID
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, id: serverTask.id } : t));
    } catch (error) {
      console.warn("[Tasks] Failed to create on server:", error.message);
    }

    setNewTask({ title: "", category: "focus", priority: "medium", duration: 30 });
    setShowAddTask(false);
  };

  const handleDeleteTask = (taskId) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    if (selectedTask?.id === taskId) setSelectedTask(null);
    // Delete from server
    tasksApi.deleteTask(taskId).catch((err) =>
      console.warn("[Tasks] Failed to delete from server:", err.message)
    );
  };

  const handleAddReminder = () => {
    if (!newReminder.title.trim() || !newReminder.time) return;
    addReminder(newReminder);
    setNewReminder({ title: "", detail: "", time: "" });
    setShowAddReminder(false);
  };

  const formatReminderTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const pendingReminders = getPendingReminders();

  const renderBoardView = () => (
    <div className="tasks-board">
      {["pending", "in-progress", "completed"].map((status) => {
        const statusTasks = filteredTasks.filter((t) => t.status === status);
        const statusLabel = status === "pending" ? "📋 To Do" : status === "in-progress" ? "⚡ In Progress" : "✅ Done";
        return (
          <div key={status} className="board-column">
            <div className="column-header">
              <h3>{statusLabel}</h3>
              <span className="task-count">{statusTasks.length}</span>
            </div>
            <div className="column-tasks">
              {statusTasks.map((task) => {
                const cat = getCategoryInfo(task.category);
                return (
                  <article
                    key={task.id}
                    className={`task-card priority-${task.priority}`}
                    onClick={() => setSelectedTask(task)}
                  >
                    <div className="task-header">
                      <span className="task-category">{cat.icon} {cat.label}</span>
                      <span className={`priority-badge ${task.priority}`}>{task.priority}</span>
                    </div>
                    <h4>{task.title}</h4>
                    <div className="task-meta">
                      <span>⏱️ {task.duration} min</span>
                      <span>📅 {task.deadline}</span>
                    </div>
                    <div className="task-actions">
                      {status !== "completed" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatusChange(task.id, status === "pending" ? "in-progress" : "completed");
                          }}
                        >
                          {status === "pending" ? "Start" : "Complete"}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
              {!statusTasks.length && <p className="empty-column">No tasks</p>}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderListView = () => (
    <div className="tasks-list">
      {filteredTasks.map((task) => {
        const cat = getCategoryInfo(task.category);
        return (
          <article
            key={task.id}
            className={`task-list-item priority-${task.priority}`}
            onClick={() => setSelectedTask(task)}
          >
            <div className="task-status-indicator" data-status={task.status} />
            <div className="task-content">
              <div className="task-title-row">
                <h4>{task.title}</h4>
                <span className={`priority-badge ${task.priority}`}>{task.priority}</span>
              </div>
              <div className="task-meta">
                <span>{cat.icon} {cat.label}</span>
                <span>⏱️ {task.duration} min</span>
                <span>📅 {task.deadline}</span>
                <span className={`status-badge ${task.status}`}>{task.status}</span>
              </div>
            </div>
            <div className="task-actions">
              {task.status !== "completed" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStatusChange(task.id, task.status === "pending" ? "in-progress" : "completed");
                  }}
                >
                  {task.status === "pending" ? "Start" : "Complete"}
                </button>
              )}
              <button
                className="delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteTask(task.id);
                }}
              >
                Delete
              </button>
            </div>
          </article>
        );
      })}
      {!filteredTasks.length && (
        <div className="empty-state">
          <p>No tasks match your filters</p>
          <button onClick={() => { setCategoryFilter("all"); setPriorityFilter("all"); setStatusFilter("all"); }}>
            Clear Filters
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="tasks-shell">
      {/* Header */}
      <header className="tasks-hero">
        <div>
          <p className="eyebrow">Tasks</p>
          <h1>Task Management</h1>
          <p>Organize, prioritize, and complete your cognitive tasks</p>
        </div>
        <button className="add-task-btn" onClick={() => setShowAddTask(true)}>
          + Add Task
        </button>
      </header>

      {/* Stats Cards */}
      <section className="stats-grid">
        <div className="stat-card">
          <span className="stat-icon">📊</span>
          <div>
            <p className="stat-value">{stats.total}</p>
            <p className="stat-label">Total Tasks</p>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">⏳</span>
          <div>
            <p className="stat-value">{stats.pending}</p>
            <p className="stat-label">Pending</p>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">⚡</span>
          <div>
            <p className="stat-value">{stats.inProgress}</p>
            <p className="stat-label">In Progress</p>
          </div>
        </div>
        <div className="stat-card accent">
          <span className="stat-icon">✅</span>
          <div>
            <p className="stat-value">{stats.completed}</p>
            <p className="stat-label">Completed</p>
          </div>
        </div>
      </section>

      {/* Reminders Section */}
      <section className="reminders-section">
        <div className="section-header-row">
          <h2>🔔 Reminders</h2>
          <button className="add-btn" onClick={() => setShowAddReminder(!showAddReminder)}>
            {showAddReminder ? "✕ Cancel" : "+ Add Reminder"}
          </button>
        </div>

        {showAddReminder && (
          <div className="add-reminder-form">
            <input
              type="text"
              placeholder="Reminder title"
              value={newReminder.title}
              onChange={(e) => setNewReminder((prev) => ({ ...prev, title: e.target.value }))}
            />
            <input
              type="text"
              placeholder="Details (optional)"
              value={newReminder.detail}
              onChange={(e) => setNewReminder((prev) => ({ ...prev, detail: e.target.value }))}
            />
            <input
              type="datetime-local"
              value={newReminder.time}
              onChange={(e) => setNewReminder((prev) => ({ ...prev, time: e.target.value }))}
            />
            <button className="save-btn" onClick={handleAddReminder}>Save Reminder</button>
          </div>
        )}

        <div className="reminders-list">
          {pendingReminders.length === 0 ? (
            <p className="empty-reminders">No reminders set. Add one to stay on track!</p>
          ) : (
            pendingReminders.map((reminder) => (
              <div key={reminder.id} className="reminder-item">
                <div className="reminder-info">
                  <h4>{reminder.title}</h4>
                  {reminder.detail && <p>{reminder.detail}</p>}
                  <span className="reminder-time">⏰ {formatReminderTime(reminder.time)}</span>
                </div>
                <button className="delete-btn" onClick={() => deleteReminder(reminder.id)}>🗑️</button>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Tab Navigation */}
      <nav className="tasks-tabs">
        <button
          className={`tab-btn ${activeTab === "board" ? "active" : ""}`}
          onClick={() => setActiveTab("board")}
        >
          📋 Board View
        </button>
        <button
          className={`tab-btn ${activeTab === "list" ? "active" : ""}`}
          onClick={() => setActiveTab("list")}
        >
          📝 List View
        </button>
      </nav>

      {/* Filters */}
      <div className="filters-row">
        <div className="filter-group">
          <label>Category</label>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            {CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Priority</label>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            {PRIORITY_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        </div>
        <button
          className="clear-filters-btn"
          onClick={() => { setCategoryFilter("all"); setPriorityFilter("all"); setStatusFilter("all"); }}
        >
          Clear Filters
        </button>
      </div>

      {/* Main Content */}
      <main className="tasks-content">
        {activeTab === "board" && renderBoardView()}
        {activeTab === "list" && renderListView()}
      </main>

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="modal-overlay" onClick={() => setSelectedTask(null)}>
          <div className="task-modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <div>
                <span className="task-category">{getCategoryInfo(selectedTask.category).icon} {getCategoryInfo(selectedTask.category).label}</span>
                <h2>{selectedTask.title}</h2>
              </div>
              <button className="close-btn" onClick={() => setSelectedTask(null)}>✕</button>
            </header>
            <div className="modal-body">
              <div className="detail-row">
                <span>Priority</span>
                <span className={`priority-badge ${selectedTask.priority}`}>{selectedTask.priority}</span>
              </div>
              <div className="detail-row">
                <span>Status</span>
                <select
                  value={selectedTask.status}
                  onChange={(e) => {
                    handleStatusChange(selectedTask.id, e.target.value);
                    setSelectedTask({ ...selectedTask, status: e.target.value });
                  }}
                >
                  <option value="pending">Pending</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div className="detail-row">
                <span>Duration</span>
                <span>{selectedTask.duration} minutes</span>
              </div>
              <div className="detail-row">
                <span>Deadline</span>
                <span>{selectedTask.deadline}</span>
              </div>
              {selectedTask.steps?.length > 0 && (
                <div className="steps-section">
                  <h4>Steps</h4>
                  <ul>
                    {selectedTask.steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <footer>
              <button className="danger-btn" onClick={() => handleDeleteTask(selectedTask.id)}>
                Delete Task
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {showAddTask && (
        <div className="modal-overlay" onClick={() => setShowAddTask(false)}>
          <div className="task-modal add-modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <h2>Add New Task</h2>
              <button className="close-btn" onClick={() => setShowAddTask(false)}>✕</button>
            </header>
            <div className="modal-body">
              <div className="form-group">
                <label>Task Title</label>
                <input
                  type="text"
                  placeholder="What needs to be done?"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={newTask.category}
                    onChange={(e) => setNewTask({ ...newTask, category: e.target.value })}
                  >
                    {CATEGORIES.filter((c) => c.id !== "all").map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Priority</label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                  >
                    <option value="high">🔴 High</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="low">🟢 Low</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Duration (minutes)</label>
                <input
                  type="number"
                  min="5"
                  max="120"
                  value={newTask.duration}
                  onChange={(e) => setNewTask({ ...newTask, duration: Number(e.target.value) })}
                />
              </div>
            </div>
            <footer>
              <button className="cancel-btn" onClick={() => setShowAddTask(false)}>Cancel</button>
              <button className="primary-btn" onClick={handleAddTask}>Add Task</button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
