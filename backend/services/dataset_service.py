"""数据集服务：注册/懒加载、合并、统一 EDA payload 构建、元数据筛选。

将原 app.py 中 load_dataset 与 _load_dataset_merged_impl 的重复 payload 构建合并到
build_eda_payload 中，消除最大的代码重复块。
"""
from __future__ import annotations

import hashlib
import json
import math
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

import numpy as np
import pandas as pd

from .. import config
from ..json_utils import safe_log, safe_float, safe_tolist, safe_score_tolist, json_sanitize
from ..repositories import datasets_repo, versions_repo, loader_record_repo
from . import image_service
from .coco_eda import CocoEDA


# ---------- 内存中的数据集注册 ----------

_current_datasets: dict[str, CocoEDA] = {}


def get_in_memory(dataset_id: str) -> CocoEDA | None:
    return _current_datasets.get(dataset_id)


def register_dataset(eda: CocoEDA, dataset_name: str = 'dataset') -> str:
    dataset_id = f"{dataset_name}_{len(_current_datasets)}"
    _current_datasets[dataset_id] = eda
    return dataset_id


def replace_in_memory(dataset_id: str, eda: CocoEDA) -> None:
    _current_datasets[dataset_id] = eda


def ensure_loaded(dataset_id: str | None) -> CocoEDA | None:
    """从内存或 datasets.json 懒加载。"""
    if not dataset_id:
        return None
    if dataset_id in _current_datasets:
        return _current_datasets[dataset_id]
    info = datasets_repo.get_info(dataset_id)
    if not info:
        return None
    coco_path = Path(info.get('coco_json_path', ''))
    if not coco_path.exists():
        return None
    name = info.get('dataset_name', 'dataset')
    image_dir = info.get('image_dir') or None
    eda = CocoEDA(coco_json_path=str(coco_path), name=name, image_dir=image_dir)
    with open(coco_path, 'r', encoding='utf-8') as f:
        coco_data = json.load(f)
    if isinstance(coco_data.get('source_dirs'), dict):
        eda.source_dirs = coco_data['source_dirs']
    if isinstance(coco_data.get('source_coco_paths'), dict):
        eda.source_coco_paths = coco_data['source_coco_paths']
    image_service.fill_image_dimensions(eda)
    _current_datasets[dataset_id] = eda
    return eda


# ---------- COCO 数据增强 / 派生统计 ----------

def add_normalized_bbox_stats(eda: CocoEDA, df: pd.DataFrame) -> pd.DataFrame:
    """在 bbox 特征 df 上合并图像尺寸并增加归一化列（0–1）。"""
    if df.empty or 'image_id' not in df.columns:
        return df
    if 'width' not in eda.images_df.columns or 'height' not in eda.images_df.columns:
        return df
    img_cols = ['id', 'width', 'height']
    if 'file_name' in eda.images_df.columns:
        img_cols.append('file_name')
    imgs = eda.images_df[img_cols].rename(columns={'id': 'image_id', 'width': 'img_w', 'height': 'img_h'})
    df = df.merge(imgs, on='image_id', how='left')
    df['img_w'] = df['img_w'].replace(0, np.nan)
    df['img_h'] = df['img_h'].replace(0, np.nan)
    df['img_area'] = df['img_w'] * df['img_h']
    df['img_area'] = df['img_area'].replace(0, np.nan)
    df['img_max_side'] = np.maximum(df['img_w'].fillna(0), df['img_h'].fillna(0))
    df['img_max_side'] = df['img_max_side'].replace(0, np.nan)
    df['img_min_side'] = np.minimum(df['img_w'].fillna(np.inf), df['img_h'].fillna(np.inf))
    df['img_min_side'] = df['img_min_side'].replace(np.inf, np.nan)
    df['w_norm'] = df['w'] / df['img_w']
    df['h_norm'] = df['h'] / df['img_h']
    df['area_norm'] = df['area'] / df['img_area']
    df['sqrt_area_norm'] = np.sqrt(np.maximum(df['area_norm'], 0))
    df['max_side_norm'] = df['max_side'] / df['img_max_side']
    df['min_side_norm'] = df['min_side'] / df['img_min_side']
    df['c_x_norm'] = df['c_x'] / df['img_w']
    df['c_y_norm'] = df['c_y'] / df['img_h']
    return df


