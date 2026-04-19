$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\ThreatMapX-Wallpaper.lnk")
$Shortcut.TargetPath = "C:\Users\Lakshya\Documents\Sem 6\Mini Project\ThreatMapX\wallpaper-startup.bat"
$Shortcut.WorkingDirectory = "C:\Users\Lakshya\Documents\Sem 6\Mini Project\ThreatMapX"
$Shortcut.WindowStyle = 7
$Shortcut.Description = "ThreatMapX Live Wallpaper"
$Shortcut.Save()
Write-Host "Startup shortcut created!"
