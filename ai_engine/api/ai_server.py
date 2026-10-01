"""Flask AI server for live emotion detection with OpenCV and DeepFace.
Also provides document analysis and quiz generation for AI Twin."""

from __future__ import annotations

import base64
import io
import json
import os
import re
import threading
import time
from datetime import datetime
from typing import Optional, Any

import requests  # type: ignore[import]

import cv2  # type: ignore[import]
import numpy as np  # type: ignore[import]
from deepface import DeepFace  # type: ignore[import]
from flask import Flask, jsonify, request  # type: ignore[import]
from flask_cors import CORS  # type: ignore[import]
from flask_socketio import SocketIO, emit  # type: ignore[import]

# Load environment variables
try:
    from dotenv import load_dotenv  # type: ignore[import]
    from pathlib import Path
    
    # Explicitly load .env from ai_engine root
    env_path = Path(__file__).resolve().parent.parent / '.env'
    load_dotenv(dotenv_path=env_path)
    print(f"[AI Engine] Loaded config from {env_path}")
except ImportError:
    print("[AI Engine] python-dotenv not installed. Environment variables from .env will not be loaded.")
except Exception as e:
    print(f"[AI Engine] Config loading error: {e}")

# Optional imports for document processing
try:
    import PyPDF2  # type: ignore[import]
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False
    print("[AI Engine] PyPDF2 not installed. PDF support disabled.")

try:
    import google.generativeai as genai  # type: ignore[import]
    GEMINI_SUPPORT = True
except ImportError:
    GEMINI_SUPPORT = False
    print("[AI Engine] google-generativeai not installed. Document analysis disabled.")

# OpenAI support
try:
    from openai import OpenAI as _OpenAIClient  # type: ignore[import]
    OPENAI_SUPPORT = True
except ImportError:
    OPENAI_SUPPORT = False
    print("[AI Engine] openai not installed. OpenAI support disabled.")

# Llama support using llama-cpp-python
try:
    from llama_cpp import Llama  # type: ignore[import]
    LLAMA_SUPPORT = True
except ImportError:
    LLAMA_SUPPORT = False
    print("[AI Engine] llama-cpp-python not installed. Local Llama support disabled.")

# Llama model instance (lazy loaded)
_llama_model = None
_llama_loading = False

def _get_llama_model():
    """Get or load the Llama model (lazy initialization)."""
    global _llama_model, _llama_loading
    
    if not LLAMA_SUPPORT:
        return None
    
    if _llama_model is not None:
        return _llama_model
    
    if _llama_loading:
        return None  # Avoid concurrent loading
    
    _llama_loading = True
    
    try:
        model_path = os.environ.get("LLAMA_MODEL_PATH", "models/llama-3.2-3b-instruct.Q4_K_M.gguf")
        
        # Support both relative and absolute paths
        if not os.path.isabs(model_path):
            model_path = os.path.join(os.path.dirname(__file__), "..", model_path)
        
        if not os.path.exists(model_path):
            print(f"[AI Engine] Llama model not found at: {model_path}")
            print("[AI Engine] Download a GGUF model from Hugging Face and update LLAMA_MODEL_PATH in .env")
            _llama_loading = False
            return None
        
        n_threads = int(os.environ.get("LLAMA_N_THREADS", "4"))
        n_gpu_layers = int(os.environ.get("LLAMA_N_GPU_LAYERS", "0"))
        
        print(f"[AI Engine] Loading Llama model from: {model_path}")
        _llama_model = Llama(
            model_path=model_path,
            n_ctx=4096,  # Context window
            n_threads=n_threads,
            n_gpu_layers=n_gpu_layers,
            verbose=False,
        )
        print("[AI Engine] Llama model loaded successfully!")
        _llama_loading = False
        return _llama_model
    except Exception as e:
        print(f"[AI Engine] Failed to load Llama model: {e}")
        _llama_loading = False
        return None


def _generate_with_llama(prompt: str, max_tokens: int = 2048) -> dict:
    """Generate text using local Llama model."""
    model = _get_llama_model()
    if model is None:
        return {"error": "Llama model not available"}
    
    try:
        # Format prompt for instruction-following models
        formatted_prompt = f"<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n\n{prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n"
        
        response = model(
            formatted_prompt,
            max_tokens=max_tokens,
            temperature=0.7,
            top_p=0.9,
            stop=["<|eot_id|>", "<|end_of_text|>"],
        )
        
        generated_text = response["choices"][0]["text"].strip()
        return {"success": True, "response": generated_text}
    except Exception as e:
        print(f"[AI Engine] Llama generation error: {e}")
        return {"error": str(e)}


# =============================================================================
# OPENAI Integration (Cloud AI - Requires API Key)
# =============================================================================

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

_openai_client = None


def _get_openai_client():
    """Get or create the OpenAI client (lazy initialization)."""
    global _openai_client
    if not OPENAI_SUPPORT or not OPENAI_API_KEY:
        return None
    if _openai_client is None:
        _openai_client = _OpenAIClient(api_key=OPENAI_API_KEY)
    return _openai_client


def _generate_with_openai(prompt: str, system_prompt: Optional[str] = None, model: Optional[str] = None) -> dict:
    """Generate text using OpenAI API."""
    client = _get_openai_client()
    if client is None:
        return {"error": "OpenAI not configured"}
    try:
        messages: list[dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        response = client.chat.completions.create(
            model=model or OPENAI_MODEL,
            messages=messages,  # type: ignore[arg-type]
            temperature=0.7,
        )
        content = response.choices[0].message.content or ""
        return {
            "success": True,
            "response": content,
            "model": response.model,
        }
    except Exception as e:
        print(f"[AI Engine] OpenAI error: {e}")
        return {"error": str(e)}


def _chat_with_openai(messages: list, model: Optional[str] = None) -> dict:
    """Chat with OpenAI using message history."""
    client = _get_openai_client()
    if client is None:
        return {"error": "OpenAI not configured"}
    try:
        response = client.chat.completions.create(
            model=model or OPENAI_MODEL,
            messages=messages,  # type: ignore[arg-type]
            temperature=0.7,
        )
        content = response.choices[0].message.content or ""
        return {
            "success": True,
            "response": content,
            "model": response.model,
        }
    except Exception as e:
        print(f"[AI Engine] OpenAI chat error: {e}")
        return {"error": str(e)}


# =============================================================================
# OLLAMA Integration (Local AI - No API Keys Required)
# =============================================================================

OLLAMA_BASE_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.1")

# Tutor system prompt - the core intelligence
TUTOR_SYSTEM_PROMPT = """You are Jarvis, an AI tutor for NeuroNest brain training app.

Your goals:
- Teach concepts clearly and patiently
- Adapt explanations to the student's level
- Ask guiding questions instead of giving answers immediately
- Use simple examples first, then increase difficulty
- Encourage the student and avoid judgment

Rules:
- If the student is confused, re-explain using a different approach
- Break complex ideas into smaller steps
- Ask "Do you want a hint or the full solution?" when appropriate
- Never rush - learning takes time
- Be conversational and friendly
- If asked about NeuroNest features, explain how they help cognitive training"""


def _check_ollama_status() -> dict:
    """Check if Ollama is running and accessible."""
    try:
        response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        if response.status_code == 200:
            models = response.json().get("models", [])
            return {
                "online": True,
                "models": [m.get("name", "unknown") for m in models],
                "default_model": OLLAMA_MODEL,
            }
        return {"online": False, "error": "Ollama not responding"}
    except requests.exceptions.ConnectionError:
        return {"online": False, "error": "Ollama not running. Install from https://ollama.com/download"}
    except Exception as e:
        return {"online": False, "error": str(e)}


def _generate_with_ollama(prompt: str, system_prompt: Optional[str] = None, model: Optional[str] = None) -> dict:
    """Generate text using Ollama local API."""
    try:
        payload = {
            "model": model or OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
        }
        
        if system_prompt:
            payload["system"] = system_prompt
        
        response = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json=payload,
            timeout=120  # 2 min timeout for slow responses
        )
        
        if response.status_code == 200:
            result = response.json()
            return {
                "success": True,
                "response": result.get("response", ""),
                "model": result.get("model", model or OLLAMA_MODEL),
                "done": result.get("done", True),
            }
        else:
            return {"error": f"Ollama error: {response.status_code}"}
    except requests.exceptions.ConnectionError:
        return {"error": "Ollama not running. Start it with 'ollama serve'"}
    except requests.exceptions.Timeout:
        return {"error": "Ollama timeout - response took too long"}
    except Exception as e:
        print(f"[AI Engine] Ollama error: {e}")
        return {"error": str(e)}


