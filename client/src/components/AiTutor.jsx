import { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import EmotionGraph from "./EmotionGraph";

const apiBaseUrl =
  import.meta.env.VITE_AI_ENGINE_URL ||
  (typeof window !== "undefined" ? "http://localhost:8000" : "http://localhost:8000");

const HEALTH_ENDPOINT = `${apiBaseUrl.replace(/\/$/, "")}/health`;
const EMOTION_ENDPOINT = `${apiBaseUrl.replace(/\/$/, "")}/emotion`;
const REDIRECT_COOLDOWN_MS = 45000;

const EMOTION_MESSAGES = {
  happy: "Great mood! Keep stacking those wins.",
  sad: "Energy dip detected. Sending you to a fun challenge to reset the vibe.",
  angry: "Deep breath. We will route you to something lighter.",
  neutral: "Steady focus - keep going.",
  default: "Keep growing!",
};

export default function AiTutor({ className = "" }) {
  const cam = useRef(null);
  const [emotion, setEmotion] = useState("");
  const [confidence, setConfidence] = useState(0);
  const [message, setMessage] = useState("Initializing AI Tutor...");
  const [cameraStatus, setCameraStatus] = useState("Requesting camera permission...");
  const [lastRedirectAt, setLastRedirectAt] = useState(0);
  const [monitoring, setMonitoring] = useState(false);
  const [aiEngineStatus, setAiEngineStatus] = useState("offline");
  const [pendingStart, setPendingStart] = useState(false);
  // Distraction detection state
  const [isDistracted, setIsDistracted] = useState(false);
  const [distractionReason, setDistractionReason] = useState("");
  const [headPose, setHeadPose] = useState("center");
  const [eyesDetected, setEyesDetected] = useState(0);

  useEffect(() => {
    let mounted = true;
    const askPermission = async () => {
      try {
        const stream = await navigator.mediaDevices?.getUserMedia({ video: true });
        stream?.getTracks().forEach((track) => track.stop());
        if (mounted) setCameraStatus("Camera active");
      } catch {
        if (mounted) setCameraStatus("Camera blocked. Enable permissions to continue.");
      }
    };
    askPermission();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const checkHealth = async () => {
      try {
        const response = await fetch(HEALTH_ENDPOINT, { method: "GET" });
        if (!mounted) return;
        const nextStatus = response.ok ? "online" : "offline";
        setAiEngineStatus(nextStatus);
        if (nextStatus !== "online" && monitoring) {
          setMonitoring(false);
          setMessage("AI engine offline. Waiting to resume monitoring.");
        }
      } catch {
        if (!mounted) return;
        setAiEngineStatus("offline");
        if (monitoring) {
          setMonitoring(false);
          setMessage("AI engine offline. Waiting to resume monitoring.");
        }
      }
    };

    checkHealth();
    const id = setInterval(checkHealth, 3000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [monitoring]);

  useEffect(() => {
    if (!monitoring || aiEngineStatus !== "online") {
      return undefined;
    }
    let mounted = true;
    const fetchEmotion = async () => {
      try {
        const shot = cam.current?.getScreenshot();
        if (!shot) return;
        const response = await fetch(EMOTION_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: shot }),
        });
        if (!response.ok || !mounted) return;
        const payload = await response.json();
        const nextEmotion = (payload.emotion || "").toLowerCase();
        setEmotion(nextEmotion);
        setConfidence(typeof payload.confidence === "number" ? payload.confidence : 0);

        // Handle distraction detection
        setIsDistracted(payload.distracted || false);
        setDistractionReason(payload.distractionReason || "");
        setHeadPose(payload.headPose || "center");
        setEyesDetected(typeof payload.eyesDetected === "number" ? payload.eyesDetected : 0);

        // Update message - show distraction warning if distracted, otherwise show emotion tip
        if (payload.distracted && payload.distractionReason) {
          setMessage(payload.distractionReason);
        } else {
          setMessage(payload.tip || EMOTION_MESSAGES[nextEmotion] || EMOTION_MESSAGES.default);
        }

        if (typeof window !== "undefined") {
          // Dispatch emotion update
          window.dispatchEvent(
            new CustomEvent("emotion-live-update", {
              detail: {
                emotion: nextEmotion,
                confidence: typeof payload.confidence === "number" ? payload.confidence : 0,
                tip: payload.tip || "",
                timestamp: payload.timestamp || new Date().toISOString(),
              },
            })
          );
          // Dispatch distraction update
          window.dispatchEvent(
            new CustomEvent("distraction-live-update", {
              detail: {
                distracted: payload.distracted || false,
                reason: payload.distractionReason || "",
                headPose: payload.headPose || "center",
                eyesDetected: payload.eyesDetected || 0,
                timestamp: payload.timestamp || new Date().toISOString(),
              },
            })
          );
        }
      } catch {
        /* ignore fetch errors to avoid noisy UI */
      }
    };
    fetchEmotion();
    const id = setInterval(fetchEmotion, 1500);
    return () => clearInterval(id);
  }, [monitoring, aiEngineStatus]);

  useEffect(() => {
    if (emotion !== "sad") {
      return;
    }
    const now = Date.now();
    if (now - lastRedirectAt < REDIRECT_COOLDOWN_MS) {
      return;
    }
    setLastRedirectAt(now);
    setMessage(
      "I noticed a dip. If you want a quick reset, open Tasks or Training from the sidebar."
    );
  }, [emotion, lastRedirectAt]);

  const canMonitor =
    cameraStatus === "Camera active" && aiEngineStatus === "online";

  const toggleMonitoring = () => {
    if (!monitoring && !canMonitor) {
      setMessage(
        "Enable camera access and wait for the AI engine connection, then start monitoring."
      );
      setPendingStart(true);
      return;
    }
    if (!monitoring) {
      setPendingStart(false);
      setMonitoring(true);
    } else {
      setPendingStart(false);
      setMonitoring(false);
    }
  };

  useEffect(() => {
    if (pendingStart && canMonitor && !monitoring) {
      setPendingStart(false);
      setMonitoring(true);
      setMessage("Streaming frames to AI engine...");
    }
  }, [pendingStart, canMonitor, monitoring]);

  const monitoringLabel = monitoring ? "Stop Emotion Monitor" : "Start Emotion Monitor ";
  const monitoringHint = monitoring
    ? "Streaming webcam frames to the AI engine..."
    : aiEngineStatus !== "online"
      ? "AI engine offline. Start the server to enable emotion detection."
      : "Press start to fetch emotion updates.";

  return (
    <div className={`card ai-tutor ${className} ${isDistracted && monitoring ? "distracted" : ""}`}>
      {/* Distraction Warning Overlay */}
      {isDistracted && monitoring && (
        <div className="distraction-overlay">
          <div className="distraction-warning">
            <span className="warning-icon">⚠️</span>
            <div className="warning-text">
              <strong>Distraction Detected!</strong>
              <p>{distractionReason || "Please look at the screen"}</p>
            </div>
          </div>
        </div>
      )}
      <div className="ai-tutor-header">
        <div>
          <p>AI Tutor | OpenCV Emotion Monitor</p>
          <h3>{emotion || "Detecting..."}</h3>
        </div>
        <div className="status-badges">
          {monitoring && (
            <span className={`focus-badge ${isDistracted ? "distracted" : "focused"}`}>
              {isDistracted ? "⚠️ Distracted" : "✅ Focused"}
            </span>
          )}
          <span className={`camera-status ${cameraStatus.includes("blocked") ? "error" : ""}`}>
            {cameraStatus}
          </span>
        </div>
      </div>
      <div className="ai-tutor-body">
        <div className="cam-frame">
          <Webcam
            ref={cam}
            audio={false}
            screenshotFormat="image/jpeg"
            className="ai-webcam"
            videoConstraints={{ facingMode: "user" }}
            onUserMedia={() => setCameraStatus("Camera active")}
            onUserMediaError={() =>
              setCameraStatus("Camera blocked. Enable permissions to continue.")
            }
          />
          <div className="detection-stats">
            <p className="confidence">
              Confidence:{" "}
              {monitoring && confidence ? `${confidence.toFixed(1)}%` : monitoring ? "Detecting..." : "--"}
            </p>
            {monitoring && (
              <p className="head-pose">
                Head: <span className={headPose === "center" ? "centered" : "off-center"}>{headPose}</span>
                {" | "}Eyes: {eyesDetected}
              </p>
            )}
          </div>
          <button type="button" className="pill primary solid monitor-btn" onClick={toggleMonitoring}>
            {monitoringLabel}
          </button>
          <small className="monitoring-hint">{monitoringHint}</small>
        </div>
        <div className="ai-insights">
          <p className={`ai-message ${isDistracted && monitoring ? "warning" : ""}`}>{message}</p>
          <EmotionGraph isMonitoring={monitoring} />
        </div>
      </div>
    </div>
  );
}
