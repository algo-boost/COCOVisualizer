"""版本历史。"""
from __future__ import annotations

from flask import Blueprint, jsonify, request

from ..errors import ApiError, api_route
from ..repositories import versions_repo
from ..services import dataset_service

bp = Blueprint('versions', __name__)


@bp.route('/api/list_versions', methods=['POST'])
@api_route
def list_versions():
    data = request.get_json() or {}
    if not isinstance(data, dict):
        data = {}
    eda = dataset_service.ensure_loaded(data.get('dataset_id'))
    if eda is None:
        raise ApiError('数据集不存在')
    return jsonify({'success': True, 'versions': versions_repo.list_versions(eda.coco_json_path)})


@bp.route('/api/rollback_version', methods=['POST'])
@api_route
def rollback_version():
    data = request.get_json() or {}
    if not isinstance(data, dict):
        data = {}
    dataset_id = data.get('dataset_id')
    version_id = data.get('version_id')
    eda = dataset_service.ensure_loaded(dataset_id)
    if eda is None:
        raise ApiError('数据集不存在')
    if not version_id:
        raise ApiError('请指定 version_id')
    try:
        versions_repo.rollback_to_version(eda.coco_json_path, version_id)
    except FileNotFoundError as e:
        raise ApiError(str(e), status=404)
    return jsonify({'success': True, 'message': f'已回滚到版本 {version_id}'})
