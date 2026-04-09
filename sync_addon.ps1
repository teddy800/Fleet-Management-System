# sync_addon.ps1 — Run this after any code change to sync and restart Odoo
$src = "C:\Users\HP\odoo-addons\mesob_fleet_customizations"
$dst = "C:\odoo\custom_addons\mesob_fleet_customizations"

$files = Get-ChildItem $src -Recurse -Include "*.py","*.xml","*.csv","*.json"
$count = 0
foreach ($f in $files) {
    $rel = $f.FullName.Substring($src.Length + 1)
    $dstFile = Join-Path $dst $rel
    $dstDir = Split-Path $dstFile -Parent
    if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Path $dstDir -Force | Out-Null }
    Copy-Item $f.FullName $dstFile -Force
    $count++
}
Write-Host "✓ Synced $count files  →  $dst" -ForegroundColor Green
Write-Host ""
Write-Host "To restart Odoo with module upgrade, run:" -ForegroundColor Yellow
Write-Host '  & "C:\Program Files\Odoo 19.0.20260217\python\python.exe" "C:\Program Files\Odoo 19.0.20260217\server\odoo-bin" -c "C:\Users\HP\odoo-addons\mesob_fleet_customizations\odoo.conf" -u mesob_fleet_customizations' -ForegroundColor Cyan
