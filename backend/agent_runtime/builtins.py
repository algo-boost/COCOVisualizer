"""Agent 沙箱内置函数：导出 / UI / Skill / COCO 工具。

每个工厂函数返回一组绑定在执行 context 上的 callables；它们闭包到
output_lines / created_files / ui_actions 等可变状态。
"""
from __future__ import annotations

import builtins as _builtins_mod
import importlib.util
import io as _io
import json
import os
import subprocess
import sys
import time as _time
import uuid as _uuid
from collections import Counter
from pathlib import Path

from ..repositories import agent_modules_repo, temp_files_repo


# -------- skill resolve helpers --------

def _get_skill_item(skill_name: str):
    skills = agent_modules_repo.load_skills()
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
    key = str(name_or_hint or '').strip().lower()
    if not key:
        return None
    hit = _get_skill_item(key)
    if hit:
        return hit
    skills = agent_modules_repo.load_skills()
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


def _json_safe(obj):
    if isinstance(obj, dict):
        return {str(k): _json_safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_json_safe(x) for x in obj]
    if isinstance(obj, Counter):
        return {str(k): int(v) for k, v in obj.items()}
    if isinstance(obj, set):
        return sorted([_json_safe(x) for x in obj], key=str)
    try:
        return obj.item()
    except AttributeError:
        pass
    if isinstance(obj, (int, float, bool, str)) or obj is None:
        return obj
    return str(obj)


# -------- builders --------

def make_io_builtins(captured_print, created_files):
    """文件导出三件套（CSV/JSON/TXT）。"""
    import csv as _csv

    def export_csv(data, filename='export.csv'):
        if isinstance(data, (Counter, dict)):
            data = [{'key': k, 'value': v} for k, v in data.items()]
        elif not isinstance(data, (list, tuple)):
            data = list(data)
        buf = _io.StringIO()
        if data and isinstance(data[0], dict):
            keys = list(data[0].keys())
            w = _csv.DictWriter(buf, fieldnames=keys, extrasaction='ignore', lineterminator='\r\n')
            w.writeheader()
            w.writerows([{k: str(row.get(k, '')) for k in keys} for row in data])
        elif data:
            rows = [list(r) if isinstance(r, (list, tuple)) else [r] for r in data]
            _csv.writer(buf, lineterminator='\r\n').writerows([[str(c) for c in row] for row in rows])
        content = '\ufeff' + buf.getvalue()
        fid = temp_files_repo.save(content, filename)
        created_files.append({'file_id': fid, 'filename': filename})
        captured_print(f'[已导出] {filename}（{len(data)} 行）')
        return fid

    def export_json(data, filename='export.json'):
        safe_data = _json_safe(data)
        content = json.dumps(safe_data, ensure_ascii=False, indent=2)
        fid = temp_files_repo.save(content, filename)
        created_files.append({'file_id': fid, 'filename': filename})
        captured_print(f'[已导出] {filename}')
        return fid

    def export_txt(text, filename='report.txt'):
        fid = temp_files_repo.save(str(text), filename)
        created_files.append({'file_id': fid, 'filename': filename})
        captured_print(f'[已导出] {filename}')
        return fid

    return {'export_csv': export_csv, 'export_json': export_json, 'export_txt': export_txt}


def make_patched_open(captured_print, created_files):
    """重定向所有写模式 open() 到临时目录。"""
    temp_dir = temp_files_repo.temp_dir()

    def _patched_open(file, mode='r', *args, **kwargs):
        _real_open = _builtins_mod.open
        is_write = isinstance(mode, str) and ('w' in mode or 'a' in mode or 'x' in mode)
        if is_write and isinstance(file, (str, Path)):
            safe_name = Path(str(file)).name or 'output'
            fid = _uuid.uuid4().hex[:10]
            temp_path = temp_dir / f'{fid}_{safe_name}'
            temp_dir.mkdir(exist_ok=True)
            if 'b' in mode:
                class _BinaryProxy:
                    def __init__(self):
                        self._buf = _io.BytesIO()
                        self._fid = fid
                        self._name = safe_name

                    def write(self, b): return self._buf.write(b)

                    def writelines(self, ls):
                        for line in ls:
                            self._buf.write(line)

                    def flush(self): pass

                    def close(self):
                        temp_path.write_bytes(self._buf.getvalue())
                        temp_files_repo.register(self._fid, temp_path, self._name)
                        created_files.append({'file_id': self._fid, 'filename': self._name})
                        captured_print(f'[已写出] {self._name}')

                    def __enter__(self): return self

                    def __exit__(self, *a):
                        if not self._buf.closed:
                            self.close()

                    def __getattr__(self, n): return getattr(self._buf, n)

                return _BinaryProxy()

            class _TextProxy:
                def __init__(self):
                    self._buf = _io.StringIO()
                    self._fid = fid
                    self._name = safe_name

                def write(self, s): return self._buf.write(s)

                def writelines(self, ls):
                    for line in ls:
                        self._buf.write(line)

                def flush(self): pass

                def close(self):
                    fpath = temp_dir / f'{self._fid}_{self._name}'
                    enc = kwargs.get('encoding', 'utf-8') or 'utf-8'
                    fpath.write_text(self._buf.getvalue(), encoding=enc, errors='replace')
                    temp_files_repo.register(self._fid, fpath, self._name)
                    created_files.append({'file_id': self._fid, 'filename': self._name})
                    captured_print(f'[已写出] {self._name}')

                def __enter__(self): return self

                def __exit__(self, *a):
                    if not self._buf.closed:
                        self.close()

                def __getattr__(self, n): return getattr(self._buf, n)

            return _TextProxy()
        return _real_open(file, mode, *args, **kwargs)

    return _patched_open


