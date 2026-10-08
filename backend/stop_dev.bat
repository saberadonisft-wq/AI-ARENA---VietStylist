@echo off
chcp 65001 > nul
echo Đang tắt các tiến trình trên cổng 3000 và 4000...

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000.*LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
    echo Đã dừng cổng 3000 (PID: %%a)
)

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":4000.*LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
    echo Đã dừng cổng 4000 (PID: %%a)
)

echo Hoàn tất dừng máy chủ VietStylist!

