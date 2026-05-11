#!/usr/bin/env bash
# 在 macOS 上打包为 COCO-Visualizer.app（及同目录下的 COCO-Visualizer 文件夹）
# 用法：在项目根目录执行 ./scripts/build_mac_app.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="$(sed -n '1p' "${ROOT}/version.txt" 2>/dev/null | tr -d '\r\t ' || true)"
[[ -z "${VERSION}" ]] && VERSION="0.0.0"
echo "打包版本: ${VERSION}（来自 version.txt）"
echo ""

PY="${PYTHON:-}"
if [[ -z "$PY" ]]; then
  for cand in python3.12 python3.11 python3.10 python3; do
    if command -v "$cand" &>/dev/null; then
      PY="$(command -v "$cand")"
      break
    fi
  done
fi
if [[ -z "$PY" ]]; then
  echo "未找到 python3，请先安装 Python 3.10 或更高版本。" >&2
  exit 1
fi

VENV="${ROOT}/.venv-build"
if [[ ! -d "$VENV" ]]; then
  "$PY" -m venv "$VENV"
fi
# shellcheck source=/dev/null
source "$VENV/bin/activate"

pip install -q -U pip setuptools wheel
pip install -q -r requirements.txt -r requirements-build.txt

# 图标必须在 PyInstaller 之前生成（.icns + .ico）
echo ""
echo "生成应用图标（logo.icns / logo.ico）…"
"$PY" -m pip install -q Pillow
"$PY" "${ROOT}/packaging/convert_logo_ico.py"
"$PY" "${ROOT}/packaging/convert_logo_icns.py"

# 前端 Vite 构建（OPT-IN）
FRONTEND_DIR="${ROOT}/frontend"
if [[ "${BUILD_VITE:-0}" == "1" && -f "${FRONTEND_DIR}/package.json" ]]; then
  if command -v npm &>/dev/null; then
    echo ""
    echo "构建前端 Vite 产物（BUILD_VITE=1，npm run build）…"
    pushd "${FRONTEND_DIR}" >/dev/null
    if [[ ! -d node_modules ]]; then
      npm install --no-fund --no-audit --silent
    fi
    npm run build --silent
    popd >/dev/null
    echo "  → ${ROOT}/static/dist/ 已更新"
  else
    echo "[警告] BUILD_VITE=1 但未检测到 npm，跳过。" >&2
  fi
else
  rm -rf "${ROOT}/static/dist"
fi

rm -rf build dist
pyinstaller --noconfirm coco_visualizer.spec

echo ""
echo "完成（版本 ${VERSION}）。输出："
echo "  ${ROOT}/dist/COCO-Visualizer.app   （双击启动；访达「显示简介」可见版本 ${VERSION}）"
echo "  ${ROOT}/dist/COCO-Visualizer/      （目录版，可执行文件在内）"
echo ""
echo "可选：生成带版本号的 DMG → ./scripts/create_mac_dmg.sh"
