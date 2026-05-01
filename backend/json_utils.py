"""JSON 序列化与数值清洗工具。"""
from __future__ import annotations

import math
from typing import Any

import numpy as np


def safe_log(msg: str) -> None:
    """写日志到 stderr，避免 Broken pipe 影响业务接口。"""
    import sys
    try:
        print(msg, file=sys.stderr)
    except (BrokenPipeError, OSError, ValueError):
        pass


def json_sanitize(o: Any) -> Any:
    """将 numpy/pandas 标量、ndarray 等转为 jsonify 可用的 Python 原生类型。"""
    if o is None:
        return None
    if isinstance(o, dict):
        return {str(k): json_sanitize(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [json_sanitize(v) for v in o]
    if isinstance(o, np.ndarray):
        return json_sanitize(o.tolist())
    if isinstance(o, np.generic):
        try:
            return json_sanitize(o.item())
        except Exception:
            return None
    if isinstance(o, float) and (math.isnan(o) or math.isinf(o)):
        return None
    if isinstance(o, (str, bool, int)):
        return o
    try:
        from datetime import date, datetime
        if isinstance(o, (datetime, date)):
            return o.isoformat()
    except Exception:
        pass
    return o


def safe_float(val: Any) -> float | None:
    """安全转换为 float，处理 NaN/Inf/None。"""
    if val is None:
        return None
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return None
        return f
    except (ValueError, TypeError):
        return None


def safe_tolist(series) -> list:
    """安全转换 Series 为列表，NaN/None 用 0 占位（用于直方图）。"""
    if series is None or len(series) == 0:
        return []
    out = []
    for x in series.tolist():
        v = safe_float(x)
        out.append(v if v is not None else 0)
    return out


def safe_score_tolist(series) -> list[float]:
    """提取有效置信度分数列表。允许 0–100 形式自动归一化到 0–1。"""
    if series is None or len(series) == 0:
        return []
    out: list[float] = []
    for x in series.tolist():
        v = safe_float(x)
        if v is None or math.isinf(v):
            continue
        if 0 <= v <= 1:
            out.append(v)
        elif 0 <= v <= 100:
            out.append(v / 100.0)
        else:
            out.append(v)
    return out


def extract_bbox(bbox_val: Any) -> list[float] | None:
    """安全提取 bbox 值为 [x, y, w, h] 列表。"""
    if bbox_val is None:
        return None
    try:
        if isinstance(bbox_val, np.ndarray):
            if bbox_val.size == 0:
                return None
            if np.all(np.isnan(bbox_val)):
                return None
            return [safe_float(x) or 0 for x in bbox_val.tolist()]
        if isinstance(bbox_val, (list, tuple)):
            if len(bbox_val) == 0:
                return None
            return [safe_float(x) or 0 for x in bbox_val]
        if hasattr(bbox_val, '__iter__'):
            lst = list(bbox_val)
            if len(lst) == 0:
                return None
            return [safe_float(x) or 0 for x in lst]
    except Exception:
        pass
    return None


__all__ = [
    'safe_log',
    'json_sanitize',
    'safe_float',
    'safe_tolist',
    'safe_score_tolist',
    'extract_bbox',
]
