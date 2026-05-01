"""COCOVisualizer 入口（极简）。

业务逻辑全部在 backend/ 包内（Blueprint + Service + Repository）。
此文件仅负责：
1. 通过工厂函数 create_app() 构建 Flask app。
2. 启动时重载已启用的自定义 Agent 模块。
3. PyInstaller frozen 模式与开发模式共用启动参数。
"""
from __future__ import annotations

import os
import sys
import threading
import webbrowser

from backend import create_app, reload_agent_modules_at_startup


app = create_app()
reload_agent_modules_at_startup()


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(add_help=True)
    parser.add_argument(
        '--port', type=int,
        default=int(os.environ.get('COCO_VIZ_PORT', '6010')),
        help='HTTP 端口（也可用环境变量 COCO_VIZ_PORT）',
    )
    parser.add_argument(
        '--open-browser', action='store_true',
        help='启动后自动在本机打开浏览器（与打包版行为一致）',
    )
    args, _unknown = parser.parse_known_args()
    port = args.port
    url = f'http://127.0.0.1:{port}'

    print('')
    print(f'请在浏览器中访问: http://127.0.0.1:{port} 或 http://localhost:{port}')
    print('（本机其他设备可用局域网 IP，见下方 "Running on" 行）')
    print('')

    if getattr(sys, 'frozen', False) or args.open_browser:
        def _open_browser():
            import time
            time.sleep(1.5)
            webbrowser.open(url)

        threading.Thread(target=_open_browser, daemon=True).start()

    app.run(
        debug=not getattr(sys, 'frozen', False),
        host='0.0.0.0',
        port=port,
        use_reloader=False,
        threaded=True,
    )
