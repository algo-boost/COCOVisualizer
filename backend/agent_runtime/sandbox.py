"""Agent 沙箱执行核心：等价于原 _exec_code_internal。

把代码里的 print 重定向到捕获列表；把 open() 重定向到临时目录；
注入大量内置函数（导出 / UI / COCO / Skill），并合并已注册的自定义工具。
"""
from __future__ import annotations

import ast
import math
import statistics as _stats
import traceback
from collections import Counter, defaultdict
from typing import Any

from . import builtins as _bi
from ..services import agent_service


def exec_code(code: str, images_list: list, extra_vars: dict | None = None) -> dict[str, Any]:
    """执行用户/LLM 提交的 Python 代码，返回与原 _exec_code_internal 兼容的 dict。"""
    output_lines: list[str] = []
    created_files: list[dict] = []
    ui_actions: list[dict] = []

    def captured_print(*args, sep=' ', end='\n', **kwargs):
        output_lines.append(sep.join(str(a) for a in args))

    io_funcs = _bi.make_io_builtins(captured_print, created_files)
    ui_funcs = _bi.make_ui_builtins(captured_print, ui_actions)
    coco_funcs = _bi.make_coco_builtins(images_list, ui_funcs, io_funcs, captured_print, created_files, extra_vars)
    skill_funcs = _bi.make_skill_builtins()
    patched_open = _bi.make_patched_open(captured_print, created_files)

    custom_tool_funcs = {
        name: info['func']
        for name, info in agent_service.get_tools().items()
        if callable(info.get('func'))
    }

    exec_globals: dict[str, Any] = {
        '__builtins__': __builtins__,
        'images': images_list,
        'Counter': Counter,
        'defaultdict': defaultdict,
        'math': math,
        'statistics': _stats,
        'print': captured_print,
        'open': patched_open,
        **io_funcs,
        **ui_funcs,
        **coco_funcs,
        **skill_funcs,
        **custom_tool_funcs,
        **(extra_vars or {}),
    }

    try:
        tree = ast.parse(code.strip())
        last_expr_value = None
        has_last_expr = isinstance(tree.body[-1], ast.Expr) if tree.body else False
        if has_last_expr:
            before = ast.Module(body=tree.body[:-1], type_ignores=[])
            last_node = tree.body[-1].value
            exec(compile(before, '<code>', 'exec'), exec_globals)
            last_expr_value = eval(compile(ast.Expression(body=last_node), '<expr>', 'eval'), exec_globals)
        else:
            exec(compile(tree, '<code>', 'exec'), exec_globals)

        printed = '\n'.join(output_lines).strip()
        explicit_result = exec_globals.get('result', None)
        final_value = last_expr_value if has_last_expr else explicit_result

        if isinstance(final_value, list) and all(isinstance(x, (int, str)) for x in final_value[:10]):
            image_ids = [x for x in final_value if isinstance(x, (int, str))]
            return {
                'type': 'filter',
                'image_ids': image_ids,
                'output': printed or f'筛选到 {len(image_ids)} 张图片',
                'files': created_files,
                'ui_actions': ui_actions,
            }
        parts: list[str] = []
        if printed:
            parts.append(printed)
        if final_value is not None:
            parts.append(str(final_value))
        return {
            'type': 'report',
            'output': '\n'.join(parts) or '代码执行完成（无输出）',
            'files': created_files,
            'ui_actions': ui_actions,
        }
    except SyntaxError as e:
        return {
            'type': 'error',
            'output': f'语法错误：第 {e.lineno} 行 — {e.msg}',
            'files': created_files,
            'ui_actions': ui_actions,
        }
    except Exception:
        return {
            'type': 'error',
            'output': traceback.format_exc(),
            'files': created_files,
            'ui_actions': ui_actions,
        }
