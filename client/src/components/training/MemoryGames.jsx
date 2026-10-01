import { useCallback, useEffect, useState } from "react";

// Card Match Game - Classic memory matching
function CardMatch({ onComplete, onExit }) {
    const [cards, setCards] = useState([]);
    const [flipped, setFlipped] = useState([]);
    const [matched, setMatched] = useState([]);
    const [moves, setMoves] = useState(0);
    const [gameStarted, setGameStarted] = useState(false);
    const [timeElapsed, setTimeElapsed] = useState(0);

    const cardEmojis = ["🍎", "🍊", "🍋", "🍇", "🍓", "🍒", "🥝", "🍑"];

    const initializeGame = useCallback(() => {
        const shuffled = [...cardEmojis, ...cardEmojis]
            .sort(() => Math.random() - 0.5)
            .map((emoji, index) => ({ id: index, emoji, isMatched: false }));
        setCards(shuffled);
        setFlipped([]);
        setMatched([]);
        setMoves(0);
        setTimeElapsed(0);
        setGameStarted(true);
    }, []);

    useEffect(() => {
        if (gameStarted && matched.length < cards.length) {
            const timer = setInterval(() => setTimeElapsed(t => t + 1), 1000);
            return () => clearInterval(timer);
        }
    }, [gameStarted, matched.length, cards.length]);

    useEffect(() => {
        if (flipped.length === 2) {
            setMoves(m => m + 1);
            const [first, second] = flipped;

            if (cards[first].emoji === cards[second].emoji) {
                setMatched(prev => [...prev, first, second]);
                setFlipped([]);
            } else {
                setTimeout(() => setFlipped([]), 1000);
            }
        }
    }, [flipped, cards]);

    const handleCardClick = (index) => {
        if (flipped.length === 2 || flipped.includes(index) || matched.includes(index)) {
            return;
        }
        setFlipped(prev => [...prev, index]);
    };

    const getScore = () => {
        const baseScore = matched.length * 5;
        const movesPenalty = Math.max(0, moves - 8) * 2;
        const timePenalty = Math.floor(timeElapsed / 10);
        return Math.max(10, baseScore - movesPenalty - timePenalty);
    };

    const isComplete = matched.length === cards.length && cards.length > 0;

    if (!gameStarted) {
        return (
            <div className="game-intro">
                <h2>🎴 Card Match</h2>
                <p>Find matching pairs of cards! Test your visual memory.</p>
                <ul className="game-rules">
                    <li>🔄 Flip two cards at a time</li>
                    <li>🎯 Remember positions to find matches</li>
                    <li>⚡ Fewer moves = higher score</li>
                </ul>
                <div className="game-buttons">
                    <button className="start-game-btn" onClick={initializeGame}>Start Game</button>
                    <button className="exit-game-btn" onClick={onExit}>Back</button>
                </div>
            </div>
        );
    }

    if (isComplete) {
        return (
            <div className="game-results">
                <h2>🎉 Congratulations!</h2>
                <div className="result-stats">
                    <div className="result-item">
                        <span className="result-label">Moves</span>
                        <span className="result-value">{moves}</span>
                    </div>
                    <div className="result-item">
                        <span className="result-label">Time</span>
                        <span className="result-value">{timeElapsed}s</span>
                    </div>
                    <div className="result-item">
                        <span className="result-label">Score</span>
                        <span className="result-value">{getScore()} XP</span>
                    </div>
                </div>
                <div className="game-buttons">
                    <button className="start-game-btn" onClick={initializeGame}>Play Again</button>
                    <button className="complete-btn" onClick={() => onComplete({ score: getScore(), game: "Card Match" })}>
                        Complete (+{getScore()} XP)
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="card-match-game">
            <div className="game-header">
                <div className="game-stat">
                    <span className="stat-label">Moves:</span>
                    <span className="stat-value">{moves}</span>
                </div>
                <div className="game-stat">
                    <span className="stat-label">Matched:</span>
                    <span className="stat-value">{matched.length / 2}/{cards.length / 2}</span>
                </div>
                <div className="game-stat timer">
                    <span className="stat-label">Time:</span>
                    <span className="stat-value">{timeElapsed}s</span>
                </div>
            </div>

            <div className="card-grid">
                {cards.map((card, index) => (
                    <button
                        key={card.id}
                        className={`memory-card ${flipped.includes(index) || matched.includes(index) ? "flipped" : ""}`}
                        onClick={() => handleCardClick(index)}
                        disabled={matched.includes(index)}
                    >
                        <span className="card-front">?</span>
                        <span className="card-back">{card.emoji}</span>
                    </button>
                ))}
            </div>

            <button className="exit-game-btn" onClick={onExit}>Exit Game</button>
        </div>
    );
}

// Sequence Recall - Remember and reproduce sequences
function SequenceRecall({ onComplete, onExit }) {
    const [sequence, setSequence] = useState([]);
    const [playerSequence, setPlayerSequence] = useState([]);
    const [level, setLevel] = useState(1);
    const [phase, setPhase] = useState("intro"); // intro, showing, input, success, fail
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [score, setScore] = useState(0);

    const colors = [
        { id: 0, color: "#ef4444", name: "Red" },
        { id: 1, color: "#22c55e", name: "Green" },
        { id: 2, color: "#3b82f6", name: "Blue" },
        { id: 3, color: "#eab308", name: "Yellow" }
    ];

    const generateSequence = useCallback((length) => {
        return Array.from({ length }, () => Math.floor(Math.random() * 4));
    }, []);

    const showSequence = useCallback(async (seq) => {
        setPhase("showing");
        for (let i = 0; i < seq.length; i++) {
            await new Promise(r => setTimeout(r, 600));
            setHighlightedIndex(seq[i]);
            await new Promise(r => setTimeout(r, 400));
            setHighlightedIndex(-1);
        }
        await new Promise(r => setTimeout(r, 300));
        setPhase("input");
        setPlayerSequence([]);
    }, []);

    const startLevel = useCallback(() => {
        const newSeq = generateSequence(level + 2);
        setSequence(newSeq);
        showSequence(newSeq);
    }, [level, generateSequence, showSequence]);

    const handleColorClick = (colorId) => {
        if (phase !== "input") return;

        const newPlayerSeq = [...playerSequence, colorId];
        setPlayerSequence(newPlayerSeq);
        setHighlightedIndex(colorId);
        setTimeout(() => setHighlightedIndex(-1), 200);

        if (newPlayerSeq[newPlayerSeq.length - 1] !== sequence[newPlayerSeq.length - 1]) {
            setPhase("fail");
            return;
        }

        if (newPlayerSeq.length === sequence.length) {
            setScore(s => s + level * 10);
            setPhase("success");
        }
    };

    const nextLevel = () => {
        setLevel(l => l + 1);
        startLevel();
    };

    const startGame = () => {
        setLevel(1);
        setScore(0);
        startLevel();
    };

    if (phase === "intro") {
        return (
            <div className="game-intro">
                <h2>🔢 Sequence Recall</h2>
                <p>Watch the color sequence and repeat it back!</p>
                <ul className="game-rules">
                    <li>👀 Watch the colors light up</li>
                    <li>🎯 Click them in the same order</li>
                    <li>📈 Sequences get longer each level</li>
                </ul>
                <div className="game-buttons">
                    <button className="start-game-btn" onClick={startGame}>Start Game</button>
                    <button className="exit-game-btn" onClick={onExit}>Back</button>
                </div>
            </div>
        );
    }

    if (phase === "success") {
        return (
            <div className="game-results level-up">
                <h2>✨ Level Complete!</h2>
                <p>You remembered {sequence.length} colors!</p>
                <div className="game-buttons">
                    <button className="start-game-btn" onClick={nextLevel}>Next Level</button>
                    <button className="complete-btn" onClick={() => onComplete({ score, game: "Sequence Recall" })}>
                        Finish (+{score} XP)
                    </button>
                </div>
            </div>
        );
    }

    if (phase === "fail") {
        return (
            <div className="game-results">
                <h2>😅 Oops!</h2>
                <p>You reached Level {level} with sequence length {sequence.length}</p>
                <div className="result-stats">
                    <div className="result-item">
                        <span className="result-label">Final Level</span>
                        <span className="result-value">{level}</span>
                    </div>
                    <div className="result-item">
                        <span className="result-label">Score</span>
                        <span className="result-value">{score} XP</span>
                    </div>
                </div>
                <div className="game-buttons">
                    <button className="start-game-btn" onClick={startGame}>Try Again</button>
                    <button className="complete-btn" onClick={() => onComplete({ score, game: "Sequence Recall" })}>
                        Complete (+{score} XP)
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="sequence-game">
            <div className="game-header">
                <div className="game-stat">
                    <span className="stat-label">Level:</span>
                    <span className="stat-value">{level}</span>
                </div>
                <div className="game-stat">
                    <span className="stat-label">Sequence:</span>
                    <span className="stat-value">{sequence.length} colors</span>
                </div>
                <div className="game-stat">
                    <span className="stat-label">Score:</span>
                    <span className="stat-value">{score}</span>
                </div>
            </div>

            <div className="phase-indicator">
                {phase === "showing" ? "👀 Watch carefully..." : `🎯 Your turn! (${playerSequence.length}/${sequence.length})`}
            </div>

            <div className="color-buttons">
                {colors.map((color) => (
                    <button
                        key={color.id}
                        className={`color-btn ${highlightedIndex === color.id ? "highlighted" : ""}`}
                        style={{ backgroundColor: color.color }}
                        onClick={() => handleColorClick(color.id)}
                        disabled={phase !== "input"}
                    />
                ))}
            </div>

            <button className="exit-game-btn" onClick={onExit}>Exit Game</button>
        </div>
    );
}

// Pattern Memory - Remember grid patterns
function PatternMemory({ onComplete, onExit }) {
    const [pattern, setPattern] = useState([]);
    const [playerPattern, setPlayerPattern] = useState([]);
    const [phase, setPhase] = useState("intro"); // intro, showing, input, result
    const [level, setLevel] = useState(1);
    const [score, setScore] = useState(0);
    const gridSize = 16; // 4x4

    const generatePattern = useCallback((count) => {
        const cells = [];
        while (cells.length < count) {
            const cell = Math.floor(Math.random() * gridSize);
            if (!cells.includes(cell)) cells.push(cell);
        }
        return cells;
    }, []);

    const startLevel = useCallback(() => {
        const count = Math.min(level + 2, 10);
        const newPattern = generatePattern(count);
        setPattern(newPattern);
        setPlayerPattern([]);
        setPhase("showing");

        setTimeout(() => {
            setPhase("input");
        }, 2000 + level * 200);
    }, [level, generatePattern]);

    const handleCellClick = (index) => {
        if (phase !== "input") return;

        if (playerPattern.includes(index)) {
            setPlayerPattern(prev => prev.filter(p => p !== index));
        } else {
            setPlayerPattern(prev => [...prev, index]);
        }
    };

    const checkAnswer = () => {
        const correct = pattern.every(p => playerPattern.includes(p)) &&
            playerPattern.every(p => pattern.includes(p));

        if (correct) {
            setScore(s => s + level * 15);
            setLevel(l => l + 1);
        }
        setPhase("result");
    };

    const startGame = () => {
        setLevel(1);
        setScore(0);
        startLevel();
    };

    if (phase === "intro") {
        return (
            <div className="game-intro">
                <h2>🔲 Pattern Memory</h2>
                <p>Memorize the highlighted cells and recreate the pattern!</p>
                <ul className="game-rules">
                    <li>👀 Watch the pattern appear</li>
                    <li>🎯 Click cells to recreate it</li>
                    <li>✓ Hit Submit when ready</li>
                </ul>
                <div className="game-buttons">
                    <button className="start-game-btn" onClick={startGame}>Start Game</button>
                    <button className="exit-game-btn" onClick={onExit}>Back</button>
                </div>
            </div>
        );
    }

    if (phase === "result") {
        const correct = pattern.every(p => playerPattern.includes(p)) &&
            playerPattern.every(p => pattern.includes(p));

        return (
            <div className="game-results">
                <h2>{correct ? "✨ Perfect!" : "😅 Not quite!"}</h2>
                <p>You remembered {pattern.filter(p => playerPattern.includes(p)).length}/{pattern.length} cells</p>
                <div className="result-stats">
                    <div className="result-item">
                        <span className="result-label">Level</span>
                        <span className="result-value">{level}</span>
                    </div>
                    <div className="result-item">
                        <span className="result-label">Score</span>
                        <span className="result-value">{score} XP</span>
                    </div>
                </div>
                <div className="game-buttons">
                    {correct ? (
                        <button className="start-game-btn" onClick={startLevel}>Next Level</button>
                    ) : (
                        <button className="start-game-btn" onClick={startGame}>Try Again</button>
                    )}
                    <button className="complete-btn" onClick={() => onComplete({ score, game: "Pattern Memory" })}>
                        Complete (+{score} XP)
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="pattern-game">
            <div className="game-header">
                <div className="game-stat">
                    <span className="stat-label">Level:</span>
                    <span className="stat-value">{level}</span>
                </div>
                <div className="game-stat">
                    <span className="stat-label">Cells:</span>
                    <span className="stat-value">{pattern.length}</span>
                </div>
                <div className="game-stat">
                    <span className="stat-label">Score:</span>
                    <span className="stat-value">{score}</span>
                </div>
            </div>

            <div className="phase-indicator">
                {phase === "showing" ? "👀 Memorize the pattern..." : "🎯 Recreate the pattern!"}
            </div>

            <div className="pattern-grid">
                {Array.from({ length: gridSize }).map((_, i) => (
                    <button
                        key={i}
                        className={`pattern-cell ${phase === "showing" && pattern.includes(i) ? "shown" : ""
                            } ${phase === "input" && playerPattern.includes(i) ? "selected" : ""}`}
                        onClick={() => handleCellClick(i)}
                        disabled={phase !== "input"}
                    />
                ))}
            </div>

            {phase === "input" && (
                <button className="submit-btn" onClick={checkAnswer}>
                    Submit ({playerPattern.length} selected)
                </button>
            )}

            <button className="exit-game-btn" onClick={onExit}>Exit Game</button>
        </div>
    );
}

// Main Memory Games Component
export default function MemoryGames({ exerciseId, onComplete, onExit }) {
    const games = {
        "memory-cards": CardMatch,
        "memory-sequence": SequenceRecall,
        "memory-pattern": PatternMemory
    };

    const GameComponent = games[exerciseId] || CardMatch;

    return (
        <div className="memory-games-container">
            <GameComponent onComplete={onComplete} onExit={onExit} />
        </div>
    );
}
