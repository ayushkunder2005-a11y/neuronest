// src/components/MoodChat.jsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/moodChat.css";

// Emotion keywords mapping
const EMOTION_KEYWORDS = {
    sad: ["sad", "unhappy", "depressed", "down", "upset", "crying", "lonely", "miserable", "gloomy", "blue", "heartbroken", "disappointed", "low"],
    anxious: ["anxious", "worried", "nervous", "stressed", "overwhelmed", "panicking", "tense", "restless", "uneasy", "scared", "fearful", "panic"],
    angry: ["angry", "mad", "furious", "irritated", "annoyed", "frustrated", "rage", "pissed", "upset", "agitated"],
    tired: ["tired", "exhausted", "sleepy", "fatigued", "drained", "burnout", "worn out", "low energy", "sluggish", "lethargic"],
    happy: ["happy", "good", "great", "wonderful", "excited", "joyful", "cheerful", "delighted", "pleased", "content", "amazing", "fantastic"],
    bored: ["bored", "boring", "uninterested", "dull", "monotonous", "nothing to do", "lazy"],
    confused: ["confused", "lost", "unsure", "uncertain", "puzzled", "don't know", "unclear", "foggy"],
    unmotivated: ["unmotivated", "lazy", "no motivation", "can't focus", "distracted", "unfocused", "procrastinating"]
};

// Training recommendations based on emotions
const MOOD_RECOMMENDATIONS = {
    sad: {
        emoji: "😢",
        modules: [
            { id: "relaxation", name: "Alpha Waves Meditation", icon: "🌊", reason: "Soothing binaural beats to calm your mind and lift your mood" },
            { id: "relaxation", name: "Mental Recovery", icon: "🧘", reason: "Breathing exercises can help lift your spirits" }
        ],
        message: "I can sense you're feeling down. Let me guide you to some calming meditation."
    },
    anxious: {
        emoji: "😰",
        modules: [
            { id: "relaxation", name: "Alpha Waves Meditation", icon: "🌊", reason: "Alpha waves help reduce anxiety and calm your nervous system" },
            { id: "relaxation", name: "Guided Breathing", icon: "🧘", reason: "Calm breathing reduces anxiety" }
        ],
        message: "It's okay to feel anxious. Let's calm your mind with soothing alpha waves."
    },
    angry: {
        emoji: "😤",
        modules: [
            { id: "relaxation", name: "Mindful Moment", icon: "🧘", reason: "Mindfulness helps process emotions" },
            { id: "focus", name: "Focus Training", icon: "🎯", reason: "Channel that energy into concentration" }
        ],
        message: "I understand you're frustrated. Let's redirect that energy positively."
    },
    tired: {
        emoji: "😴",
        modules: [
            { id: "relaxation", name: "Alpha Waves Meditation", icon: "🌊", reason: "Alpha waves help restore mental energy and reduce fatigue" },
            { id: "relaxation", name: "Guided Breathing", icon: "🧘", reason: "Energizing breaths can help revitalize you" }
        ],
        message: "Feeling tired? Let alpha waves restore your mental energy."
    },
    happy: {
        emoji: "😊",
        modules: [
            { id: "logic", name: "Logic & Reasoning", icon: "🧩", reason: "Challenge yourself while you're in a good mood!" },
            { id: "memory", name: "Memory Training", icon: "🧠", reason: "Great time to build new neural connections" }
        ],
        message: "Wonderful! Let's make the most of this positive energy!"
    },
    bored: {
        emoji: "😐",
        modules: [
            { id: "logic", name: "Pattern Finder", icon: "🧩", reason: "Puzzles are perfect for beating boredom" },
            { id: "focus", name: "Reaction Test", icon: "🎯", reason: "Quick and engaging to spark interest" }
        ],
        message: "Let's turn that boredom into brain power with some fun exercises!"
    },
    confused: {
        emoji: "🤔",
        modules: [
            { id: "logic", name: "Logic Puzzles", icon: "🧩", reason: "Practice clear thinking" },
            { id: "focus", name: "Focus Training", icon: "🎯", reason: "Improve mental clarity" }
        ],
        message: "Feeling foggy? Let's sharpen your mind with some clarity exercises."
    },
    unmotivated: {
        emoji: "😑",
        modules: [
            { id: "focus", name: "Quick Focus", icon: "🎯", reason: "Start small to build momentum" },
            { id: "memory", name: "Card Match", icon: "🧠", reason: "Easy and rewarding to get started" }
        ],
        message: "No worries! Let's start with something simple to get you going."
    },
    neutral: {
        emoji: "🙂",
        modules: [
            { id: "focus", name: "Focus Training", icon: "🎯", reason: "Improve concentration" },
            { id: "memory", name: "Memory Training", icon: "🧠", reason: "Boost your memory" },
            { id: "logic", name: "Logic & Reasoning", icon: "🧩", reason: "Sharpen problem-solving" }
        ],
        message: "Ready to train your brain? Here are some suggestions for you!"
    }
};

