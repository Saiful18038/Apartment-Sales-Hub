# Builds the Next.js SPA (frontend/) into a static export and copies it into
# this Laravel app's public/ folder, so `php artisan serve` serves the whole
# app (UI + API) from one port.
#
# Run this once after cloning, and again whenever the frontend changes.
#
#   powershell -ExecutionPolicy Bypass -File build-frontend.ps1

$ErrorActionPreference = 'Stop'

$backend  = $PSScriptRoot
$frontend = Join-Path $backend 'frontend'
$public   = Join-Path $backend 'public'
$out      = Join-Path $frontend 'out'

# Laravel's own files in public/ that must survive the copy.
$keep = @('index.php', '.htaccess', 'robots.txt', 'hot')

if (-not (Test-Path $frontend)) {
    throw "Frontend not found at $frontend"
}

Write-Host "==> Building frontend static export ($frontend)" -ForegroundColor Cyan
Push-Location $frontend
try {
    if (-not (Test-Path (Join-Path $frontend 'node_modules'))) {
        & npm install
        if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
    }
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
}
finally {
    Pop-Location
}

if (-not (Test-Path (Join-Path $out 'index.html'))) {
    throw "Export missing: $out\index.html (did 'output: export' run?)"
}

Write-Host "==> Clearing old build from public/" -ForegroundColor Cyan
Get-ChildItem -Force $public | Where-Object { $keep -notcontains $_.Name } | Remove-Item -Recurse -Force

Write-Host "==> Copying export into public/" -ForegroundColor Cyan
Copy-Item -Recurse -Force (Join-Path $out '*') $public

Write-Host "==> Done. Start the app with:  php artisan serve" -ForegroundColor Green
