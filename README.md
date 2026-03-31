# COCOVisualizer 完整用户手册

COCOVisualizer 是一个面向目标检测场景的可视化与标注修正平台，支持：
- COCO 数据集加载与浏览
- GT/预测同屏对比与联动分析
- 交互式打标、修框、回滚、导出
- Agent 智能筛选、统计与自动化操作

---

## 1. 快速启动

### 1.1 安装依赖

```bash
pip install -r requirements.txt
```

### 1.2 启动服务

```bash
python3 app.py
```

默认地址：`http://localhost:6009`

---

## 2. 你可以完成哪些事

- 浏览整个数据集，按多条件筛选问题图
- 查看 GT 与预测结果，快速定位误检/漏检
- 进入标注模式，直接增删改框并保存回 COCO
- 维护图片级分类（如误检类型、置信度分层）
- 在 EDA 页面做分布分析
- 用 Agent 自动筛图、生成统计、导出结果

---

## 3. COCO JSON 加载规范（重点）

### 3.1 最小可用模板（推荐起步）

```json
{
  "images": [
    {
      "id": 1,
      "file_name": "images/0001.jpg",
      "width": 1920,
      "height": 1080
    }
  ],
  "annotations": [
    {
      "id": 1,
      "image_id": 1,
      "category_id": 1,
      "bbox": [100, 200, 300, 150],
      "area": 45000,
      "iscrowd": 0
    }
  ],
  "categories": [
    { "id": 1, "name": "defect" }
  ]
}
```

### 3.2 字段说明（必须掌握）

- `images[].id`：图片唯一 ID（必须唯一）
- `images[].file_name`：图片路径（可相对可绝对）
- `images[].width/height`：建议提供，提升显示与缩放准确性
- `annotations[].image_id`：必须能关联到 `images[].id`
- `annotations[].bbox`：`[x, y, w, h]`，单位像素
- `annotations[].category_id`：必须存在于 `categories[].id`
- `categories[]`：类别字典，`id/name` 必须完整

### 3.3 路径配置建议

- 如果 `file_name` 是相对路径，请在加载时填写图片根目录 `image_dir`
- 如果 `file_name` 已是可访问绝对路径，`image_dir` 可留空
- 路径尽量统一风格，避免同数据集中混用多种根目录

### 3.4 常见加载失败原因

- `image_id` 无法映射到 `images`
- `category_id` 在 `categories` 中不存在
- `bbox` 非法（宽高 <= 0 或字段缺失）
- 图片文件实际不存在或目录配置错误

---

## 4. 页面与完整工作流

### 4.1 加载页（Load）

推荐流程：
1. 选择 COCO JSON 路径
2. 选择图片目录（可选）
3. 填写数据集名
4. 点击加载

加载后会进入图库页并可继续进入看图与 EDA。

### 4.2 图库页（Gallery）

你可以在图库页完成：
- 关键词检索、目录过滤、分类过滤
- GT 数量/预测数量/文件属性排序
- 批量选择图片并打图片级分类
- 高级筛选（硬例定位）

### 4.3 看图页（Viewer）

关键能力：
- 滚轮缩放、拖拽平移、全屏
- 左侧预测栏 + 右侧 GT/编辑栏（按数据自动显示）
- GT 与预测置信度独立阈值
- GT/预测侧栏 IoU 联动高亮
- 对比模式（GT vs 预测）

### 4.4 标注模式（Annotate）

进入方式：双击图片或点击 `✏️ 标注`。

可执行操作：
- 新建框、删除框、修改框类别
- 框坐标微调（键盘/面板）
- 接受预测框为 GT（单个或全部）
- 撤销/重做
- 自动保存与手动保存

### 4.5 EDA（数据分析）

包含：
- 类别分布
- 尺寸分布
- 空间分布
- 密度分析

用于快速判断数据偏态、长尾、尺度不均衡等问题。

---

## 5. Agent 使用方法（重点，不讲函数细节）

### 5.1 Agent 能做什么

- 自动筛选目标图片并跳转画廊
- 自动统计类别、尺寸、误检/漏检分布
- 生成表格/图表与导出文件
- 调用已导入技能（Skills）完成专项任务

### 5.2 最推荐的提问模板

直接描述“目标 + 条件 + 输出格式”，例如：

- “筛出预测框数量>10 且包含漏检类别的图片，并在画廊只显示这些图。”
- “统计每个类别的 GT 数量、预测数量、误检率，输出表格并导出 CSV。”
- “帮我找出低置信度误检最多的 50 张图并打上图片分类。”

### 5.3 Skills 怎么用（用户视角）

你不需要记函数名，按这个方式即可：
1. 在 Agent 技能管理里导入/启用技能
2. 可将技能“固定到对话”
3. 提示中写清楚要调用哪一个技能、输入是什么、输出要什么

示例：
- “使用 `magic-fox-model-validation`，对这批图片做验证并输出报告到指定目录。”
- “使用训练模型拉取技能，按给定 URL 生成 CSV 并返回文件路径。”

---

## 6. 图片级分类使用规范

