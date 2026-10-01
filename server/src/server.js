import { spawn, spawnSync } from "child_process";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import http from "http";
import passport from "passport";
import path from "path";
import { Server } from "socket.io";
import { io as createSocketClient } from "socket.io-client";
import { fileURLToPath } from "url";
import connectDB from "./config/db.js";
import configurePassport from "./config/passport.js";
import { connectSQL } from "./config/sqlDb.js";
import aiRoutes from "./routes/aiRoutes.js";
import cognitiveRoutes from "./routes/cognitiveRoutes.js";
import progressRoutes from "./routes/progressRoutes.js";
import reminderRoutes from "./routes/reminderRoutes.js";
import rewardsRoutes from "./routes/rewardsRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import emotionRoutes from "./routes/emotionRoutes.js";
import {
  startReminderScheduler,
  stopReminderScheduler,
} from "./services/reminderService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_AI_ENTRY = path.resolve(PROJECT_ROOT, "ai_engine", "api", "ai_server.py");
const DEFAULT_AI_CWD = path.dirname(DEFAULT_AI_ENTRY);
const localPythonCandidates = [
  path.resolve(PROJECT_ROOT, "ai_engine", ".venv", "Scripts", "python.exe"),
  path.resolve(PROJECT_ROOT, "ai_engine", ".venv", "bin", "python"),
  path.resolve(PROJECT_ROOT, "venv", "Scripts", "python.exe"),
  path.resolve(PROJECT_ROOT, "venv", "bin", "python"),
];

const pickLocalPython = () => {
  for (const candidate of localPythonCandidates) {
    if (fs.existsSync(candidate)) {
      // Verify the binary actually works (venv symlinks can be stale)
      try {
        const result = spawnSync(candidate, ["--version"], { timeout: 5000 });
        if (result.status === 0) {
          return candidate;
        }
        console.warn(`[Python] ${candidate} exists but is broken, skipping`);
      } catch {
        console.warn(`[Python] ${candidate} failed validation, skipping`);
      }
    }
  }
  return null;
};

dotenv.config();
configurePassport();
connectDB();
connectSQL().catch((err) => console.warn("SQL init warning:", err.message));
const parseOrigins = (value = "") =>
  value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length);

const CLIENT_APP_URLS =
  process.env.CLIENT_APP_URLS ||
  process.env.CLIENT_APP_URL ||
  "http://localhost:3000,http://localhost:5173";

const ALLOWED_ORIGINS = parseOrigins(CLIENT_APP_URLS);
const DEFAULT_AI_PORT = process.env.AI_ENGINE_PORT || "8000";
const DEFAULT_JARVIS_PORT = process.env.JARVIS_PORT || "8001";
const DEFAULT_AI_TWIN_PORT = process.env.AI_TWIN_PORT || "8002";

const AUTO_START_AI_ENGINE =
  (process.env.AUTO_START_AI_ENGINE ?? "true").toLowerCase() !== "false";
const AUTO_START_JARVIS =
  (process.env.AUTO_START_JARVIS ?? "true").toLowerCase() !== "false";
let aiSubprocess = null;
let shuttingDownAi = false;
let aiRestartBlocked = false;
const aiRestartEvents = [];
const AI_RESTART_WINDOW_MS = Number(process.env.AI_ENGINE_RESTART_WINDOW_MS || 60000);
const AI_RESTART_MAX = Number(process.env.AI_ENGINE_MAX_RESTARTS || 5);
const AI_RESTART_DELAY_MS = Number(process.env.AI_ENGINE_RESTART_DELAY_MS || 3000);
let jarvisSubprocess = null;
let shuttingDownJarvis = false;
let jarvisRestartBlocked = false;
const jarvisRestartEvents = [];
const JARVIS_RESTART_WINDOW_MS = Number(
  process.env.JARVIS_RESTART_WINDOW_MS || AI_RESTART_WINDOW_MS
);
const JARVIS_RESTART_MAX = Number(process.env.JARVIS_MAX_RESTARTS || AI_RESTART_MAX);
const JARVIS_RESTART_DELAY_MS = Number(
  process.env.JARVIS_RESTART_DELAY_MS || AI_RESTART_DELAY_MS
);

const canRestartAiEngine = () => {
  const now = Date.now();
  while (aiRestartEvents.length && now - aiRestartEvents[0] > AI_RESTART_WINDOW_MS) {
    aiRestartEvents.shift();
  }
  if (aiRestartEvents.length >= AI_RESTART_MAX) {
    aiRestartBlocked = true;
    console.error(
      `[AI Engine] Restart limit hit (${AI_RESTART_MAX} in ${AI_RESTART_WINDOW_MS}ms). ` +
      "Stopping auto-restart."
    );
    return false;
  }
  return true;
};