// Detect emotion from text
const detectEmotion = (text) => {
    const lowerText = text.toLowerCase();

    for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
        for (const keyword of keywords) {
            if (lowerText.includes(keyword)) {
                return emotion;
            }
        }
    }

    return "neutral";
};

// Chat message component
const ChatMessage = ({ message, isUser }) => (
    <div className={`chat-message ${isUser ? "user" : "bot"}`}>
        {!isUser && <span className="bot-avatar">🤖</span>}
        <div className="message-bubble">
            {message}
        </div>
    </div>
);

// Recommendation card component
const RecommendationCard = ({ module, onClick }) => (
    <button className="recommendation-card" onClick={onClick}>
        <span className="rec-icon">{module.icon}</span>
        <div className="rec-content">
            <h4>{module.name}</h4>
            <p>{module.reason}</p>
        </div>
        <span className="rec-arrow">→</span>
    </button>
);

export default function MoodChat() {
    const [messages, setMessages] = useState([
        { text: "Hi there! 👋 How are you feeling today? Tell me about your mood and I'll suggest some exercises to help.", isUser: false }
    ]);
    const [input, setInput] = useState("");
    const [detectedMood, setDetectedMood] = useState(null);
    const [recommendations, setRecommendations] = useState(null);
    const [isTyping, setIsTyping] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const navigate = useNavigate();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = async () => {
        if (!input.trim()) return;

        const userMessage = input.trim();
        setInput("");

        // Add user message
        setMessages(prev => [...prev, { text: userMessage, isUser: true }]);

        // Show typing indicator
        setIsTyping(true);

        // Detect emotion with slight delay for natural feel
        await new Promise(resolve => setTimeout(resolve, 800));

        const emotion = detectEmotion(userMessage);
        const moodData = MOOD_RECOMMENDATIONS[emotion] || MOOD_RECOMMENDATIONS.neutral;

        setDetectedMood({ emotion, ...moodData });
        setRecommendations(moodData.modules);

        // Add bot response
        setMessages(prev => [...prev, {
            text: `${moodData.emoji} ${moodData.message}`,
            isUser: false
        }]);

        setIsTyping(false);
    };

    const handleKeyPress = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleModuleClick = (module) => {
        // Navigate to training with the selected module
        navigate(`/training?module=${module.id}`);
    };

    const handleQuickMood = (mood) => {
        setInput(mood);
        setTimeout(() => {
            handleSendMessage();
        }, 100);
    };

    const quickMoods = [
        { label: "😊 Happy", value: "I'm feeling happy today" },
        { label: "😢 Sad", value: "I'm feeling sad" },
        { label: "😰 Anxious", value: "I'm feeling anxious" },
        { label: "😴 Tired", value: "I'm feeling tired" },
        { label: "😤 Frustrated", value: "I'm feeling frustrated" }
    ];

    return (
        <div className={`mood-chat-container ${isExpanded ? "expanded" : ""}`}>
            <button
                className="mood-chat-toggle"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-label={isExpanded ? "Close mood chat" : "Open mood chat"}
            >
                {isExpanded ? "✕" : "💭"}
                {!isExpanded && <span className="toggle-label">How are you feeling?</span>}
            </button>

            {isExpanded && (
                <div className="mood-chat-panel">
                    <div className="chat-header">
                        <div className="header-info">
                            <span className="header-icon">🧠</span>
                            <div>
                                <h3>Mood Check-In</h3>
                                <p>Tell me how you're feeling</p>
                            </div>
                        </div>
                    </div>

                    <div className="chat-messages">
                        {messages.map((msg, idx) => (
                            <ChatMessage key={idx} message={msg.text} isUser={msg.isUser} />
                        ))}

                        {isTyping && (
                            <div className="chat-message bot">
                                <span className="bot-avatar">🤖</span>
                                <div className="message-bubble typing">
                                    <span className="typing-dot" />
                                    <span className="typing-dot" />
                                    <span className="typing-dot" />
                                </div>
                            </div>
                        )}

                        {recommendations && !isTyping && (
                            <div className="recommendations-section">
                                <p className="rec-title">Recommended for you:</p>
                                {recommendations.map((module, idx) => (
                                    <RecommendationCard
                                        key={idx}
                                        module={module}
                                        onClick={() => handleModuleClick(module)}
                                    />
                                ))}
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {!recommendations && (
                        <div className="quick-moods">
                            {quickMoods.map((mood, idx) => (
                                <button
                                    key={idx}
                                    className="quick-mood-btn"
                                    onClick={() => handleQuickMood(mood.value)}
                                >
                                    {mood.label}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="chat-input-area">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Type how you're feeling..."
                            className="chat-input"
                        />
                        <button
                            className="send-btn"
                            onClick={handleSendMessage}
                            disabled={!input.trim()}
                        >
                            Send
                        </button>
                    </div>

                    {recommendations && (
                        <button
                            className="reset-chat-btn"
                            onClick={() => {
                                setMessages([{ text: "Hi there! 👋 How are you feeling now?", isUser: false }]);
                                setRecommendations(null);
                                setDetectedMood(null);
                            }}
                        >
                            Check in again
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
