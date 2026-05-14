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

# ad-hoc 签名 + 清除扩展属性
# 目的：保证 .app 内全部二进制 / 嵌套 framework 的签名一致；用户从 DMG
# 拖到「应用程序」首次右键打开后，Gatekeeper 不会再每次都拦截。
APP_PATH="${ROOT}/dist/COCO-Visualizer.app"
if [[ -d "${APP_PATH}" ]]; then
  echo ""
  echo "对 .app 递归 ad-hoc 签名并清除扩展属性…"
  /usr/bin/xattr -cr "${APP_PATH}" || true
  /usr/bin/codesign --force --deep --sign - --timestamp=none \
    -o runtime "${APP_PATH}" || \
    /usr/bin/codesign --force --deep --sign - "${APP_PATH}"
  /usr/bin/codesign --verify --deep --strict --verbose=2 "${APP_PATH}" || true

  # 防止未生成 .icns 或 PyInstaller 未写入图标时仍产出「无 Dock/访达图标」的 .app（与 v1.7.0 起流水线一致，仅多一道显式校验）
  PLIST="${APP_PATH}/Contents/Info.plist"
  ICON_KEY="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIconFile' "${PLIST}" 2>/dev/null || true)"
  if [[ -z "${ICON_KEY}" ]]; then
    echo "错误: ${PLIST} 缺少 CFBundleIconFile，请检查 packaging/installer/logo.icns 是否在 PyInstaller 之前已生成。" >&2
    exit 1
  fi
  ICON_BASE="${ICON_KEY%.icns}"
  ICON_FILE="${APP_PATH}/Contents/Resources/${ICON_KEY}"
  if [[ ! -f "${ICON_FILE}" ]]; then
    ICON_FILE="${APP_PATH}/Contents/Resources/${ICON_BASE}.icns"
  fi
  if [[ ! -f "${ICON_FILE}" ]]; then
    echo "错误: 未找到 bundle 图标文件（CFBundleIconFile=${ICON_KEY}），期望类似 ${APP_PATH}/Contents/Resources/logo.icns" >&2
    exit 1
  fi
fi

echo ""
echo "完成（版本 ${VERSION}）。输出："
echo "  ${ROOT}/dist/COCO-Visualizer.app   （双击启动；访达「显示简介」可见版本 ${VERSION}）"
echo "  ${ROOT}/dist/COCO-Visualizer/      （目录版，可执行文件在内）"
echo ""
echo "可选：生成带版本号的 DMG → ./scripts/create_mac_dmg.sh"
