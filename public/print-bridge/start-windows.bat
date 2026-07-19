@echo off
title SmartServe Print Bridge
cd /d "%~dp0"
echo.
echo Iniciando asistente de impresoras SmartServe...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0smartserve-print-bridge.ps1"
if errorlevel 1 (
  echo.
  pause
)