# ---------- 图片分类定义推断 ----------

def infer_image_category_definitions(coco_data: dict) -> Optional[dict]:
    """从 COCO images 推断图片分类定义；保留已存在的 categories/colors/multi_select。"""
    if not isinstance(coco_data, dict):
        return None
    images = coco_data.get('images') or []
    if not isinstance(images, list):
        images = []

    existing = coco_data.get('image_category_definitions') or {}
    existing_cats = existing.get('categories') if isinstance(existing, dict) else None
    existing_colors = existing.get('colors') if isinstance(existing, dict) else None
    existing_multi = existing.get('multi_select') if isinstance(existing, dict) else None

    collected = []
    for img in images:
        if not isinstance(img, dict):
            continue
        cats = img.get('image_categories')
        if isinstance(cats, str):
            try:
                parsed = json.loads(cats) if cats.strip() else []
                cats = parsed if isinstance(parsed, list) else [cats]
            except Exception:
                cats = [cats]
        if isinstance(cats, (list, tuple)):
            for c in cats:
                s = str(c).strip()
                if s:
                    collected.append(s)
        else:
            single = img.get('image_category')
            s = str(single).strip() if single is not None else ''
            if s:
                collected.append(s)

    explicit_in_file = isinstance(existing_cats, list) and len(existing_cats) > 0
    if not explicit_in_file and len(collected) == 0:
        return None

    seen: set[str] = set()
    base = []
    if isinstance(existing_cats, list):
        base.extend([str(x).strip() for x in existing_cats if str(x).strip()])
    base.extend(collected)
    ordered = []
    for c in base:
        if c not in seen:
            seen.add(c)
            ordered.append(c)
    if '未分类' in seen:
        ordered = ['未分类'] + [c for c in ordered if c != '未分类']
    else:
        ordered = ['未分类'] + ordered

    colors = existing_colors if isinstance(existing_colors, dict) else {}
    out_colors = {c: colors[c] for c in ordered if c in colors and isinstance(colors[c], str) and colors[c].strip()}
    return {
        'categories': ordered,
        'colors': out_colors,
        'multi_select': bool(existing_multi) if existing_multi is not None else False,
    }


# ---------- 元数据筛选 ----------

def _parse_c_time(s):
    if s is None or (isinstance(s, float) and math.isnan(s)):
        return None
    s = str(s).strip()
    if not s:
        return None
    for fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M', '%Y-%m-%d'):
        try:
            return datetime.strptime(s[:19].replace('T', ' '), fmt)
        except (ValueError, TypeError):
            continue
    return None


def _normalize_meta_filter_mapping(mapping: Any) -> dict:
    m = mapping if isinstance(mapping, dict) else {}

    def _pick(key, default):
        v = m.get(key, default)
        v = str(v).strip() if v is not None else ''
        return v or default

    return {
        'c_time': _pick('c_time', 'c_time'),
        'product_id': _pick('product_id', 'product_id'),
        'position': _pick('position', 'position'),
    }


def apply_image_meta_filters(
    images_df: pd.DataFrame,
    *,
    c_time_start=None,
    c_time_end=None,
    product_id_query=None,
    position=None,
    meta_filter_mapping=None,
) -> set[int]:
    if images_df.empty or 'id' not in images_df.columns:
        return set()
    allowed = set(images_df['id'].astype(int).tolist())
    fm = _normalize_meta_filter_mapping(meta_filter_mapping)

    if (c_time_start is not None or c_time_end is not None) and fm['c_time'] in images_df.columns:
        col = fm['c_time']

        def in_range(row):
            t = _parse_c_time(row.get(col))
            if t is None:
                return False
            if c_time_start is not None:
                start = _parse_c_time(c_time_start) if isinstance(c_time_start, str) else c_time_start
                if start is not None and t < start:
                    return False
            if c_time_end is not None:
                end = _parse_c_time(c_time_end) if isinstance(c_time_end, str) else c_time_end
                if end is not None and t > end:
                    return False
            return True

        mask = images_df.apply(in_range, axis=1)
        allowed &= set(images_df.loc[mask, 'id'].astype(int).tolist())

    if product_id_query and str(product_id_query).strip() and fm['product_id'] in images_df.columns:
        q = str(product_id_query).strip().lower()
        col = fm['product_id']

        def match(row):
            pid = row.get(col)
            if pid is None or (isinstance(pid, float) and math.isnan(pid)):
                return False
            return q in str(pid).lower()

        mask = images_df.apply(match, axis=1)
        allowed &= set(images_df.loc[mask, 'id'].astype(int).tolist())

    if position and str(position).strip() and fm['position'] in images_df.columns:
        pos_val = str(position).strip()
        col = fm['position']

        def match(row):
            p = row.get(col)
            if p is None or (isinstance(p, float) and math.isnan(p)):
                return False
            return str(p).strip() == pos_val

        mask = images_df.apply(match, axis=1)
        allowed &= set(images_df.loc[mask, 'id'].astype(int).tolist())

    return allowed


