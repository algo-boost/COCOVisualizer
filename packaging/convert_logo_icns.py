#!/usr/bin/env python3
"""从 static/logo.png 生成 macOS .icns（需 macOS 的 sips / iconutil）。"""
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

# Apple 要求的 iconset 文件名与边长（px）
ICONSET_ENTRIES: tuple[tuple[str, int], ...] = (
    ("icon_16x16.png", 16),
    ("icon_16x16@2x.png", 32),
    ("icon_32x32.png", 32),
    ("icon_32x32@2x.png", 64),
    ("icon_128x128.png", 128),
    ("icon_128x128@2x.png", 256),
    ("icon_256x256.png", 256),
    ("icon_256x256@2x.png", 512),
    ("icon_512x512.png", 512),
    ("icon_512x512@2x.png", 1024),
)


def main() -> int:
    if sys.platform != "darwin":
        print("跳过 ICNS（非 macOS）")
        return 0

    root = Path(__file__).resolve().parent.parent
    png = root / "static" / "logo.png"
    if not png.is_file():
        png = root / "packaging" / "installer" / "logo.png"
    if not png.is_file():
        print(f"未找到 logo PNG: {png}", file=sys.stderr)
        return 1

    installer = root / "packaging" / "installer"
    iconset = installer / "logo.iconset"
    icns_out = installer / "logo.icns"

    if iconset.exists():
        shutil.rmtree(iconset)
    iconset.mkdir(parents=True)

    for name, size in ICONSET_ENTRIES:
        out = iconset / name
        subprocess.run(
            ["sips", "-z", str(size), str(size), str(png), "--out", str(out)],
            check=True,
            capture_output=True,
        )

    if icns_out.exists():
        icns_out.unlink()
    subprocess.run(
        ["iconutil", "-c", "icns", str(iconset), "-o", str(icns_out)],
        check=True,
        capture_output=True,
    )
    shutil.rmtree(iconset, ignore_errors=True)
    print(f"已生成: {icns_out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
