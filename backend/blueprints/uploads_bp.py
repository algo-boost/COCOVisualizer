"""文件上传：单 JSON 文件 / 拖拽 bundle。"""
from __future__ import annotations

from pathlib import Path

from flask import Blueprint, jsonify, request

from .. import config
from ..errors import ApiError, api_route
from ..services import image_service

bp = Blueprint('uploads', __name__)


@bp.route('/api/upload', methods=['POST'])
@api_route
def upload_file():
    """上传 COCO JSON 文件"""
    if 'file' not in request.files:
        raise ApiError('没有文件')
    file = request.files['file']
    if not file.filename:
        raise ApiError('文件名为空')
    if not file.filename.endswith('.json'):
        raise ApiError('请上传JSON文件')
    filename = Path(file.filename).name
    filepath = config.UPLOAD_FOLDER / filename
    file.save(str(filepath))
    return jsonify({'success': True, 'filename': filename, 'filepath': str(filepath)})


@bp.route('/api/upload_drop_bundle', methods=['POST'])
@api_route
def upload_drop_bundle():
    """上传拖拽的目录/文件集合，保留相对层级，返回服务端根目录路径。"""
    files = request.files.getlist('files')
    paths = request.form.getlist('paths')
    if not files:
        raise ApiError('没有可上传的文件')
    if paths and len(paths) != len(files):
        raise ApiError('上传参数不一致')
    bundle_root, saved = image_service.save_uploaded_drop_bundle(files, paths)
    if saved == 0:
        raise ApiError('未保存任何文件')
    return jsonify({'success': True, 'root_path': str(bundle_root), 'saved_files': saved})
