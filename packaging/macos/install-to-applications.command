#!/bin/bash
# DMG 内一键安装：复制到用户「应用程序」、去除隔离、启动（无需 sudo）
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="COCO-Visualizer.app"
SRC="${DIR}/${APP_NAME}"
DST_ROOT="${HOME}/Applications"
DST="${DST_ROOT}/${APP_NAME}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  COCO Visualizer — macOS 安装助手"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [[ ! -d "${SRC}" ]]; then
  echo "错误：未在磁盘映像内找到 ${APP_NAME}。"
  echo "请从官方 DMG 根目录双击本脚本，不要单独拷贝本文件到别处运行。"
  echo ""
  read -rp "按回车关闭…" _
  exit 1
fi

mkdir -p "${DST_ROOT}"

if [[ -d "${DST}" ]]; then
  echo "→ 将替换已安装在「用户/应用程序」中的旧版本…"
  rm -rf "${DST}"
fi

echo "→ 正在复制到：${DST}"
ditto "${SRC}" "${DST}"

echo "→ 正在移除隔离标记（减少首次打开时的系统提示）…"
xattr -dr com.apple.quarantine "${DST}" 2>/dev/null || true

echo "→ 正在启动…"
open "${DST}" || true

echo ""
echo "安装完成。"
echo "  • 程序位置：${DST}"
echo "  • 若访达侧边栏没有「应用程序」，可用 ⌘⇧G 前往文件夹，输入：~/Applications"
echo "  • 若系统仍提示无法验证：对图标「右键 → 打开」一次即可。"
echo ""
read -rp "按回车关闭本窗口…" _
