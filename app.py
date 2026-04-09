#!/usr/bin/env python3
import os
import re
import sys
import json
import math
import tempfile
import zipfile
import time
import importlib.util
import subprocess
import webbrowser
import threading
from pathlib import Path

if getattr(sys, 'frozen', False):
    _app_dir = Path(sys.executable).parent
    _meipass = Path(sys._MEIPASS)
    _template_folder = str(_meipass / 'templates')
    _static_folder = str(_meipass / 'static')
    _upload_folder = _app_dir / 'uploads'
    _data_dir = _app_dir / 'data'
else:
    _app_dir = Path(__file__).resolve().parent
    _template_folder = 'templates'
    _static_folder = 'static'
    _upload_folder = _app_dir / 'uploads'
    _data_dir = _app_dir / 'data'

if str(_app_dir) not in sys.path:
    sys.path.insert(0, str(_app_dir))

from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from coco_eda_utils import CocoEDA
from experiment_export import build_experiment_zip_bytes
from PIL import Image
import numpy as np
import pandas as pd

app = Flask(__name__,
            template_folder=_template_folder,
            static_folder=_static_folder)
CORS(app)


def _safe_log(msg: str):
    """写日志到 stderr，避免 Broken pipe 影响业务接口。"""
    try:
        print(msg, file=sys.stderr)
    except (BrokenPipeError, OSError, ValueError):
        pass


def _json_sanitize(o):
    """将 numpy/pandas 标量、ndarray 等转为 Flask jsonify 可用的 Python 原生类型。
    Darwin 等导出在 images 中含 mask_null 等字段，读入 DataFrame 后会变成 numpy.bool_，
    直接 jsonify 会报「Object of type bool is not JSON serializable」（实为 numpy 标量）。"""
    if o is None:
        return None
    if isinstance(o, dict):
        return {str(k): _json_sanitize(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_json_sanitize(v) for v in o]
    if isinstance(o, np.ndarray):
        return _json_sanitize(o.tolist())
    if isinstance(o, np.generic):
        try:
            return _json_sanitize(o.item())
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


def _infer_image_category_definitions(coco_data: dict):
    """从 COCO images 中推断图片分类定义（兼容 image_category / image_categories）。
    若已有 image_category_definitions，则在其基础上补齐缺失类别。"""
    if not isinstance(coco_data, dict):
        return None
    images = coco_data.get('images') or []
    if not isinstance(images, list):
        images = []

    existing = coco_data.get('image_category_definitions') or {}
    existing_cats = existing.get('categories') if isinstance(existing, dict) else None
    existing_colors = existing.get('colors') if isinstance(existing, dict) else None
    existing_multi = existing.get('multi_select') if isinstance(existing, dict) else None

    collected = []
    for img in images:
        if not isinstance(img, dict):
            continue
        cats = img.get('image_categories')
        if isinstance(cats, str):
            try:
                parsed = json.loads(cats) if cats.strip() else []
                cats = parsed if isinstance(parsed, list) else [cats]
            except Exception:
                cats = [cats]
        if isinstance(cats, (list, tuple)):
            for c in cats:
                s = str(c).strip()
                if s:
                    collected.append(s)
        else:
            single = img.get('image_category')
            s = str(single).strip() if single is not None else ''
            if s:
                collected.append(s)

    # COCO 未写入 image_category_definitions.categories，且各图也无任何图片级标签时，
    # 不生成仅含「未分类」的占位定义，否则前端会用它覆盖应用内全局默认的多级图片分类列表。
    explicit_in_file = isinstance(existing_cats, list) and len(existing_cats) > 0
    if not explicit_in_file and len(collected) == 0:
        return None

    # 去重并保持顺序；固定把“未分类”放第一位
    ordered = []
    seen = set()
    base = []
    if isinstance(existing_cats, list):
        base.extend([str(x).strip() for x in existing_cats if str(x).strip()])
    base.extend(collected)
    for c in base:
        if c not in seen:
            seen.add(c)
            ordered.append(c)
    if '未分类' in seen:
        ordered = ['未分类'] + [c for c in ordered if c != '未分类']
    else:
        ordered = ['未分类'] + ordered

    colors = existing_colors if isinstance(existing_colors, dict) else {}
    out_colors = {}
    for c in ordered:
        if c in colors and isinstance(colors[c], str) and colors[c].strip():
            out_colors[c] = colors[c]

    return {
        'categories': ordered,
        'colors': out_colors,
        'multi_select': bool(existing_multi) if existing_multi is not None else False,
    }

# 配置
UPLOAD_FOLDER = _upload_folder
try:
    UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)
except OSError as e:
    if getattr(sys, 'frozen', False):
        print(f'[警告] 无法在可执行文件旁创建 uploads 目录: {UPLOAD_FOLDER}', file=sys.stderr)
        print(f'  错误: {e}', file=sys.stderr)
        print('  请将程序放在有写权限的目录（如解压后的文件夹）再运行。', file=sys.stderr)
    raise
app.config['UPLOAD_FOLDER'] = str(UPLOAD_FOLDER)
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB

# 存储当前加载的数据集
current_datasets = {}

# 持久化 dataset_id -> 路径等信息，服务重启后可按需重新加载
DATA_DIR = _data_dir
try:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
except OSError as e:
    if getattr(sys, 'frozen', False):
        print(f'[警告] 无法在可执行文件旁创建 data 目录: {DATA_DIR}', file=sys.stderr)
        print(f'  错误: {e}', file=sys.stderr)
        print('  请将程序放在有写权限的目录（如解压后的文件夹）再运行。', file=sys.stderr)
    raise
DATASETS_MAP_FILE = DATA_DIR / 'datasets.json'
AGENT_MODULES_DIR = DATA_DIR / 'agent_modules'
AGENT_MODULES_MAP_FILE = DATA_DIR / 'agent_modules.json'
AGENT_SKILLS_MAP_FILE = DATA_DIR / 'agent_skills.json'
_custom_agent_tools = {}  # tool_name -> {'func', 'description', 'module_id', 'module_name'}
_custom_agent_modules = {}  # module_id -> metadata


def _datasets_map_path():
    return DATASETS_MAP_FILE


def _persist_dataset(dataset_id, coco_json_path, dataset_name='dataset', image_dir=None):
    """加载数据集时写入 dataset_id -> 路径 映射，便于重启后按需恢复"""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = _datasets_map_path()
    data = {}
    if path.exists():
        try:
            with open(path, 'r', encoding='utf-8') as f:
                loaded = json.load(f)
                if isinstance(loaded, dict):
                    data = loaded
        except Exception:
            pass
    data[dataset_id] = {
        'coco_json_path': str(coco_json_path),
        'dataset_name': dataset_name or 'dataset',
        'image_dir': image_dir or ''
    }
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def _get_dataset_info(dataset_id):
    """从持久化文件读取 dataset_id 对应的路径信息"""
    path = _datasets_map_path()
    if not path.exists():
        return None
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return None
        return data.get(dataset_id)
    except Exception:
        return None


def _agent_modules_map_path():
    return AGENT_MODULES_MAP_FILE


def _load_agent_modules_map():
    path = _agent_modules_map_path()
    if not path.exists():
        return []
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except Exception:
        return []


def _save_agent_modules_map(items):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(_agent_modules_map_path(), 'w', encoding='utf-8') as f:
        json.dump(items, f, indent=2, ensure_ascii=False)


class _AgentToolRegistrar:
    """插件注册器：脚本里实现 register(registry) 即可注册函数。"""
    def __init__(self, module_id: str, module_name: str):
        self.module_id = module_id
        self.module_name = module_name
        self.registered = []

    def add(self, name, func, description=''):
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

    def tool(self, name=None, description=''):
        def _decorator(fn):
            return self.add(name or fn.__name__, fn, description=description)
        return _decorator


def _remove_tools_by_module(module_id: str):
    keys = [k for k, v in _custom_agent_tools.items() if v.get('module_id') == module_id]
    for k in keys:
        _custom_agent_tools.pop(k, None)


def _load_agent_module(module_meta: dict):
    """加载/重载单个模块并注册工具。"""
    module_id = str(module_meta.get('id', '')).strip()
    module_name = str(module_meta.get('name', '')).strip() or module_id
    module_path = Path(module_meta.get('path', ''))
    if not module_id:
        raise ValueError('模块缺少 id')
    if not module_path.exists():
        raise FileNotFoundError(f'模块文件不存在：{module_path}')

    _remove_tools_by_module(module_id)
    mod_name = f'cocovis_agent_mod_{module_id}'
    spec = importlib.util.spec_from_file_location(mod_name, str(module_path))
    if not spec or not spec.loader:
        raise RuntimeError(f'无法加载模块：{module_path.name}')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    register_fn = getattr(module, 'register', None)
    if not callable(register_fn):
        raise ValueError('脚本必须提供 register(registry) 函数')

    registrar = _AgentToolRegistrar(module_id=module_id, module_name=module_name)
    register_fn(registrar)
    if not registrar.registered:
        raise ValueError('未注册任何工具，请在 register(registry) 中调用 registry.add(...) 或 @registry.tool')

    module_meta['tools'] = registrar.registered
    module_meta['error'] = ''
    _custom_agent_modules[module_id] = module_meta
    return module_meta


def _extract_candidate_functions(py_path: Path):
    """提取脚本中可注册的顶层函数（排除私有和 register）。"""
    src = py_path.read_text(encoding='utf-8', errors='replace')
    tree = __import__('ast').parse(src)
    out = []
    for node in tree.body:
        if isinstance(node, __import__('ast').FunctionDef):
            name = node.name
            if name == 'register' or name.startswith('_'):
                continue
            doc = (__import__('ast').get_docstring(node) or '').strip()
            out.append({'name': name, 'description': doc[:160]})
    return out


def _register_module_functions(module_meta: dict, selected_names: list):
    """脚本无 register() 时，按用户选择函数名进行注册。"""
    module_id = str(module_meta.get('id', '')).strip()
    module_name = str(module_meta.get('name', '')).strip() or module_id
    module_path = Path(module_meta.get('path', ''))
    if not module_path.exists():
        raise FileNotFoundError(f'模块文件不存在：{module_path}')
    _remove_tools_by_module(module_id)

    mod_name = f'cocovis_agent_mod_manual_{module_id}'
    spec = importlib.util.spec_from_file_location(mod_name, str(module_path))
    if not spec or not spec.loader:
        raise RuntimeError(f'无法加载模块：{module_path.name}')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    registrar = _AgentToolRegistrar(module_id=module_id, module_name=module_name)
    ok = []
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


def _reload_enabled_agent_modules():
    AGENT_MODULES_DIR.mkdir(parents=True, exist_ok=True)
    items = _load_agent_modules_map()
    _custom_agent_modules.clear()
    _custom_agent_tools.clear()
    updated = []
    for item in items:
        meta = dict(item)
        if not meta.get('enabled', True):
            updated.append(meta)
            continue
        try:
            _load_agent_module(meta)
        except Exception as e:
            meta['error'] = str(e)
        updated.append(meta)
    _save_agent_modules_map(updated)


def _list_custom_tools_for_prompt():
    rows = []
    for tool_name, info in sorted(_custom_agent_tools.items(), key=lambda x: x[0]):
        desc = info.get('description') or '无描述'
        rows.append(f"- {tool_name}: {desc}")
    return '\n'.join(rows)


def _skill_path_to_data_relative(path_str: str) -> str:
    """将位于 DATA_DIR 下的绝对路径存为相对 data/ 的 POSIX 路径（可移植、不绑本机）。"""
    if not path_str:
        return path_str
    try:
        p = Path(path_str).expanduser().resolve()
        dr = DATA_DIR.resolve()
        if p == dr or str(p).startswith(str(dr) + os.sep):
            return str(p.relative_to(dr)).replace('\\', '/')
    except (OSError, ValueError):
        pass
    return path_str


def _skill_path_from_data_relative(path_str: str) -> str:
    """加载时把相对 data/ 的路径解析为绝对路径供读写。"""
    if not path_str:
        return path_str
    p = Path(path_str)
    if p.is_absolute():
        return str(p.resolve())
    return str((DATA_DIR / path_str).resolve())


def _skill_item_paths_for_save(item: dict) -> dict:
    import copy
    it = copy.deepcopy(item)
    for k in ('path', 'skill_dir'):
        if it.get(k):
            it[k] = _skill_path_to_data_relative(it[k])
    for sp in it.get('scripts') or []:
        if isinstance(sp, dict) and sp.get('path'):
            sp['path'] = _skill_path_to_data_relative(sp['path'])
    for c in it.get('configs') or []:
        if isinstance(c, dict) and c.get('path'):
            c['path'] = _skill_path_to_data_relative(c['path'])
    return it


def _skill_item_paths_after_load(item: dict) -> dict:
    import copy
    it = copy.deepcopy(item)
    for k in ('path', 'skill_dir'):
        if it.get(k):
            it[k] = _skill_path_from_data_relative(it[k])
    for sp in it.get('scripts') or []:
        if isinstance(sp, dict) and sp.get('path'):
            sp['path'] = _skill_path_from_data_relative(sp['path'])
    for c in it.get('configs') or []:
        if isinstance(c, dict) and c.get('path'):
            c['path'] = _skill_path_from_data_relative(c['path'])
    return it


def _load_agent_skills_map():
    if not AGENT_SKILLS_MAP_FILE.exists():
        return []
    try:
        data = json.loads(AGENT_SKILLS_MAP_FILE.read_text(encoding='utf-8'))
        lst = data if isinstance(data, list) else []
        return [_skill_item_paths_after_load(x) for x in lst if isinstance(x, dict)]
    except Exception:
        return []


def _save_agent_skills_map(items):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    serialized = [_skill_item_paths_for_save(x) for x in items if isinstance(x, dict)]
    AGENT_SKILLS_MAP_FILE.write_text(json.dumps(serialized, ensure_ascii=False, indent=2), encoding='utf-8')


def _summarize_skill_markdown(text: str):
    """从正文提取一级标题与短摘要（不含 frontmatter 时可直接传入全文）。"""
    lines = [ln.strip() for ln in str(text or '').splitlines() if ln.strip()]
    title = ''
    for ln in lines:
        if ln.startswith('#'):
            title = ln.lstrip('#').strip()
            break
    if not title:
        title = (lines[0] if lines else 'Skill')
    body = ' '.join(lines[:20])
    return title[:120], body[:600]


def _parse_skill_md_frontmatter(text: str) -> dict:
    """解析 Cursor 标准 SKILL.md：YAML frontmatter（name / description）+ markdown 正文。"""
    text = str(text or '')
    lines = text.splitlines()
    if not lines or lines[0].strip() != '---':
        return {'name': '', 'description': '', 'body': text, 'has_frontmatter': False}
    end = None
    for i in range(1, len(lines)):
        if lines[i].strip() == '---':
            end = i
            break
    if end is None:
        return {'name': '', 'description': '', 'body': text, 'has_frontmatter': False}
    raw_fm = '\n'.join(lines[1:end])
    body = '\n'.join(lines[end + 1:])
    name, description = '', ''
    data = None
    try:
        import yaml  # type: ignore
        data = yaml.safe_load(raw_fm)
    except Exception:
        data = None
    if isinstance(data, dict):
        name = str(data.get('name') or '').strip()
        d = data.get('description')
        if d is not None and not isinstance(d, str):
            description = str(d).strip()
        else:
            description = (d or '').strip()
    if not name:
        for ln in lines[1:end]:
            m = re.match(r'^name:\s*["\']?([^"\'\n#]+?)["\']?\s*$', ln.strip())
            if m:
                name = m.group(1).strip()
                break
    if not description:
        for ln in lines[1:end]:
            m = re.match(r'^description:\s*["\']?(.+?)["\']?\s*$', ln.strip())
            if m and m.group(1).strip() not in ('>-', '|', '>', '-'):
                description = m.group(1).strip()
                break
    return {
        'name': name.strip()[:80],
        'description': description.strip()[:2048],
        'body': body,
        'has_frontmatter': True,
    }


def _validate_skill_markdown_parsed(parsed: dict, full_text: str, path: str = ''):
    """基于 Cursor 约定校验 SKILL.md（frontmatter + 正文结构）。"""
    body = (parsed.get('body') or '') if parsed.get('has_frontmatter') else full_text
    text_for_usage = f"{full_text}\n{parsed.get('description') or ''}"
    lines = body.splitlines()
    has_h1 = any(ln.strip().startswith('# ') for ln in lines)
    has_usage = (
        ('use when' in text_for_usage.lower())
        or ('何时使用' in text_for_usage)
        or ('使用场景' in text_for_usage)
    )
    has_steps = ('步骤' in body) or ('step' in body.lower()) or ('##' in body)
    warnings = []
    if not parsed.get('has_frontmatter'):
        warnings.append(
            '缺少 YAML frontmatter（Cursor：首行 ---，含 name 与 description）')
    else:
        nm = (parsed.get('name') or '').strip()
        if not nm:
            warnings.append('frontmatter 缺少 name')
        elif not re.match(r'^[a-z0-9][a-z0-9-]{0,62}$', nm):
            warnings.append('name 建议使用小写字母、数字、连字符（与 Cursor 一致）')
        desc = (parsed.get('description') or '').strip()
        if not desc:
            warnings.append('frontmatter 缺少 description（应说明能力及 Use when / 触发场景）')
        elif len(desc) > 1024:
            warnings.append(f'description 长度 {len(desc)}，Cursor 建议 ≤1024')
    if not has_h1:
        warnings.append('正文缺少一级标题（建议以 # 技能名 开头）')
    if not has_usage:
        warnings.append('未检测到 “Use when / 何时使用” 类触发说明（可写在 description 或正文）')
    if not has_steps:
        warnings.append('未检测到明确步骤说明（建议用小节列出）')
    if path and 'SKILL.md' not in path:
        warnings.append('文件名不是 SKILL.md（建议按标准命名）')
    return {'valid': len(warnings) == 0, 'warnings': warnings}


def _extract_skill_keywords(name: str, summary: str, content: str, limit: int = 24):
    base = f"{name} {summary} {content[:1200]}"
    raw = re.findall(r'[A-Za-z_]{3,}|[\u4e00-\u9fff]{2,}', base)
    seen = set()
    out = []
    stop = {'the', 'and', 'for', 'with', 'this', 'that', 'from', 'into', 'you', 'your', 'skill', 'agent'}
    for t in raw:
        k = t.lower()
        if k in stop or k in seen:
            continue
        seen.add(k)
        out.append(t)
        if len(out) >= limit:
            break
    return out


def _validate_skill_markdown(content: str, path: str = ''):
    """标准 Skills 的基础校验与报告。"""
    text = str(content or '')
    lines = text.splitlines()
    has_h1 = any(ln.strip().startswith('# ') for ln in lines)
    has_usage = ('use when' in text.lower()) or ('何时使用' in text) or ('使用场景' in text)
    has_steps = ('步骤' in text) or ('step' in text.lower()) or ('##' in text)
    warnings = []
    if not has_h1:
        warnings.append('缺少一级标题（建议以 # 技能名 开头）')
    if not has_usage:
        warnings.append('未检测到 “Use when/何时使用” 说明')
    if not has_steps:
        warnings.append('未检测到明确步骤说明（建议用小节列出）')
    if path and 'SKILL.md' not in path:
        warnings.append('文件名不是 SKILL.md（建议按标准命名）')
    return {'valid': len(warnings) == 0, 'warnings': warnings}


def _index_skill_config_files(skill_dir: Path):
    """索引技能包内固定配置文件（与 SKILL.md 同目录或 config/ 子目录）。"""
    if not skill_dir.is_dir():
        return []
    root_names = (
        'config.json', 'skill_config.json', 'skill.json', 'settings.json',
        'config.yaml', 'config.yml', 'skill.yaml', 'skill.yml',
        'config.toml', 'skill.toml', '.skillrc',
    )
    seen = set()
    configs = []
    for name in root_names:
        p = skill_dir / name
        if p.is_file():
            rel = str(p.relative_to(skill_dir))
            if rel not in seen:
                seen.add(rel)
                configs.append({'rel_path': rel, 'path': str(p)})
    cfg_sub = skill_dir / 'config'
    if cfg_sub.is_dir():
        for p in sorted(cfg_sub.rglob('*')):
            if not p.is_file():
                continue
            rel = str(p.relative_to(skill_dir))
            if rel in seen:
                continue
            if rel.count('/') > 6:
                continue
            low = p.suffix.lower()
            if low not in ('.json', '.yaml', '.yml', '.toml', ''):
                continue
            if low == '' and p.name not in ('.skillrc',):
                continue
            seen.add(rel)
            configs.append({'rel_path': rel, 'path': str(p)})
    return configs


def _match_imported_skills(user_text: str, max_skills: int = 3):
    skills = _load_agent_skills_map()
    if not skills:
        return []
    t = str(user_text or '').lower()
    scored = []
    for s in skills:
        if not s.get('enabled', True):
            continue
        name = str(s.get('name', '')).lower()
        cursor_name = str(s.get('cursor_name', '')).lower()
        desc = str(s.get('description', '')).lower()
        summary = str(s.get('summary', '')).lower()
        content = str(s.get('content', '')).lower()
        score = 0
        for token in [name, cursor_name, desc, summary]:
            if token and token in t:
                score += 3
        # 轻量关键词匹配（含 Cursor description 触发词）
        for kw in re.findall(
                r'[a-zA-Z_]{3,}|[\u4e00-\u9fff]{2,}',
                f'{name} {cursor_name} {desc} {summary}')[:32]:
            if kw and kw in t:
                score += 1
        # 若用户提到 skill/技能，优先给最近导入项
        if ('skill' in t or '技能' in t) and score == 0:
            score = 1
        if score > 0:
            scored.append((score, s))
    scored.sort(key=lambda x: x[0], reverse=True)
    out = []
    for score, s in scored[:max_skills]:
        out.append({
            'id': s.get('id', ''),
            'name': s.get('name', 'Skill'),
            'cursor_name': s.get('cursor_name', ''),
            'description': (s.get('description') or '')[:1600],
            'summary': s.get('summary', ''),
            'content': str(s.get('content', ''))[:3500],
            'keywords': s.get('keywords', [])[:16],
            'scripts': s.get('scripts', [])[:20],
            'configs': s.get('configs', [])[:20],
            'default_config_rel': s.get('default_config_rel', ''),
            'skill_dir': s.get('skill_dir', ''),
            'score': score,
        })
    return out


def _hydrate_skills_from_store(items: list) -> list:
    """按 id 用 agent_skills 全量条目替换精简项，保证注入完整 content / scripts。"""
    if not items:
        return []
    store = _load_agent_skills_map()
    idm = {str(x.get('id')): x for x in store}
    out = []
    for it in items:
        if not isinstance(it, dict):
            continue
        sid = str(it.get('id', ''))
        if sid and sid in idm:
            out.append(idm[sid])
        else:
            out.append(it)
    return out


def _increase_skill_load_counts(skill_ids: list):
    if not skill_ids:
        return
    all_skills = _load_agent_skills_map()
    id_to_item = {str(x.get('id')): x for x in all_skills}
    now_iso = __import__('datetime').datetime.now().isoformat()
    changed = False
    for sid in skill_ids:
        sid = str(sid or '')
        if sid and sid in id_to_item:
            it = id_to_item[sid]
            it['load_count'] = int(it.get('load_count', 0)) + 1
            it['last_matched_at'] = now_iso
            changed = True
    if changed:
        _save_agent_skills_map(list(id_to_item.values()))

def _ensure_dataset_loaded(dataset_id):
    """若内存中无该数据集，则从持久化映射重新加载并放入 current_datasets；返回 eda 或 None"""
    if not dataset_id:
        return None
    if dataset_id in current_datasets:
        return current_datasets[dataset_id]
    info = _get_dataset_info(dataset_id)
    if not info:
        return None
    coco_path = Path(info.get('coco_json_path', ''))
    if not coco_path.exists():
        return None
    name = info.get('dataset_name', 'dataset')
    image_dir = info.get('image_dir') or None
    eda = CocoEDA(coco_json_path=str(coco_path), name=name, image_dir=image_dir)
    with open(coco_path, 'r', encoding='utf-8') as f:
        coco_data = json.load(f)
    if isinstance(coco_data.get('source_dirs'), dict):
        eda.source_dirs = coco_data['source_dirs']
    if isinstance(coco_data.get('source_coco_paths'), dict):
        eda.source_coco_paths = coco_data['source_coco_paths']
    _fill_image_dimensions(eda)
    current_datasets[dataset_id] = eda
    return eda


MAX_VERSIONS = 50
# 存档目录：与 COCO 文件同目录下的 .coco_visualizer，所有版本快照与 manifest 均在此目录
# 最新内容 = 直接覆盖主 COCO 文件；首次加载时把原版 COCO 存档到 .coco_visualizer 作为首条记录
VERSIONS_DIR_NAME = '.coco_visualizer'


def _versions_dir(coco_json_path):
    """返回该 COCO 文件对应的存档目录（与 COCO 同目录下的 .coco_visualizer）"""
    p = Path(coco_json_path).resolve()
    return p.parent / VERSIONS_DIR_NAME


def _manifest_path(coco_json_path):
    return _versions_dir(coco_json_path) / 'manifest.json'


def _version_file_path(coco_json_path, version_id):
    return _versions_dir(coco_json_path) / f'{version_id}.json'


