"""
Tutor Jarvis - Dedicated AI server for document analysis and quiz generation
Simpler, cleaner server focused only on AI Twin attachment features
"""

import base64
import io
import json
import os
from datetime import datetime
from pathlib import Path

from typing import Optional, Any

from flask import Flask, jsonify, request  # type: ignore[import]
from flask_cors import CORS  # type: ignore[import]

# Load environment variables
try:
    from dotenv import load_dotenv  # type: ignore[import]
    
    # Try multiple possible .env locations
    possible_env_paths = [
        Path(__file__).resolve().parent.parent / '.env',  # ai_engine/.env
        Path(__file__).resolve().parent / '.env',          # ai_engine/api/.env
        Path(__file__).resolve().parent.parent.parent / '.env',  # project root/.env
    ]
    
    env_loaded = False
    for env_path in possible_env_paths:
        if env_path.exists():
            load_dotenv(dotenv_path=env_path, override=True)
            print(f"[Tutor Jarvis] Loaded config from {env_path}")
            env_loaded = True
            break
    
    if not env_loaded:
        print(f"[Tutor Jarvis] No .env file found in: {[str(p) for p in possible_env_paths]}")
        
    # Debug: Check if GEMINI_API_KEY is set
    if os.environ.get("GEMINI_API_KEY"):
        print(f"[Tutor Jarvis] GEMINI_API_KEY is set")
    else:
        print(f"[Tutor Jarvis] WARNING: GEMINI_API_KEY not found in environment")
        
except Exception as e:
    print(f"[Tutor Jarvis] Config loading error: {e}")

# Optional imports
try:
    import PyPDF2  # type: ignore[import]
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False
    print("[Tutor Jarvis] PyPDF2 not installed - PDF text extraction disabled")

try:
    import google.generativeai as genai  # type: ignore[import]
    GEMINI_SUPPORT = True
except ImportError:
    GEMINI_SUPPORT = False
    print("[Tutor Jarvis] google-generativeai not installed")

# Ollama support (local AI - no API key required)
import requests  # type: ignore[import]
OLLAMA_BASE_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.1")

def _check_ollama() -> bool:
    """Check if Ollama is running."""
    try:
        response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=3)
        return response.status_code == 200
    except:
        return False

def _generate_with_ollama(prompt: str, system_prompt: Optional[str] = None) -> dict:
    """Generate text using Ollama."""
    try:
        payload = {
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
        }
        if system_prompt:
            payload["system"] = system_prompt
        
        response = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json=payload,
            timeout=120
        )
        
        if response.status_code == 200:
            return {"success": True, "response": response.json().get("response", "")}
        return {"error": f"Ollama error: {response.status_code}"}
    except requests.exceptions.ConnectionError:
        return {"error": "Ollama not running"}
    except Exception as e:
        return {"error": str(e)}

OLLAMA_AVAILABLE = _check_ollama()
print(f"[Tutor Jarvis] Ollama available: {OLLAMA_AVAILABLE}")

# OpenAI support
try:
    from openai import OpenAI as _OpenAIClient  # type: ignore[import]
    OPENAI_SUPPORT = True
except ImportError:
    OPENAI_SUPPORT = False
    print("[Tutor Jarvis] openai not installed — OpenAI support disabled.")

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

_openai_client = None


def _generate_with_openai(prompt: str, system_prompt: Optional[str] = None) -> dict:
    """Generate text using OpenAI API."""
    global _openai_client
    if not OPENAI_SUPPORT or not OPENAI_API_KEY:
        return {"error": "OpenAI not configured"}
    try:
        if _openai_client is None:
            _openai_client = _OpenAIClient(api_key=OPENAI_API_KEY)
        messages: list[dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        response = _openai_client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=messages,  # type: ignore[arg-type]
            temperature=0.7,
        )
        content = response.choices[0].message.content or ""
        return {"success": True, "response": content}
    except Exception as e:
        print(f"[Tutor Jarvis] OpenAI error: {e}")
        return {"error": str(e)}

