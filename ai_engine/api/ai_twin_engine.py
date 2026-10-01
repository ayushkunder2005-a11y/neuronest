"""
AI Twin Engine — Digital Cognitive Twin API Server
Tracks user knowledge, predicts learning outcomes, manages spaced repetition,
detects weaknesses, and generates smart study plans.
"""

from __future__ import annotations

import json
import math
import os
import re
import time
import io
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Any, List, Dict

import requests  # type: ignore[import]
from flask import Flask, jsonify, request  # type: ignore[import]
from flask_cors import CORS  # type: ignore[import]

try:
    import PyPDF2  # type: ignore[import]
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False
    print("[AI Twin] PyPDF2 not installed. PDF support disabled.")

import requests  # type: ignore[import]
from flask import Flask, jsonify, request  # type: ignore[import]
from flask_cors import CORS  # type: ignore[import]

# ---------------------------------------------------------------------------
# Environment & optional AI imports
# ---------------------------------------------------------------------------
try:
    from dotenv import load_dotenv  # type: ignore[import]

    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
        print(f"[AI Twin] Loaded config from {env_path}")
except Exception as e:
    print(f"[AI Twin] Config loading: {e}")

try:
    import google.generativeai as genai  # type: ignore[import]

    GEMINI_SUPPORT = True
except ImportError:
    GEMINI_SUPPORT = False
    print("[AI Twin] google-generativeai not installed — AI predictions limited")

OLLAMA_BASE_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "gpt-oss:120b-cloud")

# OpenAI support (kept as fallback)
try:
    from openai import OpenAI as _OpenAIClient  # type: ignore[import]
    OPENAI_SUPPORT = True
except ImportError:
    OPENAI_SUPPORT = False

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
_openai_client = None

# Groq support (primary fast AI provider)
try:
    from groq import Groq as _GroqClient  # type: ignore[import]
    GROQ_SUPPORT = True
    print("[AI Twin] Groq support enabled.")
except ImportError:
    GROQ_SUPPORT = False
    print("[AI Twin] groq package not installed — run: pip install groq")

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
_groq_client = None

# ---------------------------------------------------------------------------
# Flask app
# ---------------------------------------------------------------------------
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
PORT = int(os.environ.get("AI_TWIN_PORT", 8002))

# ---------------------------------------------------------------------------
# Data storage (JSON file–based, per-user)
# ---------------------------------------------------------------------------
DATA_DIR = Path(__file__).resolve().parent.parent / "ai_twin_data"
DATA_DIR.mkdir(parents=True, exist_ok=True)


def _user_file(user_id: str) -> Path:
    safe_id = re.sub(r"[^a-zA-Z0-9_\-]", "_", user_id or "default")
    return DATA_DIR / f"{safe_id}.json"


def _load_user(user_id: str) -> dict:
    path = _user_file(user_id)
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            pass
    return _default_profile(user_id)


def _save_user(user_id: str, data: dict):
    path = _user_file(user_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")


def _default_profile(user_id: str) -> dict:
    return {
        "userId": user_id,
        "name": "Learner",
        "createdAt": datetime.now().isoformat(),
        "lastActive": datetime.now().isoformat(),
        # Learning style preferences (0-1 scale)
        "learningStyle": {
            "visual": 0.5,
            "textual": 0.3,
            "practice": 0.7,
            "preferred": "practice",
        },
        # Study schedule
        "studySchedule": {
            "bestTime": "evening",
            "avgFocusDuration": 30,  # minutes
            "totalStudyHours": 0,
            "sessionsCount": 0,
        },
        # Knowledge graph — topic → mastery %
        "knowledgeGraph": {
            "Programming": {
                "mastery": 0,
                "children": {
                    "Python": {"mastery": 0, "lastStudied": None, "reviewCount": 0},
                    "JavaScript": {"mastery": 0, "lastStudied": None, "reviewCount": 0},
                    "Data Structures": {
                        "mastery": 0,
                        "lastStudied": None,
                        "reviewCount": 0,
                        "children": {
                            "Arrays": {"mastery": 0, "lastStudied": None, "reviewCount": 0},
                            "Trees": {"mastery": 0, "lastStudied": None, "reviewCount": 0},
                            "Graphs": {"mastery": 0, "lastStudied": None, "reviewCount": 0},
                        },
                    },
                    "Algorithms": {"mastery": 0, "lastStudied": None, "reviewCount": 0},
                },
            },
            "Mathematics": {
                "mastery": 0,
                "children": {
                    "Algebra": {"mastery": 0, "lastStudied": None, "reviewCount": 0},
                    "Probability": {"mastery": 0, "lastStudied": None, "reviewCount": 0},
                    "Calculus": {"mastery": 0, "lastStudied": None, "reviewCount": 0},
                },
            },
            "Communication": {
                "mastery": 0,
                "children": {
                    "English": {"mastery": 0, "lastStudied": None, "reviewCount": 0},
                    "Presentation": {"mastery": 0, "lastStudied": None, "reviewCount": 0},
                    "Writing": {"mastery": 0, "lastStudied": None, "reviewCount": 0},
                },
            },
        },
        # Behavior log (recent sessions)
        "behaviorLog": [],
        # Mistake patterns
        "mistakePatterns": [],
        # Strengths / weaknesses (derived)
        "strengths": [],
        "weaknesses": [],
        # Predictions cache
        "predictions": {
            "examScore": None,
            "burnoutRisk": "low",
            "nextPredictionAt": None,
        },
    }


# ---------------------------------------------------------------------------
# Ebbinghaus Forgetting Curve helpers
# ---------------------------------------------------------------------------
RETENTION_STABILITY = 0.9  # memory stability factor


def _retention_probability(days_since: float, review_count: int) -> float:
    """Estimate retention probability using Ebbinghaus curve with review boost."""
    if days_since <= 0:
        return 1.0
    stability = RETENTION_STABILITY + min(review_count * 0.1, 0.5)
    retention = math.exp(-days_since / (stability * max(1, review_count + 1) * 2))
    return round(max(0.0, min(1.0, retention)), 3)  # type: ignore[call-overload]


def _days_until_threshold(review_count: int, threshold: float = 0.5) -> float:
    """Days until retention drops below threshold."""
    stability = RETENTION_STABILITY + min(review_count * 0.1, 0.5)
    factor = stability * max(1, review_count + 1) * 2
    if threshold <= 0:
        return 999
    days = -factor * math.log(threshold)
    return round(max(0.0, days), 1)  # type: ignore[call-overload]


# ---------------------------------------------------------------------------
# Knowledge graph helpers
# ---------------------------------------------------------------------------
def _flatten_knowledge(node: dict, prefix: str = "") -> list:
    """Flatten nested knowledge graph into a list of topic dicts."""
    results = []
    children = node.get("children", {})
    for name, data in children.items():
        path = f"{prefix} > {name}" if prefix else name
        entry = {
            "topic": name,
            "path": path,
            "mastery": data.get("mastery", 0),
            "lastStudied": data.get("lastStudied"),
            "reviewCount": data.get("reviewCount", 0),
        }
        # Calculate retention
        if data.get("lastStudied"):
            try:
                last = datetime.fromisoformat(data["lastStudied"])
                days = (datetime.now() - last).total_seconds() / 86400
                entry["daysSinceStudy"] = round(days, 1)  # type: ignore[call-overload]
                entry["retention"] = _retention_probability(days, data.get("reviewCount", 0))
            except Exception:
                entry["daysSinceStudy"] = None
                entry["retention"] = 0
        else:
            entry["daysSinceStudy"] = None
            entry["retention"] = 0

        results.append(entry)
        # Recurse into children
        if "children" in data:
            results.extend(_flatten_knowledge(data, path))  # type: ignore[arg-type]
    return results


def _update_parent_mastery(kg: dict):
    """Recalculate parent mastery from children averages."""
    for name, data in kg.items():
        children = data.get("children", {})
        if children:
            _update_parent_mastery(children)
            child_masteries = []
            for cdata in children.values():
                child_masteries.append(cdata.get("mastery", 0))
            if child_masteries:
                data["mastery"] = round(sum(child_masteries) / len(child_masteries), 1)  # type: ignore[call-overload]


def _find_topic_node(kg: dict, topic_name: str) -> dict | None:
    """Find a topic node by name anywhere in the knowledge graph."""
    for name, data in kg.items():
        if name.lower() == topic_name.lower():
            return data
        children = data.get("children", {})
        for cname, cdata in children.items():
            if cname.lower() == topic_name.lower():
                return cdata
            if "children" in cdata:
                for gname, gdata in cdata["children"].items():
                    if gname.lower() == topic_name.lower():
                        return gdata
    return None


# ---------------------------------------------------------------------------
# AI helpers (Ollama → Gemini fallback)
# ---------------------------------------------------------------------------
def _extract_pdf_text(file_bytes: bytes) -> str:
    """Extract text content from a PDF file."""
    if not PDF_SUPPORT:
        return ""
    try:
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
        text: str = ""
        for page in pdf_reader.pages:
            extracted = page.extract_text()
            if extracted:
                text = f"{text}{extracted}\n"
        return text
    except Exception as e:
        print(f"[AI Twin] PDF extraction error: {e}")
        return ""

def _check_ollama() -> bool:
    try:
        r = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=3)
        return r.status_code == 200
    except Exception:
        return False


def _generate_with_ollama(prompt: str, system: Optional[str] = None) -> dict:
    try:
        payload = {"model": OLLAMA_MODEL, "prompt": prompt, "stream": False}
        if system:
            payload["system"] = system
        r = requests.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload, timeout=120)
        if r.status_code == 200:
            return {"success": True, "response": r.json().get("response", "")}
        return {"error": f"Ollama {r.status_code}"}
    except Exception as e:
        return {"error": str(e)}


def _init_gemini() -> bool:
    if not GEMINI_SUPPORT:
        return False
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        return False
    genai.configure(api_key=key)
    return True


def _get_gemini_model():
    try:
        for m in genai.list_models():
            if "generateContent" in m.supported_generation_methods:
                return genai.GenerativeModel(m.name)
    except Exception:
        pass
    for name in ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-pro-latest"]:
        try:
            return genai.GenerativeModel(name)
        except Exception:
            continue
    return None


def _ai_generate(prompt: str, system: Optional[str] = None, provider: str = "auto") -> str:
    """Generate text using specified provider or fallback. Returns string."""
    global _groq_client, _openai_client

    # 1. Try Groq FIRST — ultra-fast, free tier available
    if GROQ_API_KEY and GROQ_SUPPORT and provider in ["auto", "groq"]:
        try:
            if _groq_client is None:
                _groq_client = _GroqClient(api_key=GROQ_API_KEY)
            messages: list[dict[str, str]] = []
            if system:
                messages.append({"role": "system", "content": system})
            messages.append({"role": "user", "content": prompt})
            response = _groq_client.chat.completions.create(
                model=GROQ_MODEL,
                messages=messages,  # type: ignore[arg-type]
                temperature=0.7,
                max_tokens=2048,
            )
            content = response.choices[0].message.content or ""
            if content:
                print(f"[AI Twin] Response via Groq ({GROQ_MODEL})")
                return content
        except Exception as e:
            print(f"[AI Twin] Groq error: {e}")

    # 2. Try Gemini
    if provider in ["auto", "gemini"] and _init_gemini():
        try:
            model = _get_gemini_model()
            if model:
                full = f"{system}\n\n{prompt}" if system else prompt
                resp = model.generate_content(full)
                return resp.text
        except Exception as e:
            print(f"[AI Twin] Gemini error: {e}")

    # 3. Try OpenAI (fallback)
    if OPENAI_API_KEY and OPENAI_SUPPORT and provider in ["auto", "openai"]:
        try:
            if _openai_client is None:
                _openai_client = _OpenAIClient(api_key=OPENAI_API_KEY)
            msgs2: list[dict[str, str]] = []
            if system:
                msgs2.append({"role": "system", "content": system})
            msgs2.append({"role": "user", "content": prompt})
            response2 = _openai_client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=msgs2,  # type: ignore[arg-type]
                temperature=0.7,
            )
            content2 = response2.choices[0].message.content or ""
            if content2:
                return content2
        except Exception as e:
            print(f"[AI Twin] OpenAI error: {e}")

    # 4. Try Ollama (local)
    if provider in ["auto", "ollama"] and _check_ollama():
        r = _generate_with_ollama(prompt, system)
        if "success" in r:
            return r["response"]

    return ""


# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "online",
        "service": "ai-twin-engine",
        "timestamp": datetime.now().isoformat(),
    })


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------
@app.route("/profile", methods=["GET"])
def get_profile():
    uid = request.args.get("userId", "default")
    profile = _load_user(uid)
    return jsonify({"success": True, "profile": profile})


@app.route("/profile", methods=["POST"])
def update_profile():
    data = request.get_json(silent=True) or {}
    uid = data.get("userId", "default")
    profile = _load_user(uid)

    # Merge updatable fields
    for key in ["name", "learningStyle", "studySchedule"]:
        if key in data:  # type: ignore[operator]
            if isinstance(data[key], dict) and isinstance(profile.get(key), dict):  # type: ignore[index]
                profile[key].update(data[key])  # type: ignore[union-attr]
            else:
                profile[key] = data[key]  # type: ignore[index]

    profile["lastActive"] = datetime.now().isoformat()
    _save_user(uid, profile)
    return jsonify({"success": True, "profile": profile})


# ---------------------------------------------------------------------------
# Knowledge Graph
# ---------------------------------------------------------------------------
@app.route("/knowledge-graph", methods=["GET"])
def get_knowledge_graph():
    uid = request.args.get("userId", "default")
    profile = _load_user(uid)
    kg = profile.get("knowledgeGraph", {})
    flat = _flatten_knowledge({"children": kg})
    return jsonify({
        "success": True,
        "graph": kg,
        "topics": flat,
        "totalTopics": len(flat),
        "averageMastery": round(sum(t["mastery"] for t in flat) / max(1, len(flat)), 1),  # type: ignore[call-overload]
    })


@app.route("/knowledge-graph", methods=["POST"])
def update_knowledge_graph():
    data = request.get_json(silent=True) or {}
    uid = data.get("userId", "default")
    topic = data.get("topic", "")
    mastery = data.get("mastery")
    action = data.get("action", "study")  # study / quiz / review

    if not topic:
        return jsonify({"error": "topic is required"}), 400

    profile = _load_user(uid)
    kg = profile.get("knowledgeGraph", {})

    node = _find_topic_node(kg, topic)
    if node is None:
        # Auto-create under a "Custom" category
        if "Custom" not in kg:
            kg["Custom"] = {"mastery": 0, "children": {}}
        kg["Custom"]["children"][topic] = {
            "mastery": 0,
            "lastStudied": None,
            "reviewCount": 0,
        }
        node = kg["Custom"]["children"][topic]

    # Update mastery
    if mastery is not None:
        node["mastery"] = min(100, max(0, float(mastery)))  # type: ignore[assignment]
    elif action == "study":
        node["mastery"] = min(100, node.get("mastery", 0) + 10)  # type: ignore[assignment]
    elif action == "quiz":
        node["mastery"] = min(100, node.get("mastery", 0) + 15)  # type: ignore[assignment]
    elif action == "review":
        node["mastery"] = min(100, node.get("mastery", 0) + 5)  # type: ignore[assignment]

    node["lastStudied"] = datetime.now().isoformat()  # type: ignore[index]
    node["reviewCount"] = node.get("reviewCount", 0) + 1  # type: ignore[index]

    _update_parent_mastery(kg)
    profile["knowledgeGraph"] = kg
    profile["lastActive"] = datetime.now().isoformat()

    # Update strengths/weaknesses
    flat = _flatten_knowledge({"children": kg})
    studied = [t for t in flat if t["mastery"] > 0]
    profile["strengths"] = [t["topic"] for t in sorted(studied, key=lambda x: -x["mastery"])[:5]]  # type: ignore[index]
    profile["weaknesses"] = [t["topic"] for t in sorted(studied, key=lambda x: x["mastery"])[:5] if t["mastery"] < 60]  # type: ignore[index]

    _save_user(uid, profile)
    return jsonify({"success": True, "topic": topic, "mastery": node["mastery"]})


# ---------------------------------------------------------------------------
# Predictions
# ---------------------------------------------------------------------------
@app.route("/predictions", methods=["GET"])
def get_predictions():
    uid = request.args.get("userId", "default")
    profile = _load_user(uid)
    kg = profile.get("knowledgeGraph", {})
    flat = _flatten_knowledge({"children": kg})
    behavior = profile.get("behaviorLog", [])

    studied = [t for t in flat if t["mastery"] > 0]
    avg_mastery = sum(t["mastery"] for t in studied) / max(1, len(studied)) if studied else 0

    # --- Exam score prediction ---
    exam_score = round(avg_mastery * 0.85 + min(len(studied) * 2, 15), 1)  # type: ignore[call-overload]
    exam_score = min(100, max(0, exam_score))

    confidence = "low"
    if len(studied) >= 5:
        confidence = "medium"
    if len(studied) >= 10 and avg_mastery > 50:
        confidence = "high"

    # --- Forgetting curves ---
    forgetting = []
    for t in flat:
        if t.get("lastStudied"):
            days = t.get("daysSinceStudy", 0) or 0
            retention = t.get("retention", 0)
            days_to_50 = _days_until_threshold(t.get("reviewCount", 0), 0.5)
            forgetting.append({
                "topic": t["topic"],
                "retention": round(retention * 100, 1),
                "daysSinceStudy": days,
                "daysUntilCritical": round(max(0.0, days_to_50 - days), 1),  # type: ignore[call-overload]
                "urgency": "critical" if retention < 0.3 else "warning" if retention < 0.6 else "good",
            })
    forgetting.sort(key=lambda x: x["retention"])

    # --- Burnout risk ---
    recent_sessions = [
        b for b in behavior
        if b.get("timestamp") and _is_recent(b["timestamp"], days=3)
    ]
    total_recent_minutes = sum(b.get("duration", 0) for b in recent_sessions)
    sessions_per_day = len(recent_sessions) / 3 if recent_sessions else 0

    burnout = "low"
    burnout_score = 0
    if total_recent_minutes > 300:  # > 5 hours in 3 days
        burnout = "medium"
        burnout_score = 50
    if total_recent_minutes > 480 or sessions_per_day > 5:
        burnout = "high"
        burnout_score = 80
    if total_recent_minutes > 600:
        burnout = "critical"
        burnout_score = 95

    # --- Learning speed ---
    speed_estimates = {}
    for t in studied:
        rc = t.get("reviewCount", 1)
        m = t.get("mastery", 0)
        speed = "medium"
        if rc > 0:
            rate = m / rc
            if rate >= 20:
                speed = "fast"
            elif rate <= 8:
                speed = "slow"
        speed_estimates[t["topic"]] = speed

    return jsonify({
        "success": True,
        "examScore": {
            "predicted": exam_score,
            "confidence": confidence,
            "weakAreas": [t["topic"] for t in sorted(studied, key=lambda x: x["mastery"])[:3]],  # type: ignore[index]
        },
        "forgettingCurves": forgetting[:10],  # type: ignore[index]
        "burnout": {
            "risk": burnout,
            "score": burnout_score,
            "recentStudyMinutes": total_recent_minutes,
            "recommendation": _burnout_tip(burnout),
        },
        "learningSpeed": speed_estimates,
        "timestamp": datetime.now().isoformat(),
    })


def _is_recent(timestamp_str: str, days: int) -> bool:
    try:
        ts = datetime.fromisoformat(timestamp_str)
        return (datetime.now() - ts).total_seconds() < days * 86400
    except Exception:
        return False


def _burnout_tip(level: str) -> str:
    tips = {
        "low": "You're doing great! Keep a balanced study routine.",
        "medium": "Consider taking short breaks between study sessions.",
        "high": "You've been studying intensely. Take a 30-minute break and hydrate!",
        "critical": "⚠️ High burnout risk detected! Rest is essential for memory consolidation. Take at least a 2-hour break.",
    }
    return tips.get(level, tips["low"])


# ---------------------------------------------------------------------------
# Memory Decay Monitor (Spaced Repetition)
# ---------------------------------------------------------------------------
@app.route("/memory-decay", methods=["GET"])
def memory_decay():
    uid = request.args.get("userId", "default")
    profile = _load_user(uid)
    kg = profile.get("knowledgeGraph", {})
    flat = _flatten_knowledge({"children": kg})

    due_for_review = []
    for t in flat:
        if not t.get("lastStudied"):
            continue
        retention = t.get("retention", 1.0)
        if retention < 0.7:
            priority = "low"
            if retention < 0.3:
                priority = "critical"
            elif retention < 0.5:
                priority = "high"
            elif retention < 0.6:
                priority = "medium"

            due_for_review.append({
                "topic": t["topic"],
                "path": t["path"],
                "mastery": t["mastery"],
                "retention": round(retention * 100, 1),
                "daysSinceStudy": t.get("daysSinceStudy", 0),
                "reviewCount": t.get("reviewCount", 0),
                "priority": priority,
                "action": f"Revise '{t['topic']}' — retention at {round(retention * 100)}%",
            })

    due_for_review.sort(key=lambda x: x["retention"])

    return jsonify({
        "success": True,
        "dueForReview": due_for_review,
        "totalDue": len(due_for_review),
        "criticalCount": sum(1 for d in due_for_review if d["priority"] == "critical"),
        "timestamp": datetime.now().isoformat(),
    })


# ---------------------------------------------------------------------------
# Study Plan
# ---------------------------------------------------------------------------
@app.route("/study-plan", methods=["GET"])
def study_plan():
    uid = request.args.get("userId", "default")
    profile = _load_user(uid)
    kg = profile.get("knowledgeGraph", {})
    flat = _flatten_knowledge({"children": kg})
    schedule = profile.get("studySchedule", {})
    focus_duration = schedule.get("avgFocusDuration", 30)

    # Check for AI-generated plan from chat commands
    ai_plan = profile.get("aiStudyPlan", {})
    ai_plan_items = ai_plan.get("plan", [])

    final_plan = []
    plan_source = "none"
    total_time = 0
    
    if ai_plan_items:
        created = ai_plan.get("createdAt", "")
        try:
            created_dt = datetime.fromisoformat(created)
            if (datetime.now() - created_dt).total_seconds() < 86400:  # within 24 hours
                final_plan = ai_plan_items
                total_time = sum(p.get("duration", 0) for p in final_plan)
                plan_source = "ai_chat"
        except Exception:
            pass

    return jsonify({
        "success": True,
        "plan": final_plan,
        "totalDuration": total_time,
        "planCount": len(final_plan),
        "bestStudyTime": schedule.get("bestTime", "evening"),
        "planSource": plan_source,
        "aiPlanTopics": ai_plan.get("topics", []),
        "startTime": ai_plan.get("startTime", ""),
        "endTime": ai_plan.get("endTime", ""),
        "timestamp": datetime.now().isoformat(),
    })