def _save_version(coco_json_path, coco_data, comment=None):
    """将当前内容保存为一条存档快照（写入对应目录下的 .coco_visualizer/ 下），返回 version_id。
    不修改主 COCO 文件；主文件由调用方随后写入，保证「主文件 = 最新内容」。comment 为版本说明；首版默认为 init。"""
    from datetime import datetime
    version_id = datetime.now().strftime('%Y%m%d_%H%M%S')
    saved_at = datetime.now().isoformat()
    vdir = _versions_dir(coco_json_path)
    vdir.mkdir(parents=True, exist_ok=True)
    vfile = _version_file_path(coco_json_path, version_id)
    with open(vfile, 'w', encoding='utf-8') as f:
        json.dump(coco_data, f, indent=2, ensure_ascii=False)
    manifest_path = _manifest_path(coco_json_path)
    if manifest_path.exists():
        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest = json.load(f)
    else:
        manifest = []
    is_first = len(manifest) == 0
    version_comment = (comment or '').strip() if comment else ''
    if is_first and not version_comment:
        version_comment = 'init'
    elif not version_comment:
        version_comment = f'保存于 {saved_at[:19].replace("T", " ")}'
    manifest.insert(0, {'id': version_id, 'saved_at': saved_at, 'comment': version_comment})
    to_remove = manifest[MAX_VERSIONS:]
    manifest = manifest[:MAX_VERSIONS]
    for old in to_remove:
        old_file = _version_file_path(coco_json_path, old['id'])
        if old_file.exists():
            try:
                old_file.unlink()
            except Exception:
                pass
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    return version_id


def _list_versions(coco_json_path):
    """返回版本列表 [{ id, saved_at }, ...]，按时间倒序"""
    manifest_path = _manifest_path(coco_json_path)
    if not manifest_path.exists():
        return []
    with open(manifest_path, 'r', encoding='utf-8') as f:
        manifest = json.load(f)
    return manifest


def _rollback_to_version(coco_json_path, version_id):
    """将主 COCO 文件恢复为指定版本（从 .coco_visualizer 快照覆盖主文件）"""
    import shutil
    vfile = _version_file_path(coco_json_path, version_id)
    if not vfile.exists():
        raise FileNotFoundError(f'版本不存在: {version_id}')
    target = Path(coco_json_path).resolve()
    shutil.copy(vfile, target)


# 与 COCO 文件同目录下的「上次加载」记录文件名，便于下次打开时从该目录加载
LOADER_RECORD_FILENAME = '_coco_visualizer_last.json'


def _write_coco_dir_record(coco_json_path, dataset_name, image_dir):
    """在 COCO 文件所在目录写入上次加载记录，下次打开可从该目录加载。"""
    p = Path(coco_json_path).resolve()
    if not p.is_file():
        return
    record_path = p.parent / LOADER_RECORD_FILENAME
    from datetime import datetime
    record = {
        'coco_file': p.name,
        'dataset_name': dataset_name or 'dataset',
        'image_dir': image_dir or '',
        'saved_at': datetime.now().isoformat()
    }
    try:
        with open(record_path, 'w', encoding='utf-8') as f:
            json.dump(record, f, indent=2, ensure_ascii=False)
    except Exception:
        pass


def _read_coco_dir_record(coco_dir):
    """从 COCO 所在目录读取上次加载记录；coco_dir 为目录路径。返回 None 或 { coco_json_path, dataset_name, image_dir, saved_at }。"""
    d = Path(coco_dir).resolve()
    record_path = d / LOADER_RECORD_FILENAME
    if not record_path.is_file():
        return None
    try:
        with open(record_path, 'r', encoding='utf-8') as f:
            record = json.load(f)
        coco_file = record.get('coco_file')
        if not coco_file:
            return None
        coco_path = d / coco_file
        if not coco_path.exists():
            return None
        return {
            'coco_json_path': str(coco_path),
            'dataset_name': record.get('dataset_name', 'dataset'),
            'image_dir': record.get('image_dir', ''),
            'saved_at': record.get('saved_at', '')
        }
    except Exception:
        return None


def safe_float(val):
    """安全转换为float，处理NaN和None"""
    if val is None:
        return None
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return None
        return f
    except (ValueError, TypeError):
        return None


def safe_tolist(series):
    """安全转换Series为列表，处理NaN值"""
    if series is None or len(series) == 0:
        return []
    result = []
    for x in series.tolist():
        val = safe_float(x)
        result.append(val if val is not None else 0)
    return result


def safe_score_tolist(series):
    """提取有效置信度分数列表（排除 None/nan/inf），用于分布统计；无 score 或全无效时返回 []。"""
    if series is None or len(series) == 0:
        return []
    result = []
    for x in series.tolist():
        val = safe_float(x)
        if val is not None and not math.isinf(val) and 0 <= val <= 1:
            result.append(val)
        elif val is not None and not math.isinf(val):
            # 允许 0-100 形式的分数，归一化到 0-1
            if 0 <= val <= 100:
                result.append(val / 100.0)
            else:
                result.append(val)
    return result


def extract_bbox(bbox_val):
    """安全提取bbox值"""
    if bbox_val is None:
        return None
    
    try:
        # numpy数组
        if isinstance(bbox_val, np.ndarray):
            if bbox_val.size == 0:
                return None
            # 检查是否全为NaN
            if np.all(np.isnan(bbox_val)):
                return None
            return [safe_float(x) or 0 for x in bbox_val.tolist()]
        
        # 列表或元组
        if isinstance(bbox_val, (list, tuple)):
            if len(bbox_val) == 0:
                return None
            return [safe_float(x) or 0 for x in bbox_val]
        
        # 其他可迭代对象
        if hasattr(bbox_val, '__iter__'):
            lst = list(bbox_val)
            if len(lst) == 0:
                return None
            return [safe_float(x) or 0 for x in lst]
    except Exception:
        pass
    
    return None


@app.route('/')
def index():
    """主页面"""
    return render_template('index.html')


