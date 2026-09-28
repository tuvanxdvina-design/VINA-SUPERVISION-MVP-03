@echo off
REM Chay kiem thu hoi quy tren CSDL thu rieng, ghi ket qua ra backend\tests\last-regression.txt
REM Cach dung: backend\scripts\run-regression.cmd [ten_csdl_thu] [keep]
REM   keep = giu lai CSDL thu sau khi chay (de kiem tra giao dien tren cong 3102)
setlocal
set DB=%1
if "%DB%"=="" set DB=vina_regr_claude
set TEST_DB_URL=postgres://postgres:postgres@127.0.0.1:5432/%DB%
cd /d %~dp0..
set OUT=%~dp0..\tests\last-regression.txt
echo RUNNING %DATE% %TIME% db=%DB%> "%OUT%"
node --test tests/regression.test.js >> "%OUT%" 2>&1
echo EXIT %ERRORLEVEL%>> "%OUT%"
if /I not "%2"=="keep" docker exec vina-supervision-db psql -U postgres -d postgres -qc "drop database if exists %DB%" >nul 2>&1
echo DONE>> "%OUT%"
endlocal
