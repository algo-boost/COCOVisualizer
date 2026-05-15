# COCOVisualizer

面向目标检测场景的 **COCO 数据浏览、GT/预测对比、标注修正、EDA 与 Agent 分析** 一体化本地 Web 工具。后端为 Flask（Blueprint + Service + Repository），前端为 React，生产环境可由 **Vite** 打包为静态资源；未打包时自动回退到模板内联的 Babel 模式。

---

## 下载安装包

[![GitHub release](https://img.shields.io/github/v/release/algo-boost/COCOVisualizer?label=latest&color=brightgreen)](https://github.com/algo-boost/COCOVisualizer/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/algo-boost/COCOVisualizer/total?color=blue)](https://github.com/algo-boost/COCOVisualizer/releases)

| 平台 | 推荐文件 | 下载入口 |
|------|----------|----------|
| **macOS**（Apple Silicon / Intel） | `COCO-Visualizer-mac-<版本>.dmg` | [GitHub Releases](https://github.com/algo-boost/COCOVisualizer/releases/latest) |
| **Windows 安装版** | `COCO-Visualizer-Setup-<版本>.exe` | [GitHub Releases](https://github.com/algo-boost/COCOVisualizer/releases/latest) |
| **Windows 免安装** | `COCO-Visualizer-Windows-x64-<版本>.zip` | [GitHub Releases](https://github.com/algo-boost/COCOVisualizer/releases/latest) |

> **macOS（推荐流程，无需管理员密码）**：打开 DMG → 双击 **「安装到用户应用程序.command」** → 按终端提示完成（会安装到 `~/Applications` 并尝试去掉隔离标记后启动）。若系统拦截脚本，对 `.command` **右键 → 打开 → 仍要打开** 一次即可。  
> **备选**：把 **COCO-Visualizer.app** 拖到右侧「应用程序」，再对应用 **右键 → 打开**。DMG 内另有 **「首次安装说明.txt」**。未做 Apple 开发者公证时，系统仍可能提示安全对话框，属正常现象。

### 国内镜像加速

GitHub 在国内访问可能较慢/不稳。直接把下载链接里的 `https://github.com/` 加上下列任一前缀即可大幅提速：

| 镜像 | URL 前缀 |
|------|----------|
| ghproxy（推荐） | `https://mirror.ghproxy.com/` |
| gh-proxy | `https://gh-proxy.com/` |
| ghps | `https://ghps.cc/` |

示例（拼接到原 GitHub URL 之前）：

```text
原始: https://github.com/algo-boost/COCOVisualizer/releases/latest
加速: https://mirror.ghproxy.com/https://github.com/algo-boost/COCOVisualizer/releases/latest
```

> 镜像稳定性会波动。首选 GitHub 官方，遇慢再换镜像。

### 应用内更新提示

应用启动后会在**右上角**自动检测是否有新版本（调用 `/api/app/check_update` → GitHub Releases API，结果缓存 30 分钟）：

- 有新版本时显示横幅，含 **macOS / Windows 直链**、**Release 详情**与**国内镜像**入口
- 点击横幅右上 `×` 关闭，关闭后该版本不再提示，**直到下一次发布**
- 可通过环境变量 `COCO_VIZ_UPDATE_REPO=owner/repo` 指向自托管仓库
- 检查超时由 `COCO_VIZ_UPDATE_TIMEOUT`（秒）控制，默认 **12**；仅「正式 Latest」不存在时（例如仓库只有 CI Pre-release）会自动改用 **releases 列表** 比对版本
- 国内若 **api.github.com** 不可达，可设 **`COCO_VIZ_GITHUB_API_BASE=https://mirror.ghproxy.com/https://api.github.com`**（或你信任的 API 反代根 URL，勿尾斜杠）后重启后端

---

## 功能概览

- 多目录合并扫描与单文件加载 COCO
- **预测结果自动挂载**（与 GT 同屏对比、置信度阈值、IoU 联动、+GT 接受）
- 图库筛选、代码筛选、批量图片级分类
- 查看器缩放平移、对比模式、缩略图导航
- 标注模式：画框 / 选框、撤销重做、跨图复制粘贴
- EDA（Plotly）与 AI Chat（沙箱执行 Python）
- 版本快照与按分类 / train–valid 导出 ZIP

---

## 预测结果加载（核心约定）

无需在界面里单独「选预测文件」。将预测 COCO 与 **GT 主文件放在同一目录**，按固定文件名即可，**重新加载数据集**后自动识别。

**命名规则：**

```text
_annotations.<模型名>.pred.coco.json
```

**示例：**

```text
my_dataset/
├── _annotations.coco.json                 ← GT（加载时指向的主 JSON）
├── _annotations.yolov8.pred.coco.json    ← 预测，UI 中显示为模型 yolov8
└── _annotations.rtdetr.pred.coco.json   ← 可多模型并存
```

预测文件为标准 COCO JSON；`annotations` 中建议带 **`score`**（0–1）以便置信度过滤。`images[].file_name` 与 GT 通过 **basename** 对齐（目录前缀可不一致）。

实现参考：`backend/services/image_service.py`（`find_pred_files` / `load_pred_annotations`）与 `backend/config.py` 中的 `PRED_ANNOTATION_PATTERN`。

---

## 快速启动

```bash
pip install -r requirements.txt
python app.py
```

- 默认端口 **6010**（可用 `--port` 或环境变量 `COCO_VIZ_PORT`）
- 开发源码默认**不**自动打开浏览器；打包版或加 `--open-browser` 会打开
- 访问：`http://127.0.0.1:6010`

### 命令行全局安装（`coco-viz`）

仓库根目录含 **`pyproject.toml`**，支持用 **可编辑模式** 安装后，在终端直接运行 **`coco-viz`**（与 `python app.py` 等价）：

```bash
cd /path/to/COCOVisualizer
pip install -e .
# 或隔离到独立环境（推荐）：
pipx install -e .
```

```bash
coco-viz                  # 默认端口 6010
coco-viz --port 8080
coco-viz --open-browser   # 启动后自动打开浏览器
coco-viz --no-browser     # 不自动打开（与源码默认一致）
```

**说明**：必须使用 **`pip install -e .` / `pipx install -e .`**（带 `-e`）。纯 `pip install .` 打成的 wheel **不会**带上 `templates/`、`static/` 等资源，启动时会报错退出。

可选：拉取 Plotly 等 vendor 脚本（离线/内网环境）：

```bash
python packaging/fetch_vendor_js.py
```

---

## 前端生产构建（Vite）

存在 `static/dist/.vite/manifest.json` 时，Flask 模板会加载 Vite 产物；否则使用 `static/react-app.jsx` 的浏览器内 Babel 方案。

```bash
cd frontend && npm install && npm run build
```

构建输出写入 `static/dist/`。macOS 应用打包脚本可通过 `BUILD_VITE=1` 在打包前执行上述构建（详见 `scripts/build_mac_app.sh`）。

开发热重载（后端仍用 `python app.py --port 6010`）：

```bash
cd frontend && npm run dev
```

---

## 文档

| 文档 | 说明 |
|------|------|
| [docs/用户手册.md](docs/用户手册.md) | 完整产品说明；**应用内「❓ 帮助」与本文件同源**（后端渲染，打包时一并内置） |
| 应用内 **❓ 帮助** | 与手册同步的精简版目录（左侧导航） |

其他：`BUILD.md`（构建）、`SETUP.md`（环境）、`USAGE.md`（示例）、`IMAGE_VIEWER.md`（看图细节）。

---

## 目录结构（摘要）

```text
├── app.py                    # 入口：create_app + 启动参数
├── backend/                  # Flask 应用工厂、Blueprint、Service、Repository
├── frontend/                 # Vite + React（main.jsx → LegacyApp.jsx）
├── static/dist/              # Vite 构建产物（gitignore，可选）
├── static/react-app.jsx      # 未构建时的 Babel 回退前端
├── static/react-app.css      # 未构建时的样式回退
├── static/config.json        # LLM 等配置（示例见仓库内文件）
├── templates/index.html      # 根据 manifest 选择 Vite 或 Babel
├── docs/用户手册.md
├── pyproject.toml            # pip/pipx 可编辑安装，入口 coco-viz
├── scripts/                  # run / 打包 / 启动辅助
├── coco_visualizer.spec      # PyInstaller
└── requirements.txt
```

---

## 技术栈

- **后端：** Python 3.10+、Flask、线程安全的数据集状态与 Agent 沙箱
- **前端：** React、Vite（可选生产包）、Plotly.js、JSZip（vendor 见 `static/vendor/`）

---

## 许可证

MIT License