@app.route('/api/upload', methods=['POST'])
def upload_file():
    """上传COCO JSON文件"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': '没有文件'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': '文件名为空'}), 400
        
        if not file.filename.endswith('.json'):
            return jsonify({'error': '请上传JSON文件'}), 400
        
        # 保存文件
        filename = file.filename
        filepath = UPLOAD_FOLDER / filename
        file.save(str(filepath))
        
        return jsonify({
            'success': True,
            'filename': filename,
            'filepath': str(filepath)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/upload_drop_bundle', methods=['POST'])
def upload_drop_bundle():
    """上传拖拽的目录/文件集合，保留相对层级，返回服务端根目录路径。"""
    try:
        files = request.files.getlist('files')
        paths = request.form.getlist('paths')
        if not files:
            return jsonify({'error': '没有可上传的文件'}), 400
        if paths and len(paths) != len(files):
            return jsonify({'error': '上传参数不一致'}), 400

        bundle_name = f"drop_{int(time.time() * 1000)}"
        bundle_root = (UPLOAD_FOLDER / bundle_name).resolve()
        bundle_root.mkdir(parents=True, exist_ok=True)

        saved = 0
        for idx, f in enumerate(files):
            rel_path = (paths[idx] if idx < len(paths) else '') or f.filename or ''
            rel_path = rel_path.replace('\\', '/').strip().lstrip('/').replace('..', '')
            if not rel_path:
                rel_path = f'file_{idx}'
            target = (bundle_root / rel_path).resolve()
            try:
                target.relative_to(bundle_root)
            except Exception:
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            f.save(str(target))
            saved += 1

        if saved == 0:
            return jsonify({'error': '未保存任何文件'}), 400

        return jsonify({
            'success': True,
            'root_path': str(bundle_root),
            'saved_files': saved,
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


COCO_ANNOTATION_FILENAME = '_annotations.coco.json'
PRED_ANNOTATION_PATTERN = re.compile(r'^_annotations\.(.+)\.pred\.coco\.json$')
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.bmp', '.webp', '.tiff', '.tif', '.gif'}


def _scan_dir_for_images(img_dir):
    """列出目录中所有图片文件名（仅当前层，不递归，已排序）。"""
    img_dir = Path(img_dir)
    if not img_dir.is_dir():
        return []
    result = []
    try:
        for p in sorted(img_dir.iterdir()):
            if p.is_file() and not p.name.startswith('.') and p.suffix.lower() in IMAGE_EXTENSIONS:
                result.append(p.name)
    except Exception:
        pass
    return result


def _ensure_coco_file(coco_path):
    """若 COCO 文件不存在，则创建最小空白 COCO JSON 结构。已存在返回 False，新建返回 True。"""
    p = Path(coco_path)
    if p.exists():
        return False
    empty = {
        'info': {'description': 'Auto-created by COCOVisualizer'},
        'images': [],
        'annotations': [],
        'categories': []
    }
    try:
        with open(p, 'w', encoding='utf-8') as f:
            json.dump(empty, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        _safe_log(f'[warn] _ensure_coco_file {p}: {e}')
        return False


def _sync_images_from_dir(coco_path, image_dir=None):
    """将目录中所有图片文件补充到 COCO JSON 的 images 列表（跳过已存在条目）。
    自动使用 Pillow 读取宽高并写回文件。
    Returns: (新增数量, 当前总图片数)
    """
    coco_path = Path(coco_path).resolve()
    img_dir = Path(image_dir).resolve() if image_dir else coco_path.parent
    if not img_dir.is_dir():
        return 0, 0
    try:
        with open(coco_path, 'r', encoding='utf-8') as f:
            coco_data = json.load(f)
    except Exception:
        coco_data = {'images': [], 'annotations': [], 'categories': []}

    existing_fnames = {img['file_name'] for img in coco_data.get('images', [])}
    max_img_id = max((img.get('id', 0) for img in coco_data.get('images', [])), default=0)
    image_files = _scan_dir_for_images(img_dir)

    added = []
    for fname in image_files:
        if fname in existing_fnames:
            continue
        w, h = 0, 0
        try:
            with Image.open(img_dir / fname) as im:
                w, h = im.size
        except Exception:
            pass
        max_img_id += 1
        added.append({'id': max_img_id, 'file_name': fname, 'width': int(w), 'height': int(h)})

    if not added:
        return 0, len(coco_data.get('images', []))

    coco_data.setdefault('images', []).extend(added)
    coco_data.setdefault('annotations', [])
    coco_data.setdefault('categories', [])
    try:
        with open(coco_path, 'w', encoding='utf-8') as f:
            json.dump(coco_data, f, ensure_ascii=False, indent=2)
        _safe_log(f'[info] _sync_images_from_dir: +{len(added)} images → {coco_path}')
    except Exception as e:
        _safe_log(f'[warn] _sync_images_from_dir write {coco_path}: {e}')
        return 0, len(coco_data.get('images', []))

    return len(added), len(coco_data['images'])


def _prepare_merge_item(item):
    """规范化 merged item：确保可用 coco_path，且 COCO images 非空（会按目录图片自动补齐）。"""
    if not isinstance(item, dict):
        return None
    raw_coco = (item.get('coco_path') or '').strip()
    raw_img_dir = (item.get('image_dir') or '').strip()
    rel = item.get('relative_path') or ''

    coco_path = Path(raw_coco).expanduser() if raw_coco else None
    img_dir = Path(raw_img_dir).expanduser() if raw_img_dir else None

    # 1) 若 coco_path 不存在，则尝试在 image_dir（或 coco_path 父目录）自动创建
    if not coco_path or not coco_path.exists():
        candidate_dir = None
        if img_dir and img_dir.is_dir():
            candidate_dir = img_dir
        elif coco_path:
            parent = coco_path.parent
            if parent.exists() and parent.is_dir():
                candidate_dir = parent
        if candidate_dir is None:
            return None
        coco_path = (candidate_dir / COCO_ANNOTATION_FILENAME).resolve()
        _ensure_coco_file(str(coco_path))
        _sync_images_from_dir(str(coco_path), str(candidate_dir))
        img_dir = candidate_dir
    else:
        coco_path = coco_path.resolve()

    # 2) image_dir 兜底到 coco 同目录
    if not img_dir or not img_dir.is_dir():
        img_dir = coco_path.parent
    img_dir = img_dir.resolve()

    # 3) 读取 COCO；若 images 为空则自动扫描当前层图片并写入
    try:
        with open(coco_path, 'r', encoding='utf-8') as f:
            coco_data = json.load(f)
    except Exception:
        _ensure_coco_file(str(coco_path))
        coco_data = {'images': [], 'annotations': [], 'categories': []}
    if not coco_data.get('images'):
        _sync_images_from_dir(str(coco_path), str(img_dir))

    return {
        'coco_path': str(coco_path),
        'image_dir': str(img_dir),
        'relative_path': rel
    }


def _find_pred_files(coco_dir):
    """扫描目录下所有预测结果 COCO 文件（_annotations.{model}.pred.coco.json）"""
    pred_files = []
    d = Path(coco_dir)
    if not d.is_dir():
        return pred_files
    try:
        for p in d.iterdir():
            if p.is_file():
                m = PRED_ANNOTATION_PATTERN.match(p.name)
                if m:
                    pred_files.append({'path': str(p), 'model_name': m.group(1)})
    except Exception:
        pass
    return pred_files


def _load_pred_anns_from_file(pred_path, model_name):
    """从预测 COCO 文件中加载标注，返回 {file_name: [ann_dict]}，每条 ann 包含 _pred_source"""
    try:
        with open(pred_path, 'r', encoding='utf-8') as f:
            pred_coco = json.load(f)
        cats = {c['id']: c['name'] for c in pred_coco.get('categories', [])}
        img_id_to_fname = {img['id']: img['file_name'] for img in pred_coco.get('images', [])}
        fname_to_anns = {}
        for ann in pred_coco.get('annotations', []):
            fname = img_id_to_fname.get(ann.get('image_id'))
            if not fname:
                continue
            bbox = extract_bbox(ann.get('bbox'))
            if not bbox or len(bbox) < 4:
                continue
            pred_ann = {
                'category': cats.get(ann.get('category_id'), 'unknown'),
                'bbox': bbox,
                '_pred_source': model_name,
            }
            if ann.get('score') is not None:
                pred_ann['score'] = float(ann['score'])
            fname_to_anns.setdefault(fname, []).append(pred_ann)
        return fname_to_anns
    except Exception:
        return {}


def _add_normalized_bbox_stats(eda, df):
    """在 bbox 特征 df 上合并图片宽高，并增加归一化列（相对图像尺寸 0-1）。若 images 无 width/height 则跳过归一化。"""
    if df.empty or 'image_id' not in df.columns:
        return df
    if 'width' not in eda.images_df.columns or 'height' not in eda.images_df.columns:
        return df
    img_cols = ['id', 'width', 'height']
    if 'file_name' in eda.images_df.columns:
        img_cols.append('file_name')
    imgs = eda.images_df[img_cols].rename(
        columns={'id': 'image_id', 'width': 'img_w', 'height': 'img_h'}
    )
    df = df.merge(imgs, on='image_id', how='left')
    # 避免除零
    df['img_w'] = df['img_w'].replace(0, np.nan)
    df['img_h'] = df['img_h'].replace(0, np.nan)
    df['img_area'] = df['img_w'] * df['img_h']
    df['img_area'] = df['img_area'].replace(0, np.nan)
    df['img_max_side'] = np.maximum(df['img_w'].fillna(0), df['img_h'].fillna(0))
    df['img_max_side'] = df['img_max_side'].replace(0, np.nan)
    df['img_min_side'] = np.minimum(df['img_w'].fillna(np.inf), df['img_h'].fillna(np.inf))
    df['img_min_side'] = df['img_min_side'].replace(np.inf, np.nan)
    df['w_norm'] = df['w'] / df['img_w']
    df['h_norm'] = df['h'] / df['img_h']
    df['area_norm'] = df['area'] / df['img_area']
    df['sqrt_area_norm'] = np.sqrt(np.maximum(df['area_norm'], 0))
    df['max_side_norm'] = df['max_side'] / df['img_max_side']
    df['min_side_norm'] = df['min_side'] / df['img_min_side']
    df['c_x_norm'] = df['c_x'] / df['img_w']
    df['c_y_norm'] = df['c_y'] / df['img_h']
    return df


def _resolve_image_path(eda, row):
    """根据 eda 和 images_df 的一行解析图片文件路径，与 get_image 逻辑一致。返回 Path 或 None。"""
    image_dir = eda.image_dir
    if getattr(eda, 'source_dirs', None) and row.get('source_path') is not None:
        image_dir = eda.source_dirs.get(str(row['source_path']), image_dir) or image_dir
    if not image_dir:
        image_dir = str(Path(eda.coco_json_path).parent)
    file_name = row.get('file_name')
    if not file_name:
        return None
    file_path = Path(file_name)
    if file_path.is_absolute():
        path = file_path
    else:
        path = Path(image_dir) / file_name
    if path.exists():
        return path
    for alt in (Path(eda.coco_json_path).parent / file_name, Path(image_dir) / Path(file_name).name):
        if alt.exists():
            return alt
    return None


def _fill_image_dimensions(eda):
    """若 images_df 中某张图缺少 width/height，则预加载该图并用 Pillow 计算宽高并写回。"""
    if eda.images_df.empty or 'file_name' not in eda.images_df.columns:
        return
    for col in ('width', 'height'):
        if col not in eda.images_df.columns:
            eda.images_df[col] = np.nan
    for idx, row in eda.images_df.iterrows():
        w, h = row.get('width'), row.get('height')
        if pd.notna(w) and pd.notna(h) and int(w) > 0 and int(h) > 0:
            continue
        path = _resolve_image_path(eda, row)
        if path is None:
            continue
        try:
            with Image.open(path) as im:
                w, h = im.size
            eda.images_df.at[idx, 'width'] = int(w)
            eda.images_df.at[idx, 'height'] = int(h)
        except Exception:
            pass


def _parse_c_time(s):
    """解析 c_time 字符串为可比较的 datetime，失败返回 None。兼容多种格式。"""
    if s is None or (isinstance(s, float) and math.isnan(s)):
        return None
    s = str(s).strip()
    if not s:
        return None
    from datetime import datetime
    for fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M', '%Y-%m-%d'):
        try:
            return datetime.strptime(s[:19].replace('T', ' '), fmt)
        except (ValueError, TypeError):
            continue
    return None


def _normalize_meta_filter_mapping(mapping):
    m = mapping if isinstance(mapping, dict) else {}
    def _pick(key, default):
        v = m.get(key, default)
        v = str(v).strip() if v is not None else ''
        return v or default
    return {
        'c_time': _pick('c_time', 'c_time'),
        'product_id': _pick('product_id', 'product_id'),
        'position': _pick('position', 'position'),
    }


def _apply_image_meta_filters(images_df, c_time_start=None, c_time_end=None, product_id_query=None, position=None, meta_filter_mapping=None):
    """根据图片元数据筛选：c_time 时间段、product_id(SN) 模糊查询、position 精确匹配。
    任一字段在 images_df 中不存在时，该条件忽略（兼容无该字段的 COCO）。返回通过筛选的 image id 集合。"""
    if images_df.empty or 'id' not in images_df.columns:
        return set()
    allowed = set(images_df['id'].astype(int).tolist())

    fm = _normalize_meta_filter_mapping(meta_filter_mapping)
    c_time_col = fm['c_time']
    product_id_col = fm['product_id']
    position_col = fm['position']

    # c_time 时间段
    if c_time_start is not None or c_time_end is not None:
        if c_time_col in images_df.columns:
            def in_range(row):
                t = _parse_c_time(row.get(c_time_col))
                if t is None:
                    return False
                if c_time_start is not None:
                    start = _parse_c_time(c_time_start) if isinstance(c_time_start, str) else c_time_start
                    if start is not None and t < start:
                        return False
                if c_time_end is not None:
                    end = _parse_c_time(c_time_end) if isinstance(c_time_end, str) else c_time_end
                    if end is not None and t > end:
                        return False
                return True
            mask = images_df.apply(in_range, axis=1)
            allowed &= set(images_df.loc[mask, 'id'].astype(int).tolist())
        # 若无 c_time 列，不缩小 allowed

    # product_id 模糊查询（product_id 即 SN，不单独处理 SN）
    if product_id_query and str(product_id_query).strip():
        q = str(product_id_query).strip().lower()
        if product_id_col in images_df.columns:
            def match_product_id(row):
                pid = row.get(product_id_col)
                if pid is None or (isinstance(pid, float) and math.isnan(pid)):
                    return False
                return q in str(pid).lower()
            mask = images_df.apply(match_product_id, axis=1)
            allowed &= set(images_df.loc[mask, 'id'].astype(int).tolist())

    # position 精确匹配
    if position and str(position).strip():
        pos_val = str(position).strip()
        if position_col in images_df.columns:
            def match_position(row):
                p = row.get(position_col)
                if p is None or (isinstance(p, float) and math.isnan(p)):
                    return False
                return str(p).strip() == pos_val
            mask = images_df.apply(match_position, axis=1)
            allowed &= set(images_df.loc[mask, 'id'].astype(int).tolist())

    return allowed


# 元数据筛选中 SN/product_id 下拉选项最多返回数量，避免响应过大
META_FILTER_PRODUCT_IDS_LIMIT = 500


def _build_meta_filter_options(images_df, meta_filter_mapping=None):
    """从 images_df 构建 meta_filter_options：是否有各字段、position 列表、product_ids 列表、c_time 范围。兼容缺失字段。"""
    fm = _normalize_meta_filter_mapping(meta_filter_mapping)
    c_time_col = fm['c_time']
    product_id_col = fm['product_id']
    position_col = fm['position']
    opts = {
        'has_c_time': c_time_col in images_df.columns,
        'has_product_id': product_id_col in images_df.columns,
        'has_position': position_col in images_df.columns,
        'c_time_field': c_time_col,
        'product_id_field': product_id_col,
        'position_field': position_col,
        'c_time_label': c_time_col,
        'product_id_label': product_id_col,
        'position_label': position_col,
        'positions': [],
        'product_ids': [],
        'c_time_min': None,
        'c_time_max': None
    }
    if images_df.empty:
        return opts
    if opts['has_position']:
        positions = images_df[position_col].dropna().astype(str).str.strip()
        opts['positions'] = sorted(positions.unique().tolist())
    if opts['has_product_id']:
        pids = images_df[product_id_col].dropna().astype(str).str.strip()
        pids = pids[pids.str.len() > 0].unique().tolist()
        pids = sorted(pids)[:META_FILTER_PRODUCT_IDS_LIMIT]
        opts['product_ids'] = pids
    if opts['has_c_time']:
        times = []
        for v in images_df[c_time_col].dropna():
            t = _parse_c_time(v)
            if t is not None:
                times.append(t)
        if times:
            opts['c_time_min'] = min(times).strftime('%Y-%m-%dT%H:%M:%S')
            opts['c_time_max'] = max(times).strftime('%Y-%m-%dT%H:%M:%S')
    return opts


def _scan_folder_for_coco(root_path):
    """递归扫描目录下所有 _annotations.coco.json，返回 [{coco_path, image_dir, relative_path}, ...]。
    同时发现有图片文件但无 COCO 文件的子目录，自动创建 _annotations.coco.json 并同步图片。
    自动创建的条目带有 auto_created=True 标记。
    """
    root = Path(root_path).resolve()
    if not root.exists() or not root.is_dir():
        return []
    items = []

    # 第一遍：查找已有 COCO 文件
    try:
        for p in root.rglob(COCO_ANNOTATION_FILENAME):
            if p.is_file():
                # 即使已有 COCO，也同步一次同层图片，避免 images 为空或不全
                _ensure_coco_file(str(p))
                _sync_images_from_dir(str(p), str(p.parent))
                coco_path = str(p.resolve())
                image_dir = str(p.parent.resolve())
                try:
                    rel = p.parent.relative_to(root)
                    relative_path = str(rel) if rel != Path('.') else ''
                except ValueError:
                    relative_path = str(p.parent.name)
                items.append({
                    'coco_path': coco_path,
                    'image_dir': image_dir,
                    'relative_path': relative_path or p.parent.name
                })
    except Exception:
        pass

    # 第二遍：查找有图片但无 COCO 文件的目录，自动创建并同步
    found_dirs = {str(Path(it['image_dir']).resolve()) for it in items}
    try:
        for dirpath, dirnames, filenames in os.walk(str(root)):
            # 跳过隐藏目录
            dirnames[:] = [d for d in sorted(dirnames) if not d.startswith('.')]
            dir_p = Path(dirpath).resolve()
            if str(dir_p) in found_dirs:
                continue
            # 检查是否含图片文件
            img_files = [f for f in filenames
                         if not f.startswith('.') and Path(f).suffix.lower() in IMAGE_EXTENSIONS]
            if not img_files:
                continue
            # 有图片，但无 COCO 文件 → 自动创建并同步图片列表
            coco_p = dir_p / COCO_ANNOTATION_FILENAME
            is_new = _ensure_coco_file(str(coco_p))
            _sync_images_from_dir(str(coco_p))
            try:
                rel = dir_p.relative_to(root)
                relative_path = str(rel) if rel != Path('.') else ''
            except ValueError:
                relative_path = dir_p.name
            items.append({
                'coco_path': str(coco_p),
                'image_dir': str(dir_p),
                'relative_path': relative_path or dir_p.name,
                'auto_created': True,
                'num_images': len(img_files),
            })
            found_dirs.add(str(dir_p))
    except Exception as e:
        _safe_log(f'[warn] scan image-only dirs: {e}')

    return items


@app.route('/api/scan_folder', methods=['POST'])
def scan_folder():
    """扫描根目录，递归查找所有 _annotations.coco.json（图片与 COCO 同目录，文件名固定）。
    每个 item 若其目录下有上次加载记录则附带 loader_record，便于前端「加载上次」。"""
    try:
        data = request.get_json() or {}
        root_path = data.get('root_path', '').strip()
        if not root_path:
            return jsonify({'error': '请提供根目录路径 root_path'}), 400
        items = _scan_folder_for_coco(root_path)
        for it in items:
            coco_dir = str(Path(it['coco_path']).parent)
            rec = _read_coco_dir_record(coco_dir)
            if rec:
                it['loader_record'] = rec
        return jsonify({'success': True, 'items': items})
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@app.route('/api/get_loader_record', methods=['POST'])
def get_loader_record():
    """根据目录路径读取该目录下的上次加载记录（对应 COCO 文件目录下的 _coco_visualizer_last.json），便于下次打开加载。"""
    try:
        data = request.get_json() or {}
        coco_dir = (data.get('coco_dir') or data.get('path') or '').strip()
        if not coco_dir:
            return jsonify({'success': False, 'record': None})
        p = Path(coco_dir).resolve()
        if p.is_file():
            coco_dir = str(p.parent)
        rec = _read_coco_dir_record(coco_dir)
        return jsonify({'success': True, 'record': rec})
    except Exception as e:
        return jsonify({'success': False, 'record': None, 'error': str(e)})


@app.route('/api/load_dataset', methods=['POST'])
def load_dataset():
    """加载COCO数据集并返回所有可视化数据"""
    try:
        data = request.get_json() or {}
        if not isinstance(data, dict):
            data = {}
        coco_json_path = data.get('coco_json_path')
        image_dir = data.get('image_dir', '')
        dataset_name = data.get('dataset_name', 'dataset')
        meta_filter_mapping = data.get('meta_filter_mapping') if isinstance(data, dict) else None
        
        if not coco_json_path:
            return jsonify({'error': '缺少COCO JSON路径'}), 400
        
        # 检查路径是否存在，并统一为绝对路径，确保保存时写回同一文件
        coco_path = Path(coco_json_path).resolve()

        # 若给的是目录，自动定位到其中的 _annotations.coco.json（不存在则创建）
        if coco_path.is_dir():
            auto_coco = coco_path / COCO_ANNOTATION_FILENAME
            _ensure_coco_file(str(auto_coco))
            coco_path = auto_coco.resolve()

        if not coco_path.exists():
            return jsonify({'error': f'文件不存在: {coco_json_path}'}), 400
        if not coco_path.is_file():
            return jsonify({'error': f'路径不是文件: {coco_path}'}), 400

        # 若 images 列表为空，自动从同目录（或指定 image_dir）扫描图片并补全
        try:
            with open(coco_path, 'r', encoding='utf-8') as _f:
                _check = json.load(_f)
            if not _check.get('images'):
                _added, _total = _sync_images_from_dir(str(coco_path), image_dir or None)
                if _added > 0:
                    _safe_log(f'[info] load_dataset: auto-synced {_added} images into {coco_path}')
        except Exception as _e:
            _safe_log(f'[warn] load_dataset pre-sync: {_e}')

        # 加载数据集（使用绝对路径，持久化与保存均基于此路径）
        eda = CocoEDA(
            coco_json_path=str(coco_path),
            name=dataset_name,
            image_dir=image_dir if image_dir else None
        )
        _fill_image_dimensions(eda)
        
        # 存储数据集
        dataset_id = f"{dataset_name}_{len(current_datasets)}"
        current_datasets[dataset_id] = eda
        _persist_dataset(dataset_id, coco_path, dataset_name, image_dir if image_dir else None)
        # 在对应 COCO 文件目录下写入上次加载记录，下次打开可从该目录加载
        _write_coco_dir_record(str(coco_path), dataset_name, image_dir or '')
        
        # 计算所有特征并归一化（相对图像尺寸）
        df = eda.compute_bbox_features()
        df = _add_normalized_bbox_stats(eda, df)
        
        # 获取基本信息
        class_dist = eda.get_class_distribution()
        categories = class_dist['name'].tolist()
        
        # 准备所有可视化数据（含图片元数据筛选能力：c_time / product_id / position）
        meta_filter_options = _build_meta_filter_options(eda.images_df, meta_filter_mapping=meta_filter_mapping)
        visualization_data = {
            'dataset_id': dataset_id,
            'dataset_name': dataset_name,
            'num_images': len(eda.images_df),
            'num_annotations': len(eda.annotations_df),
            'num_categories': len(eda.categories_df),
            'categories': categories,
            'meta_filter_options': meta_filter_options,
            'class_distribution': class_dist.to_dict('records'),
            
            # 类别分布数据
            'class_distribution_pie': {
                'labels': class_dist['name'].tolist(),
                'values': [int(x) for x in class_dist['count'].tolist()],
                'percentages': [safe_float(x) or 0 for x in class_dist['percentage'].tolist()]
            },
            
            # 类别数量柱状图数据
            'class_counts': {
                'categories': class_dist['name'].tolist(),
                'counts': [int(x) for x in class_dist['count'].tolist()]
            },
            
            # 每个类别的详细数据（用于密度图等）
            'category_data': {}
        }
        
        # 为每个类别准备详细数据
        for category in categories:
            cat_df = df[df['name'] == category]
            
            cat_score = {}
            if 'score' in cat_df.columns:
                cat_score['values'] = safe_score_tolist(cat_df['score'])
            visualization_data['category_data'][category] = {
                'count': len(cat_df),
                'area': {
                    'values': safe_tolist(cat_df['area_norm']) if 'area_norm' in cat_df.columns else [],
                    'sqrt_values': safe_tolist(cat_df['sqrt_area_norm']) if 'sqrt_area_norm' in cat_df.columns else []
                },
                'dimensions': {
                    'width': safe_tolist(cat_df['w_norm']) if 'w_norm' in cat_df.columns else [],
                    'height': safe_tolist(cat_df['h_norm']) if 'h_norm' in cat_df.columns else [],
                    'max_side': safe_tolist(cat_df['max_side_norm']) if 'max_side_norm' in cat_df.columns else [],
                    'min_side': safe_tolist(cat_df['min_side_norm']) if 'min_side_norm' in cat_df.columns else []
                },
                'ratios': {
                    'wh_ratio': safe_tolist(cat_df['wh_ratio']) if 'wh_ratio' in cat_df.columns else [],
                    'aspect_ratio': safe_tolist(cat_df['aspect_ratio']) if 'aspect_ratio' in cat_df.columns else []
                },
                'spatial': {
                    'center_x': safe_tolist(cat_df['c_x_norm']) if 'c_x_norm' in cat_df.columns else [],
                    'center_y': safe_tolist(cat_df['c_y_norm']) if 'c_y_norm' in cat_df.columns else []
                },
                'score': cat_score
            }
        
        # 所有类别的汇总统计（归一化值，用于箱线图等）；置信度 score 兼容缺失
        score_cat, score_vals = [], []
        if 'score' in df.columns:
            for _, row in df.iterrows():
                v = safe_float(row.get('score'))
                if v is not None and not math.isinf(v):
                    if 0 <= v <= 1:
                        score_vals.append(v)
                    elif 0 <= v <= 100:
                        score_vals.append(v / 100.0)
                    else:
                        score_vals.append(v)
                    score_cat.append(row.get('name', ''))
        visualization_data['all_categories_stats'] = {
            'area': {
                'category': df['name'].tolist() if 'name' in df.columns else [],
                'values': safe_tolist(df['area_norm']) if 'area_norm' in df.columns else []
            },
            'sqrt_area': {
                'category': df['name'].tolist() if 'name' in df.columns else [],
                'values': safe_tolist(df['sqrt_area_norm']) if 'sqrt_area_norm' in df.columns else []
            },
            'max_side': {
                'category': df['name'].tolist() if 'name' in df.columns else [],
                'values': safe_tolist(df['max_side_norm']) if 'max_side_norm' in df.columns else []
            },
            'wh_ratio': {
                'category': df['name'].tolist() if 'name' in df.columns else [],
                'values': safe_tolist(df['wh_ratio']) if 'wh_ratio' in df.columns else []
            },
            'aspect_ratio': {
                'category': df['name'].tolist() if 'name' in df.columns else [],
                'values': safe_tolist(df['aspect_ratio']) if 'aspect_ratio' in df.columns else []
            },
            'center': {
                'category': df['name'].tolist() if 'name' in df.columns else [],
                'x': safe_tolist(df['c_x_norm']) if 'c_x_norm' in df.columns else [],
                'y': safe_tolist(df['c_y_norm']) if 'c_y_norm' in df.columns else [],
                'image_id': df['image_id'].astype(int).tolist() if 'image_id' in df.columns else [],
                'file_name': df['file_name'].tolist() if 'file_name' in df.columns else [],
            },
            'width': {
                'category': df['name'].tolist() if 'name' in df.columns else [],
                'values': safe_tolist(df['w_norm']) if 'w_norm' in df.columns else [],
                'image_id': df['image_id'].astype(int).tolist() if 'image_id' in df.columns else [],
                'file_name': df['file_name'].tolist() if 'file_name' in df.columns else [],
            },
            'height': {
                'category': df['name'].tolist() if 'name' in df.columns else [],
                'values': safe_tolist(df['h_norm']) if 'h_norm' in df.columns else [],
                'image_id': df['image_id'].astype(int).tolist() if 'image_id' in df.columns else [],
                'file_name': df['file_name'].tolist() if 'file_name' in df.columns else [],
            },
            'score': {'category': score_cat, 'values': score_vals} if score_cat else {'category': [], 'values': []}
        }
        # 未归一化（像素值）统计，供前端切换；score 无归一/原始之分，与 all_categories_stats 一致
        visualization_data['all_categories_stats_raw'] = {
            'area': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['area']) if 'area' in df.columns else []},
            'sqrt_area': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['sqrt_area']) if 'sqrt_area' in df.columns else []},
            'max_side': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['max_side']) if 'max_side' in df.columns else []},
            'wh_ratio': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['wh_ratio']) if 'wh_ratio' in df.columns else []},
            'aspect_ratio': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['aspect_ratio']) if 'aspect_ratio' in df.columns else []},
            'width': {
                'category': df['name'].tolist() if 'name' in df.columns else [],
                'values': safe_tolist(df['w']) if 'w' in df.columns else [],
                'image_id': df['image_id'].astype(int).tolist() if 'image_id' in df.columns else [],
                'file_name': df['file_name'].tolist() if 'file_name' in df.columns else [],
            },
            'height': {
                'category': df['name'].tolist() if 'name' in df.columns else [],
                'values': safe_tolist(df['h']) if 'h' in df.columns else [],
                'image_id': df['image_id'].astype(int).tolist() if 'image_id' in df.columns else [],
                'file_name': df['file_name'].tolist() if 'file_name' in df.columns else [],
            },
            'center': {
                'category': df['name'].tolist() if 'name' in df.columns else [],
                'x': safe_tolist(df['c_x']) if 'c_x' in df.columns else [],
                'y': safe_tolist(df['c_y']) if 'c_y' in df.columns else [],
                'image_id': df['image_id'].astype(int).tolist() if 'image_id' in df.columns else [],
                'file_name': df['file_name'].tolist() if 'file_name' in df.columns else [],
            },
            'score': {'category': score_cat, 'values': score_vals} if score_cat else {'category': [], 'values': []}
        }
        visualization_data['category_data_raw'] = {}
        for category in categories:
            cat_df = df[df['name'] == category]
            cat_score_raw = {}
            if 'score' in cat_df.columns:
                cat_score_raw['values'] = safe_score_tolist(cat_df['score'])
            visualization_data['category_data_raw'][category] = {
                'count': len(cat_df),
                'area': {'values': safe_tolist(cat_df['area']) if 'area' in cat_df.columns else [], 'sqrt_values': safe_tolist(cat_df['sqrt_area']) if 'sqrt_area' in cat_df.columns else []},
                'dimensions': {'width': safe_tolist(cat_df['w']) if 'w' in cat_df.columns else [], 'height': safe_tolist(cat_df['h']) if 'h' in cat_df.columns else [], 'max_side': safe_tolist(cat_df['max_side']) if 'max_side' in cat_df.columns else [], 'min_side': safe_tolist(cat_df['min_side']) if 'min_side' in cat_df.columns else []},
                'ratios': {'wh_ratio': safe_tolist(cat_df['wh_ratio']) if 'wh_ratio' in cat_df.columns else [], 'aspect_ratio': safe_tolist(cat_df['aspect_ratio']) if 'aspect_ratio' in cat_df.columns else []},
                'spatial': {'center_x': safe_tolist(cat_df['c_x']) if 'c_x' in cat_df.columns else [], 'center_y': safe_tolist(cat_df['c_y']) if 'c_y' in cat_df.columns else []},
                'score': cat_score_raw
            }
        
        # 首次加载：若该 COCO 对应目录下尚无 .coco_visualizer 存档，则把当前（原版）COCO 存档为第一条记录
        with open(eda.coco_json_path, 'r', encoding='utf-8') as f:
            coco_data = json.load(f)
        if not _list_versions(eda.coco_json_path):
            _save_version(eda.coco_json_path, coco_data, comment='加载时原版')
        # 自动推断图片分类定义：扫描 image_category / image_categories，兼容第三方自定义字段值
        _cat_defs = _infer_image_category_definitions(coco_data)
        if _cat_defs and _cat_defs.get('categories'):
            visualization_data['image_category_definitions'] = _cat_defs

        return jsonify({
            'success': True,
            **visualization_data
        })
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


def _source_fingerprint(items):
    """根据源 COCO 路径排序后计算 MD5 指纹，用于生成稳定的合并文件名。"""
    import hashlib
    paths = sorted(str(Path(item['coco_path']).resolve()) for item in items)
    return hashlib.md5('\n'.join(paths).encode('utf-8')).hexdigest()[:16]


def _load_dataset_merged_impl(items, dataset_name='merged', output_dir=None, meta_filter_mapping=None):
    """合并多个 COCO（每个 item 含 coco_path, image_dir, relative_path），生成一个 CocoEDA 并返回 (eda, visualization_data)。
    output_dir：合并文件写入的目录，必须为加载的数据集对应目录（如扫描根目录），不写入 app 的 data 目录。
    同一组源文件始终复用同一个 merged 文件（基于路径指纹），并保留用户已设置的分类和备注。"""
    from datetime import datetime
    name_to_id = {}
    next_cat_id = 1
    merged_images = []
    merged_annotations = []
    source_dirs = {}
    next_image_id = 1
    next_ann_id = 1
    old_to_new_image = {}
    old_to_new_cat = {}

    for item in items:
        coco_path = Path(item['coco_path'])
        image_dir = item.get('image_dir') or str(coco_path.parent)
        rel = item.get('relative_path') or ''
        source_dirs[rel] = image_dir
        with open(coco_path, 'r', encoding='utf-8') as f:
            coco = json.load(f)
        images = coco.get('images', [])
        anns = coco.get('annotations', [])
        cats = coco.get('categories', [])
        file_to_new_id = {}
        for img in images:
            old_id = img.get('id')
            new_id = next_image_id
            next_image_id += 1
            file_to_new_id[old_id] = new_id
            new_img = {k: v for k, v in img.items()}
            new_img['id'] = new_id
            new_img['source_path'] = rel
            merged_images.append(new_img)
        for c in cats:
            cname = c.get('name')
            if cname not in name_to_id:
                name_to_id[cname] = next_cat_id
                next_cat_id += 1
            old_to_new_cat[c.get('id')] = name_to_id[cname]
        for ann in anns:
            old_im = ann.get('image_id')
            old_cat = ann.get('category_id')
            new_im = file_to_new_id.get(old_im)
            if new_im is None:
                continue
            new_cat = old_to_new_cat.get(old_cat)
            if new_cat is None:
                continue
            new_ann = {k: v for k, v in ann.items()}
            new_ann['id'] = next_ann_id
            next_ann_id += 1
            new_ann['image_id'] = new_im
            new_ann['category_id'] = new_cat
            merged_annotations.append(new_ann)
    categories_list = [{'id': iid, 'name': name} for name, iid in sorted(name_to_id.items(), key=lambda x: x[1])]

    # ---- 基于源文件路径指纹生成稳定文件名，同一组源文件始终复用同一个 merged 文件 ----
    fp = _source_fingerprint(items)
    if output_dir:
        out = Path(output_dir).resolve()
        out.mkdir(parents=True, exist_ok=True)
        merged_path = out / f'merged_{dataset_name}_{fp}.json'
    else:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        merged_path = DATA_DIR / f'merged_{dataset_name}_{fp}.json'

    # 若该指纹文件已存在，则把之前保存的 image_categories / note 迁移到新合并数据中
    if merged_path.exists():
        try:
            with open(merged_path, 'r', encoding='utf-8') as _f:
                _old = json.load(_f)
            # 以 (source_path, file_name) 为键建立旧分类索引
            _old_meta = {}
            for _img in _old.get('images', []):
                _key = (_img.get('source_path', ''), _img.get('file_name', ''))
                if _key[1]:
                    _old_meta[_key] = {
                        'image_categories': _img.get('image_categories'),
                        'image_category': _img.get('image_category'),
                        'note': _img.get('note'),
                    }
            # 将旧分类写入重新合并后的图片记录
            for _img in merged_images:
                _key = (_img.get('source_path', ''), _img.get('file_name', ''))
                if _key in _old_meta:
                    _m = _old_meta[_key]
                    if _m.get('image_categories') is not None:
                        _img['image_categories'] = _m['image_categories']
                        _img['image_category'] = _m.get('image_category') or (_m['image_categories'][0] if _m['image_categories'] else '未分类')
                    if _m.get('note') is not None:
                        _img['note'] = _m['note']
            # 迁移图片分类定义（保持顺序与颜色）
            _old_cat_defs = _old.get('image_category_definitions')

            # 迁移旧 merged 中的标注（GT）：
            # 以 (source_path, file_name) 匹配图片，并按类别名重映射 category_id，确保“重新加载后仍保留上次打标结果”
            _old_images = _old.get('images', []) or []
            _old_anns = _old.get('annotations', []) or []
            _old_cats = _old.get('categories', []) or []
            _old_img_by_id = {img.get('id'): img for img in _old_images}
            _old_cat_name_by_id = {c.get('id'): c.get('name') for c in _old_cats}
            _new_img_id_by_key = {
                (img.get('source_path', ''), img.get('file_name', '')): img.get('id')
                for img in merged_images
                if img.get('file_name')
            }
            _migrated_anns = []
            _migrated_ann_id = 1
            for _ann in _old_anns:
                _old_img = _old_img_by_id.get(_ann.get('image_id'))
                if not _old_img:
                    continue
                _key = (_old_img.get('source_path', ''), _old_img.get('file_name', ''))
                _new_img_id = _new_img_id_by_key.get(_key)
                if _new_img_id is None:
                    continue
                _old_cat_name = _old_cat_name_by_id.get(_ann.get('category_id'))
                _new_cat_id = name_to_id.get(_old_cat_name)
                if _new_cat_id is None:
                    continue
                _new_ann = {k: v for k, v in _ann.items()}
                _new_ann['id'] = _migrated_ann_id
                _migrated_ann_id += 1
                _new_ann['image_id'] = _new_img_id
                _new_ann['category_id'] = _new_cat_id
                _migrated_anns.append(_new_ann)
            if _migrated_anns:
                merged_annotations = _migrated_anns
                next_ann_id = _migrated_ann_id
            _safe_log(f"[merged_load] path={merged_path} migrated_annotations={len(_migrated_anns)} total_images={len(merged_images)}")
        except Exception:
            _old_cat_defs = None  # 迁移失败时静默降级，使用全新合并数据
            _safe_log(f"[merged_load] path={merged_path} annotation_migration_failed")
    else:
        _old_cat_defs = None
        _safe_log(f"[merged_load] path={merged_path} no_previous_merged_file")

    # 记录每个相对路径对应的源 COCO 文件路径，供 save_image_metadata 写回
    source_coco_paths = {item.get('relative_path') or '': str(Path(item['coco_path']).resolve()) for item in items}
    merged_coco = {
        'images': merged_images,
        'annotations': merged_annotations,
        'categories': categories_list,
        'source_dirs': source_dirs,
        'source_coco_paths': source_coco_paths
    }
    # 合并后自动推断图片分类定义（同时保留旧定义的顺序/颜色并补齐新出现的类别）
    if _old_cat_defs:
        merged_coco['image_category_definitions'] = _old_cat_defs
    _merged_cat_defs = _infer_image_category_definitions(merged_coco)
    if _merged_cat_defs and _merged_cat_defs.get('categories'):
        merged_coco['image_category_definitions'] = _merged_cat_defs
    with open(merged_path, 'w', encoding='utf-8') as f:
        json.dump(merged_coco, f, indent=2, ensure_ascii=False)
    eda = CocoEDA(coco_json_path=str(merged_path), name=dataset_name, image_dir=list(source_dirs.values())[0] if source_dirs else None)
    eda.source_dirs = source_dirs
    eda.source_coco_paths = source_coco_paths
    _fill_image_dimensions(eda)
    df = eda.compute_bbox_features()
    df = _add_normalized_bbox_stats(eda, df)
    class_dist = eda.get_class_distribution()
    categories = class_dist['name'].tolist()
    meta_filter_options = _build_meta_filter_options(eda.images_df, meta_filter_mapping=meta_filter_mapping)
    visualization_data = {
        'num_images': len(eda.images_df),
        'num_annotations': len(eda.annotations_df),
        'num_categories': len(eda.categories_df),
        'categories': categories,
        'meta_filter_options': meta_filter_options,
        'class_distribution': class_dist.to_dict('records'),
        'class_distribution_pie': {
            'labels': class_dist['name'].tolist(),
            'values': [int(x) for x in class_dist['count'].tolist()],
            'percentages': [safe_float(x) or 0 for x in class_dist['percentage'].tolist()]
        },
        'class_counts': {
            'categories': class_dist['name'].tolist(),
            'counts': [int(x) for x in class_dist['count'].tolist()]
        },
        'category_data': {},
        'all_categories_stats': {
            'area': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['area_norm']) if 'area_norm' in df.columns else []},
            'sqrt_area': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['sqrt_area_norm']) if 'sqrt_area_norm' in df.columns else []},
            'max_side': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['max_side_norm']) if 'max_side_norm' in df.columns else []},
            'wh_ratio': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['wh_ratio']) if 'wh_ratio' in df.columns else []},
            'aspect_ratio': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['aspect_ratio']) if 'aspect_ratio' in df.columns else []},
            'width': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['w_norm']) if 'w_norm' in df.columns else []},
            'height': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['h_norm']) if 'h_norm' in df.columns else []},
            'center': {'category': df['name'].tolist() if 'name' in df.columns else [], 'x': safe_tolist(df['c_x_norm']) if 'c_x_norm' in df.columns else [], 'y': safe_tolist(df['c_y_norm']) if 'c_y_norm' in df.columns else []}
        }
    }
    score_cat_merged, score_vals_merged = [], []
    if 'score' in df.columns:
        for _, row in df.iterrows():
            v = safe_float(row.get('score'))
            if v is not None and not math.isinf(v):
                if 0 <= v <= 1:
                    score_vals_merged.append(v)
                elif 0 <= v <= 100:
                    score_vals_merged.append(v / 100.0)
                else:
                    score_vals_merged.append(v)
                score_cat_merged.append(row.get('name', ''))
    for category in categories:
        cat_df = df[df['name'] == category]
        cat_score = {}
        if 'score' in cat_df.columns:
            cat_score['values'] = safe_score_tolist(cat_df['score'])
        visualization_data['category_data'][category] = {
            'count': len(cat_df),
            'area': {'values': safe_tolist(cat_df['area_norm']) if 'area_norm' in cat_df.columns else [], 'sqrt_values': safe_tolist(cat_df['sqrt_area_norm']) if 'sqrt_area_norm' in cat_df.columns else []},
            'dimensions': {'width': safe_tolist(cat_df['w_norm']) if 'w_norm' in cat_df.columns else [], 'height': safe_tolist(cat_df['h_norm']) if 'h_norm' in cat_df.columns else [], 'max_side': safe_tolist(cat_df['max_side_norm']) if 'max_side_norm' in cat_df.columns else [], 'min_side': safe_tolist(cat_df['min_side_norm']) if 'min_side_norm' in cat_df.columns else []},
            'ratios': {'wh_ratio': safe_tolist(cat_df['wh_ratio']) if 'wh_ratio' in cat_df.columns else [], 'aspect_ratio': safe_tolist(cat_df['aspect_ratio']) if 'aspect_ratio' in cat_df.columns else []},
            'spatial': {'center_x': safe_tolist(cat_df['c_x_norm']) if 'c_x_norm' in cat_df.columns else [], 'center_y': safe_tolist(cat_df['c_y_norm']) if 'c_y_norm' in cat_df.columns else []},
            'score': cat_score
        }
    visualization_data['all_categories_stats']['score'] = {'category': score_cat_merged, 'values': score_vals_merged} if score_cat_merged else {'category': [], 'values': []}
    # 若合并文件中含有图片分类定义（含自动推断），返回前端
    if merged_coco.get('image_category_definitions'):
        visualization_data['image_category_definitions'] = merged_coco['image_category_definitions']
    visualization_data['all_categories_stats_raw'] = {
        'area': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['area']) if 'area' in df.columns else []},
        'sqrt_area': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['sqrt_area']) if 'sqrt_area' in df.columns else []},
        'max_side': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['max_side']) if 'max_side' in df.columns else []},
        'wh_ratio': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['wh_ratio']) if 'wh_ratio' in df.columns else []},
        'aspect_ratio': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['aspect_ratio']) if 'aspect_ratio' in df.columns else []},
        'width': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['w']) if 'w' in df.columns else []},
        'height': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['h']) if 'h' in df.columns else []},
        'center': {'category': df['name'].tolist() if 'name' in df.columns else [], 'x': safe_tolist(df['c_x']) if 'c_x' in df.columns else [], 'y': safe_tolist(df['c_y']) if 'c_y' in df.columns else []},
        'score': {'category': score_cat_merged, 'values': score_vals_merged} if score_cat_merged else {'category': [], 'values': []}
    }
    visualization_data['category_data_raw'] = {}
    for category in categories:
        cat_df = df[df['name'] == category]
        cat_score_raw = {}
        if 'score' in cat_df.columns:
            cat_score_raw['values'] = safe_score_tolist(cat_df['score'])
        visualization_data['category_data_raw'][category] = {
            'count': len(cat_df),
            'area': {'values': safe_tolist(cat_df['area']) if 'area' in cat_df.columns else [], 'sqrt_values': safe_tolist(cat_df['sqrt_area']) if 'sqrt_area' in cat_df.columns else []},
            'dimensions': {'width': safe_tolist(cat_df['w']) if 'w' in cat_df.columns else [], 'height': safe_tolist(cat_df['h']) if 'h' in cat_df.columns else [], 'max_side': safe_tolist(cat_df['max_side']) if 'max_side' in cat_df.columns else [], 'min_side': safe_tolist(cat_df['min_side']) if 'min_side' in cat_df.columns else []},
            'ratios': {'wh_ratio': safe_tolist(cat_df['wh_ratio']) if 'wh_ratio' in cat_df.columns else [], 'aspect_ratio': safe_tolist(cat_df['aspect_ratio']) if 'aspect_ratio' in cat_df.columns else []},
            'spatial': {'center_x': safe_tolist(cat_df['c_x']) if 'c_x' in cat_df.columns else [], 'center_y': safe_tolist(cat_df['c_y']) if 'c_y' in cat_df.columns else []},
            'score': cat_score_raw
        }
    return eda, visualization_data


@app.route('/api/load_dataset_merged', methods=['POST'])
def load_dataset_merged():
    """多选加载：根据扫描结果合并多个 COCO 为一个数据集。合并文件与历史版本写入 root_path（加载的数据集对应目录），不写入 app 的 data 目录。"""
    try:
        data = request.get_json() or {}
        if not isinstance(data, dict):
            data = {}
        items = data.get('items', [])
        dataset_name = (data.get('dataset_name') or 'merged').strip() or 'merged'
        root_path = (data.get('root_path') or data.get('merge_output_dir') or '').strip()
        meta_filter_mapping = data.get('meta_filter_mapping') if isinstance(data.get('meta_filter_mapping'), dict) else None
        if not items:
            return jsonify({'error': '请至少选择一项（items 不能为空）'}), 400
        prepared_items = []
        for it in items:
            fixed = _prepare_merge_item(it)
            if fixed:
                prepared_items.append(fixed)
        if not prepared_items:
            return jsonify({'error': '未找到可加载的数据。请确认目录中存在图片文件，或路径可访问。'}), 400
        output_dir = root_path if root_path else None
        eda, visualization_data = _load_dataset_merged_impl(prepared_items, dataset_name, output_dir=output_dir, meta_filter_mapping=meta_filter_mapping)
        dataset_id = f"{dataset_name}_{len(current_datasets)}"
        current_datasets[dataset_id] = eda
        _persist_dataset(dataset_id, eda.coco_json_path, dataset_name, eda.image_dir)
        _write_coco_dir_record(eda.coco_json_path, dataset_name, eda.image_dir or '')
        if not _list_versions(eda.coco_json_path):
            with open(eda.coco_json_path, 'r', encoding='utf-8') as f:
                coco_data = json.load(f)
            _save_version(eda.coco_json_path, coco_data, comment='加载时原版')
        visualization_data['dataset_id'] = dataset_id
        visualization_data['dataset_name'] = dataset_name
        return jsonify({'success': True, **visualization_data})
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@app.route('/api/get_filtered_data', methods=['POST'])
def get_filtered_data():
    """根据筛选条件返回过滤后的数据"""
    try:
        data = request.get_json() or {}
        if not isinstance(data, dict):
            data = {}
        dataset_id = data.get('dataset_id')
        selected_categories = data.get('selected_categories', [])
        
        eda = _ensure_dataset_loaded(dataset_id)
        if eda is None:
            return jsonify({'error': '数据集不存在'}), 400
        df = eda.compute_bbox_features()
        df = _add_normalized_bbox_stats(eda, df)
        
        # 应用筛选
        if selected_categories and len(selected_categories) > 0:
            df = df[df['name'].isin(selected_categories)]
            if df.empty:
                return jsonify({'error': '筛选后无数据'}), 400
        
        score_f_cat, score_f_vals = [], []
        if 'score' in df.columns:
            for _, row in df.iterrows():
                v = safe_float(row.get('score'))
                if v is not None and not math.isinf(v):
                    if 0 <= v <= 1:
                        score_f_vals.append(v)
                    elif 0 <= v <= 100:
                        score_f_vals.append(v / 100.0)
                    else:
                        score_f_vals.append(v)
                    score_f_cat.append(row.get('name', ''))
        # 返回筛选后的数据（归一化值）
        filtered_data = {
            'area': {
                'category': df['name'].tolist() if 'name' in df.columns else [],
                'values': safe_tolist(df['area_norm']) if 'area_norm' in df.columns else []
            },
            'sqrt_area': {
                'category': df['name'].tolist() if 'name' in df.columns else [],
                'values': safe_tolist(df['sqrt_area_norm']) if 'sqrt_area_norm' in df.columns else []
            },
            'max_side': {
                'category': df['name'].tolist() if 'name' in df.columns else [],
                'values': safe_tolist(df['max_side_norm']) if 'max_side_norm' in df.columns else []
            },
            'wh_ratio': {
                'category': df['name'].tolist() if 'name' in df.columns else [],
                'values': safe_tolist(df['wh_ratio']) if 'wh_ratio' in df.columns else []
            },
            'aspect_ratio': {
                'category': df['name'].tolist() if 'name' in df.columns else [],
                'values': safe_tolist(df['aspect_ratio']) if 'aspect_ratio' in df.columns else []
            },
            'width': {
                'category': df['name'].tolist() if 'name' in df.columns else [],
                'values': safe_tolist(df['w_norm']) if 'w_norm' in df.columns else []
            },
            'height': {
                'category': df['name'].tolist() if 'name' in df.columns else [],
                'values': safe_tolist(df['h_norm']) if 'h_norm' in df.columns else []
            },
            'center': {
                'category': df['name'].tolist() if 'name' in df.columns else [],
                'x': safe_tolist(df['c_x_norm']) if 'c_x_norm' in df.columns else [],
                'y': safe_tolist(df['c_y_norm']) if 'c_y_norm' in df.columns else []
            },
            'score': {'category': score_f_cat, 'values': score_f_vals} if score_f_cat else {'category': [], 'values': []}
        }
        filtered_data_raw = {
            'area': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['area']) if 'area' in df.columns else []},
            'sqrt_area': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['sqrt_area']) if 'sqrt_area' in df.columns else []},
            'max_side': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['max_side']) if 'max_side' in df.columns else []},
            'wh_ratio': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['wh_ratio']) if 'wh_ratio' in df.columns else []},
            'aspect_ratio': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['aspect_ratio']) if 'aspect_ratio' in df.columns else []},
            'width': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['w']) if 'w' in df.columns else []},
            'height': {'category': df['name'].tolist() if 'name' in df.columns else [], 'values': safe_tolist(df['h']) if 'h' in df.columns else []},
            'center': {'category': df['name'].tolist() if 'name' in df.columns else [], 'x': safe_tolist(df['c_x']) if 'c_x' in df.columns else [], 'y': safe_tolist(df['c_y']) if 'c_y' in df.columns else []},
            'score': {'category': score_f_cat, 'values': score_f_vals} if score_f_cat else {'category': [], 'values': []}
        }
        return jsonify({
            'success': True,
            'data': filtered_data,
            'data_raw': filtered_data_raw
        })
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@app.route('/api/get_images_by_category', methods=['POST'])
def get_images_by_category():
    """根据类别获取图片列表
    
    筛选逻辑：返回包含选中类别的图片，但每张图片显示所有标注（不只是选中类别的）。
    支持图片元数据筛选：c_time 时间段、product_id(SN) 模糊查询、position 精确匹配；缺失字段时该条件忽略。
    """
    try:
        data = request.get_json() or {}
        if not isinstance(data, dict):
            data = {}
        dataset_id = data.get('dataset_id')
        selected_categories = data.get('selected_categories', [])
        c_time_start = data.get('c_time_start')  # 可选，如 "2026-02-03 00:00:00"
        c_time_end = data.get('c_time_end')
        product_id_query = data.get('product_id_query')
        position = data.get('position')
        meta_filter_mapping = data.get('meta_filter_mapping') if isinstance(data.get('meta_filter_mapping'), dict) else None

        eda = _ensure_dataset_loaded(dataset_id)
        if eda is None:
            return jsonify({'error': '数据集不存在'}), 400
        df = eda.compute_bbox_features()

        # 找出包含选中类别的图片ID
        all_names_in_data = set(df['name'].dropna().unique()) if not df.empty else set()
        ann_image_ids = set(df['image_id'].astype(int).unique()) if not df.empty else set()
        all_image_ids = set(eda.images_df['id'].astype(int).tolist())
        no_gt_image_ids = all_image_ids - ann_image_ids

        if selected_categories and len(selected_categories) > 0:
            filtered_df = df[df['name'].isin(selected_categories)]
            if filtered_df.empty:
                return jsonify({'error': '筛选后无图片'}), 400
            target_image_ids = filtered_df['image_id'].unique()
            # 选中类别已覆盖数据中全部 GT 类别时，与「全选」等价：同时包含无任何 GT 框的图片（否则纯空图不会出现在列表中）
            if all_names_in_data and all_names_in_data <= set(selected_categories) and no_gt_image_ids:
                target_image_ids = np.unique(np.concatenate([target_image_ids, list(no_gt_image_ids)]))
        else:
            # 无类别筛选时，以 images_df 为基准，保证无标注的图片也能显示
            target_image_ids = eda.images_df['id'].unique()

        # 图片元数据筛选（c_time / product_id / position），兼容缺失字段
        meta_allowed = _apply_image_meta_filters(
            eda.images_df,
            c_time_start=c_time_start or None,
            c_time_end=c_time_end or None,
            product_id_query=product_id_query or None,
            position=position or None,
            meta_filter_mapping=meta_filter_mapping
        )
        if meta_allowed is not None and len(meta_allowed) > 0:
            target_image_ids = [i for i in target_image_ids if int(i) in meta_allowed]
        elif meta_allowed is not None and len(meta_allowed) == 0:
            # 元数据筛选结果为空（例如时间范围无匹配）
            return jsonify({
                'success': True,
                'images': [],
                'image_dir': str(eda.image_dir),
                'total_images': 0
            })

        # 获取这些图片的所有标注（不只是选中类别的）
        all_df = df[df['image_id'].isin(target_image_ids)] if not df.empty else pd.DataFrame()

        # 按图片ID分组，构建快速查找字典（无标注图片不在此 dict 中）
        ann_groups = {}
        if not all_df.empty:
            for _img_id, _grp in all_df.groupby('image_id'):
                ann_groups[_img_id] = _grp

        def _is_nan(v):
            return isinstance(v, float) and math.isnan(v)

        def _build_annotations(group_df):
            """将标注 DataFrame 行转换为标注字典列表。"""
            annotations = []
            if group_df is None or group_df.empty:
                return annotations
            for _, row in group_df.iterrows():
                ann = {'category': row['name']}
                for col in row.index:
                    if col == 'name':
                        continue
                    val = row[col]
                    if val is None:
                        continue
                    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
                        continue
                    if col == 'bbox':
                        bbox = extract_bbox(val)
                        if bbox:
                            ann['bbox'] = bbox
                    elif col == 'segmentation':
                        if val is not None and (isinstance(val, (list, dict)) and len(val) > 0 if hasattr(val, '__len__') else True):
                            ann['has_segmentation'] = True
                    elif isinstance(val, np.ndarray):
                        if val.size > 0 and not np.all(np.isnan(val)):
                            ann[col] = val.tolist()
                    elif isinstance(val, (np.integer, np.floating)):
                        ann[col] = float(val) if isinstance(val, np.floating) else int(val)
                    elif isinstance(val, (int, float, str, bool)):
                        ann[col] = val
                    elif isinstance(val, (list, tuple)):
                        ann[col] = list(val)
                annotations.append(ann)
            return annotations

        images_list = []
        # 遍历所有目标图片（包括无标注的），确保 GT 为空的图片也能显示
        for image_id in target_image_ids:
            img_rows = eda.images_df[eda.images_df['id'] == image_id]
            if img_rows.empty:
                continue
            img_info = img_rows.iloc[0]

            group_df = ann_groups.get(image_id)
            annotations = _build_annotations(group_df)

            # width/height 可能不在 COCO images 中，从 bbox 推断
            if 'width' in img_info.index and 'height' in img_info.index and pd.notna(img_info.get('width')) and pd.notna(img_info.get('height')):
                img_w, img_h = int(img_info['width']), int(img_info['height'])
            else:
                img_w, img_h = 0, 0
                if group_df is not None:
                    for _, row in group_df.iterrows():
                        bbox = extract_bbox(row.get('bbox'))
                        if bbox and len(bbox) >= 4:
                            x, y, bw, bh = bbox[0], bbox[1], bbox[2], bbox[3]
                            img_w = max(img_w, int(x + bw))
                            img_h = max(img_h, int(y + bh))
                if img_w <= 0:
                    img_w = 1
                if img_h <= 0:
                    img_h = 1
            img_item = {
                'image_id': int(image_id),
                'file_name': img_info['file_name'],
                'width': img_w,
                'height': img_h,
                'annotations': annotations,
                'num_annotations': len(annotations)
            }
            # 图片级别扩展字段（COCO 扩展）；支持一图多类 image_categories（数组）
            img_cats = img_info.get('image_categories')
            if img_cats is None or _is_nan(img_cats):
                single = img_info.get('image_category')
                img_cats = [str(single)] if single is not None and not _is_nan(single) and str(single).strip() else ['未分类']
            elif isinstance(img_cats, str):
                try:
                    img_cats = json.loads(img_cats) if img_cats.strip() else ['未分类']
                except (json.JSONDecodeError, AttributeError):
                    single = img_info.get('image_category')
                    img_cats = [str(single)] if single is not None and not _is_nan(single) and str(single).strip() else ['未分类']
            else:
                try:
                    img_cats = [str(c) for c in img_cats] if img_cats else ['未分类']
                except TypeError:
                    img_cats = ['未分类']
            img_item['image_category'] = img_cats[0] if img_cats else '未分类'
            img_item['image_categories'] = img_cats
            note_val = img_info.get('note')
            if note_val is not None and not _is_nan(note_val):
                img_item['note'] = str(note_val)
            if 'source_path' in img_info and img_info['source_path'] is not None:
                img_item['source_path'] = str(img_info['source_path'])
            # 图片元数据扩展字段（兼容缺失）：product_id(即SN)、c_time、position
            if img_info.get('product_id') is not None and (not isinstance(img_info['product_id'], float) or not math.isnan(img_info['product_id'])):
                img_item['product_id'] = str(img_info['product_id'])
            if img_info.get('c_time') is not None and (not isinstance(img_info['c_time'], float) or not math.isnan(img_info['c_time'])):
                img_item['c_time'] = str(img_info['c_time'])
            if img_info.get('position') is not None and (not isinstance(img_info['position'], float) or not math.isnan(img_info['position'])):
                img_item['position'] = str(img_info['position'])

            # 完整透传 COCO images 元字段（除 id 外），供前端看图界面完整显示
            image_meta = {}
            for _col in img_info.index:
                if _col == 'id':
                    continue
                _val = img_info.get(_col)
                if _val is None:
                    continue
                if isinstance(_val, (float, np.floating)) and (math.isnan(_val) or math.isinf(_val)):
                    continue
                if isinstance(_val, np.integer):
                    image_meta[_col] = int(_val)
                elif isinstance(_val, np.floating):
                    image_meta[_col] = float(_val)
                elif isinstance(_val, np.ndarray):
                    image_meta[_col] = _val.tolist()
                elif isinstance(_val, (list, tuple)):
                    image_meta[_col] = list(_val)
                elif isinstance(_val, dict):
                    image_meta[_col] = _val
                else:
                    image_meta[_col] = _val
            img_item['image_meta'] = image_meta

            # 尝试获取文件大小和修改时间（若在磁盘上存在）
            file_name = img_info.get('file_name', '')
            image_dir = eda.image_dir
            source_path = img_info.get('source_path')
            if source_path and getattr(eda, 'source_dirs', None):
                image_dir = eda.source_dirs.get(source_path) or image_dir
            if not image_dir and hasattr(eda, 'coco_json_path'):
                image_dir = str(Path(eda.coco_json_path).parent)
            
            if file_name and image_dir:
                try:
                    file_path = Path(file_name)
                    if file_path.is_absolute():
                        image_path = file_path
                    else:
                        image_path = Path(image_dir) / file_name
                    
                    if not image_path.exists() and hasattr(eda, 'coco_json_path'):
                        # 兜底路径
                        alt_paths = [
                            Path(eda.coco_json_path).parent / file_name,
                            Path(image_dir) / Path(file_name).name
                        ]
                        for alt in alt_paths:
                            if alt.exists():
                                image_path = alt
                                break
                                
                    if image_path.exists():
                        stat = image_path.stat()
                        img_item['file_size'] = stat.st_size
                        img_item['modified_time'] = stat.st_mtime
                except Exception:
                    pass

            images_list.append(img_item)
        
        # 按图片ID排序
        images_list.sort(key=lambda x: x['image_id'])

        # ---- 扫描同目录下的预测结果 COCO 文件 ----
        search_dirs = set()
        if hasattr(eda, 'coco_json_path') and eda.coco_json_path:
            search_dirs.add(str(Path(eda.coco_json_path).parent))
        if hasattr(eda, 'source_coco_paths') and eda.source_coco_paths:
            for src_path in eda.source_coco_paths.values():
                search_dirs.add(str(Path(src_path).parent))

        all_pred = {}       # model_name -> {file_name -> [pred_ann]}
        pred_model_names = []
        for d in search_dirs:
            for pf in _find_pred_files(d):
                mname = pf['model_name']
                if mname not in pred_model_names:
                    pred_model_names.append(mname)
                loaded = _load_pred_anns_from_file(pf['path'], mname)
                if mname not in all_pred:
                    all_pred[mname] = {}
                all_pred[mname].update(loaded)

        if all_pred:
            for img_item in images_list:
                fname = img_item['file_name']
                fname_base = fname.replace('\\', '/').split('/')[-1]
                pred_anns = []
                for mname, fname_map in all_pred.items():
                    model_anns = fname_map.get(fname) or fname_map.get(fname_base) or []
                    pred_anns.extend(model_anns)
                if pred_anns:
                    img_item['pred_annotations'] = pred_anns

        _safe_log(f"[get_images_by_category] dataset_id={dataset_id} images={len(images_list)} target_image_ids={len(target_image_ids)}")
        return jsonify({
            'success': True,
            'images': _json_sanitize(images_list),
            'image_dir': str(eda.image_dir),
            'total_images': len(images_list),
            'pred_model_names': pred_model_names,
        })
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@app.route('/api/get_image', methods=['GET'])
def get_image():
    """获取图片文件（用于显示）"""
    try:
        dataset_id = request.args.get('dataset_id')
        file_name = request.args.get('file_name')
        
        eda = _ensure_dataset_loaded(dataset_id)
        if eda is None:
            return jsonify({'error': '数据集不存在'}), 400
        
        source_path = request.args.get('source_path')
        image_dir = eda.image_dir
        if source_path and getattr(eda, 'source_dirs', None):
            image_dir = eda.source_dirs.get(source_path) or image_dir
        if not image_dir:
            image_dir = str(Path(eda.coco_json_path).parent)
        
        # 处理相对路径和绝对路径
        file_path = Path(file_name)
        if file_path.is_absolute():
            image_path = file_path
        else:
            image_path = Path(image_dir) / file_name
        
        if not image_path.exists():
            # 尝试其他可能的路径
            alt_paths = [
                Path(eda.coco_json_path).parent / file_name,
                Path(image_dir) / Path(file_name).name,
            ]
            for alt_path in alt_paths:
                if alt_path.exists():
                    image_path = alt_path
                    break
            else:
                return jsonify({'error': f'图片文件不存在: {file_name}'}), 404
        
        from flask import send_file
        return send_file(str(image_path))
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


def _sync_gt_annotations_to_source_cocos(coco_data, touched_merged_image_ids):
    """合并数据集：将已写入合并 COCO 的 GT 同步到各子目录下的源 _annotations.coco.json（与 save_image_metadata 写回源文件一致）。"""
    if not touched_merged_image_ids:
        return
    source_coco_paths = coco_data.get('source_coco_paths')
    if not source_coco_paths or not isinstance(source_coco_paths, dict):
        return
    merged_by_id = {img['id']: img for img in coco_data.get('images', []) if img.get('id') is not None}
    merged_cat_by_id = {c['id']: c.get('name') for c in coco_data.get('categories', []) if c.get('id') is not None}

    by_file = {}
    for mid in touched_merged_image_ids:
        mimg = merged_by_id.get(mid)
        if not mimg:
            continue
        sp_key = str(mimg.get('source_path') or '')
        fn = mimg.get('file_name') or ''
        src_abs = source_coco_paths.get(sp_key)
        if not src_abs or not fn:
            continue
        p = Path(src_abs)
        if not p.is_file():
            continue
        key = str(p.resolve())
        by_file.setdefault(key, []).append((mid, fn))

    for src_abs_str, batch in by_file.items():
        try:
            with open(src_abs_str, 'r', encoding='utf-8') as f:
                src_coco = json.load(f)
        except Exception as e:
            _safe_log(f"[sync_gt_source] read_fail path={src_abs_str} err={e}")
            continue

        src_img_by_fn = {im.get('file_name'): im for im in src_coco.get('images', []) if im.get('file_name')}
        src_iids_to_clear = set()
        for _mid, fn in batch:
            simg = src_img_by_fn.get(fn)
            if simg and simg.get('id') is not None:
                src_iids_to_clear.add(simg['id'])
        src_coco['annotations'] = [
            a for a in src_coco.get('annotations', [])
            if a.get('image_id') not in src_iids_to_clear
        ]
        max_aid = max((a['id'] for a in src_coco.get('annotations', [])), default=0)

        for merged_id, fn in batch:
            simg = src_img_by_fn.get(fn)
            if not simg or simg.get('id') is None:
                continue
            src_iid = simg['id']
            merged_anns = [a for a in coco_data.get('annotations', []) if a.get('image_id') == merged_id]
            for ma in merged_anns:
                cname = merged_cat_by_id.get(ma.get('category_id'))
                if not cname:
                    continue
                src_cat_id = None
                for c in src_coco.get('categories', []):
                    if c.get('name') == cname:
                        src_cat_id = c['id']
                        break
                if src_cat_id is None:
                    src_cat_id = max((c['id'] for c in src_coco.get('categories', [])), default=0) + 1
                    src_coco.setdefault('categories', []).append({'id': src_cat_id, 'name': cname})
                max_aid += 1
                bbox = ma.get('bbox')
                area = ma.get('area')
                if area is None and bbox and len(bbox) == 4:
                    area = bbox[2] * bbox[3]
                rec = {
                    'id': max_aid,
                    'image_id': src_iid,
                    'category_id': src_cat_id,
                    'bbox': bbox,
                    'area': area or 0,
                    'iscrowd': ma.get('iscrowd', 0),
                }
                if ma.get('_from_pred'):
                    rec['_from_pred'] = ma['_from_pred']
                src_coco.setdefault('annotations', []).append(rec)

        try:
            with open(src_abs_str, 'w', encoding='utf-8') as f:
                json.dump(src_coco, f, indent=2, ensure_ascii=False)
            _safe_log(f"[sync_gt_source] wrote path={src_abs_str} images_touched={len(batch)}")
        except Exception as e:
            _safe_log(f"[sync_gt_source] write_fail path={src_abs_str} err={e}")


@app.route('/api/save_annotations', methods=['POST'])
def save_annotations():
    """保存标注到COCO JSON文件"""
    try:
        data = request.get_json() or {}
        if not isinstance(data, dict):
            data = {}
        dataset_id = data.get('dataset_id')
        images_data = data.get('images', [])
        
        eda = _ensure_dataset_loaded(dataset_id)
        if eda is None:
            return jsonify({'error': '数据集不存在'}), 400
        
        # 读取原始COCO文件
        with open(eda.coco_json_path, 'r', encoding='utf-8') as f:
            coco_data = json.load(f)
        
        _safe_log(f"[save_annotations] begin dataset_id={dataset_id} path={eda.coco_json_path} images_payload={len(images_data)}")

        # 更新标注
        existing_ann_ids = set(ann['id'] for ann in coco_data.get('annotations', []))
        max_ann_id = max(existing_ann_ids) if existing_ann_ids else 0

        # 构建 image_id → (width, height) 映射，用于 bbox 边界校正
        img_size_map = {img['id']: (img.get('width', 0), img.get('height', 0))
                        for img in coco_data.get('images', [])}

        for img_data in images_data:
            image_id = img_data['image_id']
            new_annotations = img_data['annotations']
            
            # 移除该图片的旧标注
            coco_data['annotations'] = [
                ann for ann in coco_data.get('annotations', []) 
                if ann.get('image_id') != image_id
            ]
            
            # 添加新标注
            for ann in new_annotations:
                max_ann_id += 1
                # 获取category_id
                cat_id = ann.get('category_id')
                if cat_id is None:
                    # 从类别名查找
                    cat_name = ann.get('category', '')
                    for cat in coco_data.get('categories', []):
                        if cat['name'] == cat_name:
                            cat_id = cat['id']
                            break
                    if cat_id is None:
                        # 新增类别
                        cat_id = max((c['id'] for c in coco_data.get('categories', [])), default=0) + 1
                        coco_data.setdefault('categories', []).append({
                            'id': cat_id,
                            'name': cat_name
                        })
                
                raw_bbox = ann.get('bbox')
                # clamp bbox 到图片边界，防止越界坐标
                if raw_bbox and len(raw_bbox) == 4:
                    img_w, img_h = img_size_map.get(image_id, (0, 0))
                    bx, by, bw, bh = float(raw_bbox[0]), float(raw_bbox[1]), float(raw_bbox[2]), float(raw_bbox[3])
                    if img_w > 0 and img_h > 0:
                        bx = max(0.0, min(bx, img_w))
                        by = max(0.0, min(by, img_h))
                        bw = max(1.0, min(bw, img_w - bx))
                        bh = max(1.0, min(bh, img_h - by))
                    raw_bbox = [bx, by, bw, bh]
                coco_ann = {
                    'id': max_ann_id,
                    'image_id': image_id,
                    'category_id': cat_id,
                    'bbox': raw_bbox,
                    'area': raw_bbox[2] * raw_bbox[3] if raw_bbox else (ann.get('area') or 0),
                    'iscrowd': ann.get('iscrowd', 0)
                }
                if ann.get('_from_pred'):
                    coco_ann['_from_pred'] = ann['_from_pred']
                coco_data['annotations'].append(coco_ann)

        # 合并加载：同步把 GT 写回各子目录下的源 _annotations.coco.json（用户直接打开的是这些文件）
        touched_merged_ids = [img_data['image_id'] for img_data in images_data]
        _sync_gt_annotations_to_source_cocos(coco_data, touched_merged_ids)

        # 保存文件（通过版本系统存档，不再生成 .backup 文件）
        _save_version(eda.coco_json_path, coco_data)
        with open(eda.coco_json_path, 'w', encoding='utf-8') as f:
            json.dump(coco_data, f, indent=2, ensure_ascii=False)
        _safe_log(f"[save_annotations] wrote path={eda.coco_json_path} total_annotations={len(coco_data.get('annotations', []))}")

        # 清理同目录下遗留的旧 .backup 文件
        backup_path = Path(eda.coco_json_path).with_suffix('.json.backup')
        if not backup_path.exists():
            backup_path = Path(str(eda.coco_json_path) + '.backup')
        try:
            if backup_path.exists():
                backup_path.unlink()
        except Exception:
            pass

        # 关键：保存后刷新内存缓存。否则后续 get_images_by_category 仍可能读取旧 annotations_df
        try:
            current_datasets.pop(dataset_id, None)
            _ensure_dataset_loaded(dataset_id)
            _safe_log(f"[save_annotations] cache_reloaded dataset_id={dataset_id}")
        except Exception:
            # 刷新失败不影响已写盘结果，后续请求会按需再加载
            _safe_log(f"[save_annotations] cache_reload_failed dataset_id={dataset_id}")

        return jsonify({'success': True, 'message': '保存成功'})
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@app.route('/api/rename_category', methods=['POST'])
def rename_category():
    """跨图批量重命名标注类别：将 COCO 文件中所有 old_name 类别改为 new_name。
    支持合并（new_name 已存在时自动合并 category_id）。"""
    try:
        data = request.get_json() or {}
        dataset_id = data.get('dataset_id')
        old_name = (data.get('old_name') or '').strip()
        new_name = (data.get('new_name') or '').strip()
        if not old_name or not new_name:
            return jsonify({'error': '请提供 old_name 和 new_name'}), 400

        eda = _ensure_dataset_loaded(dataset_id)
        if eda is None:
            return jsonify({'error': '数据集不存在'}), 400

        with open(eda.coco_json_path, 'r', encoding='utf-8') as f:
            coco_data = json.load(f)

        categories = coco_data.get('categories', [])
        # 找到 old category
        old_cat = next((c for c in categories if c['name'] == old_name), None)
        if old_cat is None:
            return jsonify({'error': f'类别 "{old_name}" 不存在'}), 400

        # 找到/创建 new category
        new_cat = next((c for c in categories if c['name'] == new_name), None)
        if new_cat is None:
            # 创建新类别，继承 old_cat 的 id 并改名（保持 id 连续性）
            old_cat['name'] = new_name
            new_cat_id = old_cat['id']
        else:
            # new_name 已存在：把 old 的 annotations 合并到 new，然后删除 old category
            new_cat_id = new_cat['id']
            old_cat_id = old_cat['id']
            # 更新 annotations：把 old_cat_id → new_cat_id
            for ann in coco_data.get('annotations', []):
                if ann.get('category_id') == old_cat_id:
                    ann['category_id'] = new_cat_id
            # 删除 old category
            coco_data['categories'] = [c for c in categories if c['id'] != old_cat_id]
            # 写回并保存
            _save_version(eda.coco_json_path, coco_data, comment=f'合并类别 {old_name} → {new_name}')
            with open(eda.coco_json_path, 'w', encoding='utf-8') as f:
                json.dump(coco_data, f, indent=2, ensure_ascii=False)
            # 重新加载 eda
            current_datasets.pop(dataset_id, None)
            affected = sum(1 for ann in coco_data.get('annotations', []) if ann.get('category_id') == new_cat_id)
            return jsonify({'success': True, 'message': f'已将 {old_name} 合并到 {new_name}', 'affected': affected})

        # 简单改名：更新 categories 中 old_cat 的 name（已在上面 old_cat['name'] = new_name 完成）
        # annotations 的 category_id 不变，无需更新
        _save_version(eda.coco_json_path, coco_data, comment=f'重命名类别 {old_name} → {new_name}')
        with open(eda.coco_json_path, 'w', encoding='utf-8') as f:
            json.dump(coco_data, f, indent=2, ensure_ascii=False)
        current_datasets.pop(dataset_id, None)
        affected = sum(1 for ann in coco_data.get('annotations', []) if ann.get('category_id') == new_cat_id)
        return jsonify({'success': True, 'message': f'已将类别 {old_name} 重命名为 {new_name}', 'affected': affected})
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@app.route('/api/save_image_metadata', methods=['POST'])
def save_image_metadata():
    """保存图片级分类和备注：最新内容直接覆盖对应的加载 COCO 文件；存档快照写入同目录下的 .coco_visualizer/。"""
    try:
        data = request.get_json() or {}
        if not isinstance(data, dict):
            data = {}
        dataset_id = data.get('dataset_id')
        images_meta = data.get('images', [])  # [{ image_id, image_category, note }, ...]
        
        eda = _ensure_dataset_loaded(dataset_id)
        if eda is None:
            return jsonify({'error': '数据集不存在'}), 400
        
        with open(eda.coco_json_path, 'r', encoding='utf-8') as f:
            coco_data = json.load(f)
        
        meta_by_id = {item['image_id']: item for item in images_meta}
        images_list = coco_data.get('images', [])
        
        for img in images_list:
            iid = img.get('id')
            if iid is None:
                continue
            if iid in meta_by_id:
                meta = meta_by_id[iid]
                cats = meta.get('image_categories')
                if cats is None:
                    single = meta.get('image_category', '未分类')
                    cats = [single] if single else ['未分类']
                img['image_categories'] = list(cats)
                img['image_category'] = cats[0] if cats else '未分类'
                img['note'] = meta.get('note', '')
        
        # 保存图片分类定义（类别顺序+颜色），供下次加载时精确还原
        cat_defs = data.get('image_category_definitions')
        if cat_defs and isinstance(cat_defs, dict) and cat_defs.get('categories'):
            coco_data['image_category_definitions'] = cat_defs

        # skip_version=True 时仅写回主文件（自动保存），不生成历史快照
        skip_version = data.get('skip_version', False)
        if not skip_version:
            version_comment = data.get('version_comment') or data.get('comment') or ''
            version_id = _save_version(eda.coco_json_path, coco_data, comment=version_comment)
        else:
            version_id = None

        target_path = Path(eda.coco_json_path).resolve()
        with open(target_path, 'w', encoding='utf-8') as f:
            json.dump(coco_data, f, indent=2, ensure_ascii=False)

        # 同步更新内存中的 eda.images_df，使同一 session 内的后续接口调用也能读到最新分类
        if 'image_categories' not in eda.images_df.columns:
            eda.images_df['image_categories'] = None
        if 'image_category' not in eda.images_df.columns:
            eda.images_df['image_category'] = None
        if 'note' not in eda.images_df.columns:
            eda.images_df['note'] = ''
        for item in images_meta:
            iid = item.get('image_id')
            if iid is None:
                continue
            cats = item.get('image_categories') or ['未分类']
            note = item.get('note', '')
            idx_list = eda.images_df.index[eda.images_df['id'] == iid].tolist()
            if idx_list:
                idx = idx_list[0]
                eda.images_df.at[idx, 'image_categories'] = list(cats)
                eda.images_df.at[idx, 'image_category'] = cats[0] if cats else '未分类'
                eda.images_df.at[idx, 'note'] = note

        # ---- 合并数据集：同步将分类写回各源 COCO 文件，下次合并时自动继承 ----
        source_coco_paths = coco_data.get('source_coco_paths') or getattr(eda, 'source_coco_paths', None) or {}
        if source_coco_paths:
            # 建立 merged image_id → (source_path_key, file_name) 索引
            id_to_src = {}
            for _, row in eda.images_df.iterrows():
                rid = int(row['id'])
                id_to_src[rid] = (str(row.get('source_path') or ''), str(row.get('file_name') or ''))
            # 按源 COCO 文件分组
            src_file_updates = {}  # coco_abs_path -> {file_name -> {cats, note}}
            for item in images_meta:
                iid = item.get('image_id')
                if iid not in id_to_src:
                    continue
                sp_key, fn = id_to_src[iid]
                src_coco_path = source_coco_paths.get(sp_key)
                if not src_coco_path or not fn:
                    continue
                if src_coco_path not in src_file_updates:
                    src_file_updates[src_coco_path] = {}
                cats = item.get('image_categories') or ['未分类']
                src_file_updates[src_coco_path][fn] = {
                    'image_categories': list(cats),
                    'image_category': cats[0] if cats else '未分类',
                    'note': item.get('note', '')
                }
            for src_path_str, file_upd in src_file_updates.items():
                try:
                    src_p = Path(src_path_str)
                    if not src_p.exists():
                        continue
                    with open(src_p, 'r', encoding='utf-8') as sf:
                        src_coco = json.load(sf)
                    changed = False
                    for simg in src_coco.get('images', []):
                        fn = simg.get('file_name', '')
                        if fn in file_upd:
                            u = file_upd[fn]
                            simg['image_categories'] = u['image_categories']
                            simg['image_category'] = u['image_category']
                            simg['note'] = u['note']
                            changed = True
                    if changed:
                        with open(src_p, 'w', encoding='utf-8') as sf:
                            json.dump(src_coco, sf, indent=2, ensure_ascii=False)
                except Exception:
                    pass  # 写源文件失败不阻断主流程

        return jsonify({
            'success': True,
            'message': '图片级分类与备注已保存',
            'version_id': version_id,
            'saved_path': str(target_path),
            'saved_dir': str(target_path.parent)
        })
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@app.route('/api/list_versions', methods=['POST'])
def list_versions():
    """列出当前数据集的 COCO 版本记录"""
    try:
        data = request.get_json() or {}
        if not isinstance(data, dict):
            data = {}
        dataset_id = data.get('dataset_id')
        eda = _ensure_dataset_loaded(dataset_id)
        if eda is None:
            return jsonify({'error': '数据集不存在'}), 400
        versions = _list_versions(eda.coco_json_path)
        return jsonify({'success': True, 'versions': versions})
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@app.route('/api/rollback_version', methods=['POST'])
def rollback_version():
    """回滚到指定版本（恢复 COCO 文件为该版本内容）"""
    try:
        data = request.get_json() or {}
        if not isinstance(data, dict):
            data = {}
        dataset_id = data.get('dataset_id')
        version_id = data.get('version_id')
        eda = _ensure_dataset_loaded(dataset_id)
        if eda is None:
            return jsonify({'error': '数据集不存在'}), 400
        if not version_id:
            return jsonify({'error': '请指定 version_id'}), 400
        _rollback_to_version(eda.coco_json_path, version_id)
        return jsonify({'success': True, 'message': f'已回滚到版本 {version_id}'})
    except FileNotFoundError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@app.route('/api/list_server_paths', methods=['POST'])
def list_server_paths():
    """列出服务器上的路径"""
    try:
        data = request.get_json() or {}
        if not isinstance(data, dict):
            data = {}
        base_path = data.get('base_path', '/')
        
        path = Path(base_path)
        if not path.exists():
            return jsonify({'error': '路径不存在'}), 400
        
        if not path.is_dir():
            return jsonify({'error': '不是目录'}), 400
        
        # 列出目录内容
        items = []
        for item in sorted(path.iterdir()):
            try:
                items.append({
                    'name': item.name,
                    'path': str(item),
                    'is_dir': item.is_dir(),
                    'is_file': item.is_file()
                })
            except PermissionError:
                continue
        
        return jsonify({
            'success': True,
            'items': items,
            'current_path': str(path)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== AI Chat 系统 ====================
import uuid as _uuid, time as _time

# ── 临时文件系统 ──────────────────────────────────────────
_TEMP_DIR = Path(tempfile.gettempdir()) / 'cocovis_temp'
_TEMP_DIR.mkdir(exist_ok=True)
_temp_files: dict = {}   # {file_id: {path, filename, created}}

def _cleanup_temp_files(max_age: int = 3600):
    """删除超过 max_age 秒的临时文件"""
    now = _time.time()
    for fid in list(_temp_files):
        info = _temp_files[fid]
        if now - info['created'] > max_age:
            try:
                info['path'].unlink(missing_ok=True)
            except Exception:
                pass
            _temp_files.pop(fid, None)

def _save_temp_file(content, filename: str) -> str:
    """保存内容为临时文件，返回 file_id"""
    _cleanup_temp_files()
    fid = _uuid.uuid4().hex[:10]
    safe_name = Path(filename).name
    path = _TEMP_DIR / f'{fid}_{safe_name}'
    if isinstance(content, bytes):
        path.write_bytes(content)
    else:
        path.write_text(str(content), encoding='utf-8')
    _temp_files[fid] = {'path': path, 'filename': safe_name, 'created': _time.time()}
    return fid


def _experiment_zip_destination(output_path, zip_name: str):
    """
    解析实验导出 ZIP 的目标路径（运行在服务端本机磁盘上）。
    - 若以 .zip 结尾：视为完整文件路径。
    - 否则视为目录，最终文件为 目录/{zip_name}。
    - 相对路径相对于 Flask 进程当前工作目录。
    返回 Path 或 None（None 表示不写指定路径，仍用临时目录 + 浏览器下载）。
    """
    if output_path is None:
        return None
    s = str(output_path).strip()
    if not s:
        return None
    zn = Path(zip_name).name
    p = Path(s).expanduser()
    if not p.is_absolute():
        p = (Path.cwd() / p).resolve()
    else:
        p = p.resolve()
    if p.suffix.lower() == '.zip':
        return p
    if p.exists() and p.is_file():
        raise ValueError(
            f'输出路径已存在且为文件，请填写目录或带 .zip 的完整路径：{p}'
        )
    return (p / zn).resolve()


def _write_zip_bytes_to_path(dest: Path, zip_bytes: bytes) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(zip_bytes)


def _resolve_image_dir(eda) -> str:
    """解析数据集的图片目录（优先用 eda.image_dir，fallback 用 coco_json 所在目录）"""
    img_dir = getattr(eda, 'image_dir', None) or ''
    if not img_dir:
        coco_path = getattr(eda, 'coco_json_path', None)
        img_dir = str(Path(coco_path).parent.resolve()) if coco_path else ''
    return str(Path(img_dir).resolve()) if img_dir else ''


@app.route('/api/export_experiment_dataset', methods=['POST'])
def export_experiment_dataset():
    """合并多源（可选）并导出 train/valid 实验包：每份含 _annotations.coco.json 与图片，划分使用固定随机种子。"""
    try:
        data = request.get_json() or {}
        if not isinstance(data, dict):
            data = {}
        train_ratio = float(data.get('train_ratio') or 0.8)
        if not (0 < train_ratio < 1):
            return jsonify({'success': False, 'error': 'train_ratio 须在 0 与 1 之间'}), 400
        seed = int(data.get('seed') if data.get('seed') is not None else 42)
        zip_name = (data.get('zip_name') or 'experiment_dataset.zip').strip()
        if not zip_name.lower().endswith('.zip'):
            zip_name += '.zip'
        dataset_name = (data.get('dataset_name') or 'dataset').strip() or 'dataset'
        drop_dup = data.get('drop_duplicate_basenames')
        drop_dup = True if drop_dup is None else bool(drop_dup)

        items = data.get('items')
        dataset_id = data.get('dataset_id')

        if items and isinstance(items, list):
            prepared = []
            for it in items:
                fixed = _prepare_merge_item(it)
                if fixed:
                    prepared.append(fixed)
            if not prepared:
                return jsonify({'success': False, 'error': '没有可用的合并源，请检查路径与 COCO 文件'}), 400
            zip_bytes, stats = build_experiment_zip_bytes(
                prepared_items=prepared,
                train_ratio=train_ratio,
                seed=seed,
                dataset_name=dataset_name,
                drop_duplicate_basenames=drop_dup,
            )
        elif dataset_id:
            eda = current_datasets.get(dataset_id)
            if not eda:
                return jsonify({'success': False, 'error': '数据集未加载或会话已失效，请重新加载'}), 400
            coco_path = getattr(eda, 'coco_json_path', None)
            if not coco_path or not Path(coco_path).exists():
                return jsonify({'success': False, 'error': '找不到 COCO 文件'}), 400
            img_dir = _resolve_image_dir(eda)
            source_dirs = getattr(eda, 'source_dirs', None)
            zip_bytes, stats = build_experiment_zip_bytes(
                coco_json_path=str(coco_path),
                image_dir_fallback=img_dir,
                source_dirs=source_dirs if isinstance(source_dirs, dict) else None,
                train_ratio=train_ratio,
                seed=seed,
                dataset_name=getattr(eda, 'name', None) or dataset_name,
                drop_duplicate_basenames=drop_dup,
            )
        else:
            return jsonify({'success': False, 'error': '请提供 dataset_id（当前已加载数据集）或 items（多源合并）'}), 400

        out_raw = (data.get('output_path') or data.get('save_path') or '').strip()
        dest = _experiment_zip_destination(out_raw or None, zip_name)
        if dest is not None:
            _write_zip_bytes_to_path(dest, zip_bytes)
            if isinstance(stats, dict):
                stats = {
                    **stats,
                    'saved_path': str(dest),
                    'storage_note': '已保存到服务端指定路径。',
                }
            return jsonify(_json_sanitize({
                'success': True,
                'saved_path': str(dest),
                'file_id': None,
                'download_url': None,
                'filename': zip_name,
                'stats': stats,
            }))

        fid = _save_temp_file(zip_bytes, zip_name)
        return jsonify(_json_sanitize({
            'success': True,
            'file_id': fid,
            'download_url': f'/api/chat/download/{fid}',
            'filename': zip_name,
            'stats': stats,
        }))
    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    except Exception as e:
        _safe_log(f'export_experiment_dataset: {e}')
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/export_experiment_dataset_stream', methods=['POST'])
def export_experiment_dataset_stream():
    """实验数据集导出（NDJSON 流）：每行一条 JSON，含真实进度 type=progress，结束 type=done 与 file_id。"""
    import queue as _queue
    from flask import Response, stream_with_context

    data = request.get_json() or {}
    if not isinstance(data, dict):
        data = {}
    train_ratio = float(data.get('train_ratio') or 0.8)
    if not (0 < train_ratio < 1):
        return jsonify({'success': False, 'error': 'train_ratio 须在 0 与 1 之间'}), 400
    seed = int(data.get('seed') if data.get('seed') is not None else 42)
    zip_name = (data.get('zip_name') or 'experiment_dataset.zip').strip()
    if not zip_name.lower().endswith('.zip'):
        zip_name += '.zip'
    dataset_name = (data.get('dataset_name') or 'dataset').strip() or 'dataset'
    drop_dup = data.get('drop_duplicate_basenames')
    drop_dup = True if drop_dup is None else bool(drop_dup)

    items = data.get('items')
    dataset_id = data.get('dataset_id')

    prepared = None
    coco_path_kw = None
    img_dir_kw = None
    source_dirs_kw = None
    ds_name_kw = dataset_name

    if items and isinstance(items, list):
        prepared = []
        for it in items:
            fixed = _prepare_merge_item(it)
            if fixed:
                prepared.append(fixed)
        if not prepared:
            return jsonify({'success': False, 'error': '没有可用的合并源，请检查路径与 COCO 文件'}), 400
    elif dataset_id:
        eda = current_datasets.get(dataset_id)
        if not eda:
            return jsonify({'success': False, 'error': '数据集未加载或会话已失效，请重新加载'}), 400
        cp = getattr(eda, 'coco_json_path', None)
        if not cp or not Path(cp).exists():
            return jsonify({'success': False, 'error': '找不到 COCO 文件'}), 400
        coco_path_kw = str(cp)
        img_dir_kw = _resolve_image_dir(eda)
        sd = getattr(eda, 'source_dirs', None)
        source_dirs_kw = sd if isinstance(sd, dict) else None
        ds_name_kw = getattr(eda, 'name', None) or dataset_name
    else:
        return jsonify({'success': False, 'error': '请提供 dataset_id（当前已加载数据集）或 items（多源合并）'}), 400

    out_raw = (data.get('output_path') or data.get('save_path') or '').strip()
    try:
        export_dest = _experiment_zip_destination(out_raw or None, zip_name)
    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 400

    q: _queue.Queue = _queue.Queue()

    def _worker():
        try:
            def on_progress(pct, msg):
                q.put(('progress', pct, msg))

            if prepared is not None:
                zip_bytes, stats = build_experiment_zip_bytes(
                    prepared_items=prepared,
                    train_ratio=train_ratio,
                    seed=seed,
                    dataset_name=ds_name_kw,
                    on_progress=on_progress,
                    drop_duplicate_basenames=drop_dup,
                )
            else:
                zip_bytes, stats = build_experiment_zip_bytes(
                    coco_json_path=coco_path_kw,
                    image_dir_fallback=img_dir_kw,
                    source_dirs=source_dirs_kw,
                    train_ratio=train_ratio,
                    seed=seed,
                    dataset_name=ds_name_kw,
                    on_progress=on_progress,
                    drop_duplicate_basenames=drop_dup,
                )
            zs = len(zip_bytes)
            mb = zs / (1024 * 1024)
            if export_dest is not None:
                on_progress(95, f'正在写入 {export_dest}（约 {mb:.1f} MB）…')
                _write_zip_bytes_to_path(export_dest, zip_bytes)
                if isinstance(stats, dict):
                    stats = {
                        **stats,
                        'saved_path': str(export_dest),
                        'storage_note': '已保存到服务端指定路径。',
                    }
                on_progress(99, '完成')
                q.put(('done', None, stats))
            else:
                on_progress(95, f'正在写入服务器临时文件（约 {mb:.1f} MB）…')
                fid = _save_temp_file(zip_bytes, zip_name)
                if isinstance(stats, dict):
                    stats = {
                        **stats,
                        'server_temp_dir': str(_TEMP_DIR),
                        'storage_note': '服务端临时文件仅用于本次下载（约 1 小时后清理）；本机保存位置由浏览器「下载」设置决定。',
                    }
                on_progress(99, '准备下载…')
                q.put(('done', fid, stats))
        except Exception as e:
            _safe_log(f'export_experiment_dataset_stream: {e}')
            q.put(('error', str(e)))

    threading.Thread(target=_worker, daemon=True).start()

    def generate():
        while True:
            item = q.get()
            if item[0] == 'progress':
                yield (json.dumps(_json_sanitize({
                    'type': 'progress',
                    'pct': item[1],
                    'message': item[2],
                }), ensure_ascii=False) + '\n').encode('utf-8')
            elif item[0] == 'done':
                fid, stats = item[1], item[2]
                done_obj = {
                    'type': 'done',
                    'filename': zip_name,
                    'stats': stats,
                }
                if fid:
                    done_obj['file_id'] = fid
                    done_obj['download_url'] = f'/api/chat/download/{fid}'
                if isinstance(stats, dict) and stats.get('saved_path'):
                    done_obj['saved_path'] = stats['saved_path']
                yield (json.dumps(_json_sanitize(done_obj), ensure_ascii=False) + '\n').encode('utf-8')
                return
            elif item[0] == 'error':
                yield (json.dumps({'type': 'error', 'message': item[1]}, ensure_ascii=False) + '\n').encode('utf-8')
                return

    return Response(
        stream_with_context(generate()),
        mimetype='application/x-ndjson',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'},
    )


def _build_images_list(dataset_id: str) -> list:
    """从已加载数据集构建 images 列表（供代码执行使用）"""
    if not dataset_id or dataset_id not in current_datasets:
        return []
    eda = current_datasets[dataset_id]
    try:
        coco_path = getattr(eda, 'coco_json_path', None)
        if not coco_path:
            return []
        coco = json.loads(Path(coco_path).read_text(encoding='utf-8'))
        cat_map = {c['id']: c['name'] for c in coco.get('categories', [])}
        ann_map = {}
        for ann in coco.get('annotations', []):
            iid = ann.get('image_id')
            ann_map.setdefault(iid, []).append({
                'category': cat_map.get(ann.get('category_id'), ''),
                'bbox': ann.get('bbox'),
                'area': ann.get('area'),
                'score': ann.get('score'),
            })
        img_dir = _resolve_image_dir(eda)
        images = []
        for img in coco.get('images', []):
            iid = img.get('id')
            fname = img.get('file_name', '')
            # 构建完整路径
            if fname and img_dir:
                full_path = str(Path(img_dir) / fname)
            else:
                full_path = fname
            images.append({
                'image_id': iid,
                'file_name': fname,
                'full_path': full_path,     # 完整磁盘路径
                'width': img.get('width'),
                'height': img.get('height'),
                'annotations': ann_map.get(iid, []),
                'pred_annotations': [],
            })
        return images
    except Exception:
        return []


def _build_agent_context(dataset_id: str) -> str:
    """基于真实数据构建 Agent 上下文摘要（包含实际统计数字和路径信息）"""
    images = _build_images_list(dataset_id)
    if not images:
        return "当前未加载数据集，images 变量为空列表。"
    from collections import Counter as _Counter
    n = len(images)
    n_annotated = sum(1 for img in images if img['annotations'])
    n_anns = sum(len(img['annotations']) for img in images)
    widths = [img['width'] for img in images if img.get('width')]
    heights = [img['height'] for img in images if img.get('height')]
    cat_counts = _Counter(ann['category'] for img in images for ann in img['annotations'])
    eda = current_datasets.get(dataset_id)
    ds_name = getattr(eda, 'dataset_name', '未知')
    coco_json_path = getattr(eda, 'coco_json_path', '未知')
    img_dir = _resolve_image_dir(eda)
    lines = [
        f"数据集名称：{ds_name}",
        f"COCO JSON 路径：{coco_json_path}",
        f"图片目录：{img_dir}",
        f"总图片数：{n}（已标注：{n_annotated}，未标注：{n - n_annotated}）",
        f"GT 框总数：{n_anns}，平均每张：{round(n_anns / n, 2) if n else 0}",
    ]
    if widths:
        lines.append(f"图片宽度范围：{min(widths)} ~ {max(widths)} px，均值：{round(sum(widths)/len(widths))} px")
    if heights:
        lines.append(f"图片高度范围：{min(heights)} ~ {max(heights)} px，均值：{round(sum(heights)/len(heights))} px")
    if cat_counts:
        lines.append(f"类别分布（共 {len(cat_counts)} 类）：" +
                     '、'.join(f"{c}({v})" for c, v in cat_counts.most_common(15)) +
                     ('...' if len(cat_counts) > 15 else ''))
    return '\n'.join(lines)


# Agent System Prompt：明确要求 AI 写代码而非猜测数字
AGENT_SYSTEM_PROMPT = """你是 COCOVisualizer 的 AI 数据分析 Agent。
当前数据集真实统计（由程序实时计算）：
{dataset_context}

