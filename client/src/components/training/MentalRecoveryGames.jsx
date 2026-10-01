import { useEffect, useRef, useState } from "react";
import AlphaWavesMeditation from "./AlphaWavesMeditation";

// Guided Breathing Exercise
function GuidedBreathing({ onComplete, onExit }) {
    const [phase, setPhase] = useState("intro"); // intro, inhale, hold, exhale, complete
    const [breathCount, setBreathCount] = useState(0);
    const [timer, setTimer] = useState(4);
    const [isRunning, setIsRunning] = useState(false);
    const [totalBreaths] = useState(6);
    const [pattern] = useState({ inhale: 4, hold: 4, exhale: 4 });

    useEffect(() => {
        if (!isRunning) return;

        if (timer > 0) {
            const interval = setInterval(() => setTimer(t => t - 1), 1000);
            return () => clearInterval(interval);
        } else {
            // Transition to next phase
            if (phase === "inhale") {
                setPhase("hold");
                setTimer(pattern.hold);
            } else if (phase === "hold") {
                setPhase("exhale");
                setTimer(pattern.exhale);
            } else if (phase === "exhale") {
                const newCount = breathCount + 1;
                setBreathCount(newCount);
                if (newCount >= totalBreaths) {
                    setIsRunning(false);
                    setPhase("complete");
                } else {
                    setPhase("inhale");
                    setTimer(pattern.inhale);
                }
            }
        }
    }, [timer, phase, isRunning, breathCount, totalBreaths, pattern]);

    const startBreathing = () => {
        setBreathCount(0);
        setPhase("inhale");
        setTimer(pattern.inhale);
        setIsRunning(true);
    };

    const getInstruction = () => {
        switch (phase) {
            case "inhale": return "Breathe In";
            case "hold": return "Hold";
            case "exhale": return "Breathe Out";
            default: return "";
        }
    };

    const getCircleScale = () => {
        if (phase === "inhale") return 1 + (1 - timer / pattern.inhale) * 0.5;
        if (phase === "hold") return 1.5;
        if (phase === "exhale") return 1.5 - (1 - timer / pattern.exhale) * 0.5;
        return 1;
    };

    if (phase === "intro") {
        return (
            <div className="game-intro breathing-intro">
                <h2>🌬️ Guided Breathing</h2>
                <p>Calm your mind with controlled breathing. Follow the 4-4-4 pattern.</p>
                <ul className="game-rules">
                    <li>🌬️ Inhale for 4 seconds</li>
                    <li>⏸️ Hold for 4 seconds</li>
                    <li>💨 Exhale for 4 seconds</li>
                    <li>🔄 Repeat 6 times</li>
                </ul>
                <div className="game-buttons">
                    <button className="start-game-btn" onClick={startBreathing}>Begin</button>
                    <button className="exit-game-btn" onClick={onExit}>Back</button>
                </div>
            </div>
        );
    }

    if (phase === "complete") {
        return (
            <div className="game-results breathing-complete">
                <h2>🧘 Well Done!</h2>
                <p>You completed {totalBreaths} breathing cycles</p>
                <div className="breathing-benefits">
                    <p>Take a moment to notice how you feel. Your heart rate should be slower and your mind calmer.</p>
                </div>
                <div className="game-buttons">
                    <button className="start-game-btn" onClick={startBreathing}>Breathe Again</button>
                    <button className="complete-btn" onClick={() => onComplete({ score: 30, game: "Guided Breathing" })}>
                        Complete (+30 XP)
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="breathing-game">
            <div className="game-header">
                <div className="game-stat">
                    <span className="stat-label">Breath:</span>
                    <span className="stat-value">{breathCount + 1}/{totalBreaths}</span>
                </div>
            </div>

            <div className="breathing-container">
                <div
                    className={`breathing-circle ${phase}`}
                    style={{ transform: `scale(${getCircleScale()})` }}
                >
                    <span className="breath-timer">{timer}</span>
                </div>
                <p className="breath-instruction">{getInstruction()}</p>
            </div>

            <div className="progress-dots">
                {Array.from({ length: totalBreaths }).map((_, i) => (
                    <span key={i} className={`dot ${i < breathCount ? "complete" : i === breathCount ? "active" : ""}`} />
                ))}
            </div>

            <button className="exit-game-btn" onClick={onExit}>Exit</button>
        </div>
    );
}

// Mindful Moment - Focus on calming visuals
function MindfulMoment({ onComplete, onExit }) {
    const [phase, setPhase] = useState("intro");
    const [timeLeft, setTimeLeft] = useState(120); // 2 minutes
    const [particles, setParticles] = useState([]);
    const containerRef = useRef(null);

    useEffect(() => {
        if (phase === "active" && timeLeft > 0) {
            const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
            return () => clearInterval(timer);
        } else if (timeLeft === 0 && phase === "active") {
            setPhase("complete");
        }
    }, [timeLeft, phase]);

    useEffect(() => {
        if (phase === "active") {
            const createParticle = () => {
                const newParticle = {
                    id: Date.now() + Math.random(),
                    x: Math.random() * 100,
                    y: 100 + Math.random() * 20,
                    size: Math.random() * 8 + 4,
                    duration: Math.random() * 3 + 4,
                    delay: Math.random() * 2
                };
                setParticles(prev => [...prev.slice(-15), newParticle]);
            };

            const interval = setInterval(createParticle, 500);
            return () => clearInterval(interval);
        }
    }, [phase]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    if (phase === "intro") {
        return (
            <div className="game-intro mindful-intro">
                <h2>🌸 Mindful Moment</h2>
                <p>Take 2 minutes to focus on the present. Watch the peaceful particles float by.</p>
                <ul className="game-rules">
                    <li>👀 Keep your eyes on the screen</li>
                    <li>🌬️ Breathe naturally</li>
                    <li>🧠 Let thoughts pass without judgment</li>
                    <li>✨ Focus on the gentle movement</li>
                </ul>
                <div className="game-buttons">
                    <button className="start-game-btn" onClick={() => setPhase("active")}>Begin</button>
                    <button className="exit-game-btn" onClick={onExit}>Back</button>
                </div>
            </div>
        );
    }

    if (phase === "complete") {
        return (
            <div className="game-results mindful-complete">
                <h2>🌟 Beautiful!</h2>
                <p>You've completed a mindful moment.</p>
                <div className="mindful-message">
                    <p>"In the present moment, you can find peace."</p>
                </div>
                <div className="game-buttons">
                    <button className="start-game-btn" onClick={() => { setPhase("active"); setTimeLeft(120); }}>
                        Another Moment
                    </button>
                    <button className="complete-btn" onClick={() => onComplete({ score: 40, game: "Mindful Moment" })}>
                        Complete (+40 XP)
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="mindful-game" ref={containerRef}>
            <div className="mindful-timer">{formatTime(timeLeft)}</div>

            <div className="particle-container">
                {particles.map((particle) => (
                    <div
                        key={particle.id}
                        className="mindful-particle"
                        style={{
                            left: `${particle.x}%`,
                            bottom: `${particle.y}%`,
                            width: particle.size,
                            height: particle.size,
                            animationDuration: `${particle.duration}s`,
                            animationDelay: `${particle.delay}s`
                        }}
                    />
                ))}
            </div>

            <p className="mindful-text">focus on the present moment</p>

            <button className="exit-game-btn floating" onClick={onExit}>Exit</button>
        </div>
    );
}

// Body Scan - Progressive relaxation
function BodyScan({ onComplete, onExit }) {
    const [phase, setPhase] = useState("intro");
    const [currentPart, setCurrentPart] = useState(0);
    const [timer, setTimer] = useState(10);

    const bodyParts = [
        { name: "Head & Face", instruction: "Release tension in your forehead, jaw, and eyes", icon: "😌" },
        { name: "Neck & Shoulders", instruction: "Let your shoulders drop and relax your neck", icon: "💆" },
        { name: "Arms & Hands", instruction: "Feel the weight of your arms, relax your fingers", icon: "🤲" },
        { name: "Chest & Back", instruction: "Breathe deeply, feel your chest expand", icon: "🫁" },
        { name: "Stomach", instruction: "Let go of any tension in your core", icon: "🌀" },
        { name: "Legs & Feet", instruction: "Feel grounded, relax from hips to toes", icon: "🦶" }
    ];

    useEffect(() => {
        if (phase === "scanning" && timer > 0) {
            const interval = setInterval(() => setTimer(t => t - 1), 1000);
            return () => clearInterval(interval);
        } else if (timer === 0 && phase === "scanning") {
            if (currentPart < bodyParts.length - 1) {
                setCurrentPart(c => c + 1);
                setTimer(10);
            } else {
                setPhase("complete");
            }
        }
    }, [timer, phase, currentPart, bodyParts.length]);

    const startScan = () => {
        setCurrentPart(0);
        setTimer(10);
        setPhase("scanning");
    };

    if (phase === "intro") {
        return (
            <div className="game-intro body-scan-intro">
                <h2>🧘 Body Scan</h2>
                <p>A progressive relaxation exercise to release tension throughout your body.</p>
                <ul className="game-rules">
                    <li>🪑 Sit or lie comfortably</li>
                    <li>👀 Close your eyes if comfortable</li>
                    <li>🌬️ Breathe slowly and deeply</li>
                    <li>⏱️ Each section takes 10 seconds</li>
                </ul>
                <div className="game-buttons">
                    <button className="start-game-btn" onClick={startScan}>Begin Scan</button>
                    <button className="exit-game-btn" onClick={onExit}>Back</button>
                </div>
            </div>
        );
    }

    if (phase === "complete") {
        return (
            <div className="game-results body-scan-complete">
                <h2>✨ Fully Relaxed</h2>
                <p>You've completed a full body scan.</p>
                <div className="relaxation-message">
                    <p>Notice how your body feels now compared to before. This calm state can help you focus better.</p>
                </div>
                <div className="game-buttons">
                    <button className="start-game-btn" onClick={startScan}>Scan Again</button>
                    <button className="complete-btn" onClick={() => onComplete({ score: 35, game: "Body Scan" })}>
                        Complete (+35 XP)
                    </button>
                </div>
            </div>
        );
    }

    const part = bodyParts[currentPart];

    return (
        <div className="body-scan-game">
            <div className="game-header">
                <div className="game-stat">
                    <span className="stat-label">Part:</span>
                    <span className="stat-value">{currentPart + 1}/{bodyParts.length}</span>
                </div>
            </div>

            <div className="body-visualization">
                <div className="body-outline">
                    {bodyParts.map((p, i) => (
                        <div
                            key={i}
                            className={`body-part part-${i} ${i === currentPart ? "active" : i < currentPart ? "done" : ""}`}
                        />
                    ))}
                </div>
            </div>

            <div className="scan-content">
                <span className="scan-icon">{part.icon}</span>
                <h3>{part.name}</h3>
                <p>{part.instruction}</p>
                <div className="scan-timer">
                    <div className="timer-bar" style={{ width: `${timer * 10}%` }} />
                </div>
            </div>

            <div className="progress-bar">
                {bodyParts.map((_, i) => (
                    <span key={i} className={`bar-segment ${i <= currentPart ? "active" : ""}`} />
                ))}
            </div>

            <button className="exit-game-btn" onClick={onExit}>Exit</button>
        </div>
    );
}

// Main Mental Recovery Component
export default function MentalRecoveryGames({ exerciseId, onComplete, onExit }) {
    const games = {
        "relax-breath": GuidedBreathing,
        "relax-mindful": MindfulMoment,
        "relax-body": BodyScan,
        "relax-alpha": AlphaWavesMeditation
    };

    const GameComponent = games[exerciseId] || GuidedBreathing;

    return (
        <div className="mental-recovery-container">
            <GameComponent onComplete={onComplete} onExit={onExit} />
        </div>
    );
}
