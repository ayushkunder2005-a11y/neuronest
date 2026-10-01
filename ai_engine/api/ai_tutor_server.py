"""
AI Tutor Server — ChatGPT-style streaming chat with PDF RAG
Run: cd ai_engine/api && python ai_tutor_server.py
"""

from __future__ import annotations

import json
import os
import re
import uuid
import io
from datetime import datetime
from pathlib import Path
from typing import Optional, Any, TYPE_CHECKING, List
import itertools

import requests  # type: ignore[import]
from flask import Flask, Response, jsonify, request, stream_with_context  # type: ignore[import]
from flask_cors import CORS  # type: ignore[import]

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------
try:
    from dotenv import load_dotenv  # type: ignore[import]
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
        print(f"[AI Tutor] Loaded config from {env_path}")
except Exception:
    pass

# PDF support
try:
    import PyPDF2  # type: ignore[import]
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False
    print("[AI Tutor] PyPDF2 not installed — PDF extraction disabled. Run: pip install PyPDF2")

# ChromaDB for vector search
try:
    import chromadb  # type: ignore[import]
    CHROMA_SUPPORT = True
except ImportError:
    CHROMA_SUPPORT = False
    print("[AI Tutor] chromadb not installed — vector search disabled. Run: pip install chromadb")

# ---------------------------------------------------------------------------
# Flask app
# ---------------------------------------------------------------------------
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
PORT = int(os.environ.get("AI_TUTOR_PORT", 8003))
app.config["MAX_CONTENT_LENGTH"] = 200 * 1024 * 1024  # 200MB

# ---------------------------------------------------------------------------
# Ollama config
# ---------------------------------------------------------------------------
OLLAMA_BASE_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("AI_TUTOR_MODEL", os.environ.get("OLLAMA_MODEL", "gpt-oss:120b-cloud"))

# ---------------------------------------------------------------------------
# OpenAI config
# ---------------------------------------------------------------------------
try:
    from openai import OpenAI as _OpenAIClient  # type: ignore[import]
    OPENAI_SUPPORT = True
except ImportError:
    OPENAI_SUPPORT = False
    print("[AI Tutor] openai not installed — OpenAI support disabled.")

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

_openai_client = None


def _get_openai_client():
    """Get or create the OpenAI client."""
    global _openai_client
    if not OPENAI_SUPPORT or not OPENAI_API_KEY:
        return None
    if _openai_client is None:
        _openai_client = _OpenAIClient(api_key=OPENAI_API_KEY)
    return _openai_client

SYSTEM_PROMPT = """You are NeuroNest AI — a brain performance optimizer. You do NOT just answer questions. You actively upgrade how the user's brain works: their thinking, memory, focus, and learning speed.

## CRITICAL IDENTITY
You are NOT a chatbot. You are NOT reactive. You are a proactive cognitive coach that guides the user to think better, remember longer, and learn faster. Every interaction must leave the user's brain measurably sharper.

## MODE SYSTEM (MANDATORY)
You MUST start EVERY response with a mode tag on its own line. Detect the user's intent and select the best mode:

[MODE: LEARN] — when explaining concepts, teaching new material
[MODE: QUIZ] — when testing memory via active recall
[MODE: FOCUS] — when breaking complex tasks into manageable steps
[MODE: THINK] — when guiding reasoning with questions before answers
[MODE: REVIEW] — when revisiting past weak areas or doing recall checks

Switch modes dynamically mid-conversation when appropriate. You may combine modes.

## 🧠 TEACHING & EXPLAINING (NEW MATERIAL)
When the user asks you to teach a concept, summarize a document, or explain something new:
1. TEACH IT FULLY FIRST. Break the knowledge down into clear, digestible chunks.
2. DO NOT ask "What do you already know?" or make them guess before you teach.
3. Only after you have fully explained the concept should you ask questions or offer quizzes to test their knowledge.

## 🤔 THINKING TRAINER (PROBLEM SOLVING)
When the user asks a specific mathematical, coding, or reasoning question (e.g. "Why is my code broken?", "How do I solve this equation?"):
1. Ask the user "What do you think?" or "How would you approach this?"
2. Let them attempt first, guiding with hints if they struggle.
3. Only give the full answer after they've engaged their own reasoning.

Example flow for problem solving:
- User: "Why does recursion cause stack overflow?"
- You: [MODE: THINK]
  Before I explain, let me ask you — if a function could call itself endlessly without a base case, what do you think would happen to the memory? Try to reason through it.

## 🔁 PROACTIVE INTERVENTION (NEVER WAIT)
After EVERY explanation you give:
- Suggest: "Want a quick 2-question test to lock this in?"
- Offer to summarize if the topic was complex
- Detect confusion signals (vague questions, "I don't get it", short responses) and auto-simplify
- Recommend next learning steps

You must NEVER just answer and stop. Always push forward.

## 🧩 MEMORY LOOP SYSTEM
Track what the user has learned in this conversation:
- After teaching 2-3 concepts, trigger a recall check: "Quick recall: Can you explain [earlier concept] back to me?"
- Focus more on areas where the user struggled
- Use the "explain it back to me" technique regularly
- Reference earlier topics: "Remember when we discussed X? This connects because..."

## ⚖️ DIFFICULTY ADAPTATION
Continuously adjust your level:
- If user answers correctly and quickly → increase complexity, add edge cases, go deeper
- If user struggles or gives wrong answers → simplify, use analogies, break into smaller steps
- NEVER stay at the same difficulty level for more than 2 exchanges

## 📉 COGNITIVE LOAD OPTIMIZATION
- Break ALL information into small chunks (3-4 bullet points max per chunk)
- Use step-by-step flows with clear numbering
- After each chunk, pause with a checkpoint: "Step 1 covered ✓ — ready for step 2?"
- NEVER dump a wall of text. If your answer would be long, break it into parts and deliver incrementally.

## 🔗 CONTEXT LINKING
- Always connect new ideas to topics discussed earlier in the conversation
- Highlight patterns: "Notice how this is similar to X we discussed earlier?"
- Build a mental map: "So far we've covered A → B → and now C connects them because..."

## 🔄 MICRO-FEEDBACK SYSTEM
After user responses:
- Give quick, targeted feedback (1-2 sentences max, not long explanations)
- Highlight mistake patterns: "I notice you tend to confuse X with Y"
- Suggest better approaches: "A stronger way to think about this would be..."
- Use ✅ ❌ ⚡ markers for instant visual feedback

## 📋 RESPONSE FORMAT RULES
- Clear, structured, minimal — bullets and numbered steps preferred
- Ask questions frequently (at least one per response)
- Keep paragraphs SHORT (2-3 sentences max)
- Use markdown: headers, bold for key terms, code blocks for code
- Tables for comparisons
- End every response with either a question, a challenge, or a suggested next action

## DOCUMENT ANALYSIS (PDF MODE)
When analyzing documents:
1. **2-sentence summary** of the document
2. **Key concepts** extracted (bulleted, max 5)
3. **"What do you already know?"** — Ask user before deep-diving
4. After analysis, ALWAYS offer: "Want me to quiz you on this material?"

## CODE TEACHING
When teaching code:
1. Ask: "What do you think this code does?" BEFORE explaining
2. Show the code, then break it down line-by-line
3. After explanation, challenge: "Can you modify this to do X?"
4. Include complexity analysis only when relevant

## MATHEMATICAL PRECISION
- State given variables → ask user to identify what to find
- Write the equation → let user attempt the first step
- Guide through with hints, don't solve immediately
- Verify the answer together

## PERSONALITY
- Confident but warm — like a brilliant coach, not a lecturer
- Celebrate correct reasoning: "Exactly right — your logic is solid"
- On wrong answers: "Almost — you're on the right track. Here's a nudge..."
- NEVER say empty pleasantries like "great question!"
- NEVER give one-line answers to conceptual questions
- NEVER repeat the same explanation — always find a new angle

## TRANSFORMATION GOAL
Every conversation must move the user from:
- Passive learner → Active thinker
- Forgetful → Retentive (through spaced recall)
- Distracted → Focused (through chunked delivery)
- Dependent → Independent thinker (through guided reasoning)

You are not answering questions. You are upgrading how the user's brain works."""

