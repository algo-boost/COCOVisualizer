"""图片相关：筛选、按类别取图、原图字节。"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import pandas as pd
from flask import Blueprint, jsonify, request, send_file

from ..errors import ApiError, api_route
from ..json_utils import extract_bbox, json_sanitize, safe_float, safe_log, safe_tolist
from ..services import dataset_service, image_service

bp = Blueprint('images', __name__)


@bp.route('/api/get_filtered_data', methods=['POST'])
@api_route
def get_filtered_data():
    data = request.get_json() or {}
    if not isinstance(data, dict):
        data = {}
    dataset_id = data.get('dataset_id')
    selected_categories = data.get('selected_categories', [])

    eda = dataset_service.ensure_loaded(dataset_id)
    if eda is None:
        raise ApiError('数据集不存在')
    df = eda.compute_bbox_features()
    df = dataset_service.add_normalized_bbox_stats(eda, df)

    if selected_categories:
        df = df[df['name'].isin(selected_categories)]
        if df.empty:
            raise ApiError('筛选后无数据')

    score_f_cat: list = []
    score_f_vals: list = []
    if 'score' in df.columns:
        for _, row in df.iterrows():
            v = safe_float(row.get('score'))
            if v is not None and not math.isinf(v):
                if 0 <= v <= 1:
                    score_f_vals.append(v)
                elif 0 <= v <= 100:
                    score_f_vals.append(v / 100.0)
                else:
                    score_f_vals.append(v)
                score_f_cat.append(row.get('name', ''))

    def col(name):
        return df['name'].tolist() if 'name' in df.columns else []

    def vals(c):
        return safe_tolist(df[c]) if c in df.columns else []

    filtered_data = {
        'area': {'category': col('name'), 'values': vals('area_norm')},
        'sqrt_area': {'category': col('name'), 'values': vals('sqrt_area_norm')},
        'max_side': {'category': col('name'), 'values': vals('max_side_norm')},
        'wh_ratio': {'category': col('name'), 'values': vals('wh_ratio')},
        'aspect_ratio': {'category': col('name'), 'values': vals('aspect_ratio')},
        'width': {'category': col('name'), 'values': vals('w_norm')},
        'height': {'category': col('name'), 'values': vals('h_norm')},
        'center': {'category': col('name'), 'x': vals('c_x_norm'), 'y': vals('c_y_norm')},
        'score': {'category': score_f_cat, 'values': score_f_vals} if score_f_cat else {'category': [], 'values': []},
    }
    filtered_data_raw = {
        'area': {'category': col('name'), 'values': vals('area')},
        'sqrt_area': {'category': col('name'), 'values': vals('sqrt_area')},
        'max_side': {'category': col('name'), 'values': vals('max_side')},
        'wh_ratio': {'category': col('name'), 'values': vals('wh_ratio')},
        'aspect_ratio': {'category': col('name'), 'values': vals('aspect_ratio')},
        'width': {'category': col('name'), 'values': vals('w')},
        'height': {'category': col('name'), 'values': vals('h')},
        'center': {'category': col('name'), 'x': vals('c_x'), 'y': vals('c_y')},
        'score': {'category': score_f_cat, 'values': score_f_vals} if score_f_cat else {'category': [], 'values': []},
    }
    return jsonify({'success': True, 'data': filtered_data, 'data_raw': filtered_data_raw})


def _is_nan(v):
    return isinstance(v, float) and math.isnan(v)


def _build_annotations_from_group(group_df):
    annotations: list[dict] = []
    if group_df is None or group_df.empty:
        return annotations
    for _, row in group_df.iterrows():
        ann = {'category': row['name']}
        for col in row.index:
            if col == 'name':
                continue
            val = row[col]
            if val is None:
                continue
            if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
                continue
            if col == 'bbox':
                bbox = extract_bbox(val)
                if bbox:
                    ann['bbox'] = bbox
            elif col == 'segmentation':
                if val is not None and (isinstance(val, (list, dict)) and len(val) > 0 if hasattr(val, '__len__') else True):
                    ann['has_segmentation'] = True
            elif isinstance(val, np.ndarray):
                if val.size > 0 and not np.all(np.isnan(val)):
                    ann[col] = val.tolist()
            elif isinstance(val, (np.integer, np.floating)):
                ann[col] = float(val) if isinstance(val, np.floating) else int(val)
            elif isinstance(val, (int, float, str, bool)):
                ann[col] = val
            elif isinstance(val, (list, tuple)):
                ann[col] = list(val)
        annotations.append(ann)
    return annotations


@bp.route('/api/get_images_by_category', methods=['POST'])
@api_route
def get_images_by_category():
    data = request.get_json() or {}
    if not isinstance(data, dict):
        data = {}
    dataset_id = data.get('dataset_id')
    selected_categories = data.get('selected_categories', [])
    c_time_start = data.get('c_time_start')
    c_time_end = data.get('c_time_end')
    product_id_query = data.get('product_id_query')
    position = data.get('position')
    meta_filter_mapping = data.get('meta_filter_mapping') if isinstance(data.get('meta_filter_mapping'), dict) else None

    eda = dataset_service.ensure_loaded(dataset_id)
    if eda is None:
        raise ApiError('数据集不存在')
    df = eda.compute_bbox_features()

    all_names_in_data = set(df['name'].dropna().unique()) if not df.empty else set()
    ann_image_ids = set(df['image_id'].astype(int).unique()) if not df.empty else set()
    all_image_ids = set(eda.images_df['id'].astype(int).tolist())
    no_gt_image_ids = all_image_ids - ann_image_ids

    if selected_categories:
        filtered_df = df[df['name'].isin(selected_categories)]
        if filtered_df.empty:
            raise ApiError('筛选后无图片')
        target_image_ids = filtered_df['image_id'].unique()
        if all_names_in_data and all_names_in_data <= set(selected_categories) and no_gt_image_ids:
            target_image_ids = np.unique(np.concatenate([target_image_ids, list(no_gt_image_ids)]))
    else:
        target_image_ids = eda.images_df['id'].unique()

    meta_allowed = dataset_service.apply_image_meta_filters(
        eda.images_df,
        c_time_start=c_time_start or None,
        c_time_end=c_time_end or None,
        product_id_query=product_id_query or None,
        position=position or None,
        meta_filter_mapping=meta_filter_mapping,
    )
    if meta_allowed is not None and len(meta_allowed) > 0:
        target_image_ids = [i for i in target_image_ids if int(i) in meta_allowed]
    elif meta_allowed is not None and len(meta_allowed) == 0:
        return jsonify({
            'success': True, 'images': [], 'image_dir': str(eda.image_dir), 'total_images': 0,
        })

    all_df = df[df['image_id'].isin(target_image_ids)] if not df.empty else pd.DataFrame()

    ann_groups = {}
    if not all_df.empty:
        for img_id, grp in all_df.groupby('image_id'):
            ann_groups[img_id] = grp

    images_list: list[dict] = []
    for image_id in target_image_ids:
        img_rows = eda.images_df[eda.images_df['id'] == image_id]
        if img_rows.empty:
            continue
        img_info = img_rows.iloc[0]
        group_df = ann_groups.get(image_id)
        annotations = _build_annotations_from_group(group_df)

        if 'width' in img_info.index and 'height' in img_info.index and pd.notna(img_info.get('width')) and pd.notna(img_info.get('height')):
            img_w, img_h = int(img_info['width']), int(img_info['height'])
        else:
            img_w, img_h = 0, 0
            if group_df is not None:
                for _, row in group_df.iterrows():
                    bbox = extract_bbox(row.get('bbox'))
                    if bbox and len(bbox) >= 4:
                        x, y, bw, bh = bbox[0], bbox[1], bbox[2], bbox[3]
                        img_w = max(img_w, int(x + bw))
                        img_h = max(img_h, int(y + bh))
            if img_w <= 0:
                img_w = 1
            if img_h <= 0:
                img_h = 1

        img_item = {
            'image_id': int(image_id),
            'file_name': img_info['file_name'],
            'width': img_w,
            'height': img_h,
            'annotations': annotations,
            'num_annotations': len(annotations),
        }

        img_cats = img_info.get('image_categories')
        if img_cats is None or _is_nan(img_cats):
            single = img_info.get('image_category')
            img_cats = [str(single)] if single is not None and not _is_nan(single) and str(single).strip() else ['未分类']
        elif isinstance(img_cats, str):
            try:
                img_cats = json.loads(img_cats) if img_cats.strip() else ['未分类']
            except (json.JSONDecodeError, AttributeError):
                single = img_info.get('image_category')
                img_cats = [str(single)] if single is not None and not _is_nan(single) and str(single).strip() else ['未分类']
        else:
            try:
                img_cats = [str(c) for c in img_cats] if img_cats else ['未分类']
            except TypeError:
                img_cats = ['未分类']
        img_item['image_category'] = img_cats[0] if img_cats else '未分类'
        img_item['image_categories'] = img_cats

        note_val = img_info.get('note')
        if note_val is not None and not _is_nan(note_val):
            img_item['note'] = str(note_val)
        if 'source_path' in img_info and img_info['source_path'] is not None:
            img_item['source_path'] = str(img_info['source_path'])
        for k in ('product_id', 'c_time', 'position'):
            v = img_info.get(k)
            if v is not None and (not isinstance(v, float) or not math.isnan(v)):
                img_item[k] = str(v)

        image_meta: dict = {}
        for col in img_info.index:
            if col == 'id':
                continue
            v = img_info.get(col)
            if v is None:
                continue
            if isinstance(v, (float, np.floating)) and (math.isnan(v) or math.isinf(v)):
                continue
            if isinstance(v, np.integer):
                image_meta[col] = int(v)
            elif isinstance(v, np.floating):
                image_meta[col] = float(v)
            elif isinstance(v, np.ndarray):
                image_meta[col] = v.tolist()
            elif isinstance(v, (list, tuple)):
                image_meta[col] = list(v)
            elif isinstance(v, dict):
                image_meta[col] = v
            else:
                image_meta[col] = v
        img_item['image_meta'] = image_meta

        file_name = img_info.get('file_name', '')
        image_dir = eda.image_dir
        source_path = img_info.get('source_path')
        if source_path and getattr(eda, 'source_dirs', None):
            image_dir = eda.source_dirs.get(source_path) or image_dir
        if not image_dir and hasattr(eda, 'coco_json_path'):
            image_dir = str(Path(eda.coco_json_path).parent)
        if file_name and image_dir:
            try:
                file_path = Path(file_name)
                image_path = file_path if file_path.is_absolute() else Path(image_dir) / file_name
                if not image_path.exists() and hasattr(eda, 'coco_json_path'):
                    for alt in (Path(eda.coco_json_path).parent / file_name, Path(image_dir) / Path(file_name).name):
                        if alt.exists():
                            image_path = alt
                            break
                if image_path.exists():
                    stat = image_path.stat()
                    img_item['file_size'] = stat.st_size
                    img_item['modified_time'] = stat.st_mtime
            except Exception:
                pass
        images_list.append(img_item)

    images_list.sort(key=lambda x: x['image_id'])

    search_dirs: set = set()
    if hasattr(eda, 'coco_json_path') and eda.coco_json_path:
        search_dirs.add(str(Path(eda.coco_json_path).parent))
    if hasattr(eda, 'source_coco_paths') and eda.source_coco_paths:
        for src_path in eda.source_coco_paths.values():
            search_dirs.add(str(Path(src_path).parent))

    all_pred: dict = {}
    pred_model_names: list[str] = []
    for d in search_dirs:
        for pf in image_service.find_pred_files(d):
            mname = pf['model_name']
            if mname not in pred_model_names:
                pred_model_names.append(mname)
            loaded = image_service.load_pred_annotations(pf['path'], mname)
            all_pred.setdefault(mname, {}).update(loaded)

    if all_pred:
        for img_item in images_list:
            fname = img_item['file_name']
            fname_base = fname.replace('\\', '/').split('/')[-1]
            pred_anns = []
            for mname, fname_map in all_pred.items():
                model_anns = fname_map.get(fname) or fname_map.get(fname_base) or []
                pred_anns.extend(model_anns)
            if pred_anns:
                img_item['pred_annotations'] = pred_anns

    safe_log(f'[get_images_by_category] dataset_id={dataset_id} images={len(images_list)} target_image_ids={len(target_image_ids)}')
    return jsonify({
        'success': True,
        'images': json_sanitize(images_list),
        'image_dir': str(eda.image_dir),
        'total_images': len(images_list),
        'pred_model_names': pred_model_names,
    })


@bp.route('/api/get_image', methods=['GET'])
@api_route
def get_image():
    dataset_id = request.args.get('dataset_id')
    file_name = request.args.get('file_name')
    eda = dataset_service.ensure_loaded(dataset_id)
    if eda is None:
        raise ApiError('数据集不存在')
    source_path = request.args.get('source_path')
    image_dir = eda.image_dir
    if source_path and getattr(eda, 'source_dirs', None):
        image_dir = eda.source_dirs.get(source_path) or image_dir
    if not image_dir:
        image_dir = str(Path(eda.coco_json_path).parent)
    file_path = Path(file_name)
    image_path = file_path if file_path.is_absolute() else Path(image_dir) / file_name
    if not image_path.exists():
        for alt in (Path(eda.coco_json_path).parent / file_name, Path(image_dir) / Path(file_name).name):
            if alt.exists():
                image_path = alt
                break
        else:
            raise ApiError(f'图片文件不存在: {file_name}', status=404)
    return send_file(str(image_path))
