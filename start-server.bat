@echo off
echo ==========================================
echo  Playwright Report Viewer - Web Server
echo ==========================================
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo 📦 Installing dependencies...
    echo.
    call npm install
    echo.
)

echo 🚀 Starting Web Server...
echo.
echo Port and reports path: see the config file (.env or the one passed with --env)
echo.
echo Press Ctrl+C to stop the server
echo.

node server.js %*
