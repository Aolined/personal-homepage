param(
  [string]$InstallerPath
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot

if ([string]::IsNullOrWhiteSpace($InstallerPath)) {
  $package = Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  $InstallerPath = Join-Path $projectRoot ("dist\Echo-Music-{0}-Setup.exe" -f $package.version)
}

$resolved = Resolve-Path -LiteralPath $InstallerPath -ErrorAction Stop
$signature = Get-AuthenticodeSignature -LiteralPath $resolved.Path

if ($signature.Status -ne 'Valid') {
  Write-Error ("Installer signature is not valid: {0} ({1})" -f $signature.Status, $resolved.Path)
  exit 1
}

[pscustomobject]@{
  Path = $resolved.Path
  Status = $signature.Status
  Signer = $signature.SignerCertificate.Subject
  Thumbprint = $signature.SignerCertificate.Thumbprint
  Expires = $signature.SignerCertificate.NotAfter
}