const canRestartJarvis = () => {
  const now = Date.now();
  while (jarvisRestartEvents.length && now - jarvisRestartEvents[0] > JARVIS_RESTART_WINDOW_MS) {
    jarvisRestartEvents.shift();
  }
  if (jarvisRestartEvents.length >= JARVIS_RESTART_MAX) {
    jarvisRestartBlocked = true;
    console.error(
      `[Jarvis] Restart limit hit (${JARVIS_RESTART_MAX} in ${JARVIS_RESTART_WINDOW_MS}ms). ` +
      "Stopping auto-restart."
    );
    return false;
  }
  return true;
};

const ensureAiEngineProcess = () => {
  if (!AUTO_START_AI_ENGINE || aiSubprocess) {
    return;
  }
  if (aiRestartBlocked) {
    console.warn("[AI Engine] Auto-start disabled after repeated failures.");
    return;
  }
  const pythonBin = process.env.AI_PYTHON_BIN || pickLocalPython() || "python";
  const entryPoint = process.env.AI_ENGINE_ENTRY || DEFAULT_AI_ENTRY;
  const entryCwd = process.env.AI_ENGINE_CWD || DEFAULT_AI_CWD;
  const aiPort = DEFAULT_AI_PORT;

  console.log(`[AI Engine] Autostarting via ${pythonBin} ${entryPoint}`);
  aiSubprocess = spawn(pythonBin, [entryPoint], {
    cwd: entryCwd,
    stdio: "inherit",
    env: { ...process.env, PYTHONUNBUFFERED: "1", PORT: aiPort },
  });

  aiSubprocess.on("exit", (code, signal) => {
    console.log(`[AI Engine] exited (${signal ?? code})`);
    aiSubprocess = null;
    if (!shuttingDownAi && (code || signal)) {
      aiRestartEvents.push(Date.now());
      if (canRestartAiEngine()) {
        setTimeout(ensureAiEngineProcess, AI_RESTART_DELAY_MS);
      }
    }
  });

  aiSubprocess.on("error", (err) => {
    console.error("[AI Engine] failed to start:", err.message);
    aiSubprocess = null;
    if (!shuttingDownAi) {
      aiRestartEvents.push(Date.now());
      if (canRestartAiEngine()) {
        setTimeout(ensureAiEngineProcess, AI_RESTART_DELAY_MS);
      }
    }
  });
};

const stopAiEngine = () => {
  shuttingDownAi = true;
  if (aiSubprocess) {
    aiSubprocess.kill();
  }
};

if (AUTO_START_AI_ENGINE) {
  ensureAiEngineProcess();
}

const ensureJarvisProcess = () => {
  if (!AUTO_START_JARVIS || jarvisSubprocess) {
    return;
  }
  if (jarvisRestartBlocked) {
    console.warn("[Jarvis] Auto-start disabled after repeated failures.");
    return;
  }
  const pythonBin =
    process.env.JARVIS_PYTHON_BIN ||
    process.env.AI_PYTHON_BIN ||
    pickLocalPython() ||
    "python";
  const entryScript = process.env.JARVIS_ENTRY || path.resolve(PROJECT_ROOT, "ai_engine", "api", "tutor_jarvis.py");
  const entryCwd =
    process.env.JARVIS_CWD || path.resolve(PROJECT_ROOT, "ai_engine", "api");
  const jarvisPort = DEFAULT_JARVIS_PORT;

  console.log(`[Jarvis] Autostarting via ${pythonBin} ${entryScript}`);
  jarvisSubprocess = spawn(
    pythonBin,
    [entryScript],
    {
      cwd: entryCwd,
      stdio: "inherit",
      env: { ...process.env, PYTHONUNBUFFERED: "1", TUTOR_PORT: jarvisPort },
    }
  );

  jarvisSubprocess.on("exit", (code, signal) => {
    console.log(`[Jarvis] exited (${signal ?? code})`);
    jarvisSubprocess = null;
    if (!shuttingDownJarvis && (code || signal)) {
      jarvisRestartEvents.push(Date.now());
      if (canRestartJarvis()) {
        setTimeout(ensureJarvisProcess, JARVIS_RESTART_DELAY_MS);
      }
    }
  });

  jarvisSubprocess.on("error", (err) => {
    console.error("[Jarvis] failed to start:", err.message);
    jarvisSubprocess = null;
    if (!shuttingDownJarvis) {
      jarvisRestartEvents.push(Date.now());
      if (canRestartJarvis()) {
        setTimeout(ensureJarvisProcess, JARVIS_RESTART_DELAY_MS);
      }
    }
  });
};

const stopJarvis = () => {
  shuttingDownJarvis = true;
  if (jarvisSubprocess) {
    jarvisSubprocess.kill();
  }
};

if (AUTO_START_JARVIS) {
  ensureJarvisProcess();
}

// --- AI Twin Engine auto-start ---
const AUTO_START_AI_TWIN =
  (process.env.AUTO_START_AI_TWIN ?? "false").toLowerCase() !== "false";
