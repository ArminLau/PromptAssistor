@echo off
REM ============================================
REM PromptAssistor - Start Frontend Dev Server
REM ============================================

cd /d "%~dp0\..\frontend"

if not exist "node_modules" (
    echo [INFO] Installing frontend dependencies first...
    pnpm install
)

echo.
echo === Starting PromptAssistor Frontend ===
echo Dev server: http://localhost:5173
echo.

pnpm dev
