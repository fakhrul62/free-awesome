@echo off
setlocal
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo Python was not found. Install Python or run this folder with another local web server.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$port=5177; $conn=Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue; if (-not $conn) { Start-Process -FilePath python -ArgumentList '-m','http.server',$port,'--bind','127.0.0.1' -WorkingDirectory '%CD%' -WindowStyle Hidden; Start-Sleep -Seconds 1 }; Start-Process ('http://127.0.0.1:' + $port + '/index.html')"

endlocal
