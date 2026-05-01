#!/usr/bin/env python3
"""在本机启动 COCOVisualizer，可选加载指定 COCO 目录/JSON 后打开浏览器。

与用户说法对应：用户说「查看 <某目录> coco」时，将 <某目录> 作为本脚本第一个参数即可。

用法:
  python3 scripts/coco_viz_launch.py /path/to/dataset_or_coco.json
  python3 scripts/coco_viz_launch.py /path/to/coco_dir --image-dir /path/to/images
  python3 scripts/coco_viz_launch.py /path --port 6011 --no-open-browser
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path


def _repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def _server_responds(port: int, timeout: float = 1.0) -> bool:
    try:
        req = urllib.request.Request(f'http://127.0.0.1:{port}/', method='GET')
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status == 200
    except (urllib.error.URLError, OSError, TimeoutError, ValueError):
        return False


def _post_json(url: str, payload: dict, timeout: float = 600.0) -> tuple[int, str]:
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=data,
        method='POST',
        headers={'Content-Type': 'application/json; charset=utf-8'},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = resp.read().decode('utf-8', errors='replace')
        return resp.status, body


def main() -> int:
    ap = argparse.ArgumentParser(description='启动 COCOVisualizer 并可选加载数据集')
    ap.add_argument(
        'coco_path',
        nargs='?',
        default='',
        help='COCO 目录（内含 _annotations.coco.json）或 .json 文件路径',
    )
    ap.add_argument('--image-dir', default='', help='图片目录（可空，默认由服务端推断）')
    ap.add_argument('--dataset-name', default='dataset', help='数据集显示名')
    ap.add_argument('--port', type=int, default=int(os.environ.get('COCO_VIZ_PORT', '6010')))
    ap.add_argument('--no-open-browser', action='store_true')
    ap.add_argument('--start-timeout', type=float, default=45.0, help='等待服务就绪的最长时间（秒）')
    args = ap.parse_args()

    root = _repo_root()
    app_py = root / 'app.py'
    if not app_py.is_file():
        print(f'找不到 app.py: {app_py}', file=sys.stderr)
        return 1

    port = args.port
    base = f'http://127.0.0.1:{port}'
    started = False
    proc: subprocess.Popen | None = None

    if not _server_responds(port, timeout=0.8):
        proc = subprocess.Popen(
            [sys.executable, str(app_py), '--port', str(port)],
            cwd=str(root),
            stdout=None,
            stderr=None,
        )
        started = True
        deadline = time.monotonic() + args.start_timeout
        while time.monotonic() < deadline:
            if proc.poll() is not None:
                print(f'服务进程已退出，code={proc.returncode}', file=sys.stderr)
                return 1
            if _server_responds(port, timeout=1.0):
                break
            time.sleep(0.35)
        else:
            print(f'在 {args.start_timeout}s 内未能连上 {base}', file=sys.stderr)
            if proc and proc.poll() is None:
                proc.terminate()
            return 1

    if args.coco_path.strip():
        coco_abs = str(Path(args.coco_path).expanduser().resolve())
        image_dir = str(Path(args.image_dir).expanduser().resolve()) if args.image_dir.strip() else ''
        load_url = f'{base}/api/load_dataset'
        try:
            status, body = _post_json(
                load_url,
                {
                    'coco_json_path': coco_abs,
                    'image_dir': image_dir,
                    'dataset_name': args.dataset_name or 'dataset',
                },
            )
        except urllib.error.HTTPError as e:
            err = e.read().decode('utf-8', errors='replace') if e.fp else str(e)
            print(f'加载数据集失败 HTTP {e.code}: {err}', file=sys.stderr)
            return 1
        except Exception as e:
            print(f'加载数据集失败: {e}', file=sys.stderr)
            return 1
        if status != 200:
            print(f'加载数据集失败: HTTP {status} {body[:2000]}', file=sys.stderr)
            return 1

    if not args.no_open_browser:
        webbrowser.open(base)

    if started and proc is not None:
        print(f'COCOVisualizer 已在后台运行: {base}（进程 pid={proc.pid}）')
        print('停止服务: 结束该 Python 进程或关闭此终端会话。')
    else:
        print(f'检测到已有服务在 {base}；已尝试加载数据并打开浏览器。')

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
