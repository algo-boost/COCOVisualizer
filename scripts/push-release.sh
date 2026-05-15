#!/usr/bin/env bash
# 写入 version.txt → 暂存 → 提交 → push，由 GitHub Actions 在远端构建安装包。
#
# 用法：
#   ./scripts/push-release.sh 1.7.3
#   ./scripts/push-release.sh 1.7.3 "feat: 某功能"
#   ./scripts/push-release.sh --yes 1.7.3 "chore: release 1.7.3"
#
# 选项：
#   --yes          不询问确认（CI/脚本调用）
#   --all          git add -A（含未跟踪文件，慎用）
#   --tag          额外推送标签 v<version>，触发 release.yml（正式发布到 GitHub Releases）
#   --local-mac    push 成功后在本机执行 build_mac_app + create_dmg（仅 macOS）
#   --dry-run      只打印将要执行的命令，不执行
#
# 默认：git add -u（已跟踪文件的修改）。不想提交的请先 git restore / stash。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

YES=false
ALL=false
TAG=false
LOCAL_MAC=false
DRY=false

while [[ $# -gt 0 && "$1" == -* ]]; do
  case "$1" in
    --yes) YES=true ;;
    --all) ALL=true ;;
    --tag) TAG=true ;;
    --local-mac) LOCAL_MAC=true ;;
    --dry-run) DRY=true ;;
    -h|--help)
      sed -n '1,25p' "$0"
      exit 0
      ;;
    *)
      echo "未知选项: $1" >&2
      exit 2
      ;;
  esac
  shift
done

if [[ $# -lt 1 ]]; then
  echo "用法: $0 [选项] <version> [commit-message]" >&2
  exit 2
fi

VERSION="$1"
shift
MSG="${1:-chore: release ${VERSION}}"

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "版本号应为 x.y.z 形式，收到: ${VERSION}" >&2
  exit 2
fi

if $DRY; then
  echo "[dry-run] 将写入 version.txt 首行: ${VERSION}"
  if $ALL; then
    echo "[dry-run] git add -A"
  else
    echo "[dry-run] git add -u"
  fi
  echo "[dry-run] git add version.txt"
  echo "[dry-run] git commit -m $(printf '%q' "$MSG")"
  echo "[dry-run] git push origin HEAD"
  $TAG && echo "[dry-run] git tag -a v${VERSION} && git push origin v${VERSION}"
  $LOCAL_MAC && echo "[dry-run] ./scripts/build_mac_app.sh && ./scripts/create_mac_dmg.sh"
  echo ""
  echo "当前工作区（提交前）："
  git status -sb
  exit 0
fi

printf '%s\n' "$VERSION" > "${ROOT}/version.txt"

if $ALL; then
  git add -A
else
  git add -u
fi
git add version.txt

if git diff --cached --quiet; then
  echo "没有可提交的变更（除 version.txt 外是否无已跟踪修改？）。" >&2
  exit 1
fi

echo ""
echo "即将提交："
git diff --cached --stat
echo ""

if ! $YES && ! $DRY; then
  read -r -p "确认提交并 push 到 origin? [y/N] " ans
  [[ "${ans:-}" == [yY] ]] || { echo "已取消。"; exit 1; }
fi

run() {
  if $DRY; then
    echo "[dry-run] $*"
  else
    "$@"
  fi
}

run git commit -m "${MSG}"
run git push origin HEAD

if $TAG; then
  TV="v${VERSION}"
  if $DRY; then
    echo "[dry-run] git tag -a ${TV} -m Release ${TV} && git push origin ${TV}"
  else
    if git rev-parse -q --verify "refs/tags/${TV}" >/dev/null; then
      echo "标签 ${TV} 已存在，跳过打标。若需重建请先本地删除标签。" >&2
    else
      git tag -a "${TV}" -m "Release ${TV}"
      git push origin "${TV}"
    fi
  fi
fi

if $LOCAL_MAC; then
  if [[ "$(uname -s)" != "Darwin" ]]; then
    echo "[跳过] --local-mac 仅适用于 macOS。" >&2
  elif $DRY; then
    echo "[dry-run] ./scripts/build_mac_app.sh && ./scripts/create_mac_dmg.sh"
  else
    chmod +x "${ROOT}/scripts/build_mac_app.sh" "${ROOT}/scripts/create_mac_dmg.sh"
    "${ROOT}/scripts/build_mac_app.sh"
    "${ROOT}/scripts/create_mac_dmg.sh"
    echo "本机产物见 dist/"
  fi
fi

echo ""
echo "完成。安装包由 GitHub Actions 构建（push main → Pre-release；若使用了 --tag 则另有正式 Release）。"