def _chat_with_ollama(messages: list, model: Optional[str] = None) -> dict:
    """Chat with Ollama using message history (for conversation memory)."""
    try:
        payload = {
            "model": model or OLLAMA_MODEL,
            "messages": messages,
            "stream": False,
        }
        
        response = requests.post(
            f"{OLLAMA_BASE_URL}/api/chat",
            json=payload,
            timeout=120
        )
        
        if response.status_code == 200:
            result = response.json()
            return {
                "success": True,
                "response": result.get("message", {}).get("content", ""),
                "model": result.get("model", model or OLLAMA_MODEL),
            }
        else:
            return {"error": f"Ollama chat error: {response.status_code}"}
    except Exception as e:
        print(f"[AI Engine] Ollama chat error: {e}")
        return {"error": str(e)}


app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

# ── MongoDB save helper (fire-and-forget via Node REST API) ──────────────
NODE_SERVER_URL = os.environ.get("NODE_SERVER_URL", "http://localhost:5000")
_last_save_time: float = 0
_SAVE_INTERVAL = 10  # seconds — don't flood the DB, save at most every 10s
_save_lock = threading.Lock()


def _save_emotion_to_db(emotion: str, confidence: float, distracted: bool, head_pose: str, user_id: str | None = None) -> None:
    """Fire-and-forget: POST emotion reading to Node.js → MongoDB."""
    global _last_save_time
    now = time.time()
    with _save_lock:
        if now - _last_save_time < _SAVE_INTERVAL:
            return  # rate-limit: skip this reading
        _last_save_time = now

    def _post():
        try:
            payload = {
                "emotion": emotion,
                "confidence": int(confidence * 10) / 10.0,
                "distracted": distracted,
                "headPose": head_pose,
                "timestamp": datetime.now().isoformat(),
            }
            if user_id:
                payload["userId"] = user_id
            requests.post(
                f"{NODE_SERVER_URL}/api/emotion/log",
                json=payload,
                timeout=5,
            )
        except Exception as e:
            print(f"[AI Engine] Emotion save skipped: {e}")

    threading.Thread(target=_post, daemon=True).start()


# Emotion-based coaching tips
EMOTION_TIPS = {
    "happy": "Great mood! You're in an optimal state for learning. Keep this positive energy!",
    "sad": "I notice you might be feeling down. Take a short break, stretch, or try a quick breathing exercise.",
    "angry": "Deep breath! Let's channel that energy into focus. Try counting to 10 slowly.",
    "fear": "Feeling anxious? That's normal. Break your task into smaller, manageable steps.",
    "surprise": "Something caught your attention! Use this heightened awareness for focused learning.",
    "disgust": "If something is bothering you, take a moment to reset. Fresh air can help.",
    "neutral": "Steady focus detected. You're in a calm, balanced state. Perfect for concentration.",
}

# Cache for DeepFace model (loaded on first use)
_model_loaded = False


def _ensure_model():
    """Pre-load DeepFace emotion model for faster inference."""
    global _model_loaded
    if not _model_loaded:
        try:
            # Warm up the model with a dummy image
            dummy = np.zeros((48, 48, 3), dtype=np.uint8)
            DeepFace.analyze(dummy, actions=["emotion"], enforce_detection=False, silent=True)
            _model_loaded = True
            print("[AI Engine] DeepFace emotion model loaded successfully")
        except Exception as e:
            print(f"[AI Engine] Model pre-load warning: {e}")
            _model_loaded = True  # Avoid repeated attempts


def _decode_base64_image(base64_string: str):
    """Decode a base64 image string to OpenCV format."""
    try:
        # Handle data URL format (data:image/jpeg;base64,...)
        if "," in base64_string:
            base64_string = base64_string.split(",", 1)[1]
        
        image_bytes = base64.b64decode(base64_string)
        np_array = np.frombuffer(image_bytes, dtype=np.uint8)
        frame = cv2.imdecode(np_array, cv2.IMREAD_COLOR)
        return frame
    except Exception:
        return None


def _decode_file_image(file_bytes: bytes):
    """Decode uploaded file bytes to OpenCV format."""
    if not file_bytes:
        return None
    np_buffer = np.frombuffer(file_bytes, dtype=np.uint8)
    frame = cv2.imdecode(np_buffer, cv2.IMREAD_COLOR)
    return frame


def _normalize_analysis(analysis):
    """Normalize DeepFace analysis result (can be list or dict)."""
    if isinstance(analysis, list) and analysis:
        return analysis[0]
    return analysis if isinstance(analysis, dict) else None


def _analyze_frame(frame):
    """Analyze a frame for emotion detection."""
    if frame is None:
        return None
    
    try:
        analysis = DeepFace.analyze(
            frame,
            actions=["emotion"],
            enforce_detection=False,
            silent=True,
        )
        return _normalize_analysis(analysis)
    except Exception as e:
        print(f"[AI Engine] Analysis error: {e}")
        return None


