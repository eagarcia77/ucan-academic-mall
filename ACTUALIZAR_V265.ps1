$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
Write-Host "Actualizando UCAN Academic Mall V265..." -ForegroundColor Cyan
$containers = @(
  "ucan-babylon-mall-v243","ucan-babylon-mall-v244","ucan-babylon-mall-v245","ucan-babylon-mall-v246",
  "ucan-babylon-mall-v247","ucan-babylon-mall-v248","ucan-babylon-mall-v249","ucan-babylon-mall-v250",
  "ucan-babylon-mall-v251","ucan-babylon-mall-v252","ucan-babylon-mall-v253","ucan-babylon-mall-v254",
  "ucan-babylon-mall-v255","ucan-babylon-mall-v256","ucan-babylon-mall-v257","ucan-babylon-mall-v258",
  "ucan-babylon-mall-v259","ucan-babylon-mall-v260","ucan-babylon-mall-v261","ucan-babylon-mall-v262",
  "ucan-babylon-mall-v263","ucan-babylon-mall-v264","ucan-babylon-mall-v265"
)
foreach ($name in $containers) { docker rm -f $name 2>$null | Out-Null }
docker compose down --remove-orphans
docker compose build --no-cache
docker compose up -d --force-recreate
Start-Sleep -Seconds 5
$version = Invoke-RestMethod "http://localhost:3011/version"
$options = Invoke-RestMethod "http://localhost:3011/api/auth/options"
Write-Host "Versión: $($version.version)" -ForegroundColor Green
Write-Host "Cuentas y avatares: $($options.avatarOptions -ne $null)" -ForegroundColor Green
Start-Process "http://localhost:3011/login"