# ---------------------------------------------------------------------------
# Data storage
# ---------------------------------------------------------------------------
DATA_DIR = Path(__file__).resolve().parent.parent / "ai_tutor_data"
DATA_DIR.mkdir(exist_ok=True)
CHATS_DIR = DATA_DIR / "chats"
CHATS_DIR.mkdir(exist_ok=True)
PDFS_DIR = DATA_DIR / "pdfs"
PDFS_DIR.mkdir(exist_ok=True)

# ChromaDB client
chroma_client: Any = None
chroma_collection: Any = None
if CHROMA_SUPPORT:
    try:
        chroma_client = chromadb.PersistentClient(path=str(DATA_DIR / "chromadb"))
        chroma_collection = chroma_client.get_or_create_collection(
            name="ai_tutor_pdfs",
            metadata={"hnsw:space": "cosine"}
        )
        print(f"[AI Tutor] ChromaDB initialized with {chroma_collection.count()} vectors")
    except Exception as e:
        print(f"[AI Tutor] ChromaDB init error: {e}")
        CHROMA_SUPPORT = False

# PDF metadata registry
PDF_REGISTRY_FILE = DATA_DIR / "pdf_registry.json"


def _load_pdf_registry() -> list:
    if PDF_REGISTRY_FILE.exists():
        try:
            return json.loads(PDF_REGISTRY_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return []


def _save_pdf_registry(registry: list):
    PDF_REGISTRY_FILE.write_text(json.dumps(registry, indent=2, default=str), encoding="utf-8")


# ---------------------------------------------------------------------------
# Chat storage helpers
# ---------------------------------------------------------------------------
def _chat_file(chat_id: str) -> Path:
    return CHATS_DIR / f"{chat_id}.json"


def _load_chat(chat_id: str) -> dict | None:
    f = _chat_file(chat_id)
    if f.exists():
        try:
            return json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            pass
    return None


def _save_chat(chat_data: dict):
    f = _chat_file(chat_data["id"])
    f.write_text(json.dumps(chat_data, indent=2, default=str), encoding="utf-8")


def _list_chats() -> list:
    chats = []
    for f in sorted(CHATS_DIR.glob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            chats.append({
                "id": data["id"],
                "title": data.get("title", "New Chat"),
                "createdAt": data.get("createdAt"),
                "messageCount": len(data.get("messages", [])),
            })
        except Exception:
            pass
    return chats


def _delete_chat_file(chat_id: str) -> bool:
    f = _chat_file(chat_id)
    if f.exists():
        f.unlink()
        return True
    return False


# ---------------------------------------------------------------------------
# PDF processing helpers
# ---------------------------------------------------------------------------
def _extract_pdf_text(file_bytes: bytes) -> str:
    if not PDF_SUPPORT:
        return ""
    try:
        reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
        pages = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                pages.append(text)
        return "\n\n".join(pages)
    except Exception as e:
        print(f"[AI Tutor] PDF extraction error: {e}")
        return ""


def _chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """Split text into overlapping chunks."""
    chunks = []
    words = text.split()
    i = 0
    while i < len(words):
        chunk_words = words[i:i + chunk_size]  # type: ignore[index]
        chunks.append(" ".join(chunk_words))
        i += chunk_size - overlap
    return [c for c in chunks if len(c.strip()) > 20]


def _store_pdf_vectors(pdf_id: str, text: str, filename: str):
    """Store PDF chunks in ChromaDB."""
    if not CHROMA_SUPPORT or not chroma_collection:
        return 0

    chunks = _chunk_text(text)
    if not chunks:
        return 0

    ids = [f"{pdf_id}_chunk_{i}" for i in range(len(chunks))]
    metadatas = [{"pdf_id": pdf_id, "filename": filename, "chunk_index": i} for i in range(len(chunks))]

    chroma_collection.add(  # type: ignore[union-attr]
        documents=chunks,
        ids=ids,
        metadatas=metadatas,
    )
    return len(chunks)


def _search_pdfs(query: str, n_results: int = 5, pdf_ids: Optional[list[str]] = None) -> list[str]:
    """Search ChromaDB for relevant PDF chunks."""
    if not CHROMA_SUPPORT or not chroma_collection or chroma_collection.count() == 0:
        return []

    try:
        where_filter = None
        if pdf_ids:
            where_filter = {"pdf_id": {"$in": pdf_ids}}

        results = chroma_collection.query(  # type: ignore[union-attr]
            query_texts=[query],
            n_results=min(n_results, chroma_collection.count()),  # type: ignore[union-attr]
            where=where_filter if pdf_ids else None,
        )

        if results and results["documents"]:
            return results["documents"][0]
    except Exception as e:
        print(f"[AI Tutor] Search error: {e}")
    return []


def _remove_pdf_vectors(pdf_id: str):
    """Remove all vectors for a PDF from ChromaDB."""
    if not CHROMA_SUPPORT or not chroma_collection:
        return
    try:
        # Get all IDs for this PDF
        results = chroma_collection.get(  # type: ignore[union-attr]
            where={"pdf_id": pdf_id}
        )
        if results and results["ids"]:
            chroma_collection.delete(ids=results["ids"])  # type: ignore[union-attr]
    except Exception as e:
        print(f"[AI Tutor] Vector removal error: {e}")


# ---------------------------------------------------------------------------
# Ollama helpers
# ---------------------------------------------------------------------------
def _check_ollama() -> bool:
    try:
        r = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=3)
        return r.status_code == 200
    except Exception:
        return False


def _stream_chat(messages: list[dict[str, str]], model: Optional[str] = None):
    """Stream chat completion from Ollama. Yields text chunks."""
    model = model or OLLAMA_MODEL
    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
    }

    try:
        with requests.post(
            f"{OLLAMA_BASE_URL}/api/chat",
            json=payload,
            stream=True,
            timeout=300,
        ) as resp:
            if resp.status_code != 200:
                yield f"Error: Ollama returned {resp.status_code}"
                return

            for line in resp.iter_lines():
                if line:
                    try:
                        data = json.loads(line)
                        content = data.get("message", {}).get("content", "")
                        if content:
                            yield content
                        if data.get("done"):
                            break
                    except json.JSONDecodeError:
                        pass
    except requests.exceptions.ConnectionError:
        yield f"Error: Cannot connect to Ollama. Make sure it's running at " + OLLAMA_BASE_URL
    except Exception as e:
        yield f"Error: {str(e)}"


