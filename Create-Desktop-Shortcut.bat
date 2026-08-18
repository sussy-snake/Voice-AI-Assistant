@echo off
title Creating Desktop Shortcut...
cd /d "%~dp0"

echo Creating "Voice AI Assistant" shortcut on your Desktop...

powershell -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut([System.Environment]::GetFolderPath('Desktop') + '\Voice AI Assistant.lnk'); $Shortcut.TargetPath = '%~dp0VoiceAI-App.vbs'; $Shortcut.WorkingDirectory = '%~dp0'; $Shortcut.WindowStyle = 1; $Shortcut.Description = 'Voice AI Assistant Desktop App'; $Shortcut.Save()"

echo.
echo ====================================================================
echo  Success! "Voice AI Assistant" shortcut is now on your Desktop!
echo ====================================================================
timeout /t 3
exit
