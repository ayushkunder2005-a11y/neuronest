import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { remindersApi } from "../utils/api";

const ReminderContext = createContext(null);

const REMINDERS_KEY = "NeuroNest-reminders";

// Load reminders from localStorage
const loadReminders = () => {
    try {
        const stored = localStorage.getItem(REMINDERS_KEY);
        if (stored) return JSON.parse(stored);
    } catch { }
    return [];
};

// Save reminders to localStorage
const saveReminders = (reminders) => {
    localStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
};

export function ReminderProvider({ children }) {
    const [reminders, setReminders] = useState(loadReminders);
    const [activeReminder, setActiveReminder] = useState(null);
    const [showPopup, setShowPopup] = useState(false);
    const audioRef = useRef(null);
    const checkIntervalRef = useRef(null);

    // Save reminders when they change
    useEffect(() => {
        saveReminders(reminders);
    }, [reminders]);

    // Load reminders from server on mount
    useEffect(() => {
        const loadFromServer = async () => {
            try {
                const serverReminders = await remindersApi.getReminders();
                if (serverReminders && serverReminders.length > 0) {
                    const transformed = serverReminders.map((r) => ({
                        id: r._id || r.id,
                        title: r.text,
                        detail: r.category || "",
                        time: r.remindAt,
                        completed: r.isTriggered,
                        dismissed: false,
                        createdAt: r.createdAt,
                    }));
                    setReminders(transformed);
                    saveReminders(transformed);
                    console.log("[Reminders] Loaded from server:", transformed.length);
                }
            } catch (error) {
                console.warn("[Reminders] Failed to load from server:", error.message);
            }
        };
        loadFromServer();
    }, []);

    // Check for due reminders every second
    useEffect(() => {
        checkIntervalRef.current = setInterval(() => {
            const now = Date.now();
            const dueReminder = reminders.find(
                (r) => !r.completed && !r.dismissed && new Date(r.time).getTime() <= now
            );

            if (dueReminder && !showPopup) {
                setActiveReminder(dueReminder);
                setShowPopup(true);
                playAlarm();
            }
        }, 1000);

        return () => {
            if (checkIntervalRef.current) {
                clearInterval(checkIntervalRef.current);
            }
        };
    }, [reminders, showPopup]);

    // Play alarm sound
    const playAlarm = useCallback(() => {
        try {
            // Create audio context for alarm sound
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Create oscillator for beep sound
            const playBeep = (frequency, delay) => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.value = frequency;
                oscillator.type = "sine";

                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime + delay);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + delay + 0.3);

                oscillator.start(audioContext.currentTime + delay);
                oscillator.stop(audioContext.currentTime + delay + 0.3);
            };

            // Play a pleasant alarm pattern
            playBeep(800, 0);
            playBeep(1000, 0.4);
            playBeep(800, 0.8);
            playBeep(1000, 1.2);
            playBeep(1200, 1.6);
        } catch (err) {
            console.warn("[Reminder] Could not play alarm sound:", err);
        }
    }, []);

    // Stop alarm
    const stopAlarm = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
    }, []);

    // Add a new reminder
    const addReminder = useCallback(async (reminder) => {
        const newReminder = {
            id: `reminder-${Date.now()}`,
            title: reminder.title,
            detail: reminder.detail || "",
            time: reminder.time,
            completed: false,
            dismissed: false,
            createdAt: new Date().toISOString(),
        };
        setReminders((prev) => [...prev, newReminder]);

        // Sync to server
        try {
            const serverReminder = await remindersApi.createReminder(reminder);
            // Update with server ID
            setReminders((prev) => prev.map((r) =>
                r.id === newReminder.id ? { ...r, id: serverReminder._id || serverReminder.id } : r
            ));
        } catch (error) {
            console.warn("[Reminders] Failed to create on server:", error.message);
        }

        return newReminder;
    }, []);

    // Dismiss a reminder
    const dismissReminder = useCallback((id) => {
        setReminders((prev) =>
            prev.map((r) => (r.id === id ? { ...r, dismissed: true } : r))
        );
        setShowPopup(false);
        setActiveReminder(null);
        stopAlarm();
    }, [stopAlarm]);

    // Complete a reminder
    const completeReminder = useCallback((id) => {
        setReminders((prev) =>
            prev.map((r) => (r.id === id ? { ...r, completed: true } : r))
        );
        setShowPopup(false);
        setActiveReminder(null);
        stopAlarm();
    }, [stopAlarm]);

    // Delete a reminder
    const deleteReminder = useCallback((id) => {
        setReminders((prev) => prev.filter((r) => r.id !== id));
        if (activeReminder?.id === id) {
            setShowPopup(false);
            setActiveReminder(null);
            stopAlarm();
        }
        // Delete from server
        remindersApi.deleteReminder(id).catch((err) =>
            console.warn("[Reminders] Failed to delete from server:", err.message)
        );
    }, [activeReminder, stopAlarm]);

    // Snooze reminder for X minutes
    const snoozeReminder = useCallback((id, minutes = 5) => {
        const newTime = new Date(Date.now() + minutes * 60 * 1000).toISOString();
        setReminders((prev) =>
            prev.map((r) => (r.id === id ? { ...r, time: newTime, dismissed: false } : r))
        );
        setShowPopup(false);
        setActiveReminder(null);
        stopAlarm();
    }, [stopAlarm]);

    // Get pending reminders (not completed, not dismissed)
    const getPendingReminders = useCallback(() => {
        return reminders.filter((r) => !r.completed && !r.dismissed);
    }, [reminders]);

    // Get upcoming reminders (next 24 hours)
    const getUpcomingReminders = useCallback(() => {
        const now = Date.now();
        const in24Hours = now + 24 * 60 * 60 * 1000;
        return reminders.filter((r) => {
            const reminderTime = new Date(r.time).getTime();
            return !r.completed && !r.dismissed && reminderTime > now && reminderTime <= in24Hours;
        });
    }, [reminders]);

    const contextValue = {
        reminders,
        activeReminder,
        showPopup,
        addReminder,
        dismissReminder,
        completeReminder,
        deleteReminder,
        snoozeReminder,
        getPendingReminders,
        getUpcomingReminders,
    };

    return (
        <ReminderContext.Provider value={contextValue}>
            {children}
        </ReminderContext.Provider>
    );
}

export function useReminders() {
    const context = useContext(ReminderContext);
    if (!context) {
        throw new Error("useReminders must be used within ReminderProvider");
    }
    return context;
}

export default ReminderContext;
