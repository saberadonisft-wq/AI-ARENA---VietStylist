@echo off
setlocal
pushd "%~dp0.."
if errorlevel 1 exit /b 1
chcp 65001 > nul
echo ===================================================
echo     VIỆT PHỤC REMIX (VIETSTYLIST) - KHỞI ĐỘNG HỆ THỐNG
echo ===================================================
echo.

echo [1/2] Đang khởi động Backend FastAPI (Port 4000)...
start "VietStylist Backend" cmd /k "python -m uvicorn app.main:app --host 127.0.0.1 --port 4000 --app-dir backend"

timeout /t 3 /nobreak > nul

echo [2/2] Đang khởi động Frontend Next.js (Port 3000)...
start "VietStylist Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ===================================================
echo   ĐÃ KHỞI ĐỘNG THÀNH CÔNG CẢ 2 DỊCH VỤ!
echo.
echo   - Giao diện Web:    http://localhost:3000
echo   - Backend API Docs: http://localhost:4000/docs
echo.
echo   (Đóng các cửa sổ console tương ứng để dừng dịch vụ)
echo ===================================================
echo.
popd
endlocal
pause
