$ErrorActionPreference = "Stop"
$BackupDir = if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { ".\backups" }
$RetentionDays = if ($env:BACKUP_RETENTION_DAYS) { [int]$env:BACKUP_RETENTION_DAYS } else { 14 }
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$out = Join-Path $BackupDir "hisobchi-$stamp.sql"
$gz = "$out.gz"
docker compose exec -T postgres pg_dump -U "hisobchi" -d "hisobchi" --no-owner --no-acl | Set-Content -Encoding Byte $out
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed" }
# Compress-Archive cannot gzip a single file as a .gz stream; use gzip if installed.
if (Get-Command gzip -ErrorAction SilentlyContinue) { gzip -9 $out; $gz = "$out.gz" }
else { throw "Install gzip (e.g. Git for Windows) to compress backups safely." }
Get-ChildItem $BackupDir -Filter "hisobchi-*.sql.gz" | Where-Object { $_.LastWriteTimeUtc -lt (Get-Date).ToUniversalTime().AddDays(-$RetentionDays) } | Remove-Item -Force
Write-Host "Backup created: $gz"