# Flask app
app = Flask(__name__)
CORS(app)

# Configuration
PORT = int(os.environ.get("TUTOR_PORT", 8001))
app.config['MAX_CONTENT_LENGTH'] = 200 * 1024 * 1024  # 200MB max file size


# =============================================================================
# Helper Functions
# =============================================================================

def _init_gemini():
    """Initialize Gemini API with environment key."""
    if not GEMINI_SUPPORT:
        return False
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("[Tutor Jarvis] No GEMINI_API_KEY found in environment")
        return False
    genai.configure(api_key=api_key)
    print(f"[Tutor Jarvis] Gemini configured with key: {api_key[:4]}...{api_key[-4:]}")  # type: ignore[index]
    return True


def _get_available_model():
    """Get the first available Gemini model that supports generateContent."""
    try:
        models = genai.list_models()
        for m in models:
            if 'generateContent' in m.supported_generation_methods:
                print(f"[Tutor Jarvis] Using model: {m.name}")
                return genai.GenerativeModel(m.name)
    except Exception as e:
        print(f"[Tutor Jarvis] Error listing models: {e}")
    
    # Fallback to current model names (2024-2025)
    for model_name in ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-flash-latest", "gemini-pro-latest"]:
        try:
            print(f"[Tutor Jarvis] Trying fallback model: {model_name}")
            return genai.GenerativeModel(model_name)
        except:
            continue
    
    return None


def _extract_pdf_text(file_bytes):
    """Extract text from PDF file."""
    if not PDF_SUPPORT:
        return ""
    try:
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
        text_content = []
        for page in pdf_reader.pages:
            page_text = page.extract_text()
            if page_text:
                text_content.append(page_text)
        return "\\n\\n".join(text_content)
    except Exception as e:
        print(f"[Tutor Jarvis] PDF extraction error: {e}")
        return ""


def _analyze_pdf_with_gemini(pdf_bytes):
    """Analyze PDF using Gemini Vision (for scanned/image-based PDFs)."""
    if not _init_gemini():
        return {"error": "Gemini API not configured"}
    
    try:
        model = _get_available_model()
        if not model:
            return {"error": "No Gemini model available"}
        
        pdf_base64 = base64.b64encode(pdf_bytes).decode("utf-8")
        
        prompt = """You are Jarvis, an AI tutor. Analyze this PDF document comprehensively.

Provide:
1. A detailed summary of the content
2. Key concepts and main points
3. Important details worth noting

Your analysis will be used for quiz generation, so be thorough."""

        response = model.generate_content([
            prompt,
            {"mime_type": "application/pdf", "data": pdf_base64}
        ])
        
        return {"success": True, "response": response.text}
    except Exception as e:
        print(f"[Tutor Jarvis] PDF analysis error: {e}")
        return {"error": str(e)}


def _analyze_image_with_gemini(image_bytes):
    """Analyze image using Gemini Vision."""
    if not _init_gemini():
        return {"error": "Gemini API not configured"}
    
    try:
        model = _get_available_model()
        if not model:
            return {"error": "No Gemini model available"}
        
        image_base64 = base64.b64encode(image_bytes).decode("utf-8")
        
        prompt = """You are Jarvis, an AI tutor. Analyze this image in detail.

Provide:
1. Description of what's in the image
2. Key information or concepts shown
3. Educational value or insights

After your explanation, ask if the user has questions."""

        response = model.generate_content([
            prompt,
            {"mime_type": "image/jpeg", "data": image_base64}
        ])
        
        return {"success": True, "response": response.text}
    except Exception as e:
        print(f"[Tutor Jarvis] Image analysis error: {e}")
        return {"error": str(e)}


