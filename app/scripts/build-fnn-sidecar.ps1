# Build the Windows fnn sidecar. Static OpenSSL, crt-static, same as Fiber's release build.
$ErrorActionPreference = "Stop"

$studioRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$fiberSrc = if ($env:FIBER_SRC) { $env:FIBER_SRC } else { Join-Path $studioRoot "..\fiber" }
$studioApp = if ($env:STUDIO_APP) { $env:STUDIO_APP } else { Join-Path $studioRoot "app" }
if (-not [System.IO.Path]::IsPathRooted($fiberSrc)) {
  $fiberSrc = Join-Path $studioRoot $fiberSrc
}
if (-not [System.IO.Path]::IsPathRooted($studioApp)) {
  $studioApp = Join-Path $studioRoot $studioApp
}

$fnnTriple = if ($env:FNN_TRIPLE) { $env:FNN_TRIPLE } else { "x86_64-pc-windows-msvc" }
if ($fnnTriple -ne "x86_64-pc-windows-msvc") {
  throw "build-fnn-sidecar.ps1 only builds x86_64-pc-windows-msvc (got $fnnTriple)"
}

$jit = Join-Path $fiberSrc "crates\fiber-lib\src\fiber\jit.rs"
if (-not (Test-Path $jit)) {
  throw "No JIT support in $fiberSrc (missing jit.rs). Check out feat/jit-channel."
}

if (-not (Get-Command scoop -ErrorAction SilentlyContinue)) {
  Invoke-WebRequest -useb get.scoop.sh -outfile "$env:TEMP\install-scoop.ps1"
  & "$env:TEMP\install-scoop.ps1" -RunAsAdmin
  $env:PATH = "$env:USERPROFILE\scoop\shims;$env:PATH"
}
scoop install llvm yasm
$env:LIBCLANG_PATH = "$env:USERPROFILE\scoop\apps\llvm\current\bin"
$env:PATH = "$env:LIBCLANG_PATH;$env:PATH"

vcpkg integrate install
vcpkg install openssl:x64-windows-static
$env:RUSTFLAGS = "-C target-feature=+crt-static"

$sha = (git -C $fiberSrc rev-parse HEAD).Trim()
$shortSha = $sha.Substring(0, 7)
Write-Host "Building fnn $sha for $fnnTriple from $fiberSrc"
Push-Location $fiberSrc
cargo build --release --locked
Pop-Location

$targetDir = if ($env:CARGO_TARGET_DIR) { $env:CARGO_TARGET_DIR } else { Join-Path $fiberSrc "target" }
$built = Join-Path $targetDir "release\fnn.exe"
if (-not (Test-Path $built)) {
  throw "fnn was not produced at $built"
}
$version = (& $built --version | Out-String).Trim()
Write-Host $version
if ($version -notlike "*$shortSha*") {
  throw "Built fnn does not match $sha (binary reports: $version)."
}

$destDir = Join-Path $studioApp "src-tauri\binaries"
New-Item -ItemType Directory -Force -Path $destDir | Out-Null
$dest = Join-Path $destDir "fnn-$fnnTriple.exe"
Copy-Item $built $dest -Force
Set-Content -Path (Join-Path $destDir "fnn-source.txt") -Value @($sha, $fnnTriple)
Write-Host "Wrote $dest"

$debugDir = Join-Path $studioApp "src-tauri\target\debug"
if (Test-Path $debugDir) {
  try {
    Copy-Item $dest (Join-Path $debugDir "fnn.exe") -Force
    Write-Host "Updated dev sidecar $debugDir\fnn.exe"
  } catch {
    Write-Warning "Could not update $debugDir\fnn.exe (stop the node, then re-run build-fnn)."
  }
}