## 核心规则（严格遵守）
1. **禁止编造数据**：所有数字必须来自代码执行结果，绝不能凭空猜测或估算。
2. **遇到数据问题必须写代码**：只要用户问数据相关内容（统计、筛选、分析），必须写 Python 代码并等待执行结果后再回答。
3. **使用真实字段名**：访问类别用 `ann['category']`（字符串），不要用 `ann['category_id']`。

## 代码执行环境
`images` 变量已就绪，结构如下（字段名固定，勿猜测）：
- image_id: int
- file_name: str              # 相对文件名，如 "img001.jpg"
- full_path: str              # 完整磁盘路径，如 "/data/dataset/images/img001.jpg"
- width: int, height: int
- annotations: [{category: str, bbox: [x,y,w,h], area: float, score: float|None}]
- pred_annotations: 同上

`images_dir` 变量：数据集图片目录的完整路径（str）
`coco_json_path` 变量：COCO JSON 文件的完整路径（str）

## 代码规范
- 统计/分析：用 print() 输出结果（会被系统自动捕获）
- 筛选图片：最后一行写 `[img['image_id'] for img in images if ...]` 列表
- 可以 import 标准库（Counter, math, statistics 等）
- 代码注释用中文
- 对于“打包数据集 / 可视化 / DF 查看”等任务，优先调用内置函数（见下方），不要只返回解释性文字

