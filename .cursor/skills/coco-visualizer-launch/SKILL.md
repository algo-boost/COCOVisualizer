---
name: coco-visualizer-launch
description: 从本仓库启动 COCOVisualizer（Flask），按目录或 COCO JSON 调用 /api/load_dataset 并打开浏览器。触发语包括「查看 xxx 目录 coco」「看下某路径的 coco」「打开目录 coco」——句末或句中的 coco 表示要在本工具里看该目录对应的 COCO 数据，而非泛泛聊天。
---

# COCOVisualizer 一键启动与加载

## 自然语言约定（必须遵守）
用户常说：**「查看 xxx 目录 coco」**、**「看下 xxx 的 coco」**、**「xxx 目录 coco 打开一下」**。

解析规则：
- **「xxx」** = 用户指的**数据集根目录**（含图片或同级/子级标注；可含 `_annotations.coco.json`，也可仅为图片目录由服务端补全）。
- 句子里出现 **「coco」**（大小写不敏感）且与**某个目录路径**同现时，一律视为：**用 COCOVisualizer 加载该目录并打开浏览器**，不要只回复文字说明而不执行。
- 若用户另说了**与标注不同的图片目录**，再传 `--image-dir`；否则**只传目录作为唯一位置参数**即可。

## 何时使用
- 用户给出**本地目录**或 **`_annotations.coco.json` / `merged_*.json`** 路径，希望在 **COCOVisualizer** 里查看。
- 用户说「启动可视化」「打开浏览器看 COCO」「用当前项目加载某路径」。
- **目录名 / 路径 + coco** 的任意口语组合（见上节）。

## 项目根目录
- 以**当前工作区**中本仓库根为准（包含 `app.py`、`scripts/coco_viz_launch.py` 的目录）。
- 若用户明确给出克隆路径，则使用该绝对路径作为 `cd` 目标。

## 推荐做法（单条命令）
在仓库根执行（将路径换成用户提供的绝对或 `~` 展开路径）：

```bash
python3 scripts/coco_viz_launch.py "<COCO目录或json路径>" --image-dir "<可选图片目录>"
```

说明：
- `coco_path` 可为**数据集目录**（其下可有 `_annotations.coco.json`；若缺失服务端会按现有逻辑处理）或 **JSON 文件**路径。
- `--image-dir` 仅在需要与 COCO 不同目录时传入；否则可省略。
- 若 **6010 端口已有本应用实例**，脚本会**复用**该实例：只执行加载并打开浏览器，不会再起第二个服务。
- 默认会打开浏览器；仅调试自动化时加 `--no-open-browser`。

## 备选：只起服务 + 手动加载
仅启动服务并自动打开首页（不预加载数据集）：

```bash
python3 app.py --open-browser --port 6010
```

仅改端口时可用环境变量：`COCO_VIZ_PORT=6011 python3 app.py`。

## 交付说明
向用户汇报：**本机访问地址**（一般为 `http://127.0.0.1:6010`）、**已加载的路径**、若为新起的进程则提示**如何停止**（结束对应 Python 进程）。

## 约束
- 必须在用户本机执行（需要打开用户图形环境里的浏览器）；不要在无法访问用户桌面的远程沙箱里假称已打开浏览器。
- 路径含空格时务必正确加引号。
