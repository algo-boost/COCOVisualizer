"""Agent 自定义模块 / Skill zip 导入。"""
from __future__ import annotations

import time
from pathlib import Path

from flask import Blueprint, jsonify, request

from .. import config
from ..errors import ApiError, api_route
from ..repositories import agent_modules_repo
from ..services import agent_service, skill_service

bp = Blueprint('agent_modules', __name__)


@bp.route('/api/agent_modules', methods=['GET'])
@api_route
def list_modules():
    items = agent_modules_repo.load_modules()
    tools_map = agent_service.get_tools()
    out = []
    for it in items:
        mid = str(it.get('id', ''))
        tools = [k for k, v in tools_map.items() if v.get('module_id') == mid]
        out.append({
            'id': mid,
            'name': it.get('name', mid),
            'enabled': bool(it.get('enabled', True)),
            'path': it.get('path', ''),
            'tools': tools or it.get('tools', []),
            'error': it.get('error', ''),
            'pending_registration': bool(it.get('pending_registration', False)),
            'register_candidates': it.get('register_candidates', []),
        })
    return jsonify({'success': True, 'modules': out})


@bp.route('/api/agent_skills', methods=['GET'])
@api_route
def list_skills():
    skills = agent_modules_repo.load_skills()
    skills.sort(key=lambda x: int(x.get('load_count', 0)), reverse=True)
    return jsonify({'success': True, 'skills': skills})


@bp.route('/api/agent_modules/upload', methods=['POST'])
@api_route
def upload_module():
    if 'file' not in request.files:
        raise ApiError('未找到文件')
    f = request.files['file']
    filename = Path(f.filename or '').name
    if not filename.lower().endswith('.py'):
        raise ApiError('仅支持 .py 脚本')

    config.AGENT_MODULES_DIR.mkdir(parents=True, exist_ok=True)
    module_id = f'mod_{int(time.time() * 1000)}'
    save_path = config.AGENT_MODULES_DIR / f'{module_id}_{filename}'
    f.save(str(save_path))

    module_name = (request.form.get('name') or Path(filename).stem or module_id).strip()
    enabled = str(request.form.get('enabled', 'true')).lower() != 'false'
    meta = {
        'id': module_id,
        'name': module_name,
        'path': str(save_path),
        'enabled': enabled,
        'tools': [],
        'error': '',
    }
    items = agent_modules_repo.load_modules()
    items.insert(0, meta)

    if enabled:
        try:
            agent_service.load_module(meta)
        except Exception as e:  # noqa: BLE001
            err = str(e)
            if 'register(registry)' in err:
                try:
                    candidates = agent_service.extract_candidate_functions(save_path)
                except Exception as pe:  # noqa: BLE001
                    candidates = []
                    err = f'{err}；解析函数失败：{pe}'
                meta['enabled'] = False
                meta['pending_registration'] = True
                meta['register_candidates'] = candidates
                meta['error'] = '' if candidates else err
            else:
                meta['error'] = err
                meta['enabled'] = False

    agent_modules_repo.save_modules(items)
    return jsonify({'success': True, 'module': meta, 'need_registration': bool(meta.get('pending_registration'))})


@bp.route('/api/agent_modules/<module_id>/register_functions', methods=['POST'])
@api_route
def register_module_functions(module_id):
    data = request.get_json() or {}
    fn_names = data.get('functions', [])
    if not isinstance(fn_names, list) or not fn_names:
        raise ApiError('请至少选择一个函数')
    fn_names = [str(x).strip() for x in fn_names if str(x).strip()]
    if not fn_names:
        raise ApiError('无有效函数名')

    items = agent_modules_repo.load_modules()
    found = next((it for it in items if str(it.get('id')) == module_id), None)
    if not found:
        raise ApiError('模块不存在', status=404)

    try:
        agent_service.register_module_functions(found, fn_names)
        found['enabled'] = True
        found['pending_registration'] = False
        found['register_candidates'] = []
        found['error'] = ''
    except Exception as e:  # noqa: BLE001
        found['enabled'] = False
        found['error'] = str(e)
        agent_modules_repo.save_modules(items)
        raise ApiError(str(e))

    agent_modules_repo.save_modules(items)
    return jsonify({'success': True, 'module': found})


@bp.route('/api/agent_modules/import_skill_zip', methods=['POST'])
@api_route
def import_skill_zip():
    if 'file' not in request.files:
        raise ApiError('未找到文件')
    f = request.files['file']
    filename = Path(f.filename or '').name
    if not filename.lower().endswith('.zip'):
        raise ApiError('仅支持 .zip')

    config.AGENT_MODULES_DIR.mkdir(parents=True, exist_ok=True)
    sid = f'skill_{int(time.time() * 1000)}'
    root_dir = config.AGENT_MODULES_DIR / sid
    root_dir.mkdir(parents=True, exist_ok=True)
    zip_path = root_dir / filename
    f.save(str(zip_path))

    try:
        report = skill_service.import_skill_zip(zip_path, root_dir, filename)
    except ValueError as e:
        raise ApiError(str(e))
    return jsonify({'success': True, **report})


@bp.route('/api/agent_modules/<module_id>/toggle', methods=['POST'])
@api_route
def toggle_module(module_id):
    data = request.get_json() or {}
    enabled = bool(data.get('enabled', True))
    items = agent_modules_repo.load_modules()
    found = None
    for it in items:
        if str(it.get('id')) == module_id:
            it['enabled'] = enabled
            it['error'] = ''
            found = it
            break
    if not found:
        raise ApiError('模块不存在', status=404)

    if enabled:
        try:
            agent_service.load_module(found)
        except Exception as e:  # noqa: BLE001
            found['enabled'] = False
            found['error'] = str(e)
    else:
        agent_service.remove_tools_by_module(module_id)

    agent_modules_repo.save_modules(items)
    return jsonify({'success': True, 'module': found})


@bp.route('/api/agent_modules/<module_id>', methods=['DELETE'])
@api_route
def delete_module(module_id):
    items = agent_modules_repo.load_modules()
    kept = []
    target = None
    for it in items:
        if str(it.get('id')) == module_id:
            target = it
        else:
            kept.append(it)
    if not target:
        raise ApiError('模块不存在', status=404)

    agent_service.remove_tools_by_module(module_id)
    agent_service.get_modules().pop(module_id, None)
    p = Path(target.get('path', ''))
    try:
        if p.exists():
            p.unlink()
    except Exception:
        pass
    agent_modules_repo.save_modules(kept)
    return jsonify({'success': True})