## 导出函数（代码中可直接调用）
- `export_csv(data, filename)` — 导出 list[dict] 或 list[list] 为 CSV（UTF-8 BOM，兼容 Excel）
- `export_json(data, filename)` — 导出 Python 对象为 JSON
- `export_txt(text, filename)` — 导出文本报告为 TXT
- `export_coco(image_ids, zip_name='filtered_dataset.zip', with_images=True, preview=True)` — 按 image_id 导出数据集；COCO 标注文件名固定为 `_annotations.coco.json`；若 `with_images=True` 会将图片与标注同级打包到 zip
- **任意 `open(path, 'w')` 写文件**均自动重定向到临时目录，无需 export_* 函数，用户同样可点击下载
- 当用户要求按条件筛选数据集时，必须先 `filter_gallery(image_ids, '说明')` 提供在线预览，再调用 `export_coco` 输出可下载压缩包
- 输出压缩包中，COCO 标注文件名**必须固定**为 `_annotations.coco.json`（不得添加任何前后缀）

## UI 控制函数（直接操控应用界面）
- `navigate_to(page)` — 切换到指定页面，page 可为 'gallery'|'viewer'|'eda'|'chat'|'load'
- `filter_gallery(image_ids, description)` — 将 image_id 列表推送到看图界面并自动切换，description 为筛选说明
- `show_chart(chart_type, labels, datasets, title)` — 在聊天中嵌入可视化图表
  - chart_type: 'bar'|'pie'|'line'|'doughnut'
  - labels: list[str]（X 轴/扇区标签）
  - datasets: list[dict]，每项含 label(str)、data(list[number])、backgroundColor(str 可选)
  - 示例：show_chart('bar', ['猫','狗','鸟'], [{'label':'数量','data':[100,50,30],'backgroundColor':'#4e79a7'}], '类别分布')
