import { useCallback, useEffect, useRef, useState } from "react";

// Symbol Hunter Game - Find specific symbols among distractors
function SymbolHunter({ exercise, onComplete, onExit }) {
    const [score, setScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(60);
    const [targetSymbol, setTargetSymbol] = useState("★");
    const [grid, setGrid] = useState([]);
    const [gameStarted, setGameStarted] = useState(false);
    const [found, setFound] = useState(0);
    const [total, setTotal] = useState(0);

    const { name = "Symbol Hunter", description = "Find specific symbols", adaptedFor = "Adult" } = exercise || {};

    let symbols = ["★", "●", "■", "▲", "◆", "♠", "♣", "♥", "♦", "○", "□", "△"];
    if (adaptedFor === "Toddler" || adaptedFor === "Child") {
        symbols = ["🧸", "🚗", "🍎", "🐶", "🎈", "🐥", "🚂", "🌈", "🦋", "🍄", "🍉", "🚁"];
    } else if (adaptedFor === "Teen") {
        symbols = ["∆", "Σ", "Ω", "∞", "√", "≈", "≠", "≤", "≥", "π", "µ", "∫"];
    } else if (adaptedFor === "Adult") {
        symbols = ["∰", "∞", "∑", "∆", "Ω", "µ", "Φ", "Ψ", "λ", "ξ", "ζ", "∇"];
    }

    const generateGrid = useCallback(() => {
        const target = symbols[Math.floor(Math.random() * symbols.length)];
        setTargetSymbol(target);

        const newGrid = [];
        let targetCount = 0;
        const targetPositions = Math.floor(Math.random() * 5) + 3; // 3-7 targets

        for (let i = 0; i < 36; i++) {
            if (targetCount < targetPositions && Math.random() < 0.2) {
                newGrid.push({ symbol: target, isTarget: true, id: i, found: false });
                targetCount++;
            } else {
                const otherSymbols = symbols.filter(s => s !== target);
                newGrid.push({
                    symbol: otherSymbols[Math.floor(Math.random() * otherSymbols.length)],
                    isTarget: false,
                    id: i,
                    found: false
                });
            }
        }

        // Ensure at least 3 targets
        while (targetCount < 3) {
            const randomIdx = Math.floor(Math.random() * 36);
            if (!newGrid[randomIdx].isTarget) {
                newGrid[randomIdx] = { symbol: target, isTarget: true, id: randomIdx, found: false };
                targetCount++;
            }
        }

        setTotal(targetCount);
        setFound(0);
        setGrid(newGrid);
    }, []);

    useEffect(() => {
        if (gameStarted && timeLeft > 0) {
            const timer = setTimeout(() => setTimeLeft(t => t - 1), 1000);
            return () => clearTimeout(timer);
        } else if (timeLeft === 0) {
            onComplete({ score, game: "Symbol Hunter" });
        }
    }, [timeLeft, gameStarted, score, onComplete]);

    const handleCellClick = (cell) => {
        if (!gameStarted || cell.found) return;

        if (cell.isTarget) {
            setScore(s => s + 10);
            setFound(f => f + 1);
            setGrid(g => g.map(c => c.id === cell.id ? { ...c, found: true } : c));

            // Check if all targets found
            const remainingTargets = grid.filter(c => c.isTarget && !c.found && c.id !== cell.id);
            if (remainingTargets.length === 0) {
                setScore(s => s + 50); // Bonus for completing
                generateGrid();
            }
        } else {
            setScore(s => Math.max(0, s - 5));
        }
    };

    const startGame = () => {
        setGameStarted(true);
        setScore(0);
        setTimeLeft(60);
        generateGrid();
    };

    if (!gameStarted) {
        let isKid = adaptedFor === "Toddler" || adaptedFor === "Child";
        return (
            <div className="game-intro">
                <h2>🔍 {name}</h2>
                <p>{description}</p>
                <div style={{ fontSize: "3rem", margin: "1rem 0" }}>{isKid ? "🧸" : "∰"}</div>
                <ul className="game-rules">
                    <li>✓ Find all the <span className="highlight-symbol">{targetSymbol}</span> symbols</li>
                    <li>✗ Wrong clicks lose points</li>
                    <li>⏱️ Find all symbols fast for bonus points</li>
                </ul>
                <div className="game-buttons">
                    <button className="start-game-btn" onClick={startGame}>Start Game</button>
                    <button className="exit-game-btn" onClick={onExit}>Back</button>
                </div>
            </div>
        );
    }

    return (
        <div className="symbol-hunter-game">
            <div className="game-header">
                <div className="game-stat">
                    <span className="stat-label">Find:</span>
                    <span className="target-symbol">{targetSymbol}</span>
                </div>
                <div className="game-stat">
                    <span className="stat-label">Found:</span>
                    <span className="stat-value">{found}/{total}</span>
                </div>
                <div className="game-stat">
                    <span className="stat-label">Score:</span>
                    <span className="stat-value">{score}</span>
                </div>
                <div className="game-stat timer">
                    <span className="stat-label">Time:</span>
                    <span className="stat-value">{timeLeft}s</span>
                </div>
            </div>

            <div className="symbol-grid">
                {grid.map((cell) => (
                    <button
                        key={cell.id}
                        className={`symbol-cell ${cell.found ? "found" : ""}`}
                        onClick={() => handleCellClick(cell)}
                        disabled={cell.found}
                    >
                        {cell.symbol}
                    </button>
                ))}
            </div>

            <button className="exit-game-btn" onClick={onExit}>Exit Game</button>
        </div>
    );
}

// Reaction Test Game - Tap circles as fast as possible
function ReactionTest({ exercise, onComplete, onExit }) {
    const { name = "Reaction Test", description = "Test your reaction speed" } = exercise || {};
    const [gameState, setGameState] = useState("intro"); // intro, waiting, ready, clicked, results
    const [reactionTimes, setReactionTimes] = useState([]);
    const [startTime, setStartTime] = useState(0);
    const [round, setRound] = useState(0);
    const [message, setMessage] = useState("");
    const timerRef = useRef(null);

    const startRound = useCallback(() => {
        setGameState("waiting");
        setMessage("Wait for green...");

        const delay = Math.random() * 3000 + 1500; // 1.5-4.5 seconds
        timerRef.current = setTimeout(() => {
            setGameState("ready");
            setStartTime(Date.now());
            setMessage("CLICK NOW!");
        }, delay);
    }, []);

    const handleClick = () => {
        if (gameState === "waiting") {
            clearTimeout(timerRef.current);
            setMessage("Too early! 🔴");
            setGameState("clicked");
            setTimeout(() => {
                if (round < 5) {
                    setRound(r => r + 1);
                    startRound();
                } else {
                    setGameState("results");
                }
            }, 1000);
        } else if (gameState === "ready") {
            const reactionTime = Date.now() - startTime;
            setReactionTimes(prev => [...prev, reactionTime]);
            setMessage(`${reactionTime}ms ⚡`);
            setGameState("clicked");

            setTimeout(() => {
                if (round < 4) {
                    setRound(r => r + 1);
                    startRound();
                } else {
                    setGameState("results");
                }
            }, 1500);
        }
    };

    const startGame = () => {
        setReactionTimes([]);
        setRound(0);
        startRound();
    };

    const getAverageTime = () => {
        if (reactionTimes.length === 0) return 0;
        return Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length);
    };

    const getScore = () => {
        const avg = getAverageTime();
        if (avg === 0) return 0;
        if (avg < 200) return 100;
        if (avg < 300) return 80;
        if (avg < 400) return 60;
        if (avg < 500) return 40;
        return 20;
    };

    if (gameState === "intro") {
        return (
            <div className="game-intro">
                <h2>⚡ {name}</h2>
                <p>{description}</p>
                <ul className="game-rules">
                    <li>🔴 Wait for the red circle</li>
                    <li>🟢 Click when it turns green</li>
                    <li>⚡ 5 rounds to measure your speed</li>
                </ul>
                <div className="game-buttons">
                    <button className="start-game-btn" onClick={startGame}>Start Game</button>
                    <button className="exit-game-btn" onClick={onExit}>Back</button>
                </div>
            </div>
        );
    }

    if (gameState === "results") {
        return (
            <div className="game-results">
                <h2>🏆 Results</h2>
                <div className="result-stats">
                    <div className="result-item">
                        <span className="result-label">Average Time</span>
                        <span className="result-value">{getAverageTime()}ms</span>
                    </div>
                    <div className="result-item">
                        <span className="result-label">Best Time</span>
                        <span className="result-value">{reactionTimes.length > 0 ? Math.min(...reactionTimes) : 0}ms</span>
                    </div>
                    <div className="result-item">
                        <span className="result-label">Score</span>
                        <span className="result-value">{getScore()} XP</span>
                    </div>
                </div>
                <div className="times-list">
                    {reactionTimes.map((time, i) => (
                        <span key={i} className="time-badge">{time}ms</span>
                    ))}
                </div>
                <div className="game-buttons">
                    <button className="start-game-btn" onClick={startGame}>Play Again</button>
                    <button className="complete-btn" onClick={() => onComplete({ score: getScore(), game: "Reaction Test" })}>
                        Complete (+{getScore()} XP)
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="reaction-game">
            <div className="game-header">
                <div className="game-stat">
                    <span className="stat-label">Round:</span>
                    <span className="stat-value">{round + 1}/5</span>
                </div>
            </div>

            <div
                className={`reaction-circle ${gameState}`}
                onClick={handleClick}
            >
                <span className="reaction-message">{message}</span>
            </div>

            <button className="exit-game-btn" onClick={onExit}>Exit Game</button>
        </div>
    );
}

// Distraction Dodge - Click targets while ignoring distractors
function DistractionDodge({ exercise, onComplete, onExit }) {
    const { name = "Distraction Dodge", description = "Click targets while ignoring distractors", adaptedFor = "Adult" } = exercise || {};
    const [score, setScore] = useState(0);
    const [lives, setLives] = useState(3);
    const [timeLeft, setTimeLeft] = useState(45);
    const [targets, setTargets] = useState([]);
    const [gameStarted, setGameStarted] = useState(false);
    const [gameOver, setGameOver] = useState(false);
    const targetIdRef = useRef(0);

    const spawnTarget = useCallback(() => {
        const isDistractor = Math.random() < 0.4;
        const newTarget = {
            id: targetIdRef.current++,
            x: Math.random() * 80 + 10,
            y: Math.random() * 70 + 10,
            isDistractor,
            type: isDistractor ? ["flash", "move", "pulse"][Math.floor(Math.random() * 3)] : "target"
        };
        setTargets(prev => [...prev, newTarget]);

        // Auto-remove after delay
        setTimeout(() => {
            setTargets(prev => prev.filter(t => t.id !== newTarget.id));
        }, isDistractor ? 2000 : 3000);
    }, []);

    useEffect(() => {
        if (gameStarted && !gameOver && timeLeft > 0) {
            const timer = setTimeout(() => setTimeLeft(t => t - 1), 1000);
            return () => clearTimeout(timer);
        } else if ((timeLeft === 0 || lives === 0) && gameStarted) {
            setGameOver(true);
        }
    }, [timeLeft, gameStarted, lives, gameOver]);

    useEffect(() => {
        if (gameStarted && !gameOver) {
            const spawner = setInterval(spawnTarget, 800);
            return () => clearInterval(spawner);
        }
    }, [gameStarted, gameOver, spawnTarget]);

    const handleTargetClick = (target) => {
        if (target.isDistractor) {
            setLives(l => l - 1);
            setScore(s => Math.max(0, s - 10));
        } else {
            setScore(s => s + 15);
        }
        setTargets(prev => prev.filter(t => t.id !== target.id));
    };

    const startGame = () => {
        setGameStarted(true);
        setScore(0);
        setLives(3);
        setTimeLeft(45);
        setTargets([]);
        setGameOver(false);
        targetIdRef.current = 0;
    };

    if (!gameStarted) {
        let isKid = adaptedFor === "Toddler" || adaptedFor === "Child";
        return (
            <div className="game-intro">
                <h2>🎯 {name}</h2>
                <p>{description}</p>
                <ul className="game-rules">
                    <li>🟢 Click {isKid ? "happy faces" : "green targets"} for points</li>
                    <li>🔴 Avoid clicking {isKid ? "silly monkeys" : "red distractors"}</li>
                    <li>❤️ You have 3 lives</li>
                </ul>
                <div className="game-buttons">
                    <button className="start-game-btn" onClick={startGame}>Start Game</button>
                    <button className="exit-game-btn" onClick={onExit}>Back</button>
                </div>
            </div>
        );
    }

    if (gameOver) {
        return (
            <div className="game-results">
                <h2>🏆 Game Over!</h2>
                <div className="result-stats">
                    <div className="result-item">
                        <span className="result-label">Final Score</span>
                        <span className="result-value">{score}</span>
                    </div>
                    <div className="result-item">
                        <span className="result-label">Lives Left</span>
                        <span className="result-value">{"❤️".repeat(lives)}</span>
                    </div>
                </div>
                <div className="game-buttons">
                    <button className="start-game-btn" onClick={startGame}>Play Again</button>
                    <button className="complete-btn" onClick={() => onComplete({ score, game: "Distraction Dodge" })}>
                        Complete (+{score} XP)
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="distraction-game">
            <div className="game-header">
                <div className="game-stat">
                    <span className="stat-label">Score:</span>
                    <span className="stat-value">{score}</span>
                </div>
                <div className="game-stat">
                    <span className="stat-label">Lives:</span>
                    <span className="stat-value">{"❤️".repeat(lives)}</span>
                </div>
                <div className="game-stat timer">
                    <span className="stat-label">Time:</span>
                    <span className="stat-value">{timeLeft}s</span>
                </div>
            </div>

            <div className="target-area">
                {targets.map((target) => (
                    <button
                        key={target.id}
                        className={`target-circle ${target.type}`}
                        style={{ left: `${target.x}%`, top: `${target.y}%` }}
                        onClick={() => handleTargetClick(target)}
                    />
                ))}
            </div>

            <button className="exit-game-btn" onClick={onExit}>Exit Game</button>
        </div>
    );
}

// New Game: Focus Tracking (Multiple Object Tracking)
function FocusTracking({ exercise, onComplete, onExit }) {
    const [score, setScore] = useState(0);
    const [phase, setPhase] = useState("intro"); // intro, tracking, answering, results
    const [objects, setObjects] = useState([]);
    const [targetIds, setTargetIds] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [level, setLevel] = useState(1);
    
    const { name = "Object Tracking", description = "Track moving targets", adaptedFor = "Adult" } = exercise || {};
    const isKid = adaptedFor === "Toddler" || adaptedFor === "Child";
    const objectSymbol = isKid ? "🦋" : "■";

    const generateObjects = useCallback(() => {
        const numObjects = Math.min(4 + level, 12);
        const numTargets = Math.min(2 + Math.floor(level / 2), 5);
        
        let newObjects = [];
        let newTargets = [];
        for (let i = 0; i < numObjects; i++) {
            newObjects.push({
                id: i,
                x: Math.random() * 80 + 10,
                y: Math.random() * 80 + 10,
                vx: (Math.random() - 0.5) * (level + 2) * 0.5,
                vy: (Math.random() - 0.5) * (level + 2) * 0.5,
            });
            if (i < numTargets) newTargets.push(i);
        }
        setObjects(newObjects);
        setTargetIds(newTargets);
        setSelectedIds([]);
        setPhase("highlighting");
        
        // After 2s, stop highlighting targets and start moving
        setTimeout(() => setPhase("tracking"), 2000);
    }, [level]);

    // Movement loop
    useEffect(() => {
        if (phase === "tracking") {
            const moveInterval = setInterval(() => {
                setObjects(prev => prev.map(obj => {
                    let { x, y, vx, vy } = obj;
                    x += vx;
                    y += vy;
                    if (x <= 5 || x >= 95) vx *= -1;
                    if (y <= 5 || y >= 95) vy *= -1;
                    return { ...obj, x, y, vx, vy };
                }));
            }, 50);
            
            // Stop moving after 5-8 seconds depending on level
            const trackTime = 4000 + level * 500;
            const stopTimer = setTimeout(() => setPhase("answering"), trackTime);
            
            return () => {
                clearInterval(moveInterval);
                clearTimeout(stopTimer);
            };
        }
    }, [phase, level]);

    const handleObjectClick = (id) => {
        if (phase !== "answering") return;
        
        if (selectedIds.includes(id)) {
            setSelectedIds(prev => prev.filter(i => i !== id));
        } else if (selectedIds.length < targetIds.length) {
            setSelectedIds(prev => [...prev, id]);
        }
    };

    const submitAnswer = () => {
        const correctPicks = selectedIds.filter(id => targetIds.includes(id)).length;
        const allCorrect = correctPicks === targetIds.length && selectedIds.length === targetIds.length;
        
        if (allCorrect) {
            setScore(s => s + targetIds.length * 15);
            setLevel(l => l + 1);
            generateObjects();
        } else {
            setPhase("results");
        }
    };

    const startGame = () => {
        setLevel(1);
        setScore(0);
        generateObjects();
    };

    if (phase === "intro") {
        return (
            <div className="game-intro">
                <h2>👀 {name}</h2>
                <p>{description}</p>
                <div style={{ fontSize: "3rem", margin: "1rem 0" }}>{objectSymbol}</div>
                <ul className="game-rules">
                    <li>🎯 First, watch the highlighted targets</li>
                    <li>🌀 Then follow them as they all move around</li>
                    <li>☝️ When they stop, click all the targets!</li>
                </ul>
                <div className="game-buttons">
                    <button className="start-game-btn" onClick={startGame}>Start Game</button>
                    <button className="exit-game-btn" onClick={onExit}>Back</button>
                </div>
            </div>
        );
    }

    if (phase === "results") {
        return (
            <div className="game-results">
                <h2>🏁 Tracking Complete!</h2>
                <div className="result-stats">
                    <div className="result-item">
                        <span className="result-label">Max Level</span>
                        <span className="result-value">{level}</span>
                    </div>
                    <div className="result-item">
                        <span className="result-label">Score</span>
                        <span className="result-value">{score} XP</span>
                    </div>
                </div>
                <div className="game-buttons">
                    <button className="start-game-btn" onClick={startGame}>Try Again</button>
                    <button className="complete-btn" onClick={() => onComplete({ score, game: "Focus Tracking" })}>
                        Complete (+{score} XP)
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="focus-tracking-game" style={{ position: "relative", width: "100%", height: "400px", background: "rgba(0,0,0,0.2)", borderRadius: "12px", overflow: "hidden" }}>
            <div className="game-header" style={{ position: "absolute", top: 10, left: 10, right: 10, zIndex: 10 }}>
                <div className="game-stat"><span className="stat-label">Level:</span><span className="stat-value">{level}</span></div>
                <div className="game-stat"><span className="stat-label">Score:</span><span className="stat-value">{score}</span></div>
                <div className="game-stat"><span className="phase">{phase === "tracking" ? "👀 Follow targets!" : phase === "answering" ? "☝️ Select targets" : ""}</span></div>
            </div>

            {objects.map(obj => {
                const isTarget = targetIds.includes(obj.id);
                const isSelected = selectedIds.includes(obj.id);
                const isHighlighting = phase === "highlighting" && isTarget;
                
                return (
                    <div
                        key={obj.id}
                        onClick={() => handleObjectClick(obj.id)}
                        style={{
                            position: "absolute",
                            left: `${obj.x}%`,
                            top: `${obj.y}%`,
                            transform: "translate(-50%, -50%)",
                            fontSize: "2rem",
                            cursor: phase === "answering" ? "pointer" : "default",
                            transition: phase === "tracking" ? "left 50ms linear, top 50ms linear" : "all 0.3s ease",
                            filter: isHighlighting ? "drop-shadow(0 0 10px #22c55e)" : "none",
                            color: isSelected ? "#22c55e" : isHighlighting ? "#22c55e" : "#fff",
                            opacity: (phase === "answering" && !isSelected) ? 0.7 : 1
                        }}
                    >
                        {objectSymbol}
                    </div>
                );
            })}

            {phase === "answering" && (
                <button 
                  className="start-game-btn" 
                  style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 10 }}
                  onClick={submitAnswer}
                  disabled={selectedIds.length !== targetIds.length}
                >
                    Submit ({selectedIds.length}/{targetIds.length})
                </button>
            )}
            <button className="exit-game-btn floating" onClick={onExit}>Exit</button>
        </div>
    );
}

// Main Focus Games Component
export default function FocusGames({ exerciseId, exercise, onComplete, onExit }) {
    const games = {
        "focus-symbols": SymbolHunter,
        "focus-reaction": ReactionTest,
        "focus-distraction": DistractionDodge,
        "focus-tracking": FocusTracking
    };

    const GameComponent = games[exerciseId] || SymbolHunter;

    return (
        <div className="focus-games-container">
            <GameComponent exercise={exercise} onComplete={onComplete} onExit={onExit} />
        </div>
    );
}
