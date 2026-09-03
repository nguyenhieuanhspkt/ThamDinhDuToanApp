@echo off
chcp 65001 > nul
title ThamDinhDuToanApp - NMNĐ Vĩnh Tân 4
echo ===============================================================================
echo 🚀 Đang khởi động ThamDinhDuToanApp (Flask Server)
echo 👉 Địa chỉ: http://localhost:5555
echo ===============================================================================
start "" http://localhost:5555
python app.py
pause
