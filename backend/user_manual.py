"""从 ``docs/用户手册.md`` 拆章节并转为 HTML，供应用内「使用手册」与打包版共用。"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any

_MD_EXTENSIONS = ('extra', 'tables', 'sane_lists', 'nl2br')


def split_user_manual_markdown(raw: str) -> list[dict[str, str]]:
    """按 ``## N. 标题`` 主章节拆分；其前内容归为 id ``0``（前言与目录）。"""
    raw = raw.replace('\r\n', '\n').strip()
    if not raw:
        return []
    pattern = re.compile(r'\n(?=## \d+\.\s)')
    chunks = pattern.split(raw)
    sections: list[dict[str, str]] = []
    for body in chunks:
        body = body.strip()
        if not body:
            continue
        m = re.match(r'^## (\d+)\.\s*([^\n]+)', body)
        if m:
            sid = m.group(1)
            label = m.group(2).strip()
        else:
            sid = '0'
            label = '前言与目录'
        sections.append({'id': sid, 'label': label, 'markdown': body})
    return sections


def render_user_manual_sections(path: Path) -> list[dict[str, Any]]:
    """读取 Markdown 文件，返回 ``[{id, label, html}, ...]``。"""
    try:
        import markdown
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError('缺少依赖 markdown，请 pip install markdown') from exc

    raw = path.read_text(encoding='utf-8')
    parts = split_user_manual_markdown(raw)
    if not parts:
        return []

    md = markdown.Markdown(extensions=list(_MD_EXTENSIONS))
    out: list[dict[str, Any]] = []
    for p in parts:
        md.reset()
        html = md.convert(p['markdown'])
        out.append({'id': p['id'], 'label': p['label'], 'html': html})
    return out
