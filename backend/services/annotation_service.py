"""标注与图片元数据写回。

合并集会同步源 _annotations.coco.json，保证用户直接打开源文件也能看到改动。
"""
from __future__ import annotations

import json
from pathlib import Path

from ..json_utils import safe_log
from ..repositories import versions_repo
from . import dataset_service


def sync_gt_to_source_cocos(coco_data: dict, touched_merged_image_ids: list[int]) -> None:
    if not touched_merged_image_ids:
        return
    source_coco_paths = coco_data.get('source_coco_paths')
    if not source_coco_paths or not isinstance(source_coco_paths, dict):
        return
    merged_by_id = {img['id']: img for img in coco_data.get('images', []) if img.get('id') is not None}
    merged_cat_by_id = {c['id']: c.get('name') for c in coco_data.get('categories', []) if c.get('id') is not None}

    by_file: dict[str, list[tuple[int, str]]] = {}
    for mid in touched_merged_image_ids:
        mimg = merged_by_id.get(mid)
        if not mimg:
            continue
        sp_key = str(mimg.get('source_path') or '')
        fn = mimg.get('file_name') or ''
        src_abs = source_coco_paths.get(sp_key)
        if not src_abs or not fn:
            continue
        p = Path(src_abs)
        if not p.is_file():
            continue
        by_file.setdefault(str(p.resolve()), []).append((mid, fn))

    for src_abs_str, batch in by_file.items():
        try:
            with open(src_abs_str, 'r', encoding='utf-8') as f:
                src_coco = json.load(f)
        except Exception as exc:  # noqa: BLE001
            safe_log(f'[sync_gt_source] read_fail path={src_abs_str} err={exc}')
            continue

        src_img_by_fn = {im.get('file_name'): im for im in src_coco.get('images', []) if im.get('file_name')}
        src_iids_to_clear: set = set()
        for _mid, fn in batch:
            simg = src_img_by_fn.get(fn)
            if simg and simg.get('id') is not None:
                src_iids_to_clear.add(simg['id'])
        src_coco['annotations'] = [
            a for a in src_coco.get('annotations', []) if a.get('image_id') not in src_iids_to_clear
        ]
        max_aid = max((a['id'] for a in src_coco.get('annotations', [])), default=0)

        for merged_id, fn in batch:
            simg = src_img_by_fn.get(fn)
            if not simg or simg.get('id') is None:
                continue
            src_iid = simg['id']
            merged_anns = [a for a in coco_data.get('annotations', []) if a.get('image_id') == merged_id]
            for ma in merged_anns:
                cname = merged_cat_by_id.get(ma.get('category_id'))
                if not cname:
                    continue
                src_cat_id = next((c['id'] for c in src_coco.get('categories', []) if c.get('name') == cname), None)
                if src_cat_id is None:
                    src_cat_id = max((c['id'] for c in src_coco.get('categories', [])), default=0) + 1
                    src_coco.setdefault('categories', []).append({'id': src_cat_id, 'name': cname})
                max_aid += 1
                bbox = ma.get('bbox')
                area = ma.get('area')
                if area is None and bbox and len(bbox) == 4:
                    area = bbox[2] * bbox[3]
                rec = {
                    'id': max_aid,
                    'image_id': src_iid,
                    'category_id': src_cat_id,
                    'bbox': bbox,
                    'area': area or 0,
                    'iscrowd': ma.get('iscrowd', 0),
                }
                if ma.get('_from_pred'):
                    rec['_from_pred'] = ma['_from_pred']
                src_coco.setdefault('annotations', []).append(rec)

        try:
            with open(src_abs_str, 'w', encoding='utf-8') as f:
                json.dump(src_coco, f, indent=2, ensure_ascii=False)
            safe_log(f'[sync_gt_source] wrote path={src_abs_str} images_touched={len(batch)}')
        except Exception as exc:  # noqa: BLE001
            safe_log(f'[sync_gt_source] write_fail path={src_abs_str} err={exc}')