def make_ui_builtins(captured_print, ui_actions):
    """UI 控制函数（navigate / filter_gallery / show_chart / show_table 等）。"""

    def navigate_to(page: str):
        ui_actions.append({'type': 'navigate', 'page': str(page)})
        captured_print(f'[导航] → {page}')

    def filter_gallery(image_ids, description: str = 'Agent 筛选结果'):
        ids = [int(i) for i in image_ids]
        ui_actions.append({'type': 'filter_gallery', 'image_ids': ids, 'description': str(description)})
        ui_actions.append({'type': 'navigate', 'page': 'gallery'})
        captured_print(f'[筛选] {len(ids)} 张图片 → 看图界面')

    def show_chart(chart_type: str, labels: list, datasets: list, title: str = ''):
        ui_actions.append({'type': 'show_chart', 'chart': {
            'chart_type': str(chart_type),
            'labels': list(labels),
            'datasets': list(datasets),
            'title': str(title),
        }})
        captured_print(f'[图表] {title or chart_type} 已生成')

    def show_table(rows, title: str = '数据预览'):
        try:
            if hasattr(rows, 'to_dict'):
                rows = rows.to_dict('records')
        except Exception:
            pass
        if isinstance(rows, dict):
            rows = [rows]
        if not isinstance(rows, list):
            rows = [rows]
        safe_rows = rows[:300]
        ui_actions.append({'type': 'show_table', 'table': {
            'title': str(title),
            'rows': safe_rows,
            'total_rows': len(rows),
        }})
        captured_print(f'[表格] {title}（展示 {len(safe_rows)}/{len(rows)} 行）')

    def show_df(df, title: str = 'DF预览', max_rows: int = 300):
        rows = df
        try:
            if hasattr(df, 'head') and hasattr(df, 'to_dict'):
                rows = df.head(int(max_rows)).to_dict('records')
        except Exception:
            pass
        show_table(rows, title=title)

    def visualize_df(df, x, y, chart_type: str = 'bar', title: str = 'DF可视化', topk: int = 30):
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

    def load_dataset_path(coco_json_path: str, image_dir: str = '', dataset_name: str = ''):
        ui_actions.append({'type': 'load_dataset',
                           'coco_json_path': str(coco_json_path),
                           'image_dir': str(image_dir),
                           'dataset_name': str(dataset_name)})
        captured_print(f'[加载数据集] {coco_json_path}')

    return {
        'navigate_to': navigate_to,
        'filter_gallery': filter_gallery,
        'show_chart': show_chart,
        'show_table': show_table,
        'show_df': show_df,
        'visualize_df': visualize_df,
        'load_dataset_path': load_dataset_path,
    }


