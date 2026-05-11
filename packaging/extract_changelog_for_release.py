#!/usr/bin/env python3
"""从 CHANGELOG.md 截取当前版本小节，写入 release_body.md（供 GitHub Release 使用）。"""
from __future__ import annotations

import re
import sys
from pathlib import Path


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    vf = root / "version.txt"
    if not vf.is_file():
        print("version.txt 不存在", file=sys.stderr)
        return 1
    ver = ""
    for line in vf.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if s and not s.startswith("#"):
            ver = s
            break
    if not ver:
        print("version.txt 中无有效版本号", file=sys.stderr)
        return 1

    cl = root / "CHANGELOG.md"
    if not cl.is_file():
        print("CHANGELOG.md 不存在", file=sys.stderr)
        return 1
    text = cl.read_text(encoding="utf-8")

    parts = re.split(r"(?m)^##\s*\[", text)
    found: str | None = None
    for p in parts[1:]:
        if p.startswith(ver + "]"):
            found = "## [" + p.rstrip()
            break

    out = root / "release_body.md"
    if found:
        footer = "\n\n更早年份与完整条目见仓库根目录 **`CHANGELOG.md`**。\n"
        out.write_text(found + footer, encoding="utf-8")
        print(f"已写入 release_body.md（版本 {ver}）")
        return 0

    fallback = (
        f"## COCO Visualizer {ver}\n\n"
        f"尚未在 `CHANGELOG.md` 中找到 `## [{ver}]` 小节。\n"
    )
    out.write_text(fallback, encoding="utf-8")
    print(f"警告: CHANGELOG 无 [{ver}] 小节，已写入占位 release_body.md", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