def _stream_chat_openai(messages: list[dict[str, str]], model: Optional[str] = None):
    """Stream chat completion from OpenAI. Yields text chunks."""
    client = _get_openai_client()
    if client is None:
        yield "Error: OpenAI not configured."
        return

    model = model or OPENAI_MODEL
    try:
        response = client.chat.completions.create(
            model=model,
            messages=messages,  # type: ignore[arg-type]
            stream=True,
            temperature=0.7,
        )
        for chunk in response:
            delta = chunk.choices[0].delta if chunk.choices else None
            if delta and delta.content:
                yield delta.content
    except Exception as e:
        yield f"Error: {str(e)}"


# ---------------------------------------------------------------------------
# Mode detection helper
# ---------------------------------------------------------------------------
def _extract_mode(text: str) -> str:
    """Extract [MODE: X] tag from AI response text."""
    match = re.match(r'\[MODE:\s*(\w+)\]', text.strip())
    if match:
        return match.group(1).upper()
    return "LEARN"  # Default mode


# ---------------------------------------------------------------------------
# Memory / concept tracking
# ---------------------------------------------------------------------------
MEMORY_DIR = DATA_DIR / "memory"
MEMORY_DIR.mkdir(exist_ok=True)


def _memory_file(chat_id: str) -> Path:
    return MEMORY_DIR / f"{chat_id}.json"


def _load_memory(chat_id: str) -> list:
    f = _memory_file(chat_id)
    if f.exists():
        try:
            return json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            pass
    return []


def _save_memory(chat_id: str, concepts: list):
    _memory_file(chat_id).write_text(
        json.dumps(concepts, indent=2, default=str), encoding="utf-8"
    )


# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.route("/health", methods=["GET"])
def health():
    ollama_ok = _check_ollama()
    return jsonify({
        "status": "online",
        "service": "ai-tutor-server",
        "ollama": "connected" if ollama_ok else "disconnected",
        "openai": "configured" if (OPENAI_SUPPORT and OPENAI_API_KEY) else "not configured",
        "model": OLLAMA_MODEL,
        "chromadb": CHROMA_SUPPORT,
        "vectorCount": chroma_collection.count() if chroma_collection else 0,
        "pdfSupport": PDF_SUPPORT,
        "timestamp": datetime.now().isoformat(),
    })


