/**
 * Jarvis Service - AI Twin Chat Interface
 * Connects to the local Ollama-powered AI tutor
 */

const DEFAULT_JARVIS_BASE_URL = "http://127.0.0.1:8000";

/**
 * Get the base URL for the AI server
 */
function getBaseUrl(options = {}) {
  return options.baseUrl || import.meta.env.VITE_JARVIS_API_URL || DEFAULT_JARVIS_BASE_URL;
}

/**
 * Check if the AI tutor (Ollama) is available
 */
export async function checkTutorStatus(options = {}) {
  const apiBase = getBaseUrl(options);

  try {
    const response = await fetch(`${apiBase}/tutor/status`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      return { available: false, error: "Server not responding" };
    }

    const data = await response.json();
    return {
      available: data.ollama?.online || data.gemini_available,
      ollama: data.ollama,
      gemini: data.gemini_available,
      source: data.ollama?.online ? "ollama" : (data.gemini_available ? "gemini" : "none"),
    };
  } catch (error) {
    return { available: false, error: error.message };
  }
}

/**
 * Ask the AI tutor a question
 * Uses Ollama (local) first, falls back to Gemini if unavailable
 */
export async function askJarvis(message, options = {}) {
  const trimmed = (message || "").trim();
  if (!trimmed) {
    throw new Error("Please provide a message for Jarvis.");
  }

  const apiBase = getBaseUrl(options);
  const { history = [], socratic = false, model } = options;

  // Try the new tutor endpoint first (Ollama-powered)
  try {
    const response = await fetch(`${apiBase}/tutor/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: trimmed,
        history,
        socratic,
        model,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.response) {
        return data.response;
      }
    }
  } catch (error) {
    console.log("[Jarvis] Tutor endpoint failed, trying legacy endpoint:", error.message);
  }

  // Fallback to legacy /api/chat endpoint
  try {
    const response = await fetch(`${apiBase}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ message: trimmed }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Jarvis request failed: ${text}`);
    }

    const data = await response.json();
    if (data?.reply) {
      return data.reply;
    }
  } catch (error) {
    console.log("[Jarvis] Legacy endpoint failed:", error.message);
  }

  // Both endpoints failed
  throw new Error("AI tutor unavailable. Please ensure Ollama is running or check your connection.");
}

/**
 * Get available AI models from Ollama
 */
export async function getAvailableModels(options = {}) {
  const apiBase = getBaseUrl(options);

  try {
    const response = await fetch(`${apiBase}/tutor/models`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      return { models: [], error: "Could not fetch models" };
    }

    return await response.json();
  } catch (error) {
    return { models: [], error: error.message };
  }
}

/**
 * Ask Jarvis with conversation context (maintains history)
 */
export async function askJarvisWithContext(message, conversationHistory = [], options = {}) {
  // Format history for the API
  const history = conversationHistory
    .filter(msg => msg.role === "user" || msg.role === "jarvis")
    .slice(-10) // Keep last 10 messages for context
    .map(msg => ({
      role: msg.role === "jarvis" ? "assistant" : "user",
      content: msg.text,
    }));

  return askJarvis(message, { ...options, history });
}
