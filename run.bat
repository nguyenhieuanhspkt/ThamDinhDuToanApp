@echo off
chcp 65001 > nul
title ThamDinhDuToanApp - NMNĐ Vĩnh Tân 4

echo ===============================================================================
echo 🚀 Đang khởi động ThamDinhDuToanApp (Flask API + React Frontend)
echo 👉 Frontend: http://localhost:5173
echo 👉 Backend API: http://localhost:5555
echo ===============================================================================

:: 1. Khởi chạy Flask Backend ở cửa sổ riêng
echo [*] Đang bật Flask Backend (:5555)...
start "ThamDinhDuToanApp - Flask Backend" cmd /c "cd /d %~dp0 && python app.py"

:: 2. Đợi 2 giây và tự động mở trình duyệt vào giao diện React
start "" http://localhost:5173

:: 3. Khởi chạy Vite Dev Server cho React Frontend ở cửa sổ này
echo [*] Đang bật React Frontend (:5173)...
cd /d "%~dp0frontend"
npm run dev
