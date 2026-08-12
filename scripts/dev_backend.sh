#!/bin/bash
# ============================================
# PromptAssistor - Start Backend Dev Server (macOS)
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$PROJECT_ROOT/.venv"

if [ ! -f "$VENV_DIR/bin/activate" ]; then
    echo "[ERROR] Virtual environment not found. Run setup_env.sh first."
    exit 1
fi

source "$VENV_DIR/bin/activate"

echo ""
echo "=== Starting PromptAssistor Backend ==="
echo "Server: http://localhost:18720"
echo "API Docs: http://localhost:18720/docs"
echo ""

cd "$PROJECT_ROOT/backend"
uvicorn app.main:app --host 127.0.0.1 --port 18720 --reload
