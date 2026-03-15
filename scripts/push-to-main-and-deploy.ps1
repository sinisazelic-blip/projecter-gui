# Push na main i deploy na oba hosta (Studio + Demo)
# app.studiotaf.xyz i demo.studiotaf.xyz deployuju sa main grane
#
# Koristenje:
#   .\scripts\push-to-main-and-deploy.ps1
#   .\scripts\push-to-main-and-deploy.ps1 "Moja commit poruka"

param(
    [string]$CommitMessage = "Demo: tipovi troškova (tip_troska seed + fallback), projektni_troskovi seed"
)

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

$currentBranch = git rev-parse --abbrev-ref HEAD
Write-Host "=== 2. Commit izmjena na $currentBranch ===" -ForegroundColor Cyan
git add -A
$status = git status --short
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "Nema novih izmjena za commit." -ForegroundColor Yellow
} else {
    git commit -m $CommitMessage
    Write-Host "Commitano." -ForegroundColor Green
}
Write-Host ""

Write-Host "=== 3. Merge u main i push ===" -ForegroundColor Cyan
git checkout main
$mergeMsg = "Merge " + $currentBranch + ": " + $CommitMessage
git merge $currentBranch -m $mergeMsg

Write-Host "Push main na origin..." -ForegroundColor Yellow
git push origin main

Write-Host ""
Write-Host "=== Gotovo ===" -ForegroundColor Green
Write-Host "DigitalOcean ce automatski deployovati oba hosta:"
Write-Host "  - app.studiotaf.xyz (Studio)"
Write-Host "  - demo.studiotaf.xyz (Demo)"
Write-Host "Ako ne krene automatski, u DO konzoli: Apps -> studio -> Deploy"
Write-Host ""

# Vrati se na prethodnu granu
git checkout $currentBranch