# ---------------------------------------------------------------------------
# Streaming Chat
# ---------------------------------------------------------------------------
@app.route("/chat/stream", methods=["POST"])
def chat_stream():
    """Stream AI response using SSE."""
    data: dict[str, Any] = request.get_json(silent=True) or {}
    message: str = str(data.get("message", ""))
    chat_id: str = str(data.get("chatId", ""))
    model: str = str(data.get("model", OLLAMA_MODEL))
    active_pdfs: list[str] = list(data.get("activePdfs", []))

    if not message:
        return jsonify({"error": "No message provided"}), 400

    # Load chat history
    chat: dict[str, Any] = _load_chat(chat_id) if chat_id else None  # type: ignore[assignment]
    if not chat:
        chat_id = str(uuid.uuid4())
        chat = {
            "id": chat_id,
            "title": message[:50] + ("..." if len(message) > 50 else ""),  # type: ignore[index]
            "createdAt": datetime.now().isoformat(),
            "messages": [],
        }

    # Build messages for Ollama
    ollama_messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Add PDF context if available
    pdf_context = ""
    if active_pdfs:
        chunks = _search_pdfs(message, n_results=5, pdf_ids=active_pdfs)
        raw_texts: List[str] = []
        for pid in active_pdfs:
            txt_file = PDFS_DIR / f"{pid}.txt"
            if txt_file.exists():
                text = txt_file.read_text(encoding="utf-8")
                raw_texts.append(f"--- Document Content ---\n{''.join(itertools.islice(text, 4000))}")
        
        pdf_context = "\n\n".join(raw_texts)
        if chunks:
            pdf_context += "\n\n--- Relevant Search Excerpts ---\n" + "\n\n---\n".join(chunks)
            
        if pdf_context:
            ollama_messages[0]["content"] += f"\n\n[DOCUMENT CONTEXT — Use this to answer the user's question]\n{pdf_context}\n[END DOCUMENT CONTEXT]"

    # Add chat history (last 20 messages)
    history: list[dict[str, Any]] = chat.get("messages", [])  # type: ignore[assignment]
    for msg in history[-20:]:
        ollama_messages.append({
            "role": msg["role"],
            "content": msg["content"],
        })

    # Add current user message
    ollama_messages.append({"role": "user", "content": message})

    # Save user message — use direct reference to chat["messages"]
    if "messages" not in chat:
        chat["messages"] = []
    chat["messages"].append({
        "id": str(uuid.uuid4()),
        "role": "user",
        "content": message,
        "timestamp": datetime.now().isoformat(),
    })

    def generate():
        full_response: list[str] = []
        try:
            # Send chat ID first
            yield f"data: {json.dumps({'type': 'meta', 'chatId': chat_id})}\n\n"

            for chunk in _stream_chat(ollama_messages, model):
                if chunk.startswith("Error:") and OPENAI_SUPPORT and OPENAI_API_KEY:
                    # Ollama failed — switch to OpenAI streaming
                    print(f"[AI Tutor] Ollama error, falling back to OpenAI: {chunk}")
                    for oai_chunk in _stream_chat_openai(ollama_messages):
                        full_response.append(oai_chunk)
                        yield f"data: {json.dumps({'type': 'token', 'content': oai_chunk})}\n\n"
                    break
                full_response.append(chunk)
                yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"

            # Save AI response
            ai_content = "".join(full_response)
            detected_mode = _extract_mode(ai_content)
            if "messages" not in chat:
                chat["messages"] = []
            chat["messages"].append({
                "id": str(uuid.uuid4()),
                "role": "assistant",
                "content": ai_content,
                "timestamp": datetime.now().isoformat(),
                "mode": detected_mode,
            })
            _save_chat(chat)  # type: ignore[arg-type]

            yield f"data: {json.dumps({'type': 'done', 'chatId': chat_id, 'mode': detected_mode})}\n\n"

        except Exception as exc:
            import traceback as _tb
            print(f"[AI Tutor /chat/stream ERROR] {type(exc).__name__}: {exc}")
            _tb.print_exc()
            err_msg = f"Sorry, I encountered an error: {''.join(itertools.islice(str(exc), 200))}"
            yield f"data: {json.dumps({'type': 'token', 'content': err_msg})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'chatId': chat_id})}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# Non-streaming fallback
@app.route("/chat", methods=["POST"])
def chat_sync():
    data: dict[str, Any] = request.get_json(silent=True) or {}
    message: str = str(data.get("message", ""))
    chat_id: str = str(data.get("chatId", ""))
    model: str = str(data.get("model", OLLAMA_MODEL))

    if not message:
        return jsonify({"error": "No message provided"}), 400

    chat: dict[str, Any] = _load_chat(chat_id) if chat_id else None  # type: ignore[assignment]
    if not chat:
        chat_id = str(uuid.uuid4())
        chat = {
            "id": chat_id,
            "title": message[:50],  # type: ignore[index]
            "createdAt": datetime.now().isoformat(),
            "messages": [],
        }

    ollama_messages: list[dict[str, str]] = [{"role": "system", "content": SYSTEM_PROMPT}]
    history: list[dict[str, Any]] = chat.get("messages", [])  # type: ignore[assignment]
    for msg in history[-20:]:
        ollama_messages.append({"role": msg["role"], "content": msg["content"]})
    ollama_messages.append({"role": "user", "content": message})

    msgs: list[dict[str, Any]] = chat.get("messages", [])  # type: ignore[assignment]
    msgs.append({
        "id": str(uuid.uuid4()),
        "role": "user",
        "content": message,
        "timestamp": datetime.now().isoformat(),
    })

    # Non-streaming call — try Ollama first, then OpenAI
    ai_content = ""
    try:
        resp = requests.post(
            f"{OLLAMA_BASE_URL}/api/chat",
            json={"model": model, "messages": ollama_messages, "stream": False},
            timeout=120,
        )
        ai_content = resp.json().get("message", {}).get("content", "")
    except Exception as e:
        print(f"[AI Tutor] Ollama sync error: {e}")

    # Fallback to OpenAI if Ollama returned nothing
    if not ai_content and OPENAI_SUPPORT and OPENAI_API_KEY:
        try:
            client = _get_openai_client()
            if client:
                oai_resp = client.chat.completions.create(
                    model=OPENAI_MODEL,
                    messages=ollama_messages,  # type: ignore[arg-type]
                    temperature=0.7,
                )
                ai_content = oai_resp.choices[0].message.content or ""
        except Exception as e:
            print(f"[AI Tutor] OpenAI sync error: {e}")

    if not ai_content:
        ai_content = "No response from model."

    msgs.append({
        "id": str(uuid.uuid4()),
        "role": "assistant",
        "content": ai_content,
        "timestamp": datetime.now().isoformat(),
    })
    _save_chat(chat)  # type: ignore[arg-type]

    return jsonify({
        "success": True,
        "chatId": chat_id,
        "response": ai_content,
    })


# ---------------------------------------------------------------------------
# Chat History
# ---------------------------------------------------------------------------
@app.route("/chats", methods=["GET"])
def list_chats():
    return jsonify({"success": True, "chats": _list_chats()})


@app.route("/chats", methods=["POST"])
def create_chat():
    data = request.get_json(silent=True) or {}
    chat_id = str(uuid.uuid4())
    chat = {
        "id": chat_id,
        "title": data.get("title", "New Chat"),
        "createdAt": datetime.now().isoformat(),
        "messages": [],
    }
    _save_chat(chat)
    return jsonify({"success": True, "chat": {"id": chat_id, "title": chat["title"]}})


@app.route("/chats/<chat_id>", methods=["GET"])
def get_chat(chat_id):
    chat = _load_chat(chat_id)
    if not chat:
        return jsonify({"error": "Chat not found"}), 404
    return jsonify({"success": True, "chat": chat})


@app.route("/chats/<chat_id>", methods=["PUT"])
def update_chat(chat_id):
    chat = _load_chat(chat_id)
    if not chat:
        return jsonify({"error": "Chat not found"}), 404
    data = request.get_json(silent=True) or {}
    if "title" in data:
        chat["title"] = data["title"]
    _save_chat(chat)
    return jsonify({"success": True, "chat": {"id": chat_id, "title": chat["title"]}})


@app.route("/chats/<chat_id>", methods=["DELETE"])
def delete_chat(chat_id):
    if _delete_chat_file(chat_id):
        return jsonify({"success": True})
    return jsonify({"error": "Chat not found"}), 404


