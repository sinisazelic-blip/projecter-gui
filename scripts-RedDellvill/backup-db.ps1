# Backup MySQL baze (PowerShell, za DO)
# Koristi: .\scripts\backup-db.ps1
# Ili ručno: mysqldump -u USER -p -h HOST DATABASE > backup_YYYYMMDD.sql

param(
  [string]$User = "root",
  [string]$Host = "localhost",
  [string]$Database = "studio_db",
  [string]$BackupDir = ".\backups"
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

$Timestamp = Get-Date -Format "yyyyMMdd_HHmm"
$Output = Join-Path $BackupDir "${Database}_${Timestamp}.sql"

Write-Host "Backup: $Database -> $Output"
& mysqldump -u $User -p -h $Host --single-transaction --routines --triggers $Database > $Output

if ($LASTEXITCODE -eq 0) {
  $Size = (Get-Item $Output).Length / 1MB
  Write-Host "OK: $([math]::Round($Size, 2)) MB"
} else {
  Write-Host "Greška pri backup-u"
  exit 1
}
