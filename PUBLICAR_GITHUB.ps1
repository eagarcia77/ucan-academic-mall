param(
  [Parameter(Mandatory=$false)]
  [string]$Repositorio
)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not $Repositorio) {
  $Repositorio = Read-Host "Pegue la dirección HTTPS del repositorio nuevo, por ejemplo https://github.com/usuario/ucan-academic-mall.git"
}
if (-not $Repositorio) { throw "Debe indicar el repositorio." }
if (-not (Test-Path .git)) { git init }
git add .
$changes = git status --porcelain
if ($changes) { git commit -m "Publicar UCAN Academic Mall V265" }
git branch -M main
$hasOrigin = git remote 2>$null | Select-String -Pattern '^origin$'
if ($hasOrigin) { git remote set-url origin $Repositorio } else { git remote add origin $Repositorio }
git push -u origin main
Write-Host "Proyecto publicado. Abra el repositorio y seleccione Code > Codespaces > Create codespace on main." -ForegroundColor Green