def build_meta_filter_options(images_df: pd.DataFrame, meta_filter_mapping=None) -> dict:
    fm = _normalize_meta_filter_mapping(meta_filter_mapping)
    opts = {
        'has_c_time': fm['c_time'] in images_df.columns,
        'has_product_id': fm['product_id'] in images_df.columns,
        'has_position': fm['position'] in images_df.columns,
        'c_time_field': fm['c_time'],
        'product_id_field': fm['product_id'],
        'position_field': fm['position'],
        'c_time_label': fm['c_time'],
        'product_id_label': fm['product_id'],
        'position_label': fm['position'],
        'positions': [],
        'product_ids': [],
        'c_time_min': None,
        'c_time_max': None,
    }
    if images_df.empty:
        return opts
    if opts['has_position']:
        positions = images_df[fm['position']].dropna().astype(str).str.strip()
        opts['positions'] = sorted(positions.unique().tolist())
    if opts['has_product_id']:
        pids = images_df[fm['product_id']].dropna().astype(str).str.strip()
        pids = pids[pids.str.len() > 0].unique().tolist()
        opts['product_ids'] = sorted(pids)[: config.META_FILTER_PRODUCT_IDS_LIMIT]
    if opts['has_c_time']:
        times = []
        for v in images_df[fm['c_time']].dropna():
            t = _parse_c_time(v)
            if t is not None:
                times.append(t)
        if times:
            opts['c_time_min'] = min(times).strftime('%Y-%m-%dT%H:%M:%S')
            opts['c_time_max'] = max(times).strftime('%Y-%m-%dT%H:%M:%S')
    return opts


# ---------- 统一 EDA payload 构建（消除 load_dataset 与 merged 的重复）----------

def _score_streams(df: pd.DataFrame) -> tuple[list[str], list[float]]:
    cats: list[str] = []
    vals: list[float] = []
    if 'score' not in df.columns:
        return cats, vals
    for _, row in df.iterrows():
        v = safe_float(row.get('score'))
        if v is None or math.isinf(v):
            continue
        if 0 <= v <= 1:
            vals.append(v)
        elif 0 <= v <= 100:
            vals.append(v / 100.0)
        else:
            vals.append(v)
        cats.append(row.get('name', ''))
    return cats, vals


def _stat_block(df: pd.DataFrame, value_col: str, *, with_xy: bool = False, x_col: str = '', y_col: str = '', with_image_id: bool = False) -> dict:
    """Build a {category, values, [image_id], [file_name]} block, defaulting to []."""
    name_list = df['name'].tolist() if 'name' in df.columns else []
    block: dict = {'category': name_list}
    if with_xy:
        block['x'] = safe_tolist(df[x_col]) if x_col in df.columns else []
        block['y'] = safe_tolist(df[y_col]) if y_col in df.columns else []
    else:
        block['values'] = safe_tolist(df[value_col]) if value_col in df.columns else []
    if with_image_id:
        block['image_id'] = df['image_id'].astype(int).tolist() if 'image_id' in df.columns else []
        block['file_name'] = df['file_name'].tolist() if 'file_name' in df.columns else []
    return block