@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint for frontend status monitoring."""
    return jsonify({
        "status": "online",
        "service": "emotion-detection",
        "timestamp": datetime.now().isoformat(),
    })


@app.route("/llama/status", methods=["GET"])
def llama_status():
    """Check Llama model status."""
    model_path = os.environ.get("LLAMA_MODEL_PATH", "models/llama-3.2-3b-instruct.Q4_K_M.gguf")
    if not os.path.isabs(model_path):
        model_path = os.path.join(os.path.dirname(__file__), "..", model_path)
    
    model_exists = os.path.exists(model_path)
    model_loaded = _llama_model is not None
    
    return jsonify({
        "llama_support": LLAMA_SUPPORT,
        "model_path": model_path,
        "model_exists": model_exists,
        "model_loaded": model_loaded,
        "gemini_support": GEMINI_SUPPORT,
        "status": "ready" if model_loaded else ("model_missing" if not model_exists else "not_loaded"),
        "download_instructions": "Download a GGUF model from https://huggingface.co/models?search=gguf+llama and place it in ai_engine/models/",
        "timestamp": datetime.now().isoformat(),
    })


# =============================================================================
# TUTOR API Endpoints (Ollama-based Local AI)
# =============================================================================

@app.route("/tutor/status", methods=["GET"])
def tutor_status():
    """Check if the local AI tutor (Ollama) is available."""
    ollama_status = _check_ollama_status()
    
    return jsonify({
        "ollama": ollama_status,
        "openai_available": OPENAI_SUPPORT and bool(OPENAI_API_KEY),
        "gemini_available": GEMINI_SUPPORT and bool(os.environ.get("GEMINI_API_KEY")),
        "llama_cpp_available": LLAMA_SUPPORT and _llama_model is not None,
        "recommended_action": "Install Ollama from https://ollama.com/download and run 'ollama pull llama3.1'" if not ollama_status.get("online") else "Ready to use!",
        "timestamp": datetime.now().isoformat(),
        ##stamp it up easily for making it work as soon as the problem doesnt becopme unkjnownen no issie for the majoiajn  aiwsssjsjsswfpffkl
    })


@app.route("/tutor/models", methods=["GET"])
def tutor_models():
    """List available models from Ollama."""
    status = _check_ollama_status()
    
    if not status.get("online"):
        return jsonify({
            "error": "Ollama not running",
            "install_url": "https://ollama.com/download",
            "models": [],
        }), 503
    
    return jsonify({
        "models": status.get("models", []),
        "default": OLLAMA_MODEL,
        "timestamp": datetime.now().isoformat(),
    })


@app.route("/tutor/chat", methods=["POST"])
def tutor_chat():
    """
    Chat with the AI tutor.
    
    Accepts JSON body:
    {
        "message": "Explain fractions like I'm 12",
        "history": [{"role": "user", "content": "..."}, ...],  // optional
        "model": "llama3.1",  // optional
        "socratic": false  // optional - enables Socratic teaching mode
    }
    
    Returns:
    {
        "response": "Let me explain...",
        "model": "llama3.1",
        "source": "ollama"
    }
    """
    data = request.get_json(silent=True) or {}
    message = data.get("message", "").strip()
    history = data.get("history", [])
    model = data.get("model")
    socratic_mode = data.get("socratic", False)
    
    if not message:
        return jsonify({"error": "Message is required"}), 400
    
    # Build system prompt
    system_prompt = TUTOR_SYSTEM_PROMPT
    if socratic_mode:
        system_prompt += """

SOCRATIC MODE ENABLED:
- Do NOT give direct answers
- Ask one guiding question at a time
- Help the student discover the answer themselves
- Wait for their response before asking the next question"""
    
    # Try Ollama first (local, no API cost)
    ollama_status = _check_ollama_status()
    if ollama_status.get("online"):
        if history:
            # Use chat API with conversation history
            messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
            messages.extend(history)  # type: ignore[arg-type]
            messages.append({"role": "user", "content": message})
            
            result = _chat_with_ollama(messages, model)
        else:
            # Simple generate for single question
            result = _generate_with_ollama(message, system_prompt, model)
        
        if "success" in result:
            return jsonify({
                "response": result["response"],
                "model": result.get("model", model or OLLAMA_MODEL),
                "source": "ollama",
                "timestamp": datetime.now().isoformat(),
            })
        else:
            print(f"[Tutor] Ollama error: {result.get('error')}, falling back...")
    
    # Fallback to OpenAI if available
    if OPENAI_SUPPORT and OPENAI_API_KEY:
        if history:
            messages_oai: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
            messages_oai.extend(history)  # type: ignore[arg-type]
            messages_oai.append({"role": "user", "content": message})
            result = _chat_with_openai(messages_oai, model)
        else:
            result = _generate_with_openai(message, system_prompt, model)
        if "success" in result:
            return jsonify({
                "response": result["response"],
                "model": result.get("model", OPENAI_MODEL),
                "source": "openai",
                "timestamp": datetime.now().isoformat(),
            })
        else:
            print(f"[Tutor] OpenAI error: {result.get('error')}, falling back...")
    
    # Fallback to Gemini if available
    if GEMINI_SUPPORT and _init_gemini():
        try:
            full_prompt = f"{system_prompt}\n\nStudent: {message}"
            result = _analyze_with_ai(full_prompt, "chat")
            if "success" in result:
                return jsonify({
                    "response": result["response"],
                    "model": "gemini",
                    "source": "gemini",
                    "timestamp": datetime.now().isoformat(),
                })
        except Exception as e:
            print(f"[Tutor] Gemini fallback error: {e}")
    
    # No AI available
    return jsonify({
        "error": "No AI backend available",
        "suggestion": "Install Ollama from https://ollama.com/download and run 'ollama pull llama3.1'",
    }), 503


@app.route("/api/training/generate", methods=["POST"])
def generate_training():
    """Generate dynamic puzzles using Ollama."""
    data = request.get_json(silent=True) or {}
    game_type = data.get("game_type", "Pattern Finder")
    level = data.get("level", 1)
    age_group = data.get("age_group", "Adult")
    age_context = f"The target audience is the {age_group} age group. Adapt the themes, numbers, and vocabulary to be highly appropriate, understandable, and engaging for a {age_group}. For toddlers and children, use simple concepts like animals, colors, and basic counting. For adults, use complex logic, mathematics, and professional themes."

    if game_type == "Pattern Finder":
        prompt = f"""{age_context}
Generate 5 sequence puzzles for a Pattern Finder game. The difficulty should be level {level} (1 is easy, 10 is very hard). Make sure the patterns are unique and creative (math, colors, emojis, logic).
Return ONLY a valid JSON array of objects. Do not include markdown formatting.
Format:
[
  {{
    "sequence": ["2", "4", "6", "8", "?"],
    "options": ["9", "10", "12", "14"],
    "correct": "10",
    "explanation": "Add 2 to each number"
  }}
]"""
    elif game_type == "Logic Puzzle":
        prompt = f"""{age_context}
Generate 5 logic reasoning puzzles. Difficulty level {level} (1 is easy, 10 is very hard).
Return ONLY a valid JSON array of objects. Do not include markdown formatting.
Format:
[
  {{
    "statement": "All cats are animals. Tom is a cat.",
    "question": "What can we conclude about Tom?",
    "options": ["Tom is not an animal", "Tom is an animal", "Tom is a dog", "Nothing"],
    "correct": "Tom is an animal"
  }}
]"""
    elif game_type == "Number Grid":
        prompt = f"""{age_context}
