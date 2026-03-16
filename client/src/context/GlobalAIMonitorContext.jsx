import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

const GlobalAIMonitorContext = createContext(null);

// Settings key
const SETTINGS_KEY = "NeuroNest-settings";
const DISTRACTION_LOG_KEY = "NeuroNest-distraction-log";

// Pages where camera should NOT be activated
const DISABLED_PAGES = ["/", "/signup", "/login", "/forgot-password", "/ai-tutor"];

// Detection thresholds
const FACE_ABSENCE_THRESHOLD = 2000; // 2 seconds
const FRAME_SEND_INTERVAL = 1000; // 1 second
const DISTRACTION_POSITION_THRESHOLD = 0.3; // 30% deviation from center

// Emotion tips
const EMOTION_ICONS = {
    happy: "😊",
    sad: "😢",
    angry: "😠",
    fear: "😨",
    surprise: "😮",
    disgust: "🤢",
    neutral: "😐",
    unknown: "❓",
};

export function GlobalAIMonitorProvider({ children }) {
    const location = useLocation();
    const [isEnabled, setIsEnabled] = useState(true);
    const [isConnected, setIsConnected] = useState(false);
    const [currentEmotion, setCurrentEmotion] = useState({ emotion: "neutral", confidence: 0, tip: "" });
    const [isDistracted, setIsDistracted] = useState(false);
    const [distractionReason, setDistractionReason] = useState("");
    const [headPose, setHeadPose] = useState("center");
    const [eyesDetected, setEyesDetected] = useState(0);
    const [showPreview, setShowPreview] = useState(false);
    const [cameraError, setCameraError] = useState(null);

    // Check if current page is in disabled list
    const isDisabledPage = DISABLED_PAGES.includes(location.pathname);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const intervalRef = useRef(null);
    const lastFaceDetectedRef = useRef(Date.now());
    const distractionStartRef = useRef(null);

    // Load settings
    useEffect(() => {
        try {
            const stored = localStorage.getItem(SETTINGS_KEY);
            if (stored) {
                const settings = JSON.parse(stored);
                setIsEnabled(settings.privacy?.emotionDetection !== false);
            }
        } catch { }

        // Listen for settings changes
        const handleSettingsChange = () => {
            try {
                const stored = localStorage.getItem(SETTINGS_KEY);
                if (stored) {
                    const settings = JSON.parse(stored);
                    setIsEnabled(settings.privacy?.emotionDetection !== false);
                }
            } catch { }
        };

        window.addEventListener("storage", handleSettingsChange);
        return () => window.removeEventListener("storage", handleSettingsChange);
    }, []);

    // Initialize webcam stream
    const initCamera = useCallback(async () => {
        if (streamRef.current) return; // Already initialized

        try {
            // eslint-disable-next-line no-restricted-properties
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user" },
                audio: false,
            });

            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }

            setIsConnected(true);
            setCameraError(null);
            console.log("[GlobalAIMonitor] Camera initialized");
        } catch (err) {
            console.error("[GlobalAIMonitor] Camera error:", err);
            setCameraError(err.message);
            setIsConnected(false);
        }
    }, []);

    // Stop camera
    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setIsConnected(false);
        console.log("[GlobalAIMonitor] Camera stopped");
    }, []);

    // Capture frame and send for analysis
    const captureAndAnalyze = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current || !isEnabled) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");

        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 240;
        ctx.drawImage(video, 0, 0);

        const imageData = canvas.toDataURL("image/jpeg", 0.7);

        try {
            const response = await fetch("http://localhost:8000/emotion", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image: imageData }),
            });

            if (!response.ok) throw new Error("API error");

            const data = await response.json();

            // Update emotion state
            setCurrentEmotion({
                emotion: data.emotion || "unknown",
                confidence: data.confidence || 0,
                tip: data.tip || "",
                emotions: data.emotions || {},
            });

            // Update distraction state from API response
            setHeadPose(data.headPose || "center");
            setEyesDetected(typeof data.eyesDetected === "number" ? data.eyesDetected : 0);

            // Emit global event for other components
            window.dispatchEvent(new CustomEvent("emotion-live-update", {
                detail: {
                    emotion: data.emotion,
                    confidence: data.confidence,
                    tip: data.tip,
                },
            }));

            // Handle distraction detection from API response
            const wasDistracted = isDistracted;
            const nowDistracted = data.distracted || false;
            const reason = data.distractionReason || "";

            if (nowDistracted) {
                if (!wasDistracted) {
                    // Just became distracted
                    setIsDistracted(true);
                    setDistractionReason(reason);
                    logDistractionEvent(data.headPose || "looking_away");
                } else {
                    setDistractionReason(reason);
                }
            } else {
                // Not distracted
                lastFaceDetectedRef.current = Date.now();
                distractionStartRef.current = null;
                if (wasDistracted) {
                    setIsDistracted(false);
                    setDistractionReason("");
                    window.dispatchEvent(new CustomEvent("focus-restored"));
                }
            }

            // Emit distraction event with enhanced data
            window.dispatchEvent(new CustomEvent("distraction-update", {
                detail: {
                    distracted: nowDistracted,
                    reason: reason,
                    headPose: data.headPose || "center",
                    eyesDetected: data.eyesDetected || 0,
                    timestamp: new Date().toISOString(),
                },
            }));

        } catch (err) {
            console.warn("[GlobalAIMonitor] Analysis error:", err.message);
        }
    }, [isEnabled, isDistracted, distractionReason]);

    // Log distraction events for analytics
    const logDistractionEvent = (type) => {
        try {
            const logs = JSON.parse(localStorage.getItem(DISTRACTION_LOG_KEY) || "[]");
            logs.push({
                type,
                timestamp: new Date().toISOString(),
                date: new Date().toDateString(),
            });
            // Keep only last 100 events
            if (logs.length > 100) logs.shift();
            localStorage.setItem(DISTRACTION_LOG_KEY, JSON.stringify(logs));
        } catch { }
    };

    // Start/stop based on enabled state AND current page
    useEffect(() => {
        // Don't start camera on disabled pages
        if (isDisabledPage) {
            stopCamera();
            return;
        }

        if (isEnabled) {
            initCamera();
        } else {
            stopCamera();
        }

        return () => {
            stopCamera();
        };
    }, [isEnabled, isDisabledPage, initCamera, stopCamera]);

    // Start analysis interval when connected
    useEffect(() => {
        if (isConnected && isEnabled) {
            intervalRef.current = setInterval(captureAndAnalyze, FRAME_SEND_INTERVAL);
            return () => {
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                }
            };
        }
    }, [isConnected, isEnabled, captureAndAnalyze]);

    const contextValue = {
        isEnabled,
        setIsEnabled,
        isConnected,
        currentEmotion,
        isDistracted,
        distractionReason,
        headPose,
        eyesDetected,
        showPreview,
        setShowPreview,
        cameraError,
        videoRef,
        canvasRef,
        emotionIcon: EMOTION_ICONS[currentEmotion.emotion] || EMOTION_ICONS.unknown,
    };

    return (
        <GlobalAIMonitorContext.Provider value={contextValue}>
            {/* Hidden video and canvas for webcam processing */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ display: "none" }}
            />
            <canvas ref={canvasRef} style={{ display: "none" }} />
            {children}
        </GlobalAIMonitorContext.Provider>
    );
}

export function useGlobalAIMonitor() {
    const context = useContext(GlobalAIMonitorContext);
    if (!context) {
        throw new Error("useGlobalAIMonitor must be used within GlobalAIMonitorProvider");
    }
    return context;
}

export default GlobalAIMonitorContext;
