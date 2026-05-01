"""路径常量与全局配置。

兼容 PyInstaller frozen 模式：
- frozen 时静态/模板从 sys._MEIPASS 解包；uploads/data 落在可执行文件旁。
- dev 时全部相对仓库根目录。
"""
from __future__ import annotations

import sys
from pathlib import Path


def _resolve_dirs() -> tuple[Path, Path, Path, Path, Path]:
    if getattr(sys, 'frozen', False):
        app_dir = Path(sys.executable).parent
        meipass = Path(getattr(sys, '_MEIPASS', app_dir))
        template_folder = meipass / 'templates'
        static_folder = meipass / 'static'
    else:
        app_dir = Path(__file__).resolve().parent.parent
        template_folder = app_dir / 'templates'
        static_folder = app_dir / 'static'
    upload_folder = app_dir / 'uploads'
    data_dir = app_dir / 'data'
    return app_dir, template_folder, static_folder, upload_folder, data_dir


APP_DIR, TEMPLATE_FOLDER, STATIC_FOLDER, UPLOAD_FOLDER, DATA_DIR = _resolve_dirs()

if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))


def _ensure_writable_dir(p: Path, label: str) -> None:
    try:
        p.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        if getattr(sys, 'frozen', False):
            print(
                f'[警告] 无法在可执行文件旁创建 {label} 目录: {p}\n'
                f'  错误: {exc}\n'
                f'  请将程序放在有写权限的目录（如解压后的文件夹）再运行。',
                file=sys.stderr,
            )
        raise


_ensure_writable_dir(UPLOAD_FOLDER, 'uploads')
_ensure_writable_dir(DATA_DIR, 'data')

# data/ 下的索引文件
DATASETS_MAP_FILE = DATA_DIR / 'datasets.json'
AGENT_MODULES_DIR = DATA_DIR / 'agent_modules'
AGENT_MODULES_MAP_FILE = DATA_DIR / 'agent_modules.json'
AGENT_SKILLS_MAP_FILE = DATA_DIR / 'agent_skills.json'

# 业务常量
MAX_VERSIONS = 50
VERSIONS_DIR_NAME = '.coco_visualizer'
LOADER_RECORD_FILENAME = '_coco_visualizer_last.json'
COCO_ANNOTATION_FILENAME = '_annotations.coco.json'
import re as _re
PRED_ANNOTATION_PATTERN = _re.compile(r'^_annotations\.(.+)\.pred\.coco\.json$')
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.bmp', '.webp', '.tiff', '.tif', '.gif'}
META_FILTER_PRODUCT_IDS_LIMIT = 200