def _all_stats(df: pd.DataFrame, *, normalized: bool, include_image_id: bool) -> dict:
    sc_cat, sc_vals = _score_streams(df)
    if normalized:
        out = {
            'area': _stat_block(df, 'area_norm'),
            'sqrt_area': _stat_block(df, 'sqrt_area_norm'),
            'max_side': _stat_block(df, 'max_side_norm'),
            'wh_ratio': _stat_block(df, 'wh_ratio'),
            'aspect_ratio': _stat_block(df, 'aspect_ratio'),
            'width': _stat_block(df, 'w_norm', with_image_id=include_image_id),
            'height': _stat_block(df, 'h_norm', with_image_id=include_image_id),
            'center': _stat_block(df, '', with_xy=True, x_col='c_x_norm', y_col='c_y_norm', with_image_id=include_image_id),
            'score': {'category': sc_cat, 'values': sc_vals} if sc_cat else {'category': [], 'values': []},
        }
    else:
        out = {
            'area': _stat_block(df, 'area'),
            'sqrt_area': _stat_block(df, 'sqrt_area'),
            'max_side': _stat_block(df, 'max_side'),
            'wh_ratio': _stat_block(df, 'wh_ratio'),
            'aspect_ratio': _stat_block(df, 'aspect_ratio'),
            'width': _stat_block(df, 'w', with_image_id=include_image_id),
            'height': _stat_block(df, 'h', with_image_id=include_image_id),
            'center': _stat_block(df, '', with_xy=True, x_col='c_x', y_col='c_y', with_image_id=include_image_id),
            'score': {'category': sc_cat, 'values': sc_vals} if sc_cat else {'category': [], 'values': []},
        }
    return out


def _category_data(df: pd.DataFrame, categories: list[str], *, normalized: bool) -> dict:
    out: dict = {}
    for cat in categories:
        cdf = df[df['name'] == cat]
        cs = {}
        if 'score' in cdf.columns:
            cs['values'] = safe_score_tolist(cdf['score'])
        if normalized:
            out[cat] = {
                'count': len(cdf),
                'area': {
                    'values': safe_tolist(cdf['area_norm']) if 'area_norm' in cdf.columns else [],
                    'sqrt_values': safe_tolist(cdf['sqrt_area_norm']) if 'sqrt_area_norm' in cdf.columns else [],
                },
                'dimensions': {
                    'width': safe_tolist(cdf['w_norm']) if 'w_norm' in cdf.columns else [],
                    'height': safe_tolist(cdf['h_norm']) if 'h_norm' in cdf.columns else [],
                    'max_side': safe_tolist(cdf['max_side_norm']) if 'max_side_norm' in cdf.columns else [],
                    'min_side': safe_tolist(cdf['min_side_norm']) if 'min_side_norm' in cdf.columns else [],
                },
                'ratios': {
                    'wh_ratio': safe_tolist(cdf['wh_ratio']) if 'wh_ratio' in cdf.columns else [],
                    'aspect_ratio': safe_tolist(cdf['aspect_ratio']) if 'aspect_ratio' in cdf.columns else [],
                },
                'spatial': {
                    'center_x': safe_tolist(cdf['c_x_norm']) if 'c_x_norm' in cdf.columns else [],
                    'center_y': safe_tolist(cdf['c_y_norm']) if 'c_y_norm' in cdf.columns else [],
                },
                'score': cs,
            }
        else:
            out[cat] = {
                'count': len(cdf),
                'area': {
                    'values': safe_tolist(cdf['area']) if 'area' in cdf.columns else [],
                    'sqrt_values': safe_tolist(cdf['sqrt_area']) if 'sqrt_area' in cdf.columns else [],
                },
                'dimensions': {
                    'width': safe_tolist(cdf['w']) if 'w' in cdf.columns else [],
                    'height': safe_tolist(cdf['h']) if 'h' in cdf.columns else [],
                    'max_side': safe_tolist(cdf['max_side']) if 'max_side' in cdf.columns else [],
                    'min_side': safe_tolist(cdf['min_side']) if 'min_side' in cdf.columns else [],
                },
                'ratios': {
                    'wh_ratio': safe_tolist(cdf['wh_ratio']) if 'wh_ratio' in cdf.columns else [],
                    'aspect_ratio': safe_tolist(cdf['aspect_ratio']) if 'aspect_ratio' in cdf.columns else [],
                },
                'spatial': {
                    'center_x': safe_tolist(cdf['c_x']) if 'c_x' in cdf.columns else [],
                    'center_y': safe_tolist(cdf['c_y']) if 'c_y' in cdf.columns else [],
                },
                'score': cs,
            }
    return out


