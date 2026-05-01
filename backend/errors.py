"""统一错误处理与 API 响应工具。

替代散落在各路由的 try/except + traceback 模板。
"""
from __future__ import annotations

import functools
import traceback
from typing import Callable

from flask import jsonify

from .json_utils import safe_log


class ApiError(Exception):
    """显式 4xx 错误。message 直接作为响应 error 字段。"""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = int(status)
        self.message = str(message)


def api_error(message: str, status: int = 400):
    return jsonify({'error': str(message)}), int(status)


def api_route(fn: Callable):
    """装饰路由：自动捕获异常并返回统一 JSON 错误。

    - ApiError → 直接用其 status / message。
    - 其他 → 500，附 traceback（便于调试，与原代码一致）。
    """

    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except ApiError as exc:
            return jsonify({'error': exc.message}), exc.status
        except Exception as exc:  # noqa: BLE001
            tb = traceback.format_exc()
            safe_log(f'[{fn.__name__}] {exc}\n{tb}')
            return jsonify({'error': str(exc), 'traceback': tb}), 500

    return wrapper


__all__ = ['ApiError', 'api_error', 'api_route']
