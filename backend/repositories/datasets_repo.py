"""data/datasets.json 的 CRUD。

数据形态：
    { "<dataset_id>": {"coco_json_path": str, "dataset_name": str, "image_dir": str}, ... }
"""
from __future__ import annotations

import json
from typing import Optional

from .. import config


def _path():
    return config.DATASETS_MAP_FILE


def persist(dataset_id: str, coco_json_path: str, dataset_name: str = 'dataset', image_dir: Optional[str] = None) -> None:
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = _path()
    data: dict = {}
    if path.exists():
        try:
            with open(path, 'r', encoding='utf-8') as f:
                loaded = json.load(f)
                if isinstance(loaded, dict):
                    data = loaded
        except Exception:
            pass
    data[dataset_id] = {
        'coco_json_path': str(coco_json_path),
        'dataset_name': dataset_name or 'dataset',
        'image_dir': image_dir or '',
    }
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def get_info(dataset_id: str) -> Optional[dict]:
    path = _path()
    if not path.exists():
        return None
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return None
        return data.get(dataset_id)
    except Exception:
        return None