# ---------------------------------------------------------------------------
# Mistake Patterns
# ---------------------------------------------------------------------------
@app.route("/mistakes", methods=["GET"])
def get_mistakes():
    uid = request.args.get("userId", "default")
    profile = _load_user(uid)
    mistakes = profile.get("mistakePatterns", [])

    # Aggregate
    pattern_counts = {}
    for m in mistakes:
        key = f"{m.get('topic', 'Unknown')}|{m.get('type', 'unknown')}"
        if key not in pattern_counts:
            pattern_counts[key] = {
                "topic": m.get("topic", "Unknown"),
                "type": m.get("type", "unknown"),
                "count": 0,
                "lastOccurred": m.get("timestamp"),
                "description": m.get("description", ""),
            }
        pattern_counts[key]["count"] += 1
        pattern_counts[key]["lastOccurred"] = m.get("timestamp")

    patterns = sorted(pattern_counts.values(), key=lambda x: -x["count"])

    # Generate suggestions
    for p in patterns:
        if p["count"] >= 5:
            p["severity"] = "critical"
            p["suggestion"] = f"You've made this mistake {p['count']} times. Focus on understanding the core concept."
        elif p["count"] >= 3:
            p["severity"] = "warning"
            p["suggestion"] = f"Recurring error in {p['topic']}. Try a practice set focused on this area."
        else:
            p["severity"] = "info"
            p["suggestion"] = f"Minor pattern detected. Review {p['topic']} concepts."

    return jsonify({
        "success": True,
        "patterns": patterns[:20],  # type: ignore[index]
        "totalMistakes": len(mistakes),
        "uniquePatterns": len(patterns),
    })


@app.route("/mistakes", methods=["POST"])
def log_mistake():
    data = request.get_json(silent=True) or {}
    uid = data.get("userId", "default")
    profile = _load_user(uid)

    mistake = {
        "topic": data.get("topic", "General"),
        "type": data.get("type", "unknown"),  # formula_confusion, concept_gap, rushing, etc.
        "description": data.get("description", ""),
        "timestamp": datetime.now().isoformat(),
    }

    patterns = profile.get("mistakePatterns", [])
    patterns.append(mistake)
    if len(patterns) > 200:
        patterns = patterns[-200:]
    profile["mistakePatterns"] = patterns
    _save_user(uid, profile)

    return jsonify({"success": True, "logged": mistake})


# ---------------------------------------------------------------------------
# Behavior Tracking
# ---------------------------------------------------------------------------
@app.route("/behavior", methods=["POST"])
def log_behavior():
    data = request.get_json(silent=True) or {}
    uid = data.get("userId", "default")
    profile = _load_user(uid)

    session = {
        "topic": data.get("topic", "General"),
        "duration": data.get("duration", 0),  # minutes
        "activity": data.get("activity", "study"),  # study, quiz, review, exercise
        "score": data.get("score"),
        "timestamp": datetime.now().isoformat(),
    }

    log = profile.get("behaviorLog", [])
    log.append(session)
    if len(log) > 500:
        log = log[-500:]
    profile["behaviorLog"] = log

    # Update study schedule stats
    sched = profile.get("studySchedule", {})
    sched["totalStudyHours"] = round(sched.get("totalStudyHours", 0) + session["duration"] / 60, 2)  # type: ignore[operator]
    sched["sessionsCount"] = sched.get("sessionsCount", 0) + 1
    profile["studySchedule"] = sched
    profile["lastActive"] = datetime.now().isoformat()

    _save_user(uid, profile)
    return jsonify({"success": True, "session": session})


@app.route("/behavior", methods=["GET"])
def get_behavior():
    uid = request.args.get("userId", "default")
    limit = int(request.args.get("limit", 50))
    profile = _load_user(uid)
    log = profile.get("behaviorLog", [])

    # Basic analytics
    total_sessions = len(log)
    total_minutes = sum(b.get("duration", 0) for b in log)
    recent = [b for b in log if _is_recent(b.get("timestamp", ""), 7)]
    weekly_minutes = sum(b.get("duration", 0) for b in recent)

    return jsonify({
        "success": True,
        "sessions": log[-limit:],
        "analytics": {
            "totalSessions": total_sessions,
            "totalMinutes": total_minutes,
            "totalHours": round(total_minutes / 60, 1),  # type: ignore[call-overload]
            "weeklyMinutes": weekly_minutes,
            "averageSessionLength": round(total_minutes / max(1, total_sessions), 1),  # type: ignore[call-overload]
        },
    })


# ---------------------------------------------------------------------------
# Exam Simulation
# ---------------------------------------------------------------------------
@app.route("/simulate-exam", methods=["POST"])
def simulate_exam():
    data = request.get_json(silent=True) or {}
    uid = data.get("userId", "default")
    exam_topics = data.get("topics", [])
    profile = _load_user(uid)
    kg = profile.get("knowledgeGraph", {})
    flat = _flatten_knowledge({"children": kg})

    topic_map = {t["topic"].lower(): t for t in flat}

    results = []
    total_score = 0
    covered = 0

    for topic_name in exam_topics:
        t = topic_map.get(topic_name.lower())
        if t:
            mastery = t["mastery"]
            retention = t.get("retention", 1.0)
            effective = mastery * retention
            predict = round(min(100, effective * 0.9 + 5), 1)
            results.append({
                "topic": topic_name,
                "mastery": mastery,
                "retention": round(retention * 100, 1),
                "predictedScore": predict,
                "status": "strong" if predict >= 70 else "moderate" if predict >= 45 else "weak",
            })
            total_score += predict
            covered += 1
        else:
            results.append({
                "topic": topic_name,
                "mastery": 0,
                "retention": 0,
                "predictedScore": 10,
                "status": "unknown",
            })
            total_score += 10
            covered += 1

    overall = round(total_score / max(1, covered), 1)  # type: ignore[call-overload]

    time_mgmt = "good"
    if overall < 40:
        time_mgmt = "poor"
    elif overall < 60:
        time_mgmt = "moderate"

    return jsonify({
        "success": True,
        "simulation": {
            "overallScore": overall,
            "topicResults": results,
            "questionsLikelySolved": f"{round(overall)}%",
            "timeManagement": time_mgmt,
            "riskAreas": [r["topic"] for r in results if r["status"] in ("weak", "unknown")],
            "recommendation": _sim_recommendation(overall),
        },
        "timestamp": datetime.now().isoformat(),
    })


def _sim_recommendation(score: float) -> str:
    if score >= 80:
        return "You're well-prepared! Focus on speed and precision during the exam."
    if score >= 60:
        return "Good foundation. Revise your weak areas and practice timed questions."
    if score >= 40:
        return "More preparation needed. Focus on high-priority weak topics first."
    return "Significant gaps detected. Create a structured study plan and prioritize fundamentals."


# ---------------------------------------------------------------------------
# AI Twin Chat — Smart Command-Aware Conversational AI
# ---------------------------------------------------------------------------
AI_TWIN_SYSTEM = """You are an AI Digital Twin, a personalized learning companion and intelligent study planner. You have full control over the student's learning system.

CAPABILITIES:
1. Add subjects and topics to the student's knowledge graph.
2. Create detailed weekly study plans with specific days, time slots, and durations.
3. Analyze focus areas based on mastery levels.
4. Teach any subject as an expert professor.
5. Set study goals, predict performance, and track progress.
6. Control the AI Twin Arena UI by returning XML-like action tags inline in your response when the user asks to see a specific feature or view.

UI ACTION COMMANDS:
- To show the simulation tab (e.g., user asks to run a simulation or test themselves): include `<action type="start_simulation" topics="Topic1, Topic2" />`
- To show weaknesses: include `<action type="navigate" targetTab="weaknesses" />`
- To show memory decay: include `<action type="navigate" targetTab="memory" />`
- To show predictions: include `<action type="navigate" targetTab="predictions" />`
- To show knowledge graph: include `<action type="navigate" targetTab="knowledge" />`

BEHAVIOR RULES:
1. When asked to create a study plan, you will propose a 7-day weekly timetable (Monday - Sunday).
2. Use the <action> tags only when the user explicitly asks to view/use that specific feature.
3. Speak in a warm, professional, and intelligent tone.
4. Do NOT use markdown formatting, hashtags, asterisks, or bullets. Use plain conversational text only.
5. When creating study plans, format them as natural sentences detailing the weekly schedule."""


# --- Smart command parser ---
# Words/phrases that should NEVER be treated as subject topics
_SUBJECT_BLOCKLIST = {
    # App UI terms
    "study planner", "planner", "timetable", "schedule", "study plan",
    "knowledge graph", "ai twin", "ai chat", "overview", "predictions",
    "weaknesses", "memory monitor", "simulation", "dashboard",
    # Vague intent phrases
    "subjects", "topics", "things", "some", "few", "many", "all",
    "it", "them", "these", "those", "this", "that",
    # Common filler words
    "i", "me", "my", "we", "you", "he", "she", "they",
    "want", "have", "to", "put", "add", "into", "in", "on",
    "the", "a", "an", "is", "are", "was", "be", "been",
    "make", "create", "build", "please", "can", "could",
    "for", "from", "at", "by", "with", "and", "or", "but",
    "study", "learn", "plan", "prepare", "cover", "start",
    "today", "tomorrow", "now", "later", "next", "this", "week",
    "hours", "hour", "mins", "minutes", "min", "session", "time",
    # Numbers written out
    "one", "two", "three", "four", "five", "six", "seven", "eight",
    "nine", "ten", "first", "second", "third",
}


def _extract_subjects(message: str) -> list:
    """Extract actual subject/topic names from a user message.

    Returns an empty list if no clear subject names are found —
    so the AI asks for clarification rather than extracting garbage.
    """
    msg_lower = message.lower().strip()
    import re as _re

    # --- Guard: if user says "X subjects" without naming them, return empty ---
    vague_count_pattern = r'\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+subjects?\b'
    if _re.search(vague_count_pattern, msg_lower):
        # Only proceed if there are actual comma-separated items after
        if ',' not in msg_lower:
            return []   # User said "6 subjects" but didn't name them → ask AI to ask

    # --- Step 1: Match against known academic subjects (safest) ---
    known_subjects = [
        "Mathematics", "Physics", "Chemistry", "Biology", "English",
        "History", "Geography", "Computer Science", "Economics",
        "Psychology", "Philosophy", "Sociology", "Political Science",
        "Art", "Music", "Literature", "Statistics", "Accounting",
        "Business Studies", "Environmental Science",
        # Programming
        "Python", "JavaScript", "Java", "C++", "HTML", "CSS", "React",
        "Node.js", "SQL", "Machine Learning", "Data Science",
        "Artificial Intelligence", "Web Development", "Flutter", "Django",
        "FastAPI", "TypeScript", "Kotlin", "Swift", "Go", "Rust",
        # Math sub-topics
        "Algebra", "Calculus", "Geometry", "Trigonometry", "Probability",
        "Linear Algebra", "Differential Equations", "Statistics",
        # Science sub-topics
        "Organic Chemistry", "Quantum Physics", "Thermodynamics",
        "Genetics", "Ecology", "Anatomy", "Botany", "Zoology",
        # Data Structures & CS
        "Data Structures", "Algorithms", "Arrays", "Trees", "Graphs",
        "Sorting", "Searching", "Dynamic Programming", "Operating Systems",
        "Networking", "Database", "System Design", "DevOps",
    ]

    found = []
    seen = set()
    for subject in known_subjects:
        if subject.lower() in msg_lower:
            if subject not in seen:
                found.append(subject)
                seen.add(subject)

    # --- Step 2: Dynamic extraction — only when subjects are LISTED (commas / "and X and Y") ---
    # Only look for lists if the message contains commas or multiple "and" conjunctions
    has_list_structure = ',' in msg_lower or msg_lower.count(' and ') >= 2

    if has_list_structure:
        # Pattern: after plan-verbs, grab comma/and separated items
        list_pattern = r'(?:study|learn|prepare\s+for|cover|focus\s+on|plan\s+for|teach\s+me|topics?:?|subjects?:?)\s+([\w\s,&]+?)(?:\s+(?:from|at|today|tomorrow|this|next|for\s+\d|\d)|$)'
        match = _re.search(list_pattern, msg_lower)

        if match:
            raw_list = match.group(1)
            raw_list = _re.sub(r'\band\b', ',', raw_list)
            raw_list = _re.sub(r'&', ',', raw_list)
            parts = [x.strip().title() for x in raw_list.split(',') if x.strip()]
            for pt in parts:
                clean = pt.strip()
                clean_lower = clean.lower()
                # Only add if not in blocklist, not already found, has real length
                if (clean and
                        len(clean) > 2 and
                        clean_lower not in _SUBJECT_BLOCKLIST and
                        clean not in seen and
                        not _re.match(r'^\d+$', clean)):  # not a number
                    found.append(clean)
                    seen.add(clean)

    # --- Step 3: Fallback ONLY when message has commas (explicit list) and nothing found yet ---
    if not found and ',' in msg_lower:
        # Grab comma-separated items anywhere in message
        parts = [x.strip().title() for x in msg_lower.split(',')]
        for pt in parts:
            clean = pt.strip()
            clean_lower = clean.lower()
            if (clean and
                    len(clean) > 2 and
                    clean_lower not in _SUBJECT_BLOCKLIST and
                    clean not in seen and
                    not _re.match(r'^\d+$', clean)):
                found.append(clean)
                seen.add(clean)

    return found