def save_annotations(dataset_id: str, images_data: list[dict]) -> None:
    eda = dataset_service.ensure_loaded(dataset_id)
    if eda is None:
        raise FileNotFoundError('数据集不存在')

    with open(eda.coco_json_path, 'r', encoding='utf-8') as f:
        coco_data = json.load(f)

    safe_log(
        f'[save_annotations] begin dataset_id={dataset_id} path={eda.coco_json_path} '
        f'images_payload={len(images_data)}',
    )

    existing_ids = set(ann['id'] for ann in coco_data.get('annotations', []))
    max_aid = max(existing_ids) if existing_ids else 0

    img_size_map = {img['id']: (img.get('width', 0), img.get('height', 0)) for img in coco_data.get('images', [])}

    for img_data in images_data:
        image_id = img_data['image_id']
        new_anns = img_data['annotations']
        coco_data['annotations'] = [a for a in coco_data.get('annotations', []) if a.get('image_id') != image_id]

        for ann in new_anns:
            max_aid += 1
            cat_id = ann.get('category_id')
            if cat_id is None:
                cat_name = ann.get('category', '')
                cat_id = next((c['id'] for c in coco_data.get('categories', []) if c['name'] == cat_name), None)
                if cat_id is None:
                    cat_id = max((c['id'] for c in coco_data.get('categories', [])), default=0) + 1
                    coco_data.setdefault('categories', []).append({'id': cat_id, 'name': cat_name})

            raw_bbox = ann.get('bbox')
            if raw_bbox and len(raw_bbox) == 4:
                img_w, img_h = img_size_map.get(image_id, (0, 0))
                bx, by, bw, bh = float(raw_bbox[0]), float(raw_bbox[1]), float(raw_bbox[2]), float(raw_bbox[3])
                if img_w > 0 and img_h > 0:
                    bx = max(0.0, min(bx, img_w))
                    by = max(0.0, min(by, img_h))
                    bw = max(1.0, min(bw, img_w - bx))
                    bh = max(1.0, min(bh, img_h - by))
                raw_bbox = [bx, by, bw, bh]
            coco_ann = {
                'id': max_aid,
                'image_id': image_id,
                'category_id': cat_id,
                'bbox': raw_bbox,
                'area': raw_bbox[2] * raw_bbox[3] if raw_bbox else (ann.get('area') or 0),
                'iscrowd': ann.get('iscrowd', 0),
            }
            if ann.get('_from_pred'):
                coco_ann['_from_pred'] = ann['_from_pred']
            coco_data['annotations'].append(coco_ann)

    touched = [d['image_id'] for d in images_data]
    sync_gt_to_source_cocos(coco_data, touched)

    versions_repo.save_version(eda.coco_json_path, coco_data)
    with open(eda.coco_json_path, 'w', encoding='utf-8') as f:
        json.dump(coco_data, f, indent=2, ensure_ascii=False)
    safe_log(
        f"[save_annotations] wrote path={eda.coco_json_path} "
        f"total_annotations={len(coco_data.get('annotations', []))}",
    )

    backup_path = Path(eda.coco_json_path).with_suffix('.json.backup')
    if not backup_path.exists():
        backup_path = Path(str(eda.coco_json_path) + '.backup')
    try:
        if backup_path.exists():
            backup_path.unlink()
    except Exception:
        pass

    try:
        from . import dataset_service as _ds
        _ds._current_datasets.pop(dataset_id, None)  # noqa: SLF001
        _ds.ensure_loaded(dataset_id)
    except Exception:
        safe_log(f'[save_annotations] cache_reload_failed dataset_id={dataset_id}')


def rename_category(dataset_id: str, old_name: str, new_name: str) -> dict:
    eda = dataset_service.ensure_loaded(dataset_id)
    if eda is None:
        raise FileNotFoundError('数据集不存在')

    with open(eda.coco_json_path, 'r', encoding='utf-8') as f:
        coco_data = json.load(f)

    categories = coco_data.get('categories', [])
    old_cat = next((c for c in categories if c['name'] == old_name), None)
    if old_cat is None:
        raise ValueError(f'类别 "{old_name}" 不存在')

    new_cat = next((c for c in categories if c['name'] == new_name), None)
    if new_cat is None:
        old_cat['name'] = new_name
        new_cat_id = old_cat['id']
        comment = f'重命名类别 {old_name} → {new_name}'
        msg = f'已将类别 {old_name} 重命名为 {new_name}'
    else:
        new_cat_id = new_cat['id']
        old_cat_id = old_cat['id']
        for ann in coco_data.get('annotations', []):
            if ann.get('category_id') == old_cat_id:
                ann['category_id'] = new_cat_id
        coco_data['categories'] = [c for c in categories if c['id'] != old_cat_id]
        comment = f'合并类别 {old_name} → {new_name}'
        msg = f'已将 {old_name} 合并到 {new_name}'

    versions_repo.save_version(eda.coco_json_path, coco_data, comment=comment)
    with open(eda.coco_json_path, 'w', encoding='utf-8') as f:
        json.dump(coco_data, f, indent=2, ensure_ascii=False)

    from . import dataset_service as _ds
    _ds._current_datasets.pop(dataset_id, None)  # noqa: SLF001
    affected = sum(1 for ann in coco_data.get('annotations', []) if ann.get('category_id') == new_cat_id)
    return {'message': msg, 'affected': affected}


