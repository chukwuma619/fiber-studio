@echo off
REM Thin launcher so Tauri can invoke the PowerShell wrapper via PATH.
REM Real logic (TOTP slot wait + retries) lives in ssign-tauri.ps1.
setlocal EnableExtensions
pwsh -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%~dp0ssign-tauri.ps1" %*
exit /b %ERRORLEVEL%