def _extract_time_range(message: str) -> tuple:
    """Extract start_time, end_time, and total_hours. Returns (start_datetime, end_datetime, hours)."""
    import re as _re
    from datetime import datetime, timedelta
    
    msg_lower = message.lower()
    now = datetime.now()
    
    # Defaults: next hour, duration 2 hours
    default_start = now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    if default_start <= now:
        default_start += timedelta(hours=1)
    default_end = default_start + timedelta(hours=2)
    start_dt = default_start
    end_dt = default_end
    
    # Try to find "from X to Y" or "between X and Y"
    time_pattern = r'(?:from|between)?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|and|-)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)'
    match = _re.search(time_pattern, msg_lower)
    
    def parse_time(ts: str) -> datetime:
        ts = ts.strip().lower()
        is_pm = 'pm' in ts
        is_am = 'am' in ts
        ts = ts.replace('am', '').replace('pm', '').strip()
        
        if ':' in ts:
            parts = ts.split(':')
            h = int(parts[0])
            m = int(parts[1])
        else:
            h = int(ts)
            m = 0
            
        if is_pm and h < 12:
            h += 12
        elif is_am and h == 12:
            h = 0
        elif not is_am and not is_pm and h < 8:
            h += 12
            
        res = now.replace(hour=h, minute=m, second=0, microsecond=0)
        if res < now - timedelta(hours=2):
            res += timedelta(days=1)
        return res

    if match:
        try:
            start_dt = parse_time(match.group(1))
            end_dt = parse_time(match.group(2))
            if end_dt <= start_dt:
                end_dt += timedelta(days=1)
        except Exception:
            pass
    else:
        # Check if they just provided duration e.g. "for 3 hours"
        duration_hours = _extract_hours(message)
        if duration_hours > 0:
            end_dt = start_dt + timedelta(hours=duration_hours)
            
    hours = (end_dt - start_dt).total_seconds() / 3600.0
    return start_dt, end_dt, hours


def _extract_hours(message: str) -> float:
    """Extract study duration in hours from user message."""
    msg_lower = message.lower()
    import re as _re

    # Match patterns like "4 hours", "2.5 hours", "90 minutes", "1.5 hrs"
    hour_patterns = [
        r'(\d+\.?\d*)\s*(?:hours?|hrs?)',
        r'(\d+\.?\d*)\s*(?:hour)',
    ]
    for pattern in hour_patterns:
        match = _re.search(pattern, msg_lower)
        if match:
            return float(match.group(1))

    min_patterns = [r'(\d+)\s*(?:minutes?|mins?)']
    for pattern in min_patterns:
        match = _re.search(pattern, msg_lower)
        if match:
            return float(match.group(1)) / 60

    return 0


def _is_plan_request(message: str) -> bool:
    """Check if the user is asking for a study plan or schedule."""
    msg_lower = message.lower()
    plan_keywords = [
        "study plan", "schedule", "timetable", "time table", "routine",
        "plan for", "prepare for", "plan my", "create a plan",
        "how should i study", "help me study", "organize my study",
        "plan my study", "make a plan", "study schedule",
        "want to study", "need to study", "going to study",
        "prepare me", "teach me", "start studying",
        "want to learn", "help me learn", "i want to cover",
        "make timetable", "create timetable", "make time table",
        "create time table", "want to make timetable",
        "want to create timetable", "build timetable",
        "make a timetable", "create a timetable",
        "make a time table", "create a time table",
        "want a timetable", "want a time table",
        "generate timetable", "generate a timetable",
    ]
    return any(kw in msg_lower for kw in plan_keywords)


def _add_topics_to_knowledge_graph(uid: str, topics: list) -> list:
    """Add new topics to the user's knowledge graph. Returns list of newly added topics."""
    profile = _load_user(uid)
    kg = profile.get("knowledgeGraph", {})
    added = []

    for topic in topics:
        # Check if already exists
        existing = _find_topic_node(kg, topic)
        if existing is not None:
            continue

        # Find the best parent category or create under "Custom"
        parent = _find_best_parent(kg, topic)
        if parent is None:
            if "Custom" not in kg:
                kg["Custom"] = {"mastery": 0, "children": {}}  # type: ignore[index]
            parent = kg["Custom"]

        children = parent.get("children", {}) if isinstance(parent, dict) else {}
        children[topic] = {  # type: ignore[index]
            "mastery": 0,
            "lastStudied": None,
            "reviewCount": 0,
        }
        if isinstance(parent, dict):
            parent["children"] = children  # type: ignore[index]
        added.append(topic)

    if added:
        _update_parent_mastery(kg)
        profile["knowledgeGraph"] = kg
        profile["lastActive"] = datetime.now().isoformat()
        _save_user(uid, profile)

    return added


def _find_best_parent(kg: dict, topic: str) -> dict | None:
    """Find the best parent category for a topic in the knowledge graph."""
    topic_lower = topic.lower()

    # Subject → category mapping
    category_map = {
        "Mathematics": ["algebra", "calculus", "geometry", "trigonometry", "probability",
                       "linear algebra", "differential equations", "statistics"],
        "Programming": ["python", "javascript", "java", "c++", "html", "css", "react",
                        "node.js", "sql", "web development", "data structures", "algorithms",
                        "arrays", "trees", "graphs", "sorting", "searching", "dynamic programming"],
        "Communication": ["english", "literature", "writing", "presentation"],
    }

    # Check if topic matches a category's children
    for cat_name, children_keywords in category_map.items():
        if topic_lower in children_keywords:
            if cat_name in kg:
                return kg[cat_name]

    # Check if topic IS a main category
    science_subjects = ["physics", "chemistry", "biology", "organic chemistry",
                       "quantum physics", "thermodynamics", "genetics", "ecology",
                       "anatomy", "environmental science"]
    if topic_lower in science_subjects:
        if "Science" not in kg:
            kg["Science"] = {"mastery": 0, "children": {}}
        return kg["Science"]

    social_subjects = ["history", "geography", "economics", "psychology", "philosophy",
                       "sociology", "political science"]
    if topic_lower in social_subjects:
        if "Social Studies" not in kg:
            kg["Social Studies"] = {"mastery": 0, "children": {}}
        return kg["Social Studies"]

    ai_subjects = ["machine learning", "data science", "artificial intelligence"]
    if topic_lower in ai_subjects:
        if "Programming" in kg:
            return kg["Programming"]
        if "AI & Data Science" not in kg:
            kg["AI & Data Science"] = {"mastery": 0, "children": {}}
        return kg["AI & Data Science"]

    business_subjects = ["accounting", "business studies"]
    if topic_lower in business_subjects:
        if "Business" not in kg:
            kg["Business"] = {"mastery": 0, "children": {}}
        return kg["Business"]

    arts_subjects = ["art", "music"]
    if topic_lower in arts_subjects:
        if "Arts" not in kg:
            kg["Arts"] = {"mastery": 0, "children": {}}
        return kg["Arts"]

    return None


def _generate_study_plan_from_chat(topics, start_dt, end_dt):
    """Create a full 7-day structured timetable. Each topic appears every day at correct times."""
    from datetime import timedelta
    import math

    if not topics:
        return []

    # Period definitions in HH:MM format (standard school-style)
    PERIODS = [
        ("I",   "09:30", "10:20"),
        ("II",  "10:20", "11:10"),
        ("III", "11:10", "12:00"),
        # LUNCH 12:00-12:40
        ("IV",  "12:40", "13:30"),
        ("V",   "13:30", "14:20"),
        ("VI",  "14:20", "15:10"),
        ("VII", "15:10", "16:00"),
    ]

    DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    ICONS = ["📚", "📐", "🔬", "💡", "✏️", "🎯", "📖", "🧮", "⚗️"]

    # Build a topic → icon mapping
    topic_icons = {t: ICONS[i % len(ICONS)] for i, t in enumerate(topics)}

    plan: List[Dict[str, Any]] = []

    for day_name in DAYS:
        # Add each period
        for period_idx, (period_label, start_str, end_str) in enumerate(PERIODS):
            # Pick a topic for this slot via round-robin
            slot_index = (DAYS.index(day_name) + period_idx) % len(topics)
            topic = next((t for i, t in enumerate(topics) if i == slot_index), "")

            # Calculate duration in minutes
            sh, sm = map(int, start_str.split(":"))
            eh, em = map(int, end_str.split(":"))
            duration = (eh * 60 + em) - (sh * 60 + sm)

            plan.append({
                "day": day_name,
                "topic": topic.title(),
                "type": "study",
                "duration": duration,
                "startTime": start_str,
                "endTime": end_str,
                "periodLabel": period_label,
                "reason": f"{topic.title()} — Period {period_label}",
                "icon": topic_icons.get(topic, "📚"),
                "priority": "high" if period_idx < 3 else "medium",
                "order": len(plan),
            })

        # Add LUNCH block after period III
        plan.append({
            "day": day_name,
            "topic": "LUNCH",
            "type": "break",
            "duration": 40,
            "startTime": "12:00",
            "endTime": "12:40",
            "periodLabel": "LUNCH",
            "reason": "Lunch break",
            "icon": "🍱",
            "priority": "low",
            "order": len(plan),
        })

    # Sort by day then startTime for predictable order
    day_order = {d: i for i, d in enumerate(DAYS)}
    plan.sort(key=lambda x: (day_order.get(x["day"], 99), x["startTime"]))

    return plan


def _save_pending_plan(uid: str, plan: list, topics: list, total_hours: float, start_time: str = "", end_time: str = ""):
    """Store a proposed plan as pending — not yet applied."""
    profile = _load_user(uid)
    profile["pendingPlan"] = {
        "plan": plan,
        "totalDuration": sum(p["duration"] for p in plan),
        "topics": topics,
        "totalHours": total_hours,
        "startTime": start_time,
        "endTime": end_time,
        "createdAt": datetime.now().isoformat(),
        "status": "pending",
    }
    _save_user(uid, profile)


