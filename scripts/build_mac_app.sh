#!/usr/bin/env bash
# 在 macOS 上打包为 COCO-Visualizer.app（及同目录下的 COCO-Visualizer 文件夹）
# 用法：在项目根目录执行 ./scripts/build_mac_app.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

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
# 使用与仓库兼容的版本；Python 3.12+ 上 numpy==1.24 可能无 wheel，则退回到兼容组合
set +e
pip install -q -r requirements.txt -r requirements-build.txt
pip_st=$?
set -e
if [[ "$pip_st" -ne 0 ]]; then
  echo "提示: 严格 requirements 安装失败，改用 numpy>=1.26 等与当前 Python 兼容的版本…" >&2
  pip install -q Flask==2.3.3 flask-cors==4.0.0 'numpy>=1.26' 'pandas>=2.0.3' Pillow 'pyinstaller>=6'
fi

rm -rf build dist
pyinstaller --noconfirm coco_visualizer.spec

echo ""
echo "完成。输出："
echo "  ${ROOT}/dist/COCO-Visualizer.app   （双击启动）"
echo "  ${ROOT}/dist/COCO-Visualizer/      （目录版，可执行文件在内）"
echo ""
echo "可选：生成 DMG 便于分发 → ./scripts/create_mac_dmg.sh"
