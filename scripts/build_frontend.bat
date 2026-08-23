@echo off
REM ============================================================
REM PromptAssistor - Build frontend and deploy to backend/static
REM ============================================================
REM Purpose:
REM   In source mode (start_app.bat), the backend serves the UI
REM   from backend/static/. This script builds the React frontend
REM   and copies the output there, so start_app.bat shows the
REM   latest UI immediately after any frontend change.
REM
REM   Run this AFTER any frontend code change (new feature / fix).
REM   Backend-only (Python) changes do NOT require this step.
REM ============================================================

setlocal

set "ROOT=%~dp0.."
set "FRONTEND=%ROOT%\frontend"
set "STATIC=%ROOT%\backend\static"

echo.
echo ==========================================
echo   PromptAssistor - Frontend Build
echo ==========================================
echo.

REM --- 1. Check Node.js ---
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js 18+.
    echo Download: https://nodejs.org/
    pause
    exit /b 1
)

REM --- 2. Ensure frontend deps are installed ---
if not exist "%FRONTEND%\node_modules" (
    echo [INFO] node_modules not found, installing dependencies...
    cd /d "%FRONTEND%"
    pnpm install >nul 2>&1
    if %errorlevel% neq 0 (
        npm install
        if %errorlevel% neq 0 (
            echo [ERROR] Failed to install frontend dependencies.
            pause
            exit /b 1
        )
    )
)

REM --- 3. Build frontend ---
cd /d "%FRONTEND%"
echo [INFO] Building frontend (npx vite build)...
npx vite build
if %errorlevel% neq 0 (
    echo [ERROR] Frontend build failed.
    pause
    exit /b 1
)

REM --- 4. Deploy to backend/static ---
echo [INFO] Deploying to backend/static ...
if exist "%STATIC%" rmdir /s /q "%STATIC%"
mkdir "%STATIC%"
xcopy /e /i /q /y "%FRONTEND%\dist\*" "%STATIC%\"
if %errorlevel% neq 0 (
    echo [ERROR] Failed to copy build output to backend/static.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo   Build complete.
echo   Now run start_app.bat to test.
echo ==========================================
echo.
pause
exit /b 0
