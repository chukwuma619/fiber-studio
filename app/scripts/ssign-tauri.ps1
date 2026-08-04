#Requires -Version 7.0
<#
.SYNOPSIS
  Tauri signCommand wrapper for Certum SimplySign.

.DESCRIPTION
  Tauri invokes signCommand once per PE (sidecar, app exe, NSIS setup).
  The ssign CLI logs into Certum on every process, and Certum rejects rapid
  re-logins / reused TOTPs. ssign-pkcs11 persists the OAuth token so later
  invocations reuse the session.

  This wrapper drives that module through osslsigncode (the client ssign
  documents and tests). jsign is incompatible: SunPKCS11 sends ~108-byte
  payloads that ssign-pkcs11 rejects ("expected a 32-byte SHA-256 digest").
#>
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string] $Path
)

$ErrorActionPreference = 'Continue'

function Write-Log {
  param([string] $Message)
  $line = "ssign-tauri: $Message"
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
  Write-Log "$Label not found (set $EnvName)"
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
  Write-Log "Certum intermediate PEM not found next to script"
  exit 1
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

# URIs from ssign-pkcs11/tests/sign-all-formats.sh
$certUri = 'pkcs11:object=Certum%20SimplySign%20%28ssign%29;type=cert'
$keyUri = 'pkcs11:object=Certum%20SimplySign%20%28ssign%29;type=private'
$maxAttempts = 4

function Invoke-OsslSign {
  param([string] $FilePath, [int] $Attempt)

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

  if ($proc.ExitCode -eq 0 -and (Test-Path -LiteralPath $outPath)) {
    Move-Item -LiteralPath $outPath -Destination $FilePath -Force
  } else {
    Remove-Item -LiteralPath $outPath -ErrorAction SilentlyContinue
  }

  return $proc.ExitCode
}

for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
  Write-Log "signing $Path (attempt $attempt/$maxAttempts via osslsigncode + ssign-pkcs11)"

  $code = Invoke-OsslSign -FilePath $Path -Attempt $attempt
  if ($null -eq $code) { $code = 1 }

  if ($code -eq 0) {
    Write-Log "signed $Path"
    exit 0
  }

  Write-Log "osslsigncode exited with code $code"
  if ($attempt -eq $maxAttempts) {
    Write-Log "giving up after $maxAttempts attempts (see $script:LogFile)"
    exit $code
  }

  Start-Sleep -Seconds 8
  [void](Wait-FileWritable -FilePath $Path -TimeoutSec 30)
}

exit 1
