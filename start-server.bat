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
echo Server will run on http://localhost:3000
echo.
echo Press Ctrl+C to stop the server
echo.

node server.js
