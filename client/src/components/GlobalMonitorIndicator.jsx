import { useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useGlobalAIMonitor } from "../context/GlobalAIMonitorContext";
import "../styles/globalMonitor.css";

// Pages where the monitor should NOT be shown
const DISABLED_PAGES = ["/", "/signup", "/login", "/forgot-password", "/ai-tutor"];

export default function GlobalMonitorIndicator() {
    const location = useLocation();
    const {
        isEnabled,
        isConnected,
        currentEmotion,
        isDistracted,
        distractionReason,
        showPreview,
        setShowPreview,
        cameraError,
        videoRef,
        emotionIcon,
    } = useGlobalAIMonitor();

    // Don't render on disabled pages
    if (DISABLED_PAGES.includes(location.pathname)) {
        return null;
    }

    // Don't render if monitoring is disabled
    if (!isEnabled) return null;

    // Drag state
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const posRef = useRef(position);
    const isDraggingRef = useRef(false);

    useEffect(() => {
        posRef.current = position;
    }, [position]);

    const handleMouseDown = (e) => {
        // Only trigger on left click and avoid inner interactive elements like buttons
        if (e.target.closest('button') || e.target.closest('video')) return;
        if (e.button !== 0) return;

        e.preventDefault(); // Prevent text selection
        setIsDragging(true);
        isDraggingRef.current = false;

        const startX = e.clientX - posRef.current.x;
        const startY = e.clientY - posRef.current.y;

        const handleMouseMove = (moveEvent) => {
            isDraggingRef.current = true;
            setPosition({
                x: moveEvent.clientX - startX,
                y: moveEvent.clientY - startY
            });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
            // Allow time for click handlers to fire and check if it was dragged
            setTimeout(() => {
                isDraggingRef.current = false;
            }, 50);
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
    };

    const handleTogglePreview = () => {
        if (isDraggingRef.current) return; // Don't toggle if the user just dragged it
        setShowPreview(!showPreview);
    };

    return (
        <div 
            className={`global-monitor-indicator ${isDistracted ? "distracted" : ""}`}
            style={{ 
                transform: `translate(${position.x}px, ${position.y}px)`,
                cursor: isDragging ? "grabbing" : "grab",
                padding: "8px" // Provide some slop for grabbing
            }}
            onMouseDown={handleMouseDown}
        >
            {/* Distraction Warning */}
            {isDistracted && (
                <div className="distraction-warning">
                    <span className="warning-icon">⚠️</span>
                    <div className="warning-content">
                        <span className="warning-title">Distracted</span>
                        <span className="warning-reason">{distractionReason || "Focus lost"}</span>
                    </div>
                </div>
            )}

            {/* Main Status */}
            <div className="monitor-status" onClick={handleTogglePreview}>
                {/* Connection Indicator */}
                <div className={`connection-dot ${isConnected ? "connected" : "disconnected"}`} />

                {/* Emotion Display */}
                <div className="emotion-display">
                    <span className="emotion-icon">{emotionIcon}</span>
                    <span className="emotion-label">{currentEmotion.emotion}</span>
                </div>

                {/* Confidence Bar */}
                {currentEmotion.confidence > 0 && (
                    <div className="confidence-bar">
                        <div
                            className="confidence-fill"
                            style={{ width: `${Math.min(100, currentEmotion.confidence)}%` }}
                        />
                    </div>
                )}
            </div>

            {/* Camera Preview (toggleable) */}
            {showPreview && isConnected && (
                <div className="camera-preview">
                    <video
                        autoPlay
                        playsInline
                        muted
                        ref={(el) => {
                            if (el && videoRef.current?.srcObject) {
                                if (el.srcObject !== videoRef.current.srcObject) {
                                    el.srcObject = videoRef.current.srcObject;
                                }
                            }
                        }}
                    />
                    <button
                        className="close-preview"
                        onClick={(e) => { e.stopPropagation(); setShowPreview(false); }}
                    >
                        ×
                    </button>
                </div>
            )}

            {/* Camera Error */}
            {cameraError && (
                <div className="camera-error">
                    <span>📷 {cameraError}</span>
                </div>
            )}

            {/* Tip Tooltip */}
            {currentEmotion.tip && !isDistracted && (
                <div className="tip-tooltip">
                    {currentEmotion.tip}
                </div>
            )}
        </div>
    );
}