def _apply_pending_plan(uid: str) -> dict | None:
    """Move the pending plan to the active study plan."""
    profile = _load_user(uid)
    pending = profile.get("pendingPlan")

    if not pending or not isinstance(pending, dict) or pending.get("status") != "pending":
        return None

    # Use type safe variables
    plan_items = pending.get("plan", [])  # type: ignore[attr-defined, union-attr]
    total_duration = pending.get("totalDuration", 0)  # type: ignore[attr-defined, union-attr]
    pending_topics = pending.get("topics", [])  # type: ignore[attr-defined, union-attr]
    total_hours = pending.get("totalHours", 0.0)  # type: ignore[attr-defined, union-attr]
    start_time = pending.get("startTime", "")  # type: ignore[attr-defined, union-attr]
    end_time = pending.get("endTime", "")  # type: ignore[attr-defined, union-attr]

    profile["aiStudyPlan"] = {
        "plan": plan_items,
        "totalDuration": total_duration,
        "topics": pending_topics,
        "totalHours": total_hours,
        "startTime": start_time,
        "endTime": end_time,
        "createdAt": datetime.now().isoformat(),
    }
    # Create a fresh pending object to avoid type issues instead of modifying in-place
    new_pending = {
        "plan": plan_items,
        "totalDuration": total_duration,
        "topics": pending_topics,
        "totalHours": total_hours,
        "startTime": start_time,
        "endTime": end_time,
        "createdAt": pending.get("createdAt", datetime.now().isoformat()) if isinstance(pending, dict) else datetime.now().isoformat(),
        "status": "accepted"
    }
    profile["pendingPlan"] = new_pending
    profile["lastActive"] = datetime.now().isoformat()
    _save_user(uid, profile)
    return profile["aiStudyPlan"]


def _reject_pending_plan(uid: str):
    """Mark pending plan as rejected."""
    profile = _load_user(uid)
    pending = profile.get("pendingPlan")
    if pending and isinstance(pending, dict):
        pending["status"] = "rejected"
        profile["pendingPlan"] = pending
        _save_user(uid, profile)


def _is_accept_message(message: str) -> bool:
    """Check if user is accepting a proposed plan."""
    msg = message.lower().strip()
    accept_phrases = [
        "yes", "ok", "okay", "sure", "accept", "approve", "apply",
        "looks good", "go ahead", "do it", "confirmed", "confirm",
        "perfect", "great", "agreed", "apply it", "set it",
        "save it", "apply the plan", "accept the plan", "i accept",
        "yes please", "yep", "yeah",
    ]
    return any(msg == phrase or msg.startswith(phrase) for phrase in accept_phrases)


def _is_reject_message(message: str) -> bool:
    """Check if user is rejecting a proposed plan."""
    msg = message.lower().strip()
    reject_phrases = [
        "no", "reject", "cancel", "change", "modify", "different",
        "not good", "redo", "try again", "nope", "nah",
    ]
    return any(msg == phrase or msg.startswith(phrase) for phrase in reject_phrases)


# ---------------------------------------------------------------------------
# Timetable Conversation State (multi-turn guided flow)
# ---------------------------------------------------------------------------
def _get_timetable_conversation(uid: str) -> dict:
    """Get the current timetable conversation state for a user."""
    profile = _load_user(uid)
    return profile.get("timetableConversation", {})


def _set_timetable_conversation(uid: str, state: str | None, subject_count: int = 0, subjects: list | None = None):
    """Set or clear the timetable conversation state."""
    profile = _load_user(uid)
    if state is None:
        profile.pop("timetableConversation", None)
    else:
        profile["timetableConversation"] = {
            "state": state,
            "subjectCount": subject_count,
            "subjects": subjects or [],
            "updatedAt": datetime.now().isoformat(),
        }
    _save_user(uid, profile)


def _extract_number(message: str) -> int | None:
    """Extract a single number from a message (for subject count)."""
    import re as _re
    msg = message.strip().lower()

    # Word-to-number mapping
    word_nums = {
        "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
        "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
        "eleven": 11, "twelve": 12,
    }
    for word, num in word_nums.items():
        if word in msg:
            return num

    # Digit match
    match = _re.search(r'\b(\d{1,2})\b', msg)
    if match:
        val = int(match.group(1))
        if 1 <= val <= 20:
            return val
    return None


def _extract_subject_list(message: str, expected_count: int) -> list:
    """Extract a list of subject names from user message (comma / newline / 'and' separated)."""
    import re as _re
    msg = message.strip()

    # Normalize separators
    msg_clean = _re.sub(r'\band\b', ',', msg, flags=_re.IGNORECASE)
    msg_clean = _re.sub(r'\n+', ',', msg_clean)

    # Remove numbering like "1. " or "1) "
    msg_clean = _re.sub(r'\b\d+[.)\-]\s*', ',', msg_clean)

    parts = [p.strip().strip('.,;') for p in msg_clean.split(',') if p.strip().strip('.,;')]

    # Filter out very short / blocklist items
    subjects = []
    for p in parts:
        clean = p.strip().title()
        if len(clean) >= 2 and clean.lower() not in _SUBJECT_BLOCKLIST:
            subjects.append(clean)

    return subjects


@app.route("/chat", methods=["POST"])
def ai_chat():
    """Smart AI Twin Chat — proposes plans for approval, modifies learning data."""
    try:
        return _ai_chat_impl()
    except Exception as exc:
        import traceback as _tb
        print(f"[AI Twin /chat ERROR] {type(exc).__name__}: {exc}")
        _tb.print_exc()
        return jsonify({
            "success": True,
            "response": (
                "I'm having a momentary issue processing your request. "
                "Please try again or rephrase your question."
            ),
            "actions": [],
            "proposedPlan": None,
            "model": OLLAMA_MODEL,
            "timestamp": datetime.now().isoformat(),
            "error_detail": str(exc),
        })


