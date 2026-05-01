"""COCO 版本快照与 manifest 持久化。

存档目录 = COCO 文件同目录下的 .coco_visualizer/。
- {version_id}.json 为快照内容
- manifest.json 为按时间倒序的索引（最多 MAX_VERSIONS 条）
"""
from __future__ import annotations

import json
import shutil
from datetime import datetime
from pathlib import Path

from .. import config


def versions_dir(coco_json_path: str | Path) -> Path:
    return Path(coco_json_path).resolve().parent / config.VERSIONS_DIR_NAME


def manifest_path(coco_json_path: str | Path) -> Path:
    return versions_dir(coco_json_path) / 'manifest.json'


def version_file(coco_json_path: str | Path, version_id: str) -> Path:
    return versions_dir(coco_json_path) / f'{version_id}.json'


def save_version(coco_json_path: str | Path, coco_data: dict, comment: str | None = None) -> str:
    """生成一条版本快照。返回 version_id。

    主 COCO 文件由调用方独立写入，本函数仅写快照与 manifest。
    """
    version_id = datetime.now().strftime('%Y%m%d_%H%M%S')
    saved_at = datetime.now().isoformat()
    vdir = versions_dir(coco_json_path)
    vdir.mkdir(parents=True, exist_ok=True)
    vfile = version_file(coco_json_path, version_id)
    with open(vfile, 'w', encoding='utf-8') as f:
        json.dump(coco_data, f, indent=2, ensure_ascii=False)

    mpath = manifest_path(coco_json_path)
    if mpath.exists():
        with open(mpath, 'r', encoding='utf-8') as f:
            manifest = json.load(f)
    else:
        manifest = []

    is_first = len(manifest) == 0
    version_comment = (comment or '').strip() if comment else ''
    if is_first and not version_comment:
        version_comment = 'init'
    elif not version_comment:
        version_comment = f'保存于 {saved_at[:19].replace("T", " ")}'

    manifest.insert(0, {'id': version_id, 'saved_at': saved_at, 'comment': version_comment})
    to_remove = manifest[config.MAX_VERSIONS:]
    manifest = manifest[: config.MAX_VERSIONS]
    for old in to_remove:
        old_file = version_file(coco_json_path, old['id'])
        if old_file.exists():
            try:
                old_file.unlink()
            except Exception:
                pass

    with open(mpath, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    return version_id


def list_versions(coco_json_path: str | Path) -> list[dict]:
    mpath = manifest_path(coco_json_path)
    if not mpath.exists():
        return []
    with open(mpath, 'r', encoding='utf-8') as f:
        return json.load(f)


def rollback_to_version(coco_json_path: str | Path, version_id: str) -> None:
    vfile = version_file(coco_json_path, version_id)
    if not vfile.exists():
        raise FileNotFoundError(f'版本不存在: {version_id}')
    target = Path(coco_json_path).resolve()
    shutil.copy(vfile, target)
