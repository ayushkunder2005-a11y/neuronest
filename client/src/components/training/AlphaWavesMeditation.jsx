import { useEffect, useRef, useState } from "react";

// Alpha Waves Meditation - Binaural beats for relaxation
export default function AlphaWavesMeditation({ onComplete, onExit }) {
    const [phase, setPhase] = useState("intro"); // intro, playing, complete
    const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
    const [volume, setVolume] = useState(0.5);
    const [particles, setParticles] = useState([]);
    const audioContextRef = useRef(null);
    const oscillatorsRef = useRef([]);
    const gainNodeRef = useRef(null);

    // Generate alpha wave binaural beats using Web Audio API
    const startAudio = () => {
        try {
            // Use user-provided MP3 file instead of synth
            const audio = new Audio("/audio/alpha-waves.mp3");
            audio.loop = true;
            audio.volume = volume;
            
            // Play the audio (must be triggered by user interaction)
            audio.play().catch(e => console.error("Audio playback failed (file might be missing):", e));
            
            audioContextRef.current = audio;
        } catch (error) {
            console.error("Audio context error:", error);
        }
    };

    const stopAudio = () => {
        if (audioContextRef.current) {
            try {
                audioContextRef.current.pause();
                audioContextRef.current.currentTime = 0;
            } catch (e) {
                console.error("Error stopping audio", e);
            }
        }
    };

    // Update volume
    useEffect(() => {
        if (audioContextRef.current) {
            audioContextRef.current.volume = volume;
        }
    }, [volume]);

    // Timer effect
    useEffect(() => {
        if (phase === "playing" && timeLeft > 0) {
            const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
            return () => clearInterval(timer);
        } else if (timeLeft === 0 && phase === "playing") {
            stopAudio();
            setPhase("complete");
        }
    }, [timeLeft, phase]);

    // Particle animation
    useEffect(() => {
        if (phase === "playing") {
            const createParticle = () => {
                const newParticle = {
                    id: Date.now() + Math.random(),
                    x: Math.random() * 100,
                    y: Math.random() * 100,
                    size: Math.random() * 6 + 2,
                    duration: Math.random() * 4 + 3,
                    delay: Math.random() * 2
                };
                setParticles(prev => [...prev.slice(-20), newParticle]);
            };

            const interval = setInterval(createParticle, 800);
            return () => clearInterval(interval);
        }
    }, [phase]);

    // Cleanup on unmount
    useEffect(() => {
        return () => stopAudio();
    }, []);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const startMeditation = () => {
        setPhase("playing");
        startAudio();
    };

    const handleExit = () => {
        stopAudio();
        onExit();
    };

    if (phase === "intro") {
        return (
            <div className="game-intro alpha-waves-intro">
                <h2>🌊 Alpha Waves Meditation</h2>
                <p>Relax with soothing binaural beats designed to calm your mind and reduce stress.</p>
                <ul className="game-rules">
                    <li>🎧 Best experienced with headphones</li>
                    <li>🌀 Focus on the calming visuals</li>
                    <li>🧘 Let go of your thoughts</li>
                    <li>⏱️ 5-minute guided session</li>
                </ul>
                <div className="alpha-info">
                    <p><strong>What are Alpha Waves?</strong></p>
                    <p>Alpha waves (8-12 Hz) are brain waves associated with relaxation, reduced anxiety, and a calm, meditative state.</p>
                </div>
                <div className="game-buttons">
                    <button className="start-game-btn" onClick={startMeditation}>Begin Meditation</button>
                    <button className="exit-game-btn" onClick={onExit}>Back</button>
                </div>
            </div>
        );
    }

    if (phase === "complete") {
        return (
            <div className="game-results alpha-complete">
                <h2>🧘 Deeply Relaxed</h2>
                <p>You've completed your alpha waves meditation session.</p>
                <div className="alpha-message">
                    <p>"A calm mind brings inner strength and self-confidence."</p>
                    <span>— Dalai Lama</span>
                </div>
                <div className="game-buttons">
                    <button className="start-game-btn" onClick={() => { setTimeLeft(300); startMeditation(); }}>
                        Meditate Again
                    </button>
                    <button className="complete-btn" onClick={() => onComplete({ score: 50, game: "Alpha Waves Meditation" })}>
                        Complete (+50 XP)
                    </button>
                </div>
            </div>
        );
    }

    // Playing state
    return (
        <div className="alpha-waves-game">
            <div className="alpha-timer">{formatTime(timeLeft)}</div>

            <div className="alpha-visual-container">
                {/* Pulsing orb */}
                <div className="alpha-orb">
                    <div className="orb-core"></div>
                    <div className="orb-glow"></div>
                    <div className="orb-ring ring-1"></div>
                    <div className="orb-ring ring-2"></div>
                    <div className="orb-ring ring-3"></div>
                </div>

                {/* Floating particles */}
                {particles.map((particle) => (
                    <div
                        key={particle.id}
                        className="alpha-particle"
                        style={{
                            left: `${particle.x}%`,
                            top: `${particle.y}%`,
                            width: particle.size,
                            height: particle.size,
                            animationDuration: `${particle.duration}s`,
                            animationDelay: `${particle.delay}s`
                        }}
                    />
                ))}
            </div>

            <p className="alpha-text">let your mind be still...</p>

            <div className="alpha-controls">
                <div className="volume-control">
                    <span className="volume-icon">🔊</span>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={volume}
                        onChange={(e) => setVolume(parseFloat(e.target.value))}
                        className="volume-slider"
                    />
                </div>
            </div>

            <button className="exit-game-btn floating" onClick={handleExit}>Exit</button>
        </div>
    );
}
