#!/usr/bin/env python3
"""Extract current version section from CHANGELOG.md into release_body.md.

Print messages are ASCII-only to avoid Windows console encoding errors in CI.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path


def main() -> int:
    root = Path(__file__).resolve().parent.parent

    vf = root / "version.txt"
    if not vf.is_file():
        print("ERROR: version.txt not found", file=sys.stderr)
        return 1
    ver = ""
    for line in vf.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if s and not s.startswith("#"):
            ver = s
            break
    if not ver:
        print("ERROR: no valid version in version.txt", file=sys.stderr)
        return 1

    cl = root / "CHANGELOG.md"
    if not cl.is_file():
        print("ERROR: CHANGELOG.md not found", file=sys.stderr)
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
        footer = (
            "\n\nFull changelog: see `CHANGELOG.md` in repository root.\n"
        )
        out.write_bytes((found + footer).encode("utf-8"))
        print(f"OK: wrote release_body.md (version {ver})")
        return 0

    fallback = (
        f"## COCO Visualizer {ver}\n\n"
        f"No `## [{ver}]` section found in CHANGELOG.md.\n"
    )
    out.write_bytes(fallback.encode("utf-8"))
    print(
        f"WARN: no [{ver}] section in CHANGELOG; wrote placeholder release_body.md",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
