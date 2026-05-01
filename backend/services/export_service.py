"""实验数据集导出 service。

包装 export_engine.build_experiment_zip_bytes，提供两套调用方式：
- run_export(): 同步整体打包并返回 zip_bytes + stats。
- run_export_with_progress(): NDJSON 进度流（在 worker 线程跑，主线程从队列输出）。
"""
from __future__ import annotations

import json
import queue as _queue
import threading
from pathlib import Path
from typing import Iterable, Optional

from flask import Response, stream_with_context

from ..json_utils import json_sanitize, safe_log
from ..repositories import temp_files_repo
from . import dataset_service
from .export_engine import build_experiment_zip_bytes


def resolve_zip_destination(output_path: Optional[str], zip_name: str) -> Path | None:
    """解析实验导出 ZIP 的目标路径（运行在服务端本机磁盘上）。
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
    p = (Path.cwd() / p).resolve() if not p.is_absolute() else p.resolve()
    if p.suffix.lower() == '.zip':
        return p
    if p.exists() and p.is_file():
        raise ValueError(
            f'输出路径已存在且为文件，请填写目录或带 .zip 的完整路径：{p}'
        )
    return (p / zn).resolve()


def write_zip_bytes_to_path(dest: Path, zip_bytes: bytes) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(zip_bytes)


def resolve_image_dir(eda) -> str:
    """解析数据集的图片目录（优先 eda.image_dir，fallback 用 coco_json 所在目录）。"""
    img_dir = getattr(eda, 'image_dir', None) or ''
    if not img_dir:
        coco_path = getattr(eda, 'coco_json_path', None)
        img_dir = str(Path(coco_path).parent.resolve()) if coco_path else ''
    return str(Path(img_dir).resolve()) if img_dir else ''


def _build_kwargs_from_dataset(dataset_id: str, fallback_name: str) -> dict:
    eda = dataset_service.get_in_memory(dataset_id)
    if not eda:
        raise ValueError('数据集未加载或会话已失效，请重新加载')
    cp = getattr(eda, 'coco_json_path', None)
    if not cp or not Path(cp).exists():
        raise ValueError('找不到 COCO 文件')
    sd = getattr(eda, 'source_dirs', None)
    return {
        'coco_json_path': str(cp),
        'image_dir_fallback': resolve_image_dir(eda),
        'source_dirs': sd if isinstance(sd, dict) else None,
        'dataset_name': getattr(eda, 'name', None) or fallback_name,
    }


def _prepare_items_kwargs(items: Iterable[dict]) -> list[dict]:
    prepared: list[dict] = []
    for it in items or []:
        fixed = dataset_service.prepare_merge_item(it)
        if fixed:
            prepared.append(fixed)
    if not prepared:
        raise ValueError('没有可用的合并源，请检查路径与 COCO 文件')
    return prepared


def _normalize_request(data: dict) -> dict:
    if not isinstance(data, dict):
        data = {}
    train_ratio = float(data.get('train_ratio') or 0.8)
    if not (0 < train_ratio <= 1):
        raise ValueError('train_ratio 须在 (0, 1] 之间')
    seed = int(data.get('seed') if data.get('seed') is not None else 42)
    zip_name = (data.get('zip_name') or 'experiment_dataset.zip').strip()
    if not zip_name.lower().endswith('.zip'):
        zip_name += '.zip'
    dataset_name = (data.get('dataset_name') or 'dataset').strip() or 'dataset'
    drop_dup = data.get('drop_duplicate_basenames')
    drop_dup = True if drop_dup is None else bool(drop_dup)
    split_by_dir = data.get('split_by_source_dir')
    split_by_dir = True if split_by_dir is None else bool(split_by_dir)
    return {
        'train_ratio': train_ratio,
        'seed': seed,
        'zip_name': zip_name,
        'dataset_name': dataset_name,
        'drop_duplicate_basenames': drop_dup,
        'split_by_source_dir': split_by_dir,
    }


def run_export(data: dict) -> dict:
    """同步导出。返回 dict（含 success/saved_path/file_id/download_url/filename/stats）。"""
    norm = _normalize_request(data)
    items = data.get('items')
    dataset_id = data.get('dataset_id')

    if items and isinstance(items, list):
        prepared = _prepare_items_kwargs(items)
        zip_bytes, stats = build_experiment_zip_bytes(
            prepared_items=prepared,
            train_ratio=norm['train_ratio'],
            seed=norm['seed'],
            dataset_name=norm['dataset_name'],
            drop_duplicate_basenames=norm['drop_duplicate_basenames'],
            split_by_source_dir=norm['split_by_source_dir'],
        )
    elif dataset_id:
        ds_kw = _build_kwargs_from_dataset(dataset_id, norm['dataset_name'])
        zip_bytes, stats = build_experiment_zip_bytes(
            coco_json_path=ds_kw['coco_json_path'],
            image_dir_fallback=ds_kw['image_dir_fallback'],
            source_dirs=ds_kw['source_dirs'],
            train_ratio=norm['train_ratio'],
            seed=norm['seed'],
            dataset_name=ds_kw['dataset_name'],
            drop_duplicate_basenames=norm['drop_duplicate_basenames'],
            split_by_source_dir=norm['split_by_source_dir'],
        )
    else:
        raise ValueError('请提供 dataset_id（当前已加载数据集）或 items（多源合并）')

    out_raw = (data.get('output_path') or data.get('save_path') or '').strip()
    dest = resolve_zip_destination(out_raw or None, norm['zip_name'])
    if dest is not None:
        write_zip_bytes_to_path(dest, zip_bytes)
        if isinstance(stats, dict):
            stats = {**stats, 'saved_path': str(dest), 'storage_note': '已保存到服务端指定路径。'}
        return json_sanitize({
            'success': True,
            'saved_path': str(dest),
            'file_id': None,
            'download_url': None,
            'filename': norm['zip_name'],
            'stats': stats,
        })
    fid = temp_files_repo.save(zip_bytes, norm['zip_name'])
    return json_sanitize({
        'success': True,
        'file_id': fid,
        'download_url': f'/api/chat/download/{fid}',
        'filename': norm['zip_name'],
        'stats': stats,
    })


def run_export_streaming(data: dict) -> Response:
    """NDJSON 流式导出（progress 行 + done/error 行）。"""
    norm = _normalize_request(data)
    items = data.get('items')
    dataset_id = data.get('dataset_id')

    prepared: list[dict] | None = None
    coco_path_kw: str | None = None
    img_dir_kw: str | None = None
    source_dirs_kw: dict | None = None
    ds_name_kw = norm['dataset_name']

    if items and isinstance(items, list):
        prepared = _prepare_items_kwargs(items)
    elif dataset_id:
        ds_kw = _build_kwargs_from_dataset(dataset_id, norm['dataset_name'])
        coco_path_kw = ds_kw['coco_json_path']
        img_dir_kw = ds_kw['image_dir_fallback']
        source_dirs_kw = ds_kw['source_dirs']
        ds_name_kw = ds_kw['dataset_name']
    else:
        raise ValueError('请提供 dataset_id（当前已加载数据集）或 items（多源合并）')

    out_raw = (data.get('output_path') or data.get('save_path') or '').strip()
    export_dest = resolve_zip_destination(out_raw or None, norm['zip_name'])

    q: _queue.Queue = _queue.Queue()
    zip_name = norm['zip_name']

    def _worker():
        try:
            def on_progress(pct, msg):
                q.put(('progress', pct, msg))
            if prepared is not None:
                zip_bytes, stats = build_experiment_zip_bytes(
                    prepared_items=prepared,
                    train_ratio=norm['train_ratio'],
                    seed=norm['seed'],
                    dataset_name=ds_name_kw,
                    on_progress=on_progress,
                    drop_duplicate_basenames=norm['drop_duplicate_basenames'],
                    split_by_source_dir=norm['split_by_source_dir'],
                )
            else:
                zip_bytes, stats = build_experiment_zip_bytes(
                    coco_json_path=coco_path_kw,
                    image_dir_fallback=img_dir_kw,
                    source_dirs=source_dirs_kw,
                    train_ratio=norm['train_ratio'],
                    seed=norm['seed'],
                    dataset_name=ds_name_kw,
                    on_progress=on_progress,
                    drop_duplicate_basenames=norm['drop_duplicate_basenames'],
                    split_by_source_dir=norm['split_by_source_dir'],
                )
            zs = len(zip_bytes)
            mb = zs / (1024 * 1024)
            if export_dest is not None:
                on_progress(95, f'正在写入 {export_dest}（约 {mb:.1f} MB）…')
                write_zip_bytes_to_path(export_dest, zip_bytes)
                if isinstance(stats, dict):
                    stats = {**stats, 'saved_path': str(export_dest), 'storage_note': '已保存到服务端指定路径。'}
                on_progress(99, '完成')
                q.put(('done', None, stats))
            else:
                on_progress(95, f'正在写入服务器临时文件（约 {mb:.1f} MB）…')
                fid = temp_files_repo.save(zip_bytes, zip_name)
                if isinstance(stats, dict):
                    stats = {
                        **stats,
                        'server_temp_dir': str(temp_files_repo.temp_dir()),
                        'storage_note': '服务端临时文件仅用于本次下载（约 1 小时后清理）；本机保存位置由浏览器「下载」设置决定。',
                    }
                on_progress(99, '准备下载…')
                q.put(('done', fid, stats))
        except Exception as e:  # noqa: BLE001
            safe_log(f'export_experiment_dataset_stream: {e}')
            q.put(('error', str(e)))

    threading.Thread(target=_worker, daemon=True).start()

    def generate():
        while True:
            item = q.get()
            if item[0] == 'progress':
                yield (json.dumps(json_sanitize({
                    'type': 'progress', 'pct': item[1], 'message': item[2],
                }), ensure_ascii=False) + '\n').encode('utf-8')
            elif item[0] == 'done':
                fid, stats = item[1], item[2]
                done_obj = {'type': 'done', 'filename': zip_name, 'stats': stats}
                if fid:
                    done_obj['file_id'] = fid
                    done_obj['download_url'] = f'/api/chat/download/{fid}'
                if isinstance(stats, dict) and stats.get('saved_path'):
                    done_obj['saved_path'] = stats['saved_path']
                yield (json.dumps(json_sanitize(done_obj), ensure_ascii=False) + '\n').encode('utf-8')
                return
            elif item[0] == 'error':
                yield (json.dumps({'type': 'error', 'message': item[1]}, ensure_ascii=False) + '\n').encode('utf-8')
                return

    return Response(
        stream_with_context(generate()),
        mimetype='application/x-ndjson',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'},
    )
