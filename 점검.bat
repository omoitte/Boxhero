@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "LOG=%~dp0점검_로그.txt"

set "GB=C:\Program Files\Git\bin\bash.exe"
if not exist "%GB%" set "GB=C:\Program Files (x86)\Git\bin\bash.exe"
if not exist "%GB%" set "GB=%LOCALAPPDATA%\Programs\Git\bin\bash.exe"

if not exist "%GB%" (
  echo [실패] Git Bash 를 찾지 못했습니다. > "%LOG%"
  type "%LOG%"
  pause
  exit /b 1
)

echo 발주 이력 정합성 점검 > "%LOG%"
echo 실행시각 %DATE% %TIME% >> "%LOG%"
echo. >> "%LOG%"

"%GB%" check.sh >> "%LOG%" 2>&1

type "%LOG%"
echo.
echo   결과는 이상치점검.tsv 에 저장했습니다.
echo.
pause
