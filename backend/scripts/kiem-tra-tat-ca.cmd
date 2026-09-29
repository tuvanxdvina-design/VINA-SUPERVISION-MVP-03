@echo off
REM Chay TOAN BO kiem chung bang MOT lenh, tuan tu (khong song song de tranh tranh tai nguyen):
REM   cu phap giao dien -> kiem thu may chu (regression) -> kiem thu giao dien
REM Ket qua tom tat o backend\tests\last-summary.txt (doc mot lan la biet du)
REM Cach dung: backend\scripts\kiem-tra-tat-ca.cmd
setlocal
set ROOT=%~dp0..\..
set SUM=%ROOT%\backend\tests\last-summary.txt
echo BAT DAU %DATE% %TIME%> "%SUM%"

cd /d "%ROOT%"
node backend\scripts\check-frontend.js >> "%SUM%" 2>&1

REM Script con tu doi thu muc lam viec nen phai quay ve ROOT sau moi lan goi
call "%~dp0run-regression.cmd" >nul 2>&1
cd /d "%ROOT%"
call "%~dp0run-ui-tests.cmd" >nul 2>&1
cd /d "%ROOT%"

node backend\scripts\tom-tat.js backend\tests\last-regression.txt backend\tests\last-ui-test.txt >> "%SUM%" 2>&1
echo XONG %DATE% %TIME%>> "%SUM%"
endlocal
