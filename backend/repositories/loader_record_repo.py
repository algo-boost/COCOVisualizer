"""与 COCO 同目录的 _coco_visualizer_last.json 读写。"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Optional

from .. import config


def write_record(coco_json_path: str | Path, dataset_name: str, image_dir: str | None) -> None:
    p = Path(coco_json_path).resolve()
    if not p.is_file():
        return
    record_path = p.parent / config.LOADER_RECORD_FILENAME
    record = {
        'coco_file': p.name,
        'dataset_name': dataset_name or 'dataset',
        'image_dir': image_dir or '',
        'saved_at': datetime.now().isoformat(),
    }
    try:
        with open(record_path, 'w', encoding='utf-8') as f:
            json.dump(record, f, indent=2, ensure_ascii=False)
    except Exception:
        pass


def read_record(coco_dir: str | Path) -> Optional[dict]:
    d = Path(coco_dir).resolve()
    record_path = d / config.LOADER_RECORD_FILENAME
    if not record_path.is_file():
        return None
    try:
        with open(record_path, 'r', encoding='utf-8') as f:
            record = json.load(f)
        coco_file = record.get('coco_file')
        if not coco_file:
            return None
        coco_path = d / coco_file
        if not coco_path.exists():
            return None
        return {
            'coco_json_path': str(coco_path),
            'dataset_name': record.get('dataset_name', 'dataset'),
            'image_dir': record.get('image_dir', ''),
            'saved_at': record.get('saved_at', ''),
        }
    except Exception:
        return None
