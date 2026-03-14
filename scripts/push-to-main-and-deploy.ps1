# Push i18n i ostale izmjene u main i na origin
# app.studiotaf.xyz i demo.studiotaf.xyz deployuju sa main grane

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host "=== 1. Test build ===" -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build FAILED. Ne šaljem na deploy." -ForegroundColor Red
    exit 1
}
Write-Host "Build OK." -ForegroundColor Green
Write-Host ""

Write-Host "=== 2. Commit izmjena na fix/status-flow ===" -ForegroundColor Cyan
git add -A
$status = git status --short
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "Nema novih izmjena za commit." -ForegroundColor Yellow
} else {
    git commit -m "i18n: finance tools, izvještaji, krediti, početna stanja, ColumnPicker, VAT overview"
    Write-Host "Commitano." -ForegroundColor Green
}
Write-Host ""

Write-Host "=== 3. Merge u main i push ===" -ForegroundColor Cyan
git checkout main
git merge fix/status-flow -m "Merge fix/status-flow: i18n sr/en, EUR za EU verziju"

Write-Host "Push main na origin..." -ForegroundColor Yellow
git push origin main

Write-Host ""
Write-Host "=== Gotovo ===" -ForegroundColor Green
Write-Host "DigitalOcean ce automatski deployovati app.studiotaf.xyz i demo.studiotaf.xyz"
Write-Host "Ako ne krene automatski, u DO konzoli: Apps -> studio -> Deploy"
Write-Host ""

# Vrati se na fix/status-flow
git checkout fix/status-flow
