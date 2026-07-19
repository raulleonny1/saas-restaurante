@echo off
chcp 65001 >nul
title SmartServe - Asistente de impresoras
cd /d "%~dp0"

echo.
echo ==============================================
echo   SmartServe - Asistente de impresoras
echo ==============================================
echo   Se va a abrir el asistente en este PC.
echo   NO CIERRES la ventana negra que aparece.
echo ==============================================
echo.

if not exist "%~dp0smartserve-print-bridge.ps1" (
  echo ERROR: falta el archivo smartserve-print-bridge.ps1
  echo En la app descarga LOS DOS archivos en la MISMA carpeta.
  echo.
  pause
  exit /b 1
)

echo Cerrando asistente antiguo en el puerto 17891 (si habia)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":17891" ^| findstr "LISTENING"') do (
  echo   Cerrando PID %%a
  taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul

echo Iniciando asistente nuevo...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0smartserve-print-bridge.ps1"
set ERR=%ERRORLEVEL%
echo.
if not "%ERR%"=="0" (
  echo El asistente se detuvo con error %ERR%.
) else (
  echo El asistente se cerro.
)
echo.
pause