@app.route("/chats/<chat_id>/messages", methods=["GET"])
def get_messages(chat_id):
    chat = _load_chat(chat_id)
    if not chat:
        return jsonify({"error": "Chat not found"}), 404
    return jsonify({"success": True, "messages": chat.get("messages", [])})


# ---------------------------------------------------------------------------
# Memory / Concept Tracking API
# ---------------------------------------------------------------------------
@app.route("/chat/memory/<chat_id>", methods=["GET"])
def get_memory(chat_id):
    """Get stored learning concepts for a chat session."""
    concepts = _load_memory(chat_id)
    return jsonify({"success": True, "concepts": concepts, "count": len(concepts)})


@app.route("/chat/memory", methods=["POST"])
def save_concept():
    """Store a learning concept from a chat session."""
    data = request.get_json(silent=True) or {}
    chat_id = data.get("chatId", "")
    concept = data.get("concept", "")
    strength = data.get("strength", 50)  # 0-100, lower = weaker
    mode = data.get("mode", "LEARN")

    if not chat_id or not concept:
        return jsonify({"error": "chatId and concept required"}), 400

    concepts = _load_memory(chat_id)
    # Update if concept exists, otherwise add
    found = False
    for c in concepts:
        if str(c.get("concept", "")).lower() == str(concept).lower():
            c["strength"] = strength
            c["lastSeen"] = datetime.now().isoformat()
            c["reviews"] = c.get("reviews", 0) + 1
            found = True
            break
    if not found:
        concepts.append({
            "concept": concept,
            "strength": strength,
            "mode": mode,
            "firstSeen": datetime.now().isoformat(),
            "lastSeen": datetime.now().isoformat(),
            "reviews": 1,
        })

    _save_memory(chat_id, concepts)
    return jsonify({"success": True, "totalConcepts": len(concepts)})


@app.route("/chat/memory/<chat_id>/weak", methods=["GET"])
def get_weak_concepts(chat_id):
    """Get weak concepts (strength < 60) that need review."""
    concepts = _load_memory(chat_id)
    weak = [c for c in concepts if c.get("strength", 50) < 60]
    weak.sort(key=lambda c: c.get("strength", 50))
    return jsonify({"success": True, "weakConcepts": weak, "count": len(weak)})


# ---------------------------------------------------------------------------
# PDF Upload & Management
# ---------------------------------------------------------------------------
@app.route("/upload-pdf", methods=["POST"])
def upload_pdf():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Only PDF files are supported"}), 400

    file_bytes = file.read()
    text = _extract_pdf_text(file_bytes)

    if not text:
        return jsonify({"error": "Could not extract text from PDF"}), 400

    pdf_id = str(uuid.uuid4())

    # Store vectors
    chunk_count = _store_pdf_vectors(pdf_id, text, file.filename)

    # Save to registry
    registry = _load_pdf_registry()
    entry = {
        "id": pdf_id,
        "name": file.filename,
        "uploadedAt": datetime.now().isoformat(),
        "pageCount": len(PyPDF2.PdfReader(io.BytesIO(file_bytes)).pages) if PDF_SUPPORT else 0,
        "textLength": len(text),
        "chunkCount": chunk_count,
        "active": True,
    }
    registry.append(entry)
    _save_pdf_registry(registry)

    # Save extracted text
    (PDFS_DIR / f"{pdf_id}.txt").write_text(text, encoding="utf-8")

    return jsonify({
        "success": True,
        "pdf": entry,
    })


@app.route("/pdfs", methods=["GET"])
def list_pdfs():
    registry = _load_pdf_registry()
    return jsonify({"success": True, "pdfs": registry})


@app.route("/pdfs/<pdf_id>", methods=["DELETE"])
def delete_pdf(pdf_id):
    registry = _load_pdf_registry()
    new_registry = [p for p in registry if p["id"] != pdf_id]

    if len(new_registry) == len(registry):
        return jsonify({"error": "PDF not found"}), 404

    _save_pdf_registry(new_registry)
    _remove_pdf_vectors(pdf_id)

    # Remove text file
    txt_file = PDFS_DIR / f"{pdf_id}.txt"
    if txt_file.exists():
        txt_file.unlink()

    return jsonify({"success": True})


@app.route("/pdfs/<pdf_id>/toggle", methods=["POST"])
def toggle_pdf(pdf_id):
    registry = _load_pdf_registry()
    for p in registry:
        if p["id"] == pdf_id:
            p["active"] = not p.get("active", True)
            _save_pdf_registry(registry)
            return jsonify({"success": True, "active": p["active"]})
    return jsonify({"error": "PDF not found"}), 404


