[CmdletBinding()]
param(
  [string]$OutputDirectory = ""
)

$ErrorActionPreference = "Stop"

$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$manifestPath = Join-Path $workspace "manifest.json"
$packageJsonPath = Join-Path $workspace "package.json"

if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
  throw "manifest.json was not found at $manifestPath."
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$packageJson = Get-Content -LiteralPath $packageJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.manifest_version -ne 3) {
  throw "Only Manifest V3 extensions can be packaged."
}
if ([string]::IsNullOrWhiteSpace($manifest.version)) {
  throw "manifest.json must contain a version."
}
if ([string]::IsNullOrWhiteSpace($packageJson.version)) {
  throw "package.json must contain a version."
}
if ($packageJson.version -ne $manifest.version) {
  throw "manifest.json and package.json must use the same version."
}
if ($manifest.version -notmatch '^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)$') {
  throw "Version must use the MAJOR.MINOR.PATCH format so the patch number can be incremented safely."
}
if ($manifest.description.Length -gt 132) {
  throw "The manifest description exceeds Chrome Web Store's 132-character limit."
}

$previousVersion = $manifest.version
$nextVersion = "$($Matches.major).$($Matches.minor).$([int64]$Matches.patch + 1)"
$manifestRaw = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8
$packageJsonRaw = Get-Content -LiteralPath $packageJsonPath -Raw -Encoding UTF8

Write-Host "Running release validation..." -ForegroundColor Cyan
$validation = & npm --prefix $workspace run verify 2>&1
if ($LASTEXITCODE -ne 0) {
  $validation | Write-Host
  throw "Release validation failed."
}
$validation | Write-Host

$releaseDirectory = if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
  Join-Path $workspace "release"
} else {
  [IO.Path]::GetFullPath($OutputDirectory)
}

New-Item -ItemType Directory -Path $releaseDirectory -Force | Out-Null

$packageName = "AudioRoute-v$nextVersion.zip"
$zipPath = Join-Path $releaseDirectory $packageName
$stagingPath = Join-Path $releaseDirectory ".AudioRoute-package"
$versionUpdated = $false
$releaseSucceeded = $false

$packageFiles = @(
  "manifest.json",
  "service-worker.js",
  "shared/utils.js",
  "popup/popup.html",
  "popup/popup.css",
  "popup/popup.js",
  "setup/setup.html",
  "setup/setup.css",
  "setup/setup.js",
  "offscreen/offscreen.html",
  "offscreen/offscreen.js",
  "offscreen/audio-chain.js",
  "content/fullscreen-bridge.js",
  "icons/icon-16.png",
  "icons/icon-32.png",
  "icons/icon-48.png",
  "icons/icon-128.png"
)

if (Test-Path -LiteralPath $stagingPath) {
  Remove-Item -LiteralPath $stagingPath -Recurse -Force
}
if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

try {
  $versionPattern = '("version"\s*:\s*")' + [regex]::Escape($previousVersion) + '(")'
  $updatedManifestRaw = $manifestRaw -replace $versionPattern, ('${1}' + $nextVersion + '${2}')
  $updatedPackageJsonRaw = $packageJsonRaw -replace $versionPattern, ('${1}' + $nextVersion + '${2}')
  if ($updatedManifestRaw -eq $manifestRaw -or $updatedPackageJsonRaw -eq $packageJsonRaw) {
    throw "Could not update the version in manifest.json and package.json."
  }
  [IO.File]::WriteAllText($manifestPath, $updatedManifestRaw, [Text.UTF8Encoding]::new($false))
  $versionUpdated = $true
  [IO.File]::WriteAllText($packageJsonPath, $updatedPackageJsonRaw, [Text.UTF8Encoding]::new($false))
  $manifest.version = $nextVersion

  foreach ($relativePath in $packageFiles) {
    $sourcePath = Join-Path $workspace $relativePath
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
      throw "Required release file is missing: $relativePath"
    }

    $destinationPath = Join-Path $stagingPath $relativePath
    $destinationDirectory = Split-Path -Parent $destinationPath
    New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
    Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
  }

  Compress-Archive -Path (Join-Path $stagingPath "*") -DestinationPath $zipPath -CompressionLevel Optimal

  $archive = [IO.Compression.ZipFile]::OpenRead($zipPath)
  try {
    $archiveEntries = @($archive.Entries | ForEach-Object FullName)
  } finally {
    $archive.Dispose()
  }
  $requiredRootEntry = $archiveEntries -contains "manifest.json"
  $unexpectedEntries = @($archiveEntries | Where-Object {
      $_ -match "^(scripts|tests|node_modules|artifacts|release)/" -or $_ -match "(^|/)README\.md$"
    })

  if (-not $requiredRootEntry) {
    throw "The ZIP does not contain manifest.json at its root."
  }
  if ($unexpectedEntries.Count -gt 0) {
    throw "The ZIP contains development files: $($unexpectedEntries -join ', ')"
  }

  $hash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash
  $sizeMb = [Math]::Round((Get-Item -LiteralPath $zipPath).Length / 1MB, 2)

  Write-Host ""
  Write-Host "Release package created successfully." -ForegroundColor Green
  Write-Host "Version : $nextVersion (was $previousVersion)"
  Write-Host "ZIP     : $zipPath"
  Write-Host "Size    : $sizeMb MB"
  Write-Host "SHA-256 : $hash"
  Write-Host "Files   : $($archiveEntries.Count)"
  $releaseSucceeded = $true
} finally {
  if ($versionUpdated -and -not $releaseSucceeded) {
    [IO.File]::WriteAllText($manifestPath, $manifestRaw, [Text.UTF8Encoding]::new($false))
    [IO.File]::WriteAllText($packageJsonPath, $packageJsonRaw, [Text.UTF8Encoding]::new($false))
  }
  if (Test-Path -LiteralPath $stagingPath) {
    Remove-Item -LiteralPath $stagingPath -Recurse -Force
  }
}