def build_eda_payload(eda: CocoEDA, *, meta_filter_mapping=None, include_image_id: bool = True) -> dict:
    """统一的 EDA payload 构建器：单文件 / merged 共用。

    include_image_id：load_dataset 路径下保留 all_categories_stats 的 image_id/file_name；
    merged 路径用 False（与原行为一致）。
    """
    df = eda.compute_bbox_features()
    df = add_normalized_bbox_stats(eda, df)
    class_dist = eda.get_class_distribution()
    categories = class_dist['name'].tolist()
    payload: dict = {
        'num_images': len(eda.images_df),
        'num_annotations': len(eda.annotations_df),
        'num_categories': len(eda.categories_df),
        'categories': categories,
        'meta_filter_options': build_meta_filter_options(eda.images_df, meta_filter_mapping),
        'class_distribution': class_dist.to_dict('records'),
        'class_distribution_pie': {
            'labels': class_dist['name'].tolist(),
            'values': [int(x) for x in class_dist['count'].tolist()],
            'percentages': [safe_float(x) or 0 for x in class_dist['percentage'].tolist()],
        },
        'class_counts': {
            'categories': class_dist['name'].tolist(),
            'counts': [int(x) for x in class_dist['count'].tolist()],
        },
        'category_data': _category_data(df, categories, normalized=True),
        'category_data_raw': _category_data(df, categories, normalized=False),
        'all_categories_stats': _all_stats(df, normalized=True, include_image_id=include_image_id),
        'all_categories_stats_raw': _all_stats(df, normalized=False, include_image_id=include_image_id),
    }
    return payload


# ---------- 单文件 / 合并集 加载 ----------

def load_single(coco_json_path: str, image_dir: str | None, dataset_name: str, meta_filter_mapping=None) -> dict:
    """加载单 COCO 文件，返回完整 payload（含 dataset_id/image_category_definitions）。"""
    coco_path = Path(coco_json_path).resolve()
    if coco_path.is_dir():
        auto_coco = coco_path / config.COCO_ANNOTATION_FILENAME
        image_service.ensure_coco_file(str(auto_coco))
        coco_path = auto_coco.resolve()
    if not coco_path.exists():
        raise FileNotFoundError(f'文件不存在: {coco_json_path}')
    if not coco_path.is_file():
        raise FileNotFoundError(f'路径不是文件: {coco_path}')

    try:
        with open(coco_path, 'r', encoding='utf-8') as f:
            check = json.load(f)
        if not check.get('images'):
            added, _ = image_service.sync_images_from_dir(str(coco_path), image_dir or None)
            if added > 0:
                safe_log(f'[info] load_dataset: auto-synced {added} images into {coco_path}')
    except Exception as exc:  # noqa: BLE001
        safe_log(f'[warn] load_dataset pre-sync: {exc}')

    eda = CocoEDA(coco_json_path=str(coco_path), name=dataset_name, image_dir=image_dir or None)
    image_service.fill_image_dimensions(eda)

    dataset_id = register_dataset(eda, dataset_name=dataset_name)
    datasets_repo.persist(dataset_id, coco_path, dataset_name, image_dir or None)
    loader_record_repo.write_record(str(coco_path), dataset_name, image_dir or '')

    payload = build_eda_payload(eda, meta_filter_mapping=meta_filter_mapping, include_image_id=True)
    payload['dataset_id'] = dataset_id
    payload['dataset_name'] = dataset_name

    with open(eda.coco_json_path, 'r', encoding='utf-8') as f:
        coco_data = json.load(f)
    if not versions_repo.list_versions(eda.coco_json_path):
        versions_repo.save_version(eda.coco_json_path, coco_data, comment='加载时原版')

    cat_defs = infer_image_category_definitions(coco_data)
    if cat_defs and cat_defs.get('categories'):
        payload['image_category_definitions'] = cat_defs
    return payload


def _source_fingerprint(items: list[dict]) -> str:
    paths = sorted(str(Path(it['coco_path']).resolve()) for it in items)
    return hashlib.md5('\n'.join(paths).encode('utf-8')).hexdigest()[:16]