def _analyze_text_with_gemini(content, prompt_type="explain"):
    """Analyze text content - tries Ollama first, falls back to Gemini."""
    
    # Build the prompt based on type
    if prompt_type == "explain":
        prompt = f"""You are Jarvis, an AI brain performance coach. Analyze this document and help the user learn actively:

{content[:15000]}

Provide:
1. A comprehensive explanation of the key concepts in the document
2. Key takeaways extracted (max 5 bullet points)
3. Teach the material fully first. Do NOT ask "What do you already know?".
4. End with: "Want me to quiz you on this material to lock it in?"

Be concise. Use chunked delivery. Never dump walls of text."""

    elif prompt_type == "quiz":
        prompt = f"""Based on this content, create a 5-question multiple choice quiz with adaptive difficulty:

{content[:15000]}

Return ONLY valid JSON in this exact format:
[
  {{
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": 0,
    "explanation": "Brief explanation + what to review if wrong",
    "difficulty": "easy|medium|hard"
  }}
]

Make questions progressively harder. Include difficulty labels. Focus on testing understanding, not memorization."""
    else:
        prompt = content
    
    system_prompt = "You are Jarvis, a brain performance coach. Guide thinking before answering. Be proactive — suggest next steps, offer quizzes, detect confusion. Keep responses chunked and structured."
    
    # Try Ollama first (local, free)
    if _check_ollama():
        result = _generate_with_ollama(prompt, system_prompt)
        if "success" in result:
            print("[Tutor Jarvis] Response generated using Ollama")
            return result
        print(f"[Tutor Jarvis] Ollama failed, falling back: {result.get('error')}")
    
    # Fallback to OpenAI
    if OPENAI_SUPPORT and OPENAI_API_KEY:
        result = _generate_with_openai(prompt, system_prompt)
        if "success" in result:
            print("[Tutor Jarvis] Response generated using OpenAI")
            return result
        print(f"[Tutor Jarvis] OpenAI failed, falling back to Gemini: {result.get('error')}")
    
    # Fallback to Gemini
    if not _init_gemini():
        return {"error": "No AI backend available. Install Ollama, configure OpenAI API key, or configure Gemini API key."}
    
    try:
        model = _get_available_model()
        if not model:
            return {"error": "No Gemini model available"}
        
        response = model.generate_content(prompt)
        print("[Tutor Jarvis] Response generated using Gemini")
        return {"success": True, "response": response.text}
    except Exception as e:
        print(f"[Tutor Jarvis] Text analysis error: {e}")
        return {"error": str(e)}



# =============================================================================
# API Endpoints
# =============================================================================

@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    return jsonify({
        "status": "online",
        "service": "tutor-jarvis",
        "timestamp": datetime.now().isoformat(),
    })


@app.route("/analyze-document", methods=["POST"])
def analyze_document():
    """Analyze an uploaded document (PDF or image)."""
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files["file"]
    file_type = request.form.get("type", "").lower()
    
    if not file.filename:
        return jsonify({"error": "Empty filename"}), 400
    
    file_bytes = file.read()
    
    # Handle PDF
    if file_type == "pdf" or file.filename.lower().endswith(".pdf"):
        text_content = _extract_pdf_text(file_bytes)
        
        if not text_content:
            # Fallback to Gemini Vision for scanned PDFs
            print("[Tutor Jarvis] No text extracted, using Gemini Vision...")
            result = _analyze_pdf_with_gemini(file_bytes)
            
            if "error" in result:
                return jsonify(result), 500
            
            return jsonify({
                "success": True,
                "type": "pdf",
                "analysis": result["response"],
                "extractedText": "",
                "timestamp": datetime.now().isoformat(),
            })
        
        # Analyze extracted text
        result = _analyze_text_with_gemini(text_content, "explain")
        if "error" in result:
            return jsonify(result), 500
        
        return jsonify({
            "success": True,
            "type": "pdf",
            "analysis": result["response"],
            "extractedText": text_content[:5000],  # type: ignore[index]
            "timestamp": datetime.now().isoformat(),
        })
    
    # Handle Image
    elif file_type == "image" or file.filename.lower().endswith((".png", ".jpg", ".jpeg", ".gif", ".webp")):
        result = _analyze_image_with_gemini(file_bytes)
        
        if "error" in result:
            return jsonify(result), 500
        
        return jsonify({
            "success": True,
            "type": "image",
            "analysis": result["response"],
            "timestamp": datetime.now().isoformat(),
        })
    
    return jsonify({"error": "Unsupported file type"}), 400