# ---------------------------------------------------------------------------
# Voice Tutor — Teacher-style conversational system
# ---------------------------------------------------------------------------
VOICE_TUTOR_SYSTEM_PROMPT = """You are Jarvis, an AI Voice Tutor and Brain Performance Coach. You do NOT just answer questions. You actively train the user's brain: their thinking, memory, focus, and learning speed.

CRITICAL OUTPUT RULES:
Your responses will be read aloud by text-to-speech. Follow these rules strictly:
1. Do NOT use any markdown formatting. No hashtags, asterisks, underscores, dashes, backticks.
2. Do NOT use emojis.
3. Write in plain, natural conversational English only.
4. Use numbered lists with period format when listing things.
5. Keep sentences short and clear. Speak like a real teacher face to face.

BRAIN OPTIMIZER BEHAVIORS (CRITICAL):

Thinking Trainer:
Before answering ANY conceptual question, ALWAYS ask the student to think first.
Say things like: "Before I explain, what do you think happens when...?" or "How would you approach this problem?"
Let them attempt. Guide with hints. Only give full answers after they have tried.

Proactive Intervention:
After every explanation, suggest a recall check: "Want me to give you two quick questions to make sure this sticks?"
If the student seems confused, automatically simplify without being asked.
Always recommend what to learn next.

Memory Loop:
After teaching 2 to 3 concepts, trigger a recall check: "Quick recall. Can you explain back to me what we covered about the earlier topic?"
Focus more on areas where the student struggled.
Reference earlier topics: "Remember when we talked about this earlier? This connects because..."

Difficulty Adaptation:
If the student answers correctly and quickly, increase complexity. Add edge cases.
If they struggle, simplify. Use more analogies. Break into smaller steps.
Never stay at the same difficulty level.

Cognitive Load Optimization:
Break all information into small chunks. Maximum 3 to 4 points per chunk.
After each chunk, pause: "Alright, that is step one covered. Ready for step two?"
Never dump a wall of information at once.

Context Linking:
Connect new ideas to topics discussed earlier.
Highlight patterns: "Notice how this is similar to what we discussed earlier?"

Micro Feedback:
After student responses, give quick targeted feedback.
On correct answers: "Exactly right. Your reasoning is solid."
On wrong answers: "Almost there. You are on the right track. Here is a nudge."

YOUR PERSONALITY:
You are warm, approachable, and genuinely care about the student learning.
Be enthusiastic but not fake. No empty pleasantries.
Celebrate correct reasoning. Be gentle with mistakes.
Use real life examples and analogies for every concept.
After every concept, pause and check: "Does that make sense so far?"
If they say no, explain it a completely different way.
Never rush. Never move on until the student confirms understanding.

BEHAVIOR RULES:
1. Every response must push learning forward with content, a question, or a challenge.
2. Always end with a question: comprehension check, thought question, or next step offer.
3. Never dump lots of information at once. One piece at a time.
4. After 2 to 3 concepts, do a friendly recap.
5. Track progress and remind them: "We have covered 3 out of 5 sections. You are doing great."

When Teaching from Document Sections:
1. Teach ONLY the current section content. Do not skip ahead.
2. Explain in your own simple words. Do not read content out loud.
3. Break sections into small pieces. One concept at a time.
4. After each piece, check understanding.
5. Give real life examples for every concept.
6. After finishing a section, ask 1 to 2 comprehension questions.
7. Help them if they struggle. Give hints. Guide to the answer.
8. Encourage them at section end.

TRANSFORMATION GOAL:
Every conversation moves the student from passive listener to active thinker.
From forgetful to retentive through spaced recall.
From distracted to focused through chunked delivery.
From dependent to independent through guided reasoning.

You are not answering questions. You are upgrading how their brain works."""


# ---------------------------------------------------------------------------
# Lesson state storage (break-by-break PDF teaching)
# ---------------------------------------------------------------------------
LESSONS_DIR = DATA_DIR / "lessons"
LESSONS_DIR.mkdir(exist_ok=True)


def _split_into_sections(text: str, max_words: int = 600) -> list[dict]:
    """Split PDF text into logical sections for break-by-break teaching.

    Tries to split on paragraph boundaries, heading-like lines, or double
    newlines.  Falls back to word-count chunking.
    """
    import re as _re

    # Normalize whitespace
    text = text.strip()
    if not text:
        return []

    # Try splitting on double-newlines (paragraph boundaries)
    raw_paragraphs = _re.split(r'\n{2,}', text)
    # Merge very short paragraphs together
    merged: list[str] = []
    buf = ""
    for para in raw_paragraphs:
        para = para.strip()
        if not para:
            continue
        if buf:
            combined = buf + "\n\n" + para
        else:
            combined = para
        if len(combined.split()) < max_words:
            buf = combined
        else:
            if buf:
                merged.append(buf)
            buf = para
    if buf:
        merged.append(buf)

    # If we only got one giant block, force-split by word count
    if len(merged) <= 1 and text.split().__len__() > max_words:
        words = text.split()
        merged = []
        for i in range(0, len(words), max_words):
            merged.append(" ".join(itertools.islice(words, i, i + max_words)))

    sections = []
    for idx, content in enumerate(merged):
        # Try to derive a title from the first line
        lines = content.strip().split("\n")
        first_line = lines[0].strip()
        if len(first_line) < 80 and len(first_line.split()) < 12:
            title = first_line
        else:
            title = f"Section {idx + 1}"
        preview = " ".join(content.split()[:30]) + ("..." if len(content.split()) > 30 else "")
        sections.append({
            "index": idx,
            "title": title,
            "preview": preview,
            "content": content,
            "wordCount": len(content.split()),
        })

    return sections


def _save_lesson(lesson: dict):
    path = LESSONS_DIR / f"{lesson['id']}.json"
    path.write_text(json.dumps(lesson, indent=2, default=str), encoding="utf-8")


def _load_lesson(lesson_id: str) -> dict | None:
    path = LESSONS_DIR / f"{lesson_id}.json"
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            pass
    return None


