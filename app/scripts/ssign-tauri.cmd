@echo off
REM Tauri calls signCommand once per PE file. Each ssign invocation logs into
REM Certum SimplySign with a fresh OAuth + TOTP. Certum rejects reusing the
REM same 6-digit code within a 30s window, so the 2nd/3rd file often fails
REM immediately after the sidecar succeeds. Retry after the next TOTP tick.
setlocal EnableExtensions
set "FILE=%~1"
if "%FILE%"=="" (
  echo ssign-tauri: missing file path 1>&2
  exit /b 1
)

set ATTEMPT=0
:retry
set /a ATTEMPT+=1
ssign "%FILE%"
if %ERRORLEVEL% equ 0 exit /b 0
if %ATTEMPT% geq 4 (
  echo ssign-tauri: giving up after %ATTEMPT% attempts 1>&2
  exit /b 1
)
echo ssign-tauri: attempt %ATTEMPT% failed; waiting for next TOTP window... 1>&2
REM 32s covers the rest of the current 30s window plus slack.
timeout /t 32 /nobreak >nul
goto retry
