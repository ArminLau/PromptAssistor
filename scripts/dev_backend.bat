@echo off
REM ============================================
REM PromptAssistor - Start Backend Dev Server
REM ============================================

cd /d "%~dp0\..\backend"

if not exist "..\.venv\Scripts\activate.bat" (
    echo [ERROR] Virtual environment not found. Run setup_env.bat first.
    pause
    exit /b 1
)

call ..\.venv\Scripts\activate.bat

echo.
echo === Starting PromptAssistor Backend ===
echo Server: http://localhost:18720
echo API Docs: http://localhost:18720/docs
echo.

uvicorn app.main:app --host 127.0.0.1 --port 18720 --reload