let aiTwinSubprocess = null;
let shuttingDownAiTwin = false;

const ensureAiTwinProcess = () => {
  if (!AUTO_START_AI_TWIN || aiTwinSubprocess) return;
  const pythonBin =
    process.env.AI_TWIN_PYTHON_BIN ||
    process.env.AI_PYTHON_BIN ||
    pickLocalPython() ||
    "python";
  const entryScript =
    process.env.AI_TWIN_ENTRY ||
    path.resolve(PROJECT_ROOT, "ai_engine", "api", "ai_twin_engine.py");
  const entryCwd =
    process.env.AI_TWIN_CWD ||
    path.resolve(PROJECT_ROOT, "ai_engine", "api");

  console.log(`[AI Twin] Autostarting via ${pythonBin} ${entryScript}`);
  aiTwinSubprocess = spawn(pythonBin, [entryScript], {
    cwd: entryCwd,
    stdio: "inherit",
    env: { ...process.env, PYTHONUNBUFFERED: "1", AI_TWIN_PORT: DEFAULT_AI_TWIN_PORT },
  });

  aiTwinSubprocess.on("exit", (code, signal) => {
    console.log(`[AI Twin] exited (${signal ?? code})`);
    aiTwinSubprocess = null;
    if (!shuttingDownAiTwin && (code || signal)) {
      setTimeout(ensureAiTwinProcess, AI_RESTART_DELAY_MS);
    }
  });

  aiTwinSubprocess.on("error", (err) => {
    console.error("[AI Twin] failed to start:", err.message);
    aiTwinSubprocess = null;
    if (!shuttingDownAiTwin) {
      setTimeout(ensureAiTwinProcess, AI_RESTART_DELAY_MS);
    }
  });
};

const stopAiTwin = () => {
  shuttingDownAiTwin = true;
  if (aiTwinSubprocess) aiTwinSubprocess.kill();
};

if (AUTO_START_AI_TWIN) {
  ensureAiTwinProcess();
}

const corsOptions = {
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-client-key"],
};

const app = express();
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(passport.initialize());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.get("/", (_, res) => res.send("NeuroNest API Running"));
app.use("/api/users", userRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/reminders", reminderRoutes);
app.use("/api/cognitive", cognitiveRoutes);
app.use("/api/rewards", rewardsRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/emotion", emotionRoutes);

// ---- WebSocket Bridge ----
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
startReminderScheduler(io);

const AI_ENGINE_URL =
  process.env.AI_SERVER_URL || `http://localhost:${DEFAULT_AI_PORT}`;
let aiEngineOnline = false;
const aiSocket = createSocketClient(AI_ENGINE_URL, {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelayMax: Number(process.env.AI_SOCKET_RETRY_MS || 10000),
});

aiSocket.on("connect", () => {
  console.log(`[AI Engine] Connected at ${AI_ENGINE_URL}`);
  aiEngineOnline = true;
  io.emit("ai-engine-status", { status: "online" });
});

aiSocket.on("disconnect", (reason) => {
  console.warn("[AI Engine] Disconnected:", reason);
  aiEngineOnline = false;
  io.emit("ai-engine-status", { status: "offline" });
});

aiSocket.on("connect_error", (err) => {
  console.error("[AI Engine] Connection error:", err.message);
  if (aiEngineOnline) {
    aiEngineOnline = false;
    io.emit("ai-engine-status", { status: "offline" });
  }
});

aiSocket.on("emotion-update", (payload) => {
  io.emit("emotion-live", payload);
});

io.on("connection", (socket) => {
  console.log("[Dashboard] WebSocket client connected:", socket.id);
  socket.emit("ai-engine-status", { status: aiEngineOnline ? "online" : "offline" });

  socket.on("frame", (frame) => {
    if (!frame) {
      return;
    }
    if (aiSocket.connected) {
      aiSocket.emit("frame-forward", { frame });
    } else {
      const now = Date.now();
      const lastNotice = socket.data?.lastOfflineNotice || 0;
      if (!socket.data) {
        socket.data = {};
      }
      if (now - lastNotice > 4000) {
        socket.data.lastOfflineNotice = now;
        socket.emit("emotion-live", {
          emotion: "unknown",
          confidence: 0,
          tip: "Emotion AI warming up. Please try again in a moment.",
          timestamp: new Date().toISOString(),
        });
      }
    }
  });

  socket.on("disconnect", () => {
    console.log("[Dashboard] WebSocket client disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`[API] HTTP + WebSocket server listening on ${PORT}`)
);

const handleShutdown = () => {
  stopAiEngine();
  stopJarvis();
  stopAiTwin();
  stopReminderScheduler();
};

process.on("exit", handleShutdown);
["SIGINT", "SIGTERM"].forEach((event) => {
  process.on(event, () => {
    handleShutdown();
    process.exit();
  });
});
