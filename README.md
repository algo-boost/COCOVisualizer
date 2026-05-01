# COCOVisualizer

面向目标检测场景的 **COCO 数据浏览、GT/预测对比、标注修正、EDA 与 Agent 分析** 一体化本地 Web 工具。后端为 Flask（Blueprint + Service + Repository），前端为 React，生产环境可由 **Vite** 打包为静态资源；未打包时自动回退到模板内联的 Babel 模式。

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
| [docs/用户手册.md](docs/用户手册.md) | 完整产品说明：安装、加载、预测、图库、查看器、EDA、Agent、导出、版本、设置、FAQ |
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