Generate 5 number grid math puzzles. Difficulty level {level} (1 is easy, 10 is very hard). In the grid, ensure there is exactly one '?' as a string, and all other items are numbers.
Return ONLY a valid JSON array of objects. Do not include markdown formatting.
Format:
[
  {{
    "type": "sum",
    "grid": [[5, 3], [2, "?"]],
    "hint": "Each row sums to 8",
    "answer": "6"
  }}
]"""
    else:
        return jsonify({"error": "Unknown game type"}), 400

    json_system = "You are a strict JSON API. Output only valid JSON arrays."
    result = _generate_with_ollama(prompt, system_prompt=json_system, model="gpt-oss:120b-cloud")
    
    # Fallback to OpenAI if Ollama fails
    if "success" not in result and OPENAI_SUPPORT and OPENAI_API_KEY:
        print(f"[Training Gen] Ollama failed, trying OpenAI...")
        result = _generate_with_openai(prompt, system_prompt=json_system)
    
    if "success" in result:
        try:
            raw = result["response"].strip()
            if raw.startswith("```json"):
                raw = raw[7:]
            if raw.startswith("```"):
                raw = raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3]
            
            puzzles = json.loads(raw.strip())
            return jsonify({"success": True, "puzzles": puzzles})
        except Exception as e:
            print(f"[Training Gen] Parse err: {e}")
            return jsonify({"error": "Failed to parse JSON"}), 500
            
    return jsonify({"error": "AI generation failed"}), 500


@app.route("/api/chat", methods=["POST"])
def api_chat():
    """
    Legacy chat endpoint for backward compatibility.
    Wraps the tutor chat functionality.
    
    Accepts: {"message": "..."}
    Returns: {"reply": "..."}
    """
    data = request.get_json(silent=True) or {}
    message = data.get("message", "").strip()
    
    if not message:
        return jsonify({"error": "Message is required"}), 400
    
    # Try Ollama first
    ollama_status = _check_ollama_status()
    if ollama_status.get("online"):
        result = _generate_with_ollama(message, TUTOR_SYSTEM_PROMPT)
        if "success" in result:
            return jsonify({"reply": result["response"], "source": "ollama"})
    
    # Fallback to OpenAI
    if OPENAI_SUPPORT and OPENAI_API_KEY:
        result = _generate_with_openai(message, TUTOR_SYSTEM_PROMPT)
        if "success" in result:
            return jsonify({"reply": result["response"], "source": "openai"})
    
    # Fallback to Gemini
    if GEMINI_SUPPORT and _init_gemini():
        try:
            full_prompt = f"{TUTOR_SYSTEM_PROMPT}\n\nUser: {message}"
            result = _analyze_with_ai(full_prompt, "chat")
            if "success" in result:
                return jsonify({"reply": result["response"], "source": "gemini"})
        except Exception as e:
            print(f"[API/Chat] Gemini error: {e}")
    
    return jsonify({
        "error": "No AI backend available",
        "reply": "I'm sorry, I'm currently unavailable. Please ensure Ollama is running, set your OpenAI API key, or check your Gemini API key.",
    }), 503


@app.route("/emotion", methods=["POST"])
def detect_emotion():
    """
    Detect emotion from a webcam frame.
    
    Accepts JSON body with base64-encoded image:
    {
        "image": "data:image/jpeg;base64,/9j/4AAQ..."
    }
    
    Returns:
    {
        "emotion": "happy",
        "confidence": 85.5,
        "tip": "Great mood! ...",
        "emotions": {"happy": 85.5, "sad": 2.1, ...},
        "facePosition": {"x": 100, "y": 50, "width": 200, "height": 200},
        "distracted": false,
        "distractionReason": null,
        "headPose": "center",
        "eyesDetected": 2,
        "timestamp": "2026-01-02T17:55:00"
    }
    """
    _ensure_model()
    
    data = request.get_json(silent=True) or {}
    image_data = data.get("image")
    
    if not image_data:
        return jsonify({
            "error": "missing_image",
            "message": "Please provide an image in the request body",
        }), 400
    
    frame = _decode_base64_image(image_data)
    if frame is None:
        return jsonify({
            "error": "invalid_image",
            "message": "Could not decode the image data",
        }), 400
    
    # Detect face position and distraction using enhanced detection
    face_position = None
    distracted = False
    distraction_reason = None
    head_pose = "away"
    eyes_detected = 0
    
    try:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        frame_h, frame_w = frame.shape[:2]
        
        # Load cascades
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')
        profile_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_profileface.xml')
        
        # Detect frontal faces
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))
        
        if len(faces) > 0:
            # Use the largest face
            x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
            face_position = {"x": int(x), "y": int(y), "width": int(w), "height": int(h)}
            
            # Detect eyes within face region
            face_roi_gray = gray[y:y+h, x:x+w]
            eyes = eye_cascade.detectMultiScale(
                face_roi_gray,
                scaleFactor=1.1,
                minNeighbors=3,  # Reduced for better detection
                minSize=(int(w*0.08), int(h*0.04))  # type: ignore[arg-type]
            )
            eyes_detected = min(len(eyes), 2)  # Cap at 2
            
            # Calculate face center deviation
            face_center_x = x + w / 2  # type: ignore[operator]
            face_center_y = y + h / 2  # type: ignore[operator]
            deviation_x = (face_center_x - frame_w / 2) / (frame_w / 2) * 100  # type: ignore[operator]
            deviation_y = (face_center_y - frame_h / 2) / (frame_h / 2) * 100  # type: ignore[operator]
            
            # Determine head pose based on face position and eye count
            # Key rule: if 0 eyes detected, user is likely turned away
            if eyes_detected == 0:
                # No eyes visible - definitely turned or looking away
                if deviation_x > 15:
                    head_pose = "right"
                    distraction_reason = "Looking right - Please focus on the screen"
                elif deviation_x < -15:
                    head_pose = "left"
                    distraction_reason = "Looking left - Please focus on the screen"
                else:
                    head_pose = "away"
                    distraction_reason = "Not looking at screen - Please face the camera"
                distracted = True
            elif eyes_detected == 1:
                # Only one eye visible - partially turned
                if deviation_x > 15:
                    head_pose = "right"
                    distraction_reason = "Looking right - Please focus on the screen"
                elif deviation_x < -15:
                    head_pose = "left"
                    distraction_reason = "Looking left - Please focus on the screen"
                else:
                    head_pose = "turning"
                    distraction_reason = "Turning away - Please look at the screen"
                distracted = True
            else:
                # Both eyes visible - check face position
                if abs(deviation_x) > 25:
                    if deviation_x > 0:
                        head_pose = "right"
                        distraction_reason = "Looking right - Please focus on the screen"
                    else:
                        head_pose = "left"
                        distraction_reason = "Looking left - Please focus on the screen"
                    distracted = True
                elif abs(deviation_y) > 30:
                    head_pose = "away"
                    distracted = True
                    distraction_reason = "Looking up/down - Please focus on the screen"
                else:
                    head_pose = "center"
                    distracted = False
                    distraction_reason = None
        else:
            # No frontal face - check for profile
            profiles_left = profile_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))
            
            # Check right profile (flip and detect)
            flipped = cv2.flip(gray, 1)
            profiles_right = profile_cascade.detectMultiScale(flipped, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))
            
            if len(profiles_left) > 0:
                head_pose = "left"
                distracted = True
                distraction_reason = "Turned left - Please look at the screen"
            elif len(profiles_right) > 0:
                head_pose = "right"
                distracted = True
                distraction_reason = "Turned right - Please look at the screen"
            else:
                head_pose = "away"
                distracted = True
                distraction_reason = "Face not visible - Please look at the camera"
                
    except Exception as e:
        print(f"[AI Engine] Face/distraction detection error: {e}")
    
    result = _analyze_frame(frame)
    if not result:
        return jsonify({
            "emotion": "unknown",
            "confidence": 0,
            "tip": "Could not detect a face. Please ensure your face is visible to the camera.",
            "facePosition": None,
            "distracted": True,
            "distractionReason": "No face detected",
            "headPose": "away",
            "eyesDetected": 0,
            "timestamp": datetime.now().isoformat(),
        })
    
    dominant_emotion = result.get("dominant_emotion", "neutral")
    emotion_scores = result.get("emotion", {})
    confidence = float(emotion_scores.get(dominant_emotion, 0))
    tip = EMOTION_TIPS.get(dominant_emotion, EMOTION_TIPS["neutral"])

    # Save to MongoDB via Node server (non-blocking)
    user_id = data.get("userId")
    _save_emotion_to_db(dominant_emotion, confidence, distracted, head_pose, user_id)

    return jsonify({
        "emotion": dominant_emotion,
        "confidence": round(confidence, 1),  # type: ignore[call-overload]
        "tip": tip,
        "emotions": {k: round(float(v), 1) for k, v in emotion_scores.items()},  # type: ignore[call-overload]
        "facePosition": face_position,
        "distracted": distracted,
        "distractionReason": distraction_reason,
        "headPose": head_pose,
        "eyesDetected": eyes_detected,
        "timestamp": datetime.now().isoformat(),
    })


@app.route("/analyze_emotion", methods=["POST"])
def analyze_emotion():
    """
    Legacy endpoint for file-based emotion analysis.
    Used by the standalone OpenCV client (emotion_detection.py).
    """
    _ensure_model()
    
    if "image" not in request.files:
        return jsonify({"error": "missing_image"}), 400

    file = request.files.get("image")
    if not file:
        return jsonify({"error": "missing_image"}), 400

    frame = _decode_file_image(file.read())
    if frame is None:
        return jsonify({"error": "invalid_image"}), 400

    result = _analyze_frame(frame)
    if not result:
        return jsonify({"error": "analysis_failed"}), 500

    dominant_emotion = result.get("dominant_emotion")
    emotion_scores = result.get("emotion", {})
    
    return jsonify({
        "dominant_emotion": dominant_emotion,
        "emotion_scores": emotion_scores,
    })


# WebSocket events for real-time streaming
@socketio.on("connect")
def handle_connect():
    """Handle client connection."""
    print(f"[AI Engine] Client connected: {request.sid}")
    emit("status", {"connected": True})


@socketio.on("disconnect")
def handle_disconnect():
    """Handle client disconnection."""
    print(f"[AI Engine] Client disconnected: {request.sid}")


@socketio.on("frame-forward")
def handle_frame(data):
    """
    Handle incoming video frame for real-time emotion detection.
    Emits 'emotion-update' event with the analysis result.
    """
    _ensure_model()
    
    frame_data = data.get("frame") if isinstance(data, dict) else data
    if not frame_data:
        return
    
    frame = _decode_base64_image(frame_data)
    if frame is None:
        emit("emotion-update", {
            "emotion": "unknown",
            "confidence": 0,
            "tip": "Could not decode frame",
            "timestamp": datetime.now().isoformat(),
        })
        return
    
    result = _analyze_frame(frame)
    if not result:
        emit("emotion-update", {
            "emotion": "unknown",
            "confidence": 0,
            "tip": "No face detected",
            "timestamp": datetime.now().isoformat(),
        })
        return
    
    dominant_emotion = result.get("dominant_emotion", "neutral")
    emotion_scores = result.get("emotion", {})
    confidence = emotion_scores.get(dominant_emotion, 0)
    tip = EMOTION_TIPS.get(dominant_emotion, EMOTION_TIPS["neutral"])
    
    emit("emotion-update", {
        "emotion": dominant_emotion,
        "confidence": round(confidence, 1),  # type: ignore[call-overload]
        "tip": tip,
        "emotions": {k: round(v, 1) for k, v in emotion_scores.items()},  # type: ignore[call-overload]
        "timestamp": datetime.now().isoformat(),
    }, broadcast=True)


# =============================================================================
# Document Analysis & Quiz Generation for AI Twin
# =============================================================================

def _init_gemini():
    """Initialize Gemini API with environment key."""
    if not GEMINI_SUPPORT:
        return False
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("VITE_GEMINI_API_KEY")
    if not api_key:
        print("[AI Engine] No Gemini API key found. Set GEMINI_API_KEY environment variable.")
        return False
    genai.configure(api_key=api_key)
    return True


def _extract_pdf_text(file_bytes: bytes) -> str:
    """Extract text content from a PDF file."""
    if not PDF_SUPPORT:
        return ""
    try:
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
        text_content = []
        for page in pdf_reader.pages:
            page_text = page.extract_text()
            if page_text:
                text_content.append(page_text)
        return "\n\n".join(text_content)
    except Exception as e:
        print(f"[AI Engine] PDF extraction error: {e}")
        return ""



def _get_generative_model(model_name="gemini-2.0-flash"):
    """Get a generative model by checking available models first."""
    # First, get list of available models that support generateContent
    available_models = []
    try:
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                available_models.append(m.name)
    except Exception as e:
        print(f"[AI Engine] Warning: Could not list models: {e}")
        # Fall back to trying the requested model anyway
        return genai.GenerativeModel(model_name)
    
    if not available_models:
        print("[AI Engine] Warning: No models found, using default")
        return genai.GenerativeModel(model_name)
    
    # Check if requested model is available (exact match or contains the name)
    for available in available_models:
        if model_name in available or available.endswith(model_name):
            print(f"[AI Engine] Using model: {available}")
            return genai.GenerativeModel(available)
    
    # Fallback: try common model names (2024-2025 models)
    fallbacks = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-flash-latest", "gemini-pro-latest"]
    for name in fallbacks:
        for available in available_models:
            if name in available:
                print(f"[AI Engine] Falling back to model: {available}")
                return genai.GenerativeModel(available)
    
    # Just use the first available model
    first_model = available_models[0]
    print(f"[AI Engine] Using first available model: {first_model}")
    return genai.GenerativeModel(first_model)


def _analyze_with_ai(content: str, prompt_type: str = "explain") -> dict:
    """
    Analyze content using AI - tries Llama first, falls back to Gemini.
    
    This allows local AI processing when Llama is available,
    with cloud fallback for reliability.
    """
    # Build the prompt based on type
    _content_15k: str = str(content[:15000])  # type: ignore[index]
    _content_10k: str = str(content[:10000])  # type: ignore[index]
    if prompt_type == "explain":
        prompt = f"""You are Jarvis, an AI communication tutor. Analyze and explain the following document content in a clear, educational manner:

