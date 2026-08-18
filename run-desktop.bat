@echo off
title Voice AI Assistant - Native Desktop Launcher
cd /d "%~dp0"

echo ==========================================================
echo        Voice AI Assistant: Native Desktop Launcher
echo ==========================================================
echo.
echo Starting Desktop App (Tauri v2 + Low RAM G-Helper Shell)...
npm run tauri:dev

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Rust/Tauri development environment is building...
    echo Fallback: Launching high-speed Web client...
    call "%~dp0start-app.bat"
)

pause
