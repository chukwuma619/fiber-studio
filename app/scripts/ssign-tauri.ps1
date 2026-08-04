#Requires -Version 7.0
<#
.SYNOPSIS
  Tauri signCommand wrapper for Certum SimplySign.

.DESCRIPTION
  Tauri invokes signCommand once per PE (sidecar, app exe, NSIS plugins, setup).
  The ssign CLI logs into Certum on every process, and Certum rejects rapid
  re-logins / reused TOTPs. ssign-pkcs11 persists the OAuth token so later
  invocations reuse the session.

  Signs via osslsigncode + ssign_pkcs11.dll (jsign is incompatible with this module).
#>
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string] $Path
)

$ErrorActionPreference = 'Continue'

function Write-Err {
  param([string] $Message)
  [Console]::Error.WriteLine("ssign-tauri: $Message")
}

$stateDir = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } elseif ($env:TEMP) { $env:TEMP } else { '.' }

# Pin the PKCS#11 session cache to a job-local directory (ssign-core CloudSession).
if (-not $env:XDG_RUNTIME_DIR) {
  $env:XDG_RUNTIME_DIR = $stateDir
}

if (-not (Test-Path -LiteralPath $Path)) {
  Write-Err "file not found: $Path"
  exit 1
}

if (-not $env:CERTUM_EMAIL -or -not $env:CERTUM_OTP) {
  Write-Err "CERTUM_EMAIL and CERTUM_OTP must be set"
  exit 1
}

function Resolve-Tool {
  param(
    [string] $EnvName,
    [string[]] $Candidates,
    [string] $Label
  )
  $fromEnv = [Environment]::GetEnvironmentVariable($EnvName)
  if ($fromEnv -and (Test-Path -LiteralPath $fromEnv)) {
    return $fromEnv
  }
  foreach ($cand in $Candidates) {
    if ($cand -and (Test-Path -LiteralPath $cand)) {
      return $cand
    }
  }
  Write-Err "$Label not found (set $EnvName)"
  exit 1
}

$module = Resolve-Tool -EnvName 'SSIGN_PKCS11_MODULE' -Label 'ssign_pkcs11.dll' -Candidates @(
  (Join-Path $stateDir 'ssign\ssign_pkcs11.dll'),
  (Join-Path $PSScriptRoot 'ssign_pkcs11.dll')
)

$ossl = Resolve-Tool -EnvName 'OSSLSIGNCODE' -Label 'osslsigncode.exe' -Candidates @(
  (Join-Path $stateDir 'ssign\osslsigncode.exe'),
  'C:\msys64\mingw64\bin\osslsigncode.exe'
)

$provider = Resolve-Tool -EnvName 'OPENSSL_PKCS11_PROVIDER' -Label 'pkcs11prov.dll' -Candidates @(
  (Join-Path $stateDir 'ssign\pkcs11prov.dll'),
  'C:\msys64\mingw64\lib\ossl-modules\pkcs11prov.dll'
)

$certFile = Join-Path $PSScriptRoot 'certum-code-signing-2021-ca.pem'
if (-not (Test-Path -LiteralPath $certFile)) {
  $alt = Join-Path (Split-Path $module -Parent) 'certum-code-signing-2021-ca.pem'
  if (Test-Path -LiteralPath $alt) { $certFile = $alt }
}
if (-not (Test-Path -LiteralPath $certFile)) {
  Write-Err "Certum intermediate PEM not found next to script"
  exit 1
}

# Shared read is enough for osslsigncode -in. Exclusive locks fail under Defender
# while it scans a just-patched PE (Tauri patches fiber-studio.exe right before sign).
function Wait-FileReadable {
  param([string] $FilePath, [int] $TimeoutSec = 120)
  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSec)
  while ([DateTime]::UtcNow -lt $deadline) {
    try {
      $fs = [System.IO.File]::Open(
        $FilePath,
        [System.IO.FileMode]::Open,
        [System.IO.FileAccess]::Read,
        [System.IO.FileShare]::ReadWrite
      )
      $fs.Dispose()
      return $true
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }
  return $false
}

# Replace the target with the signed temp file. Defender often holds the PE briefly
# after Tauri patches it; keep retrying longer than a typical AV scan.
function Replace-FileWithRetry {
  param(
    [string] $SourcePath,
    [string] $DestinationPath,
    [int] $TimeoutSec = 300
  )
  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSec)
  while ([DateTime]::UtcNow -lt $deadline) {
    try {
      [System.IO.File]::Copy($SourcePath, $DestinationPath, $true)
      Remove-Item -LiteralPath $SourcePath -Force -ErrorAction Stop
      return $true
    } catch {
      Start-Sleep -Milliseconds 1000
    }
  }
  return $false
}

# URIs from ssign-pkcs11/tests/sign-all-formats.sh
$certUri = 'pkcs11:object=Certum%20SimplySign%20%28ssign%29;type=cert'
$keyUri = 'pkcs11:object=Certum%20SimplySign%20%28ssign%29;type=private'
$maxAttempts = 4

function Invoke-OsslSign {
  param([string] $FilePath)

  if (-not (Wait-FileReadable -FilePath $FilePath -TimeoutSec 120)) {
    Write-Err "timed out waiting for readable file: $FilePath"
    return 1
  }

  $outPath = "$FilePath.ssign-tmp"
  Remove-Item -LiteralPath $outPath -ErrorAction SilentlyContinue

  $psi = [System.Diagnostics.ProcessStartInfo]::new()
  $psi.FileName = $ossl
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true

  foreach ($arg in @(
      'sign',
      '-provider', $provider,
      '-pkcs11module', $module,
      '-pkcs11cert', $certUri,
      '-key', $keyUri,
      '-ac', $certFile,
      '-h', 'sha256',
      '-t', 'http://time.certum.pl/',
      '-in', $FilePath,
      '-out', $outPath
    )) {
    [void]$psi.ArgumentList.Add($arg)
  }

  $proc = [System.Diagnostics.Process]::new()
  $proc.StartInfo = $psi
  [void]$proc.Start()
  $stdout = $proc.StandardOutput.ReadToEnd()
  $stderr = $proc.StandardError.ReadToEnd()
  $proc.WaitForExit()

  if ($proc.ExitCode -ne 0) {
    Remove-Item -LiteralPath $outPath -ErrorAction SilentlyContinue
    if ($stderr) { Write-Err $stderr.Trim() }
    if ($stdout) { Write-Err $stdout.Trim() }
    return $proc.ExitCode
  }

  if (-not (Test-Path -LiteralPath $outPath)) {
    Write-Err "osslsigncode reported success but missing $outPath"
    return 1
  }

  if (-not (Replace-FileWithRetry -SourcePath $outPath -DestinationPath $FilePath -TimeoutSec 300)) {
    Write-Err "timed out replacing $FilePath with signed output"
    return 1
  }

  return 0
}

for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
  $code = Invoke-OsslSign -FilePath $Path
  if ($null -eq $code) { $code = 1 }

  if ($code -eq 0) {
    exit 0
  }

  if ($attempt -eq $maxAttempts) {
    Write-Err "giving up after $maxAttempts attempts signing $Path"
    exit $code
  }

  Start-Sleep -Seconds 8
}

exit 1
