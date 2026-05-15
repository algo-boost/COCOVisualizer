"""应用元信息接口：当前版本号 & 检查 GitHub 上是否有新版。

- /api/app/version       返回 version.txt 中的版本号
- /api/app/check_update  调用 GitHub Releases API，比较版本并附带国内镜像直链

设计要点：
- 网络调用包在 try/except 里，失败静默返回 has_update=false，不影响主流程
- 结果缓存 30 分钟，避免每次刷新页面都打 GitHub
- 不依赖 requests，使用标准库 urllib
- ``releases/latest`` 在「仅有 Pre-release」时会 404，自动回退到 ``/releases`` 列表
"""
from __future__ import annotations

import json
import threading
import time
import urllib.error
import urllib.request

from flask import Blueprint, jsonify, request

from .. import config

bp = Blueprint('app_meta', __name__)


def _parse_semver(v: str) -> tuple[int, ...]:
    s = (v or '').strip().lstrip('vV')
    s = s.split('-', 1)[0].split('+', 1)[0]
    try:
        return tuple(int(p) for p in s.split('.'))
    except (ValueError, TypeError):
        return (0,)


def _is_newer(latest: str, current: str) -> bool:
    return _parse_semver(latest) > _parse_semver(current)


_CACHE: dict = {'ts': 0.0, 'data': None}
_CACHE_TTL = 30 * 60  # seconds
_LOCK = threading.Lock()


def _github_api_json(url: str) -> dict | list | None:
    """GET JSON；失败返回 None。"""
    req = urllib.request.Request(
        url,
        headers={
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'coco-visualizer-update-check',
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=config.UPDATE_CHECK_TIMEOUT) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError, ValueError):
        return None


def _fetch_latest_release() -> dict | None:
    """取「用于对比版本」的最新 Release。

    优先 ``/releases/latest``（仅含正式版）。若仓库只有 Pre-release（例如 CI 自动发版），
    GitHub 对该接口返回 404，此时回退到 ``/releases`` 列表的第一条非草稿记录。
    """
    repo = config.UPDATE_REPO
    if not repo:
        return None
    base = config.GITHUB_API_BASE
    latest_url = f'{base}/repos/{repo}/releases/latest'
    data = _github_api_json(latest_url)
    if isinstance(data, dict) and data.get('tag_name'):
        return data

    list_url = f'{base}/repos/{repo}/releases?per_page=40'
    lst = _github_api_json(list_url)
    if not isinstance(lst, list):
        return None
    for rel in lst:
        if not isinstance(rel, dict):
            continue
        if rel.get('draft'):
            continue
        if rel.get('tag_name'):
            return rel
    return None


def _build_mirrors(url: str) -> list[dict]:
    if not url:
        return []
    out: list[dict] = []
    for m in config.UPDATE_MIRRORS:
        if not m.get('prefix'):
            out.append({'name': m['name'], 'url': url})
        else:
            out.append({'name': m['name'], 'url': m['prefix'].rstrip('/') + '/' + url})
    return out


@bp.route('/api/app/version', methods=['GET'])
def get_version():
    return jsonify({
        'success': True,
        'version': config.APP_VERSION,
        'repo': config.UPDATE_REPO,
    })


@bp.route('/api/app/check_update', methods=['GET'])
def check_update():
    force = request.args.get('force') in ('1', 'true', 'yes')
    now = time.time()
    with _LOCK:
        if not force and _CACHE['data'] is not None and (now - _CACHE['ts'] < _CACHE_TTL):
            return jsonify(_CACHE['data'])

    data = _fetch_latest_release()
    current = config.APP_VERSION
    if not data:
        return jsonify({
            'success': False,
            'reason': 'network_or_empty' if config.UPDATE_REPO else 'no_repo',
            'current': current,
            'latest': None,
            'has_update': False,
            'repo': config.UPDATE_REPO,
            'release_url': f'https://github.com/{config.UPDATE_REPO}/releases' if config.UPDATE_REPO else '',
            'hint': (
                '无法访问 GitHub API。若在国内网络，可设置环境变量 '
                'COCO_VIZ_GITHUB_API_BASE=https://mirror.ghproxy.com/https://api.github.com 后重启；'
                '或点击下方链接在浏览器中查看 Releases。'
            ),
        })

    latest_tag = (data.get('tag_name') or '').lstrip('vV')
    html_url = data.get('html_url') or f'https://github.com/{config.UPDATE_REPO}/releases'

    assets: list[dict] = []
    for a in data.get('assets') or []:
        name = a.get('name', '') or ''
        url = a.get('browser_download_url', '') or ''
        nl = name.lower()
        kind = None
        if nl.endswith('.dmg'):
            kind = 'mac-dmg'
        elif nl.endswith('.exe'):
            kind = 'win-exe'
        elif nl.endswith('.zip') and 'windows' in nl:
            kind = 'win-zip'
        assets.append({
            'name': name,
            'url': url,
            'size': a.get('size'),
            'kind': kind,
            'mirrors': _build_mirrors(url),
        })

    result = {
        'success': True,
        'current': current,
        'latest': latest_tag,
        'has_update': _is_newer(latest_tag, current),
        'release_url': html_url,
        'release_url_mirrors': _build_mirrors(html_url),
        'release_body': data.get('body') or '',
        'published_at': data.get('published_at'),
        'assets': assets,
        'repo': config.UPDATE_REPO,
    }
    with _LOCK:
        _CACHE['ts'] = now
        _CACHE['data'] = result
    return jsonify(result)
