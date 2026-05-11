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

rm -f "$DMG_OUT"
hdiutil create -volname "$VOL" -srcfolder "$STAGE" -ov -format UDZO "$DMG_OUT"

echo "已生成: $DMG_OUT"
