@echo off
REM Thin launcher for local/manual use. Publish uses pwsh -File directly.
setlocal EnableExtensions
pwsh -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%~dp0ssign-tauri.ps1" %*
exit /b %ERRORLEVEL%
