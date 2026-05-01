"""实验数据集导出引擎：合并 COCO → 划分 train/valid → 打包 ZIP。

从根目录 experiment_export.py 迁入，行为不变。
"""
from __future__ import annotations

import io
import json
import os
import random
import zipfile
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

ProgressCallback = Optional[Callable[[int, str], None]]


def _fmt_bytes(n: int) -> str:
    if n < 1024:
        return f'{n} B'
    if n < 1024 * 1024:
        return f'{n / 1024:.1f} KB'
    return f'{n / (1024 * 1024):.1f} MB'


def _export_basename(file_name: str) -> str:
    s = str(file_name or '').strip().replace('\\', '/')
    return os.path.basename(s) if s else ''


def _assert_unique_export_basenames(coco: Dict[str, Any]) -> None:
    seen: Dict[str, int] = {}
    for im in coco.get('images') or []:
        iid = im.get('id')
        if iid is None:
            continue
        try:
            iid = int(iid)
        except (TypeError, ValueError):
            continue
        bn = _export_basename(im.get('file_name') or '')
        if not bn:
            raise ValueError(f'存在空的 file_name，无法导出（image_id={iid}）')
        if bn in seen:
            raise ValueError(
                f'存在重名「{bn}」（image_id {seen[bn]} 与 {iid}），已终止导出；请先改名、去重，或开启「丢弃重名」。'
            )
        seen[bn] = iid


def _dedupe_images_by_basename(
    coco: Dict[str, Any],
    id_to_path: Dict[int, Path],
) -> Tuple[Dict[str, Any], Dict[int, Path], Dict[str, Any]]:
    images = list(coco.get('images') or [])

    def _sort_key(im: Dict[str, Any]) -> int:
        try:
            return int(im.get('id'))
        except (TypeError, ValueError):
            return 0

    images.sort(key=_sort_key)

    kept_by_bn: Dict[str, int] = {}
    kept_images: List[Dict[str, Any]] = []
    dropped: List[Dict[str, Any]] = []

    for im in images:
        try:
            iid = int(im['id'])
        except (TypeError, ValueError, KeyError):
            continue
        bn = _export_basename(im.get('file_name') or '')
        if not bn:
            raise ValueError(f'存在空的 file_name，无法导出（image_id={iid}）')
        if bn in kept_by_bn:
            dropped.append({'basename': bn, 'dropped_image_id': iid, 'kept_image_id': kept_by_bn[bn]})
            continue
        kept_by_bn[bn] = iid
        kept_images.append(im)

    if not kept_images:
        raise ValueError('去除重名后没有可导出的图片')

    kept_ids = {int(im['id']) for im in kept_images}
    coco['images'] = kept_images
    coco['annotations'] = [a for a in coco.get('annotations') or [] if int(a.get('image_id')) in kept_ids]
    new_id_to_path = {iid: p for iid, p in id_to_path.items() if iid in kept_ids}
    meta = {
        'dedupe_dropped_count': len(dropped),
        'dedupe_dropped': dropped[:500],
        'dedupe_kept_count': len(kept_images),
    }
    return coco, new_id_to_path, meta


def _dedupe_split_ids_by_basename(coco: Dict[str, Any], id_set: Set[int]) -> Tuple[Set[int], List[Dict[str, Any]]]:
    images = [im for im in (coco.get('images') or []) if int(im.get('id')) in id_set]
    images.sort(key=lambda im: int(im.get('id')))
    kept_by_bn: Dict[str, int] = {}
    kept_ids: Set[int] = set()
    dropped: List[Dict[str, Any]] = []
    for im in images:
        iid = int(im.get('id'))
        bn = _export_basename(im.get('file_name') or '')
        if not bn:
            continue
        if bn in kept_by_bn:
            dropped.append({'basename': bn, 'dropped_image_id': iid, 'kept_image_id': kept_by_bn[bn]})
            continue
        kept_by_bn[bn] = iid
        kept_ids.add(iid)
    return kept_ids, dropped


def _assert_unique_basenames_in_ids(coco: Dict[str, Any], id_set: Set[int], split_name: str) -> None:
    seen: Dict[str, int] = {}
    for im in coco.get('images') or []:
        iid = im.get('id')
        if iid is None or int(iid) not in id_set:
            continue
        iid = int(iid)
        bn = _export_basename(im.get('file_name') or '')
        if not bn:
            raise ValueError(f'{split_name} 存在空的 file_name，无法导出（image_id={iid}）')
        if bn in seen:
            raise ValueError(
                f'{split_name} 存在重名「{bn}」（image_id {seen[bn]} 与 {iid}），已终止导出；请先改名、去重，或开启「丢弃重名」。'
            )
        seen[bn] = iid


