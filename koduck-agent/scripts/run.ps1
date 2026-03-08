# Koduck startup script (Windows PowerShell)

# Check virtual environment
if (-not $env:VIRTUAL_ENV) {
    if (Test-Path ".venv\Scripts\Activate.ps1") {
        Write-Host "Activating virtual environment..." -ForegroundColor Yellow
        . .venv\Scripts\Activate.ps1
    } else {
        Write-Host "Error: Virtual environment not found" -ForegroundColor Red
        Write-Host "Please run: uv venv --python 3.11"
        Write-Host "Then: .venv\Scripts\Activate.ps1 && pip install -e ."
        exit 1
    }
}

# Check dependencies
try {
    python -c "import yaml, anthropic" 2>$null
} catch {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    python -m pip install -e . -q
}

# Check .env file
if (-not (Test-Path ".env")) {
    Write-Host "Warning: .env file not found" -ForegroundColor Yellow
    Write-Host "Please copy .env.template to .env and configure API key"
    Write-Host ""
    $continue = Read-Host "Continue? (y/n)"
    if ($continue -ne 'y') {
        exit 1
    }
}

# Run koduck with command line args
python -m koduck $args
