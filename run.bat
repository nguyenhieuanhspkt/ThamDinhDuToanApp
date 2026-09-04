@echo off
title ThamDinhDuToanApp - NMND Vinh Tan 4

echo ===============================================================================
echo Dang khoi dong ThamDinhDuToanApp (Flask API + React Frontend)
echo Frontend: http://localhost:5173
echo Backend API: http://localhost:5555
echo ===============================================================================

REM 1. Khoi chay Flask Backend API o cua so rieng
echo [1/2] Dang bat Flask Backend Port 5555...
start "ThamDinhDuToanApp - Flask Backend" /D "%~dp0" cmd /k python app.py

REM 2. Cho 2 giay de Backend on dinh
timeout /t 2 /nobreak > nul

REM 3. Mo trinh duyet vao giao dien React
start "" http://localhost:5173

REM 4. Khoi chay Vite Dev Server cho React Frontend
echo [2/2] Dang bat React Frontend Port 5173...
cd /d "%~dp0frontend"
npm run dev
