# -*- mode: python ; coding: utf-8 -*-
# COCO Visualizer - PyInstaller 打包配置
# 用法: 先运行 packaging/convert_logo_ico.py（Windows）及 convert_logo_icns.py（macOS），再 pyinstaller coco_visualizer.spec

import sys
from pathlib import Path

block_cipher = None

project_dir = Path(SPECPATH)

_installer = project_dir / "packaging" / "installer"
_logo_ico = _installer / "logo.ico"
_logo_icns = _installer / "logo.icns"


def _read_app_version() -> str:
    vf = project_dir / "version.txt"
    if vf.is_file():
        for line in vf.read_text(encoding="utf-8").splitlines():
            s = line.strip()
            if s and not s.startswith("#"):
                return s
    return "0.0.0"


_app_version = _read_app_version()


def _exe_icon_arg():
    if sys.platform == "win32":
        return str(_logo_ico) if _logo_ico.is_file() else None
    if sys.platform == "darwin":
        return str(_logo_icns) if _logo_icns.is_file() else None
    return None


def _bundle_icon_arg():
    if sys.platform != "darwin":
        return None
    return str(_logo_icns) if _logo_icns.is_file() else None


datas = [
    (str(project_dir / "templates"), "templates"),
    (str(project_dir / "static"), "static"),
    # 把 version.txt 放进 _MEIPASS 根，供 backend.config 读取应用版本
    (str(project_dir / "version.txt"), "."),
]

hiddenimports = [
    "flask",
    "flask_cors",
    "werkzeug",
    "numpy",
    "pandas",
    "jinja2",
    "markupsafe",
    "PIL",
    "PIL.Image",
    "backend",
    "backend.config",
    "backend.errors",
    "backend.json_utils",
    "backend.blueprints",
    "backend.blueprints.uploads_bp",
    "backend.blueprints.datasets_bp",
    "backend.blueprints.images_bp",
    "backend.blueprints.annotations_bp",
    "backend.blueprints.versions_bp",
    "backend.blueprints.export_bp",
    "backend.blueprints.agent_modules_bp",
    "backend.blueprints.chat_bp",
    "backend.blueprints.app_meta_bp",
    "backend.repositories",
    "backend.repositories.datasets_repo",
    "backend.repositories.versions_repo",
    "backend.repositories.loader_record_repo",
    "backend.repositories.agent_modules_repo",
    "backend.repositories.temp_files_repo",
    "backend.services",
    "backend.services.coco_eda",
    "backend.services.dataset_service",
    "backend.services.annotation_service",
    "backend.services.image_service",
    "backend.services.export_engine",
    "backend.services.export_service",
    "backend.services.skill_service",
    "backend.services.chat_service",
    "backend.services.agent_service",
    "backend.agent_runtime",
    "backend.agent_runtime.builtins",
    "backend.agent_runtime.sandbox",
]

a = Analysis(
    [str(project_dir / "app.py")],
    pathex=[str(project_dir)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "tkinter", "matplotlib", "cv2", "scipy", "sklearn",
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

_exe_icon = _exe_icon_arg()

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="COCO-Visualizer",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=_exe_icon,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="COCO-Visualizer",
)

if sys.platform == "darwin":
    _bic = _bundle_icon_arg()
    app = BUNDLE(
        coll,
        name="COCO-Visualizer.app",
        icon=_bic,
        bundle_identifier="com.cocovisualizer.app",
        info_plist={
            "CFBundleName": "COCO Visualizer",
            "CFBundleDisplayName": "COCO Visualizer",
            "CFBundleShortVersionString": _app_version,
            "CFBundleVersion": _app_version,
            "NSHighResolutionCapable": True,
            "LSBackgroundOnly": False,
        },
    )
