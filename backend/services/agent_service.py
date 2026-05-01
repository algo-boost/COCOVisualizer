"""Agent 自定义 Python 模块的注册、加载、热重载。

不直接读写文件——通过 repositories.agent_modules_repo 操作。
全局状态（已注册工具/已加载模块）保存在本模块内，供 chat_service / agent_runtime 访问。
"""
from __future__ import annotations

import ast
import importlib.util
import re
from pathlib import Path
from typing import Callable

from .. import config
from ..json_utils import safe_log
from ..repositories import agent_modules_repo

_custom_agent_tools: dict[str, dict] = {}
_custom_agent_modules: dict[str, dict] = {}


def get_tools() -> dict[str, dict]:
    return _custom_agent_tools


def get_modules() -> dict[str, dict]:
    return _custom_agent_modules


class AgentToolRegistrar:
    """插件注册器：脚本里实现 register(registry) 即可注册函数。"""

    def __init__(self, module_id: str, module_name: str):
        self.module_id = module_id
        self.module_name = module_name
        self.registered: list[str] = []

    def add(self, name: str, func: Callable, description: str = ''):
        if not callable(func):
            raise TypeError(f'工具 {name} 不是可调用对象')
        tool_name = str(name).strip()
        if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]{1,63}', tool_name):
            raise ValueError(f'工具名不合法：{tool_name}')
        _custom_agent_tools[tool_name] = {
            'func': func,
            'description': str(description or ''),
            'module_id': self.module_id,
            'module_name': self.module_name,
        }
        self.registered.append(tool_name)
        return func

    def tool(self, name: str | None = None, description: str = ''):
        def _decorator(fn):
            return self.add(name or fn.__name__, fn, description=description)
        return _decorator


def remove_tools_by_module(module_id: str) -> None:
    keys = [k for k, v in _custom_agent_tools.items() if v.get('module_id') == module_id]
    for k in keys:
        _custom_agent_tools.pop(k, None)


def load_module(module_meta: dict) -> dict:
    """加载/重载单个模块并通过 register(registry) 注册工具。"""
    module_id = str(module_meta.get('id', '')).strip()
    module_name = str(module_meta.get('name', '')).strip() or module_id
    module_path = Path(module_meta.get('path', ''))
    if not module_id:
        raise ValueError('模块缺少 id')
    if not module_path.exists():
        raise FileNotFoundError(f'模块文件不存在：{module_path}')

    remove_tools_by_module(module_id)
    mod_name = f'cocovis_agent_mod_{module_id}'
    spec = importlib.util.spec_from_file_location(mod_name, str(module_path))
    if not spec or not spec.loader:
        raise RuntimeError(f'无法加载模块：{module_path.name}')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    register_fn = getattr(module, 'register', None)
    if not callable(register_fn):
        raise ValueError('脚本必须提供 register(registry) 函数')

    registrar = AgentToolRegistrar(module_id=module_id, module_name=module_name)
    register_fn(registrar)
    if not registrar.registered:
        raise ValueError('未注册任何工具，请在 register(registry) 中调用 registry.add(...) 或 @registry.tool')

    module_meta['tools'] = registrar.registered
    module_meta['error'] = ''
    _custom_agent_modules[module_id] = module_meta
    return module_meta


def extract_candidate_functions(py_path: Path) -> list[dict]:
    """提取脚本中可注册的顶层函数（排除私有和 register）。"""
    src = py_path.read_text(encoding='utf-8', errors='replace')
    tree = ast.parse(src)
    out: list[dict] = []
    for node in tree.body:
        if isinstance(node, ast.FunctionDef):
            name = node.name
            if name == 'register' or name.startswith('_'):
                continue
            doc = (ast.get_docstring(node) or '').strip()
            out.append({'name': name, 'description': doc[:160]})
    return out


def register_module_functions(module_meta: dict, selected_names: list[str]) -> dict:
    """脚本无 register() 时，按用户选择函数名进行注册。"""
    module_id = str(module_meta.get('id', '')).strip()
    module_name = str(module_meta.get('name', '')).strip() or module_id
    module_path = Path(module_meta.get('path', ''))
    if not module_path.exists():
        raise FileNotFoundError(f'模块文件不存在：{module_path}')
    remove_tools_by_module(module_id)

    mod_name = f'cocovis_agent_mod_manual_{module_id}'
    spec = importlib.util.spec_from_file_location(mod_name, str(module_path))
    if not spec or not spec.loader:
        raise RuntimeError(f'无法加载模块：{module_path.name}')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    registrar = AgentToolRegistrar(module_id=module_id, module_name=module_name)
    ok: list[str] = []
    for fn_name in selected_names:
        fn = getattr(module, fn_name, None)
        if callable(fn):
            desc = (getattr(fn, '__doc__', '') or '').strip()
            registrar.add(fn_name, fn, description=desc)
            ok.append(fn_name)
    if not ok:
        raise ValueError('未找到可注册函数，请确认函数名是否正确')
    module_meta['tools'] = ok
    module_meta['error'] = ''
    module_meta['manual_registration'] = True
    _custom_agent_modules[module_id] = module_meta
    return module_meta


def reload_enabled_modules() -> None:
    config.AGENT_MODULES_DIR.mkdir(parents=True, exist_ok=True)
    items = agent_modules_repo.load_modules()
    _custom_agent_modules.clear()
    _custom_agent_tools.clear()
    updated: list[dict] = []
    for item in items:
        meta = dict(item)
        if not meta.get('enabled', True):
            updated.append(meta)
            continue
        try:
            load_module(meta)
        except Exception as e:  # noqa: BLE001
            meta['error'] = str(e)
            safe_log(f'[agent] 加载模块失败 {meta.get("name", meta.get("id"))}: {e}')
        updated.append(meta)
    agent_modules_repo.save_modules(updated)


def list_custom_tools_for_prompt() -> str:
    rows: list[str] = []
    for tool_name, info in sorted(_custom_agent_tools.items(), key=lambda x: x[0]):
        desc = info.get('description') or '无描述'
        rows.append(f'- {tool_name}: {desc}')
    return '\n'.join(rows)