{_content_15k}

Provide:
1. A brief summary (2-3 sentences)
2. Key concepts or main points (bullet list)
3. Any important details the reader should understand

Keep your explanation conversational and engaging. After explaining, ask if the user has any questions."""

    elif prompt_type == "quiz":
        prompt = f"""Based on the following content, generate exactly 5 multiple-choice quiz questions to test understanding.

Content:
{_content_10k}

Return your response as a valid JSON array with this exact format:
[
  {{
    "question": "What is the main topic discussed?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": 0,
    "explanation": "Brief explanation of why this answer is correct"
  }}
]

Make questions progressively harder. Ensure the JSON is valid and properly formatted."""

    else:
        prompt = content
    
    # Try Llama first (local, no API costs)
    if LLAMA_SUPPORT:
        llama_result = _generate_with_llama(prompt)
        if "success" in llama_result:
            print("[AI Engine] Response generated using local Llama model")
            return llama_result
        else:
            print(f"[AI Engine] Llama unavailable, falling back: {llama_result.get('error', 'unknown')}")
    
    # Try OpenAI (cloud, requires API key)
    if OPENAI_SUPPORT and OPENAI_API_KEY:
        openai_result = _generate_with_openai(prompt)
        if "success" in openai_result:
            print("[AI Engine] Response generated using OpenAI API")
            return openai_result
        else:
            print(f"[AI Engine] OpenAI unavailable, falling back to Gemini: {openai_result.get('error', 'unknown')}")
    
    # Fall back to Gemini
    if not _init_gemini():
        return {"error": "No AI backend available (Llama not loaded, OpenAI not configured, Gemini not configured)"}
    
    try:
        model = _get_generative_model("gemini-1.5-flash")
        response = model.generate_content(prompt)
        print("[AI Engine] Response generated using Gemini API")
        return {"success": True, "response": response.text}
    
    except Exception as e:
        print(f"[AI Engine] Gemini analysis error: {e}")
        return {"error": str(e)}


# Alias for backward compatibility
def _analyze_with_gemini(content: str, prompt_type: str = "explain") -> dict:
    """Backward compatible alias for _analyze_with_ai."""
    return _analyze_with_ai(content, prompt_type)


def _analyze_image_with_gemini(image_bytes: bytes) -> dict:
    """Use Gemini Vision to analyze an image."""
    if not _init_gemini():
        return {"error": "Gemini API not configured"}
    
    try:
        model = _get_generative_model("gemini-1.5-flash")
        
        # Encode image to base64 for Gemini
        image_base64 = base64.b64encode(image_bytes).decode("utf-8")
        
        prompt = """You are Jarvis, an AI communication tutor. Analyze this image in detail and explain what you see.

