"""
Cognitive Shadow Analyzer
Background cognitive model that mirrors how the user's brain learns, focuses, forgets, and transfers knowledge.

Uses Ollama for intelligent analysis when available, with fallback logic.
"""

import json
import os
from datetime import datetime
from pathlib import Path

import requests  # type: ignore[import]
from flask import Flask, jsonify, request  # type: ignore[import]
from flask_cors import CORS  # type: ignore[import]

# Load environment
try:
    from dotenv import load_dotenv  # type: ignore[import]
    env_path = Path(__file__).resolve().parent.parent / '.env'
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
except:
    pass

app = Flask(__name__)
CORS(app)

PORT = int(os.environ.get("COGNITIVE_PORT", 8004))
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.1")

# =============================================================================
# Cognitive Shadow System Prompt
# =============================================================================

COGNITIVE_SHADOW_PROMPT = """You are the Cognitive Shadow of a user's AI Twin.

You operate as a background cognitive model that mirrors how the user's brain learns, focuses, forgets, and transfers knowledge.

You do not manage tasks or schedules directly.
You generate cognitive insights that help the AI Twin make better decisions.

PRIMARY FUNCTIONS:
1. Brain Weather Forecast - Predict cognitive energy, focus depth, fatigue
2. Personal Forgetting Signature - Memory decay model, concepts at risk
3. Knowledge Transfer Detection - Positive/negative transfer between topics
4. Meta-Cognitive Strategy Coaching - Detect inefficient strategies

RULES:
- Be concise and insight-driven
- Acknowledge uncertainty in predictions
- Never shame or pressure the user
- Do not optimize productivity at expense of mental health

You MUST respond with ONLY valid JSON in this exact structure:
{
  "brainWeather": {
    "state": "low" or "medium" or "high",
    "confidence": 0.0 to 1.0,
    "note": "short explanation"
  },
  "memoryRisk": {
    "level": "low" or "medium" or "high",
    "concepts": ["concept1", "concept2"],
    "note": "short explanation"
  },
  "transferSignals": [
    {
      "from": "topic",
      "to": "topic",
      "effect": "positive" or "negative",
      "confidence": 0.0 to 1.0
    }
  ],
  "strategyAdjustment": {
    "issue": "detected problem or null",
    "suggestion": "what to change",
    "reason": "why it helps"
  }
}"""

# =============================================================================
# Ollama Integration
# =============================================================================

def _check_ollama():
    """Check if Ollama is available."""
    try:
        response = requests.get(f"{OLLAMA_URL}/api/tags", timeout=3)
        return response.status_code == 200
    except:
        return False

def _generate_with_ollama(prompt: str) -> dict:
    """Generate response using Ollama."""
    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "system": COGNITIVE_SHADOW_PROMPT,
                "stream": False,
                "format": "json",
            },
            timeout=60
        )
        
        if response.status_code == 200:
            return {"success": True, "response": response.json().get("response", "")}
        return {"error": f"Ollama error: {response.status_code}"}
    except requests.exceptions.ConnectionError:
        return {"error": "Ollama not running"}
    except Exception as e:
        return {"error": str(e)}

# =============================================================================
# Cognitive Analysis Functions
# =============================================================================

def analyze_cognitive_state(session_data: dict) -> dict:
    """
    Analyze user's cognitive state based on session data.
    
    session_data should contain:
    - time_of_day: current hour (0-23)
    - recent_sessions: list of recent learning sessions
    - topics_studied: list of topics covered
    - performance_history: list of scores/accuracy
    - session_durations: list of session lengths in minutes
    """
    
    time_of_day = session_data.get("time_of_day", datetime.now().hour)
    recent_sessions = session_data.get("recent_sessions", [])
    topics = session_data.get("topics_studied", [])
    performance = session_data.get("performance_history", [])
    durations = session_data.get("session_durations", [])
    
    # Try Ollama first
    if _check_ollama():
        prompt = f"""Analyze this learning session data and provide cognitive insights:

Time of day: {time_of_day}:00
Recent sessions count: {len(recent_sessions)}
Topics studied: {', '.join(topics) if topics else 'None specified'}
Recent performance scores: {performance[-5:] if performance else 'No data'}
Session durations (minutes): {durations[-5:] if durations else 'No data'}

Based on this data, predict:
1. Current cognitive energy state
2. Which concepts might be at risk of forgetting
3. Any transfer effects between topics
4. Learning strategy adjustments needed

Respond with ONLY valid JSON."""

        result = _generate_with_ollama(prompt)
        if "success" in result:
            try:
                parsed = json.loads(result["response"])
                return {"success": True, "analysis": parsed}
            except json.JSONDecodeError:
                pass  # Fall through to rule-based
    
    # Fallback: Rule-based analysis
    return {"success": True, "analysis": _rule_based_analysis(session_data)}