@app.route("/generate-quiz", methods=["POST"])
def generate_quiz():
    """Generate quiz questions from content."""
    data = request.get_json(silent=True) or {}
    content = data.get("content", "")
    
    if not content:
        return jsonify({"error": "No content provided"}), 400
    
    result = _analyze_text_with_gemini(content, "quiz")
    
    if "error" in result:
        return jsonify(result), 500
    
    # Parse the quiz JSON from response
    try:
        quiz_text = result["response"].strip()  # type: ignore[union-attr]
        # Remove markdown code blocks if present
        if "```json" in quiz_text:
            quiz_text = quiz_text.split("```json")[1].split("```")[0]
        elif "```" in quiz_text:
            quiz_text = quiz_text.split("```")[1].split("```")[0]
        
        questions = json.loads(quiz_text)
        
        return jsonify({
            "success": True,
            "questions": questions,
            "timestamp": datetime.now().isoformat(),
        })
    except json.JSONDecodeError as e:
        print(f"[Tutor Jarvis] Quiz JSON parse error: {e}")
        return jsonify({
            "error": "Failed to parse quiz",
            "details": str(e),
            "raw_response": result["response"]
        }), 500


@app.route("/evaluate-quiz", methods=["POST"])
def evaluate_quiz():
    """Evaluate quiz answers and return score."""
    data = request.get_json(silent=True) or {}
    questions = data.get("questions", [])
    user_answers = data.get("answers") or data.get("userAnswers", [])
    
    if not questions or not user_answers:
        return jsonify({"error": "Missing questions or answers"}), 400
    
    results = []
    correct_count = 0
    
    for i, question in enumerate(questions):
        user_answer = user_answers[i] if i < len(user_answers) else None  # type: ignore[index]
        correct_answer = question.get("correct", 0)
        is_correct = user_answer == correct_answer
        
        if is_correct:
            correct_count += 1  # type: ignore[operator]
        
        results.append({
            "questionIndex": i,
            "isCorrect": is_correct,
            "userAnswer": user_answer,
            "correctAnswer": correct_answer,
            "explanation": question.get("explanation", "")
        })
    
    score = (correct_count / len(questions)) * 100 if questions else 0  # type: ignore[operator]
    
    # Generate feedback based on score
    if score >= 90:
        feedback = "Excellent work! You've mastered this material."
    elif score >= 70:
        feedback = "Good job! You have a solid understanding."
    elif score >= 50:
        feedback = "Not bad! Review the missed questions to improve."
    else:
        feedback = "Keep studying! Review the material and try again."
    
    return jsonify({
        "success": True,
        "score": round(score, 1),  # type: ignore[call-overload]
        "scorePercentage": round(score, 1),  # type: ignore[call-overload]
        "correctCount": correct_count,
        "totalQuestions": len(questions),
        "feedback": feedback,
        "results": results,
        "timestamp": datetime.now().isoformat(),
    })

# =============================================================================
# PDF Interview Trainer Mode
# =============================================================================

import re