Provide:
1. A description of what's in the image
2. Key information or concepts shown
3. Any educational value or insights

After your explanation, ask if the user has any questions about what they see."""

        response = model.generate_content([
            prompt,
            {"mime_type": "image/jpeg", "data": image_base64}
        ])
        
        return {"success": True, "response": response.text}
    
    except Exception as e:
        print(f"[AI Engine] Image analysis error: {e}")
        return {"error": str(e)}



def _analyze_pdf_with_gemini(pdf_bytes: bytes) -> dict:
    """Use Gemini Vision to analyze a PDF file directly (fallback for scanned PDFs)."""
    if not _init_gemini():
        return {"error": "Gemini API not configured"}
    
    try:
        model = _get_generative_model("gemini-1.5-flash")
        
        # Encode PDF to base64 for Gemini
        pdf_base64 = base64.b64encode(pdf_bytes).decode("utf-8")
        
        prompt = """You are Jarvis, an AI communication tutor. Analyze this PDF document in detail.

Provide:
1. A comprehensive summary of the document's content
2. Key concepts, definitions, and main points
3. Any important details worth noting

Note: This analysis will be used to generate a quiz later, so cover the material thoroughly."""

        response = model.generate_content([
            prompt,
            {"mime_type": "application/pdf", "data": pdf_base64}
        ])
        
        return {"success": True, "response": response.text}
    
    except Exception as e:
        print(f"[AI Engine] PDF analysis error: {e}")
        return {"error": str(e)}


@app.route("/analyze-document", methods=["POST"])
def analyze_document():
    """
    Analyze an uploaded document (PDF or image).
    
    Accepts multipart form data with:
    - file: The uploaded file
    - type: 'pdf' or 'image'
    
    Returns analysis and explanation from Gemini.
    """
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files["file"]
    file_type = request.form.get("type", "").lower()
    
    if not file.filename:
        return jsonify({"error": "Empty filename"}), 400
    
    file_bytes = file.read()
    
    if file_type == "pdf" or file.filename.lower().endswith(".pdf"):
        # Extract and analyze PDF
        text_content = _extract_pdf_text(file_bytes)
        if not text_content:
            # Fallback to Gemini PDF analysis (for scanned/image-based PDFs)
            print("[AI Engine] Text extraction failed, falling back to Gemini Vision for PDF...")
            result = _analyze_pdf_with_gemini(file_bytes)
            
            if "error" in result:
                return jsonify(result), 500
                
            return jsonify({
                "success": True,
                "type": "pdf",
                "analysis": result["response"],
                "extractedText": "", # No text extracted, quiz will generate from analysis
                "timestamp": datetime.now().isoformat(),
            })
        
        result = _analyze_with_gemini(text_content, "explain")
        if "error" in result:
            return jsonify(result), 500
        
        return jsonify({
            "success": True,
            "type": "pdf",
            "analysis": result["response"],
            "extractedText": text_content[:5000],  # type: ignore[index]
            "timestamp": datetime.now().isoformat(),
        })
    
    elif file_type == "image" or file.filename.lower().endswith((".png", ".jpg", ".jpeg", ".gif", ".webp")):
        # Analyze image
        result = _analyze_image_with_gemini(file_bytes)
        if "error" in result:
            return jsonify(result), 500
        
        return jsonify({
            "success": True,
            "type": "image",
            "analysis": result["response"],
            "timestamp": datetime.now().isoformat(),
        })
    
    else:
        return jsonify({
            "error": "Unsupported file type",
            "message": "Please upload a PDF or image file."
        }), 400


@app.route("/generate-quiz", methods=["POST"])
def generate_quiz():
    """
    Generate quiz questions from document content.
    
    Accepts JSON body:
    {
        "content": "The text content to generate quiz from",
        "questionCount": 5  // optional, defaults to 5
    }
    """
    data = request.get_json(silent=True) or {}
    content = data.get("content", "")
    
    if not content:
        return jsonify({"error": "No content provided"}), 400
    
    result = _analyze_with_gemini(content, "quiz")
    if "error" in result:
        return jsonify(result), 500
    
    # Parse the quiz JSON from Gemini response
    try:
        response_text = result["response"]
        # Extract JSON from response (handle markdown code blocks)
        json_match = re.search(r'\[[\s\S]*\]', response_text)
        if json_match:
            questions = json.loads(json_match.group())
        else:
            questions = json.loads(response_text)
        
        return jsonify({
            "success": True,
            "questions": questions,
            "timestamp": datetime.now().isoformat(),
        })
    except json.JSONDecodeError as e:
        print(f"[AI Engine] Quiz JSON parse error: {e}")
        return jsonify({
            "error": "Failed to parse quiz questions",
            "raw": result["response"]
        }), 500


@app.route("/evaluate-quiz", methods=["POST"])
def evaluate_quiz():
    """
    Evaluate user's quiz answers.
    
    Accepts JSON body:
    {
        "questions": [...],  // Array of question objects
        "answers": [0, 1, 2, 0, 3]  // User's selected answer indices
    }
    """
    data = request.get_json(silent=True) or {}
    questions = data.get("questions", [])
    answers = data.get("answers", [])
    
    if not questions or not answers:
        return jsonify({"error": "Missing questions or answers"}), 400
    
    if len(questions) != len(answers):
        return jsonify({"error": "Question and answer count mismatch"}), 400
    
    results = []
    correct_count = 0
    
    for i, (question, user_answer) in enumerate(zip(questions, answers)):
        correct_answer = question.get("correct", 0)
        is_correct = user_answer == correct_answer
        if is_correct:
            correct_count += 1  # type: ignore[operator]
        
        results.append({
            "questionIndex": i,
            "userAnswer": user_answer,
            "correctAnswer": correct_answer,
            "isCorrect": is_correct,
            "explanation": question.get("explanation", ""),
        })
    
    score_percentage = round((correct_count / len(questions)) * 100, 1)  # type: ignore[call-overload]
    
    # Generate feedback based on score
    if score_percentage >= 90:
        feedback = "Excellent work! You have a strong understanding of this material."
    elif score_percentage >= 70:
        feedback = "Good job! You understand most of the key concepts."
    elif score_percentage >= 50:
        feedback = "Not bad! Review the explanations to strengthen your understanding."
    else:
        feedback = "Keep practicing! Review the material and try again."
    
    return jsonify({
        "success": True,
        "results": results,
        "correctCount": correct_count,
        "totalQuestions": len(questions),
        "scorePercentage": score_percentage,
        "feedback": feedback,
        "timestamp": datetime.now().isoformat(),
    })


# =============================================================================
# PDF Interview Trainer Mode
# =============================================================================

@app.route("/start-pdf-interview", methods=["POST"])
def start_pdf_interview():
    """
    Start PDF Interview Training mode.
    Extracts concepts, definitions, workflows from the PDF and generates teaching content.
    
    Accepts multipart form data with:
    - file: The uploaded PDF file
    
    Returns structured teaching content organized by topics.
    """
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files["file"]
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Please upload a PDF file"}), 400
    
    file_bytes = file.read()
    
    # Extract text from PDF
    text_content = _extract_pdf_text(file_bytes)
    
    if not text_content:
        # Try Gemini Vision for scanned PDFs
        result = _analyze_pdf_with_gemini(file_bytes)
        if "error" in result:
            return jsonify(result), 500
        text_content = result["response"]
    
    if not _init_gemini():
        return jsonify({"error": "Gemini API not configured"}), 500
    
    try:
        model = _get_generative_model("gemini-1.5-flash")
        
        _text_20k: str = str(text_content[:20000])  # type: ignore[index]
        prompt = f"""You are an expert interview trainer. Analyze the following document and extract learning content for interview preparation.

