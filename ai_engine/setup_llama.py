"""
Llama Model Setup Script for NeuroNest
Run this script to install llama-cpp-python and download a Llama model.

Usage:
    python setup_llama.py
"""

import os
import sys
import subprocess

def run_command(cmd, description):
    """Run a command and print status."""
    print(f"\n{'='*60}")
    print(f"📦 {description}")
    print(f"{'='*60}")
    print(f"Running: {cmd}\n")
    
    result = subprocess.run(cmd, shell=True)
    if result.returncode != 0:
        print(f"❌ Failed: {description}")
        return False
    print(f"✅ Success: {description}")
    return True


def main():
    print("""
╔══════════════════════════════════════════════════════════════╗
║              🦙 Llama Setup for NeuroNest                    ║
╚══════════════════════════════════════════════════════════════╝
    """)
    
    # Step 1: Install llama-cpp-python
    print("\n📌 Step 1: Installing llama-cpp-python...")
    if not run_command(
        f"{sys.executable} -m pip install llama-cpp-python",
        "Installing llama-cpp-python"
    ):
        print("\n⚠️  If installation fails, you may need Visual Studio Build Tools.")
        print("   Download from: https://visualstudio.microsoft.com/visual-cpp-build-tools/")
        return
    
    # Step 2: Install huggingface_hub for model download
    print("\n📌 Step 2: Installing huggingface_hub...")
    run_command(
        f"{sys.executable} -m pip install huggingface_hub",
        "Installing huggingface_hub"
    )
    
    # Step 3: Create models directory
    models_dir = os.path.join(os.path.dirname(__file__), "models")
    os.makedirs(models_dir, exist_ok=True)
    print(f"\n📁 Models directory: {models_dir}")
    
    # Step 4: Download model
    print("\n📌 Step 3: Downloading Llama model...")
    print("This may take a few minutes depending on your internet connection.")
    
    model_filename = "llama-3.2-3b-instruct.Q4_K_M.gguf"
    model_path = os.path.join(models_dir, model_filename)
    
    if os.path.exists(model_path):
        print(f"✅ Model already exists at: {model_path}")
    else:
        try:
            from huggingface_hub import hf_hub_download  # type: ignore[import]
            
            print("Downloading from Hugging Face...")
            downloaded_path = hf_hub_download(
                repo_id="bartowski/Llama-3.2-3B-Instruct-GGUF",
                filename="Llama-3.2-3B-Instruct-Q4_K_M.gguf",
                local_dir=models_dir,
                local_dir_use_symlinks=False,
            )
            
            # Rename to our expected filename
            if os.path.basename(downloaded_path) != model_filename:
                os.rename(downloaded_path, model_path)
            
            print(f"✅ Model downloaded to: {model_path}")
        except Exception as e:
            print(f"❌ Download failed: {e}")
            print("\n📥 Manual download instructions:")
            print("   1. Go to: https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF")
            print("   2. Download: Llama-3.2-3B-Instruct-Q4_K_M.gguf")
            print(f"   3. Save to: {model_path}")
            return
    
    # Step 5: Update .env
    print("\n📌 Step 4: Checking configuration...")
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            content = f.read()
        if "LLAMA_MODEL_PATH" in content:
            print("✅ .env already configured with LLAMA_MODEL_PATH")
        else:
            print("⚠️  Please add to .env: LLAMA_MODEL_PATH=models/llama-3.2-3b-instruct.Q4_K_M.gguf")
    
    print("""
╔══════════════════════════════════════════════════════════════╗
║                    🎉 Setup Complete!                        ║
╠══════════════════════════════════════════════════════════════╣
║  Restart the AI server to use local Llama:                   ║
║  python api/ai_server.py                                     ║
║                                                              ║
║  Test: GET http://localhost:8000/llama/status                ║
╚══════════════════════════════════════════════════════════════╝
    """)


if __name__ == "__main__":
    main()
