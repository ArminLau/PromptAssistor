@echo off
REM ============================================
REM PromptAssistor - One-Click Launcher
REM ============================================

cd /d "%~dp0"

echo.
echo ==========================================
echo   PromptAssistor v0.1.0
echo   AI Prompt Generation Assistant
echo ==========================================
echo.

REM Check for Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found! Please install Python 3.11+
    echo Download: https://www.python.org/
    pause
    exit /b 1
)

REM Check for venv
if not exist "%~dp0.venv\Scripts\python.exe" (
    echo [INFO] Creating virtual environment...
    python -m venv "%~dp0.venv"
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create virtual environment
        pause
        exit /b 1
    )
    echo.
)

REM Activate venv
call "%~dp0.venv\Scripts\activate.bat"
if %errorlevel% neq 0 (
    echo [ERROR] Failed to activate virtual environment
    pause
    exit /b 1
)

REM Check for dependencies
python -c "import fastapi" >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Installing dependencies...
    echo This may take a few minutes...
    pip install -r "%~dp0backend\requirements.txt" -q
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies
        echo Please run manually: pip install -r backend\requirements.txt
        pause
        exit /b 1
    )
    echo.
)

echo [INFO] Starting PromptAssistor...
echo.
echo   Frontend:  http://127.0.0.1:18720
echo   API Docs:  http://127.0.0.1:18720/docs
echo.
echo   Press Ctrl+C to stop
echo ==========================================
echo.

REM Start the launcher
python "%~dp0launcher.py" %*
pause