- `load_dataset_path(coco_json_path, image_dir='', dataset_name='')` — 加载新的数据集
- `show_table(rows, title='数据预览')` — 在聊天中输出可点击的表格预览，支持弹窗查看详情（rows 可为 list[dict] 或 DataFrame 转换结果）
- `pack_dataset(image_ids, zip_name='filtered_dataset.zip', preview=True)` — 一键打包筛选子集（固定 `_annotations.coco.json` + 图片同级 + zip）
- `show_df(df, title='DF预览', max_rows=300)` — DataFrame 或 list[dict] 的表格预览
- `visualize_df(df, x, y, chart_type='bar', title='DF可视化', topk=30)` — DataFrame 快速图表+表格预览
- `coco_overview()` — 返回数据集总览（图片数、标注数、类别数、平均每图框数）
- `category_stats(source='gt')` — 类别统计（source='gt' 或 'pred'）
- `bbox_stats(source='gt')` — 框尺度统计（面积/宽高比/极小框占比）
- `find_images(gt_min=None, gt_max=None, pred_min=None, pred_max=None, categories=None, score_min=None, score_max=None)` — 多条件筛图，返回 image_id 列表
- `hard_cases(score_low=0.3, score_high=0.6, min_pred=1)` — 返回包含“模糊区间”预测框的疑难样本 image_id
- `read_skill_file` / `load_skill_config` / `run_skill_script` / `run_skill_cli` — 通用 Skill 资源（勿写死 ~/.cursor/skills）
- `run_magic_fox_model_validation(train_id, images, output_dir, mode='full'|...)` / `run_magic_fox_fetch_training_models(url, csv_path)` — Magic-Fox 技能一键封装（需已导入对应 skills.zip）

## Cursor 兼容 Skills 协议（与 IDE 一致）
- 每个技能为目录 + `SKILL.md`；`SKILL.md` 顶部为 YAML frontmatter，**必填** `name`（小写连字符）与 `description`（含能力说明与 *Use when* 触发场景）。
- 系统注入的「按需加载 Skills」块即 Cursor 里的技能正文：须**优先遵守**，脚本路径以包内相对路径为准（如 `scripts/xxx.py`）。
- 运行环境提供 `SKILL_ROOT` / `CURSOR_SKILL_ROOT` / `MAGIC_FOX_SKILL_ROOT`（均指向本应用解压后的技能根目录），**禁止**在代码中写死 `~/.cursor/skills/...`。
- 调用技能脚本的 `skill_name` 参数使用 frontmatter 的 `name` 或界面展示的技能名即可。

## 附件变量（如用户上传了文件，这些变量自动注入）
- `uploaded_data` — 用户上传的 CSV/JSON 数据（list 或 dict）
- `uploaded_text` — 用户上传的文本内容（str）

## 联网搜索
- 当用户需要了解最新技术/方法/资讯时，系统会自动搜索并将结果加入你的上下文

## 内置常用 Agent 模板（优先复用）
- **数据集打包 Agent**：按规则筛选 `image_ids` → `filter_gallery(...)` 在线预览 → `export_coco(image_ids, zip_name='xxx.zip', with_images=True, preview=True)` 导出压缩包
- **DF 可视化 Agent**：对 DataFrame/列表统计后，调用 `show_chart(...)` 输出图表；调用 `show_table(rows, '标题')` 输出可点击表格预览
- **数据加载 Agent**：当用户给出 COCO 路径时，调用 `load_dataset_path(coco_json_path, image_dir)` 直接加载

