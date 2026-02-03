#!/usr/bin/env python3
"""
将前端依赖从 CDN 下载到 static/vendor/，实现离线使用。
在项目根目录执行: python3 packaging/fetch_vendor_js.py
"""
import urllib.request
import sys
from pathlib import Path

# 项目根目录（脚本在 packaging/ 下）
ROOT = Path(__file__).resolve().parent.parent
VENDOR_DIR = ROOT / 'static' / 'vendor'

# CDN URL -> 本地文件名
VENDOR_FILES = [
    ('https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js', 'react.production.min.js'),
    ('https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js', 'react-dom.production.min.js'),
    ('https://cdn.jsdelivr.net/npm/@babel/standalone@7/babel.min.js', 'babel.min.js'),
    ('https://cdn.jsdelivr.net/npm/plotly.js-dist@2.27.0/plotly.min.js', 'plotly.min.js'),
    ('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js', 'jszip.min.js'),
]


def main():
    VENDOR_DIR.mkdir(parents=True, exist_ok=True)
    failed = []
    for url, name in VENDOR_FILES:
        path = VENDOR_DIR / name
        if path.exists():
            print(f'Skip {name} (already exists)')
            continue
        print(f'Fetching {name} ...', end=' ', flush=True)
        for attempt in range(3):
            try:
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=45) as r:
                    data = r.read()
                path.write_bytes(data)
                print(f'OK ({len(data)} bytes)')
                break
            except Exception as e:
                if attempt < 2:
                    print(f'retry {attempt + 2}/3 ...', end=' ', flush=True)
                else:
                    print(f'FAIL: {e}')
                    failed.append(name)
    if failed:
        print(f'Failed: {", ".join(failed)}')
        sys.exit(1)
    print(f'Done. Vendor files in {VENDOR_DIR}')


if __name__ == '__main__':
    main()
