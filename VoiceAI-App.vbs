Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)

' Start the background server without showing any terminal window
WshShell.Run "cmd /c npm run dev", 0, False

' Wait 2 seconds for server initialization
WScript.Sleep 2000

' Launch standalone desktop application window (No tabs, no address bar, fixed 520x780 size)
Dim edgePath
edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

If CreateObject("Scripting.FileSystemObject").FileExists(edgePath) Then
    WshShell.Run """" & edgePath & """ --app=http://localhost:1420 --window-size=520,780 --user-data-dir=%TEMP%\VoiceAI_Profile", 1, False
Else
    WshShell.Run "cmd /c start http://localhost:1420", 0, False
End If