def _rule_based_analysis(session_data: dict) -> dict:
    """Rule-based fallback analysis when Ollama is unavailable."""
    
    hour = session_data.get("time_of_day", datetime.now().hour)
    sessions = session_data.get("recent_sessions", [])
    topics = session_data.get("topics_studied", [])
    performance = session_data.get("performance_history", [])
    durations = session_data.get("session_durations", [])
    
    # Brain Weather - based on time of day and recent activity
    if 9 <= hour <= 11 or 15 <= hour <= 17:
        brain_state = "high"
        brain_note = "Peak cognitive hours - optimal for challenging tasks"
    elif 6 <= hour <= 8 or 14 <= hour <= 15:
        brain_state = "medium"
        brain_note = "Moderate energy - good for learning and review"
    else:
        brain_state = "low"
        brain_note = "Consider lighter cognitive tasks or taking a break"
    
    # Check for fatigue
    if len(durations) >= 3 and sum(durations[-3:]) > 120:
        brain_state = "low"
        brain_note = "Extended study detected - consider a break to prevent burnout"
    
    # Memory Risk - concepts not reviewed recently
    at_risk = []
    if len(topics) > 3:
        at_risk = topics[:-2]  # Older topics at risk
    
    memory_level = "high" if len(at_risk) > 2 else ("medium" if len(at_risk) > 0 else "low")
    
    # Transfer signals
    transfers = []
    if len(topics) >= 2:
        # Simple heuristic: similar topics have positive transfer
        transfers.append({
            "from": topics[-2] if len(topics) >= 2 else "previous topic",
            "to": topics[-1] if topics else "current topic",
            "effect": "positive",
            "confidence": 0.6
        })
    
    # Strategy adjustment
    strategy = {
        "issue": None,
        "suggestion": "Continue with current approach",
        "reason": "No issues detected"
    }
    
    if performance and len(performance) >= 3:
        avg_recent = sum(performance[-3:]) / 3
        if avg_recent < 60:
            strategy = {
                "issue": "Declining performance trend",
                "suggestion": "Try active recall instead of passive reading",
                "reason": "Active retrieval strengthens memory formation"
            }
        elif avg_recent > 90 and len(set(topics[-3:])) == 1:
            strategy = {
                "issue": "Possible illusion of competence",
                "suggestion": "Test yourself on related but different topics",
                "reason": "Variety challenges your understanding depth"
            }
    
    return {
        "brainWeather": {
            "state": brain_state,
            "confidence": 0.7,
            "note": brain_note
        },
        "memoryRisk": {
            "level": memory_level,
            "concepts": at_risk[:3],  # type: ignore[index]
            "note": f"{len(at_risk)} concepts may need review" if at_risk else "Memory consolidation on track"
        },
        "transferSignals": transfers,
        "strategyAdjustment": strategy
    }

# =============================================================================
# API Endpoints
# =============================================================================

@app.route("/health", methods=["GET"])
def health():
    """Health check."""
    return jsonify({
        "status": "online",
        "service": "cognitive-shadow",
        "ollama_available": _check_ollama(),
        "timestamp": datetime.now().isoformat()
    })

@app.route("/analyze", methods=["POST"])
def analyze():
    """Analyze cognitive state."""
    data = request.get_json(silent=True) or {}
    
    # Add current time if not provided
    if "time_of_day" not in data:
        data["time_of_day"] = datetime.now().hour  # type: ignore[index]
    
    result = analyze_cognitive_state(data)
    
    if result.get("success"):
        return jsonify({
            "success": True,
            **result["analysis"],
            "timestamp": datetime.now().isoformat()
        })
    
    return jsonify({"error": result.get("error", "Analysis failed")}), 500

@app.route("/quick-check", methods=["GET"])
def quick_check():
    """Quick cognitive state check based on time only."""
    hour = datetime.now().hour
    
    result = _rule_based_analysis({
        "time_of_day": hour,
        "recent_sessions": [],
        "topics_studied": [],
        "performance_history": [],
        "session_durations": []
    })
    
    return jsonify({
        "success": True,
        **result,
        "timestamp": datetime.now().isoformat()
    })

# =============================================================================
# Main
# =============================================================================

if __name__ == "__main__":
    print(f"""
================================================
       COGNITIVE SHADOW ANALYZER
   Brain Weather • Memory Risk • Transfer Map
================================================

Endpoints:
  - GET  /health      Health check
  - GET  /quick-check Quick state analysis
  - POST /analyze     Full cognitive analysis

Starting on http://127.0.0.1:{PORT}
""")
    app.run(host="127.0.0.1", port=PORT, debug=True)
