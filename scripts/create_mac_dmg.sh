#!/usr/bin/env bash
# 将 dist/COCO-Visualizer.app 打成 DMG，便于用户拖入「应用程序」
# 需先运行 ./scripts/build_mac_app.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${ROOT}/dist/COCO-Visualizer.app"
VERSION="$(sed -n '1p' "${ROOT}/version.txt" 2>/dev/null | tr -d '\r\t ' || true)"
[[ -z "${VERSION}" ]] && VERSION="0.0.0"
VOL="${DMG_VOLUME_NAME:-COCO Visualizer ${VERSION}}"
DMG_OUT="${ROOT}/dist/COCO-Visualizer-mac-${VERSION}.dmg"

if [[ ! -d "$APP" ]]; then
  echo "未找到 ${APP}，请先运行 ./scripts/build_mac_app.sh" >&2
  exit 1
fi

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
cp -R "$APP" "$STAGE/"
ln -sf /Applications "$STAGE/Applications"

# 进入 stage 后再清一次扩展属性，避免拷贝过程中 macOS 添加 com.apple.metadata 等
/usr/bin/xattr -cr "${STAGE}" || true

rm -f "$DMG_OUT"
hdiutil create -volname "$VOL" -srcfolder "$STAGE" -ov -format UDZO "$DMG_OUT"

# 对 DMG 自身做 ad-hoc 签名（Gatekeeper 会先校验 DMG 容器再校验内部 .app）
/usr/bin/codesign --force --sign - "$DMG_OUT" || true
/usr/bin/xattr -cr "$DMG_OUT" || true

echo "已生成: $DMG_OUT"