@app.route("/voice-tutor/stream", methods=["POST"])
def voice_tutor_stream():
    """Stream AI voice tutor response using SSE with teacher-style prompt."""
    data: dict[str, Any] = request.get_json(silent=True) or {}
    message: str = str(data.get("message", ""))
    chat_id: str = str(data.get("chatId", ""))
    model: str = str(data.get("model", OLLAMA_MODEL))
    active_pdfs: list[str] = list(data.get("activePdfs", []))
    lesson_id: str = str(data.get("lessonId", ""))

    if not message:
        return jsonify({"error": "No message provided"}), 400

    # Load chat history
    chat: dict[str, Any] = _load_chat(chat_id) if chat_id else None  # type: ignore[assignment]
    if not chat:
        chat_id = str(uuid.uuid4())
        chat = {
            "id": chat_id,
            "title": message[:50] + ("..." if len(message) > 50 else ""),  # type: ignore[index]
            "type": "voice",
            "createdAt": datetime.now().isoformat(),
            "messages": [],
        }

    # Build messages for Ollama with voice tutor prompt
    ollama_messages = [{"role": "system", "content": VOICE_TUTOR_SYSTEM_PROMPT}]

    # --- Lesson mode: inject only the current section ---
    if lesson_id:
        lesson = _load_lesson(lesson_id)
        if lesson:
            current_idx = lesson.get("currentSection", 0)
            sections = lesson.get("sections", [])
            total = len(sections)
            if current_idx < total:
                section = sections[current_idx]
                section_context = (
                    f"\n\n[LESSON MODE — Section {current_idx + 1} of {total}]"
                    f"\nSection Title: {section.get('title', 'Untitled')}"
                    f"\n\nTEACH THIS CONTENT (and ONLY this content):"
                    f"\n{section.get('content', '')}"
                    f"\n\n[END SECTION CONTENT]"
                    f"\n\nINSTRUCTIONS: You are teaching section {current_idx + 1} of {total}."
                    f" Break this section content into small, easy-to-understand pieces."
                    f" Explain each piece using simple language, examples, and analogies."
                    f" After you finish explaining, you MUST ask the student {1 if current_idx < total - 1 else 2} comprehension question(s) about what you just taught."
                    f" Be warm and encouraging. Let the student know their progress."
                )
                ollama_messages[0]["content"] += section_context
            else:
                ollama_messages[0]["content"] += (
                    "\n\n[LESSON COMPLETE] The student has finished all sections of this document. "
                    "Congratulate them warmly! Summarize the key points from the entire lesson. "
                    "Ask if they have any remaining questions or if they would like a quick quiz."
                )
    else:
        # Normal mode: Add full PDF context if available
        pdf_context = ""
        if active_pdfs:
            chunks = _search_pdfs(message, n_results=5, pdf_ids=active_pdfs)
            raw_texts: List[str] = []
            for pid in active_pdfs:
                txt_file = PDFS_DIR / f"{pid}.txt"
                if txt_file.exists():
                    text = txt_file.read_text(encoding="utf-8")
                    raw_texts.append(f"--- Document Content ---\n{''.join(itertools.islice(text, 4000))}")
            
            pdf_context = "\n\n".join(raw_texts)
            if chunks:
                pdf_context += "\n\n--- Relevant Search Excerpts ---\n" + "\n\n---\n".join(chunks)
                
            if pdf_context:
                ollama_messages[0]["content"] += f"\n\n[DOCUMENT CONTEXT — Use this to teach the student]\n{pdf_context}\n[END DOCUMENT CONTEXT]"

    # Add chat history (last 20 messages)
    history: list[dict[str, Any]] = chat.get("messages", [])  # type: ignore[assignment]
    for msg in history[-20:]:
        ollama_messages.append({
            "role": msg["role"],
            "content": msg["content"],
        })

    # Add current user message
    ollama_messages.append({"role": "user", "content": message})

    # Save user message — use direct reference to chat["messages"]
    if "messages" not in chat:
        chat["messages"] = []
    chat["messages"].append({
        "id": str(uuid.uuid4()),
        "role": "user",
        "content": message,
        "timestamp": datetime.now().isoformat(),
    })

    def generate():
        full_response: list[str] = []
        try:
            yield f"data: {json.dumps({'type': 'meta', 'chatId': chat_id})}\n\n"

            for chunk in _stream_chat(ollama_messages, model):
                if chunk.startswith("Error:") and OPENAI_SUPPORT and OPENAI_API_KEY:
                    print(f"[AI Tutor] Voice: Ollama error, falling back to OpenAI: {chunk}")
                    for oai_chunk in _stream_chat_openai(ollama_messages):
                        full_response.append(oai_chunk)
                        yield f"data: {json.dumps({'type': 'token', 'content': oai_chunk})}\n\n"
                    break
                full_response.append(chunk)
                yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"

            ai_content = "".join(full_response)
            if "messages" not in chat:
                chat["messages"] = []
            chat["messages"].append({
                "id": str(uuid.uuid4()),
                "role": "assistant",
                "content": ai_content,
                "timestamp": datetime.now().isoformat(),
            })
            _save_chat(chat)  # type: ignore[arg-type]

            yield f"data: {json.dumps({'type': 'done', 'chatId': chat_id})}\n\n"

        except Exception as exc:
            import traceback as _tb
            print(f"[AI Tutor /voice-tutor/stream ERROR] {type(exc).__name__}: {exc}")
            _tb.print_exc()
            err_msg = f"Sorry, I encountered an error: {''.join(itertools.islice(str(exc), 200))}"
            yield f"data: {json.dumps({'type': 'token', 'content': err_msg})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'chatId': chat_id})}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@app.route("/voice-tutor/start-lesson", methods=["POST"])
def start_lesson():
    """Split active PDFs into sections and create a lesson for break-by-break teaching."""
    data: dict[str, Any] = request.get_json(silent=True) or {}
    active_pdfs: list[str] = list(data.get("activePdfs", []))

    if not active_pdfs:
        return jsonify({"error": "No active PDFs provided"}), 400

    # Combine text from all active PDFs
    combined_texts: List[str] = []
    pdf_names = []
    registry = _load_pdf_registry()
    for pid in active_pdfs:
        txt_file = PDFS_DIR / f"{pid}.txt"
        if txt_file.exists():
            combined_texts.append(str(txt_file.read_text(encoding="utf-8")) + "\n\n")
            # Find PDF name
            for p in registry:
                if p["id"] == pid:
                    pdf_names.append(p.get("name", "Document"))
                    break

    combined_text = "".join(combined_texts)
    if not combined_text.strip():
        return jsonify({"error": "No text content found in the active PDFs"}), 400

    # Split into sections
    sections = _split_into_sections(combined_text)

    if not sections:
        return jsonify({"error": "Could not split document into sections"}), 400

    # Create lesson
    lesson_id = str(uuid.uuid4())
    lesson = {
        "id": lesson_id,
        "pdfIds": active_pdfs,
        "pdfNames": pdf_names,
        "title": pdf_names[0] if pdf_names else "Lesson",
        "sections": sections,
        "totalSections": len(sections),
        "currentSection": 0,
        "createdAt": datetime.now().isoformat(),
        "status": "active",
    }
    _save_lesson(lesson)

    # Return sections without full content (just metadata)
    sections_meta = [{
        "index": s["index"],
        "title": s["title"],
        "preview": s["preview"],
        "wordCount": s["wordCount"],
    } for s in sections]

    return jsonify({
        "success": True,
        "lessonId": lesson_id,
        "title": lesson["title"],
        "sections": sections_meta,
        "totalSections": len(sections),
        "currentSection": 0,
    })