def _split_train_val_ids(image_ids: List[int], train_ratio: float, seed: int) -> Tuple[Set[int], Set[int]]:
    rng = random.Random(seed)
    xs = list(image_ids)
    rng.shuffle(xs)
    n = len(xs)
    if n == 0:
        return set(), set()
    if n == 1:
        return {xs[0]}, set()
    if train_ratio >= 1:
        return set(xs), set()
    tr = int(n * train_ratio)
    if tr <= 0:
        tr = 1
    elif tr >= n:
        tr = n - 1
    return set(xs[:tr]), set(xs[tr:])


def _split_train_val_ids_by_source_dir(coco: Dict[str, Any], id_to_path: Dict[int, Path]) -> Tuple[Set[int], Set[int]]:
    by_id = {int(im.get('id')): im for im in (coco.get('images') or []) if im.get('id') is not None}
    train_fixed: Set[int] = set()
    val_fixed: Set[int] = set()
    unknown: Set[int] = set()

    def _hit_dir(p: Path) -> Optional[str]:
        parts = [str(x).strip().lower() for x in p.parts if str(x).strip()]
        last_hit = None
        for i, seg in enumerate(parts):
            if seg == 'train':
                last_hit = ('train', i)
            elif seg in ('valid', 'val', 'validation'):
                last_hit = ('valid', i)
        return last_hit[0] if last_hit else None

    for iid in sorted(by_id.keys()):
        src = id_to_path.get(iid)
        split = _hit_dir(src) if src else None
        if split == 'train':
            train_fixed.add(iid)
        elif split == 'valid':
            val_fixed.add(iid)
        else:
            unknown.add(iid)

    both = train_fixed & val_fixed
    if both:
        val_fixed -= both
    if not by_id:
        return set(), set()
    return set(train_fixed) | unknown, set(val_fixed)


def _remap_categories_sorted_zero(coco: Dict[str, Any]) -> Dict[str, Any]:
    cats = coco.get('categories') or []
    anns = coco.get('annotations') or []
    old_id_to_name: Dict[int, str] = {}
    for c in cats:
        try:
            cid = int(c.get('id'))
        except (TypeError, ValueError):
            continue
        name = str(c.get('name') or '').strip()
        if name:
            old_id_to_name[cid] = name

    for a in anns:
        name = str(a.get('category') or '').strip()
        if name:
            old_id_to_name.setdefault(-len(old_id_to_name) - 1, name)

    names = sorted(set(old_id_to_name.values()))
    name_to_new_id = {n: i for i, n in enumerate(names)}
    new_categories = [{'id': i, 'name': n} for n, i in name_to_new_id.items()]

    for a in anns:
        ann_name = str(a.get('category') or '').strip()
        if not ann_name:
            try:
                old_cid = int(a.get('category_id'))
            except (TypeError, ValueError):
                old_cid = None
            ann_name = old_id_to_name.get(old_cid or -999999, '')
        if ann_name in name_to_new_id:
            a['category_id'] = name_to_new_id[ann_name]
        elif names:
            a['category_id'] = 0

    coco['categories'] = new_categories
    return coco


def _coco_subset(coco: Dict[str, Any], id_set: Set[int]) -> Dict[str, Any]:
    imgs = [im for im in coco.get('images') or [] if im.get('id') in id_set]
    keep = {im.get('id') for im in imgs}
    anns = [a for a in coco.get('annotations') or [] if a.get('image_id') in keep]
    out = {
        'info': coco.get('info') or {},
        'licenses': coco.get('licenses') or [],
        'categories': coco.get('categories') or [],
        'images': imgs,
        'annotations': anns,
    }
    if coco.get('image_category_definitions'):
        out['image_category_definitions'] = coco['image_category_definitions']
    return out


