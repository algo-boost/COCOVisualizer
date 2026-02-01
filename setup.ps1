# COCO 可视化工具 - Windows 环境安装脚本
# 用法: 在项目目录下执行 .\setup.ps1

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
Set-Location $ProjectRoot

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "COCO 数据集可视化工具 - 环境安装" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 1. 检查 Python
$pythonCmd = $null
foreach ($cmd in @("python", "python3", "py")) {
    try {
        $v = & $cmd --version 2>&1
        if ($LASTEXITCODE -eq 0 -or $v -match "Python") {
            $pythonCmd = $cmd
            break
        }
    } catch {}
}
if (-not $pythonCmd) {
    Write-Host "错误: 未检测到 Python。请先安装 Python 3.8+ 并勾选 'Add Python to PATH'。" -ForegroundColor Red
    Write-Host "下载: https://www.python.org/downloads/" -ForegroundColor Yellow
    exit 1
}
Write-Host "[OK] 已找到 Python: $pythonCmd" -ForegroundColor Green

# 2. 创建虚拟环境
$venvPath = Join-Path $ProjectRoot ".venv"
if (-not (Test-Path $venvPath)) {
    Write-Host "正在创建虚拟环境 .venv ..." -ForegroundColor Yellow
    & $pythonCmd -m venv $venvPath
    if ($LASTEXITCODE -ne 0) {
        Write-Host "创建虚拟环境失败。" -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] 虚拟环境已创建" -ForegroundColor Green
} else {
    Write-Host "[OK] 虚拟环境已存在" -ForegroundColor Green
}

# 3. 激活并安装依赖
$pipExe = Join-Path $venvPath "Scripts\pip.exe"
$pythonExe = Join-Path $venvPath "Scripts\python.exe"
if (-not (Test-Path $pipExe)) {
    Write-Host "错误: 未找到 .venv\Scripts\pip.exe" -ForegroundColor Red
    exit 1
}
Write-Host "正在安装 requirements.txt 依赖..." -ForegroundColor Yellow
& $pipExe install -r requirements.txt
if ($LASTEXITCODE -ne 0) {
    Write-Host "依赖安装失败。可尝试使用国内镜像:" -ForegroundColor Yellow
    Write-Host "  .\.venv\Scripts\pip.exe install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple" -ForegroundColor Gray
    exit 1
}
Write-Host "[OK] 依赖安装完成" -ForegroundColor Green

# 4. 创建必要目录
foreach ($dir in @("uploads", "static", "templates")) {
    $p = Join-Path $ProjectRoot $dir
    if (-not (Test-Path $p)) {
        New-Item -ItemType Directory -Path $p -Force | Out-Null
        Write-Host "[OK] 已创建目录: $dir" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "安装完成。" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "请确保 coco-eda 模块可用（见 SETUP.md 第三节）。" -ForegroundColor Yellow
Write-Host ""
Write-Host "启动应用:" -ForegroundColor White
Write-Host "  .\.venv\Scripts\Activate.ps1" -ForegroundColor Gray
Write-Host "  python app.py" -ForegroundColor Gray
Write-Host "或直接运行: .\run.ps1" -ForegroundColor Gray
Write-Host "访问地址: http://localhost:6009" -ForegroundColor Gray
Write-Host ""