def _ai_chat_impl():
    """Inner implementation of the AI chat handler."""
    data = request.get_json(silent=True) or {}
    uid = data.get("userId", "default")
    message = data.get("message", "")
    image_b64 = data.get("imageBase64", "")
    history = data.get("history", []) or []

    if not message and not image_b64:
        return jsonify({"error": "message or image required"}), 400

    actions_taken: List[Dict[str, Any]] = []
    proposed_plan = None  # Will contain plan data if proposing
    
    # ── NEW: Handle Timetable Image Upload ──
    if image_b64:
        if not GEMINI_SUPPORT:
            return jsonify({
                "success": True,
                "response": "I cannot process images right now because Gemini Vision is not enabled on this environment.",
                "actions": [],
                "model": "system",
                "timestamp": datetime.now().isoformat()
            })
            
        try:
            _init_gemini()
            model = genai.GenerativeModel("gemini-1.5-flash")
            image_data = {"mime_type": "image/jpeg", "data": image_b64}
            prompt = """Extract the timetable grid from this image. 
Return ONLY a strictly formatted JSON array containing the study and break blocks.
Format exactly like this example array:
[
  {
    "day": "Monday",
    "topic": "Eng",
    "startTime": "09:30",
    "endTime": "10:20",
    "duration": 50,
    "type": "study",
    "priority": "high",
    "icon": "📚",
    "reason": "Imported from timetable"
  }
]
Extract every distinct class/block shown in the image, preserving the Exact day and Time properly. Return strictly raw JSON."""

            print("[AI Twin] Extracting timetable from uploaded image using Gemini...")
            response = model.generate_content([image_data, prompt])
            raw_text = response.text
            
            extracted_plan = _parse_json_from_llm(raw_text)
            
            if isinstance(extracted_plan, list) and len(extracted_plan) > 0:
                topics = list(set([p["topic"] for p in extracted_plan if p.get("topic") and p.get("topic") not in ("LUNCH", "LAB", "LIBRARY", "SPORTS", "SEMINAR")]))
                _save_pending_plan(uid, extracted_plan, topics, 0, start_time="09:00", end_time="17:00")
                
                proposed_plan = {
                    "plan": extracted_plan,
                    "topics": topics,
                    "totalMinutes": sum(p.get("duration", 60) for p in extracted_plan),
                    "breaks": len([p for p in extracted_plan if p.get("type") == "break" or p.get("topic") == "LUNCH"]),
                    "totalHours": 0,
                    "startTime": "09:00",
                    "endTime": "17:00",
                }
                
                return jsonify({
                    "success": True,
                    "response": f"I extracted {len(extracted_plan)} blocks across {len(topics)} subjects from your timetable image! Detected subjects: {', '.join(topics)}. Would you like to accept and apply this exact schedule to your Study Planner?",
                    "actions": [{
                        "type": "plan_proposed",
                        "description": "Extracted comprehensive timetable from your uploaded image. Waiting for your approval.",
                    }],
                    "proposedPlan": proposed_plan,
                    "model": "gemini-1.5-flash",
                    "timestamp": datetime.now().isoformat(),
                })
            else:
                return jsonify({
                    "success": True,
                    "response": "I tried to read the timetable from your image, but I couldn't extract a valid schedule array. Could you try a clearer or brighter image?",
                    "actions": [],
                    "model": "gemini-1.5-flash",
                    "timestamp": datetime.now().isoformat(),
                })
        except Exception as e:
            print(f"[AI Twin Error] Image extraction failed: {e}")
            return jsonify({
                "success": True,
                "response": "I encountered an error trying to process your image. Please try again later.",
                "actions": [],
                "model": "system",
                "timestamp": datetime.now().isoformat(),
            })

    # --- Check if user is accepting/rejecting a pending plan ---
    profile = _load_user(uid)
    pending = profile.get("pendingPlan", {})
    has_pending = pending.get("status") == "pending"

    if has_pending and _is_accept_message(message):
        result = _apply_pending_plan(uid)
        if result:
            actions_taken.append({
                "type": "plan_accepted",
                "description": f"Study plan accepted and applied! {len(result.get('topics', []))} subjects scheduled.",
            })
            # Simple response for accept
            return jsonify({
                "success": True,
                "response": f"Your study plan has been applied. Go to the Study Planner tab to see your schedule with {', '.join(result.get('topics', []))}. Start when you are ready!",
                "actions": actions_taken,
                "model": OLLAMA_MODEL,
                "timestamp": datetime.now().isoformat(),
            })

    if has_pending and _is_reject_message(message):
        _reject_pending_plan(uid)
        actions_taken.append({
            "type": "plan_rejected",
            "description": "Study plan rejected. Tell me what you would like to change.",
        })
        return jsonify({
            "success": True,
            "response": "No problem, I have discarded that plan. Tell me what you would like to change. You can mention different subjects, adjust the hours, or ask for a completely new plan.",
            "actions": actions_taken,
            "model": OLLAMA_MODEL,
            "timestamp": datetime.now().isoformat(),
        })

    # ── Multi-turn timetable conversation flow ───────────────────────
    tt_conv = _get_timetable_conversation(uid)
    tt_state = tt_conv.get("state")

    # STATE 1: We asked "how many subjects?" — user should reply with a number
    if tt_state == "awaiting_subject_count":
        count = _extract_number(message)
        if count and 1 <= count <= 20:
            _set_timetable_conversation(uid, "awaiting_subject_names", subject_count=count)
            return jsonify({
                "success": True,
                "response": f"Great! You want {count} subject(s) in your timetable. Please list all {count} subjects separated by commas. For example: Physics, Chemistry, Mathematics, English, Biology",
                "actions": [{
                    "type": "timetable_ask_subjects",
                    "description": f"Waiting for {count} subject names...",
                }],
                "model": OLLAMA_MODEL,
                "timestamp": datetime.now().isoformat(),
            })
        else:
            return jsonify({
                "success": True,
                "response": "Please tell me a number between 1 and 20. How many subjects do you want in your timetable?",
                "actions": [],
                "model": OLLAMA_MODEL,
                "timestamp": datetime.now().isoformat(),
            })

    # STATE 2: We asked for subject names — user should reply with a list
    if tt_state == "awaiting_subject_names":
        expected_count = tt_conv.get("subjectCount", 5)
        subjects = _extract_subject_list(message, expected_count)

        if not subjects:
            return jsonify({
                "success": True,
                "response": f"I could not find any subject names in your message. Please list your {expected_count} subjects separated by commas. For example: Physics, Chemistry, Mathematics",
                "actions": [],
                "model": OLLAMA_MODEL,
                "timestamp": datetime.now().isoformat(),
            })

        # Clear conversation state
        _set_timetable_conversation(uid, None)

        # Add topics to knowledge graph
        added = _add_topics_to_knowledge_graph(uid, subjects)
        if added:
            actions_taken.append({
                "type": "topics_added",
                "topics": added,
                "description": f"Added {len(added)} new topic(s) to your knowledge graph: {', '.join(added)}",
            })

        # Generate the timetable
        start_dt, end_dt, extracted_hours = _extract_time_range("for 2 hours")
        generated_plan = _generate_study_plan_from_chat(subjects, start_dt, end_dt)

        if generated_plan:
            start_str = start_dt.strftime("%H:%M")
            end_str = end_dt.strftime("%H:%M")
            _save_pending_plan(uid, generated_plan, subjects, extracted_hours, start_time=start_str, end_time=end_str)
            proposed_plan = {
                "plan": generated_plan,
                "topics": subjects,
                "totalMinutes": sum(p["duration"] for p in generated_plan),
                "breaks": len([p for p in generated_plan if p["type"] == "break"]),
                "totalHours": extracted_hours,
                "startTime": start_str,
                "endTime": end_str,
            }
            actions_taken.append({
                "type": "plan_proposed",
                "description": f"Proposed timetable with {len(subjects)} subjects: {', '.join(subjects)}. Waiting for your approval.",
            })

            # Build a nice response listing the plan
            plan_lines = [f"Here is your {len(subjects)}-subject timetable! I have created a 7-day weekly schedule with the following subjects: {', '.join(subjects)}.\n"]
            current_day = ""
            for p in generated_plan:
                if p.get("day") != current_day:
                    current_day = p.get("day", "")
                    plan_lines.append(f"\n{current_day}:")
                plan_lines.append(f"  {p.get('icon', '')} [{p.get('startTime')} - {p.get('endTime')}] {p['topic']} ({p['duration']} mins)")

            plan_lines.append(f"\nTotal study blocks: {len([p for p in generated_plan if p['type'] != 'break'])}")
            plan_lines.append("\nWould you like to accept this timetable or make changes?")

            return jsonify({
                "success": True,
                "response": "\n".join(plan_lines),
                "actions": actions_taken,
                "proposedPlan": proposed_plan,
                "model": OLLAMA_MODEL,
                "timestamp": datetime.now().isoformat(),
            })

    # --- Step 1: Extract subjects from the message ---
    extracted_topics = _extract_subjects(message)
    start_dt, end_dt, extracted_hours = _extract_time_range(message)
    is_plan = _is_plan_request(message)

    # ── NEW: If user wants a timetable but didn't provide subjects, start guided flow ──
    if is_plan and not extracted_topics:
        _set_timetable_conversation(uid, "awaiting_subject_count")
        return jsonify({
            "success": True,
            "response": "I would love to help you create a timetable! First, tell me — how many subjects do you want to include in your timetable?",
            "actions": [{
                "type": "timetable_ask_count",
                "description": "Starting timetable creation wizard...",
            }],
            "model": OLLAMA_MODEL,
            "timestamp": datetime.now().isoformat(),
        })

    # --- Step 2: Auto-add new topics to knowledge graph ---
    added_topics = []
    if extracted_topics:
        added_topics = _add_topics_to_knowledge_graph(uid, extracted_topics)
        if added_topics:
            actions_taken.append({
                "type": "topics_added",
                "topics": added_topics,  # type: ignore[dict-item]
                "description": f"Added {len(added_topics)} new topic(s) to your knowledge graph: {', '.join(added_topics)}",
            })

    # --- Step 3: Generate study plan PROPOSAL (not saved yet) ---
    generated_plan = []
    if is_plan and extracted_topics:
        generated_plan = _generate_study_plan_from_chat(extracted_topics, start_dt, end_dt)
        if generated_plan:
            start_str = start_dt.strftime("%H:%M")
            end_str = end_dt.strftime("%H:%M")
            # Save as PENDING, not active
            _save_pending_plan(uid, generated_plan, extracted_topics, extracted_hours, start_time=start_str, end_time=end_str)
            proposed_plan = {
                "plan": generated_plan,
                "topics": extracted_topics,
                "totalMinutes": sum(p["duration"] for p in generated_plan),
                "breaks": len([p for p in generated_plan if p["type"] == "break"]),
                "totalHours": extracted_hours,
                "startTime": start_str,
                "endTime": end_str,
            }
            actions_taken.append({
                "type": "plan_proposed",
                "description": f"Proposed timetable: {len(extracted_topics)} subjects from {start_dt.strftime('%I:%M %p')} to {end_dt.strftime('%I:%M %p')}. Waiting for your approval.",
            })

    # --- Step 4: Build personalized context ---
    profile = _load_user(uid)  # reload after potential changes
    kg = profile.get("knowledgeGraph", {})
    flat = _flatten_knowledge({"children": kg})
    studied = [t for t in flat if t["mastery"] > 0]

    context_parts = [f"Student name: {profile.get('name', 'Learner')}"]

    if studied:
        strengths = [t["topic"] for t in sorted(studied, key=lambda x: -x["mastery"])[:5]]  # type: ignore[index]
        weaknesses = [t["topic"] for t in sorted(studied, key=lambda x: x["mastery"])[:5] if t["mastery"] < 60]  # type: ignore[index]
        avg_mastery = round(sum(t["mastery"] for t in studied) / len(studied), 1)  # type: ignore[call-overload]
        context_parts.append(f"Average mastery: {avg_mastery}%")
        context_parts.append(f"Strong topics: {', '.join(strengths) if strengths else 'None yet'}")
        context_parts.append(f"Weak topics: {', '.join(weaknesses) if weaknesses else 'None detected'}")
    else:
        context_parts.append("This is a new student with no study history yet.")

    # Tell AI what actions were taken so it responds naturally
    if actions_taken:
        context_parts.append("\nACTIONS JUST PERFORMED:")
        for a in actions_taken:
            context_parts.append(f"- {a['description']}")
    if proposed_plan:
        plan_desc = []
        for p in generated_plan:
            plan_desc.append(f"[{p.get('startTime')} - {p.get('endTime')}] {p['topic']} ({p['duration']} mins)")
        context_parts.append(f"\nPROPOSED STUDY TIMETABLE (pending approval):\n" + "\n".join(plan_desc))
        context_parts.append("\nPresent this exact chronological timetable to the student in plain text. List each time slot. End by asking if they want to accept or change it.")

    student_context = "\n".join(context_parts)
    system_prompt = f"{AI_TWIN_SYSTEM}\n\nStudent Profile:\n{student_context}"

    # --- Step 5: Build prompt ---
    prompt_parts: List[str] = []
    for h in history[-10:]:  # type: ignore[index]
        role = h.get("role", "user")
        content = h.get("content", "")
        if role == "user":
            prompt_parts.append(f"Student: {content}")
        else:
            prompt_parts.append(f"AI Twin: {content}")
    prompt_parts.append(f"Student: {message}")
    prompt_parts.append("AI Twin:")

    full_prompt = "\n".join(prompt_parts)

    # --- Step 6: Generate AI response ---
    response_text = _ai_generate(full_prompt, system_prompt)

    # Parse <action> tags from response_text
    import re as _re
    if response_text:
        action_pattern = r'<action\s+(.*?)\s*/>'
        matches = _re.finditer(action_pattern, response_text)
        for match in matches:
            attrs_str = match.group(1)
            action_obj = {}
            for attr_match in _re.finditer(r'([a-zA-Z]+)="([^"]+)"', attrs_str):
                action_obj[attr_match.group(1)] = attr_match.group(2)
            
            if action_obj.get('type') == 'navigate':
                actions_taken.append({
                    "type": "navigate",
                    "targetTab": action_obj.get("targetTab"),
                    "description": f"Navigating to {action_obj.get('targetTab')}...",
                })
            elif action_obj.get('type') == 'start_simulation':
                actions_taken.append({
                    "type": "start_simulation",
                    "topics": [t.strip() for t in action_obj.get("topics", "").split(",")],
                    "description": "Starting exam simulation...",
                })
        
        # Remove actions from the user-facing text
        response_text = _re.sub(action_pattern, '', response_text).strip()

    if not response_text:
        # Offline fallback
        if proposed_plan:
            parts = []
            if added_topics:
                parts.append(f"I have added {', '.join(added_topics)} to your knowledge graph.")  # type: ignore[arg-type]
            parts.append("\nHere is the study plan I am proposing for you:\n")  # type: ignore[arg-type]
            for p in generated_plan:
                p_type = p.get("type", "unknown")
                p_icon = p.get("icon", "")
                p_dur = p.get("duration", 0)
                p_topic = p.get("topic", "Unknown")
                p_start = p.get("startTime", "")
                p_end = p.get("endTime", "")
                parts.append(f"  {p_icon} [{p_start} - {p_end}] {p_topic} ({p_dur} mins)")  # type: ignore[arg-type]
            
            p_mins = proposed_plan.get("totalMinutes", 0)  # type: ignore[attr-defined, union-attr]
            p_breaks = proposed_plan.get("breaks", 0)  # type: ignore[attr-defined, union-attr]
            parts.append(f"\nTotal time: {p_mins} minutes with {p_breaks} break(s).")  # type: ignore[arg-type]
            parts.append("\nWould you like to accept this plan or make changes?")  # type: ignore[arg-type]
            response_text = "\n".join(parts)  # type: ignore[arg-type]
        elif actions_taken:
            parts = ["I processed your request:\n"]  # type: ignore[list-item]
            for a in actions_taken:
                parts.append(f"  {a['description']}")  # type: ignore[arg-type]
            response_text = "\n".join(parts)  # type: ignore[arg-type]
        else:
            response_text = ("I'm having trouble connecting to my AI brain right now. "
                            "Please make sure Ollama is running with gpt-oss:120b-cloud.")

    return jsonify({
        "success": True,
        "response": response_text,
        "actions": actions_taken,
        "proposedPlan": proposed_plan,
        "model": OLLAMA_MODEL,
        "timestamp": datetime.now().isoformat(),
    })


@app.route("/apply-plan", methods=["POST"])
def apply_plan_endpoint():
    """Accept and apply the pending study plan."""
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        data = {}
    uid = data.get("userId", "default")
    result = _apply_pending_plan(uid)
    if result:
        return jsonify({
            "success": True,
            "message": f"Study plan applied with {len(result.get('topics', []))} subjects.",
            "plan": result,
        })
    return jsonify({"success": False, "message": "No pending plan to apply."}), 404


@app.route("/reject-plan", methods=["POST"])
def reject_plan_endpoint():
    """Reject the pending study plan."""
    data = request.get_json(silent=True) or {}
    uid = data.get("userId", "default")
    _reject_pending_plan(uid)
    return jsonify({"success": True, "message": "Plan rejected."})


