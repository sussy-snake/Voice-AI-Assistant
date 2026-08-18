$WshShell = New-Object -ComObject WScript.Shell
$desktop = [System.Environment]::GetFolderPath('Desktop')
$Shortcut = $WshShell.CreateShortcut("$desktop\Voice AI Assistant.lnk")
$Shortcut.TargetPath = "c:\Local Voice Assisted LLM\VoiceAI-App.vbs"
$Shortcut.WorkingDirectory = "c:\Local Voice Assisted LLM"
$Shortcut.Description = "Voice AI Assistant Desktop Companion"
$Shortcut.Save()
Write-Host "Shortcut created successfully on Desktop!"
