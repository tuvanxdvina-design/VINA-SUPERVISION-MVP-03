@echo off
REM Chay kiem thu giao dien tren CSDL thu rieng, ghi ket qua ra backend\tests\last-ui-test.txt
REM Cach dung: backend\scripts\run-ui-tests.cmd [ten_csdl_thu] [mau_ten_ca]
REM   Vi du: backend\scripts\run-ui-tests.cmd vina_ui_claude GD-06
setlocal
set DB=%1
if "%DB%"=="" set DB=vina_ui_claude
set UI_TEST_DB_URL=postgres://postgres:postgres@127.0.0.1:5432/%DB%
cd /d %~dp0..
set OUT=%~dp0..\tests\last-ui-test.txt
echo RUNNING %DATE% %TIME% db=%DB% pattern=%2> "%OUT%"
if "%2"=="" (
  node --test --test-reporter=spec tests/ui/all.test.js >> "%OUT%" 2>&1
) else (
  node --test --test-reporter=spec --test-name-pattern "%2" tests/ui/all.test.js >> "%OUT%" 2>&1
)
echo EXIT %ERRORLEVEL%>> "%OUT%"
docker exec vina-supervision-db psql -U postgres -d postgres -qc "drop database if exists %DB%" >nul 2>&1
echo DONE>> "%OUT%"
endlocal