def make_coco_builtins(images_list, ui_funcs, io_funcs, captured_print, created_files, extra_vars):
    """COCO 数据分析快捷工具 + export_coco/pack_dataset。"""
    filter_gallery = ui_funcs['filter_gallery']

    def export_coco(image_ids, zip_name='filtered_dataset.zip', with_images=True, preview=True, filename_prefix=None):
        import json as _j
        import zipfile as _zf
        import io as _zio
        cjp = (extra_vars or {}).get('coco_json_path', '')
        if not cjp or not Path(cjp).exists():
            captured_print('[错误] 当前未加载数据集，无法导出 COCO')
            return None
        try:
            orig = _j.loads(Path(cjp).read_text(encoding='utf-8'))
        except Exception as e:
            captured_print(f'[错误] 读取 COCO JSON 失败：{e}')
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
        ann_fid = temp_files_repo.save(coco_str, ann_name)
        created_files.append({'file_id': ann_fid, 'filename': ann_name})
        captured_print(f'[已导出] {ann_name}（{len(filtered_imgs)} 张图片，{len(filtered_anns)} 个标注）')
        result = {'coco_fid': ann_fid}

        if preview:
            filter_gallery(sorted(list(id_set)), f'导出子集预览（{len(filtered_imgs)} 张）')

        if with_images:
            img_dir_val = (extra_vars or {}).get('images_dir', '')
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
            zip_fid = temp_files_repo.save(zip_bytes, zip_name)
            created_files.append({'file_id': zip_fid, 'filename': zip_name})
            captured_print(f'[已导出] {zip_name}（包含 {packed}/{len(filtered_imgs)} 张图片）')
            result['zip_fid'] = zip_fid
        return result

    def pack_dataset(image_ids, zip_name: str = 'filtered_dataset.zip', preview: bool = True):
        return export_coco(image_ids, zip_name=zip_name, with_images=True, preview=preview)

    def coco_overview():
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
        c = Counter()
        key = 'annotations' if str(source).lower() != 'pred' else 'pred_annotations'
        for img in images_list:
            for a in img.get(key) or []:
                cat = a.get('category')
                if cat:
                    c[cat] += 1
        return [{'category': k, 'count': int(v)} for k, v in c.most_common()]

    def bbox_stats(source: str = 'gt'):
        key = 'annotations' if str(source).lower() != 'pred' else 'pred_annotations'
        areas: list[float] = []
        ratios: list[float] = []
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
            'area_p50': float(areas_sorted[len(areas_sorted) // 2]),
            'area_p90': float(areas_sorted[int(len(areas_sorted) * 0.9) - 1 if len(areas_sorted) > 1 else 0]),
            'area_max': float(areas_sorted[-1]),
            'tiny_ratio': round(tiny_cnt / len(areas), 4),
            'avg_aspect_ratio': round(sum(ratios) / len(ratios), 4),
        }

    def find_images(gt_min=None, gt_max=None, pred_min=None, pred_max=None,
                    categories=None, score_min=None, score_max=None):
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
                this_cats = {a.get('category') for a in gts if a.get('category')} | \
                            {a.get('category') for a in preds if a.get('category')}
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

    return {
        'export_coco': export_coco,
        'pack_dataset': pack_dataset,
        'coco_overview': coco_overview,
        'category_stats': category_stats,
        'bbox_stats': bbox_stats,
        'find_images': find_images,
        'hard_cases': hard_cases,
    }


def make_skill_builtins():
    """技能调用相关：read_skill_file / load_skill_config / run_skill_script / run_skill_cli / magic-fox。"""

    def read_skill_file(skill_name: str, rel_path: str = 'SKILL.md'):
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

    def load_skill_config(skill_name: str, rel_path: str | None = None):
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
            except ImportError as exc:
                raise RuntimeError('解析 YAML 需要安装 PyYAML（pip install pyyaml）') from exc
            return yaml.safe_load(raw)
        if suf == '.toml':
            try:
                import tomllib
                return tomllib.loads(raw)
            except ImportError:
                try:
                    import tomli  # type: ignore
                except ImportError as exc:
                    raise RuntimeError('解析 .toml 需要 Python 3.11+ 或 pip install tomli') from exc
                return tomli.loads(raw)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {'_raw': raw, '_format': 'text', 'rel_path': target_rel}

    def run_skill_script(skill_name: str, script: str = '', kwargs=None):
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
        mod_name = f'_skill_runtime_{_uuid.uuid4().hex[:8]}'
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

    def _run_skill_cli_for_dict(s: dict, script: str = '', args=None, timeout_sec: int = 1800):
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
            argv, cwd=str(skill_root), env=env,
            capture_output=True, text=True, timeout=max(1, int(timeout_sec)),
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
        s = _get_skill_item(skill_name)
        if not s:
            raise ValueError(f'未找到 skill: {skill_name}')
        return _run_skill_cli_for_dict(s, script, args, timeout_sec)

    def run_magic_fox_model_validation(
        train_id: int,
        images,
        output_dir: str,
        *,
        mode: str = 'full',
        threshold: float = 0.1,
        coco_json_name: str | None = None,
        coco_copy_images: bool = False,
        json_output: str | None = None,
        batch_size: int | None = None,
        batch_retries: int | None = None,
        resume: bool = True,
        poll_interval: float | None = None,
        max_wait: float | None = None,
        use_proxy: bool = False,
        skill_hint: str = 'magic-fox-model-validation',
        script: str = 'scripts/model_validation.py',
        timeout_sec: int = 7200,
    ):
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
        return _run_skill_cli_for_dict(s, script, cmd, timeout_sec)

    def run_magic_fox_fetch_training_models(
        training_url: str,
        csv_path: str,
        *,
        headless: bool = True,
        skill_hint: str = 'magic-fox-model-validation',
        script: str = 'scripts/fetch_training_models.py',
        timeout_sec: int = 1800,
    ):
        s = _resolve_skill_item(skill_hint)
        if not s:
            raise ValueError(
                f'未找到 Magic-Fox skill（hint={skill_hint!r}）。请先导入对应 skills.zip')
        cp = Path(str(csv_path)).expanduser().resolve()
        cp.parent.mkdir(parents=True, exist_ok=True)
        cmd = ['--url', str(training_url), '--csv', str(cp)]
        if not headless:
            cmd.append('--no-headless')
        return _run_skill_cli_for_dict(s, script, cmd, timeout_sec)

    return {
        'read_skill_file': read_skill_file,
        'load_skill_config': load_skill_config,
        'run_skill_script': run_skill_script,
        'run_skill_cli': run_skill_cli,
        'run_magic_fox_model_validation': run_magic_fox_model_validation,
        'run_magic_fox_fetch_training_models': run_magic_fox_fetch_training_models,
    }