@app.route("/auto-generate-plan", methods=["POST"])
def auto_generate_plan():
    """Auto-generate a study plan from the user's knowledge graph — no chat needed.
    
    Picks topics intelligently:
      1. Topics with low mastery (needs learning)
      2. Topics due for review (high retention decay)
      3. Falls back to all topics if none qualify
    Then generates a timetable for the next 2 hours and saves it immediately.
    """
    data = request.get_json(silent=True) or {}
    uid = data.get("userId", "default")
    duration_hours = float(data.get("durationHours", 2))  # how many hours to plan for

    profile = _load_user(uid)
    kg = profile.get("knowledgeGraph", {})
    flat = _flatten_knowledge({"children": kg})

    # --- Pick topics intelligently ---
    # Priority 1: unseen topics (mastery == 0, never studied)
    unseen = [t for t in flat if t["mastery"] == 0 and not t.get("lastStudied")]
    # Priority 2: weak topics (mastery < 50)
    weak = [t for t in flat if 0 < t["mastery"] < 50]
    # Priority 3: topics due for review (retention < 0.6)
    review = [t for t in flat if t.get("lastStudied") and t.get("retention", 1) < 0.6]

    # Build ordered candidate list
    selected = []
    seen_names: set = set()

    def _add(items, limit):
        for t in items:
            if t["topic"] not in seen_names and len(selected) < limit:
                selected.append(t["topic"])
                seen_names.add(t["topic"])

    _add(sorted(weak, key=lambda x: x["mastery"]), 4)    # worst mastery first
    _add(sorted(review, key=lambda x: x.get("retention", 1)), 3)  # lowest retention
    _add(unseen, 3)                                                 # unseen topics

    # If still nothing, just take all topics alphabetically
    if not selected:
        _add(sorted(flat, key=lambda x: x["topic"]), 6)

    if not selected:
        return jsonify({"success": False, "message": "No topics found in knowledge graph. Add some subjects first."}), 400

    # --- Generate timetable ---
    from datetime import timedelta
    now = datetime.now()
    start_dt = now.replace(second=0, microsecond=0) + timedelta(minutes=1)
    end_dt = start_dt + timedelta(hours=duration_hours)

    generated_plan = _generate_study_plan_from_chat(selected, start_dt, end_dt)

    # --- Save directly as active plan (no approval needed) ---
    start_str = start_dt.strftime("%H:%M")
    end_str = end_dt.strftime("%H:%M")
    profile["aiStudyPlan"] = {
        "plan": generated_plan,
        "totalDuration": sum(p["duration"] for p in generated_plan),
        "topics": selected,
        "totalHours": duration_hours,
        "startTime": start_str,
        "endTime": end_str,
        "createdAt": datetime.now().isoformat(),
        "autoGenerated": True,
    }
    profile["lastActive"] = datetime.now().isoformat()
    _save_user(uid, profile)

    return jsonify({
        "success": True,
        "message": f"AI generated a {int(duration_hours * 60)}-minute study plan with {len(selected)} topics.",
        "plan": generated_plan,
        "topics": selected,
        "startTime": start_str,
        "endTime": end_str,
        "totalDuration": sum(p["duration"] for p in generated_plan),
    })


@app.route("/ai-study-plan", methods=["POST"])
def ai_study_plan():
    """Generate an AI-powered personalized study plan using Ollama."""
    data = request.get_json(silent=True) or {}
    uid = data.get("userId", "default")
    goal = data.get("goal", "improve overall learning")
    available_time = data.get("availableTime", 60)  # minutes

    profile = _load_user(uid)
    kg = profile.get("knowledgeGraph", {})
    flat = _flatten_knowledge({"children": kg})
    studied = [t for t in flat if t["mastery"] > 0]

    # Build context for AI
    topics_summary = []
    for t in flat:
        status = f"{t['topic']}: mastery {t['mastery']}%"
        if t.get("retention") is not None:
            status += f", retention {round(t['retention'] * 100)}%"
        topics_summary.append(status)

    prompt = f"""Create a personalized study plan for a student with these details:

Goal: {goal}
Available time: {available_time} minutes
Total topics: {len(flat)}
Topics studied so far: {len(studied)}

Current knowledge status:
{chr(10).join(topics_summary)}

Strengths: {', '.join(profile.get('strengths', [])) or 'None yet'}
Weaknesses: {', '.join(profile.get('weaknesses', [])) or 'None yet'}

Create a step-by-step study plan that:
1. Addresses weak areas first
2. Schedules spaced repetition for topics with low retention
3. Fits within the available time
4. Includes specific time allocations for each topic
5. Adds practice exercises or quiz suggestions

Format the plan as a clear, numbered list with time allocations."""

    system = ("You are an expert learning coach. Create practical, actionable study plans "
             "based on the student's actual data. Be specific with time allocations and activities. "
             "Do not use any markdown formatting symbols. Use plain text only.")

    plan_text = _ai_generate(prompt, system)

    if not plan_text:
        plan_text = ("Could not generate an AI study plan right now. "
                    "Please make sure Ollama is running with gpt-oss:120b-cloud.")

    return jsonify({
        "success": True,
        "plan": plan_text,
        "goal": goal,
        "availableTime": available_time,
        "model": OLLAMA_MODEL,
        "timestamp": datetime.now().isoformat(),
    })


# ============================================================================
# ARENA ENDPOINTS
# ============================================================================

# Static fallback banks used when Ollama is unreachable
_ARENA_FALLBACKS = {
    "question": [
        {"question": "What is the time complexity of binary search?", "answer": "O(log n)", "options": ["O(n)", "O(log n)", "O(n²)", "O(1)"], "explanation": "Binary search halves the search space each step.", "difficulty": "medium"},
        {"question": "If all roses are flowers and all flowers need water, do roses need water?", "answer": "Yes", "options": ["Yes", "No", "Maybe", "Cannot determine"], "explanation": "Transitive syllogism: Roses→Flowers→Need water.", "difficulty": "easy"},
        {"question": "What does typeof null return in JavaScript?", "answer": "object", "options": ["null", "object", "undefined", "string"], "explanation": "Legacy JavaScript bug — typeof null === 'object'.", "difficulty": "medium"},
        {"question": "What is 15% of 240?", "answer": "36", "options": ["32", "36", "40", "30"], "explanation": "15% × 240 = 0.15 × 240 = 36.", "difficulty": "easy"},
        {"question": "Which sorting algorithm has best average-case complexity?", "answer": "QuickSort", "options": ["BubbleSort", "QuickSort", "SelectionSort", "InsertionSort"], "explanation": "QuickSort achieves O(n log n) average case with small constants.", "difficulty": "hard"},
    ],
    "problem": [
        {"title": "The Bridge Puzzle", "problem": "4 people must cross a bridge at night with one torch. A=1min, B=2min, C=5min, D=10min. A pair moves at the slower pace. What is the minimum time for all to cross?", "solution": "17 minutes. A+B cross (2min) → A returns (1min) → C+D cross (10min) → B returns (2min) → A+B cross (2min).", "hints": ["Always send the fastest person back", "Think about who should cross together"]},
        {"title": "FizzBuzz Logic", "problem": "Describe the most efficient logic to print numbers 1-100: 'Fizz' for multiples of 3, 'Buzz' for multiples of 5, 'FizzBuzz' for both.", "solution": "Check divisibility by 15 first (both 3 and 5), then 3, then 5, else print number. Key insight: check 15 before 3 or 5.", "hints": ["The order of checks matters", "15 = 3 × 5"]},
    ],
    "strategy": [
        {"title": "7-Day Coding Sprint", "steps": ["Day 1: Arrays & Linked Lists", "Day 2: Stacks, Queues, Hash Maps", "Day 3: Trees & Recursion", "Day 4: Graphs (BFS/DFS)", "Day 5: Dynamic Programming", "Day 6: System Design basics", "Day 7: 10 mock problems timed"], "focus": "Build from fundamentals to advanced progressively.", "weakness_tip": "Spend extra time on recursion — it unlocks DP and tree traversal."},
        {"title": "Logic Mastery Boot Camp", "steps": ["Day 1: Propositional logic fundamentals", "Day 2: Syllogisms and deduction", "Day 3-5: Lateral thinking puzzles (10/day)", "Day 6: Probability & Bayesian reasoning", "Day 7: Timed logic test under pressure"], "focus": "Layer formal logic with intuitive pattern recognition.", "weakness_tip": "Map complex problems before solving — don't rush."},
    ]
}


def _parse_json_from_llm(text: str) -> dict:
    """Extract a JSON object from LLM response text."""
    import re as _re
    text = text.strip()
    # Try to find JSON block — patterns are defined separately to avoid Python 3.12
    # bracket-matching issues with triple-backtick raw strings inside list literals.
    _bt = "`"
    _bt3 = _bt * 3
    _patterns = [
        _bt3 + r"json\s*([\s\S]+?)" + _bt3,
        _bt3 + r"\s*([\s\S]+?)" + _bt3,
        r"(\{[\s\S]+\})",
        r"(\[[\s\S]+\])",
    ]
    for pattern in _patterns:
        m = _re.search(pattern, text)
        if m:
            try:
                return json.loads(m.group(1).strip())
            except Exception:
                continue
    try:
        return json.loads(text)
    except Exception:
        return {}


@app.route("/arena/question", methods=["POST"])
def arena_generate_question():
    """Generate an intelligent arena question using Unified Ensemble (Ollama -> Gemini)."""
    data = request.get_json(silent=True) or {}
    domain = data.get("domain", "Logic")
    difficulty = data.get("difficulty", "Intermediate")
    arena_mode = data.get("mode", "battle")  # battle | simulation
    uid = data.get("userId", "default")

    # Load user profile to personalise question
    profile = _load_user(uid)
    weaknesses = profile.get("weaknesses", [])
    weakness_hint = f" The user is weak in: {', '.join(weaknesses[:3])}." if weaknesses else ""

    is_open = domain.lower() in ["debate", "verbal"]

    # STEP 1: Ollama generates the base structural constraint
    import random
    seed = random.randint(1, 1000000)
    ollama_sys = "You are an AI generating a base question structure. Output JSON only."
    
    if is_open:
        ollama_prompt = f"""Create 1 base debate question.
Domain: {domain}. Difficulty: {difficulty}.{weakness_hint}
Seed: {seed} (Ensure this question is completely unique and different from before)
Return ONLY JSON: {{"question": "...", "answer": "Open"}}"""
    else:
        ollama_prompt = f"""Create 1 base multiple-choice question.
Domain: {domain}. Difficulty: {difficulty}.{weakness_hint}
Seed: {seed} (Ensure this question is completely unique and different from before)
Return ONLY JSON: {{"question": "...", "answer": "correct", "options": ["correct", "b", "c", "d"], "explanation": "..."}}"""

    print("[Arena] Step 1: Requesting base question from Ollama...")
    base_raw = _ai_generate(ollama_prompt, ollama_sys, provider="ollama")
    base_json = _parse_json_from_llm(base_raw) if base_raw else {}

    # STEP 2: Gemini refines, hardens, and generates the Twin Answer
    gemini_sys = (
        "You are an Elite Cognitive Architect acting as the 'Ensemble AI Twin'. "
        "Take the provided draft question, fix any logic flaws, increase its intellectual rigor, "
        "and generate a flawless 'twin_answer'. Always respond with valid JSON only."
    )
    
    gemini_prompt = f"""Refine this draft question into a master-level challenge.
Draft Question Data: {json.dumps(base_json)}
Domain: {domain}
Target Difficulty: {difficulty}

Respond with ONLY this JSON:
{{
  "question": "refined, rigorous question text",
  "answer": "exact correct option text (or 'Open')",
  "options": ["option1", "option2", "option3", "option4"] (or null if open),
  "twin_answer": "your elite, flawless answer (match correct option if MCQ, or a 3-sentence argument if open)",
  "explanation": "clear explanation of the correct logic",
  "difficulty": "{difficulty.lower()}"
}}"""

    print("[Arena] Step 2: Requesting refinement from Gemini...")
    final_raw = _ai_generate(gemini_prompt, gemini_sys, provider="gemini")
    parsed = _parse_json_from_llm(final_raw) if final_raw else {}

    if not parsed or "question" not in parsed:
        print("[Arena] Ensemble failed, generating fallback...")
        import random
        fallback = random.choice(_ARENA_FALLBACKS["question"])
        parsed = {"question": fallback["question"], "answer": fallback["answer"], "options": fallback["options"], "twin_answer": fallback["answer"], "explanation": fallback["explanation"], "difficulty": difficulty.lower(), "source": "fallback"}
    else:
        parsed["source"] = "ensemble"

    return jsonify({"success": True, "question": parsed})