def merge_prepared_items_to_flat_coco(
    prepared_items: List[Dict[str, str]],
    on_progress: ProgressCallback = None,
) -> Tuple[Dict[str, Any], Dict[int, Path], int]:
    name_to_id: Dict[str, int] = {}
    next_cat_id = 1
    merged_images: List[Dict[str, Any]] = []
    merged_anns: List[Dict[str, Any]] = []
    image_id_to_src: Dict[int, Path] = {}
    skipped = 0

    next_image_id = 1
    next_ann_id = 1
    first_info: Dict[str, Any] = {}
    first_licenses: List[Any] = []

    n_items = len(prepared_items)
    for item_idx, item in enumerate(prepared_items):
        if on_progress and n_items:
            lo = 2 + int(17 * item_idx / n_items)
            hi = 2 + int(17 * (item_idx + 1) / n_items)
            on_progress(min(19, max(lo, hi - 1)), f'合并数据源 {item_idx + 1}/{n_items}')
        coco_path = Path(item['coco_path'])
        image_dir = Path(item.get('image_dir') or str(coco_path.parent))
        with open(coco_path, 'r', encoding='utf-8') as f:
            coco = json.load(f)
        if not first_info and coco.get('info'):
            first_info = dict(coco['info']) if isinstance(coco['info'], dict) else {}
        if not first_licenses and coco.get('licenses'):
            first_licenses = list(coco['licenses'])

        images = coco.get('images') or []
        anns = coco.get('annotations') or []
        cats = coco.get('categories') or []

        old_to_new_cat: Dict[Any, int] = {}
        for c in cats:
            cname = c.get('name')
            if not cname:
                continue
            if cname not in name_to_id:
                name_to_id[cname] = next_cat_id
                next_cat_id += 1
            old_to_new_cat[c.get('id')] = name_to_id[cname]

        file_to_new_id: Dict[Any, int] = {}
        for img in images:
            old_id = img.get('id')
            raw_fn = img.get('file_name') or ''
            p = Path(raw_fn)
            abs_src = p if p.is_absolute() else (image_dir / raw_fn).resolve()

            if not abs_src.exists():
                skipped += 1
                continue

            out_name = _export_basename(raw_fn)
            if not out_name:
                skipped += 1
                continue

            new_id = next_image_id
            next_image_id += 1
            file_to_new_id[old_id] = new_id

            new_img = {kk: vv for kk, vv in img.items() if kk != 'source_path'}
            new_img['id'] = new_id
            new_img['file_name'] = out_name
            merged_images.append(new_img)
            image_id_to_src[new_id] = abs_src

        for ann in anns:
            old_im = ann.get('image_id')
            new_im = file_to_new_id.get(old_im)
            if new_im is None or new_im not in image_id_to_src:
                continue
            old_cat = ann.get('category_id')
            new_cat = old_to_new_cat.get(old_cat)
            if new_cat is None:
                continue
            new_ann = {kk: vv for kk, vv in ann.items()}
            new_ann['id'] = next_ann_id
            next_ann_id += 1
            new_ann['image_id'] = new_im
            new_ann['category_id'] = new_cat
            merged_anns.append(new_ann)

    categories_list = [
        {'id': iid, 'name': name}
        for name, iid in sorted(name_to_id.items(), key=lambda x: x[1])
    ]
    merged_coco: Dict[str, Any] = {
        'info': first_info,
        'licenses': first_licenses,
        'categories': categories_list,
        'images': merged_images,
        'annotations': merged_anns,
    }
    if on_progress:
        on_progress(20, '合并完成')
    return merged_coco, image_id_to_src, skipped