def save_image_metadata(
    dataset_id: str,
    images_meta: list[dict],
    *,
    skip_version: bool = False,
    image_category_definitions: dict | None = None,
    version_comment: str = '',
) -> dict:
    eda = dataset_service.ensure_loaded(dataset_id)
    if eda is None:
        raise FileNotFoundError('数据集不存在')

    with open(eda.coco_json_path, 'r', encoding='utf-8') as f:
        coco_data = json.load(f)

    meta_by_id = {item['image_id']: item for item in images_meta}
    for img in coco_data.get('images', []):
        iid = img.get('id')
        if iid is None or iid not in meta_by_id:
            continue
        meta = meta_by_id[iid]
        cats = meta.get('image_categories')
        if cats is None:
            single = meta.get('image_category', '未分类')
            cats = [single] if single else ['未分类']
        img['image_categories'] = list(cats)
        img['image_category'] = cats[0] if cats else '未分类'
        img['note'] = meta.get('note', '')

    if image_category_definitions and isinstance(image_category_definitions, dict) and image_category_definitions.get('categories'):
        coco_data['image_category_definitions'] = image_category_definitions

    version_id = None
    if not skip_version:
        version_id = versions_repo.save_version(eda.coco_json_path, coco_data, comment=version_comment)

    target_path = Path(eda.coco_json_path).resolve()
    with open(target_path, 'w', encoding='utf-8') as f:
        json.dump(coco_data, f, indent=2, ensure_ascii=False)

    if 'image_categories' not in eda.images_df.columns:
        eda.images_df['image_categories'] = None
    if 'image_category' not in eda.images_df.columns:
        eda.images_df['image_category'] = None
    if 'note' not in eda.images_df.columns:
        eda.images_df['note'] = ''
    for item in images_meta:
        iid = item.get('image_id')
        if iid is None:
            continue
        cats = item.get('image_categories') or ['未分类']
        note = item.get('note', '')
        idx_list = eda.images_df.index[eda.images_df['id'] == iid].tolist()
        if idx_list:
            idx = idx_list[0]
            eda.images_df.at[idx, 'image_categories'] = list(cats)
            eda.images_df.at[idx, 'image_category'] = cats[0] if cats else '未分类'
            eda.images_df.at[idx, 'note'] = note

    source_coco_paths = coco_data.get('source_coco_paths') or getattr(eda, 'source_coco_paths', None) or {}
    if source_coco_paths:
        id_to_src = {}
        for _, row in eda.images_df.iterrows():
            rid = int(row['id'])
            id_to_src[rid] = (str(row.get('source_path') or ''), str(row.get('file_name') or ''))
        src_file_updates: dict[str, dict] = {}
        for item in images_meta:
            iid = item.get('image_id')
            if iid not in id_to_src:
                continue
            sp_key, fn = id_to_src[iid]
            src_coco_path = source_coco_paths.get(sp_key)
            if not src_coco_path or not fn:
                continue
            cats = item.get('image_categories') or ['未分类']
            src_file_updates.setdefault(src_coco_path, {})[fn] = {
                'image_categories': list(cats),
                'image_category': cats[0] if cats else '未分类',
                'note': item.get('note', ''),
            }
        for src_path_str, file_upd in src_file_updates.items():
            try:
                src_p = Path(src_path_str)
                if not src_p.exists():
                    continue
                with open(src_p, 'r', encoding='utf-8') as sf:
                    src_coco = json.load(sf)
                changed = False
                for simg in src_coco.get('images', []):
                    fn = simg.get('file_name', '')
                    if fn in file_upd:
                        u = file_upd[fn]
                        simg['image_categories'] = u['image_categories']
                        simg['image_category'] = u['image_category']
                        simg['note'] = u['note']
                        changed = True
                if changed:
                    with open(src_p, 'w', encoding='utf-8') as sf:
                        json.dump(src_coco, sf, indent=2, ensure_ascii=False)
            except Exception:
                pass

    return {
        'version_id': version_id,
        'saved_path': str(target_path),
        'saved_dir': str(target_path.parent),
    }
