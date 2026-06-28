param(
  [switch]$SkipAppBuild
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$packageJsonPath = Join-Path $projectRoot 'package.json'
$outputDirectory = Join-Path $projectRoot 'dist-desktop'
$codeSigningOid = '1.3.6.1.5.5.7.3.3'

Set-Location $projectRoot

$certificateThumbprint = ([string]$env:NEXA_WINDOWS_CERT_SHA1 -replace '\s', '').ToUpperInvariant()
$certificateLink = if ($env:WIN_CSC_LINK) { $env:WIN_CSC_LINK } else { $env:CSC_LINK }

if ($certificateThumbprint) {
  $certificate = Get-ChildItem "Cert:\CurrentUser\My\$certificateThumbprint" -ErrorAction SilentlyContinue
  if (-not $certificate) {
    throw "Certificate $certificateThumbprint was not found in Cert:\CurrentUser\My."
  }
  if (-not $certificate.HasPrivateKey) {
    throw "Certificate $certificateThumbprint has no private key."
  }
  $hasCodeSigningUsage = $certificate.EnhancedKeyUsageList.ObjectId.Value -contains $codeSigningOid
  if (-not $hasCodeSigningUsage) {
    throw "Certificate $certificateThumbprint is not valid for Code Signing."
  }
} elseif (-not $certificateLink) {
  throw @"
No Windows code-signing certificate was configured.

Use one of these options:
  1. Set CSC_LINK (or WIN_CSC_LINK) to a trusted PFX/P12 certificate and CSC_KEY_PASSWORD to its password.
  2. Set NEXA_WINDOWS_CERT_SHA1 to the thumbprint of a trusted Code Signing certificate in Cert:\CurrentUser\My.
"@
}

if (-not $SkipAppBuild) {
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) {
    throw "Application build failed with exit code $LASTEXITCODE."
  }
}

$builderArguments = @('electron-builder', '--win', '--publish', 'never')
if ($certificateThumbprint) {
  $builderArguments += "--config.win.certificateSha1=$certificateThumbprint"
}

& npx.cmd @builderArguments
if ($LASTEXITCODE -ne 0) {
  throw "electron-builder failed with exit code $LASTEXITCODE."
}

$packageJson = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
$version = $packageJson.version
$expectedArtifacts = @(
  (Join-Path $outputDirectory "Nexa Messenger Setup $version.exe"),
  (Join-Path $outputDirectory "Nexa Messenger $version.exe"),
  (Join-Path $outputDirectory 'win-unpacked\Nexa Messenger.exe')
)

foreach ($artifact in $expectedArtifacts) {
  if (-not (Test-Path -LiteralPath $artifact)) {
    throw "Expected Windows artifact was not created: $artifact"
  }

  $signature = Get-AuthenticodeSignature -LiteralPath $artifact
  if ($signature.Status -ne 'Valid' -or -not $signature.SignerCertificate) {
    throw "Invalid Authenticode signature on $artifact. Status: $($signature.Status)."
  }

  Write-Host "Signed: $artifact"
  Write-Host "Publisher: $($signature.SignerCertificate.Subject)"
  Write-Host "Expires: $($signature.SignerCertificate.NotAfter)"
}

Write-Host "Windows release $version was built and all EXE signatures are valid."
