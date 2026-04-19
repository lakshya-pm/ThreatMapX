@echo off
:: ThreatMapX Live Wallpaper — Startup Script
:: Runs Next.js production server on port 4200
:: Waits for network/system to be ready before starting

title ThreatMapX Wallpaper Server

:: Wait 15 seconds for system to fully boot
timeout /t 15 /nobreak >nul

:: Set working directory to the project folder
cd /d "c:\Users\Lakshya\Documents\Sem 6\Mini Project\ThreatMapX"

:: Kill any existing instance on port 4200
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":4200" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)

:: Start the production server (build already exists)
"C:\Program Files\nodejs\node.exe" node_modules\.bin\next start -p 4200