Document Content:
{_text_20k}

Your task:
1. Identify ALL key concepts, definitions, workflows, and examples from the document
2. DO NOT introduce any external topics - only use content from this document
3. Organize the content into logical teaching topics (max 5 topics)
4. For each topic, provide a clear, concise explanation

Return your response as a valid JSON object with this exact format:
{{
    "documentTitle": "Brief title describing the document",
    "topics": [
        {{
            "title": "Topic 1 Title",
            "explanation": "Clear explanation of this topic. Start simple, then add technical depth. Keep it under 200 words.",
            "keyPoints": ["Key point 1", "Key point 2", "Key point 3"]
        }}
    ],
    "totalConcepts": 10,
    "difficulty": "beginner|intermediate|advanced"
}}

Ensure the JSON is valid and properly formatted. Do not include markdown code blocks."""

        response = model.generate_content(prompt)
        response_text = response.text
        
        # Parse JSON from response
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            teaching_data = json.loads(json_match.group())
        else:
            teaching_data = json.loads(response_text)
        
        return jsonify({
            "success": True,
            "teachingContent": teaching_data,
            "extractedText": text_content[:5000],  # type: ignore[index]
            "timestamp": datetime.now().isoformat(),
        })
        
    except json.JSONDecodeError as e:
        print(f"[AI Engine] Teaching content JSON parse error: {e}")
        return jsonify({
            "error": "Failed to parse teaching content",
            "raw": response_text if 'response_text' in dir() else ""
        }), 500
    except Exception as e:
        print(f"[AI Engine] Interview teaching error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/generate-interview-question", methods=["POST"])
def generate_interview_question():
    """
    Generate a single interview question based on PDF content.
    
    Accepts JSON body:
    {
        "content": "The PDF content",
        "difficulty": "easy|medium|hard",
        "previousQuestions": ["Previous Q1", "Previous Q2"],
        "questionType": "conceptual|practical|scenario"  // optional
    }
    
    Returns one interview-style question.
    """
    data = request.get_json(silent=True) or {}
    content = data.get("content", "")
    difficulty = data.get("difficulty", "medium")
    previous_questions = data.get("previousQuestions", [])
    question_type = data.get("questionType", "")
    
    if not content:
        return jsonify({"error": "No content provided"}), 400
    
    if not _init_gemini():
        return jsonify({"error": "Gemini API not configured"}), 500
    
    try:
        model = _get_generative_model("gemini-1.5-flash")
        
        previous_q_text = ""
        if previous_questions:
            previous_q_text = f"\n\nPreviously asked questions (DO NOT repeat):\n" + "\n".join(f"- {q}" for q in previous_questions[-5:])  # type: ignore[index]
        
        type_instruction = ""
        if question_type == "conceptual":
            type_instruction = "Ask about definitions, concepts, or theoretical understanding."
        elif question_type == "practical":
            type_instruction = "Ask about practical applications, real-world usage, or implementation."
        elif question_type == "scenario":
            type_instruction = "Present a scenario and ask how the candidate would handle it."
        
        _content_snippet: str = str(content[:10000])  # type: ignore[index]
        prompt = f"""You are a technical interviewer. Generate ONE interview question based STRICTLY on the following document content.

Document Content:
{_content_snippet}
{previous_q_text}

Requirements:
- Difficulty level: {difficulty}
- {type_instruction if type_instruction else "Mix question types: conceptual, practical, or scenario-based."}
- Question must be answerable using ONLY the document content
- DO NOT ask about topics not covered in the document
- Make the question clear and specific
- For {difficulty} difficulty: {"ask basic definition/recall questions" if difficulty == "easy" else "ask application/analysis questions" if difficulty == "medium" else "ask complex scenario/evaluation questions"}

Return your response as a valid JSON object:
{{
    "question": "Your interview question here",
    "questionType": "conceptual|practical|scenario",
    "expectedTopics": ["Topic 1", "Topic 2"],
    "idealAnswerPoints": ["Point 1 that should be mentioned", "Point 2", "Point 3"],
    "difficulty": "{difficulty}"
}}

