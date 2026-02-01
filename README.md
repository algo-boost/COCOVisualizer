# COCO数据集可视化工具

基于Flask和Plotly.js的交互式COCO数据集可视化平台，提供灵活的数据分析和动态可视化功能。

## ✨ 主要特性

### 🎨 前端交互式可视化
- **Plotly.js图表库**：所有图表在前端动态渲染，支持交互式操作
- **实时筛选**：选择类别后实时更新所有图表
- **等距坐标轴**：可切换x轴和y轴等距显示（适用于散点图）

### 📊 四大可视化类别

#### 1. 类别分布
- **饼图**：显示各类别在数据集中的占比
- **柱状图**：显示各类别的样本数量

#### 2. 尺寸分析
- **面积分布**：箱线图展示各类别面积分布
- **面积平方根分布**：sqrt(area)的箱线图
- **长边分布**：各类别最长边的分布
- **宽高比分布**：宽高比（w/h）的箱线图
- **长短边比分布**：长短边比例的箱线图
- **宽度和高度分布**：并排显示宽度和高度的分布

#### 3. 空间分布
- **中心点分布**：散点图显示所有标注的中心点位置
- **各类别bbox分布**：每个类别的bbox空间分布，颜色表示宽度

#### 4. 密度分析
- **单类别密度图**：选择特定类别和指标，查看密度分布
- **支持的指标**：
  - 面积、面积平方根
  - 长边、短边
  - 宽度、高度
  - 宽高比、长短边比

### 🚀 一次性生成
- 加载COCO文件后，**自动生成所有可视化图表**
- 无需逐个选择可视化类型
- 数据按类别组织，便于筛选和分析

### 🔍 灵活的筛选功能
- 多选类别进行筛选
- 应用筛选后，所有图表自动更新
- 支持全选/全不选快捷操作

## 安装和运行

### 1. 安装依赖

```bash
cd /root/cv-scripts/coco-visualizer
pip install -r requirements.txt
```

### 2. 运行应用

```bash
python3 app.py
```

或使用启动脚本：

```bash
./run.sh
```

应用将在 `http://0.0.0.0:6009` 启动。

### 3. 访问界面

在浏览器中打开 `http://localhost:6009` 或 `http://your-server-ip:6009`

## 使用说明

### 加载数据集

1. **方式1：上传文件**
   - 将COCO JSON文件拖拽到上传区域
   - 或点击上传区域选择文件

2. **方式2：选择服务器路径**
   - 在"服务器路径"输入框中输入路径
   - 点击"浏览"按钮浏览服务器目录
   - 选择COCO JSON文件

3. **设置图片目录（可选）**
   - 如果COCO文件中的图片路径是相对路径，需要指定图片目录

4. **设置数据集名称**
   - 输入一个名称用于标识数据集

5. **点击"加载数据集并生成可视化"**
   - 系统会自动加载数据并生成所有可视化图表
   - 加载完成后，会显示在主界面

### 使用可视化

1. **切换标签页**
   - 点击顶部的标签页按钮切换不同的可视化类别
   - 每个标签页包含相关的多个图表

2. **筛选数据**
   - 在左侧面板中选择要显示的类别（可多选）
   - 点击"应用筛选"按钮
   - 所有图表会自动更新为筛选后的数据

3. **查看密度分布**
   - 切换到"密度分析"标签页
   - 选择类别和指标
   - 查看该类别在该指标上的密度分布图

4. **交互式操作**
   - 所有图表支持缩放、平移、悬停查看详情
   - 点击图例可以显示/隐藏特定类别
   - 双击图表可以重置视图

## API接口

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