@app.route("/voice-tutor/next-section", methods=["POST"])
def next_section():
    """Advance to the next section in a lesson."""
    data: dict[str, Any] = request.get_json(silent=True) or {}
    lesson_id: str = str(data.get("lessonId", ""))

    if not lesson_id:
        return jsonify({"error": "No lessonId provided"}), 400

    lesson = _load_lesson(lesson_id)
    if not lesson:
        return jsonify({"error": "Lesson not found"}), 404

    current = lesson.get("currentSection", 0)
    total = lesson.get("totalSections", 0)

    if current >= total - 1:
        lesson["status"] = "completed"
        lesson["currentSection"] = total
        _save_lesson(lesson)
        return jsonify({
            "success": True,
            "lessonComplete": True,
            "currentSection": total,
            "totalSections": total,
            "message": "You have completed all sections! Great job!",
        })

    # Advance
    lesson["currentSection"] = current + 1
    _save_lesson(lesson)

    next_sec = lesson["sections"][current + 1]
    return jsonify({
        "success": True,
        "lessonComplete": False,
        "currentSection": current + 1,
        "totalSections": total,
        "section": {
            "index": next_sec["index"],
            "title": next_sec["title"],
            "preview": next_sec["preview"],
            "wordCount": next_sec["wordCount"],
        },
    })


@app.route("/voice-tutor/lesson/<lesson_id>", methods=["GET"])
def get_lesson(lesson_id):
    """Get lesson state."""
    lesson = _load_lesson(lesson_id)
    if not lesson:
        return jsonify({"error": "Lesson not found"}), 404

    sections_meta = [{
        "index": s["index"],
        "title": s["title"],
        "preview": s["preview"],
        "wordCount": s["wordCount"],
    } for s in lesson.get("sections", [])]

    return jsonify({
        "success": True,
        "lessonId": lesson["id"],
        "title": lesson.get("title", "Lesson"),
        "sections": sections_meta,
        "totalSections": lesson.get("totalSections", 0),
        "currentSection": lesson.get("currentSection", 0),
        "status": lesson.get("status", "active"),
    })


@app.route("/voice-tutor/chats", methods=["GET"])
def list_voice_chats():
    """List only voice tutor chats."""
    all_chats = []
    for f in sorted(CHATS_DIR.glob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            if data.get("type") == "voice":
                all_chats.append({
                    "id": data["id"],
                    "title": data.get("title", "New Lesson"),
                    "createdAt": data.get("createdAt"),
                    "messageCount": len(data.get("messages", [])),
                })
        except Exception:
            pass
    return jsonify({"success": True, "chats": all_chats})


# ---------------------------------------------------------------------------
# PDF Quiz Generation
# ---------------------------------------------------------------------------
@app.route("/generate-quiz", methods=["POST"])
def generate_quiz():
    """Generate a 10-question JSON quiz from a PDF's text."""
    data = request.get_json(silent=True) or {}
    pdf_id = data.get("pdfId")
    model = data.get("model", OLLAMA_MODEL)

    if not pdf_id:
        return jsonify({"error": "No pdfId provided"}), 400

    txt_file = PDFS_DIR / f"{pdf_id}.txt"
    if not txt_file.exists():
        return jsonify({"error": "PDF text not found"}), 404

    text = txt_file.read_text(encoding="utf-8")
    
    # Take up to first 20k chars to avoid massive context limits, 
    # though 120b can handle more, keeping it fast for quiz gen.
    context_text = "".join(itertools.islice(text, 30000)) 

    system_prompt = """You are an expert educational AI. 
You must generate a 10-question multiple-choice quiz based EXCLUSIVELY on the provided document text.

CRITICAL INSTRUCTION:
Your entire response MUST be valid, parseable JSON. Do not include any markdown formatting, no ```json blocks, no conversational text. Return ONLY the raw JSON object.

The JSON format MUST exactly match this schema:
{
  "title": "Quiz Title Based on Document",
  "questions": [
    {
      "question": "The question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Brief explanation of why this is correct."
    }
  ]
}
Note: correctAnswer is the 0-based integer index of the correct string in the options array. Ensure exactly 4 options per question and exactly 10 questions.
"""

    user_prompt = f"DOCUMENT TEXT:\n{context_text}\n\nGenerate the JSON quiz now."

    try:
        resp = requests.post(
            f"{OLLAMA_BASE_URL}/api/chat",
            json={
                "model": model, 
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ], 
                "stream": False,
                "format": "json" # Force Ollama to output JSON
            },
            timeout=180,
        )
        
        if resp.status_code != 200:
            return jsonify({"error": f"Ollama returned {resp.status_code}"}), 500

        ai_content = resp.json().get("message", {}).get("content", "")
        
        # In case the model wrapped it in markdown anyway, strip it
        if ai_content.startswith("```json"):
            ai_content = ai_content[7:]
        if ai_content.endswith("```"):
            ai_content = ai_content[:-3]
            
        quiz_data = json.loads(ai_content.strip())
        
        # Basic validation
        if "questions" not in quiz_data or len(quiz_data["questions"]) == 0:
            raise ValueError("Invalid quiz format returned by model")
            
        return jsonify({
            "success": True,
            "quiz": quiz_data
        })

    except json.JSONDecodeError:
        print("[AI Tutor] Failed to parse quiz JSON from Ollama.")
        return jsonify({"error": "Model failed to return valid JSON."}), 500
    except Exception as e:
        print(f"[AI Tutor] Quiz generation error: {e}")
        return jsonify({"error": str(e)}), 500


# ============================================================================
# Main
# ============================================================================
if __name__ == "__main__":
    print(f"""
================================================
       AI TUTOR SERVER
   ChatGPT-style Streaming Chat + PDF RAG
   + Voice Tutor (Teacher Mode)
================================================

Model:     {OLLAMA_MODEL}
Ollama:    {OLLAMA_BASE_URL}
ChromaDB:  {'enabled' if CHROMA_SUPPORT else 'disabled'}
PDF:       {'enabled' if PDF_SUPPORT else 'disabled'}
Data:      {DATA_DIR}

Endpoints:
  GET  /health              Health check
  POST /chat/stream         Streaming chat (SSE)
  POST /chat                Sync chat fallback
  GET  /chats               List chat history
  POST /chats               Create new chat
  GET  /chats/<id>          Get chat + messages
  PUT  /chats/<id>          Rename chat
  DELETE /chats/<id>        Delete chat
  POST /upload-pdf          Upload & process PDF
  GET  /pdfs                List PDFs
  DELETE /pdfs/<id>         Remove PDF
  POST /pdfs/<id>/toggle    Toggle PDF active
  POST /generate-quiz       Generate JSON quiz from PDF
  POST /voice-tutor/stream  Voice tutor streaming (SSE)
  GET  /voice-tutor/chats   List voice tutor lessons

Starting on http://127.0.0.1:{PORT}
""")
    app.run(host="0.0.0.0", port=PORT, debug=False, threaded=True)

