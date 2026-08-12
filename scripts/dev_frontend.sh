#!/bin/bash
# ============================================
# PromptAssistor - Start Frontend Dev Server (macOS)
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

cd "$FRONTEND_DIR"

if [ ! -d "node_modules" ]; then
    echo "[INFO] Installing frontend dependencies first..."
    pnpm install
fi

echo ""
echo "=== Starting PromptAssistor Frontend ==="
echo "Dev server: http://localhost:5173"
echo ""

pnpm dev
