# Download Llama Model Script
$ErrorActionPreference = "Stop"

Write-Host "============================================"
Write-Host "  Llama Model Downloader for NeuroNest"
Write-Host "============================================"

# Create models directory
$modelsDir = Join-Path $PSScriptRoot "models"
if (!(Test-Path $modelsDir)) {
    New-Item -ItemType Directory -Force -Path $modelsDir | Out-Null
    Write-Host "Created models directory: $modelsDir"
}

$modelFile = Join-Path $modelsDir "llama-3.2-3b-instruct.Q4_K_M.gguf"

if (Test-Path $modelFile) {
    Write-Host "Model already exists at: $modelFile"
    exit 0
}

Write-Host ""
Write-Host "Downloading Llama 3.2 3B Instruct model..."
Write-Host "File size: ~2GB"
Write-Host "This may take 5-15 minutes depending on your internet speed."
Write-Host ""

$url = "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf"

try {
    # Disable progress bar for faster download
    $ProgressPreference = 'SilentlyContinue'
    
    Write-Host "Downloading from: $url"
    Write-Host "Saving to: $modelFile"
    Write-Host ""
    
    Invoke-WebRequest -Uri $url -OutFile $modelFile
    
    Write-Host ""
    Write-Host "============================================"
    Write-Host "  Download Complete!"
    Write-Host "============================================"
    Write-Host "Model saved to: $modelFile"
    
    $fileInfo = Get-Item $modelFile
    Write-Host "File size: $([math]::Round($fileInfo.Length / 1GB, 2)) GB"
    
} catch {
    Write-Host "Download failed: $_"
    Write-Host ""
    Write-Host "Please download manually from:"
    Write-Host "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF"
    exit 1
}
