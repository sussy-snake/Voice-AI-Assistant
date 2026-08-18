@echo off
title Voice AI Assistant Desktop Shell
cd /d "%~dp0"

echo ==========================================================
echo    Starting Voice AI Assistant (Native Desktop App)...
echo ==========================================================
echo.

:: Start the background server silently
start /b cmd /c "npm run dev > nul 2>&1"

:: Wait 2 seconds for local server to be ready
timeout /t 2 /nobreak > nul

:: Launch in Dedicated Desktop Window Mode (No Browser UI / G-Helper Style)
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app="http://localhost:1420" --window-size=520,780 --user-data-dir="%TEMP%\VoiceAI_Desktop_Profile"
) else if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app="http://localhost:1420" --window-size=520,780 --user-data-dir="%TEMP%\VoiceAI_Desktop_Profile"
) else (
    start http://localhost:1420
)

exit
