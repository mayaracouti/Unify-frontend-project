@echo off
setlocal

cd /d "%~dp0.."

set "PROFILE=%~1"

if "%PROFILE%"=="" (
  set "PROFILE=dev"
)

node scripts\start-expo-profile.js "%PROFILE%" --android-local %2 %3 %4 %5 %6 %7 %8 %9

endlocal