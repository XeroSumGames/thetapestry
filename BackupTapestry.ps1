$source = "C:\TheTapestry"
$dest   = "C:\Users\tony_\OneDrive\Documents\My Coding\TapestrySource"
$date   = Get-Date -Format "yyyy-MM-dd"
$zip    = Join-Path $dest "tapestry-source-$date.zip"

# Ensure destination folder exists
if (-not (Test-Path $dest)) {
    New-Item -ItemType Directory -Path $dest | Out-Null
}

# Remove existing zip for today if it exists
if (Test-Path $zip) {
    Remove-Item $zip -Force
}

# Create fresh zip (excludes node_modules and .next for speed)
$exclude = @("node_modules", ".next", ".git")
$tempDir = "$env:TEMP\tapestry_backup_temp"

if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
New-Item -ItemType Directory -Path $tempDir | Out-Null

Get-ChildItem -Path $source | Where-Object { $_.Name -notin $exclude } | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination $tempDir -Recurse -Force
}

Compress-Archive -Path "$tempDir\*" -DestinationPath $zip -Force
Remove-Item $tempDir -Recurse -Force

Write-Host "Backup complete: $zip ($(Get-Date))"