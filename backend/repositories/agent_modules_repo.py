"""agent_modules.json 与 agent_skills.json 持久化。

skill 项中的 path / scripts / configs 在写入时转为 data/ 相对路径，
读取时再展开为绝对路径，便于跨机器迁移。
"""
from __future__ import annotations

import copy
import json
import os
from pathlib import Path
from typing import Iterable

from .. import config


# ---------- agent_modules.json ----------

def load_modules() -> list[dict]:
    path = config.AGENT_MODULES_MAP_FILE
    if not path.exists():
        return []
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except Exception:
        return []


def save_modules(items: Iterable[dict]) -> None:
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(config.AGENT_MODULES_MAP_FILE, 'w', encoding='utf-8') as f:
        json.dump(list(items), f, indent=2, ensure_ascii=False)


# ---------- agent_skills.json ----------

def _path_to_data_relative(path_str: str) -> str:
    if not path_str:
        return path_str
    try:
        p = Path(path_str).expanduser().resolve()
        dr = config.DATA_DIR.resolve()
        if p == dr or str(p).startswith(str(dr) + os.sep):
            return str(p.relative_to(dr)).replace('\\', '/')
    except (OSError, ValueError):
        pass
    return path_str


def _path_from_data_relative(path_str: str) -> str:
    if not path_str:
        return path_str
    p = Path(path_str)
    if p.is_absolute():
        return str(p.resolve())
    return str((config.DATA_DIR / path_str).resolve())


def _serialize_skill(item: dict) -> dict:
    it = copy.deepcopy(item)
    for k in ('path', 'skill_dir'):
        if it.get(k):
            it[k] = _path_to_data_relative(it[k])
    for sp in it.get('scripts') or []:
        if isinstance(sp, dict) and sp.get('path'):
            sp['path'] = _path_to_data_relative(sp['path'])
    for c in it.get('configs') or []:
        if isinstance(c, dict) and c.get('path'):
            c['path'] = _path_to_data_relative(c['path'])
    return it


def _hydrate_skill(item: dict) -> dict:
    it = copy.deepcopy(item)
    for k in ('path', 'skill_dir'):
        if it.get(k):
            it[k] = _path_from_data_relative(it[k])
    for sp in it.get('scripts') or []:
        if isinstance(sp, dict) and sp.get('path'):
            sp['path'] = _path_from_data_relative(sp['path'])
    for c in it.get('configs') or []:
        if isinstance(c, dict) and c.get('path'):
            c['path'] = _path_from_data_relative(c['path'])
    return it


def load_skills() -> list[dict]:
    path = config.AGENT_SKILLS_MAP_FILE
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
        lst = data if isinstance(data, list) else []
        return [_hydrate_skill(x) for x in lst if isinstance(x, dict)]
    except Exception:
        return []


def save_skills(items: Iterable[dict]) -> None:
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    serialized = [_serialize_skill(x) for x in items if isinstance(x, dict)]
    config.AGENT_SKILLS_MAP_FILE.write_text(
        json.dumps(serialized, ensure_ascii=False, indent=2),
        encoding='utf-8',
    )