def load_eda_coco_flatten(
    coco_json_path: str,
    image_dir_fallback: str,
    source_dirs: Optional[Dict[str, str]],
    on_progress: ProgressCallback = None,
) -> Tuple[Dict[str, Any], Dict[int, Path], int]:
    path = Path(coco_json_path)
    if on_progress:
        on_progress(2, '读取 COCO 文件')
    with open(path, 'r', encoding='utf-8') as f:
        coco = json.load(f)

    sd = source_dirs if isinstance(source_dirs, dict) else {}
    if not sd and coco.get('source_dirs'):
        sd = coco['source_dirs']

    base_default = str(Path(image_dir_fallback or path.parent).resolve())

    merged_images: List[Dict[str, Any]] = []
    image_id_to_src: Dict[int, Path] = {}
    skipped = 0

    _imgs_src = coco.get('images') or []
    n_im = len(_imgs_src)
    for j, img in enumerate(_imgs_src):
        iid = img.get('id')
        if iid is None:
            continue
        try:
            iid = int(iid)
        except (TypeError, ValueError):
            continue

        raw_fn = img.get('file_name') or ''
        sp = str(img.get('source_path') or '')
        base = (sd.get(sp) or base_default) if sd else base_default

        pth = Path(raw_fn)
        abs_src = pth if pth.is_absolute() else Path(base) / raw_fn
        if not abs_src.exists():
            for alt in (path.parent / Path(raw_fn).name, Path(base) / Path(raw_fn).name):
                if alt.exists():
                    abs_src = alt
                    break
        if not abs_src.exists():
            skipped += 1
            continue
        out_name = _export_basename(raw_fn)
        if not out_name:
            skipped += 1
            continue

        new_img = {kk: vv for kk, vv in img.items() if kk not in ('source_path',)}
        new_img['file_name'] = out_name
        merged_images.append(new_img)
        image_id_to_src[iid] = abs_src.resolve()
        if on_progress and n_im:
            step = max(1, n_im // 40)
            if j % step == 0 or j == n_im - 1:
                p = 3 + int(16 * (j + 1) / n_im)
                on_progress(min(19, p), f'解析图片 {j + 1}/{n_im}')

    id_set = {im['id'] for im in merged_images}
    merged_anns = [a for a in coco.get('annotations') or [] if a.get('image_id') in id_set]
    out: Dict[str, Any] = {
        'info': dict(coco.get('info') or {}),
        'licenses': coco.get('licenses') or [],
        'categories': coco.get('categories') or [],
        'images': merged_images,
        'annotations': merged_anns,
    }
    if coco.get('image_category_definitions'):
        out['image_category_definitions'] = coco['image_category_definitions']
    if on_progress:
        on_progress(20, '解析完成')
    return out, image_id_to_src, skipped


def build_experiment_zip_bytes(
    *,
    prepared_items: Optional[List[Dict[str, str]]] = None,
    coco_json_path: Optional[str] = None,
    image_dir_fallback: Optional[str] = None,
    source_dirs: Optional[Dict[str, str]] = None,
    train_ratio: float = 0.8,
    seed: int = 42,
    dataset_name: str = 'dataset',
    on_progress: ProgressCallback = None,
    drop_duplicate_basenames: bool = True,
    split_by_source_dir: bool = True,
) -> Tuple[bytes, Dict[str, Any]]:
    """合并多源 COCO，按种子或目录划分 train/valid，打包为 ZIP。"""

    def _p(pct: int, msg: str) -> None:
        if on_progress:
            on_progress(min(100, max(0, int(pct))), msg)

    if prepared_items:
        coco, id_to_path, skipped_load = merge_prepared_items_to_flat_coco(prepared_items, on_progress=_p)
    elif coco_json_path:
        coco, id_to_path, skipped_load = load_eda_coco_flatten(
            coco_json_path, image_dir_fallback or '', source_dirs, on_progress=_p,
        )
    else:
        raise ValueError('需要 prepared_items 或 coco_json_path')

    ids = [int(im['id']) for im in coco.get('images') or []]
    if not ids:
        raise ValueError('没有可导出的图片（请检查路径与文件是否存在）')

    dedupe_meta: Dict[str, Any] = {
        'dedupe_dropped_count': 0,
        'dedupe_dropped': [],
        'dedupe_kept_count': len(ids),
    }
    _p(21, '处理重名图片')
    if not split_by_source_dir:
        if drop_duplicate_basenames:
            coco, id_to_path, dedupe_meta = _dedupe_images_by_basename(coco, id_to_path)
            ids = [int(im['id']) for im in coco.get('images') or []]
            if not ids:
                raise ValueError('没有可导出的图片（请检查路径与文件是否存在）')
            n_drop = int(dedupe_meta.get('dedupe_dropped_count') or 0)
            if n_drop:
                _p(21, f'已丢弃 {n_drop} 张重名图片（保留较小 image_id）')
        else:
            _assert_unique_export_basenames(coco)

    _p(22, '划分 train / valid')
    if split_by_source_dir:
        train_ids, val_ids = _split_train_val_ids_by_source_dir(coco, id_to_path)
    else:
        train_ids, val_ids = _split_train_val_ids(ids, train_ratio, seed)

    if split_by_source_dir:
        if drop_duplicate_basenames:
            keep_train, dropped_train = _dedupe_split_ids_by_basename(coco, train_ids)
            keep_valid, dropped_valid = _dedupe_split_ids_by_basename(coco, val_ids)
            train_ids, val_ids = keep_train, keep_valid
            dedupe_meta = {
                'dedupe_dropped_count': len(dropped_train) + len(dropped_valid),
                'dedupe_dropped': (
                    [{'split': 'train', **x} for x in dropped_train[:250]]
                    + [{'split': 'valid', **x} for x in dropped_valid[:250]]
                ),
                'dedupe_kept_count': len(train_ids) + len(val_ids),
            }
            if dedupe_meta['dedupe_dropped_count'] > 0:
                _p(22, f"已在各 split 内丢弃 {dedupe_meta['dedupe_dropped_count']} 张重名图片（跨 train/valid 同名保留）")
        else:
            _assert_unique_basenames_in_ids(coco, train_ids, 'train')
            _assert_unique_basenames_in_ids(coco, val_ids, 'valid')

    _p(22, '重映射类别 ID（按名称排序，从 0 开始）')
    coco = _remap_categories_sorted_zero(coco)

    info_extra = {
        'description': f'COCOVisualizer experiment export — {dataset_name}',
        'train_ratio': train_ratio,
        'random_seed': seed,
        'train_images': len(train_ids),
        'val_images': len(val_ids),
    }
    base_info = coco.get('info') if isinstance(coco.get('info'), dict) else {}
    coco['info'] = {**base_info, **info_extra}

    train_coco = _coco_subset(coco, train_ids)
    val_coco = _coco_subset(coco, val_ids)
    train_coco['info'] = dict(train_coco.get('info') or {})
    train_coco['info']['split'] = 'train'
    val_coco['info'] = dict(val_coco.get('info') or {})
    val_coco['info']['split'] = 'valid'

    copy_tasks: List[Tuple[str, Path, str]] = []
    missing_copy = 0
    for iid, p in id_to_path.items():
        im = next((x for x in coco['images'] if int(x['id']) == int(iid)), None)
        if not im:
            continue
        fname = im.get('file_name') or Path(p).name
        if not p.exists():
            missing_copy += 1
            continue
        if iid in train_ids:
            copy_tasks.append((fname, p, 'train'))
        elif iid in val_ids:
            copy_tasks.append((fname, p, 'valid'))
    n_copy = len(copy_tasks)

    buf = io.BytesIO()
    ann_name = '_annotations.coco.json'
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        _p(23, '写入 train/valid 标注 JSON')
        zf.writestr(f'train/{ann_name}', json.dumps(train_coco, ensure_ascii=False, indent=2))
        zf.writestr(f'valid/{ann_name}', json.dumps(val_coco, ensure_ascii=False, indent=2))

        packed_train = 0
        packed_val = 0
        for idx, (fname, p, split) in enumerate(copy_tasks):
            data = p.read_bytes()
            zf.writestr(f'{split}/{fname}', data)
            if split == 'train':
                packed_train += 1
            else:
                packed_val += 1
            if n_copy:
                pct = 25 + int(63 * (idx + 1) / n_copy)
                _p(min(88, pct), f'打包图片 {idx + 1}/{n_copy}')
        if n_copy == 0:
            _p(88, '无图片需写入（或文件均缺失）')
        _p(89, '正在写入 ZIP 中央目录并关闭归档…')

    _p(90, '正在生成 ZIP 字节数据…')
    zip_bytes = buf.getvalue()
    zs = len(zip_bytes)
    _p(92, f'ZIP 已生成（{_fmt_bytes(zs)}）')

    stats = {
        'total_images': len(train_ids) + len(val_ids),
        'train': len(train_ids),
        'valid': len(val_ids),
        'skipped_missing_scan': skipped_load,
        'packed_train': packed_train,
        'packed_val': packed_val,
        'missing_copy': missing_copy,
        'seed': seed,
        'train_ratio': train_ratio,
        'dedupe_dropped_count': dedupe_meta.get('dedupe_dropped_count', 0),
        'dedupe_kept_count': dedupe_meta.get('dedupe_kept_count', len(ids)),
        'dedupe_dropped': dedupe_meta.get('dedupe_dropped') or [],
        'drop_duplicate_basenames': drop_duplicate_basenames,
        'split_by_source_dir': split_by_source_dir,
        'zip_size_bytes': zs,
    }
    return zip_bytes, stats
