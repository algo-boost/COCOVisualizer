#!/usr/bin/env python3
import os
import sys
import json
import math
import webbrowser
import threading
from pathlib import Path

if getattr(sys, 'frozen', False):
    _app_dir = Path(sys.executable).parent
    _meipass = Path(sys._MEIPASS)
    _template_folder = str(_meipass / 'templates')
    _static_folder = str(_meipass / 'static')
    _upload_folder = _app_dir / 'uploads'
    _data_dir = _app_dir / 'data'
else:
    _app_dir = Path(__file__).resolve().parent
    _template_folder = 'templates'
    _static_folder = 'static'
    _upload_folder = _app_dir / 'uploads'
    _data_dir = _app_dir / 'data'

if str(_app_dir) not in sys.path:
    sys.path.insert(0, str(_app_dir))

from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from coco_eda_utils import CocoEDA
from PIL import Image
import numpy as np
import pandas as pd

app = Flask(__name__,
            template_folder=_template_folder,
            static_folder=_static_folder)
CORS(app)

# 配置
UPLOAD_FOLDER = _upload_folder
UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)
app.config['UPLOAD_FOLDER'] = str(UPLOAD_FOLDER)
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB

# 存储当前加载的数据集
current_datasets = {}

# 持久化 dataset_id -> 路径等信息，服务重启后可按需重新加载
DATA_DIR = _data_dir
DATA_DIR.mkdir(parents=True, exist_ok=True)
DATASETS_MAP_FILE = DATA_DIR / 'datasets.json'


def _datasets_map_path():
    return DATASETS_MAP_FILE


def _persist_dataset(dataset_id, coco_json_path, dataset_name='dataset', image_dir=None):
    """加载数据集时写入 dataset_id -> 路径 映射，便于重启后按需恢复"""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = _datasets_map_path()
    data = {}
    if path.exists():
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except Exception:
            pass
    data[dataset_id] = {
        'coco_json_path': str(coco_json_path),
        'dataset_name': dataset_name or 'dataset',
        'image_dir': image_dir or ''
    }
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def _get_dataset_info(dataset_id):
    """从持久化文件读取 dataset_id 对应的路径信息"""
    path = _datasets_map_path()
    if not path.exists():
        return None
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return data.get(dataset_id)
    except Exception:
        return None


def _ensure_dataset_loaded(dataset_id):
    """若内存中无该数据集，则从持久化映射重新加载并放入 current_datasets；返回 eda 或 None"""
    if not dataset_id:
        return None
    if dataset_id in current_datasets:
        return current_datasets[dataset_id]
    info = _get_dataset_info(dataset_id)
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
    _fill_image_dimensions(eda)
    current_datasets[dataset_id] = eda
    return eda


MAX_VERSIONS = 30
VERSIONS_DIR_NAME = '.coco_versions'


def _versions_dir(coco_json_path):
    """返回该 COCO 文件对应的版本目录路径"""
    p = Path(coco_json_path)
    return p.parent / VERSIONS_DIR_NAME / p.name


def _manifest_path(coco_json_path):
    return _versions_dir(coco_json_path) / 'manifest.json'


def _version_file_path(coco_json_path, version_id):
    return _versions_dir(coco_json_path) / f'{version_id}.json'


def _save_version(coco_json_path, coco_data, comment=None):
    """保存当前内容为一条版本记录，返回 version_id。comment 为版本说明；首版默认为 init。"""
    from datetime import datetime
    version_id = datetime.now().strftime('%Y%m%d_%H%M%S')
    saved_at = datetime.now().isoformat()
    vdir = _versions_dir(coco_json_path)
    vdir.mkdir(parents=True, exist_ok=True)
    vfile = _version_file_path(coco_json_path, version_id)
    with open(vfile, 'w', encoding='utf-8') as f:
        json.dump(coco_data, f, indent=2, ensure_ascii=False)
    manifest_path = _manifest_path(coco_json_path)
    if manifest_path.exists():
        with open(manifest_path, 'r', encoding='utf-8') as f:
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
    to_remove = manifest[MAX_VERSIONS:]
    manifest = manifest[:MAX_VERSIONS]
    for old in to_remove:
        old_file = _version_file_path(coco_json_path, old['id'])
        if old_file.exists():
            try:
                old_file.unlink()
            except Exception:
                pass
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    return version_id


def _list_versions(coco_json_path):
    """返回版本列表 [{ id, saved_at }, ...]，按时间倒序"""
    manifest_path = _manifest_path(coco_json_path)
    if not manifest_path.exists():
        return []
    with open(manifest_path, 'r', encoding='utf-8') as f:
        manifest = json.load(f)
    return manifest


def _rollback_to_version(coco_json_path, version_id):
    """将 COCO 文件恢复为指定版本"""
    import shutil
    vfile = _version_file_path(coco_json_path, version_id)
    if not vfile.exists():
        raise FileNotFoundError(f'版本不存在: {version_id}')
    shutil.copy(vfile, coco_json_path)


def safe_float(val):
    """安全转换为float，处理NaN和None"""
    if val is None:
        return None
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return None
        return f
    except (ValueError, TypeError):
        return None


