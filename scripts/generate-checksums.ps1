# 计算并输出版本的 SHA256 校验值
#
# 用途：安装包没有数字签名，用户无法通过系统提示判断文件是否被篡改。
# 发布时把本脚本输出的校验值一并贴到 Release 说明中，用户可自行核对。
#
# 用法：
#   powershell -ExecutionPolicy Bypass -File scripts\generate-checksums.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

$sources = @(
  (Join-Path $root "dist-release"),
  (Join-Path $root "src-tauri\target\release\bundle\nsis")
)

$files = @()
foreach ($dir in $sources) {
  if (Test-Path $dir) {
    $files += Get-ChildItem $dir -File | Where-Object { $_.Extension -in ".exe", ".msi" }
  }
}

if ($files.Count -eq 0) {
  Write-Host "未找到可发布的程序或安装包，请先运行 scripts\build-release.ps1" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "SHA256 校验值" -ForegroundColor Cyan
Write-Host ""

$lines = @()
foreach ($file in $files | Sort-Object FullName -Unique) {
  $hash = (Get-FileHash $file.FullName -Algorithm SHA256).Hash
  $sizeMb = "{0:N1} MB" -f ($file.Length / 1MB)
  Write-Host ("文件: {0}" -f $file.Name)
  Write-Host ("大小: {0}" -f $sizeMb)
  Write-Host ("SHA256: {0}" -f $hash)
  Write-Host ""
  $lines += ("{0}  {1}  ({2})" -f $hash, $file.Name, $sizeMb)
}

$outFile = Join-Path $root "dist-release\SHA256SUMS.txt"
if (-not (Test-Path (Split-Path $outFile -Parent))) {
  New-Item -ItemType Directory -Path (Split-Path $outFile -Parent) | Out-Null
}
$lines | Set-Content -Path $outFile -Encoding UTF8

Write-Host ("校验值已保存: {0}" -f $outFile) -ForegroundColor Green
Write-Host ""
Write-Host "发布前请把这些校验值贴到 Release 说明中，并在 README 注明安装包未签名。" -ForegroundColor Yellow