Ensure valid JSON without markdown code blocks."""

        response = model.generate_content(prompt)
        response_text = response.text
        
        # Parse JSON
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            question_data = json.loads(json_match.group())
        else:
            question_data = json.loads(response_text)
        
        return jsonify({
            "success": True,
            "question": question_data,
            "timestamp": datetime.now().isoformat(),
        })
        
    except json.JSONDecodeError as e:
        print(f"[AI Engine] Question JSON parse error: {e}")
        return jsonify({"error": "Failed to parse question"}), 500
    except Exception as e:
        print(f"[AI Engine] Question generation error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/evaluate-interview-answer", methods=["POST"])
def evaluate_interview_answer():
    """
    Evaluate user's text answer to an interview question.
    
    Accepts JSON body:
    {
        "question": "The interview question",
        "userAnswer": "User's text response",
        "idealAnswerPoints": ["Expected point 1", "Point 2"],
        "pdfContent": "Original PDF content for context"
    }
    
    Returns evaluation scores and feedback.
    """
    data = request.get_json(silent=True) or {}
    question = data.get("question", "")
    user_answer = data.get("userAnswer", "")
    ideal_points = data.get("idealAnswerPoints", [])
    pdf_content = data.get("pdfContent", "")
    
    if not question or not user_answer:
        return jsonify({"error": "Question and answer are required"}), 400
    
    if not _init_gemini():
        return jsonify({"error": "Gemini API not configured"}), 500
    
    try:
        model = _get_generative_model("gemini-1.5-flash")
        
        ideal_points_text = "\n".join(f"- {p}" for p in ideal_points) if ideal_points else "Not provided"
        
        _ref_content: str = str(pdf_content[:5000]) if pdf_content else "Not provided"  # type: ignore[index]

        prompt = f"""You are an expert interview evaluator. Evaluate the candidate's answer fairly and constructively.

Interview Question: {question}

Candidate's Answer: {user_answer}

Expected Key Points:
{ideal_points_text}

Reference Material (for context):
{_ref_content}

Evaluate the answer and return a JSON response:
{{
    "accuracy": 0-100,  // How correct is the answer based on the source material?
    "clarity": 0-100,   // How clear and well-structured is the response?
    "understanding": 0-100,  // Does the candidate demonstrate true understanding?
    "overallScore": 0-100,  // Weighted average
    "isCorrect": true/false,  // Did they answer correctly overall?
    "feedback": "Constructive feedback on their answer",
    "correction": "If incorrect, provide the correct answer politely. If correct, leave empty.",
    "betterAnswer": "A model answer they could aspire to",
    "coveredPoints": ["Points they covered well"],
    "missedPoints": ["Important points they missed"],
    "recommendedDifficulty": "easier|same|harder"  // For next question
}}

Rules:
- Be encouraging but honest
- If incorrect, correct politely and explain
- If correct, acknowledge and suggest how to make it even better
- Ensure valid JSON without markdown code blocks."""

        response = model.generate_content(prompt)
        response_text = response.text
        
        # Parse JSON
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            evaluation = json.loads(json_match.group())
        else:
            evaluation = json.loads(response_text)
        
        return jsonify({
            "success": True,
            "evaluation": evaluation,
            "timestamp": datetime.now().isoformat(),
        })
        
    except json.JSONDecodeError as e:
        print(f"[AI Engine] Evaluation JSON parse error: {e}")
        return jsonify({"error": "Failed to parse evaluation"}), 500
    except Exception as e:
        print(f"[AI Engine] Answer evaluation error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/generate-interview-feedback", methods=["POST"])
def generate_interview_feedback():
    """
    Generate comprehensive session feedback after interview ends.
    
    Accepts JSON body:
    {
        "questions": [{"question": "...", "userAnswer": "...", "evaluation": {...}}],
        "documentTitle": "Title of the studied document",
        "totalTime": 600  // seconds
    }
    
    Returns strengths, weaknesses, readiness score, and tips.
    """
    data = request.get_json(silent=True) or {}
    questions = data.get("questions", [])
    document_title = data.get("documentTitle", "Document")
    total_time = data.get("totalTime", 0)
    
    if not questions:
        return jsonify({"error": "No questions data provided"}), 400
    
    if not _init_gemini():
        return jsonify({"error": "Gemini API not configured"}), 500
    
    try:
        model = _get_generative_model("gemini-1.5-flash")
        
        # Build summary of Q&A session
        qa_summary = []
        for i, q in enumerate(questions, 1):
            eval_data = q.get("evaluation", {})
            _user_answer_preview: str = str(q.get('userAnswer', 'N/A'))[:200]  # type: ignore[index]
            qa_summary.append(f"""
Question {i}: {q.get('question', 'N/A')}
Answer: {_user_answer_preview}...
Score: {eval_data.get('overallScore', 'N/A')}%
Correct: {eval_data.get('isCorrect', 'N/A')}
""")
        
        _dur_min: int = int(total_time) // 60  # type: ignore[arg-type]
        _dur_sec: int = int(total_time) % 60  # type: ignore[arg-type]
        
        prompt = f"""You are an expert career coach reviewing an interview practice session.

Document Studied: {document_title}
Total Questions: {len(questions)}
Session Duration: {_dur_min} minutes {_dur_sec} seconds

Q&A Session Summary:
{"".join(qa_summary)}

Generate a comprehensive feedback report as JSON:
{{
    "overallScore": 0-100,  // Interview readiness percentage
    "performance": "excellent|good|satisfactory|needs_improvement",
    "strengths": [
        "Specific strength 1 with example",
        "Specific strength 2 with example"
    ],
    "weakAreas": [
        "Specific area to improve with suggestion",
        "Another area with actionable advice"
    ],
    "interviewReadiness": {{
        "score": 0-100,
        "verdict": "Ready for interviews|Almost ready|Needs more practice|Requires significant preparation",
        "explanation": "Brief explanation of readiness level"
    }},
    "improvementTips": [
        "Actionable tip 1",
        "Actionable tip 2", 
        "Actionable tip 3"
    ],
    "topicsToReview": ["Topic 1", "Topic 2"],
    "encouragement": "A motivating closing message"
}}

Be constructive, specific, and actionable. Ensure valid JSON without markdown."""

        response = model.generate_content(prompt)
        response_text = response.text
        
        # Parse JSON
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            feedback = json.loads(json_match.group())
        else:
            feedback = json.loads(response_text)
        
        return jsonify({
            "success": True,
            "feedback": feedback,
            "timestamp": datetime.now().isoformat(),
        })
        
    except json.JSONDecodeError as e:
        print(f"[AI Engine] Feedback JSON parse error: {e}")
        return jsonify({"error": "Failed to parse feedback"}), 500
    except Exception as e:
        print(f"[AI Engine] Feedback generation error: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"[AI Engine] Starting AI server on port {port}")
    print("[AI Engine] Endpoints:")
    print(f"  - GET  /health                     - Health check")
    print(f"  - POST /emotion                    - Detect emotion from base64 image")
    print(f"  - POST /analyze_emotion            - Legacy file upload endpoint")
    print(f"  - POST /analyze-document           - Analyze PDF/image attachments")
    print(f"  - POST /generate-quiz              - Generate quiz from content")
    print(f"  - POST /evaluate-quiz              - Evaluate quiz answers")
    print(f"  - POST /start-pdf-interview        - Start PDF interview training")
    print(f"  - POST /generate-interview-question - Generate interview question")
    print(f"  - POST /evaluate-interview-answer  - Evaluate interview answer")
    print(f"  - POST /generate-interview-feedback - Generate session feedback")
    print(f"  - WebSocket                        - Real-time frame processing")
    
    # Pre-load the model
    _ensure_model()
    
    # Run with SocketIO for WebSocket support
    socketio.run(app, host="0.0.0.0", port=port, debug=False, allow_unsafe_werkzeug=True)

