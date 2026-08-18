@echo off
title Voice AI Assistant Launcher
cd /d "%~dp0"

echo ===================================================
echo        Starting Local Voice AI Assistant...
echo ===================================================
echo.

echo Opening app in your default browser...
start http://localhost:1420

echo Starting local web server...
npm run dev

pause