@app.route("/start-pdf-interview", methods=["POST"])
def start_pdf_interview():
    """Start PDF Interview Training mode - extract teaching content."""
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files["file"]
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Please upload a PDF file"}), 400
    
    file_bytes = file.read()
    text_content = _extract_pdf_text(file_bytes)
    
    if not text_content:
        result = _analyze_pdf_with_gemini(file_bytes)
        if "error" in result:
            return jsonify(result), 500
        text_content = result["response"]
    
    if not _init_gemini():
        return jsonify({"error": "Gemini API not configured"}), 500
    
    try:
        model = _get_available_model()
        if not model:
            return jsonify({"error": "No Gemini model available"}), 500
        
        _doc_snippet: str = str(text_content[:20000])  # type: ignore[index]
        prompt = f"""You are an expert interview trainer. Analyze the following document and extract learning content.

Document Content:
{_doc_snippet}

Your task:
1. Identify ALL key concepts, definitions, workflows from this document
2. DO NOT introduce external topics
3. Organize into max 5 teaching topics
4. Provide clear explanations for each topic

Return valid JSON:
{{
    "documentTitle": "Brief title",
    "topics": [
        {{
            "title": "Topic Title",
            "explanation": "Clear explanation under 200 words",
            "keyPoints": ["Key point 1", "Key point 2"]
        }}
    ],
    "totalConcepts": 10,
    "difficulty": "beginner|intermediate|advanced"
}}

No markdown code blocks."""

        response = model.generate_content(prompt)
        response_text = response.text
        
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
        print(f"[Tutor Jarvis] Teaching content JSON error: {e}")
        return jsonify({"error": "Failed to parse teaching content"}), 500
    except Exception as e:
        print(f"[Tutor Jarvis] Interview training error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/generate-interview-question", methods=["POST"])
def generate_interview_question():
    """Generate a single interview question based on PDF content."""
    data = request.get_json(silent=True) or {}
    content = data.get("content", "")
    difficulty = data.get("difficulty", "medium")
    previous_questions = data.get("previousQuestions", [])
    
    if not content:
        return jsonify({"error": "No content provided"}), 400
    
    if not _init_gemini():
        return jsonify({"error": "Gemini API not configured"}), 500
    
    try:
        model = _get_available_model()
        if not model:
            return jsonify({"error": "No Gemini model available"}), 500
        
        prev_q_text = ""
        if previous_questions:
            prev_q_text = "\n\nPreviously asked (DO NOT repeat):\n" + "\n".join(f"- {q}" for q in previous_questions[-5:])  # type: ignore[index]
        
        _content_snippet: str = str(content[:10000])  # type: ignore[index]
        prompt = f"""Generate ONE interview question based STRICTLY on this content:

{_content_snippet}
{prev_q_text}

Difficulty: {difficulty}
- Question must be answerable using ONLY the document
- DO NOT ask about external topics

Return valid JSON:
{{
    "question": "Interview question here",
    "questionType": "conceptual|practical|scenario",
    "expectedTopics": ["Topic 1"],
    "idealAnswerPoints": ["Point 1", "Point 2"],
    "difficulty": "{difficulty}"
}}

No markdown."""

        response = model.generate_content(prompt)
        response_text = response.text
        
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
        print(f"[Tutor Jarvis] Question JSON error: {e}")
        return jsonify({"error": "Failed to parse question"}), 500
    except Exception as e:
        print(f"[Tutor Jarvis] Question generation error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/evaluate-interview-answer", methods=["POST"])
