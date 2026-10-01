import { useState, useEffect } from "react";

// Fetch dynamic puzzles from Ollama AI Server
const fetchDynamicPuzzles = async (gameType, ageGroup, fallbackPuzzles) => {
    try {
        const response = await fetch("http://localhost:8000/api/training/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // default level to 3 for now, or could be dynamic based on user XP
            body: JSON.stringify({ game_type: gameType, level: 3, age_group: ageGroup })
        });
        const data = await response.json();
        if (data.success && data.puzzles && data.puzzles.length > 0) {
            return data.puzzles;
        }
    } catch (e) {
        console.error("AI Gen Failed:", e);
    }
    return fallbackPuzzles;
};

// Pattern Finder - Find the next in sequence
function PatternFinder({ exercise, onComplete, onExit }) {
    const { name = "Pattern Finder", description = "Find what comes next in sequence", adaptedFor = "Adult" } = exercise || {};
    const [currentPuzzle, setCurrentPuzzle] = useState(0);
    const [score, setScore] = useState(0);
    const [showResult, setShowResult] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    const [gameStarted, setGameStarted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const fallbackPuzzles = [
        { sequence: ["2", "4", "6", "8", "?"], options: ["9", "10", "12", "14"], correct: "10", explanation: "Add 2 to each number" }
    ];
    const [puzzles, setPuzzles] = useState(fallbackPuzzles);

    const handleStart = async () => {
        setIsLoading(true);
        const dynamicPuzzles = await fetchDynamicPuzzles("Pattern Finder", adaptedFor, fallbackPuzzles);
        setPuzzles(dynamicPuzzles);
        setIsLoading(false);
        setGameStarted(true);
        setCurrentPuzzle(0);
        setScore(0);
        setShowResult(false);
    };

    const handleAnswer = (answer) => {
        const puzzle = puzzles[currentPuzzle];
        const correct = String(answer) === String(puzzle.correct);
        setIsCorrect(correct);
        if (correct) setScore(s => s + 20);
        setShowResult(true);
    };

    const nextPuzzle = () => {
        setShowResult(false);
        if (currentPuzzle < puzzles.length - 1) {
            setCurrentPuzzle(c => c + 1);
        }
    };

    if (isLoading) {
        return (
            <div className="game-intro">
                <h2>🔍 Generating AI Puzzles...</h2>
                <div style={{ margin: "20px 0", fontStyle: "italic", color: "#8b5cf6" }}>Crafting unique patterns...</div>
                <p>Ollama 120B is analyzing sequences for you.</p>
            </div>
        );
    }

    if (!gameStarted) {
        return (
            <div className="game-intro">
                <h2>🔍 {name} (AI Powered)</h2>
                <p>{description}</p>
                <ul className="game-rules">
                    <li>👀 Analyze the unique pattern</li>
                    <li>🎯 Select the correct answer</li>
                    <li>📈 Dynamic puzzles to solve</li>
                </ul>
                <div className="game-buttons">
                    <button className="start-game-btn" onClick={handleStart}>Start Game</button>
                    <button className="exit-game-btn" onClick={onExit}>Back</button>
                </div>
            </div>
        );
    }

    if (currentPuzzle >= puzzles.length - 1 && showResult) {
        return (
            <div className="game-results">
                <h2>🏆 Complete!</h2>
                <div className="result-stats">
                    <div className="result-item">
                        <span className="result-label">Puzzles Solved</span>
                        <span className="result-value">{puzzles.length}</span>
                    </div>
                    <div className="result-item">
                        <span className="result-label">Score</span>
                        <span className="result-value">{score} XP</span>
                    </div>
                </div>
                <div className="game-buttons">
                    <button className="start-game-btn" onClick={handleStart}>
                        Play Again (New AI Puzzles)
                    </button>
                    <button className="complete-btn" onClick={() => onComplete({ score, game: "Pattern Finder" })}>
                        Complete (+{score} XP)
                    </button>
                </div>
            </div>
        );
    }

    const puzzle = puzzles[currentPuzzle];

    return (
        <div className="pattern-finder-game">
            <div className="game-header">
                <div className="game-stat">
                    <span className="stat-label">Puzzle:</span>
                    <span className="stat-value">{currentPuzzle + 1}/{puzzles.length}</span>
                </div>
                <div className="game-stat">
                    <span className="stat-label">Score:</span>
                    <span className="stat-value">{score}</span>
                </div>
            </div>

            <div className="puzzle-sequence">
                {puzzle.sequence.map((item, i) => (
                    <span key={i} className={`sequence-item ${item === "?" ? "question" : ""}`}>
                        {item}
                    </span>
                ))}
            </div>

            {showResult ? (
                <div className={`result-feedback ${isCorrect ? "correct" : "wrong"}`}>
                    <h3>{isCorrect ? "✅ Correct!" : "❌ Not quite"}</h3>
                    <p>{puzzle.explanation}</p>
                    <button className="next-btn" onClick={nextPuzzle}>Next Puzzle</button>
                </div>
            ) : (
                <div className="puzzle-options">
                    {puzzle.options.map((option, i) => (
                        <button key={i} className="option-btn" onClick={() => handleAnswer(option)}>
                            {option}
                        </button>
                    ))}
                </div>
            )}

            <button className="exit-game-btn" onClick={onExit}>Exit Game</button>
        </div>
    );
}

// Logic Puzzle - If-then reasoning
function LogicPuzzle({ exercise, onComplete, onExit }) {
    const { name = "Logic Puzzle", description = "Solve logical problems", adaptedFor = "Adult" } = exercise || {};
    const [currentPuzzle, setCurrentPuzzle] = useState(0);
    const [score, setScore] = useState(0);
    const [showResult, setShowResult] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    const [gameStarted, setGameStarted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const fallbackPuzzles = [
        {
            statement: "All cats are animals. Tom is a cat.",
            question: "What can we conclude about Tom?",
            options: ["Tom is not an animal", "Tom is an animal", "Tom is a dog", "Nothing"],
            correct: "Tom is an animal"
        }
    ];
    const [puzzles, setPuzzles] = useState(fallbackPuzzles);

    const handleStart = async () => {
        setIsLoading(true);
        const dynamicPuzzles = await fetchDynamicPuzzles("Logic Puzzle", adaptedFor, fallbackPuzzles);
        setPuzzles(dynamicPuzzles);
        setIsLoading(false);
        setGameStarted(true);
        setCurrentPuzzle(0);
        setScore(0);
        setShowResult(false);
    };

    const handleAnswer = (answer) => {
        const puzzle = puzzles[currentPuzzle];
        const correct = String(answer) === String(puzzle.correct);
        setIsCorrect(correct);
        if (correct) setScore(s => s + 25);
        setShowResult(true);
    };

    const nextPuzzle = () => {
        setShowResult(false);
        if (currentPuzzle < puzzles.length - 1) {
            setCurrentPuzzle(c => c + 1);
        }
    };

    if (isLoading) {
        return (
            <div className="game-intro">
                <h2>🧩 Generating Logic Scenarios...</h2>
                <div style={{ margin: "20px 0", fontStyle: "italic", color: "#8b5cf6" }}>AI is creating challenging syllogisms...</div>
                <p>Prepare your analytical reasoning.</p>
            </div>
        );
    }

    if (!gameStarted) {
        return (
            <div className="game-intro">
                <h2>🧩 {name} (AI Powered)</h2>
                <p>{description}</p>
                <ul className="game-rules">
                    <li>📖 Read the statement carefully</li>
                    <li>🧠 Think logically</li>
                    <li>🎯 Choose the correct conclusion</li>
                </ul>
                <div className="game-buttons">
                    <button className="start-game-btn" onClick={handleStart}>Start Game</button>
                    <button className="exit-game-btn" onClick={onExit}>Back</button>
                </div>
            </div>
        );
    }

    if (currentPuzzle >= puzzles.length - 1 && showResult) {
        return (
            <div className="game-results">
                <h2>🏆 Complete!</h2>
                <div className="result-stats">
                    <div className="result-item">
                        <span className="result-label">Puzzles</span>
                        <span className="result-value">{puzzles.length}</span>
                    </div>
                    <div className="result-item">
                        <span className="result-label">Score</span>
                        <span className="result-value">{score} XP</span>
                    </div>
                </div>
                <div className="game-buttons">
                    <button className="start-game-btn" onClick={handleStart}>
                        Play Again (New AI scenarios)
                    </button>
                    <button className="complete-btn" onClick={() => onComplete({ score, game: "Logic Puzzle" })}>
                        Complete (+{score} XP)
                    </button>
                </div>
            </div>
        );
    }

    const puzzle = puzzles[currentPuzzle];

    return (
        <div className="logic-puzzle-game">
            <div className="game-header">
                <div className="game-stat">
                    <span className="stat-label">Puzzle:</span>
                    <span className="stat-value">{currentPuzzle + 1}/{puzzles.length}</span>
                </div>
                <div className="game-stat">
                    <span className="stat-label">Score:</span>
                    <span className="stat-value">{score}</span>
                </div>
            </div>

            <div className="logic-statement">
                <p className="statement-text">"{puzzle.statement}"</p>
                <p className="question-text">{puzzle.question}</p>
            </div>

            {showResult ? (
                <div className={`result-feedback ${isCorrect ? "correct" : "wrong"}`}>
                    <h3>{isCorrect ? "✅ Correct!" : "❌ Not quite"}</h3>
                    <p>The answer is: {puzzle.correct}</p>
                    <button className="next-btn" onClick={nextPuzzle}>Next Puzzle</button>
                </div>
            ) : (
                <div className="logic-options">
                    {puzzle.options.map((option, i) => (
                        <button key={i} className="option-btn" onClick={() => handleAnswer(option)}>
                            {option}
                        </button>
                    ))}
                </div>
            )}

            <button className="exit-game-btn" onClick={onExit}>Exit Game</button>
        </div>
    );
}

// Number Grid - Math-based puzzles
function NumberGrid({ exercise, onComplete, onExit }) {
    const { name = "Number Grid", description = "Math based puzzles", adaptedFor = "Adult" } = exercise || {};
    const [currentPuzzle, setCurrentPuzzle] = useState(0);
    const [score, setScore] = useState(0);
    const [userAnswer, setUserAnswer] = useState("");
    const [showResult, setShowResult] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    const [gameStarted, setGameStarted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const fallbackPuzzles = [
        {
            type: "sum",
            grid: [[5, 3], [2, "?"]],
            hint: "Each row sums to 8",
            answer: "6"
        }
    ];
    const [puzzles, setPuzzles] = useState(fallbackPuzzles);

    const handleStart = async () => {
        setIsLoading(true);
        const dynamicPuzzles = await fetchDynamicPuzzles("Number Grid", adaptedFor, fallbackPuzzles);
        setPuzzles(dynamicPuzzles);
        setIsLoading(false);
        setGameStarted(true);
        setCurrentPuzzle(0);
        setScore(0);
        setUserAnswer("");
        setShowResult(false);
    };

    const handleSubmit = () => {
        const puzzle = puzzles[currentPuzzle];
        const correct = String(userAnswer).trim() === String(puzzle.answer).trim();
        setIsCorrect(correct);
        if (correct) setScore(s => s + 20);
        setShowResult(true);
    };

    const nextPuzzle = () => {
        setShowResult(false);
        setUserAnswer("");
        if (currentPuzzle < puzzles.length - 1) {
            setCurrentPuzzle(c => c + 1);
        }
    };

    if (isLoading) {
        return (
            <div className="game-intro">
                <h2>🔢 Generating Math Grids...</h2>
                <div style={{ margin: "20px 0", fontStyle: "italic", color: "#8b5cf6" }}>Building fresh number matrices...</div>
                <p>AI is creating unique number patterns.</p>
            </div>
        );
    }

    if (!gameStarted) {
        return (
            <div className="game-intro">
                <h2>🔢 {name} (AI Powered)</h2>
                <p>{description}</p>
                <ul className="game-rules">
                    <li>📊 Study the mathematical pattern</li>
                    <li>💡 Use the hint if needed</li>
                    <li>🎯 Enter the missing number</li>
                </ul>
                <div className="game-buttons">
                    <button className="start-game-btn" onClick={handleStart}>Start Game</button>
                    <button className="exit-game-btn" onClick={onExit}>Back</button>
                </div>
            </div>
        );
    }

    if (currentPuzzle >= puzzles.length - 1 && showResult) {
        return (
            <div className="game-results">
                <h2>🏆 Complete!</h2>
                <div className="result-stats">
                    <div className="result-item">
                        <span className="result-label">Puzzles</span>
                        <span className="result-value">{puzzles.length}</span>
                    </div>
                    <div className="result-item">
                        <span className="result-label">Score</span>
                        <span className="result-value">{score} XP</span>
                    </div>
                </div>
                <div className="game-buttons">
                    <button className="start-game-btn" onClick={handleStart}>
                        Play Again (New AI Grids)
                    </button>
                    <button className="complete-btn" onClick={() => onComplete({ score, game: "Number Grid" })}>
                        Complete (+{score} XP)
                    </button>
                </div>
            </div>
        );
    }

    const puzzle = puzzles[currentPuzzle];

    return (
        <div className="number-grid-game">
            <div className="game-header">
                <div className="game-stat">
                    <span className="stat-label">Puzzle:</span>
                    <span className="stat-value">{currentPuzzle + 1}/{puzzles.length}</span>
                </div>
                <div className="game-stat">
                    <span className="stat-label">Score:</span>
                    <span className="stat-value">{score}</span>
                </div>
            </div>

            <div className="number-grid-display">
                {puzzle.grid.map((row, i) => (
                    <div key={i} className="grid-row">
                        {row.map((cell, j) => (
                            <span key={j} className={`grid-cell ${cell === "?" ? "missing" : ""}`}>
                                {cell}
                            </span>
                        ))}
                    </div>
                ))}
            </div>

            <p className="hint-text">💡 Hint: {puzzle.hint}</p>

            {showResult ? (
                <div className={`result-feedback ${isCorrect ? "correct" : "wrong"}`}>
                    <h3>{isCorrect ? "✅ Correct!" : "❌ Not quite"}</h3>
                    <p>The answer is: {puzzle.answer}</p>
                    <button className="next-btn" onClick={nextPuzzle}>Next Puzzle</button>
                </div>
            ) : (
                <div className="answer-input">
                    <input
                        type="text"
                        value={userAnswer}
                        onChange={(e) => setUserAnswer(e.target.value)}
                        placeholder="Enter missing number"
                        className="number-input"
                    />
                    <button className="submit-btn" onClick={handleSubmit}>Submit</button>
                </div>
            )}

            <button className="exit-game-btn" onClick={onExit}>Exit Game</button>
        </div>
    );
}

// New Game: Logic Spatial (Shape Rotation & Matching)
function LogicSpatial({ exercise, onComplete, onExit }) {
    const [score, setScore] = useState(0);
    const [phase, setPhase] = useState("intro"); // intro, playing, results
    const [level, setLevel] = useState(1);
    const [targetRotation, setTargetRotation] = useState(0);
    const [options, setOptions] = useState([]);
    
    const { name = "Spatial Reasoning", description = "Rotate shapes", adaptedFor = "Adult" } = exercise || {};
    const isKid = adaptedFor === "Toddler" || adaptedFor === "Child";
    
    // Choose shapes based on age
    const shapeTypes = isKid ? ["⭐", "🌙", "🔶", "💕"] : ["L-Tetromino", "T-Tetromino", "Z-Tetromino", "S-Tetromino"];
    const [currentShape, setCurrentShape] = useState(shapeTypes[0]);

    const generateLevel = useCallback(() => {
        setCurrentShape(shapeTypes[Math.floor(Math.random() * shapeTypes.length)]);
        const correctRot = Math.floor(Math.random() * 4) * 90; // 0, 90, 180, 270
        setTargetRotation(correctRot);
        
        let newOptions = [correctRot];
        while(newOptions.length < 3) {
            let r = Math.floor(Math.random() * 4) * 90;
            if(!newOptions.includes(r)) newOptions.push(r);
        }
        
        // Add a flipped option (e.g. 90deg + mirror) if adult/teen
        if (!isKid && newOptions.length < 4) {
            newOptions.push("flipped");
        } else if (isKid && newOptions.length < 4) {
             let r = Math.floor(Math.random() * 4) * 90;
             if(!newOptions.includes(r)) newOptions.push(r);
             else newOptions.push(r === 270 ? 0 : r + 90); // Fallback
        }
        
        setOptions(newOptions.sort(() => Math.random() - 0.5));
        setPhase("playing");
    }, [isKid, shapeTypes]);

    const handleAnswer = (option) => {
        if (option === targetRotation) {
            setScore(s => s + 20);
            if (level >= 5) {
                setPhase("results");
            } else {
                setLevel(l => l + 1);
                generateLevel();
            }
        } else {
            setScore(s => Math.max(0, s - 5));
            setPhase("results");
        }
    };

    const startGame = () => {
        setLevel(1);
        setScore(0);
        generateLevel();
    };

    if (phase === "intro") {
        return (
            <div className="game-intro">
                <h2>🧩 {name}</h2>
                <p>{description}</p>
                <div style={{ fontSize: "4rem", margin: "1rem 0", transform: "rotate(45deg)" }}>{shapeTypes[0]}</div>
                <ul className="game-rules">
                    <li>👀 Look at the target object</li>
                    <li>🔄 Find which option is the same object but rotated</li>
                    <li>⚠️ Watch out for mirrored shapes!</li>
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
                <h2>🏁 Spatial Test Complete!</h2>
                <div className="result-stats">
                    <div className="result-item">
                        <span className="result-label">Level Reached</span>
                        <span className="result-value">{level}</span>
                    </div>
                    <div className="result-item">
                        <span className="result-label">Score</span>
                        <span className="result-value">{score} XP</span>
                    </div>
                </div>
                <div className="game-buttons">
                    <button className="start-game-btn" onClick={startGame}>Try Again</button>
                    <button className="complete-btn" onClick={() => onComplete({ score, game: "Spatial Logic" })}>
                        Complete (+{score} XP)
                    </button>
                </div>
            </div>
        );
    }
    
    const renderShape = (rot) => {
        if (isKid) {
            return <div style={{ fontSize: "4rem", transform: `rotate(${rot}deg)` }}>{currentShape}</div>;
        }
        
        let path = "";
        if (currentShape === "L-Tetromino") path = "M 20 20 h 20 v 60 h -60 v -20 h 40 z";
        if (currentShape === "T-Tetromino") path = "M 20 20 h 60 v 20 h -20 v 40 h -20 v -40 h -20 z";
        if (currentShape === "Z-Tetromino") path = "M 20 20 h 40 v 20 h -20 v 20 h -40 v -20 h 20 z";
        if (currentShape === "S-Tetromino") path = "M 40 20 h 40 v 20 h -20 v 20 h -40 v -20 h 20 z";
        
        const isFlipped = rot === "flipped";
        const realRot = isFlipped ? Math.floor(Math.random() * 4) * 90 : rot;
        
        return (
             <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: `rotate(${realRot}deg) ${isFlipped ? "scaleX(-1)" : ""}`, transition: "transform 0.3s" }}>
                 <path d={path} fill="#8b5cf6" stroke="#fff" strokeWidth="2" />
             </svg>
        );
    }

    return (
        <div className="logic-spatial-game" style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", height: "450px", background: "rgba(0,0,0,0.2)", borderRadius: "12px", padding: "20px" }}>
            <div className="game-header" style={{ width: "100%", display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
                <div className="game-stat"><span className="stat-label">Level:</span><span className="stat-value">{level}/5</span></div>
                <div className="game-stat"><span className="stat-label">Score:</span><span className="stat-value">{score}</span></div>
            </div>

            <div style={{ textAlign: "center", marginBottom: "2rem" }}>
                <h3>Target Shape ({isKid ? "Upright" : "0°"})</h3>
                <div style={{ padding: "20px", background: "rgba(255,255,255,0.1)", borderRadius: "12px", display: "inline-block" }}>
                    {renderShape(0)}
                </div>
            </div>
            
            <h3>Which one matches the target (rotated)?</h3>
            <div style={{ display: "flex", gap: "15px", justifyContent: "center", flexWrap: "wrap", marginTop: "10px" }}>
                {options.map((opt, i) => (
                    <button 
                        key={i} 
                        onClick={() => handleAnswer(opt)}
                        style={{ background: "rgba(255,255,255,0.05)", border: "2px solid rgba(255,255,255,0.2)", borderRadius: "12px", padding: "15px", cursor: "pointer", transition: "all 0.2s" }}
                        onMouseOver={e => e.currentTarget.style.borderColor = "#3b82f6"}
                        onMouseOut={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"}
                    >
                        {renderShape(opt)}
                    </button>
                ))}
            </div>

            <button className="exit-game-btn floating" style={{ position: "absolute", bottom: 20, right: 20 }} onClick={onExit}>Exit</button>
        </div>
    );
}

// Main Logic Games Component
export default function LogicGames({ exerciseId, exercise, onComplete, onExit }) {
    const games = {
        "logic-pattern": PatternFinder,
        "logic-puzzle": LogicPuzzle,
        "logic-number": NumberGrid,
        "logic-spatial": LogicSpatial
    };

    const GameComponent = games[exerciseId] || PatternFinder;

    return (
        <div className="logic-games-container">
            <GameComponent exercise={exercise} onComplete={onComplete} onExit={onExit} />
        </div>
    );
}
