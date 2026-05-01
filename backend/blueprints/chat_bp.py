"""AI Chat：流式聊天 / 临时文件下载 / 上传 / 手动运行代码。"""
from __future__ import annotations

from pathlib import Path

from flask import Blueprint, jsonify, request, send_file

from ..errors import ApiError, api_route
from ..repositories import temp_files_repo
from ..services import chat_service

bp = Blueprint('chat', __name__)


@bp.route('/api/chat', methods=['POST'])
def chat_proxy():
    """Agent 模式：LLM 写代码 → 自动执行 → 喂回真实结果 → 流式输出最终结论。"""
    data = request.get_json() or {}
    return chat_service.stream_chat(data)


@bp.route('/api/chat/download/<file_id>')
@api_route
def chat_download(file_id: str):
    """下载临时文件（内存找不到时自动从磁盘扫描兜底）。"""
    temp_files_repo.cleanup()
    info = temp_files_repo.get(file_id)
    if not info or not Path(info['path']).exists():
        info = temp_files_repo.find_on_disk(file_id)
    if not info:
        raise ApiError('文件不存在或已过期（超过 1 小时）', status=404)

    path = info['path']
    filename = info['filename']
    ext = Path(filename).suffix.lower()
    mime_map = {
        '.csv': 'text/csv; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.txt': 'text/plain; charset=utf-8',
        '.md': 'text/plain; charset=utf-8',
        '.zip': 'application/zip',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.pdf': 'application/pdf',
    }
    mimetype = mime_map.get(ext, 'application/octet-stream')
    return send_file(path, as_attachment=True, download_name=filename, mimetype=mimetype)


@bp.route('/api/chat/upload', methods=['POST'])
@api_route
def chat_upload():
    """接收用户上传的文件，返回解析后的内容。"""
    if 'file' not in request.files:
        raise ApiError('未找到文件')
    file = request.files['file']
    filename = file.filename or 'upload'
    raw = file.read()
    try:
        return jsonify(chat_service.parse_chat_upload(filename, raw))
    except ValueError as e:
        raise ApiError(str(e))


@bp.route('/api/chat/run_code', methods=['POST'])
@api_route
def chat_run_code():
    """手动执行 Python 代码（用于代码块的手动运行按钮）。"""
    data = request.get_json() or {}
    code = (data.get('code') or '').strip()
    dataset_id = data.get('dataset_id')
    if not code:
        raise ApiError('代码为空')
    result = chat_service.run_code_manual(code, dataset_id)
    if result['type'] == 'error':
        return jsonify({'error': result['output']}), 500
    if result['type'] == 'filter':
        return jsonify({
            'success': True, 'type': 'filter',
            'image_ids': result['image_ids'], 'count': len(result['image_ids']),
            'output': result.get('output', ''),
            'files': result.get('files', []),
            'ui_actions': result.get('ui_actions', []),
        })
    return jsonify({
        'success': True, 'type': 'report',
        'output': result['output'],
        'files': result.get('files', []),
        'ui_actions': result.get('ui_actions', []),
    })
