@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 20 or newer, then reopen this window.
  echo https://nodejs.org/
  pause
  exit /b 1
)
node src\server.js
if errorlevel 1 (
  echo.
  echo RepoPilot closed with an error.
  pause
)
endlocal
