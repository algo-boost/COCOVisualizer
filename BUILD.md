# COCO Visualizer 打包说明

本文档说明如何将 COCO Visualizer 打包成可在 Windows、macOS 和 Linux 上运行的独立安装包。

## 环境要求

- **Python 3.8+**
- **依赖已安装**：`pip install -r requirements.txt`
- **PyInstaller**（打包脚本会自动安装）

## 快速开始

### Windows

```powershell
# 基础打包（生成 dist/COCO-Visualizer/ 和 ZIP 压缩包）
.\packaging\build.ps1

# 生成 .exe 安装包（需预先安装 Inno Setup 6）
.\packaging\build.ps1 -CreateInstaller
```

### macOS / Linux

```bash
chmod +x packaging/build.sh
./packaging/build.sh

# 可选：尝试生成安装包（macOS: DMG, Linux: 需额外工具）
./packaging/build.sh --installer
```

## 输出产物

| 平台 | 输出目录 | 压缩包 | 可选安装包 |
|------|----------|--------|------------|
| Windows | `dist/COCO-Visualizer/` | `COCO-Visualizer-Windows-x64-{version}.zip` | Inno Setup `.exe` |
| macOS | `dist/COCO-Visualizer/` | `COCO-Visualizer-macOS-{arch}-{version}.zip` | DMG（需 create-dmg） |
| Linux | `dist/COCO-Visualizer/` | `COCO-Visualizer-Linux-{arch}-{version}.tar.gz` | AppImage（需 linuxdeploy） |

## 用户使用方式

1. **ZIP / 压缩包**：解压后进入 `COCO-Visualizer` 目录，双击运行可执行文件：
   - Windows: `COCO-Visualizer.exe`
   - macOS/Linux: `./COCO-Visualizer`

2. **Windows 安装包**：运行 `COCO-Visualizer-Setup-x.x.x.exe`，按向导安装，完成后可从开始菜单或桌面快捷方式启动。

3. 首次运行会自动打开浏览器，访问地址见控制台输出（默认 `http://127.0.0.1:6010`）。

## 版本号

在项目根目录创建 `version.txt`，写入版本号（如 `1.0.0`），打包时会自动使用。

## Windows 安装包（Inno Setup）

若要生成 `.exe` 安装程序：

1. 下载并安装 [Inno Setup 6](https://jrsoftware.org/isinfo.php)
2. 执行：`.\packaging\build.ps1 -CreateInstaller`
3. 安装包输出到 `dist/COCO-Visualizer-Setup-x.x.x.exe`

## macOS DMG（可选）

```bash
brew install create-dmg
./packaging/build.sh --installer
```

## Linux AppImage（可选）

需要 [linuxdeploy](https://github.com/linuxdeploy/linuxdeploy) 及对应插件，可参考其文档在 PyInstaller 输出基础上生成 AppImage。

## 注意事项

- 打包后的 `data/` 和 `uploads/` 目录会在可执行文件所在目录下自动创建，**需保证该目录有写权限**（建议解压到用户目录后运行，勿放在只读或系统保护目录）。
- 若需隐藏 Windows 控制台窗口，可修改 `coco_visualizer.spec` 中 `console=False`。
- 跨平台打包需在对应系统上执行（无法在 Windows 上打包 Mac 版本）。
- **spec 中不可排除 PIL/Pillow**：应用用其读取图片尺寸，排除会导致运行时报 `ImportError`。
- **离线使用**：前端依赖（React/Babel/Plotly/JSZip）已改为从本地 `static/vendor/` 加载，打包前会自动执行 `python3 packaging/fetch_vendor_js.py` 拉取。若打包时未联网，请先在有网环境运行一次该脚本，再执行打包，这样生成的程序可完全离线运行。
