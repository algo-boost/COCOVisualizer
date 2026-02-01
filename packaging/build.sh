#!/bin/bash
# COCO Visualizer - Linux/macOS 打包脚本
# 用法: ./packaging/build.sh [--installer]
# 可选: --installer 会尝试生成安装包（Linux: AppImage, macOS: DMG）

set -e
cd "$(dirname "$0")/.."
PROJECT_ROOT="$(pwd)"
INSTALLER=false

for arg in "$@"; do
    case $arg in
        --installer) INSTALLER=true ;;
    esac
done

echo "=========================================="
echo "COCO Visualizer - 打包"
echo "=========================================="
echo ""

# 检测平台
OS="$(uname -s)"
case "$OS" in
    Linux*)  PLATFORM=linux ;;
    Darwin*) PLATFORM=macos ;;
    *)       PLATFORM=unknown ;;
esac
echo "平台: $PLATFORM"

# 检查 Python
if ! command -v python3 &>/dev/null; then
    echo "错误: 未找到 python3"
    exit 1
fi
echo "Python: $(python3 --version)"

# 安装 PyInstaller
echo ""
echo "检查 PyInstaller..."
if ! python3 -c "import PyInstaller" 2>/dev/null; then
    echo "安装 PyInstaller..."
    python3 -m pip install pyinstaller
fi

# 清理 PyInstaller 输出（保留 packaging 目录）
rm -rf dist build
mkdir -p dist

# 执行 PyInstaller
echo ""
echo "执行 PyInstaller 打包..."
python3 -m PyInstaller coco_visualizer.spec --noconfirm

DIST_DIR="$PROJECT_ROOT/dist/COCO-Visualizer"
if [ ! -d "$DIST_DIR" ]; then
    echo "错误: 未找到输出目录 $DIST_DIR"
    exit 1
fi

# 复制说明文件
cp USAGE.md "$DIST_DIR/" 2>/dev/null || true
cp README.md "$DIST_DIR/" 2>/dev/null || true

# 版本号
VERSION="1.0.0"
[ -f version.txt ] && VERSION=$(cat version.txt)

# 创建压缩包
ARCH=$(uname -m)
case "$ARCH" in
    x86_64|amd64) ARCH_SUFFIX="x64" ;;
    arm64|aarch64) ARCH_SUFFIX="arm64" ;;
    *) ARCH_SUFFIX="$ARCH" ;;
esac

if [ "$PLATFORM" = "macos" ]; then
    ZIP_NAME="COCO-Visualizer-macOS-${ARCH_SUFFIX}-${VERSION}.zip"
else
    ZIP_NAME="COCO-Visualizer-Linux-${ARCH_SUFFIX}-${VERSION}.tar.gz"
fi

echo ""
echo "创建压缩包: $ZIP_NAME"
if [ "$PLATFORM" = "macos" ]; then
    cd dist && zip -r "$ZIP_NAME" COCO-Visualizer && cd ..
else
    cd dist && tar czvf "$ZIP_NAME" COCO-Visualizer && cd ..
fi
echo "已生成: dist/$ZIP_NAME"

# 可选：生成安装包
if [ "$INSTALLER" = true ]; then
    if [ "$PLATFORM" = "macos" ]; then
        echo ""
        echo "尝试创建 macOS DMG..."
        if command -v create-dmg &>/dev/null; then
            create-dmg --volname "COCO Visualizer" "dist/COCO-Visualizer-${VERSION}.dmg" "$DIST_DIR" 2>/dev/null || echo "create-dmg 执行失败，请手动创建 DMG"
        else
            echo "未安装 create-dmg。安装: brew install create-dmg"
        fi
    elif [ "$PLATFORM" = "linux" ]; then
        echo ""
        echo "Linux AppImage 需要 linuxdeploy。请参考 BUILD.md 手动创建。"
    fi
fi

echo ""
echo "=========================================="
echo "打包完成!"
echo "输出目录: $DIST_DIR"
echo "压缩包: dist/$ZIP_NAME"
echo "=========================================="
