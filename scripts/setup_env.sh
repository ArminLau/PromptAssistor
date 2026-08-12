#!/bin/bash
# ============================================
# PromptAssistor - macOS Environment Setup
# ============================================

set -e

echo ""
echo "=== PromptAssistor Environment Setup (macOS) ==="
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python 3 is not installed."
    echo "Please install Python 3.11+ from https://www.python.org/ or via brew:"
    echo "  brew install python@3.11"
    exit 1
fi
echo "[OK] Python found: $(python3 --version)"

# Create virtual environment
echo ""
echo "[1/3] Creating Python virtual environment..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$PROJECT_ROOT/.venv"

if [ ! -d "$VENV_DIR" ]; then
    python3 -m venv "$VENV_DIR"
    echo "[OK] Virtual environment created at $VENV_DIR"
else
    echo "[OK] Virtual environment already exists"
fi

# Activate and install dependencies
echo ""
echo "[2/3] Installing Python dependencies..."
source "$VENV_DIR/bin/activate"
pip install --upgrade pip -q
pip install -r "$PROJECT_ROOT/backend/requirements.txt"
echo "[OK] Python dependencies installed"

# Check Node.js for frontend
echo ""
echo "[3/3] Checking frontend prerequisites..."
if ! command -v node &> /dev/null; then
    echo "[WARNING] Node.js is not installed. Frontend development requires Node.js 20+."
    echo "Install via: brew install node"
else
    echo "[OK] Node.js found: $(node --version)"
fi

if ! command -v pnpm &> /dev/null; then
    echo "[INFO] Installing pnpm globally..."
    npm install -g pnpm
fi
echo "[OK] pnpm found"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "To start the backend:  bash scripts/dev_backend.sh"
echo "To start the frontend: bash scripts/dev_frontend.sh"
echo ""
