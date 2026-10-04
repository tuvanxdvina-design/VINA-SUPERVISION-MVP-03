@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-dev.ps1"
set "VINA_EXIT_CODE=%ERRORLEVEL%"
if not "%VINA_EXIT_CODE%"=="0" pause
exit /b %VINA_EXIT_CODE%
