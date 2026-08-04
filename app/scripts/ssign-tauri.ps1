#Requires -Version 7.0
<#
.SYNOPSIS
  Tauri signCommand wrapper for Certum SimplySign.

.DESCRIPTION
  Tauri invokes signCommand once per PE (sidecar, app exe, NSIS setup).
  The ssign CLI logs into Certum on every process, and Certum rejects rapid
  re-logins / reused TOTPs. ssign-pkcs11 persists the OAuth token so later
  invocations reuse the session (same design as osslsigncode in ssign's docs).

  This wrapper drives that module through jsign (Java Authenticode), which loads
  PKCS#11 directly — no OpenSSL engine required on Windows runners.
#>
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string] $Path
)

$ErrorActionPreference = 'Continue'

function Write-Log {
  param([string] $Message)
  $line = "ssign-tauri: $Message"
  # Console (not Write-Output): keeps function return values clean while still
  # landing on the process stdout/stderr pipes Tauri captures.
  [Console]::Out.WriteLine($line)
  if ($script:LogFile) {
    Add-Content -LiteralPath $script:LogFile -Value $line
  }
}

$stateDir = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } elseif ($env:TEMP) { $env:TEMP } else { '.' }
$script:LogFile = Join-Path $stateDir 'ssign-tauri.log'

# Pin the PKCS#11 session cache to a job-local directory (ssign-core CloudSession).
if (-not $env:XDG_RUNTIME_DIR) {
  $env:XDG_RUNTIME_DIR = $stateDir
}

if (-not (Test-Path -LiteralPath $Path)) {
  Write-Log "file not found: $Path"
  exit 1
}

if (-not $env:CERTUM_EMAIL -or -not $env:CERTUM_OTP) {
  Write-Log "CERTUM_EMAIL and CERTUM_OTP must be set"
  exit 1
}

$module = $env:SSIGN_PKCS11_MODULE
if (-not $module) {
  foreach ($cand in @(
      (Join-Path $stateDir 'ssign\ssign_pkcs11.dll'),
      (Join-Path $PSScriptRoot 'ssign_pkcs11.dll')
    )) {
    if (Test-Path -LiteralPath $cand) {
      $module = $cand
      break
    }
  }
}
if (-not $module -or -not (Test-Path -LiteralPath $module)) {
  Write-Log "ssign_pkcs11.dll not found (set SSIGN_PKCS11_MODULE)"
  exit 1
}

$jsignJar = $env:JSIGN_JAR
if (-not $jsignJar) {
  foreach ($cand in @(
      (Join-Path $stateDir 'ssign\jsign.jar'),
      (Join-Path $PSScriptRoot 'jsign.jar')
    )) {
    if (Test-Path -LiteralPath $cand) {
      $jsignJar = $cand
      break
    }
  }
}
if (-not $jsignJar -or -not (Test-Path -LiteralPath $jsignJar)) {
  Write-Log "jsign.jar not found (set JSIGN_JAR)"
  exit 1
}

$java = Get-Command java -ErrorAction SilentlyContinue
if (-not $java) {
  Write-Log "java not found on PATH (needed to run jsign)"
  exit 1
}

$certFile = Join-Path $PSScriptRoot 'certum-code-signing-2021-ca.pem'
if (-not (Test-Path -LiteralPath $certFile)) {
  $alt = Join-Path (Split-Path $module -Parent) 'certum-code-signing-2021-ca.pem'
  if (Test-Path -LiteralPath $alt) { $certFile = $alt }
}

# Wait until the PE is writable (Defender often locks a just-patched exe briefly).
function Wait-FileWritable {
  param([string] $FilePath, [int] $TimeoutSec = 60)
  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSec)
  while ([DateTime]::UtcNow -lt $deadline) {
    try {
      $fs = [System.IO.File]::Open(
        $FilePath,
        [System.IO.FileMode]::Open,
        [System.IO.FileAccess]::ReadWrite,
        [System.IO.FileShare]::None
      )
      $fs.Dispose()
      return $true
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }
  return $false
}

if (-not (Wait-FileWritable -FilePath $Path)) {
  Write-Log "timed out waiting for writable file: $Path"
  exit 1
}

$cfgPath = Join-Path $stateDir 'ssign-pkcs11.cfg'
# SunPKCS11 config — forward slashes avoid escaping issues in the cfg file.
$modulePosix = ($module -replace '\\', '/')
@(
  'name = ssign'
  "library = $modulePosix"
) | Set-Content -LiteralPath $cfgPath -Encoding ascii

$alias = 'Certum SimplySign (ssign)'
$maxAttempts = 4

function Invoke-Jsign {
  param([string] $FilePath, [int] $Attempt)

  $psi = [System.Diagnostics.ProcessStartInfo]::new()
  $psi.FileName = $java.Source
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true
  # ArgumentList avoids Start-Process quoting bugs with spaces / parentheses.
  [void]$psi.ArgumentList.Add('-jar')
  [void]$psi.ArgumentList.Add($jsignJar)
  [void]$psi.ArgumentList.Add('--keystore')
  [void]$psi.ArgumentList.Add($cfgPath)
  [void]$psi.ArgumentList.Add('--storetype')
  [void]$psi.ArgumentList.Add('PKCS11')
  [void]$psi.ArgumentList.Add('--storepass')
  [void]$psi.ArgumentList.Add('NONE')
  [void]$psi.ArgumentList.Add('--alias')
  [void]$psi.ArgumentList.Add($alias)
  [void]$psi.ArgumentList.Add('--alg')
  [void]$psi.ArgumentList.Add('SHA-256')
  [void]$psi.ArgumentList.Add('--tsaurl')
  [void]$psi.ArgumentList.Add('http://time.certum.pl')
  if (Test-Path -LiteralPath $certFile) {
    [void]$psi.ArgumentList.Add('--certfile')
    [void]$psi.ArgumentList.Add($certFile)
  }
  [void]$psi.ArgumentList.Add('--replace')
  [void]$psi.ArgumentList.Add($FilePath)

  $proc = [System.Diagnostics.Process]::new()
  $proc.StartInfo = $psi
  [void]$proc.Start()
  $stdout = $proc.StandardOutput.ReadToEnd()
  $stderr = $proc.StandardError.ReadToEnd()
  $proc.WaitForExit()

  $combined = @()
  if ($stdout) { $combined += $stdout -split "`r?`n" }
  if ($stderr) { $combined += $stderr -split "`r?`n" }
  foreach ($line in $combined) {
    if (-not [string]::IsNullOrWhiteSpace($line)) {
      Write-Log $line
    }
  }

  $outFile = Join-Path $stateDir "ssign-tauri-attempt-$Attempt.txt"
  Set-Content -LiteralPath $outFile -Value ($combined -join "`n")

  return $proc.ExitCode
}

for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
  Write-Log "signing $Path (attempt $attempt/$maxAttempts via jsign + ssign-pkcs11)"

  $code = Invoke-Jsign -FilePath $Path -Attempt $attempt
  if ($null -eq $code) { $code = 1 }

  if ($code -eq 0) {
    Write-Log "signed $Path"
    exit 0
  }

  Write-Log "jsign exited with code $code"
  if ($attempt -eq $maxAttempts) {
    Write-Log "giving up after $maxAttempts attempts (see $script:LogFile)"
    exit $code
  }

  # First login can race the TOTP window; later failures are often file locks.
  Start-Sleep -Seconds 8
  [void](Wait-FileWritable -FilePath $Path -TimeoutSec 30)
}

exit 1