- 默认提供一组分类（可在设置里改）
- 若当前 COCO 中已有 `image_category_definitions`，优先按数据集定义加载
- 分类编辑仅作用于当前数据集，并写回当前 COCO，不改全局默认
- 支持单选或多选模式（按设置切换）

---

## 7. 保存、版本与导出

### 7.1 保存

- 保存会把当前修改写回 COCO
- 建议每轮修订填写版本说明，便于审计与回溯

### 7.2 版本回滚

- 版本面板可查看历史版本
- 可一键回滚到指定版本

### 7.3 导出

- 按图片分类导出 ZIP
- 导出可用于训练集拆分、复盘、质检复查

---

## 8. 常见问题

- **看不到图片**：先检查 `image_dir` 与 `file_name` 的拼接路径是否真实存在
- **加载慢**：大数据集属正常，建议先用子集验证
- **预测不显示**：检查预测 COCO 是否按约定命名与字段完整
- **筛选结果异常**：确认是否同时叠加了多个筛选条件
- **团队复现困难**：统一路径规范、分类规范与提示词模板

---

## 9. API（开发者）

### POST /api/upload
上传 COCO JSON 文件

### POST /api/load_dataset
加载单个数据集

### POST /api/get_filtered_data
按条件获取筛选结果

### POST /api/list_server_paths
浏览服务器路径

---

## 10. 技术栈

- 后端：Flask / Python
- 前端：React / JS / CSS
- 可视化：Plotly.js

---

## 许可证

MIT License

### POST /api/upload
上传COCO JSON文件

**请求：** multipart/form-data
- `file`: COCO JSON文件

**响应：**
```json
{
  "success": true,
  "filename": "annotations.json",
  "filepath": "/path/to/file"
}
```

### POST /api/load_dataset
加载COCO数据集并返回所有可视化数据

**请求：**
```json
{
  "coco_json_path": "/path/to/annotations.json",
  "image_dir": "/path/to/images",
  "dataset_name": "dataset"
}
```

**响应：**
```json
{
  "success": true,
  "dataset_id": "dataset_0",
  "dataset_name": "dataset",
  "num_images": 100,
  "num_annotations": 500,
  "num_categories": 10,
  "categories": ["cat1", "cat2", ...],
  "class_distribution_pie": {...},
  "class_counts": {...},
  "category_data": {...},
  "all_categories_stats": {...}
}
```

### POST /api/get_filtered_data
根据筛选条件返回过滤后的数据

**请求：**
```json
{
  "dataset_id": "dataset_0",
  "selected_categories": ["cat1", "cat2"]
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "area": {...},
    "sqrt_area": {...},
    ...
  }
}
```

### POST /api/list_server_paths
列出服务器路径

**请求：**
```json
{
  "base_path": "/root"
}
```

**响应：**
```json
{
  "success": true,
  "items": [
    {"name": "folder", "path": "/root/folder", "is_dir": true, "is_file": false},
    {"name": "file.json", "path": "/root/file.json", "is_dir": false, "is_file": true}
  ],
  "current_path": "/root"
}
```

## 技术栈

- **后端：** Flask, Python
- **前端：** HTML5, CSS3, JavaScript (Vanilla)
- **图表库：** Plotly.js 2.26.0
- **数据处理：** pandas, numpy
- **数据分析：** coco-eda工具集

## 目录结构

```
coco-visualizer/
├── app.py                 # Flask应用主文件
├── requirements.txt       # Python依赖
├── README.md             # 说明文档
├── USAGE.md              # 使用示例
├── run.sh                # 启动脚本
├── templates/
│   └── index.html        # 前端 HTML 模板（React 单页）
├── static/
│   ├── react-app.jsx     # React 前端逻辑
│   ├── react-app.css     # 样式
│   └── config.json       # 前端配置
└── uploads/              # 上传文件存储目录（自动创建）
```

## 可视化类别说明

### 类别分布
- 快速了解数据集中各类别的占比和数量
- 饼图直观显示比例关系
- 柱状图便于对比数量差异

### 尺寸分析
- 全面分析标注框的尺寸特征
- 箱线图展示分布情况，包括中位数、四分位数、异常值
- 帮助识别尺寸分布模式

### 空间分布
- 分析标注在图像中的空间位置
- 散点图显示中心点分布
- 可启用等距坐标轴保持空间比例

### 密度分析
- 深入分析单个类别的指标分布
- 直方图显示密度分布
- 支持多种指标选择

## 注意事项

1. **数据加载**：大型数据集加载可能需要一些时间，请耐心等待
2. **浏览器兼容性**：推荐使用现代浏览器（Chrome、Firefox、Edge等）
3. **等距坐标轴**：主要适用于散点图类型的可视化
4. **筛选功能**：筛选后所有图表会重新渲染，可能需要一些时间
5. **内存使用**：大数据集可能占用较多浏览器内存

## 更新日志

### v2.0.0
- ✨ 重构为前端绘图架构
- ✨ 使用Plotly.js实现交互式图表
- ✨ 一次性生成所有可视化
- ✨ 按类别拆分可视化标签页
- ✨ 支持密度分布图
- ✨ 动态筛选功能

### v1.0.0
- 初始版本
- 后端生成图片
- 基础可视化功能

## 许可证

MIT License
