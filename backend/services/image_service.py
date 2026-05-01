"""图片服务：路径解析、尺寸补全、目录扫描、预测文件发现。"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path

import numpy as np
import pandas as pd
from PIL import Image

from .. import config
from ..json_utils import safe_log, extract_bbox


def scan_dir_for_images(img_dir: str | Path) -> list[str]:
    img_dir = Path(img_dir)
    if not img_dir.is_dir():
        return []
    out = []
    try:
        for p in sorted(img_dir.iterdir()):
            if p.is_file() and not p.name.startswith('.') and p.suffix.lower() in config.IMAGE_EXTENSIONS:
                out.append(p.name)
    except Exception:
        pass
    return out


def ensure_coco_file(coco_path: str | Path) -> bool:
    """COCO 文件不存在则创建空白结构。返回 True=新建。"""
    p = Path(coco_path)
    if p.exists():
        return False
    empty = {
        'info': {'description': 'Auto-created by COCOVisualizer'},
        'images': [],
        'annotations': [],
        'categories': [],
    }
    try:
        with open(p, 'w', encoding='utf-8') as f:
            json.dump(empty, f, ensure_ascii=False, indent=2)
        return True
    except Exception as exc:  # noqa: BLE001
        safe_log(f'[warn] ensure_coco_file {p}: {exc}')
        return False


def sync_images_from_dir(coco_path: str | Path, image_dir: str | Path | None = None) -> tuple[int, int]:
    """目录下图片补充进 COCO 的 images。返回 (新增数量, 总图片数)。"""
    coco_path = Path(coco_path).resolve()
    img_dir = Path(image_dir).resolve() if image_dir else coco_path.parent
    if not img_dir.is_dir():
        return 0, 0
    try:
        with open(coco_path, 'r', encoding='utf-8') as f:
            coco_data = json.load(f)
    except Exception:
        coco_data = {'images': [], 'annotations': [], 'categories': []}

    existing = {img['file_name'] for img in coco_data.get('images', [])}
    max_id = max((img.get('id', 0) for img in coco_data.get('images', [])), default=0)
    image_files = scan_dir_for_images(img_dir)

    added = []
    for fname in image_files:
        if fname in existing:
            continue
        w, h = 0, 0
        try:
            with Image.open(img_dir / fname) as im:
                w, h = im.size
        except Exception:
            pass
        max_id += 1
        added.append({'id': max_id, 'file_name': fname, 'width': int(w), 'height': int(h)})

    if not added:
        return 0, len(coco_data.get('images', []))
    coco_data.setdefault('images', []).extend(added)
    coco_data.setdefault('annotations', [])
    coco_data.setdefault('categories', [])
    try:
        with open(coco_path, 'w', encoding='utf-8') as f:
            json.dump(coco_data, f, ensure_ascii=False, indent=2)
        safe_log(f'[info] sync_images_from_dir: +{len(added)} images → {coco_path}')
    except Exception as exc:  # noqa: BLE001
        safe_log(f'[warn] sync_images_from_dir write {coco_path}: {exc}')
        return 0, len(coco_data.get('images', []))
    return len(added), len(coco_data['images'])


def scan_folder_for_coco(root_path: str | Path) -> list[dict]:
    """递归扫描 _annotations.coco.json；并为只有图片的目录自动建 COCO。"""
    root = Path(root_path).resolve()
    if not root.exists() or not root.is_dir():
        return []
    items: list[dict] = []
    try:
        for p in root.rglob(config.COCO_ANNOTATION_FILENAME):
            if p.is_file():
                ensure_coco_file(str(p))
                sync_images_from_dir(str(p), str(p.parent))
                coco_path = str(p.resolve())
                image_dir = str(p.parent.resolve())
                try:
                    rel = p.parent.relative_to(root)
                    relative_path = str(rel) if rel != Path('.') else ''
                except ValueError:
                    relative_path = str(p.parent.name)
                items.append({
                    'coco_path': coco_path,
                    'image_dir': image_dir,
                    'relative_path': relative_path or p.parent.name,
                })
    except Exception:
        pass

    found_dirs = {str(Path(it['image_dir']).resolve()) for it in items}
    try:
        for dirpath, dirnames, filenames in os.walk(str(root)):
            dirnames[:] = [d for d in sorted(dirnames) if not d.startswith('.')]
            dir_p = Path(dirpath).resolve()
            if str(dir_p) in found_dirs:
                continue
            img_files = [
                f for f in filenames
                if not f.startswith('.') and Path(f).suffix.lower() in config.IMAGE_EXTENSIONS
            ]
            if not img_files:
                continue
            coco_p = dir_p / config.COCO_ANNOTATION_FILENAME
            ensure_coco_file(str(coco_p))
            sync_images_from_dir(str(coco_p))
            try:
                rel = dir_p.relative_to(root)
                relative_path = str(rel) if rel != Path('.') else ''
            except ValueError:
                relative_path = dir_p.name
            items.append({
                'coco_path': str(coco_p),
                'image_dir': str(dir_p),
                'relative_path': relative_path or dir_p.name,
                'auto_created': True,
                'num_images': len(img_files),
            })
            found_dirs.add(str(dir_p))
    except Exception as exc:  # noqa: BLE001
        safe_log(f'[warn] scan image-only dirs: {exc}')

    return items


def resolve_image_path(eda, row) -> Path | None:
    """根据 eda 与 images_df 的一行解析图片绝对路径。"""
    image_dir = eda.image_dir
    if getattr(eda, 'source_dirs', None) and row.get('source_path') is not None:
        image_dir = eda.source_dirs.get(str(row['source_path']), image_dir) or image_dir
    if not image_dir:
        image_dir = str(Path(eda.coco_json_path).parent)
    file_name = row.get('file_name')
    if not file_name:
        return None
    fp = Path(file_name)
    path = fp if fp.is_absolute() else Path(image_dir) / file_name
    if path.exists():
        return path
    for alt in (Path(eda.coco_json_path).parent / file_name, Path(image_dir) / Path(file_name).name):
        if alt.exists():
            return alt
    return None


def fill_image_dimensions(eda) -> None:
    """缺少 width/height 的图片用 Pillow 读出并写回 images_df。"""
    if eda.images_df.empty or 'file_name' not in eda.images_df.columns:
        return
    for col in ('width', 'height'):
        if col not in eda.images_df.columns:
            eda.images_df[col] = np.nan
    for idx, row in eda.images_df.iterrows():
        w, h = row.get('width'), row.get('height')
        if pd.notna(w) and pd.notna(h) and int(w) > 0 and int(h) > 0:
            continue
        path = resolve_image_path(eda, row)
        if path is None:
            continue
        try:
            with Image.open(path) as im:
                w, h = im.size
            eda.images_df.at[idx, 'width'] = int(w)
            eda.images_df.at[idx, 'height'] = int(h)
        except Exception:
            pass


def find_pred_files(coco_dir: str | Path) -> list[dict]:
    """扫描预测 COCO 文件 _annotations.{model}.pred.coco.json。"""
    out = []
    d = Path(coco_dir)
    if not d.is_dir():
        return out
    try:
        for p in d.iterdir():
            if p.is_file():
                m = config.PRED_ANNOTATION_PATTERN.match(p.name)
                if m:
                    out.append({'path': str(p), 'model_name': m.group(1)})
    except Exception:
        pass
    return out


def load_pred_annotations(pred_path: str | Path, model_name: str) -> dict[str, list[dict]]:
    """从预测 COCO 加载 file_name → [ann] 映射。"""
    try:
        with open(pred_path, 'r', encoding='utf-8') as f:
            pred_coco = json.load(f)
        cats = {c['id']: c['name'] for c in pred_coco.get('categories', [])}
        img_id_to_fname = {img['id']: img['file_name'] for img in pred_coco.get('images', [])}
        out: dict[str, list[dict]] = {}
        for ann in pred_coco.get('annotations', []):
            fname = img_id_to_fname.get(ann.get('image_id'))
            if not fname:
                continue
            bbox = extract_bbox(ann.get('bbox'))
            if not bbox or len(bbox) < 4:
                continue
            pred_ann = {
                'category': cats.get(ann.get('category_id'), 'unknown'),
                'bbox': bbox,
                '_pred_source': model_name,
            }
            if ann.get('score') is not None:
                pred_ann['score'] = float(ann['score'])
            out.setdefault(fname, []).append(pred_ann)
        return out
    except Exception:
        return {}


def save_uploaded_drop_bundle(files, paths) -> tuple[Path, int]:
    """保留相对层级，把拖拽上传的文件集合写入 uploads/drop_<ts>/。"""
    if not files:
        raise ValueError('没有可上传的文件')
    if paths and len(paths) != len(files):
        raise ValueError('上传参数不一致')
    bundle_name = f'drop_{int(time.time() * 1000)}'
    bundle_root = (config.UPLOAD_FOLDER / bundle_name).resolve()
    bundle_root.mkdir(parents=True, exist_ok=True)

    saved = 0
    for idx, f in enumerate(files):
        rel_path = (paths[idx] if idx < len(paths) else '') or f.filename or ''
        rel_path = rel_path.replace('\\', '/').strip().lstrip('/').replace('..', '')
        if not rel_path:
            rel_path = f'file_{idx}'
        target = (bundle_root / rel_path).resolve()
        try:
            target.relative_to(bundle_root)
        except Exception:
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        f.save(str(target))
        saved += 1
    if saved == 0:
        raise ValueError('未保存任何文件')
    return bundle_root, saved
