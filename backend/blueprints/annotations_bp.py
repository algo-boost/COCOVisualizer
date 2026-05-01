"""标注 / 类别 / 图片元数据保存。"""
from __future__ import annotations

from flask import Blueprint, jsonify, request

from ..errors import ApiError, api_route
from ..services import annotation_service

bp = Blueprint('annotations', __name__)


@bp.route('/api/save_annotations', methods=['POST'])
@api_route
def save_annotations():
    data = request.get_json() or {}
    if not isinstance(data, dict):
        data = {}
    dataset_id = data.get('dataset_id')
    images_data = data.get('images', [])
    try:
        annotation_service.save_annotations(dataset_id, images_data)
    except FileNotFoundError as e:
        raise ApiError(str(e))
    return jsonify({'success': True, 'message': '保存成功'})


@bp.route('/api/rename_category', methods=['POST'])
@api_route
def rename_category():
    data = request.get_json() or {}
    dataset_id = data.get('dataset_id')
    old_name = (data.get('old_name') or '').strip()
    new_name = (data.get('new_name') or '').strip()
    if not old_name or not new_name:
        raise ApiError('请提供 old_name 和 new_name')
    try:
        out = annotation_service.rename_category(dataset_id, old_name, new_name)
    except FileNotFoundError as e:
        raise ApiError(str(e))
    except ValueError as e:
        raise ApiError(str(e))
    return jsonify({'success': True, **out})


@bp.route('/api/save_image_metadata', methods=['POST'])
@api_route
def save_image_metadata():
    data = request.get_json() or {}
    if not isinstance(data, dict):
        data = {}
    dataset_id = data.get('dataset_id')
    images_meta = data.get('images', [])
    try:
        out = annotation_service.save_image_metadata(
            dataset_id, images_meta,
            skip_version=bool(data.get('skip_version', False)),
            image_category_definitions=data.get('image_category_definitions'),
            version_comment=str(data.get('version_comment') or data.get('comment') or ''),
        )
    except FileNotFoundError as e:
        raise ApiError(str(e))
    return jsonify({'success': True, 'message': '图片级分类与备注已保存', **out})
