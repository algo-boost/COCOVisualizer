"""Flask Blueprint 注册：每个领域一个 bp。"""
from __future__ import annotations

from flask import Flask


def register_blueprints(app: Flask, url_prefix: str = '') -> None:
    from .uploads_bp import bp as uploads_bp
    from .datasets_bp import bp as datasets_bp
    from .images_bp import bp as images_bp
    from .annotations_bp import bp as annotations_bp
    from .versions_bp import bp as versions_bp
    from .export_bp import bp as export_bp
    from .agent_modules_bp import bp as agent_modules_bp
    from .chat_bp import bp as chat_bp
    from .app_meta_bp import bp as app_meta_bp

    for bp in (
        uploads_bp, datasets_bp, images_bp, annotations_bp,
        versions_bp, export_bp, agent_modules_bp, chat_bp,
        app_meta_bp,
    ):
        app.register_blueprint(bp, url_prefix=url_prefix)