def prepare_merge_item(item: dict) -> dict | None:
    """规范化 merge item：确保 coco_path 可用且 images 非空。"""
    if not isinstance(item, dict):
        return None
    raw_coco = (item.get('coco_path') or '').strip()
    raw_img_dir = (item.get('image_dir') or '').strip()
    rel = item.get('relative_path') or ''

    coco_path = Path(raw_coco).expanduser() if raw_coco else None
    img_dir = Path(raw_img_dir).expanduser() if raw_img_dir else None

    if not coco_path or not coco_path.exists():
        candidate_dir = None
        if img_dir and img_dir.is_dir():
            candidate_dir = img_dir
        elif coco_path:
            parent = coco_path.parent
            if parent.exists() and parent.is_dir():
                candidate_dir = parent
        if candidate_dir is None:
            return None
        coco_path = (candidate_dir / config.COCO_ANNOTATION_FILENAME).resolve()
        image_service.ensure_coco_file(str(coco_path))
        image_service.sync_images_from_dir(str(coco_path), str(candidate_dir))
        img_dir = candidate_dir
    else:
        coco_path = coco_path.resolve()

    if not img_dir or not img_dir.is_dir():
        img_dir = coco_path.parent
    img_dir = img_dir.resolve()

    try:
        with open(coco_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception:
        image_service.ensure_coco_file(str(coco_path))
        data = {'images': [], 'annotations': [], 'categories': []}
    if not data.get('images'):
        image_service.sync_images_from_dir(str(coco_path), str(img_dir))

    return {'coco_path': str(coco_path), 'image_dir': str(img_dir), 'relative_path': rel}


def load_merged(items: list[dict], dataset_name: str = 'merged', root_path: str | None = None, meta_filter_mapping=None) -> dict:
    """合并多个 COCO 加载，并保留旧 merged 文件中的 image_categories/notes/anns。"""
    name_to_id: dict[str, int] = {}
    next_cat_id = 1
    merged_images: list[dict] = []
    merged_annotations: list[dict] = []
    source_dirs: dict[str, str] = {}
    next_image_id = 1
    next_ann_id = 1
    old_to_new_cat: dict = {}

    for item in items:
        coco_path = Path(item['coco_path'])
        image_dir = item.get('image_dir') or str(coco_path.parent)
        rel = item.get('relative_path') or ''
        source_dirs[rel] = image_dir
        with open(coco_path, 'r', encoding='utf-8') as f:
            coco = json.load(f)
        images = coco.get('images', [])
        anns = coco.get('annotations', [])
        cats = coco.get('categories', [])
        file_to_new_id: dict = {}
        for img in images:
            old_id = img.get('id')
            new_id = next_image_id
            next_image_id += 1
            file_to_new_id[old_id] = new_id
            new_img = {k: v for k, v in img.items()}
            new_img['id'] = new_id
            new_img['source_path'] = rel
            merged_images.append(new_img)
        for c in cats:
            cname = c.get('name')
            if cname not in name_to_id:
                name_to_id[cname] = next_cat_id
                next_cat_id += 1
            old_to_new_cat[c.get('id')] = name_to_id[cname]
        for ann in anns:
            old_im = ann.get('image_id')
            old_cat = ann.get('category_id')
            new_im = file_to_new_id.get(old_im)
            if new_im is None:
                continue
            new_cat = old_to_new_cat.get(old_cat)
            if new_cat is None:
                continue
            new_ann = {k: v for k, v in ann.items()}
            new_ann['id'] = next_ann_id
            next_ann_id += 1
            new_ann['image_id'] = new_im
            new_ann['category_id'] = new_cat
            merged_annotations.append(new_ann)

    categories_list = [{'id': iid, 'name': name} for name, iid in sorted(name_to_id.items(), key=lambda x: x[1])]

    fp = _source_fingerprint(items)
    if root_path:
        out = Path(root_path).resolve()
        out.mkdir(parents=True, exist_ok=True)
        merged_path = out / f'merged_{dataset_name}_{fp}.json'
    else:
        config.DATA_DIR.mkdir(parents=True, exist_ok=True)
        merged_path = config.DATA_DIR / f'merged_{dataset_name}_{fp}.json'

    old_cat_defs = None
    if merged_path.exists():
        try:
            with open(merged_path, 'r', encoding='utf-8') as f:
                old = json.load(f)
            old_meta = {}
            for img in old.get('images', []):
                key = (img.get('source_path', ''), img.get('file_name', ''))
                if key[1]:
                    old_meta[key] = {
                        'image_categories': img.get('image_categories'),
                        'image_category': img.get('image_category'),
                        'note': img.get('note'),
                    }
            for img in merged_images:
                key = (img.get('source_path', ''), img.get('file_name', ''))
                if key in old_meta:
                    m = old_meta[key]
                    if m.get('image_categories') is not None:
                        img['image_categories'] = m['image_categories']
                        img['image_category'] = m.get('image_category') or (m['image_categories'][0] if m['image_categories'] else '未分类')
                    if m.get('note') is not None:
                        img['note'] = m['note']
            old_cat_defs = old.get('image_category_definitions')

            old_images = old.get('images', []) or []
            old_anns = old.get('annotations', []) or []
            old_cats = old.get('categories', []) or []
            old_img_by_id = {img.get('id'): img for img in old_images}
            old_cat_name_by_id = {c.get('id'): c.get('name') for c in old_cats}
            new_img_id_by_key = {
                (img.get('source_path', ''), img.get('file_name', '')): img.get('id')
                for img in merged_images
                if img.get('file_name')
            }
            migrated_anns = []
            mid = 1
            for ann in old_anns:
                old_img = old_img_by_id.get(ann.get('image_id'))
                if not old_img:
                    continue
                key = (old_img.get('source_path', ''), old_img.get('file_name', ''))
                new_img_id = new_img_id_by_key.get(key)
                if new_img_id is None:
                    continue
                old_cat_name = old_cat_name_by_id.get(ann.get('category_id'))
                new_cat_id = name_to_id.get(old_cat_name)
                if new_cat_id is None:
                    continue
                new_ann = {k: v for k, v in ann.items()}
                new_ann['id'] = mid
                mid += 1
                new_ann['image_id'] = new_img_id
                new_ann['category_id'] = new_cat_id
                migrated_anns.append(new_ann)
            if migrated_anns:
                merged_annotations = migrated_anns
            safe_log(
                f'[merged_load] path={merged_path} migrated_annotations={len(migrated_anns)} '
                f'total_images={len(merged_images)}',
            )
        except Exception:
            old_cat_defs = None
            safe_log(f'[merged_load] path={merged_path} annotation_migration_failed')
    else:
        safe_log(f'[merged_load] path={merged_path} no_previous_merged_file')

    source_coco_paths = {item.get('relative_path') or '': str(Path(item['coco_path']).resolve()) for item in items}
    merged_coco = {
        'images': merged_images,
        'annotations': merged_annotations,
        'categories': categories_list,
        'source_dirs': source_dirs,
        'source_coco_paths': source_coco_paths,
    }
    if old_cat_defs:
        merged_coco['image_category_definitions'] = old_cat_defs
    cat_defs = infer_image_category_definitions(merged_coco)
    if cat_defs and cat_defs.get('categories'):
        merged_coco['image_category_definitions'] = cat_defs

    with open(merged_path, 'w', encoding='utf-8') as f:
        json.dump(merged_coco, f, indent=2, ensure_ascii=False)

    eda = CocoEDA(
        coco_json_path=str(merged_path),
        name=dataset_name,
        image_dir=list(source_dirs.values())[0] if source_dirs else None,
    )
    eda.source_dirs = source_dirs
    eda.source_coco_paths = source_coco_paths
    image_service.fill_image_dimensions(eda)

    payload = build_eda_payload(eda, meta_filter_mapping=meta_filter_mapping, include_image_id=False)
    if merged_coco.get('image_category_definitions'):
        payload['image_category_definitions'] = merged_coco['image_category_definitions']

    dataset_id = register_dataset(eda, dataset_name=dataset_name)
    datasets_repo.persist(dataset_id, eda.coco_json_path, dataset_name, eda.image_dir)
    loader_record_repo.write_record(eda.coco_json_path, dataset_name, eda.image_dir or '')
    if not versions_repo.list_versions(eda.coco_json_path):
        with open(eda.coco_json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        versions_repo.save_version(eda.coco_json_path, data, comment='加载时原版')

    payload['dataset_id'] = dataset_id
    payload['dataset_name'] = dataset_name
    return payload


__all__ = [
    'get_in_memory',
    'register_dataset',
    'replace_in_memory',
    'ensure_loaded',
    'add_normalized_bbox_stats',
    'infer_image_category_definitions',
    'apply_image_meta_filters',
    'build_meta_filter_options',
    'build_eda_payload',
    'load_single',
    'load_merged',
    'prepare_merge_item',
]