def evaluate_interview_answer():
    """Evaluate user's text answer to an interview question."""
    data = request.get_json(silent=True) or {}
    question = data.get("question", "")
    user_answer = data.get("userAnswer", "")
    ideal_points = data.get("idealAnswerPoints", [])
    pdf_content = data.get("pdfContent", "")
    
    if not question or not user_answer:
        return jsonify({"error": "Question and answer required"}), 400
    
    if not _init_gemini():
        return jsonify({"error": "Gemini API not configured"}), 500
    
    try:
        model = _get_available_model()
        if not model:
            return jsonify({"error": "No Gemini model available"}), 500
        
        ideal_text = "\n".join(f"- {p}" for p in ideal_points) if ideal_points else "Not provided"
        
        _ref_snippet: str = str(pdf_content[:5000]) if pdf_content else "N/A"  # type: ignore[index]

        prompt = f"""Evaluate this interview answer fairly:

Question: {question}
Answer: {user_answer}
Expected Points:
{ideal_text}

Reference:
{_ref_snippet}

Return valid JSON:
{{
    "accuracy": 0-100,
    "clarity": 0-100,
    "understanding": 0-100,
    "overallScore": 0-100,
    "isCorrect": true/false,
    "feedback": "Constructive feedback",
    "correction": "If wrong, correct answer. Empty if correct.",
    "betterAnswer": "Model answer",
    "coveredPoints": ["Points covered"],
    "missedPoints": ["Points missed"],
    "recommendedDifficulty": "easier|same|harder"
}}

Be encouraging but honest. No markdown."""

        response = model.generate_content(prompt)
        response_text = response.text
        
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
        print(f"[Tutor Jarvis] Evaluation JSON error: {e}")
        return jsonify({"error": "Failed to parse evaluation"}), 500
    except Exception as e:
        print(f"[Tutor Jarvis] Evaluation error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/generate-interview-feedback", methods=["POST"])
def generate_interview_feedback():
    """Generate comprehensive session feedback after interview ends."""
    data = request.get_json(silent=True) or {}
    questions = data.get("questions", [])
    document_title = data.get("documentTitle", "Document")
    total_time = data.get("totalTime", 0)
    
    if not questions:
        return jsonify({"error": "No questions data provided"}), 400
    
    if not _init_gemini():
        return jsonify({"error": "Gemini API not configured"}), 500
    
    try:
        model = _get_available_model()
        if not model:
            return jsonify({"error": "No Gemini model available"}), 500
        
        qa_summary = []
        for i, q in enumerate(questions, 1):
            eval_data = q.get("evaluation", {})
            qa_summary.append(f"Q{i}: {q.get('question', 'N/A')[:100]}\nScore: {eval_data.get('overallScore', 'N/A')}%")
        
        _duration_min: int = int(total_time) // 60  # type: ignore[arg-type]
        _duration_sec: int = int(total_time) % 60  # type: ignore[arg-type]
        
        prompt = f"""Review this interview practice session:

Document: {document_title}
Questions: {len(questions)}
Duration: {_duration_min}m {_duration_sec}s

Summary:
{chr(10).join(qa_summary)}

Return valid JSON:
{{
    "overallScore": 0-100,
    "performance": "excellent|good|satisfactory|needs_improvement",
    "strengths": ["Strength 1", "Strength 2"],
    "weakAreas": ["Area to improve"],
    "interviewReadiness": {{
        "score": 0-100,
        "verdict": "Ready|Almost ready|Needs practice",
        "explanation": "Brief explanation"
    }},
    "improvementTips": ["Tip 1", "Tip 2"],
    "topicsToReview": ["Topic 1"],
    "encouragement": "Motivating message"
}}

Be constructive. No markdown."""

        response = model.generate_content(prompt)
        response_text = response.text
        
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
        print(f"[Tutor Jarvis] Feedback JSON error: {e}")
        return jsonify({"error": "Failed to parse feedback"}), 500
    except Exception as e:
        print(f"[Tutor Jarvis] Feedback error: {e}")
        return jsonify({"error": str(e)}), 500


# =============================================================================
# Main
# =============================================================================

if __name__ == "__main__":
    print(f"""
================================================
       TUTOR JARVIS AI SERVER              
   Document Analysis & Quiz Generation     
   + PDF Interview Trainer Mode           
================================================

Available endpoints:
  - GET  /health                      Health check
  - POST /analyze-document            Analyze PDF/image
  - POST /generate-quiz               Generate quiz
  - POST /evaluate-quiz               Evaluate answers
  - POST /start-pdf-interview         Start interview training
  - POST /generate-interview-question Generate interview Q
  - POST /evaluate-interview-answer   Evaluate answer
  - POST /generate-interview-feedback Session feedback

Starting on http://127.0.0.1:{PORT}
""")
    app.run(host="127.0.0.1", port=PORT, debug=True)
