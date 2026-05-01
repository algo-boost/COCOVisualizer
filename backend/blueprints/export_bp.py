"""实验数据集导出（同步 + NDJSON 流式）。"""
from __future__ import annotations

from flask import Blueprint, jsonify, request

from ..errors import ApiError, api_route
from ..services import export_service

bp = Blueprint('export', __name__)


@bp.route('/api/export_experiment_dataset', methods=['POST'])
def export_experiment_dataset():
    """同步打包：?stream=1 切换为 NDJSON 进度流。"""
    data = request.get_json() or {}
    use_stream = str(request.args.get('stream') or '').strip() == '1'
    try:
        if use_stream:
            return export_service.run_export_streaming(data)
        return jsonify(export_service.run_export(data))
    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    except Exception as e:  # noqa: BLE001
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/api/export_experiment_dataset_stream', methods=['POST'])
def export_experiment_dataset_stream():
    """实验数据集导出（NDJSON 流，兼容旧路径）。"""
    data = request.get_json() or {}
    try:
        return export_service.run_export_streaming(data)
    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    except Exception as e:  # noqa: BLE001
        return jsonify({'success': False, 'error': str(e)}), 500
