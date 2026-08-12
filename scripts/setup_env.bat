@echo off
REM ============================================
REM PromptAssistor - Windows Environment Setup
REM ============================================

echo.
echo === PromptAssistor Environment Setup (Windows) ===
echo.

REM Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH.
    echo Please install Python 3.11+ from https://www.python.org/
    pause
    exit /b 1
)
echo [OK] Python found:
python --version

REM Create virtual environment
echo.
echo [1/3] Creating Python virtual environment...
if not exist "..\.venv" (
    python -m venv ..\.venv
    echo [OK] Virtual environment created at ..\.venv
) else (
    echo [OK] Virtual environment already exists
)

REM Activate and install dependencies
echo.
echo [2/3] Installing Python dependencies...
call ..\.venv\Scripts\activate.bat
pip install --upgrade pip -q
pip install -r ..\backend\requirements.txt
echo [OK] Python dependencies installed

REM Check Node.js for frontend
echo.
echo [3/3] Checking frontend prerequisites...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Node.js is not installed. Frontend development requires Node.js 20+.
    echo Download from https://nodejs.org/
) else (
    echo [OK] Node.js found:
    node --version
)

where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Installing pnpm globally...
    npm install -g pnpm
)
echo [OK] pnpm found

echo.
echo === Setup Complete ===
echo.
echo To start the backend:  scripts\dev_backend.bat
echo To start the frontend: scripts\dev_frontend.bat
echo.
pause