def safe_tolist(series):
    """安全转换Series为列表，处理NaN值"""
    if series is None or len(series) == 0:
        return []
    result = []
    for x in series.tolist():
        val = safe_float(x)
        result.append(val if val is not None else 0)
    return result


def extract_bbox(bbox_val):
    """安全提取bbox值"""
    if bbox_val is None:
        return None
    
    try:
        # numpy数组
        if isinstance(bbox_val, np.ndarray):
            if bbox_val.size == 0:
                return None
            # 检查是否全为NaN
            if np.all(np.isnan(bbox_val)):
                return None
            return [safe_float(x) or 0 for x in bbox_val.tolist()]
        
        # 列表或元组
        if isinstance(bbox_val, (list, tuple)):
            if len(bbox_val) == 0:
                return None
            return [safe_float(x) or 0 for x in bbox_val]
        
        # 其他可迭代对象
        if hasattr(bbox_val, '__iter__'):
            lst = list(bbox_val)
            if len(lst) == 0:
                return None
            return [safe_float(x) or 0 for x in lst]
    except Exception:
        pass
    
    return None


@app.route('/')
def index():
    """主页面"""
    return render_template('index.html')


@app.route('/api/upload', methods=['POST'])
def upload_file():
    """上传COCO JSON文件"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': '没有文件'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': '文件名为空'}), 400
        
        if not file.filename.endswith('.json'):
            return jsonify({'error': '请上传JSON文件'}), 400
        
        # 保存文件
        filename = file.filename
        filepath = UPLOAD_FOLDER / filename
        file.save(str(filepath))
        
        return jsonify({
            'success': True,
            'filename': filename,
            'filepath': str(filepath)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


COCO_ANNOTATION_FILENAME = '_annotations.coco.json'


def _add_normalized_bbox_stats(eda, df):
    """在 bbox 特征 df 上合并图片宽高，并增加归一化列（相对图像尺寸 0-1）。若 images 无 width/height 则跳过归一化。"""
    if df.empty or 'image_id' not in df.columns:
        return df
    if 'width' not in eda.images_df.columns or 'height' not in eda.images_df.columns:
        return df
    imgs = eda.images_df[['id', 'width', 'height']].rename(
        columns={'id': 'image_id', 'width': 'img_w', 'height': 'img_h'}
    )
    df = df.merge(imgs, on='image_id', how='left')
    # 避免除零
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


def _resolve_image_path(eda, row):
    """根据 eda 和 images_df 的一行解析图片文件路径，与 get_image 逻辑一致。返回 Path 或 None。"""
    image_dir = eda.image_dir
    if getattr(eda, 'source_dirs', None) and row.get('source_path') is not None:
        image_dir = eda.source_dirs.get(str(row['source_path']), image_dir) or image_dir
    if not image_dir:
        image_dir = str(Path(eda.coco_json_path).parent)
    file_name = row.get('file_name')
    if not file_name:
        return None
    file_path = Path(file_name)
    if file_path.is_absolute():
        path = file_path
    else:
        path = Path(image_dir) / file_name
    if path.exists():
        return path
    for alt in (Path(eda.coco_json_path).parent / file_name, Path(image_dir) / Path(file_name).name):
        if alt.exists():
            return alt
    return None


def _fill_image_dimensions(eda):
    """若 images_df 中某张图缺少 width/height，则预加载该图并用 Pillow 计算宽高并写回。"""
    if eda.images_df.empty or 'file_name' not in eda.images_df.columns:
        return
    for col in ('width', 'height'):
        if col not in eda.images_df.columns:
            eda.images_df[col] = np.nan
    for idx, row in eda.images_df.iterrows():
        w, h = row.get('width'), row.get('height')
        if pd.notna(w) and pd.notna(h) and int(w) > 0 and int(h) > 0:
            continue
        path = _resolve_image_path(eda, row)
        if path is None:
            continue
        try:
            with Image.open(path) as im:
                w, h = im.size
            eda.images_df.at[idx, 'width'] = int(w)
            eda.images_df.at[idx, 'height'] = int(h)
        except Exception:
            pass


def _scan_folder_for_coco(root_path):
    """递归扫描目录下所有 _annotations.coco.json，返回 [{coco_path, image_dir, relative_path}, ...]"""
    root = Path(root_path).resolve()
    if not root.exists() or not root.is_dir():
        return []
    items = []
    try:
        for p in root.rglob(COCO_ANNOTATION_FILENAME):
            if p.is_file():
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
                    'relative_path': relative_path or p.parent.name
                })
    except Exception:
        pass
    return items


@app.route('/api/scan_folder', methods=['POST'])
def scan_folder():
    """扫描根目录，递归查找所有 _annotations.coco.json（图片与 COCO 同目录，文件名固定）"""
    try:
        data = request.get_json() or {}
        root_path = data.get('root_path', '').strip()
        if not root_path:
            return jsonify({'error': '请提供根目录路径 root_path'}), 400
        items = _scan_folder_for_coco(root_path)
        return jsonify({'success': True, 'items': items})
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@app.route('/api/load_dataset', methods=['POST'])
def load_dataset():
    """加载COCO数据集并返回所有可视化数据"""
    try:
        data = request.get_json()
        coco_json_path = data.get('coco_json_path')
        image_dir = data.get('image_dir', '')
        dataset_name = data.get('dataset_name', 'dataset')
        
        if not coco_json_path:
            return jsonify({'error': '缺少COCO JSON路径'}), 400
        
        # 检查路径是否存在
        coco_path = Path(coco_json_path)
        if not coco_path.exists():
            return jsonify({'error': f'文件不存在: {coco_json_path}'}), 400
        
        # 加载数据集
        eda = CocoEDA(
            coco_json_path=str(coco_path),
            name=dataset_name,
            image_dir=image_dir if image_dir else None
        )
        _fill_image_dimensions(eda)
        
        # 存储数据集
        dataset_id = f"{dataset_name}_{len(current_datasets)}"
        current_datasets[dataset_id] = eda
        _persist_dataset(dataset_id, coco_path, dataset_name, image_dir if image_dir else None)
        
        # 计算所有特征并归一化（相对图像尺寸）
        df = eda.compute_bbox_features()
        df = _add_normalized_bbox_stats(eda, df)
        
        # 获取基本信息
        class_dist = eda.get_class_distribution()
        categories = class_dist['name'].tolist()
        
        # 准备所有可视化数据
        visualization_data = {
            'dataset_id': dataset_id,
            'dataset_name': dataset_name,
            'num_images': len(eda.images_df),
            'num_annotations': len(eda.annotations_df),
            'num_categories': len(eda.categories_df),
            'categories': categories,
            'class_distribution': class_dist.to_dict('records'),
            
            # 类别分布数据
            'class_distribution_pie': {
                'labels': class_dist['name'].tolist(),
                'values': [int(x) for x in class_dist['count'].tolist()],
                'percentages': [safe_float(x) or 0 for x in class_dist['percentage'].tolist()]
            },
            
            # 类别数量柱状图数据
            'class_counts': {
                'categories': class_dist['name'].tolist(),
                'counts': [int(x) for x in class_dist['count'].tolist()]
            },
            
            # 每个类别的详细数据（用于密度图等）
            'category_data': {}
        }
        
        # 为每个类别准备详细数据
        for category in categories:
            cat_df = df[df['name'] == category]
            
            visualization_data['category_data'][category] = {
                'count': len(cat_df),
                'area': {
                    'values': safe_tolist(cat_df['area_norm']) if 'area_norm' in cat_df.columns else [],
                    'sqrt_values': safe_tolist(cat_df['sqrt_area_norm']) if 'sqrt_area_norm' in cat_df.columns else []
                },
                'dimensions': {
                    'width': safe_tolist(cat_df['w_norm']) if 'w_norm' in cat_df.columns else [],
                    'height': safe_tolist(cat_df['h_norm']) if 'h_norm' in cat_df.columns else [],
                    'max_side': safe_tolist(cat_df['max_side_norm']) if 'max_side_norm' in cat_df.columns else [],
                    'min_side': safe_tolist(cat_df['min_side_norm']) if 'min_side_norm' in cat_df.columns else []
                },
                'ratios': {
                    'wh_ratio': safe_tolist(cat_df['wh_ratio']) if 'wh_ratio' in cat_df.columns else [],
                    'aspect_ratio': safe_tolist(cat_df['aspect_ratio']) if 'aspect_ratio' in cat_df.columns else []
                },
                'spatial': {
                    'center_x': safe_tolist(cat_df['c_x_norm']) if 'c_x_norm' in cat_df.columns else [],
                    'center_y': safe_tolist(cat_df['c_y_norm']) if 'c_y_norm' in cat_df.columns else []
                }
            }
        
        # 所有类别的汇总统计（归一化值，用于箱线图等）
        visualization_data['all_categories_stats'] = {
            'area': {
                'category': df['name'].tolist() if 'name' in df.columns else [],
                'values': safe_tolist(df['area_norm']) if 'area_norm' in df.columns else []
            },
            'sqrt_area': {
                'category': df['name'].tolist() if 'name' in df.columns else [],
                'values': safe_tolist(df['sqrt_area_norm']) if 'sqrt_area_norm' in df.columns else []
            },
            'max_side': {
                'category': df['name'].tolist() if 'name' in df.columns else [],
                'values': safe_tolist(df['max_side_norm']) if 'max_side_norm' in df.columns else []
            },
            'wh_ratio': {
                'category': df['name'].tolist() if 'name' in df.columns else [],
                'values': safe_tolist(df['wh_ratio']) if 'wh_ratio' in df.columns else []
            },
            'aspect_ratio': {
                'category': df['name'].tolist() if 'name' in df.columns else [],
                'values': safe_tolist(df['aspect_ratio']) if 'aspect_ratio' in df.columns else []
            },
            'width': {
                'category': df['name'].tolist() if 'name' in df.columns else [],
                'values': safe_tolist(df['w_norm']) if 'w_norm' in df.columns else []
            },
            'height': {
                'category': df['name'].tolist() if 'name' in df.columns else [],
                'values': safe_tolist(df['h_norm']) if 'h_norm' in df.columns else []
            },
            'center': {
                'category': df['name'].tolist() if 'name' in df.columns else [],
                'x': safe_tolist(df['c_x_norm']) if 'c_x_norm' in df.columns else [],
                'y': safe_tolist(df['c_y_norm']) if 'c_y_norm' in df.columns else []
            }
        }
        # 未归一化（像素值）统计，供前端切换
        visualization_data['all_categories_stats_raw'] = {
            'area': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['area']) if 'area' in df.columns else []},
            'sqrt_area': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['sqrt_area']) if 'sqrt_area' in df.columns else []},
            'max_side': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['max_side']) if 'max_side' in df.columns else []},
            'wh_ratio': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['wh_ratio']) if 'wh_ratio' in df.columns else []},
            'aspect_ratio': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['aspect_ratio']) if 'aspect_ratio' in df.columns else []},
            'width': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['w']) if 'w' in df.columns else []},
            'height': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['h']) if 'h' in df.columns else []},
            'center': {'category': df['name'].tolist() if 'name' in df.columns else [], 'x': safe_tolist(df['c_x']) if 'c_x' in df.columns else [], 'y': safe_tolist(df['c_y']) if 'c_y' in df.columns else []}
        }
        visualization_data['category_data_raw'] = {}
        for category in categories:
            cat_df = df[df['name'] == category]
            visualization_data['category_data_raw'][category] = {
                'count': len(cat_df),
                'area': {'values': safe_tolist(cat_df['area']) if 'area' in cat_df.columns else [], 'sqrt_values': safe_tolist(cat_df['sqrt_area']) if 'sqrt_area' in cat_df.columns else []},
                'dimensions': {'width': safe_tolist(cat_df['w']) if 'w' in cat_df.columns else [], 'height': safe_tolist(cat_df['h']) if 'h' in cat_df.columns else [], 'max_side': safe_tolist(cat_df['max_side']) if 'max_side' in cat_df.columns else [], 'min_side': safe_tolist(cat_df['min_side']) if 'min_side' in cat_df.columns else []},
                'ratios': {'wh_ratio': safe_tolist(cat_df['wh_ratio']) if 'wh_ratio' in cat_df.columns else [], 'aspect_ratio': safe_tolist(cat_df['aspect_ratio']) if 'aspect_ratio' in cat_df.columns else []},
                'spatial': {'center_x': safe_tolist(cat_df['c_x']) if 'c_x' in cat_df.columns else [], 'center_y': safe_tolist(cat_df['c_y']) if 'c_y' in cat_df.columns else []}
            }
        
        # 首次打开：若该 COCO 尚无任何版本记录，则自动保存为 init 版本（只要打开过就留记录）
        if not _list_versions(eda.coco_json_path):
            with open(eda.coco_json_path, 'r', encoding='utf-8') as f:
                coco_data = json.load(f)
            _save_version(eda.coco_json_path, coco_data, comment='init')
        
        return jsonify({
            'success': True,
            **visualization_data
        })
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


def _load_dataset_merged_impl(items, dataset_name='merged'):
    """合并多个 COCO（每个 item 含 coco_path, image_dir, relative_path），生成一个 CocoEDA 并返回 (eda, visualization_data)。"""
    from datetime import datetime
    name_to_id = {}
    next_cat_id = 1
    merged_images = []
    merged_annotations = []
    source_dirs = {}
    next_image_id = 1
    next_ann_id = 1
    old_to_new_image = {}
    old_to_new_cat = {}

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
        file_to_new_id = {}
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
    merged_coco = {
        'images': merged_images,
        'annotations': merged_annotations,
        'categories': categories_list,
        'source_dirs': source_dirs
    }
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    merged_path = DATA_DIR / f'merged_{dataset_name}_{ts}.json'
    with open(merged_path, 'w', encoding='utf-8') as f:
        json.dump(merged_coco, f, indent=2, ensure_ascii=False)
    eda = CocoEDA(coco_json_path=str(merged_path), name=dataset_name, image_dir=list(source_dirs.values())[0] if source_dirs else None)
    eda.source_dirs = source_dirs
    _fill_image_dimensions(eda)
    df = eda.compute_bbox_features()
    df = _add_normalized_bbox_stats(eda, df)
    class_dist = eda.get_class_distribution()
    categories = class_dist['name'].tolist()
    visualization_data = {
        'num_images': len(eda.images_df),
        'num_annotations': len(eda.annotations_df),
        'num_categories': len(eda.categories_df),
        'categories': categories,
        'class_distribution': class_dist.to_dict('records'),
        'class_distribution_pie': {
            'labels': class_dist['name'].tolist(),
            'values': [int(x) for x in class_dist['count'].tolist()],
            'percentages': [safe_float(x) or 0 for x in class_dist['percentage'].tolist()]
        },
        'class_counts': {
            'categories': class_dist['name'].tolist(),
            'counts': [int(x) for x in class_dist['count'].tolist()]
        },
        'category_data': {},
        'all_categories_stats': {
            'area': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['area_norm']) if 'area_norm' in df.columns else []},
            'sqrt_area': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['sqrt_area_norm']) if 'sqrt_area_norm' in df.columns else []},
            'max_side': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['max_side_norm']) if 'max_side_norm' in df.columns else []},
            'wh_ratio': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['wh_ratio']) if 'wh_ratio' in df.columns else []},
            'aspect_ratio': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['aspect_ratio']) if 'aspect_ratio' in df.columns else []},
            'width': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['w_norm']) if 'w_norm' in df.columns else []},
            'height': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['h_norm']) if 'h_norm' in df.columns else []},
            'center': {'category': df['name'].tolist() if 'name' in df.columns else [], 'x': safe_tolist(df['c_x_norm']) if 'c_x_norm' in df.columns else [], 'y': safe_tolist(df['c_y_norm']) if 'c_y_norm' in df.columns else []}
        }
    }
    for category in categories:
        cat_df = df[df['name'] == category]
        visualization_data['category_data'][category] = {
            'count': len(cat_df),
            'area': {'values': safe_tolist(cat_df['area_norm']) if 'area_norm' in cat_df.columns else [], 'sqrt_values': safe_tolist(cat_df['sqrt_area_norm']) if 'sqrt_area_norm' in cat_df.columns else []},
            'dimensions': {'width': safe_tolist(cat_df['w_norm']) if 'w_norm' in cat_df.columns else [], 'height': safe_tolist(cat_df['h_norm']) if 'h_norm' in cat_df.columns else [], 'max_side': safe_tolist(cat_df['max_side_norm']) if 'max_side_norm' in cat_df.columns else [], 'min_side': safe_tolist(cat_df['min_side_norm']) if 'min_side_norm' in cat_df.columns else []},
            'ratios': {'wh_ratio': safe_tolist(cat_df['wh_ratio']) if 'wh_ratio' in cat_df.columns else [], 'aspect_ratio': safe_tolist(cat_df['aspect_ratio']) if 'aspect_ratio' in cat_df.columns else []},
            'spatial': {'center_x': safe_tolist(cat_df['c_x_norm']) if 'c_x_norm' in cat_df.columns else [], 'center_y': safe_tolist(cat_df['c_y_norm']) if 'c_y_norm' in cat_df.columns else []}
        }
    visualization_data['all_categories_stats_raw'] = {
        'area': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['area']) if 'area' in df.columns else []},
        'sqrt_area': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['sqrt_area']) if 'sqrt_area' in df.columns else []},
        'max_side': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['max_side']) if 'max_side' in df.columns else []},
        'wh_ratio': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['wh_ratio']) if 'wh_ratio' in df.columns else []},
        'aspect_ratio': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['aspect_ratio']) if 'aspect_ratio' in df.columns else []},
        'width': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['w']) if 'w' in df.columns else []},
        'height': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['h']) if 'h' in df.columns else []},
        'center': {'category': df['name'].tolist() if 'name' in df.columns else [], 'x': safe_tolist(df['c_x']) if 'c_x' in df.columns else [], 'y': safe_tolist(df['c_y']) if 'c_y' in df.columns else []}
    }
    visualization_data['category_data_raw'] = {}
    for category in categories:
        cat_df = df[df['name'] == category]
        visualization_data['category_data_raw'][category] = {
            'count': len(cat_df),
            'area': {'values': safe_tolist(cat_df['area']) if 'area' in cat_df.columns else [], 'sqrt_values': safe_tolist(cat_df['sqrt_area']) if 'sqrt_area' in cat_df.columns else []},
            'dimensions': {'width': safe_tolist(cat_df['w']) if 'w' in cat_df.columns else [], 'height': safe_tolist(cat_df['h']) if 'h' in cat_df.columns else [], 'max_side': safe_tolist(cat_df['max_side']) if 'max_side' in cat_df.columns else [], 'min_side': safe_tolist(cat_df['min_side']) if 'min_side' in cat_df.columns else []},
            'ratios': {'wh_ratio': safe_tolist(cat_df['wh_ratio']) if 'wh_ratio' in cat_df.columns else [], 'aspect_ratio': safe_tolist(cat_df['aspect_ratio']) if 'aspect_ratio' in cat_df.columns else []},
            'spatial': {'center_x': safe_tolist(cat_df['c_x']) if 'c_x' in cat_df.columns else [], 'center_y': safe_tolist(cat_df['c_y']) if 'c_y' in cat_df.columns else []}
        }
    return eda, visualization_data


@app.route('/api/load_dataset_merged', methods=['POST'])
def load_dataset_merged():
    """多选加载：根据扫描结果合并多个 COCO 为一个数据集（图片带 source_path，支持按目录筛选）"""
    try:
        data = request.get_json()
        items = data.get('items', [])
        dataset_name = (data.get('dataset_name') or 'merged').strip() or 'merged'
        if not items:
            return jsonify({'error': '请至少选择一项（items 不能为空）'}), 400
        eda, visualization_data = _load_dataset_merged_impl(items, dataset_name)
        dataset_id = f"{dataset_name}_{len(current_datasets)}"
        current_datasets[dataset_id] = eda
        _persist_dataset(dataset_id, eda.coco_json_path, dataset_name, eda.image_dir)
        if not _list_versions(eda.coco_json_path):
            with open(eda.coco_json_path, 'r', encoding='utf-8') as f:
                coco_data = json.load(f)
            _save_version(eda.coco_json_path, coco_data, comment='init')
        visualization_data['dataset_id'] = dataset_id
        visualization_data['dataset_name'] = dataset_name
        return jsonify({'success': True, **visualization_data})
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@app.route('/api/get_filtered_data', methods=['POST'])
def get_filtered_data():
    """根据筛选条件返回过滤后的数据"""
    try:
        data = request.get_json()
        dataset_id = data.get('dataset_id')
        selected_categories = data.get('selected_categories', [])
        
        eda = _ensure_dataset_loaded(dataset_id)
        if eda is None:
            return jsonify({'error': '数据集不存在'}), 400
        df = eda.compute_bbox_features()
        df = _add_normalized_bbox_stats(eda, df)
        
        # 应用筛选
        if selected_categories and len(selected_categories) > 0:
            df = df[df['name'].isin(selected_categories)]
            if df.empty:
                return jsonify({'error': '筛选后无数据'}), 400
        
        # 返回筛选后的数据（归一化值）
        filtered_data = {
            'area': {
                'category': df['name'].tolist() if 'name' in df.columns else [],
                'values': safe_tolist(df['area_norm']) if 'area_norm' in df.columns else []
            },
            'sqrt_area': {
                'category': df['name'].tolist() if 'name' in df.columns else [],
                'values': safe_tolist(df['sqrt_area_norm']) if 'sqrt_area_norm' in df.columns else []
            },
            'max_side': {
                'category': df['name'].tolist() if 'name' in df.columns else [],
                'values': safe_tolist(df['max_side_norm']) if 'max_side_norm' in df.columns else []
            },
            'wh_ratio': {
                'category': df['name'].tolist() if 'name' in df.columns else [],
                'values': safe_tolist(df['wh_ratio']) if 'wh_ratio' in df.columns else []
            },
            'aspect_ratio': {
                'category': df['name'].tolist() if 'name' in df.columns else [],
                'values': safe_tolist(df['aspect_ratio']) if 'aspect_ratio' in df.columns else []
            },
            'width': {
                'category': df['name'].tolist() if 'name' in df.columns else [],
                'values': safe_tolist(df['w_norm']) if 'w_norm' in df.columns else []
            },
            'height': {
                'category': df['name'].tolist() if 'name' in df.columns else [],
                'values': safe_tolist(df['h_norm']) if 'h_norm' in df.columns else []
            },
            'center': {
                'category': df['name'].tolist() if 'name' in df.columns else [],
                'x': safe_tolist(df['c_x_norm']) if 'c_x_norm' in df.columns else [],
                'y': safe_tolist(df['c_y_norm']) if 'c_y_norm' in df.columns else []
            }
        }
        filtered_data_raw = {
            'area': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['area']) if 'area' in df.columns else []},
            'sqrt_area': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['sqrt_area']) if 'sqrt_area' in df.columns else []},
            'max_side': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['max_side']) if 'max_side' in df.columns else []},
            'wh_ratio': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['wh_ratio']) if 'wh_ratio' in df.columns else []},
            'aspect_ratio': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['aspect_ratio']) if 'aspect_ratio' in df.columns else []},
            'width': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['w']) if 'w' in df.columns else []},
            'height': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['h']) if 'h' in df.columns else []},
            'center': {'category': df['name'].tolist() if 'name' in df.columns else [], 'x': safe_tolist(df['c_x']) if 'c_x' in df.columns else [], 'y': safe_tolist(df['c_y']) if 'c_y' in df.columns else []}
        }
        return jsonify({
            'success': True,
            'data': filtered_data,
            'data_raw': filtered_data_raw
        })
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@app.route('/api/get_images_by_category', methods=['POST'])
def get_images_by_category():
    """根据类别获取图片列表
    
    筛选逻辑：返回包含选中类别的图片，但每张图片显示所有标注（不只是选中类别的）
    """
    try:
        data = request.get_json()
        dataset_id = data.get('dataset_id')
        selected_categories = data.get('selected_categories', [])
        
        eda = _ensure_dataset_loaded(dataset_id)
        if eda is None:
            return jsonify({'error': '数据集不存在'}), 400
        df = eda.compute_bbox_features()
        
        # 找出包含选中类别的图片ID
        if selected_categories and len(selected_categories) > 0:
            filtered_df = df[df['name'].isin(selected_categories)]
            if filtered_df.empty:
                return jsonify({'error': '筛选后无图片'}), 400
            target_image_ids = filtered_df['image_id'].unique()
        else:
            target_image_ids = df['image_id'].unique()
        
        # 获取这些图片的所有标注（不只是选中类别的）
        all_df = df[df['image_id'].isin(target_image_ids)]
        
        # 按图片ID分组
        image_groups = all_df.groupby('image_id')
        
        images_list = []
        for image_id, group_df in image_groups:
            # 获取图片信息
            img_info = eda.images_df[eda.images_df['id'] == image_id].iloc[0]
            
            # 获取该图片的所有标注 - 动态返回所有原始字段
            annotations = []
            for _, row in group_df.iterrows():
                ann = {'category': row['name']}  # 类别名称必须有
                
                # 遍历所有列，动态添加
                for col in row.index:
                    if col == 'name':  # 已添加为category
                        continue
                    
                    val = row[col]
                    
                    # 跳过空值
                    if val is None:
                        continue
                    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
                        continue
                    
                    # 处理不同类型
                    if col == 'bbox':
                        bbox = extract_bbox(val)
                        if bbox:
                            ann['bbox'] = bbox
                    elif col == 'segmentation':
                        # segmentation可能很大，只标记有无
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
            
            # width/height 可能不在 COCO images 中，从 bbox 推断
            if 'width' in img_info.index and 'height' in img_info.index and pd.notna(img_info.get('width')) and pd.notna(img_info.get('height')):
                img_w, img_h = int(img_info['width']), int(img_info['height'])
            else:
                img_w, img_h = 0, 0
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
                'num_annotations': len(annotations)
            }
            # 图片级别扩展字段（COCO 扩展）；支持一图多类 image_categories（数组）
            img_cats = img_info.get('image_categories')
            if img_cats is not None:
                if isinstance(img_cats, str):
                    try:
                        img_cats = json.loads(img_cats) if img_cats.strip() else ['未分类']
                    except (json.JSONDecodeError, AttributeError):
                        img_cats = [img_info.get('image_category', '未分类')]
                else:
                    img_cats = list(img_cats) if img_cats else ['未分类']
            else:
                single = img_info.get('image_category')
                img_cats = [single] if single is not None and str(single).strip() else ['未分类']
            img_item['image_category'] = img_cats[0] if img_cats else '未分类'
            img_item['image_categories'] = img_cats
            if 'note' in img_info and img_info['note'] is not None:
                img_item['note'] = str(img_info['note'])
            if 'source_path' in img_info and img_info['source_path'] is not None:
                img_item['source_path'] = str(img_info['source_path'])
            images_list.append(img_item)
        
        # 按图片ID排序
        images_list.sort(key=lambda x: x['image_id'])
        
        return jsonify({
            'success': True,
            'images': images_list,
            'image_dir': str(eda.image_dir),
            'total_images': len(images_list)
        })
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@app.route('/api/get_image', methods=['GET'])
def get_image():
    """获取图片文件（用于显示）"""
    try:
        dataset_id = request.args.get('dataset_id')
        file_name = request.args.get('file_name')
        
        eda = _ensure_dataset_loaded(dataset_id)
        if eda is None:
            return jsonify({'error': '数据集不存在'}), 400
        
        source_path = request.args.get('source_path')
        image_dir = eda.image_dir
        if source_path and getattr(eda, 'source_dirs', None):
            image_dir = eda.source_dirs.get(source_path) or image_dir
        if not image_dir:
            image_dir = str(Path(eda.coco_json_path).parent)
        
        # 处理相对路径和绝对路径
        file_path = Path(file_name)
        if file_path.is_absolute():
            image_path = file_path
        else:
            image_path = Path(image_dir) / file_name
        
        if not image_path.exists():
            # 尝试其他可能的路径
            alt_paths = [
                Path(eda.coco_json_path).parent / file_name,
                Path(image_dir) / Path(file_name).name,
            ]
            for alt_path in alt_paths:
                if alt_path.exists():
                    image_path = alt_path
                    break
            else:
                return jsonify({'error': f'图片文件不存在: {file_name}'}), 404
        
        from flask import send_file
        return send_file(str(image_path))
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@app.route('/api/save_annotations', methods=['POST'])
def save_annotations():
    """保存标注到COCO JSON文件"""
    try:
        data = request.get_json()
        dataset_id = data.get('dataset_id')
        images_data = data.get('images', [])
        
        eda = _ensure_dataset_loaded(dataset_id)
        if eda is None:
            return jsonify({'error': '数据集不存在'}), 400
        
        # 读取原始COCO文件
        with open(eda.coco_json_path, 'r', encoding='utf-8') as f:
            coco_data = json.load(f)
        
        # 更新标注
        existing_ann_ids = set(ann['id'] for ann in coco_data.get('annotations', []))
        max_ann_id = max(existing_ann_ids) if existing_ann_ids else 0
        
        for img_data in images_data:
            image_id = img_data['image_id']
            new_annotations = img_data['annotations']
            
            # 移除该图片的旧标注
            coco_data['annotations'] = [
                ann for ann in coco_data.get('annotations', []) 
                if ann.get('image_id') != image_id
            ]
            
            # 添加新标注
            for ann in new_annotations:
                max_ann_id += 1
                # 获取category_id
                cat_id = ann.get('category_id')
                if cat_id is None:
                    # 从类别名查找
                    cat_name = ann.get('category', '')
                    for cat in coco_data.get('categories', []):
                        if cat['name'] == cat_name:
                            cat_id = cat['id']
                            break
                    if cat_id is None:
                        # 新增类别
                        cat_id = max(c['id'] for c in coco_data.get('categories', [{'id': 0}])) + 1
                        coco_data.setdefault('categories', []).append({
                            'id': cat_id,
                            'name': cat_name
                        })
                
                coco_ann = {
                    'id': max_ann_id,
                    'image_id': image_id,
                    'category_id': cat_id,
                    'bbox': ann.get('bbox'),
                    'area': ann.get('area') or (ann['bbox'][2] * ann['bbox'][3] if ann.get('bbox') else 0),
                    'iscrowd': ann.get('iscrowd', 0)
                }
                coco_data['annotations'].append(coco_ann)
        
        # 保存文件
        backup_path = str(eda.coco_json_path) + '.backup'
        import shutil
        shutil.copy(eda.coco_json_path, backup_path)
        
        with open(eda.coco_json_path, 'w', encoding='utf-8') as f:
            json.dump(coco_data, f, indent=2, ensure_ascii=False)
        
        return jsonify({'success': True, 'message': '保存成功'})
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@app.route('/api/save_image_metadata', methods=['POST'])
def save_image_metadata():
    """保存图片级分类和备注到原 COCO 文件（直接更新 images 中的 image_category、note）"""
    try:
        data = request.get_json()
        dataset_id = data.get('dataset_id')
        images_meta = data.get('images', [])  # [{ image_id, image_category, note }, ...]
        
        eda = _ensure_dataset_loaded(dataset_id)
        if eda is None:
            return jsonify({'error': '数据集不存在'}), 400
        
        with open(eda.coco_json_path, 'r', encoding='utf-8') as f:
            coco_data = json.load(f)
        
        meta_by_id = {item['image_id']: item for item in images_meta}
        images_list = coco_data.get('images', [])
        
        for img in images_list:
            iid = img.get('id')
            if iid is None:
                continue
            if iid in meta_by_id:
                meta = meta_by_id[iid]
                cats = meta.get('image_categories')
                if cats is None:
                    single = meta.get('image_category', '未分类')
                    cats = [single] if single else ['未分类']
                img['image_categories'] = list(cats)
                img['image_category'] = cats[0] if cats else '未分类'
                img['note'] = meta.get('note', '')
        
        # 写入前先保存为一条版本记录（支持版本说明 comment）
        version_comment = data.get('version_comment') or data.get('comment') or ''
        version_id = _save_version(eda.coco_json_path, coco_data, comment=version_comment)
        
        with open(eda.coco_json_path, 'w', encoding='utf-8') as f:
            json.dump(coco_data, f, indent=2, ensure_ascii=False)
        
        return jsonify({'success': True, 'message': '图片级分类与备注已保存', 'version_id': version_id})
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@app.route('/api/list_versions', methods=['POST'])
def list_versions():
    """列出当前数据集的 COCO 版本记录"""
    try:
        data = request.get_json()
        dataset_id = data.get('dataset_id')
        eda = _ensure_dataset_loaded(dataset_id)
        if eda is None:
            return jsonify({'error': '数据集不存在'}), 400
        versions = _list_versions(eda.coco_json_path)
        return jsonify({'success': True, 'versions': versions})
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@app.route('/api/rollback_version', methods=['POST'])
def rollback_version():
    """回滚到指定版本（恢复 COCO 文件为该版本内容）"""
    try:
        data = request.get_json()
        dataset_id = data.get('dataset_id')
        version_id = data.get('version_id')
        eda = _ensure_dataset_loaded(dataset_id)
        if eda is None:
            return jsonify({'error': '数据集不存在'}), 400
        if not version_id:
            return jsonify({'error': '请指定 version_id'}), 400
        _rollback_to_version(eda.coco_json_path, version_id)
        return jsonify({'success': True, 'message': f'已回滚到版本 {version_id}'})
    except FileNotFoundError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@app.route('/api/list_server_paths', methods=['POST'])
def list_server_paths():
    """列出服务器上的路径"""
    try:
        data = request.get_json()
        base_path = data.get('base_path', '/')
        
        path = Path(base_path)
        if not path.exists():
            return jsonify({'error': '路径不存在'}), 400
        
        if not path.is_dir():
            return jsonify({'error': '不是目录'}), 400
        
        # 列出目录内容
        items = []
        for item in sorted(path.iterdir()):
            try:
                items.append({
                    'name': item.name,
                    'path': str(item),
                    'is_dir': item.is_dir(),
                    'is_file': item.is_file()
                })
            except PermissionError:
                continue
        
        return jsonify({
            'success': True,
            'items': items,
            'current_path': str(path)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    port = 6009
    url = f'http://127.0.0.1:{port}'
    # 打包模式下自动打开浏览器
    if getattr(sys, 'frozen', False):
        def _open_browser():
            import time
            time.sleep(1.5)
            webbrowser.open(url)
        threading.Thread(target=_open_browser, daemon=True).start()
    app.run(debug=not getattr(sys, 'frozen', False), host='0.0.0.0', port=port)
