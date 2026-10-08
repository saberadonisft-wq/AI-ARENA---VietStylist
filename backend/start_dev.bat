@echo off
setlocal
pushd "%~dp0.."
if errorlevel 1 exit /b 1
chcp 65001 > nul
echo ===================================================
echo   Khởi động Việt Phục Remix (VietStylist)
echo ===================================================
echo [1/2] Đang khởi động Backend FastAPI (Port 4000)...
start "VietStylist - Backend (Port 4000)" cmd /k "python -m uvicorn app.main:app --host 127.0.0.1 --port 4000 --app-dir backend --reload"

echo [2/2] Đang khởi động Frontend Next.js (Port 3000)...
start "VietStylist - Frontend (Port 3000)" cmd /k "cd frontend && npm run dev"

echo.
echo Đã khởi động xong cả 2 máy chủ!
echo - Frontend: http://localhost:3000
echo - Backend:  http://127.0.0.1:4000/docs
echo ===================================================
popd
endlocal
