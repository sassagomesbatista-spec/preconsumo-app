$hostsPath = "C:\Windows\System32\drivers\etc\hosts"
$entry = "127.0.0.1 preconsumo.local"
$content = Get-Content $hostsPath -Raw
if ($content -notmatch "preconsumo\.local") {
    Add-Content -Path $hostsPath -Value "`n$entry" -Encoding ASCII
    Write-Host "preconsumo.local adicionado ao hosts." -ForegroundColor Green
} else {
    Write-Host "preconsumo.local ja estava no hosts." -ForegroundColor Yellow
}
Write-Host "Pronto! Acesse: http://preconsumo.local" -ForegroundColor Cyan
