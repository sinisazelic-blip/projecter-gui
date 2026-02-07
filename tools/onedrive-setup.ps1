# ==========================================
# OneDrive-safe setup for Next.js projects
# - updates .gitignore
# - writes .vscode/settings.json
# - writes README_DEV.md (NO triple-backticks)
# - does NOT delete anything
# ==========================================

$ErrorActionPreference = "Stop"

function Ensure-Dir($path) {
  if (-not (Test-Path $path)) { New-Item -ItemType Directory -Path $path | Out-Null }
}
function Ensure-File($path) {
  if (-not (Test-Path $path)) { New-Item -ItemType File -Path $path | Out-Null }
}
function Ensure-Lines($file, [string[]]$lines) {
  Ensure-File $file
  $existing = Get-Content $file -ErrorAction SilentlyContinue
  $toAdd = @()
  foreach ($l in $lines) {
    if ($existing -notcontains $l) { $toAdd += $l }
  }
  if ($toAdd.Count -gt 0) {
    Add-Content -Path $file -Value ($toAdd -join "`r`n")
  }
}

Write-Host "== OneDrive-safe setup starting ==" -ForegroundColor Cyan
$root = Get-Location

# 1) .gitignore
$gitignore = Join-Path $root ".gitignore"
$gitignoreLines = @(
  "",
  "# --- generated / heavy folders ---",
  "node_modules/",
  ".next/",
  "dist/",
  "build/",
  "",
  "# --- logs ---",
  "*.log",
  "npm-debug.log*",
  "yarn-debug.log*",
  "yarn-error.log*",
  "pnpm-debug.log*",
  "",
  "# --- env (never sync secrets in git) ---",
  ".env",
  ".env.local",
  ".env.*.local",
  "",
  "# --- OS / editor ---",
  ".DS_Store",
  "Thumbs.db"
)
Ensure-Lines $gitignore $gitignoreLines
Write-Host "OK: .gitignore updated" -ForegroundColor Green

# 2) VS Code settings (stop indexing heavy folders)
Ensure-Dir (Join-Path $root ".vscode")
$vscodeSettingsPath = Join-Path $root ".vscode\settings.json"

$settingsObj = @{
  "files.watcherExclude" = @{
    "**/.next/**"        = $true
    "**/node_modules/**" = $true
    "**/dist/**"         = $true
    "**/build/**"        = $true
  }
  "search.exclude" = @{
    "**/.next/**"        = $true
    "**/node_modules/**" = $true
    "**/dist/**"         = $true
    "**/build/**"        = $true
  }
  "files.exclude" = @{
    "**/.next" = $true
  }
}
$settingsJson = ($settingsObj | ConvertTo-Json -Depth 10)
Set-Content -Path $vscodeSettingsPath -Value $settingsJson -Encoding UTF8
Write-Host "OK: .vscode/settings.json written" -ForegroundColor Green

# 3) README_DEV.md (plain text, no markdown code fences)
$readmePath = Join-Path $root "README_DEV.md"
if (-not (Test-Path $readmePath)) {
@"
# Fluxa (proJECTer GUI) - Developer Notes

Quick start (new machine)
1) Install prerequisites:
- Node.js LTS
- VS Code
- MySQL (if running locally)

2) In project root:
- npm install
- npm run dev

Open:
- http://localhost:3000

Notes
- node_modules and .next are local build folders; avoid syncing them with OneDrive.
- If OneDrive makes '- Copy' duplicates, stop sync and move project out of OneDrive (C:\dev\fluxa\...).

"@ | Set-Content -Encoding UTF8 $readmePath
  Write-Host "OK: README_DEV.md created" -ForegroundColor Green
} else {
  Write-Host "OK: README_DEV.md already exists (left unchanged)" -ForegroundColor Green
}

Write-Host "== OneDrive-safe setup done ==" -ForegroundColor Cyan
