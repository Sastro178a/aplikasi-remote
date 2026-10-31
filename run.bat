@echo off
title S.A.S.T.R.O v2.0 Enterprise - Fleet, LAN, Tele & Live Mirroring
color 0B
cd /d "%~dp0"

echo ===========================================================================
echo   S.A.S.T.R.O v2.0 - SYSTEM AUTOMATED SIGNAL ^& TECH REMOTE OPERATOR
echo   Enterprise Fleet: Multi-Grup IT, Live Mirroring, Mouse/KB, LAN ^& WoL
echo ===========================================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js belum terinstall di PC ini!
    echo Silakan unduh dan install Node.js LTS di: https://nodejs.org
    pause
    exit /b
)

if not exist "node_modules" (
    echo [INFO] Mengunduh modul ringan pertama kali... Mohon tunggu 1-2 menit...
    call npm install --no-audit --no-fund
)

if not exist "memo.json" (
    echo [SETUP] Konfigurasi belum ditemukan. Memulai Wizard Setup v2.0...
    echo.
    node setup.js
)

:MENU
echo.
echo ===========================================================================
echo   PILIH MODE JALAN S.A.S.T.R.O v2.0:
echo   [1] Jalankan Sistem + Buka UI Command Center (http://localhost:4545)
echo   [2] Jalankan di Belakang Layar (Hidden Mode - Tanpa Jendela CMD)
echo   [3] Buka UI Dashboard Lokal / LAN di Browser (Tanpa Internet Tetap Jalan)
echo   [4] Wizard Setup (Ubah Nama PC / Kode Taut IT / Grup / AI / PIN / Tele)
echo   [5] Pasang Auto-Startup (Otomatis Nyala Bersama PC)
echo ===========================================================================
set /p pilihan="Ketik angka pilihan (1-5) [Default: 1]: "

if "%pilihan%"=="" set pilihan=1
if "%pilihan%"=="1" goto RUN_NORMAL
if "%pilihan%"=="2" goto RUN_HIDDEN
if "%pilihan%"=="3" (
    start http://localhost:4545
    goto MENU
)
if "%pilihan%"=="4" (
    node setup.js
    goto MENU
)
if "%pilihan%"=="5" goto INSTALL_STARTUP
goto RUN_NORMAL

:RUN_NORMAL
echo.
echo [AKTIF] Menjalankan Server Lokal/LAN (Port 4545) ^& Bot Telegram...
start http://localhost:4545
node bot.js
pause
exit /b

:RUN_HIDDEN
echo Set WshShell = CreateObject("WScript.Shell") > "%~dp0start_hidden.vbs"
echo WshShell.CurrentDirectory = "%~dp0" >> "%~dp0start_hidden.vbs"
echo WshShell.Run "cmd /c node bot.js", 0, False >> "%~dp0start_hidden.vbs"
wscript.exe "%~dp0start_hidden.vbs"
echo [SUKSES] Sistem berjalan di belakang layar! Buka http://localhost:4545 kapan saja.
timeout /t 4
exit /b

:INSTALL_STARTUP
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
echo Set WshShell = CreateObject("WScript.Shell") > "%STARTUP_DIR%\SASTRO_AutoStart.vbs"
echo WshShell.CurrentDirectory = "%~dp0" >> "%STARTUP_DIR%\SASTRO_AutoStart.vbs"
echo WshShell.Run "cmd /c node ""%~dp0bot.js""", 0, False >> "%STARTUP_DIR%\SASTRO_AutoStart.vbs"
echo [SUKSES] Auto-Startup berhasil dipasang!
goto MENU