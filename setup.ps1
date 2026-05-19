# AlphaWeek — One-shot dev setup
# Run this after filling in backend/.env and frontend/.env.local
# Usage: .\setup.ps1

$ErrorActionPreference = "Stop"
$env:NODE_OPTIONS = "--use-system-ca"

Write-Host "==> AlphaWeek setup" -ForegroundColor Cyan

# ── Backend ──────────────────────────────────────────────────────────────────
Write-Host "`n[1/4] Installing backend dependencies..." -ForegroundColor Yellow
Set-Location "$PSScriptRoot\backend"
npm install
if (-not $?) { throw "Backend npm install failed" }

Write-Host "`n[2/4] Generating Prisma client..." -ForegroundColor Yellow
npx prisma generate
if (-not $?) { throw "Prisma generate failed" }

Write-Host "`n[3/4] Applying database migrations..." -ForegroundColor Yellow
npx prisma migrate deploy
if (-not $?) { throw "Prisma migrate deploy failed" }

# ── Frontend ─────────────────────────────────────────────────────────────────
Write-Host "`n[4/4] Installing frontend dependencies..." -ForegroundColor Yellow
Set-Location "$PSScriptRoot\frontend"
npm install
if (-not $?) { throw "Frontend npm install failed" }

Write-Host "`nSetup complete." -ForegroundColor Green
Write-Host "  Backend:  cd backend && npm run dev"
Write-Host "  Frontend: cd frontend && npm run dev"
