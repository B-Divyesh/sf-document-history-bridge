$ErrorActionPreference = "Stop"
$repo = "B-Divyesh/sf-document-history-bridge"
$manifestUrl = "https://github.com/$repo/releases/latest/download/latest.json"
$manifest = Invoke-RestMethod -Uri $manifestUrl
$asset = $manifest.platforms."windows-x64"
if (-not $asset.url -or -not $asset.sha256) { throw "Installer metadata is incomplete." }
$extension = [IO.Path]::GetExtension(([Uri]$asset.url).AbsolutePath)
$destination = Join-Path $env:TEMP "document-history-bridge-installer$extension"
Invoke-WebRequest -Uri $asset.url -OutFile $destination
$actual = (Get-FileHash -Algorithm SHA256 $destination).Hash.ToLowerInvariant()
if ($actual -ne $asset.sha256.ToLowerInvariant()) { Remove-Item $destination; throw "Checksum verification failed. Nothing was installed." }
Write-Host "Checksum verified. Starting the unsigned Document History Bridge installer."
if ($extension -eq ".msi") { Start-Process msiexec.exe -ArgumentList "/i `"$destination`"" -Wait } else { Start-Process $destination -Wait }
Write-Host "Installer finished. Windows may show a SmartScreen warning because this build is not code-signed."
