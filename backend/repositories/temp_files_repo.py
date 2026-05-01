"""临时文件管理：聊天附件、agent 代码导出、experiment 包临时落盘。"""
from __future__ import annotations

import tempfile
import time
import uuid
from pathlib import Path
from typing import Union

_TEMP_DIR = Path(tempfile.gettempdir()) / 'cocovis_temp'
_TEMP_DIR.mkdir(exist_ok=True)
_temp_files: dict = {}  # {file_id: {'path': Path, 'filename': str, 'created': float}}


def temp_dir() -> Path:
    return _TEMP_DIR


def cleanup(max_age: int = 3600) -> None:
    now = time.time()
    for fid in list(_temp_files):
        info = _temp_files[fid]
        if now - info['created'] > max_age:
            try:
                info['path'].unlink(missing_ok=True)
            except Exception:
                pass
            _temp_files.pop(fid, None)


def save(content: Union[bytes, str], filename: str) -> str:
    cleanup()
    fid = uuid.uuid4().hex[:10]
    safe_name = Path(filename).name
    path = _TEMP_DIR / f'{fid}_{safe_name}'
    if isinstance(content, bytes):
        path.write_bytes(content)
    else:
        path.write_text(str(content), encoding='utf-8')
    _temp_files[fid] = {'path': path, 'filename': safe_name, 'created': time.time()}
    return fid


def get(file_id: str) -> dict | None:
    return _temp_files.get(file_id)


def register(file_id: str, path: Path, filename: str) -> None:
    """登记一个已写入磁盘的临时文件（供 sandbox 拦截 open() 使用）。"""
    _temp_files[file_id] = {'path': Path(path), 'filename': filename, 'created': time.time()}


def find_on_disk(file_id: str) -> dict | None:
    """Flask 重启后内存字典清空时，从磁盘扫描兜底。"""
    matches = sorted(_TEMP_DIR.glob(f'{file_id}_*'), key=lambda p: p.stat().st_mtime, reverse=True)
    if not matches:
        return None
    path = matches[0]
    filename = path.name[len(file_id) + 1:]
    info = {'path': path, 'filename': filename, 'created': path.stat().st_mtime}
    _temp_files[file_id] = info
    return info
