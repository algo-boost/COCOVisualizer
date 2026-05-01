# -*- mode: python ; coding: utf-8 -*-
# COCO Visualizer - PyInstaller 打包配置
# 用法: pyinstaller coco_visualizer.spec

import sys
from pathlib import Path

block_cipher = None

# 项目根目录
project_dir = Path(SPECPATH)

# 需要打包的数据文件（只读资源，data/uploads 在运行时创建于可执行文件旁）
datas = [
    (str(project_dir / 'templates'), 'templates'),
    (str(project_dir / 'static'), 'static'),
]

# 隐藏导入（PyInstaller 可能无法自动检测）
# 注意：不要排除 PIL/Pillow，app 用其读取图片尺寸（image_service.fill_image_dimensions）
hiddenimports = [
    'flask',
    'flask_cors',
    'werkzeug',
    'numpy',
    'pandas',
    'jinja2',
    'markupsafe',
    'PIL',
    'PIL.Image',
    # backend 包（PyInstaller 可能漏检子模块）
    'backend',
    'backend.config',
    'backend.errors',
    'backend.json_utils',
    'backend.blueprints',
    'backend.blueprints.uploads_bp',
    'backend.blueprints.datasets_bp',
    'backend.blueprints.images_bp',
    'backend.blueprints.annotations_bp',
    'backend.blueprints.versions_bp',
    'backend.blueprints.export_bp',
    'backend.blueprints.agent_modules_bp',
    'backend.blueprints.chat_bp',
    'backend.repositories',
    'backend.repositories.datasets_repo',
    'backend.repositories.versions_repo',
    'backend.repositories.loader_record_repo',
    'backend.repositories.agent_modules_repo',
    'backend.repositories.temp_files_repo',
    'backend.services',
    'backend.services.coco_eda',
    'backend.services.dataset_service',
    'backend.services.annotation_service',
    'backend.services.image_service',
    'backend.services.export_engine',
    'backend.services.export_service',
    'backend.services.skill_service',
    'backend.services.chat_service',
    'backend.services.agent_service',
    'backend.agent_runtime',
    'backend.agent_runtime.builtins',
    'backend.agent_runtime.sandbox',
]

a = Analysis(
    [str(project_dir / 'app.py')],
    pathex=[str(project_dir)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter', 'matplotlib', 'cv2', 'scipy', 'sklearn',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='COCO-Visualizer',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,  # 显示控制台窗口，便于查看日志；设为 False 可隐藏
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='COCO-Visualizer',
)

# macOS：生成可双击的 .app（拖入「应用程序」或从 DMG 安装）
if sys.platform == 'darwin':
    app = BUNDLE(
        coll,
        name='COCO-Visualizer.app',
        bundle_identifier='com.cocovisualizer.app',
        info_plist={
            'CFBundleName': 'COCO Visualizer',
            'CFBundleDisplayName': 'COCO Visualizer',
            'CFBundleShortVersionString': '1.0.0',
            'CFBundleVersion': '1.0.0',
            'NSHighResolutionCapable': True,
        },
    )
