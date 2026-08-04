#Requires -Version 5.1
<#
.SYNOPSIS
  Tauri signCommand wrapper for Certum SimplySign via ssign.

.DESCRIPTION
  Tauri invokes signCommand once per PE (sidecar, app exe, NSIS setup).
  Each `ssign` process logs into Certum with a fresh OAuth + TOTP.
  Certum rejects reusing the same 6-digit code in one 30s window
  (see ssign-core CloudSession docs / PKCS#11 session cache rationale).

  This wrapper:
  1. Waits for a TOTP slot that has not been used by a prior sign in this job
  2. Runs ssign and surfaces stdout+stderr (Tauri often hides failure stderr)
  3. Retries on failure after the next TOTP window
#>
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string] $Path
)

$ErrorActionPreference = 'Continue'

if (-not (Test-Path -LiteralPath $Path)) {
  Write-Host "ssign-tauri: file not found: $Path"
  exit 1
}

$stateDir = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } elseif ($env:TEMP) { $env:TEMP } else { '.' }
$stateFile = Join-Path $stateDir 'ssign-tauri-last-slot.txt'
$maxAttempts = 4

function Get-TotpSlot {
  return [int64][Math]::Floor([DateTimeOffset]::UtcNow.ToUnixTimeSeconds() / 30)
}

function Wait-ForFreshTotpSlot {
  if (-not (Test-Path -LiteralPath $stateFile)) {
    return
  }

  $raw = (Get-Content -LiteralPath $stateFile -Raw -ErrorAction SilentlyContinue)
  if ([string]::IsNullOrWhiteSpace($raw)) {
    return
  }

  $lastSlot = 0L
  if (-not [int64]::TryParse($raw.Trim(), [ref]$lastSlot)) {
    return
  }

  $slot = Get-TotpSlot
  if ($slot -ne $lastSlot) {
    return
  }

  $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  $wait = [Math]::Max(2, 30 - ($now % 30) + 2)
  Write-Host "ssign-tauri: TOTP slot $slot already used; waiting ${wait}s for a fresh Certum code"
  Start-Sleep -Seconds $wait
}

function Invoke-Ssign {
  param([string] $FilePath)

  # Merge streams so Tauri's "Signing Output" / failure diagnostics include ssign errors.
  $output = & ssign $FilePath 2>&1
  $code = $LASTEXITCODE
  foreach ($line in $output) {
    Write-Host "$line"
  }
  return $code
}

for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
  Wait-ForFreshTotpSlot
  $slot = Get-TotpSlot
  Write-Host "ssign-tauri: signing $Path (attempt $attempt/$maxAttempts, TOTP slot $slot)"

  $code = Invoke-Ssign -FilePath $Path
  # Record the slot we just consumed (success or fail) so the next file waits.
  Set-Content -LiteralPath $stateFile -Value "$slot" -NoNewline

  if ($code -eq 0) {
    exit 0
  }

  Write-Host "ssign-tauri: ssign exited with code $code"
  if ($attempt -eq $maxAttempts) {
    Write-Host "ssign-tauri: giving up after $maxAttempts attempts"
    exit $code
  }
}

exit 1
