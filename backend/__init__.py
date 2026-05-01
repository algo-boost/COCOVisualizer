"""COCOVisualizer backend application factory."""
from __future__ import annotations

import json
import sys

from flask import Flask, render_template, send_from_directory
from flask_cors import CORS

from . import config


def _load_vite_manifest() -> dict | None:
    """检查 static/dist/.vite/manifest.json，返回供 Jinja 使用的 entry/css 列表。

    Vite 5 默认把 manifest 写到 .vite/manifest.json；为兼容旧版也兼读 dist/manifest.json。
    若两者都不存在，返回 None，模板回退到旧的 Babel-in-browser 模式。
    """
    dist_dir = config.STATIC_FOLDER / 'dist'
    candidates = [
        dist_dir / '.vite' / 'manifest.json',
        dist_dir / 'manifest.json',
    ]
    manifest_path = next((p for p in candidates if p.exists()), None)
    if manifest_path is None:
        return None
    try:
        manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    except Exception as exc:  # noqa: BLE001
        print(f'[警告] 解析 Vite manifest 失败：{exc}', file=sys.stderr)
        return None

    entry_key = next(
        (k for k, v in manifest.items() if isinstance(v, dict) and v.get('isEntry')),
        None,
    )
    if entry_key is None:
        return None
    entry_meta = manifest[entry_key]

    def _collect_css(key: str, seen: set[str]) -> list[str]:
        meta = manifest.get(key) or {}
        out: list[str] = []
        for css in meta.get('css', []) or []:
            if css not in seen:
                seen.add(css)
                out.append(css)
        for imp in meta.get('imports', []) or []:
            out.extend(_collect_css(imp, seen))
        return out

    seen_css: set[str] = set()
    css_files = _collect_css(entry_key, seen_css)
    return {'entry': entry_meta.get('file', entry_key), 'css': css_files}


def create_app() -> Flask:
    """构建并返回 Flask 应用。所有 Blueprint 在此注册。"""
    app = Flask(
        __name__.split('.')[0] + '_app',
        template_folder=str(config.TEMPLATE_FOLDER),
        static_folder=str(config.STATIC_FOLDER),
    )
    CORS(app)

    app.config['UPLOAD_FOLDER'] = str(config.UPLOAD_FOLDER)
    app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB
    app.config['VITE_ASSETS'] = _load_vite_manifest()

    from .blueprints import register_blueprints
    register_blueprints(app)

    @app.route('/')
    def index():
        return render_template('index.html', vite_assets=app.config.get('VITE_ASSETS'))

    @app.route('/static/dist/<path:filename>')
    def serve_dist(filename: str):
        dist_dir = config.STATIC_FOLDER / 'dist'
        return send_from_directory(str(dist_dir), filename)

    return app


def reload_agent_modules_at_startup() -> None:
    """启动时重载已启用的 Agent 模块。

    放在 create_app 之外，避免在测试或脚本里强制副作用。
    """
    try:
        from .services import agent_service
        agent_service.reload_enabled_modules()
    except Exception as exc:  # noqa: BLE001
        print(f'[警告] 重载 agent 模块失败：{exc}', file=sys.stderr)
