@echo off
rem 0.3.0-dev.5 compatibility shim (spec 88): the native launcher is the real
rem entry point. This shim only opens it; the legacy menu lives in
rem scripts\legacy\launch-wih-legacy.cmd.
setlocal
cd /d "%~dp0"
if exist "Wildlife Incident Handoff Launcher.exe" (
  start "" "%~dp0Wildlife Incident Handoff Launcher.exe"
  exit /b 0
)
if exist "release\current\Wildlife Incident Handoff Launcher.exe" (
  start "" "%~dp0release\current\Wildlife Incident Handoff Launcher.exe"
  exit /b 0
)
echo Wildlife Incident Handoff Launcher.exe not found.
echo Build it with: cargo build --release --manifest-path launcher\src-tauri\Cargo.toml
echo Legacy launcher menu: scripts\legacy\launch-wih-legacy.cmd
pause
