"""数据集相关：扫描目录、加载、合并加载、读取上次记录、列服务器目录。"""
from __future__ import annotations

from pathlib import Path

from flask import Blueprint, jsonify, request

from ..errors import ApiError, api_route
from ..json_utils import json_sanitize
from ..repositories import loader_record_repo
from ..services import dataset_service, image_service

bp = Blueprint('datasets', __name__)


@bp.route('/api/scan_folder', methods=['POST'])
@api_route
def scan_folder():
    data = request.get_json() or {}
    root_path = (data.get('root_path') or '').strip()
    if not root_path:
        raise ApiError('请提供根目录路径 root_path')
    items = image_service.scan_folder_for_coco(root_path)
    for it in items:
        coco_dir = str(Path(it['coco_path']).parent)
        rec = loader_record_repo.read_record(coco_dir)
        if rec:
            it['loader_record'] = rec
    return jsonify({'success': True, 'items': items})


@bp.route('/api/get_loader_record', methods=['POST'])
@api_route
def get_loader_record():
    data = request.get_json() or {}
    coco_dir = (data.get('coco_dir') or data.get('path') or '').strip()
    if not coco_dir:
        return jsonify({'success': False, 'record': None})
    p = Path(coco_dir).resolve()
    if p.is_file():
        coco_dir = str(p.parent)
    rec = loader_record_repo.read_record(coco_dir)
    return jsonify({'success': True, 'record': rec})


@bp.route('/api/load_dataset', methods=['POST'])
@api_route
def load_dataset():
    data = request.get_json() or {}
    if not isinstance(data, dict):
        data = {}
    coco_json_path = data.get('coco_json_path')
    image_dir = data.get('image_dir', '')
    dataset_name = data.get('dataset_name', 'dataset')
    meta_filter_mapping = data.get('meta_filter_mapping') if isinstance(data.get('meta_filter_mapping'), dict) else None
    if not coco_json_path:
        raise ApiError('缺少COCO JSON路径')
    payload = dataset_service.load_single(coco_json_path, image_dir or None, dataset_name, meta_filter_mapping)
    return jsonify(json_sanitize({'success': True, **payload}))


@bp.route('/api/load_dataset_merged', methods=['POST'])
@api_route
def load_dataset_merged():
    data = request.get_json() or {}
    if not isinstance(data, dict):
        data = {}
    items = data.get('items', [])
    dataset_name = (data.get('dataset_name') or 'merged').strip() or 'merged'
    root_path = (data.get('root_path') or data.get('merge_output_dir') or '').strip()
    meta_filter_mapping = data.get('meta_filter_mapping') if isinstance(data.get('meta_filter_mapping'), dict) else None
    if not items:
        raise ApiError('请至少选择一项（items 不能为空）')
    prepared = []
    for it in items:
        fixed = dataset_service.prepare_merge_item(it)
        if fixed:
            prepared.append(fixed)
    if not prepared:
        raise ApiError('未找到可加载的数据。请确认目录中存在图片文件，或路径可访问。')
    payload = dataset_service.load_merged(prepared, dataset_name, root_path or None, meta_filter_mapping)
    return jsonify(json_sanitize({'success': True, **payload}))


@bp.route('/api/list_server_paths', methods=['POST'])
@api_route
def list_server_paths():
    data = request.get_json() or {}
    if not isinstance(data, dict):
        data = {}
    base_path = data.get('base_path', '/')
    path = Path(base_path)
    if not path.exists():
        raise ApiError('路径不存在')
    if not path.is_dir():
        raise ApiError('不是目录')
    items = []
    for item in sorted(path.iterdir()):
        try:
            items.append({
                'name': item.name,
                'path': str(item),
                'is_dir': item.is_dir(),
                'is_file': item.is_file(),
            })
        except PermissionError:
            continue
    return jsonify({'success': True, 'items': items, 'current_path': str(path)})
