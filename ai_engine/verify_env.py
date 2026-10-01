import os
import sys

print("--- Environment Verification ---")
print(f"Python: {sys.executable}")

# Check python-dotenv
try:
    from dotenv import load_dotenv  # type: ignore[import]
    print("✅ python-dotenv is installed")
    load_success = load_dotenv()
    print(f"   load_dotenv() returned: {load_success}")
except ImportError:
    print("❌ python-dotenv is NOT installed")

# Check Gemini Key
key = os.environ.get("GEMINI_API_KEY")
if key:
    masked = key[:4] + "..." + key[-4:] if len(key) > 8 else "***"  # type: ignore[misc]
    print(f"✅ GEMINI_API_KEY found: {masked}")
else:
    print("❌ GEMINI_API_KEY not found in environment")

# Check google-generativeai
try:
    import google.generativeai as genai  # type: ignore[import]
    print("✅ google-generativeai is installed")
except ImportError:
    print("❌ google-generativeai is NOT installed")

# Check PyPDF2
try:
    import PyPDF2  # type: ignore[import]
    print("✅ PyPDF2 is installed")
except ImportError:
    print("❌ PyPDF2 is NOT installed")

# List available models
print("\n--- Available Gemini Models ---")
try:
    if key:
        import google.generativeai as genai  # type: ignore[import]
        genai.configure(api_key=key)
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                print(f"- {m.name}")
    else:
        print("Skipping model list (no key)")
except Exception as e:
    print(f"Error listing models: {e}")

print("--- End ---")