## 回答格式
1. 先写 ```python 代码块（系统会自动执行）
2. 代码执行后，系统会把真实结果反馈给你
3. 基于真实结果给出简洁分析结论，不要重复代码内容"""


def _agent_thought_tree(user_text: str) -> dict:
    """轻量思维树：根据问答内容自动选择推荐工具"""
    t = (user_text or '').lower()
    decision = {
        'intent': 'general_analysis',
        'tools': [],
        'reason': '通用分析',
        'instruction': ''
    }

    # 规则 1：打包/导出子集
    if any(k in t for k in ['打包', '压缩包', 'zip', '导出子集', '导出数据集', '_annotations.coco.json']):
        decision.update({
            'intent': 'pack_dataset',
            'tools': ['filter_gallery', 'pack_dataset'],
            'reason': '用户意图是筛选后打包导出',
            'instruction': "必须先在线预览后导出：先 filter_gallery(image_ids, '筛选预览')，再 pack_dataset(image_ids, zip_name='filtered_dataset.zip', preview=True)。"
        })
        return decision

    # 规则 2：图表可视化
    if any(k in t for k in ['可视化', '图表', '柱状图', '折线图', '饼图', 'chart', 'plot']):
        decision.update({
            'intent': 'visualization',
            'tools': ['category_stats', 'bbox_stats', 'show_chart', 'show_table', 'visualize_df'],
            'reason': '用户需要图形化展示',
            'instruction': "请输出 show_chart(...) 图表；若有明细数据，同时输出 show_table(...)。"
        })
        return decision

    # 规则 3：DF / 表格
    if any(k in t for k in ['df', 'dataframe', '表格', '明细', 'table']):
        decision.update({
            'intent': 'table_preview',
            'tools': ['show_df', 'show_table'],
            'reason': '用户需要结构化表格查看',
            'instruction': "请将结果整理为 DataFrame 或 list[dict]，并调用 show_df(...) 展示可点击表格。"
        })
        return decision

    # 规则 4：类别/分布统计
    if any(k in t for k in ['类别分布', '类别统计', 'category', '分布']):
        decision.update({
            'intent': 'category_distribution',
            'tools': ['category_stats', 'show_df', 'show_chart'],
            'reason': '用户关注类别维度统计',
            'instruction': "调用 category_stats(source='gt') 或 category_stats(source='pred')，并结合 visualize_df/show_chart 输出图表与表格。"
        })
        return decision

    # 规则 5：框尺度/尺寸分析
    if any(k in t for k in ['面积', '尺度', '小目标', '宽高比', 'bbox', '尺寸统计']):
        decision.update({
            'intent': 'bbox_statistics',
            'tools': ['bbox_stats', 'show_df', 'show_chart'],
            'reason': '用户关注框尺度特征',
            'instruction': "调用 bbox_stats(source='gt'/'pred') 并输出图表与统计摘要。"
        })
        return decision

    # 规则 6：异常/疑难样本
    if any(k in t for k in ['疑难', 'hard case', '模糊', '低置信度', '异常样本', '错检', '漏检']):
        decision.update({
            'intent': 'hard_cases',
            'tools': ['hard_cases', 'filter_gallery', 'pack_dataset'],
            'reason': '用户关注疑难样本定位',
            'instruction': "调用 hard_cases(...) 得到 image_ids，先 filter_gallery 在线预览，必要时 pack_dataset 打包导出。"
        })
        return decision

    # 规则 7：加载数据集
    if any(k in t for k in ['加载数据集', 'coco 路径', 'json路径', '加载路径']):
        decision.update({
            'intent': 'load_dataset',
            'tools': ['load_dataset_path'],
            'reason': '用户需要通过路径加载',
            'instruction': "如果用户给出了路径，请调用 load_dataset_path(coco_json_path, image_dir)。"
        })
        return decision

    return decision


def _exec_code_internal(code: str, images_list: list, extra_vars: dict = None) -> dict:
    """内部代码执行，返回 {type, output/image_ids, error, files}"""
    import ast, io as _io, csv as _csv
    from collections import Counter, defaultdict
    import math, statistics as _stats

    output_lines = []
    created_files = []

    def _captured_print(*args, sep=' ', end='\n', **kwargs):
        output_lines.append(sep.join(str(a) for a in args))

    # ── 导出辅助函数（注入到执行环境）──────────────────────
    def _get_skill_item(skill_name: str):
        skills = _load_agent_skills_map()
        key = str(skill_name or '').strip().lower()
        for s in skills:
            if not s.get('enabled', True):
                continue
            if str(s.get('id', '')).lower() == key or str(s.get('name', '')).lower() == key:
                return s
            cn = str(s.get('cursor_name', '')).lower().strip()
            if cn and cn == key:
                return s
        return None

    def _resolve_skill_item(name_or_hint: str):
        """按 id/名称精确匹配；否则按名称/摘要模糊匹配（多条时优先 magic-fox 模型验证）。"""
        key = str(name_or_hint or '').strip().lower()
        if not key:
            return None
        hit = _get_skill_item(key)
        if hit:
            return hit
        skills = _load_agent_skills_map()
        matches = []
        for s in skills:
            if not s.get('enabled', True):
                continue
            sid = str(s.get('id', '')).lower()
            nm = str(s.get('name', '')).lower()
            summ = str(s.get('summary', '')).lower()
            cn = str(s.get('cursor_name', '')).lower().strip()
            desc = str(s.get('description', '')).lower()
            if key == sid:
                return s
            if cn and cn == key:
                return s
            if key in nm or nm in key or key in summ or (desc and key in desc):
                matches.append(s)
        if not matches:
            return None
        if len(matches) == 1:
            return matches[0]

        def _rank(s):
            sc = 0
            nm = str(s.get('name', '')).lower()
            p = f"{s.get('path', '')} {s.get('skill_dir', '')}".lower()
            if 'magic-fox' in nm or 'magic-fox' in p:
                sc += 10
            if 'model' in nm and 'validation' in nm:
                sc += 5
            return sc

        matches.sort(key=_rank, reverse=True)
        return matches[0]

    def read_skill_file(skill_name: str, rel_path: str = 'SKILL.md'):
        """读取某个 skill 包内的文件内容（标准 skills 方式常用）。"""
        s = _get_skill_item(skill_name)
        if not s:
            raise ValueError(f'未找到 skill: {skill_name}')
        base = Path(s.get('skill_dir') or Path(s.get('path', '')).parent).resolve()
        p = (base / rel_path).resolve()
        if not str(p).startswith(str(base)):
            raise ValueError('非法路径')
        if not p.exists():
            raise FileNotFoundError(f'文件不存在: {rel_path}')
        return p.read_text(encoding='utf-8', errors='replace')

    def load_skill_config(skill_name: str, rel_path: str = None):
        """加载技能包内固定配置。未传 rel_path 时使用导入时索引的默认配置文件（首个）。"""
        s = _get_skill_item(skill_name)
        if not s:
            raise ValueError(f'未找到 skill: {skill_name}')
        base = Path(s.get('skill_dir') or Path(s.get('path', '')).parent).resolve()
        target_rel = None
        if rel_path and str(rel_path).strip():
            target_rel = str(rel_path).strip().replace('\\', '/')
        elif s.get('default_config_rel'):
            target_rel = s['default_config_rel']
        else:
            cfgs = s.get('configs') or []
            if cfgs:
                target_rel = cfgs[0].get('rel_path')
        if not target_rel:
            raise ValueError(
                f'skill {skill_name} 未索引到配置文件；请在技能目录放置 config.json 等，或显式传入 rel_path')
        p = (base / target_rel).resolve()
        if not str(p).startswith(str(base)):
            raise ValueError('非法路径')
        if not p.exists():
            raise FileNotFoundError(f'配置文件不存在: {target_rel}')
        raw = p.read_text(encoding='utf-8', errors='replace')
        suf = p.suffix.lower()
        if suf == '.json' or target_rel.lower().endswith('.json'):
            return json.loads(raw)
        if suf in ('.yaml', '.yml'):
            try:
                import yaml  # type: ignore
            except ImportError:
                raise RuntimeError('解析 YAML 需要安装 PyYAML（pip install pyyaml）')
            return yaml.safe_load(raw)
        if suf == '.toml':
            try:
                import tomllib
                return tomllib.loads(raw)
            except ImportError:
                try:
                    import tomli  # type: ignore
                except ImportError:
                    raise RuntimeError('解析 .toml 需要 Python 3.11+ 或 pip install tomli')
                return tomli.loads(raw)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {'_raw': raw, '_format': 'text', 'rel_path': target_rel}

    def run_skill_script(skill_name: str, script: str = '', kwargs=None):
        """运行 skill 包内脚本；优先 main()/run()，否则仅加载模块。"""
        s = _get_skill_item(skill_name)
        if not s:
            raise ValueError(f'未找到 skill: {skill_name}')
        scripts = s.get('scripts') or []
        target = None
        if script:
            key = str(script).strip().lower()
            for sp in scripts:
                if str(sp.get('rel_path', '')).lower() == key or str(sp.get('name', '')).lower() == key:
                    target = sp
                    break
        if target is None and scripts:
            target = scripts[0]
        if target is None:
            raise ValueError(f'skill {skill_name} 未包含可运行 .py 脚本')
        p = Path(target.get('path', ''))
        if not p.exists():
            raise FileNotFoundError(f'脚本不存在: {target.get("rel_path")}')
        mod_name = f"_skill_runtime_{_uuid.uuid4().hex[:8]}"
        spec = importlib.util.spec_from_file_location(mod_name, str(p))
        if not spec or not spec.loader:
            raise RuntimeError('无法加载 skill 脚本')
        mod = importlib.util.module_from_spec(spec)
        skill_root = Path(s.get('skill_dir') or Path(s.get('path', '')).parent).resolve()
        old_cwd = Path.cwd()
        old_env = {
            'SKILL_ROOT': os.environ.get('SKILL_ROOT'),
            'MAGIC_FOX_SKILL_ROOT': os.environ.get('MAGIC_FOX_SKILL_ROOT'),
            'CURSOR_SKILL_ROOT': os.environ.get('CURSOR_SKILL_ROOT'),
        }
        os.environ['SKILL_ROOT'] = str(skill_root)
        os.environ['MAGIC_FOX_SKILL_ROOT'] = str(skill_root)
        os.environ['CURSOR_SKILL_ROOT'] = str(skill_root)
        try:
            os.chdir(str(skill_root))
            spec.loader.exec_module(mod)
            kw = kwargs if isinstance(kwargs, dict) else {}
            fn = getattr(mod, 'main', None) or getattr(mod, 'run', None)
            if callable(fn):
                try:
                    return fn(**kw)
                except TypeError:
                    return fn(kw)
            return {'module_loaded': str(target.get('rel_path') or target.get('name'))}
        finally:
            os.chdir(str(old_cwd))
            for k, v in old_env.items():
                if v is None:
                    os.environ.pop(k, None)
                else:
                    os.environ[k] = v

    def _run_skill_cli_for_skill_dict(s: dict, script: str = '', args=None, timeout_sec: int = 1800):
        """对已解析的 skill 条目执行子进程 CLI（cwd=skill_root）。"""
        if not s:
            raise ValueError('skill 元数据为空')
        scripts = s.get('scripts') or []
        target = None
        if script:
            key = str(script).strip().lower()
            for sp in scripts:
                if str(sp.get('rel_path', '')).lower() == key or str(sp.get('name', '')).lower() == key:
                    target = sp
                    break
        if target is None and scripts:
            target = scripts[0]
        if target is None:
            raise ValueError(f'skill {s.get("name")} 未包含可运行 .py 脚本')
        p = Path(target.get('path', '')).resolve()
        if not p.exists():
            raise FileNotFoundError(f'脚本不存在: {target.get("rel_path")}')
        skill_root = Path(s.get('skill_dir') or Path(s.get('path', '')).parent).resolve()
        argv = [sys.executable, str(p)]
        if isinstance(args, (list, tuple)):
            argv.extend([str(x) for x in args])
        env = os.environ.copy()
        env['SKILL_ROOT'] = str(skill_root)
        env['MAGIC_FOX_SKILL_ROOT'] = str(skill_root)
        env['CURSOR_SKILL_ROOT'] = str(skill_root)
        proc = subprocess.run(
            argv,
            cwd=str(skill_root),
            env=env,
            capture_output=True,
            text=True,
            timeout=max(1, int(timeout_sec)),
        )
        return {
            'ok': proc.returncode == 0,
            'returncode': proc.returncode,
            'stdout': proc.stdout,
            'stderr': proc.stderr,
            'script': str(target.get('rel_path') or target.get('name')),
            'skill_root': str(skill_root),
            'cmd': argv,
        }

    def run_skill_cli(skill_name: str, script: str = '', args=None, timeout_sec: int = 1800):
        """以 CLI 方式运行 skill 脚本（cwd=skill_root，自动注入 SKILL_ROOT 环境变量）。"""
        s = _get_skill_item(skill_name)
        if not s:
            raise ValueError(f'未找到 skill: {skill_name}')
        return _run_skill_cli_for_skill_dict(s, script, args, timeout_sec)

    def run_magic_fox_model_validation(
            train_id: int,
            images,
            output_dir: str,
            *,
            mode: str = 'full',
            threshold: float = 0.1,
            coco_json_name: str = None,
            coco_copy_images: bool = False,
            json_output: str = None,
            batch_size: int = None,
            batch_retries: int = None,
            resume: bool = True,
            poll_interval: float = None,
            max_wait: float = None,
            use_proxy: bool = False,
            skill_hint: str = 'magic-fox-model-validation',
            script: str = 'scripts/model_validation.py',
            timeout_sec: int = 7200,
    ):
        """
        Magic-Fox 批量预测封装：无需手写 CLI 参数与 ~/.cursor/skills 路径。
        mode: 'full'（默认，--output-dir）、'coco_json_only'、'json_only'
        images: 单路径 str、目录 str，或图片/目录路径列表
        """
        s = _resolve_skill_item(skill_hint)
        if not s:
            raise ValueError(
                f'未找到 Magic-Fox 验证 skill（hint={skill_hint!r}）。'
                '请先在界面导入含 magic-fox-model-validation 的 skills.zip')
        out_path = Path(str(output_dir)).expanduser().resolve()
        out_path.mkdir(parents=True, exist_ok=True)
        outs = str(out_path)

        def _to_paths(x):
            if x is None:
                return []
            if isinstance(x, str):
                return [str(Path(x).expanduser().resolve())]
            return [str(Path(str(p)).expanduser().resolve()) for p in x]

        paths = _to_paths(images)
        if not paths:
            raise ValueError('images 不能为空')
        cmd = ['--train-id', str(int(train_id)), '--threshold', str(float(threshold))]
        m = (mode or 'full').strip().lower()
        if m == 'full':
            cmd.extend(['--output-dir', outs])
        elif m == 'coco_json_only':
            cname = coco_json_name or '_annotations.coco.json'
            cmd.extend(['--coco-json-only', '--coco-dir', outs, '--coco-json-name', cname])
            if coco_copy_images:
                cmd.append('--coco-copy-images')
        elif m == 'json_only':
            jo = json_output or str(out_path / 'validation_api.json')
            cmd.extend(['--json-only', '--output', jo])
        else:
            raise ValueError("mode 必须是 'full'、'coco_json_only' 或 'json_only'")
        if batch_size is not None:
            cmd.extend(['--batch-size', str(int(batch_size))])
        if batch_retries is not None:
            cmd.extend(['--batch-retries', str(int(batch_retries))])
        if not resume:
            cmd.append('--no-resume')
        if poll_interval is not None:
            cmd.extend(['--poll-interval', str(float(poll_interval))])
        if max_wait is not None:
            cmd.extend(['--max-wait', str(float(max_wait))])
        if use_proxy:
            cmd.append('--use-proxy')
        cmd.extend(paths)
        return _run_skill_cli_for_skill_dict(s, script, cmd, timeout_sec)

    def run_magic_fox_fetch_training_models(
            training_url: str,
            csv_path: str,
            *,
            headless: bool = True,
            skill_hint: str = 'magic-fox-model-validation',
            script: str = 'scripts/fetch_training_models.py',
            timeout_sec: int = 1800,
    ):
        """
        抓取训练列表 CSV（Playwright）。csv_path 为输出 CSV 完整路径。
        """
        s = _resolve_skill_item(skill_hint)
        if not s:
            raise ValueError(
                f'未找到 Magic-Fox skill（hint={skill_hint!r}）。请先导入对应 skills.zip')
        cp = Path(str(csv_path)).expanduser().resolve()
        cp.parent.mkdir(parents=True, exist_ok=True)
        cmd = ['--url', str(training_url), '--csv', str(cp)]
        if not headless:
            cmd.append('--no-headless')
        return _run_skill_cli_for_skill_dict(s, script, cmd, timeout_sec)

    def _json_safe(obj):
        """递归将 Python 特殊类型转为 JSON 可序列化格式"""
        from collections import Counter as _C
        if isinstance(obj, dict):
            return {str(k): _json_safe(v) for k, v in obj.items()}
        if isinstance(obj, (list, tuple)):
            return [_json_safe(x) for x in obj]
        if isinstance(obj, _C):
            return {str(k): int(v) for k, v in obj.items()}
        if isinstance(obj, set):
            return sorted([_json_safe(x) for x in obj], key=str)
        try:
            # numpy / pandas 数值类型
            return obj.item()
        except AttributeError:
            pass
        if isinstance(obj, (int, float, bool, str)) or obj is None:
            return obj
        return str(obj)

    def export_csv(data, filename='export.csv'):
        """导出列表数据为 CSV 文件（UTF-8 BOM，兼容 Excel/WPS）"""
        # 支持 Counter / dict → 转为 list of dicts
        from collections import Counter as _C
        if isinstance(data, (_C, dict)):
            data = [{'key': k, 'value': v} for k, v in data.items()]
        elif not isinstance(data, (list, tuple)):
            data = list(data)

        buf = _io.StringIO()
        if data and isinstance(data[0], dict):
            keys = list(data[0].keys())
            w = _csv.DictWriter(buf, fieldnames=keys, extrasaction='ignore',
                                lineterminator='\r\n')
            w.writeheader()
            w.writerows([{k: str(row.get(k, '')) for k in keys} for row in data])
        elif data:
            rows = [list(r) if isinstance(r, (list, tuple)) else [r] for r in data]
            _csv.writer(buf, lineterminator='\r\n').writerows(
                [[str(c) for c in row] for row in rows])

        # UTF-8 BOM 前缀，让 Excel/WPS 正确识别中文
        content = '\ufeff' + buf.getvalue()
        fid = _save_temp_file(content, filename)
        created_files.append({'file_id': fid, 'filename': filename})
        _captured_print(f'[已导出] {filename}（{len(data)} 行）')
        return fid

    def export_json(data, filename='export.json'):
        """导出 Python 对象为 JSON 文件（自动处理 Counter/numpy/set 等）"""
        safe_data = _json_safe(data)
        content = json.dumps(safe_data, ensure_ascii=False, indent=2)
        fid = _save_temp_file(content, filename)
        created_files.append({'file_id': fid, 'filename': filename})
        _captured_print(f'[已导出] {filename}')
        return fid

    def export_txt(text, filename='report.txt'):
        """导出文本为 TXT 文件"""
        fid = _save_temp_file(str(text), filename)
        created_files.append({'file_id': fid, 'filename': filename})
        _captured_print(f'[已导出] {filename}')
        return fid

    # ── export_coco：按 image_id 列表导出 COCO 子集 + 可选 ZIP ──────────────
    _ev = extra_vars or {}

    def export_coco(image_ids, zip_name='filtered_dataset.zip', with_images=True, preview=True, filename_prefix=None):
        """导出筛选后的 COCO 数据集子集。

        参数：
          image_ids       — 要保留的图片 ID 列表（int 或 str 均可）
          zip_name        — 导出的压缩包文件名，默认 'filtered_dataset.zip'
          with_images     — True 时同时打包原始图片
          preview         — True 时自动调用 filter_gallery 提供在线预览
          filename_prefix — 兼容旧参数；若提供则压缩包名为 {filename_prefix}.zip
        返回：
          dict，包含 coco_fid（JSON 文件 ID）和可选 zip_fid
        """
        import json as _j, zipfile as _zf, io as _zio, builtins as _b
        cjp = _ev.get('coco_json_path', '')
        if not cjp or not Path(cjp).exists():
            _captured_print('[错误] 当前未加载数据集，无法导出 COCO')
            return None
        try:
            orig = _j.loads(Path(cjp).read_text(encoding='utf-8'))
        except Exception as e:
            _captured_print(f'[错误] 读取 COCO JSON 失败：{e}')
            return None

        id_set = set(int(iid) for iid in image_ids)
        filtered_imgs = [img for img in orig.get('images', []) if img.get('id') in id_set]
        filtered_anns = [ann for ann in orig.get('annotations', []) if ann.get('image_id') in id_set]
        coco_out = {
            'info': orig.get('info', {}),
            'licenses': orig.get('licenses', []),
            'categories': orig.get('categories', []),
            'images': filtered_imgs,
            'annotations': filtered_anns,
        }
        coco_str = _j.dumps(coco_out, ensure_ascii=False, indent=2)
        ann_name = '_annotations.coco.json'
        ann_fid = _save_temp_file(coco_str, ann_name)
        created_files.append({'file_id': ann_fid, 'filename': ann_name})
        _captured_print(f'[已导出] {ann_name}（{len(filtered_imgs)} 张图片，{len(filtered_anns)} 个标注）')
        result = {'coco_fid': ann_fid}

        if preview:
            # 先给前端在线预览入口（用户可在图库直接查看筛选结果）
            filter_gallery(sorted(list(id_set)), f'导出子集预览（{len(filtered_imgs)} 张）')

        if with_images:
            img_dir_val = _ev.get('images_dir', '')
            if filename_prefix:
                zip_name = f'{filename_prefix}.zip'
            if not str(zip_name).lower().endswith('.zip'):
                zip_name = f'{zip_name}.zip'
            zip_buf = _zio.BytesIO()
            packed = 0
            with _zf.ZipFile(zip_buf, 'w', _zf.ZIP_DEFLATED) as zf:
                zf.writestr(ann_name, coco_str)
                for img_info in filtered_imgs:
                    fname = img_info.get('file_name', '')
                    if not fname:
                        continue
                    src = Path(img_dir_val) / fname if img_dir_val else Path(fname)
                    if src.exists():
                        zf.write(str(src), fname)
                        packed += 1
            zip_bytes = zip_buf.getvalue()
            zip_fid = _save_temp_file(zip_bytes, zip_name)
            created_files.append({'file_id': zip_fid, 'filename': zip_name})
            _captured_print(f'[已导出] {zip_name}（包含 {packed}/{len(filtered_imgs)} 张图片）')
            result['zip_fid'] = zip_fid

        return result

    # ── 拦截 open() 写文件，自动重定向到临时目录 ─────────────────────────────
    import builtins as _builtins_mod

    def _patched_open(file, mode='r', *args, **kwargs):
        """重定向所有写模式 open() 到临时目录，读操作不受影响"""
        _real_open = _builtins_mod.open
        is_write = isinstance(mode, str) and ('w' in mode or 'a' in mode or 'x' in mode)
        if is_write and isinstance(file, (str, Path)):
            safe_name = Path(str(file)).name or 'output'
            fid = _uuid.uuid4().hex[:10]
            temp_path = _TEMP_DIR / f'{fid}_{safe_name}'
            _TEMP_DIR.mkdir(exist_ok=True)

            # 二进制模式用 BytesIO 代理
            if 'b' in mode:
                class _BinaryProxy:
                    def __init__(self):
                        self._buf = _io.BytesIO()
                        self._fid = fid
                        self._name = safe_name
                    def write(self, b): return self._buf.write(b)
                    def writelines(self, ls):
                        for l in ls: self._buf.write(l)
                    def flush(self): pass
                    def close(self):
                        data = self._buf.getvalue()
                        temp_path.write_bytes(data)
                        _temp_files[self._fid] = {'path': temp_path, 'filename': self._name, 'created': _time.time()}
                        created_files.append({'file_id': self._fid, 'filename': self._name})
                        _captured_print(f'[已写出] {self._name}')
                    def __enter__(self): return self
                    def __exit__(self, *a):
                        if not self._buf.closed: self.close()
                    def __getattr__(self, n): return getattr(self._buf, n)
                return _BinaryProxy()
            else:
                class _TextProxy:
                    def __init__(self):
                        self._buf = _io.StringIO()
                        self._fid = fid
                        self._name = safe_name
                    def write(self, s): return self._buf.write(s)
                    def writelines(self, ls):
                        for l in ls: self._buf.write(l)
                    def flush(self): pass
                    def close(self):
                        content = self._buf.getvalue()
                        fpath = _TEMP_DIR / f'{self._fid}_{self._name}'
                        enc = kwargs.get('encoding', 'utf-8') or 'utf-8'
                        fpath.write_text(content, encoding=enc, errors='replace')
                        _temp_files[self._fid] = {'path': fpath, 'filename': self._name, 'created': _time.time()}
                        created_files.append({'file_id': self._fid, 'filename': self._name})
                        _captured_print(f'[已写出] {self._name}')
                    def __enter__(self): return self
                    def __exit__(self, *a):
                        if not self._buf.closed: self.close()
                    def __getattr__(self, n): return getattr(self._buf, n)
                return _TextProxy()
        return _real_open(file, mode, *args, **kwargs)

    # ── UI Action 函数（控制前端界面）──────────────────────────────────────────
    _ui_actions: list = []

    def navigate_to(page: str):
        """导航到指定页面: 'gallery'|'viewer'|'eda'|'chat'|'load'"""
        _ui_actions.append({'type': 'navigate', 'page': str(page)})
        _captured_print(f'[导航] → {page}')

    def filter_gallery(image_ids, description: str = 'Agent 筛选结果'):
        """将指定 image_id 列表推送到看图界面并自动切换过去"""
        ids = [int(i) for i in image_ids]
        _ui_actions.append({'type': 'filter_gallery', 'image_ids': ids, 'description': str(description)})
        _ui_actions.append({'type': 'navigate', 'page': 'gallery'})
        _captured_print(f'[筛选] {len(ids)} 张图片 → 看图界面')

    def show_chart(chart_type: str, labels: list, datasets: list, title: str = ''):
        """在聊天中显示 Chart.js 图表。
        chart_type: 'bar'|'pie'|'line'|'doughnut'|'radar'
        labels: list[str]
        datasets: list[dict] 每项包含 label(str), data(list[number]), backgroundColor(str, 可选)
        title: 图表标题
        示例：
          show_chart('bar', ['猫','狗'], [{'label':'数量','data':[30,20],'backgroundColor':'#4e79a7'}], '类别分布')
          show_chart('pie', ['A','B','C'], [{'label':'占比','data':[10,30,60]}], '饼图')
        """
        _ui_actions.append({'type': 'show_chart', 'chart': {
            'chart_type': str(chart_type),
            'labels': list(labels),
            'datasets': list(datasets),
            'title': str(title),
        }})
        _captured_print(f'[图表] {title or chart_type} 已生成')

    def show_table(rows, title: str = '数据预览'):
        """在聊天中显示可点击表格预览（支持弹窗查看明细）"""
        # DataFrame 兼容
        try:
            if hasattr(rows, 'to_dict'):
                rows = rows.to_dict('records')
        except Exception:
            pass
        if isinstance(rows, dict):
            rows = [rows]
        if not isinstance(rows, list):
            rows = [rows]
        # 截断避免前端过大
        safe_rows = rows[:300]
        _ui_actions.append({'type': 'show_table', 'table': {
            'title': str(title),
            'rows': safe_rows,
            'total_rows': len(rows),
        }})
        _captured_print(f'[表格] {title}（展示 {len(safe_rows)}/{len(rows)} 行）')

    def show_df(df, title: str = 'DF预览', max_rows: int = 300):
        """DataFrame / list[dict] 快速表格预览"""
        rows = df
        try:
            if hasattr(df, 'head') and hasattr(df, 'to_dict'):
                rows = df.head(int(max_rows)).to_dict('records')
        except Exception:
            pass
        show_table(rows, title=title)

    def visualize_df(df, x, y, chart_type: str = 'bar', title: str = 'DF可视化', topk: int = 30):
        """DataFrame 快速可视化：自动 show_chart + show_table"""
        rows = df
        try:
            if hasattr(df, 'to_dict'):
                rows = df.to_dict('records')
        except Exception:
            pass
        if not isinstance(rows, list):
            rows = []
        rows = rows[:int(topk)]
        labels = [str(r.get(x, '')) for r in rows]
        vals = []
        for r in rows:
            try:
                vals.append(float(r.get(y, 0)))
            except Exception:
                vals.append(0.0)
        show_chart(chart_type, labels, [{'label': str(y), 'data': vals}], title=title)
        show_table(rows, title=f'{title}-明细')

    def pack_dataset(image_ids, zip_name: str = 'filtered_dataset.zip', preview: bool = True):
        """一键打包筛选子集（固定 _annotations.coco.json）"""
        return export_coco(image_ids, zip_name=zip_name, with_images=True, preview=preview)

    def coco_overview():
        """数据集总览"""
        total_images = len(images_list)
        total_gt = sum(len(img.get('annotations') or []) for img in images_list)
        cats = set()
        for img in images_list:
            for a in img.get('annotations') or []:
                if a.get('category'):
                    cats.add(a['category'])
        return {
            'images': total_images,
            'annotations': total_gt,
            'categories': len(cats),
            'avg_boxes_per_image': round(total_gt / total_images, 4) if total_images else 0,
        }

    def category_stats(source: str = 'gt'):
        """类别统计：source=gt|pred"""
        from collections import Counter as _Ctr
        c = _Ctr()
        key = 'annotations' if str(source).lower() != 'pred' else 'pred_annotations'
        for img in images_list:
            for a in img.get(key) or []:
                cat = a.get('category')
                if cat:
                    c[cat] += 1
        rows = [{'category': k, 'count': int(v)} for k, v in c.most_common()]
        return rows

    def bbox_stats(source: str = 'gt'):
        """框尺度统计"""
        key = 'annotations' if str(source).lower() != 'pred' else 'pred_annotations'
        areas = []
        ratios = []
        for img in images_list:
            for a in img.get(key) or []:
                b = a.get('bbox') or []
                if len(b) < 4:
                    continue
                w = float(b[2] or 0)
                h = float(b[3] or 0)
                if w <= 0 or h <= 0:
                    continue
                areas.append(w * h)
                ratios.append(max(w / h, h / w))
        if not areas:
            return {'count': 0}
        small_thr = 32 * 32
        tiny_cnt = sum(1 for x in areas if x < small_thr)
        areas_sorted = sorted(areas)
        return {
            'count': len(areas),
            'area_min': float(areas_sorted[0]),
            'area_p50': float(areas_sorted[len(areas_sorted)//2]),
            'area_p90': float(areas_sorted[int(len(areas_sorted)*0.9)-1 if len(areas_sorted) > 1 else 0]),
            'area_max': float(areas_sorted[-1]),
            'tiny_ratio': round(tiny_cnt / len(areas), 4),
            'avg_aspect_ratio': round(sum(ratios) / len(ratios), 4),
        }

    def find_images(gt_min=None, gt_max=None, pred_min=None, pred_max=None, categories=None, score_min=None, score_max=None):
        """多条件筛图，返回 image_id 列表"""
        cats = set(categories or [])
        out = []
        for img in images_list:
            gts = img.get('annotations') or []
            preds = img.get('pred_annotations') or []
            if gt_min is not None and len(gts) < int(gt_min):
                continue
            if gt_max is not None and len(gts) > int(gt_max):
                continue
            if pred_min is not None and len(preds) < int(pred_min):
                continue
            if pred_max is not None and len(preds) > int(pred_max):
                continue
            if cats:
                this_cats = {a.get('category') for a in gts if a.get('category')} | {a.get('category') for a in preds if a.get('category')}
                if not (this_cats & cats):
                    continue
            if score_min is not None or score_max is not None:
                smin = float(score_min) if score_min is not None else float('-inf')
                smax = float(score_max) if score_max is not None else float('inf')
                has = False
                for a in gts + preds:
                    s = a.get('score')
                    if s is None:
                        continue
                    try:
                        sv = float(s)
                    except Exception:
                        continue
                    if smin <= sv <= smax:
                        has = True
                        break
                if not has:
                    continue
            out.append(img.get('image_id'))
        return out

    def hard_cases(score_low: float = 0.3, score_high: float = 0.6, min_pred: int = 1):
        """疑难样本：包含模糊置信度区间预测框"""
        out = []
        lo = float(score_low)
        hi = float(score_high)
        for img in images_list:
            preds = img.get('pred_annotations') or []
            if len(preds) < int(min_pred):
                continue
            cnt = 0
            for a in preds:
                s = a.get('score')
                if s is None:
                    continue
                try:
                    sv = float(s)
                except Exception:
                    continue
                if lo <= sv <= hi:
                    cnt += 1
            if cnt > 0:
                out.append(img.get('image_id'))
        return out

    def load_dataset_path(coco_json_path: str, image_dir: str = '', dataset_name: str = ''):
        """加载指定路径的 COCO 数据集（会触发前端重新加载数据）"""
        _ui_actions.append({'type': 'load_dataset',
                            'coco_json_path': str(coco_json_path),
                            'image_dir': str(image_dir),
                            'dataset_name': str(dataset_name)})
        _captured_print(f'[加载数据集] {coco_json_path}')

    custom_tool_funcs = {name: info['func'] for name, info in _custom_agent_tools.items() if callable(info.get('func'))}

    exec_globals = {
        '__builtins__': __builtins__,
        'images': images_list,
        'Counter': Counter,
        'defaultdict': defaultdict,
        'math': math,
        'statistics': _stats,
        'print': _captured_print,
        'open': _patched_open,
        'export_csv': export_csv,
        'export_json': export_json,
        'export_txt': export_txt,
        'export_coco': export_coco,
        'navigate_to': navigate_to,
        'filter_gallery': filter_gallery,
        'show_chart': show_chart,
        'show_table': show_table,
        'show_df': show_df,
        'visualize_df': visualize_df,
        'pack_dataset': pack_dataset,
        'coco_overview': coco_overview,
        'category_stats': category_stats,
        'bbox_stats': bbox_stats,
        'find_images': find_images,
        'hard_cases': hard_cases,
        'load_dataset_path': load_dataset_path,
        'read_skill_file': read_skill_file,
        'load_skill_config': load_skill_config,
        'run_skill_script': run_skill_script,
        'run_skill_cli': run_skill_cli,
        'run_magic_fox_model_validation': run_magic_fox_model_validation,
        'run_magic_fox_fetch_training_models': run_magic_fox_fetch_training_models,
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
            return {'type': 'filter', 'image_ids': image_ids,
                    'output': printed or f'筛选到 {len(image_ids)} 张图片',
                    'files': created_files, 'ui_actions': _ui_actions}
        else:
            parts = []
            if printed:
                parts.append(printed)
            if final_value is not None:
                parts.append(str(final_value))
            return {'type': 'report', 'output': '\n'.join(parts) or '代码执行完成（无输出）',
                    'files': created_files, 'ui_actions': _ui_actions}
    except SyntaxError as e:
        return {'type': 'error', 'output': f'语法错误：第 {e.lineno} 行 — {e.msg}',
                'files': created_files, 'ui_actions': _ui_actions}
    except Exception as e:
        import traceback
        return {'type': 'error', 'output': traceback.format_exc(),
                'files': created_files, 'ui_actions': _ui_actions}


@app.route('/api/agent_modules', methods=['GET'])
def list_agent_modules():
    items = _load_agent_modules_map()
    out = []
    for it in items:
        mid = str(it.get('id', ''))
        tools = [k for k, v in _custom_agent_tools.items() if v.get('module_id') == mid]
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


@app.route('/api/agent_skills', methods=['GET'])
def list_agent_skills():
    skills = _load_agent_skills_map()
    skills.sort(key=lambda x: int(x.get('load_count', 0)), reverse=True)
    return jsonify({'success': True, 'skills': skills})


@app.route('/api/agent_modules/upload', methods=['POST'])
def upload_agent_module():
    if 'file' not in request.files:
        return jsonify({'error': '未找到文件'}), 400
    f = request.files['file']
    filename = Path(f.filename or '').name
    if not filename.lower().endswith('.py'):
        return jsonify({'error': '仅支持 .py 脚本'}), 400

    AGENT_MODULES_DIR.mkdir(parents=True, exist_ok=True)
    module_id = f"mod_{int(__import__('time').time() * 1000)}"
    save_name = f'{module_id}_{filename}'
    save_path = AGENT_MODULES_DIR / save_name
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
    items = _load_agent_modules_map()
    items.insert(0, meta)

    if enabled:
        try:
            _load_agent_module(meta)
        except Exception as e:
            err = str(e)
            # 无 register() 时进入“待用户确认函数注册”模式
            if 'register(registry)' in err:
                try:
                    candidates = _extract_candidate_functions(save_path)
                except Exception as pe:
                    candidates = []
                    err = f'{err}；解析函数失败：{pe}'
                meta['enabled'] = False
                meta['pending_registration'] = True
                meta['register_candidates'] = candidates
                meta['error'] = '' if candidates else err
            else:
                meta['error'] = err
                meta['enabled'] = False

    _save_agent_modules_map(items)
    return jsonify({'success': True, 'module': meta, 'need_registration': bool(meta.get('pending_registration'))})


@app.route('/api/agent_modules/<module_id>/register_functions', methods=['POST'])
def register_agent_module_functions(module_id):
    data = request.get_json() or {}
    fn_names = data.get('functions', [])
    if not isinstance(fn_names, list) or not fn_names:
        return jsonify({'error': '请至少选择一个函数'}), 400
    fn_names = [str(x).strip() for x in fn_names if str(x).strip()]
    if not fn_names:
        return jsonify({'error': '无有效函数名'}), 400

    items = _load_agent_modules_map()
    found = None
    for it in items:
        if str(it.get('id')) == module_id:
            found = it
            break
    if not found:
        return jsonify({'error': '模块不存在'}), 404

    try:
        _register_module_functions(found, fn_names)
        found['enabled'] = True
        found['pending_registration'] = False
        found['register_candidates'] = []
        found['error'] = ''
    except Exception as e:
        found['enabled'] = False
        found['error'] = str(e)
        _save_agent_modules_map(items)
        return jsonify({'error': str(e)}), 400

    _save_agent_modules_map(items)
    return jsonify({'success': True, 'module': found})


@app.route('/api/agent_modules/import_skill_zip', methods=['POST'])
def import_skill_zip():
    if 'file' not in request.files:
        return jsonify({'error': '未找到文件'}), 400
    f = request.files['file']
    filename = Path(f.filename or '').name
    if not filename.lower().endswith('.zip'):
        return jsonify({'error': '仅支持 .zip'}), 400

    AGENT_MODULES_DIR.mkdir(parents=True, exist_ok=True)
    sid = f"skill_{int(time.time() * 1000)}"
    root_dir = AGENT_MODULES_DIR / sid
    root_dir.mkdir(parents=True, exist_ok=True)
    zip_path = root_dir / filename
    f.save(str(zip_path))

    try:
        with zipfile.ZipFile(zip_path, 'r') as zf:
            zf.extractall(str(root_dir))
    except Exception as e:
        return jsonify({'error': f'解压失败：{e}'}), 400

    py_files = [p for p in root_dir.rglob('*.py') if p.is_file()]
    skill_md_files = [p for p in root_dir.rglob('SKILL.md') if p.is_file()]
    skill_items = _load_agent_skills_map()
    skill_reports = []

    # 标准 skills：索引 SKILL.md（供对话按需加载）
    for md in skill_md_files:
        try:
            text = md.read_text(encoding='utf-8', errors='replace')
            parsed = _parse_skill_md_frontmatter(text)
            body_for_title = (parsed.get('body') or text).strip() or text
            title, body_summary = _summarize_skill_markdown(body_for_title)
            validation = _validate_skill_markdown_parsed(parsed, text, str(md))
            cursor_name = (parsed.get('name') or '').strip()
            description = (parsed.get('description') or '').strip()
            display_name = cursor_name or title or md.parent.name
            summary = description[:800] if description else body_summary
            keywords = _extract_skill_keywords(display_name, summary, text)
            sid = f"skilldef_{int(time.time() * 1000)}_{len(skill_reports)}"
            skill_dir = md.parent
            scripts = []
            for sp in sorted(skill_dir.rglob('*.py')):
                if not sp.is_file():
                    continue
                rel = str(sp.relative_to(skill_dir))
                scripts.append({
                    'name': sp.name,
                    'rel_path': rel,
                    'path': str(sp),
                })
            configs = _index_skill_config_files(skill_dir)
            default_cfg = configs[0]['rel_path'] if configs else ''
            item = {
                'id': sid,
                'cursor_name': cursor_name,
                'description': description,
                'name': display_name,
                'summary': summary,
                'content': text[:12000],
                'path': str(md),
                'skill_dir': str(skill_dir),
                'enabled': True,
                'source_zip': filename,
                'keywords': keywords,
                'scripts': scripts,
                'configs': configs,
                'default_config_rel': default_cfg,
                'load_count': 0,
                'last_matched_at': '',
                'valid': validation.get('valid', False),
                'warnings': validation.get('warnings', []),
            }
            skill_items.insert(0, item)
            skill_reports.append({
                'name': item['name'],
                'cursor_name': item.get('cursor_name', ''),
                'path': item['path'],
                'valid': item['valid'],
                'warnings': item['warnings'],
                'description': (description[:200] + '…') if len(description) > 200 else description,
                'keywords': item['keywords'][:10],
                'scripts': [s.get('rel_path') for s in scripts[:8]],
                'configs': [c.get('rel_path') for c in configs[:8]],
            })
        except Exception:
            continue

    # 标准 skills 使用方式：skills.zip 仅导入 SKILL.md，不执行/注册 python 函数
    _save_agent_skills_map(skill_items)
    if not skill_md_files:
        return jsonify({'error': 'zip 中未找到 SKILL.md（标准 skills 包应包含该文件）'}), 400
    return jsonify({
        'success': True,
        'modules': [],
        'count': 0,
        'skills_count': len(skill_md_files),
        'skill_reports': skill_reports,
        'ignored_py_count': len(py_files),
    })


@app.route('/api/agent_modules/<module_id>/toggle', methods=['POST'])
def toggle_agent_module(module_id):
    data = request.get_json() or {}
    enabled = bool(data.get('enabled', True))
    items = _load_agent_modules_map()
    found = None
    for it in items:
        if str(it.get('id')) == module_id:
            it['enabled'] = enabled
            it['error'] = ''
            found = it
            break
    if not found:
        return jsonify({'error': '模块不存在'}), 404

    if enabled:
        try:
            _load_agent_module(found)
        except Exception as e:
            found['enabled'] = False
            found['error'] = str(e)
    else:
        _remove_tools_by_module(module_id)

    _save_agent_modules_map(items)
    return jsonify({'success': True, 'module': found})


@app.route('/api/agent_modules/<module_id>', methods=['DELETE'])
def delete_agent_module(module_id):
    items = _load_agent_modules_map()
    kept = []
    target = None
    for it in items:
        if str(it.get('id')) == module_id:
            target = it
        else:
            kept.append(it)
    if not target:
        return jsonify({'error': '模块不存在'}), 404

    _remove_tools_by_module(module_id)
    _custom_agent_modules.pop(module_id, None)
    p = Path(target.get('path', ''))
    try:
        if p.exists():
            p.unlink()
    except Exception:
        pass
    _save_agent_modules_map(kept)
    return jsonify({'success': True})


@app.route('/api/chat', methods=['POST'])
def chat_proxy():
    """Agent 模式：LLM 写代码 → 自动执行 → 喂回真实结果 → 流式输出最终结论"""
    from flask import Response, stream_with_context
    import urllib.request, urllib.error, re

    data = request.get_json() or {}
    messages = data.get('messages', [])
    api_url = data.get('api_url', 'https://api.openai.com/v1/chat/completions').rstrip('/')
    api_key = data.get('api_key', '')
    model = data.get('model', 'gpt-4o-mini')
    max_tokens = int(data.get('max_tokens') or 2000)
    dataset_id = data.get('dataset_id')
    custom_system_prompt = data.get('custom_system_prompt', '').strip()
    _forced_raw = data.get('forced_skill_ids') or data.get('pinned_skill_ids') or []
    forced_skill_ids = [str(x).strip() for x in _forced_raw if str(x).strip()]
    user_text = messages[-1].get('content', '') if messages else ''
    tool_decision = _agent_thought_tree(user_text)

    def sse(obj):
        return f'data: {json.dumps(obj, ensure_ascii=False)}\n\n'

    def call_llm_sync(msgs, stream=False):
        """同步调用 LLM，返回完整文本（用于第一阶段）"""
        payload = json.dumps({
            'model': model, 'messages': msgs,
            'max_tokens': max_tokens, 'stream': stream,
        }).encode('utf-8')
        hdrs = {'Content-Type': 'application/json', 'Authorization': f'Bearer {api_key}'}
        req = urllib.request.Request(api_url, data=payload, headers=hdrs, method='POST')
        with urllib.request.urlopen(req, timeout=90) as resp:
            if not stream:
                body = json.loads(resp.read())
                return body['choices'][0]['message']['content']
            # streaming
            buf = ''
            for raw in resp:
                line = raw.decode('utf-8', errors='replace').strip()
                if line.startswith('data: '):
                    line = line[6:]
                if line in ('[DONE]', ''):
                    continue
                try:
                    chunk = json.loads(line)
                    buf += chunk.get('choices', [{}])[0].get('delta', {}).get('content', '')
                except Exception:
                    pass
            return buf

    def stream_llm(msgs):
        """流式调用 LLM，yield content chunks"""
        payload = json.dumps({
            'model': model, 'messages': msgs,
            'max_tokens': max_tokens, 'stream': True,
        }).encode('utf-8')
        hdrs = {'Content-Type': 'application/json', 'Authorization': f'Bearer {api_key}'}
        req = urllib.request.Request(api_url, data=payload, headers=hdrs, method='POST')
        with urllib.request.urlopen(req, timeout=90) as resp:
            for raw in resp:
                line = raw.decode('utf-8', errors='replace').strip()
                if line.startswith('data: '):
                    line = line[6:]
                if line == '[DONE]':
                    return
                try:
                    chunk = json.loads(line)
                    c = chunk.get('choices', [{}])[0].get('delta', {}).get('content', '')
                    if c:
                        yield c
                except Exception:
                    pass

    def extract_py_blocks(text):
        return re.findall(r'```(?:python|py)\n(.*?)```', text, re.DOTALL)

    # 附件（前端传来的已上传文件信息）
    attachments = data.get('attachments', [])   # [{type, name, content/data/rows, ...}]

    def generate():
        def llm_select_skills(candidates, max_pick: int = 3):
            """用 LLM 从候选 skills 中选择最相关项（标准 skills 调用逻辑）。"""
            if not candidates:
                return []
            if len(candidates) <= 1:
                return candidates
            catalog = []
            for s in candidates:
                catalog.append({
                    'id': s.get('id', ''),
                    'name': s.get('name', ''),
                    'cursor_name': s.get('cursor_name', ''),
                    'description': (s.get('description') or '')[:640],
                    'summary': s.get('summary', ''),
                    'keywords': s.get('keywords', []),
                })
            prompt = (
                "从下面 skills 候选中，选择最适合当前用户问题的技能。\n"
                f"最多选择 {max_pick} 个；若都不相关返回空数组。\n"
                "只返回 JSON：{\"selected_ids\": [\"id1\", \"id2\"]}\n\n"
                f"用户问题：{user_text}\n\n"
                f"skills候选：{json.dumps(catalog, ensure_ascii=False)}"
            )
            msgs = [
                {'role': 'system', 'content': '你是 skills 路由器。只输出 JSON，不要任何解释。'},
                {'role': 'user', 'content': prompt},
            ]
            try:
                raw = call_llm_sync(msgs, stream=False).strip()
                m = re.search(r'\{.*\}', raw, re.DOTALL)
                obj = json.loads(m.group(0) if m else raw)
                selected_ids = obj.get('selected_ids', [])
                selected_set = set(str(x) for x in selected_ids)
                out = [s for s in candidates if str(s.get('id')) in selected_set]
                return out[:max_pick]
            except Exception:
                # 回退：用预排序候选
                return candidates[:max_pick]

        # ── 构建上下文 ────────────────────────────────────────
        ctx = _build_agent_context(dataset_id)
        images_list = _build_images_list(dataset_id) if dataset_id else []
        # 路径信息注入代码执行环境
        eda = current_datasets.get(dataset_id) if dataset_id else None
        _img_dir = _resolve_image_dir(eda) if eda else ''
        _coco_path = getattr(eda, 'coco_json_path', '') if eda else ''

        # 附件 → exec extra_vars + 系统提示补充
        extra_vars = {
            'images_dir': _img_dir,
            'coco_json_path': _coco_path,
        }
        attachment_ctx_parts = []
        has_vision_img = False
        vision_image = None
        for att in attachments:
            if att.get('type') == 'image':
                has_vision_img = True
                vision_image = att
                attachment_ctx_parts.append(f"用户上传了图片：{att.get('name', 'image')}")
            elif att.get('type') == 'csv':
                rows = att.get('rows', [])
                extra_vars['uploaded_data'] = rows
                col_info = '、'.join(list(rows[0].keys())[:10]) if rows else '无列'
                attachment_ctx_parts.append(
                    f"用户上传了 CSV 文件「{att.get('name')}」，共 {att.get('total_rows', len(rows))} 行，"
                    f"列名：{col_info}，已作为 `uploaded_data`（list of dict）变量注入代码环境。"
                )
            elif att.get('type') == 'json':
                d = att.get('data')
                if isinstance(d, list):
                    extra_vars['uploaded_data'] = d
                    attachment_ctx_parts.append(
                        f"用户上传了 JSON 文件「{att.get('name')}」（列表，{len(d)} 项），已作为 `uploaded_data` 变量注入。"
                    )
                elif isinstance(d, dict):
                    extra_vars['uploaded_data'] = d
                    attachment_ctx_parts.append(f"用户上传了 JSON 文件「{att.get('name')}」（对象），已作为 `uploaded_data` 注入。")
            elif att.get('type') == 'text':
                extra_vars['uploaded_text'] = att.get('content', '')
                attachment_ctx_parts.append(f"用户上传了文本文件「{att.get('name')}」，内容已作为 `uploaded_text` 变量注入。")

        # 拼接 system prompt（附加“思维树决策”指令）
        attach_ctx = ('\n\n## 用户上传的文件\n' + '\n'.join(attachment_ctx_parts)) if attachment_ctx_parts else ''
        base_prompt = AGENT_SYSTEM_PROMPT.replace('{dataset_context}', ctx)
        tool_plan = (
            f"\n\n## 内置思维树决策\n"
            f"- intent: {tool_decision.get('intent')}\n"
            f"- reason: {tool_decision.get('reason')}\n"
            f"- tools: {', '.join(tool_decision.get('tools', [])) or '无'}\n"
            f"- instruction: {tool_decision.get('instruction') or '按常规流程分析'}\n"
        )
        custom_tools_text = _list_custom_tools_for_prompt()
        if custom_tools_text:
            tool_plan += (
                "\n## 用户自定义 Agent 工具（可直接在代码中调用）\n"
                f"{custom_tools_text}\n"
            )
        recalled_skills = _match_imported_skills(user_text, max_skills=8)
        picked = llm_select_skills(recalled_skills, max_pick=3)
        store_map = {str(x.get('id')): x for x in _load_agent_skills_map()}
        forced_full = [store_map[i] for i in forced_skill_ids if i in store_map]
        picked_full = _hydrate_skills_from_store(picked)
        _seen_skill = set()
        matched_skills = []
        for s in forced_full + picked_full:
            sid = str(s.get('id', ''))
            if not sid or sid in _seen_skill:
                continue
            _seen_skill.add(sid)
            matched_skills.append(s)
        matched_skills = matched_skills[:6]
        _increase_skill_load_counts([s.get('id') for s in matched_skills])
        if matched_skills:
            skill_blocks = []
            for s in matched_skills:
                script_list = ', '.join([sp.get('rel_path', sp.get('name', '')) for sp in (s.get('scripts') or [])[:8]]) or '无'
                cfg_list = ', '.join([c.get('rel_path', '') for c in (s.get('configs') or [])[:8]]) or '无'
                skill_root = s.get('skill_dir') or str(Path(s.get('path', '')).parent)
                cid = s.get('cursor_name') or s.get('name', '')
                desc = (s.get('description') or '').strip()
                desc_short = (desc[:880] + '…') if len(desc) > 880 else desc
                skill_blocks.append(
                    f"### Skill: {s.get('name')}\n"
                    f"- Cursor skill id (`name` in frontmatter): `{cid}`\n"
                    f"- Description: {desc_short or '(见正文)'}\n"
                    f"- Summary: {s.get('summary')}\n"
                    f"- Runtime skill root: {skill_root}\n"
                    f"- Scripts: {script_list}\n"
                    f"- Config files: {cfg_list}\n"
                    f"- Full SKILL.md:\n{s.get('content')}"
                )
            tool_plan += (
                "\n## 按需加载 Skills（Cursor 兼容：SKILL.md + YAML frontmatter）\n"
                "以下技能与 Cursor 约定一致：`name`、`description` 用于发现；包内为 `scripts/` 等相对路径。"
                "对话中 **固定** 的技能已优先列入，须严格按其步骤与约束执行（优于常识推断）。\n"
                "以下是与当前问题匹配或用户指定的技能（见下文块）。\n\n"
                "Magic-Fox 预测/拉训练列表优先：`run_magic_fox_model_validation(...)`、`run_magic_fox_fetch_training_models(...)`；"
                "其它技能可调用 run_skill_cli(skill_name, script='scripts/xxx.py', args=[...])（自动 SKILL_ROOT/cwd）；"
                "或 run_skill_script(skill_name, script='xxx.py', kwargs={...})；"
                "如需读取技能文件可调用 read_skill_file(skill_name, rel_path='...')；"
                "如需加载包内固定配置可调用 load_skill_config(skill_name)（默认首个索引到的 config.json 等）或 load_skill_config(skill_name, rel_path='config/xxx.json')。\n"
                "注意：不要使用 ~/.cursor/skills/... 这类固定路径，必须使用运行时注入的 skill root。\n\n"
                + "\n\n".join(skill_blocks)
                + "\n"
            )
        if custom_system_prompt:
            system_content = custom_system_prompt + '\n\n---\n\n' + base_prompt + tool_plan + attach_ctx
        else:
            system_content = base_prompt + tool_plan + attach_ctx
        full_messages = [{'role': 'system', 'content': system_content}]

        # 若有图片附件且用多模态模型，把图片加到最后一条用户消息
        if has_vision_img and vision_image and messages:
            *prev, last_user = messages
            img_content = [
                {'type': 'text', 'text': last_user.get('content', '')},
                {'type': 'image_url', 'image_url': {
                    'url': f"data:{vision_image['mime']};base64,{vision_image['data']}"
                }}
            ]
            full_messages += prev + [{'role': 'assistant' if m.get('role') == 'assistant' else m['role'],
                                       'content': m['content']} for m in prev]
            full_messages += [{'role': 'user', 'content': img_content}]
        else:
            full_messages += messages

        # ── 联网搜索（检测意图）────────────────────────────────
        # 把内置动作指令也透传为状态，便于前端展示（可选）
        yield sse({'type': 'status', 'msg': f"🧠 决策：{tool_decision.get('reason')}（{tool_decision.get('intent')}）"})
        if matched_skills:
            _ids_m = {str(s.get('id')) for s in matched_skills}
            _n_pin = len(set(forced_skill_ids) & _ids_m)
            _names = ', '.join([s.get('name', '') for s in matched_skills])
            _msg = f"🧩 已加载 Skills：{_names}"
            if _n_pin:
                _msg += f"（含固定 {_n_pin} 个）"
            yield sse({'type': 'status', 'msg': _msg})

        search_keywords = ['搜索', '搜一下', '查找最新', '网络上', '联网搜', '最新资讯',
                           '查询资料', '百度', '谷歌', '最新论文', '最新方法']
        need_search = any(kw in user_text for kw in search_keywords)

        if need_search:
            # 提取搜索词（去掉指令词，保留核心查询）
            search_q = user_text
            for kw in ['帮我', '请', '搜索', '搜一下', '查找', '联网搜', '查询']:
                search_q = search_q.replace(kw, '').strip()
            search_q = search_q[:100]
            yield sse({'type': 'status', 'msg': f'🌐 搜索：{search_q[:30]}...'})
            search_result = _web_search(search_q)
            yield sse({'type': 'search_result', 'query': search_q, 'result': search_result})
            # 把搜索结果注入 system 上下文
            full_messages[0]['content'] += f'\n\n## 联网搜索结果（查询：{search_q}）\n{search_result}'

        # ── 阶段一：调用 LLM，收集完整回复 ──────────────────
        yield sse({'type': 'status', 'msg': '🤔 正在分析问题...'})
        try:
            first_reply = call_llm_sync(full_messages, stream=False)
        except urllib.error.HTTPError as e:
            body = e.read().decode('utf-8', errors='replace')
            yield sse({'type': 'error', 'msg': f'HTTP {e.code}: {body[:400]}'})
            yield 'data: [DONE]\n\n'
            return
        except Exception as e:
            yield sse({'type': 'error', 'msg': str(e)})
            yield 'data: [DONE]\n\n'
            return

        # ── 阶段二：检测代码块，自动执行（失败自动修复重试） ─────
        code_blocks = extract_py_blocks(first_reply)
        exec_summaries = []
        max_fix_attempts = 3

        if code_blocks and (images_list or extra_vars):
            for i, code in enumerate(code_blocks):
                current_code = code
                final_result = None
                final_attempt = 0

                for attempt in range(max_fix_attempts + 1):
                    final_attempt = attempt
                    attempt_label = f'{i+1}/{len(code_blocks)}'
                    if attempt == 0:
                        yield sse({'type': 'code', 'code': current_code, 'index': i})
                        yield sse({'type': 'status', 'msg': f'⚙️ 执行代码 ({attempt_label})...'})
                    else:
                        yield sse({'type': 'code', 'code': current_code, 'index': i})
                        yield sse({'type': 'status', 'msg': f'🔁 第 {attempt} 次自动修复后重试 ({attempt_label})...'})

                    result = _exec_code_internal(current_code, images_list, extra_vars)
                    yield sse({'type': 'code_result', 'result': result, 'index': i})
                    final_result = result

                    # 成功则结束该代码块重试循环
                    if result.get('type') != 'error':
                        break

                    if attempt >= max_fix_attempts:
                        break

                    # 失败 -> 让 LLM 基于 traceback 自动修复代码
                    err_text = (result.get('output') or '').strip()[:12000]
                    repair_prompt = (
                        "下面这段 Python 代码在执行时报错，请你修复并返回可执行版本。\n\n"
                        "要求：\n"
                        "1) 仅返回一个 ```python 代码块```，不要额外解释；\n"
                        "2) 保持原始意图不变；\n"
                        "3) 必须兼容当前运行环境中可用变量/函数：images, uploaded_data, uploaded_text, "
                        "filter_gallery, show_chart, show_table, show_df, visualize_df, find_images, hard_cases, "
                        "category_stats, bbox_stats, coco_overview, export_csv, export_json, export_txt, pack_dataset, export_coco；\n"
                        "4) 避免使用未定义变量（例如 filtered_ids 这类未赋值变量）。\n\n"
                        f"原始代码：\n```python\n{current_code}\n```\n\n"
                        f"报错信息：\n```text\n{err_text}\n```"
                    )
                    repair_msgs = [
                        {'role': 'system', 'content': '你是严谨的 Python 代码修复助手。只输出一个可执行 python 代码块。'},
                        {'role': 'user', 'content': repair_prompt},
                    ]
                    try:
                        repair_reply = call_llm_sync(repair_msgs, stream=False)
                        fixed_blocks = extract_py_blocks(repair_reply)
                        fixed_code = (fixed_blocks[0] if fixed_blocks else repair_reply).strip()
                        if not fixed_code:
                            yield sse({'type': 'status', 'msg': f'⚠️ 自动修复未产出有效代码，停止重试（代码块 {i+1}）'})
                            break
                        current_code = fixed_code
                        yield sse({'type': 'status', 'msg': f'🛠️ 已自动分析报错并生成修复代码（代码块 {i+1}）'})
                    except Exception as e:
                        yield sse({'type': 'status', 'msg': f'⚠️ 自动修复调用失败：{e}'})
                        break

                # 流出 UI Actions（navigate / filter_gallery / show_chart / load_dataset）
                for action in (final_result or {}).get('ui_actions', []):
                    yield sse({'type': 'ui_action', 'action': action})

                if final_result is None:
                    final_result = {'type': 'error', 'output': '代码未执行'}
                exec_summaries.append(
                    f"代码 {i+1} 执行结果（{final_result.get('type')}，attempt={final_attempt + 1}）：\n"
                    f"{final_result.get('output', '')}"
                )

        # ── 阶段三：喂回执行结果，流式获取最终结论 ───────────
        if exec_summaries:
            results_text = '\n\n'.join(exec_summaries)
            follow_up = (
                f"上面代码在真实数据集上的执行结果如下：\n\n{results_text}\n\n"
                "请基于这些**真实数据**给出最终分析结论，直接给结论，不要重复代码。"
            )
            phase3_msgs = full_messages + [
                {'role': 'assistant', 'content': first_reply},
                {'role': 'user', 'content': follow_up},
            ]
            yield sse({'type': 'status', 'msg': '💬 基于真实数据生成结论...'})
        else:
            phase3_msgs = None

        yield sse({'type': 'conclusion_start'})
        if phase3_msgs:
            try:
                for chunk in stream_llm(phase3_msgs):
                    yield sse({'type': 'conclusion', 'content': chunk})
            except Exception as e:
                yield sse({'type': 'error', 'msg': str(e)})
        else:
            for chunk in [first_reply[i:i+80] for i in range(0, len(first_reply), 80)]:
                yield sse({'type': 'conclusion', 'content': chunk})

        yield 'data: [DONE]\n\n'

    return Response(stream_with_context(generate()), mimetype='text/event-stream',
                    headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'})


@app.route('/api/chat/download/<file_id>')
def chat_download(file_id: str):
    """下载临时文件（内存字典找不到时自动从磁盘扫描，兼容 Flask 热重启）"""
    from flask import send_file as _send_file
    _cleanup_temp_files()

    # 优先从内存字典查找
    info = _temp_files.get(file_id)
    if info and info['path'].exists():
        path, filename = info['path'], info['filename']
    else:
        # Flask 重启后内存字典被清空，直接从磁盘找
        matches = sorted(_TEMP_DIR.glob(f'{file_id}_*'), key=lambda p: p.stat().st_mtime, reverse=True)
        if not matches:
            return jsonify({'error': '文件不存在或已过期（超过 1 小时）'}), 404
        path = matches[0]
        filename = path.name[len(file_id) + 1:]   # 去掉 "fid_" 前缀
        # 补回内存字典
        _temp_files[file_id] = {'path': path, 'filename': filename, 'created': path.stat().st_mtime}

    # 根据扩展名设置 MIME 类型
    ext = Path(filename).suffix.lower()
    mime_map = {
        '.csv':  'text/csv; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.txt':  'text/plain; charset=utf-8',
        '.md':   'text/plain; charset=utf-8',
        '.zip':  'application/zip',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.png':  'image/png',
        '.jpg':  'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.pdf':  'application/pdf',
    }
    mimetype = mime_map.get(ext, 'application/octet-stream')
    return _send_file(path, as_attachment=True, download_name=filename, mimetype=mimetype)


@app.route('/api/chat/upload', methods=['POST'])
def chat_upload():
    """接收用户上传的文件，返回解析后的内容"""
    if 'file' not in request.files:
        return jsonify({'error': '未找到文件'}), 400
    file = request.files['file']
    filename = file.filename or 'upload'
    ext = Path(filename).suffix.lower()
    raw = file.read()

    # 图片 → base64（供多模态 LLM 使用）
    if ext in ('.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'):
        import base64
        mime = {'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
                'gif': 'image/gif', 'webp': 'image/webp', 'bmp': 'image/bmp'}.get(ext.lstrip('.'), 'image/jpeg')
        b64 = base64.b64encode(raw).decode('utf-8')
        return jsonify({'type': 'image', 'name': filename, 'mime': mime,
                        'data': b64, 'size': len(raw)})

    text = raw.decode('utf-8', errors='replace')

    if ext == '.csv':
        import io, csv as _csv
        reader = _csv.DictReader(io.StringIO(text))
        rows = list(reader)
        return jsonify({'type': 'csv', 'name': filename,
                        'rows': rows[:500], 'total_rows': len(rows),
                        'preview': text[:3000]})
    if ext == '.json':
        try:
            data = json.loads(text)
        except Exception:
            data = None
        return jsonify({'type': 'json', 'name': filename,
                        'data': data if isinstance(data, (list, dict)) else None,
                        'preview': text[:3000]})
    if ext in ('.txt', '.md', '.log'):
        return jsonify({'type': 'text', 'name': filename,
                        'content': text[:15000], 'size': len(text)})

    return jsonify({'error': f'暂不支持 {ext} 类型，请上传 jpg/png/csv/json/txt 文件'}), 400


def _web_search(query: str, max_results: int = 6) -> str:
    """DuckDuckGo 联网搜索（无需 API Key）"""
    try:
        import urllib.parse, urllib.request, re
        url = f'https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}&kl=cn-zh'
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        })
        with urllib.request.urlopen(req, timeout=12) as resp:
            html = resp.read().decode('utf-8', errors='replace')
        clean = lambda s: re.sub(r'<[^>]+>', '', s).strip()
        results = []
        # 提取标题 + 摘要
        titles = re.findall(r'class="result__a"[^>]*>(.*?)</a>', html, re.DOTALL)
        snips = re.findall(r'class="result__snippet"[^>]*>(.*?)</a>', html, re.DOTALL)
        for i in range(min(max_results, len(titles), len(snips))):
            t, s = clean(titles[i]), clean(snips[i])
            if t:
                results.append(f'• {t}\n  {s}')
        return '\n\n'.join(results) if results else '未找到相关搜索结果'
    except Exception as e:
        return f'搜索失败：{e}'


# 启动时自动加载已启用的自定义 Agent 模块
try:
    _reload_enabled_agent_modules()
except Exception as _e:
    _safe_log(f'[警告] 加载自定义 Agent 模块失败：{_e}')


@app.route('/api/chat/run_code', methods=['POST'])
def chat_run_code():
    """手动执行 Python 代码（用于代码块的手动运行按钮）"""
    data = request.get_json() or {}
    code = data.get('code', '').strip()
    dataset_id = data.get('dataset_id')

    if not code:
        return jsonify({'error': '代码为空'}), 400

    images_list = _build_images_list(dataset_id) if dataset_id else []
    eda_obj = current_datasets.get(dataset_id) if dataset_id else None
    path_vars = {
        'images_dir': _resolve_image_dir(eda_obj) if eda_obj else '',
        'coco_json_path': getattr(eda_obj, 'coco_json_path', '') if eda_obj else '',
    }
    result = _exec_code_internal(code, images_list, path_vars)
    if result['type'] == 'error':
        return jsonify({'error': result['output']}), 500
    if result['type'] == 'filter':
        return jsonify({'success': True, 'type': 'filter',
                        'image_ids': result['image_ids'], 'count': len(result['image_ids']),
                        'output': result.get('output', ''), 'files': result.get('files', []),
                        'ui_actions': result.get('ui_actions', [])})
    return jsonify({'success': True, 'type': 'report',
                    'output': result['output'], 'files': result.get('files', []),
                    'ui_actions': result.get('ui_actions', [])})

# ==================== AI Chat 系统结束 ====================

if __name__ == '__main__':
    port = 6010
    url = f'http://127.0.0.1:{port}'
    # 启动时打印可访问地址，避免用户误用 0.0.0.0
    print('')
    print(f'请在浏览器中访问: http://127.0.0.1:{port} 或 http://localhost:{port}')
    print('（本机其他设备可用局域网 IP，见下方 "Running on" 行）')
    print('')
    # 打包模式下自动打开浏览器
    if getattr(sys, 'frozen', False):
        def _open_browser():
            import time
            time.sleep(1.5)
            webbrowser.open(url)
        threading.Thread(target=_open_browser, daemon=True).start()
    # use_reloader=False 避免调试重载时 socket 断开导致浏览器 ERR_SOCKET_NOT_CONNECTED
    app.run(
        debug=not getattr(sys, 'frozen', False),
        host='0.0.0.0',
        port=port,
        use_reloader=False,
        threaded=True,
    )
