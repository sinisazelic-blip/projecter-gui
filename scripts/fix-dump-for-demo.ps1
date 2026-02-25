# Skripta za pripremu dump fajlova za demo bazu
# Zamjenjuje studio_db sa studio_db_demo i uklanja SET komande koje zahtijevaju SUPER privilegije

$dumpFolder = "C:\Users\Studio\OneDrive\mysql tools\Stukture_NEW\Fluxa_FULL20022026"
$backupFolder = "$dumpFolder\_backup_original"

# Napravi backup originalnih fajlova
Write-Host "Kreiranje backup-a originalnih fajlova..." -ForegroundColor Yellow
if (-not (Test-Path $backupFolder)) {
    New-Item -ItemType Directory -Path $backupFolder | Out-Null
}
Copy-Item -Path "$dumpFolder\*.sql" -Destination $backupFolder -Force

Write-Host "Obrada SQL fajlova..." -ForegroundColor Green

Get-ChildItem -Path $dumpFolder -Filter "*.sql" -Recurse | ForEach-Object {
    $file = $_.FullName
    $content = Get-Content $file -Raw -Encoding UTF8
    
    # Zamijeni USE studio_db sa USE studio_db_demo
    $content = $content -replace 'USE\s+`?studio_db`?\s*;', 'USE `studio_db_demo`;'
    $content = $content -replace 'USE\s+studio_db\s*;', 'USE `studio_db_demo`;'
    
    # Zamijeni reference na studio_db u CREATE DATABASE, DROP DATABASE, itd.
    $content = $content -replace '`studio_db`\.', '`studio_db_demo`.'
    $content = $content -replace 'studio_db\.', 'studio_db_demo.'
    
    # Ukloni SET komande koje zahtijevaju SUPER privilegije
    # (zadrži samo one koje su sigurne)
    $content = $content -replace '(?m)^SET\s+@OLD_[A-Z_]+\s*=.*?;?\s*$', ''
    $content = $content -replace '(?m)^SET\s+[A-Z_]+\s*=.*?;?\s*$', ''
    $content = $content -replace '(?m)^SET\s+sql_mode\s*=.*?;?\s*$', ''
    $content = $content -replace '(?m)^SET\s+character_set_client\s*=.*?;?\s*$', ''
    $content = $content -replace '(?m)^SET\s+character_set_results\s*=.*?;?\s*$', ''
    $content = $content -replace '(?m)^SET\s+collation_connection\s*=.*?;?\s*$', ''
    $content = $content -replace '(?m)^SET\s+time_zone\s*=.*?;?\s*$', ''
    $content = $content -replace '(?m)^SET\s+autocommit\s*=.*?;?\s*$', ''
    $content = $content -replace '(?m)^SET\s+NAMES\s+.*?;?\s*$', ''
    
    # Ukloni LOCK/UNLOCK TABLES ako postoje (mogu uzrokovati probleme)
    $content = $content -replace '(?m)^LOCK\s+TABLES.*?;?\s*$', ''
    $content = $content -replace '(?m)^UNLOCK\s+TABLES\s*;?\s*$', ''
    
    # Sačuvaj promijenjeni fajl
    Set-Content -Path $file -Value $content -Encoding UTF8 -NoNewline
    
    Write-Host "  ✓ $($_.Name)" -ForegroundColor Gray
}

Write-Host "`nGotovo! Svi fajlovi su pripremljeni za demo bazu." -ForegroundColor Green
Write-Host "Originalni fajlovi su sačuvani u: $backupFolder" -ForegroundColor Cyan
Write-Host "`nSada možeš importovati u MySQL Workbench:" -ForegroundColor Yellow
Write-Host "  1. Server → Data Import" -ForegroundColor White
Write-Host "  2. Import from Dump Project Folder" -ForegroundColor White
Write-Host "  3. Odaberi folder: $dumpFolder" -ForegroundColor White
Write-Host "  4. Default Target Schema: studio_db_demo" -ForegroundColor White
Write-Host "  5. Start Import" -ForegroundColor White
