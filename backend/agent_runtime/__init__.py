"""Agent 代码沙箱：在受限环境里执行 LLM/用户提交的 Python 代码。

入口：`exec_code(code, images_list, extra_vars)`，返回与原 _exec_code_internal 兼容的 dict。
"""
from .sandbox import exec_code

__all__ = ['exec_code']
