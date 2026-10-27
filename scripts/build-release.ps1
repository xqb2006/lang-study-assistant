# 发布构建脚本：阅读学习助手 + 阅读内容转换器
#
# 用途：一条命令产出可直接分发的 NSIS 安装包，避免手工步骤遗漏。
#
# 关键约束（由本脚本保证，请勿绕过）：
#   1. 必须先构建「转换器」，再构建「主程序」。顺序颠倒会导致主程序携带旧资源。
#   2. 不能直接使用 `cargo build --release`。Tauri 需要 vite 先产出 dist，
#      否则程序启动后会去请求 127.0.0.1:1420 而白屏。
#
# 用法：
#   powershell -ExecutionPolicy Bypass -File scripts\build-release.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\build-release.ps1 -SkipTests
#
param(
  [switch]$SkipTests,
  [switch]$SkipChecks
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Write-Step($message) {
  Write-Host ""
  Write-Host "==> $message" -ForegroundColor Cyan
}

# Windows PowerShell 5.1 的 Get-Content 默认按系统 ANSI 解码，
# 中文内容必须显式按 UTF-8 读取，否则 ConvertFrom-Json 会失败。
function Get-JsonVersion($relativePath) {
  $full = Join-Path $root $relativePath
  $text = [System.IO.File]::ReadAllText($full, [System.Text.Encoding]::UTF8)
  return ($text | ConvertFrom-Json).version
}

function Invoke-Step($label, $block) {
  Write-Step $label
  $started = Get-Date
  # npm / cargo 会把构建警告写到 stderr，PowerShell 5.1 在 2>&1 下会把这些
  # 警告包装成 ErrorRecord，若此时把 $ErrorActionPreference 当作失败依据，
  # 正常的带警告构建会被误判为失败。因此只认进程退出码。
  $global:LASTEXITCODE = 0
  $saved = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & $block
  } finally {
    $ErrorActionPreference = $saved
  }
  $code = $LASTEXITCODE
  if ($null -ne $code -and $code -ne 0) {
    Write-Host "!! 步骤失败（退出码 $code）：$label" -ForegroundColor Red
    exit 1
  }
  $elapsed = [int]((Get-Date) - $started).TotalSeconds
  Write-Host "    OK (${elapsed}s)" -ForegroundColor Green
}

Write-Host "阅读学习助手 发布构建" -ForegroundColor White
Write-Host "工作目录: $root"

# ---------------------------------------------------------------- 前置检查
if (-not $SkipChecks) {
  Write-Step "前置检查"

  # 发布包不能残留本地调试标识
  $debugLabel = Select-String -Path "src\App.tsx" -Pattern "测试构建 F" -SimpleMatch
  if ($debugLabel) {
    Write-Host "!! src\App.tsx 仍含硬编码调试标识：$($debugLabel.Line.Trim())" -ForegroundColor Red
    exit 1
  }

  # 三处版本号必须一致，避免安装包版本与程序内版本不符
  # 注意：Windows PowerShell 5.1 的 Get-Content 默认按系统 ANSI 解码，
  # 必须显式指定 UTF-8，否则中文被打乱会导致 ConvertFrom-Json 失败。
  $pkgVersion = Get-JsonVersion "package.json"
  $cargoMatch = Select-String -Path "src-tauri\Cargo.toml" -Pattern '^version\s*=\s*(.+)$'
  $cargoVersion = $cargoMatch.Matches[0].Groups[1].Value.Replace('"', '').Trim()
  $tauriVersion = Get-JsonVersion "src-tauri\tauri.conf.json"
  Write-Host "    版本号 package=$pkgVersion cargo=$cargoVersion tauri=$tauriVersion"
  if ($pkgVersion -ne $cargoVersion -or $pkgVersion -ne $tauriVersion) {
    Write-Host "!! package.json / Cargo.toml / tauri.conf.json 版本号不一致" -ForegroundColor Red
    exit 1
  }

  if (-not (Test-Path "node_modules")) {
    Write-Host "!! 未安装依赖，请先运行 npm install" -ForegroundColor Red
    exit 1
  }
  Write-Host "    检查通过" -ForegroundColor Green
}

# ---------------------------------------------------------------- 质量门禁
if (-not $SkipTests) {
  Invoke-Step "类型检查 (tsc --noEmit)" { npm.cmd run --silent typecheck 2>&1 | Out-Null }
  Invoke-Step "前端单元测试" { npm.cmd run test:ui 2>&1 | Out-Null }
  Invoke-Step "Rust 测试" { cargo test --manifest-path src-tauri\Cargo.toml 2>&1 | Out-Null }
}

# ---------------------------------------------------------------- 构建
# 顺序不可调整：转换器在前，主程序在后。
#
# 两个程序共用同一个 Rust release EXE（lang-study-assistant.exe），区别只在打包时
# 注入的前端资源。因此每次打包后必须立刻把该 EXE 复制成对应的分发文件，
# 否则第二次打包会覆盖第一次的结果。
$productExe = Join-Path $root "src-tauri\target\release\lang-study-assistant.exe"
$distDir = Join-Path $root "dist-release"
if (-not (Test-Path $distDir)) { New-Item -ItemType Directory -Path $distDir | Out-Null }

function Copy-Product($displayName) {
  $target = Join-Path $distDir "$displayName.exe"
  if (Test-Path $target) {
    try {
      Remove-Item $target -Force
    } catch {
      Write-Host "!! 无法覆盖 $target，请先关闭该程序" -ForegroundColor Red
      exit 1
    }
  }
  Copy-Item $productExe $target -Force
  Write-Host ("    已生成: {0} ({1:N1} MB)" -f $target, ((Get-Item $target).Length / 1MB))
}

Invoke-Step "构建转换器前端 (build:converter)" { npm.cmd run build:converter }
Invoke-Step "打包转换器" { npm.cmd run tauri build -- --config src-tauri/tauri.converter.conf.json --bundles nsis }
Invoke-Step "输出转换器程序文件" { Copy-Product "阅读内容转换器" }

Invoke-Step "构建主程序前端 (build)" { npm.cmd run build }
Invoke-Step "打包主程序" { npm.cmd run tauri build -- --bundles nsis }
Invoke-Step "输出主程序文件" { Copy-Product "阅读学习助手" }

# ---------------------------------------------------------------- 产出汇总
Write-Step "构建产物"
$found = $false
if (Test-Path $distDir) {
  Get-ChildItem $distDir -File -Filter *.exe | ForEach-Object {
    $found = $true
    Write-Host ("    {0}  ({1:N1} MB)" -f $_.FullName, ($_.Length / 1MB))
  }
}
$nsisDir = Join-Path $root "src-tauri\target\release\bundle\nsis"
if (Test-Path $nsisDir) {
  Get-ChildItem $nsisDir -File -Filter *.exe | Where-Object { $_.Name -notin @("阅读学习助手.exe", "阅读内容转换器.exe") } | ForEach-Object {
    Write-Host ("    安装包: {0}  ({1:N1} MB)" -f $_.FullName, ($_.Length / 1MB))
  }
}
if (-not $found) {
  Write-Host "!! 未找到程序文件，请检查上面的构建日志" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "构建完成。发布前请确认：" -ForegroundColor Yellow
Write-Host "  - 安装包已签名（否则 Windows 会提示未知发布者）"
Write-Host "  - 已在干净环境测试全新安装与从旧版本升级"
Write-Host "  - 已用旧版数据库验证数据迁移不丢失"