@app.route("/arena/challenge-pdf", methods=["POST"])
def arena_challenge_pdf():
    """Extract PDF text and generate a Challenge."""
    file = request.files.get("file")
    domain = request.form.get("domain", "General")
    difficulty = request.form.get("difficulty", "Intermediate")
    
    if not file or not file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Valid PDF file is required"}), 400
        
    file_bytes = file.read()
    pdf_text = _extract_pdf_text(file_bytes)
    
    if len(pdf_text) < 50:
        return jsonify({"error": "Could not extract sufficient text from PDF."}), 400
        
    import itertools
    context_chunk = "".join(itertools.islice(pdf_text, 5000))
    
    gemini_sys = "You are an elite AI Twin Arena Master. Format output as valid JSON only."
    gemini_prompt = f"""Create a challenging multiple-choice question derived directly from this document content.
Document Content Excerpt:
{context_chunk}

Domain: {domain}
Difficulty: {difficulty}

Respond with ONLY this JSON:
{{
  "question": "Clear, specific question based on the document",
  "answer": "Exact correct option text",
  "options": ["option1", "option2", "option3", "option4"],
  "twin_answer": "Exact correct option text",
  "explanation": "Clear explanation referencing the document",
  "difficulty": "{difficulty.lower()}"
}}"""

    print(f"[Arena] Generating PDF challenge for {domain} ({difficulty})...")
    raw = _ai_generate(gemini_prompt, gemini_sys, provider="auto")
    parsed = _parse_json_from_llm(raw) if raw else {}
    
    if not parsed or "question" not in parsed:
        return jsonify({"error": "Failed to generate challenge from PDF"}), 500
        
    parsed["source"] = "pdf_extraction"
    return jsonify({"success": True, "question": parsed})


@app.route("/arena/evaluate", methods=["POST"])
def arena_evaluate_answer():
    """Evaluate a user's answer using Unified Ensemble (Gemini -> Ollama)."""
    data = request.get_json(silent=True) or {}
    question = data.get("question", "")
    correct_answer = data.get("correctAnswer", "")
    user_answer = data.get("userAnswer", "")
    twin_answer = data.get("twinAnswer", "")
    is_open = data.get("isOpen", False)
    domain = data.get("domain", "Logic")
    uid = data.get("userId", "default")

    if not question or not user_answer:
        return jsonify({"error": "question and userAnswer are required"}), 400

    if not is_open:
        # FAST PATH: Skip LLMs for MCQ, perform direct string checking for instant response
        is_correct = user_answer.strip().lower() == correct_answer.strip().lower()
        score = 100 if is_correct else 0
        parsed = {
            "score": score,
            "label": "Correct! ✓" if is_correct else "Incorrect ✗",
            "feedback": "Outstanding speed and accuracy!" if is_correct else f"The correct answer was: {correct_answer}.",
            "strengths": ["Quick thinking"] if is_correct else [],
            "improvements": [] if is_correct else [f"Review {domain} concepts"],
            "winner": "user" if is_correct else "ai_twin",
            "source": "instant"
        }
        
        # Log mistake if wrong
        if not is_correct and uid:
            profile = _load_user(uid)
            mistakes = profile.get("mistakePatterns", [])
            import itertools
            q_preview = "".join(itertools.islice(str(question), 80))
            mistakes.append({"topic": str(domain), "type": "arena_wrong_answer", "description": f"Q: {q_preview}...", "timestamp": datetime.now().isoformat()})
            profile["mistakePatterns"] = mistakes[-200:]
            _save_user(uid, profile)
            
        return jsonify({"success": True, "evaluation": parsed})

    # STEP 1: Gemini performs strict, numeric evaluation for OPEN-ENDED questions
    gemini_sys = "You are an elite AI Evaluator. Be strict but fair. Output valid JSON only."
    
    gemini_prompt = f"""Evaluate this open-ended answer.
Question: {question}
User Answer: {user_answer}
AI Twin Reference: {twin_answer}

Score from 0-100 based on argumentation, facts, depth. 
Return ONLY JSON: {{"score": <0-100>, "label": "Short label", "feedback": "2 sentences feedback", "strengths": ["s1"], "improvements": ["i1"], "winner": "user or ai_twin"}}"""

    print("[Arena] Eval Step 1: Requesting strict scoring from Gemini...")
    base_eval_raw = _ai_generate(gemini_prompt, gemini_sys, provider="gemini")
    parsed = _parse_json_from_llm(base_eval_raw) if base_eval_raw else {}

    # STEP 2: Ollama adds personalised coaching
    if parsed and "score" in parsed:
        ollama_sys = "You are a warm Cognitive Coach. Output valid JSON only."
        ollama_prompt = f"""Take this raw evaluation and add a purely encouraging, 1-sentence personalised coaching tip to the 'feedback' field based on the domain {domain}.
Raw Eval: {json.dumps(parsed)}
Return the identical JSON structure but with the enhanced 'feedback' string."""
        
        print("[Arena] Eval Step 2: Requesting coaching layer from Ollama...")
        final_eval_raw = _ai_generate(ollama_prompt, ollama_sys, provider="ollama")
        final_parsed = _parse_json_from_llm(final_eval_raw)
        
        if final_parsed and "feedback" in final_parsed:
            parsed = final_parsed
        parsed["source"] = "ensemble"
    else:
        # Fallback
        is_correct = user_answer.strip().lower() == correct_answer.strip().lower() if not is_open else len(user_answer.split()) > 10
        score = 100 if (not is_open and is_correct) else (75 if is_open and len(user_answer.split()) > 15 else 40)
        parsed = {"score": score, "label": "Correct! ✓" if score >= 80 else "Needs Improvement", "feedback": f"Evaluated for {domain}.", "strengths": [], "improvements": [], "winner": "user" if score >= 75 else "ai_twin", "source": "fallback"}

    # Log mistake if wrong
    if parsed.get("winner") == "ai_twin" and uid:
        profile = _load_user(uid)
        mistakes = profile.get("mistakePatterns", [])
        import itertools
        q_preview = "".join(itertools.islice(str(question), 80))
        mistakes.append({"topic": str(domain), "type": "arena_wrong_answer", "description": f"Q: {q_preview}...", "timestamp": datetime.now().isoformat()})
        profile["mistakePatterns"] = mistakes[-200:]
        _save_user(uid, profile)

    return jsonify({"success": True, "evaluation": parsed})


@app.route("/arena/problem", methods=["POST"])
def arena_generate_problem():
    """Generate an intelligent problem challenge using Ollama."""
    data = request.get_json(silent=True) or {}
    domain = data.get("domain", "Logic")
    difficulty = data.get("difficulty", "Intermediate")
    uid = data.get("userId", "default")

    system_prompt = (
        "You are an expert problem designer for a cognitive arena system. "
        "Create real-world, intellectually stimulating challenges that tests deep understanding. "
        "Always respond with valid JSON only."
    )

    prompt = f"""Create 1 challenging problem for the AI Twin Problem Arena.
Domain: {domain}
Difficulty: {difficulty}

The problem should require multi-step reasoning and have a clear, verifiable answer.

Respond with ONLY this JSON:
{{
  "title": "Problem title",
  "problem": "Full problem description with all necessary information",
  "solution": "Complete step-by-step solution with the final answer",
  "hints": ["hint 1", "hint 2"],
  "criteria": ["criterion 1", "criterion 2", "criterion 3"],
  "key_insight": "The core insight needed to solve this problem"
}}"""

    result = _ai_generate(prompt, system_prompt)
    parsed = _parse_json_from_llm(result) if result else {}

    if not parsed or "problem" not in parsed:
        import random
        fallback = random.choice(_ARENA_FALLBACKS["problem"])
        parsed = {**fallback, "source": "fallback"}
    else:
        parsed["source"] = "ollama"

    return jsonify({"success": True, "problem": parsed})


@app.route("/arena/strategy", methods=["POST"])
def arena_generate_strategy():
    """Generate a personalised strategy plan using Ollama."""
    data = request.get_json(silent=True) or {}
    domain = data.get("domain", "Logic")
    difficulty = data.get("difficulty", "Intermediate")
    uid = data.get("userId", "default")

    profile = _load_user(uid)
    weaknesses = profile.get("weaknesses", [])
    strengths = profile.get("strengths", [])
    kg = profile.get("knowledgeGraph", {})
    flat = _flatten_knowledge({"children": kg})
    avg_mastery = int(sum(t["mastery"] for t in flat) * 10 / max(1, len(flat))) / 10.0 if flat else 0

    system_prompt = (
        "You are a master learning strategist and cognitive coach in an AI Twin Arena. "
        "Create personalised, actionable, and adaptive study strategies. "
        "Always respond with valid JSON only."
    )

    prompt = f"""Create a personalised strategy plan for this learner:
Domain: {domain}
Target Difficulty: {difficulty}
User's Strengths: {', '.join(strengths[:3]) if strengths else 'Not yet determined'}
User's Weaknesses: {', '.join(weaknesses[:3]) if weaknesses else 'Not yet determined'}
Current Average Mastery: {avg_mastery}%

Create a specific, actionable 7-step strategy plan.

Respond with ONLY this JSON:
{{
  "title": "Plan title",
  "steps": [
    "Step 1: ...",
    "Step 2: ...",
    "Step 3: ...",
    "Step 4: ...",
    "Step 5: ...",
    "Step 6: ...",
    "Step 7: ..."
  ],
  "focus": "Key focus principle for this plan",
  "weakness_tip": "Specific tip for the user's weak areas",
  "estimated_time": "Total estimated hours"
}}"""

    result = _ai_generate(prompt, system_prompt)
    parsed = _parse_json_from_llm(result) if result else {}

    if not parsed or "steps" not in parsed:
        import random
        fallback = random.choice(_ARENA_FALLBACKS["strategy"])
        parsed = {**fallback, "source": "fallback"}
    else:
        parsed["source"] = "ollama"

    return jsonify({"success": True, "strategy": parsed})


# ============================================================================


# ============================================================================
# Main
# ============================================================================
if __name__ == "__main__":
    ollama_status = "CONNECTED" if _check_ollama() else "NOT RUNNING"
    print(f"""
================================================
       AI TWIN ENGINE
   Digital Cognitive Twin API
   Ollama Model: {OLLAMA_MODEL}
   Ollama Status: {ollama_status}
================================================

Endpoints:
  GET  /health            Health check
  GET  /profile           Get user profile
  POST /profile           Update user profile
  GET  /knowledge-graph   Get knowledge graph
  POST /knowledge-graph   Update topic mastery
  GET  /predictions       Score / burnout / forgetting predictions
  GET  /memory-decay      Topics due for spaced repetition
  GET  /study-plan        Generate smart study plan (algorithmic)
  GET  /mistakes          Get mistake patterns
  POST /mistakes          Log a mistake
  GET  /behavior          Get behavior analytics
  POST /behavior          Log a study session
  POST /simulate-exam     Simulate exam performance
  POST /chat              Chat with AI Twin (Ollama)
  POST /ai-study-plan     AI-generated study plan (Ollama)

Data storage: {DATA_DIR}
Starting on http://127.0.0.1:{PORT}
""")
    app.run(host="0.0.0.0", port=PORT, debug=False)

