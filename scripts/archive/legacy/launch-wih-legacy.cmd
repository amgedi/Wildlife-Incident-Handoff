@echo off
title Wildlife Incident Handoff Launcher
setlocal
cd /d "%~dp0"

echo.
echo   ================================================
echo    Wildlife Incident Handoff
echo   ================================================
echo.
echo    1. Desktop app  (installed or portable EXE - recommended)
echo    2. Web app      (runs a local dev server, opens your browser)
echo    3. Exit
echo.
choice /c 123 /n /m "   Choose 1, 2 or 3: "
if errorlevel 3 exit /b 0
if errorlevel 2 goto web
goto desktop

:desktop
rem Prefer the newest portable EXE in release\desktop
set "EXE="
for /f "delims=" %%f in ('dir /b /o-n "release\desktop\Wildlife-Incident-Handoff-Portable-*.exe" 2^>nul') do (
  if not defined EXE set "EXE=release\desktop\%%f"
)
if defined EXE (
  echo.
  echo   Starting: %EXE%
  start "" "%EXE%"
  exit /b 0
)
rem Fall back to an installed copy in its default location
if exist "%LOCALAPPDATA%\Wildlife Incident Handoff\Wildlife Incident Handoff.exe" (
  echo.
  echo   Starting installed app...
  start "" "%LOCALAPPDATA%\Wildlife Incident Handoff\Wildlife Incident Handoff.exe"
  exit /b 0
)
echo.
echo   No desktop EXE found.
echo   Build one with:  npx tauri build
echo   (output lands in release\desktop\)
echo.
pause
exit /b 1

:web
echo.
echo   Starting web app on http://localhost:5173 ...
echo   (keep this window open; close it to stop the server)
echo.
start "" /b cmd /c "timeout /t 4 >nul & start http://localhost:5173"
npx vite
exit /b 0
