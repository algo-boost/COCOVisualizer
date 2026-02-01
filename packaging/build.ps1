# COCO Visualizer - Windows Build Script
# Usage: .\packaging\build.ps1 [-CreateInstaller]
# -CreateInstaller: Create .exe installer (requires Inno Setup 6)

param(
    [switch]$CreateInstaller = $false
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "COCO Visualizer - Windows Build" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Find Python
$pythonCmd = $null
foreach ($cmd in @("python", "python3", "py")) {
    try {
        $v = & $cmd --version 2>&1
        if ($LASTEXITCODE -eq 0 -or $v -match "Python") { $pythonCmd = $cmd; break }
    } catch {}
}
if (-not $pythonCmd) {
    Write-Host "Error: Python not found. Please install Python 3.8+" -ForegroundColor Red
    exit 1
}
Write-Host "Using Python: $pythonCmd" -ForegroundColor Green

# Check PyInstaller
Write-Host ""
Write-Host "Checking PyInstaller..." -ForegroundColor Yellow
& $pythonCmd -c "import PyInstaller" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Installing PyInstaller..."
    & $pythonCmd -m pip install pyinstaller
}

# Clean
if (Test-Path "dist") { Remove-Item -Recurse -Force dist }
if (Test-Path "build") { Remove-Item -Recurse -Force build }

# Run PyInstaller
Write-Host ""
Write-Host "Running PyInstaller..." -ForegroundColor Yellow
& $pythonCmd -m PyInstaller coco_visualizer.spec --noconfirm
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

$distDir = Join-Path $ProjectRoot "dist\COCO-Visualizer"
if (-not (Test-Path $distDir)) {
    Write-Host "Error: Output directory not found: $distDir" -ForegroundColor Red
    exit 1
}

# Copy docs
Copy-Item "USAGE.md" $distDir -ErrorAction SilentlyContinue
Copy-Item "README.md" $distDir -ErrorAction SilentlyContinue

# Create ZIP
$version = if (Test-Path "version.txt") { (Get-Content "version.txt" -Raw).Trim() } else { "1.0.0" }
$zipName = "COCO-Visualizer-Windows-x64-$version.zip"
$zipPath = Join-Path $ProjectRoot "dist\$zipName"
Write-Host ""
Write-Host "Creating ZIP: $zipName" -ForegroundColor Yellow
Compress-Archive -Path $distDir -DestinationPath $zipPath -Force
Write-Host "Created: $zipPath" -ForegroundColor Green

# Optional: Inno Setup installer
if ($CreateInstaller) {
    $iscc = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
    if (-not (Test-Path $iscc)) { $iscc = "C:\Program Files\Inno Setup 6\ISCC.exe" }
    if (Test-Path $iscc) {
        Write-Host ""
        Write-Host "Converting logo to ICO..." -ForegroundColor Yellow
        & $pythonCmd -m pip install Pillow -q 2>$null
        & $pythonCmd (Join-Path $ProjectRoot "packaging\convert_logo_ico.py")
        Write-Host "Creating installer..." -ForegroundColor Yellow
        & $iscc (Join-Path $ProjectRoot "packaging\installer\coco_visualizer.iss")
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Installer created in dist\" -ForegroundColor Green
        }
    } else {
        Write-Host ""
        Write-Host "Inno Setup not found. Install from: https://jrsoftware.org/isinfo.php" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Build complete!" -ForegroundColor Green
Write-Host "Output: $distDir" -ForegroundColor White
Write-Host "ZIP: $zipPath" -ForegroundColor White
Write-Host "==========================================" -ForegroundColor Cyan
