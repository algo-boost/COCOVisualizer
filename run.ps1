# COCO 数据集可视化工具 - Windows 启动脚本
# 用法: 在项目目录下执行 .\run.ps1

$ProjectRoot = $PSScriptRoot
Set-Location $ProjectRoot

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "COCO 数据集可视化工具" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$pythonExe = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
if (Test-Path $pythonExe) {
    Write-Host "使用虚拟环境 .venv 中的 Python" -ForegroundColor Green
    & $pythonExe app.py
} else {
    # 未找到虚拟环境，使用系统 Python
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
        Write-Host "错误: 未找到 Python。请先运行 .\setup.ps1 或安装 Python。" -ForegroundColor Red
        exit 1
    }
    Write-Host "未找到 .venv，使用系统 Python。建议先运行 .\setup.ps1 安装环境。" -ForegroundColor Yellow
    & $pythonCmd app.py
}
