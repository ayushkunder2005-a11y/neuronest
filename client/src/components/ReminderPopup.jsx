import { useReminders } from "../context/ReminderContext";
import "../styles/reminderPopup.css";

export default function ReminderPopup() {
    const { activeReminder, showPopup, dismissReminder, completeReminder, snoozeReminder } =
        useReminders();

    if (!showPopup || !activeReminder) return null;

    const formatTime = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    return (
        <div className="reminder-popup-overlay">
            <div className="reminder-popup">
                <div className="popup-header">
                    <span className="alarm-icon">🔔</span>
                    <h2>Reminder</h2>
                </div>

                <div className="popup-content">
                    <h3 className="reminder-title">{activeReminder.title}</h3>
                    {activeReminder.detail && (
                        <p className="reminder-detail">{activeReminder.detail}</p>
                    )}
                    <p className="reminder-time">
                        <span>⏰</span> Scheduled for {formatTime(activeReminder.time)}
                    </p>
                </div>

                <div className="popup-actions">
                    <button
                        className="action-btn snooze"
                        onClick={() => snoozeReminder(activeReminder.id, 5)}
                    >
                        😴 Snooze 5m
                    </button>
                    <button
                        className="action-btn snooze"
                        onClick={() => snoozeReminder(activeReminder.id, 15)}
                    >
                        😴 Snooze 15m
                    </button>
                    <button
                        className="action-btn complete"
                        onClick={() => completeReminder(activeReminder.id)}
                    >
                        ✓ Done
                    </button>
                    <button
                        className="action-btn dismiss"
                        onClick={() => dismissReminder(activeReminder.id)}
                    >
                        ✕ Dismiss
                    </button>
                </div>
            </div>
        </div>
    );
}
