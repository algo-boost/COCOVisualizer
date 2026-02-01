# 环境安装与启动说明

本应用基于 **Python 3** 和 **Flask**，需要先安装 Python 及依赖，并确保 **coco-eda** 模块可用。

---

## 一、安装 Python（Windows）

若系统尚未安装 Python：

1. **下载 Python**
   - 打开 [https://www.python.org/downloads/](https://www.python.org/downloads/)
   - 下载 **Python 3.8 或更高版本**（推荐 3.10 或 3.11）的 Windows 安装包

2. **安装时务必勾选**
   - ✅ **Add Python to PATH**
   - 可选：**Install pip**

3. **验证安装**  
   重新打开 PowerShell 或命令提示符，执行：
   ```powershell
   python --version
   pip --version
   ```

若已通过 **winget** 安装 Python，可直接：
```powershell
winget install Python.Python.3.11
```

---

## 二、创建虚拟环境并安装依赖（推荐）

在项目根目录（`coco-visualizer` 文件夹内）执行：

```powershell
# 进入项目目录
cd "c:\Users\Administrator\Desktop\coco-visualizer\coco-visualizer"

# 创建虚拟环境（仅首次需要）
python -m venv .venv

# 激活虚拟环境
.\.venv\Scripts\Activate.ps1

# 安装依赖
pip install -r requirements.txt
```

若 PowerShell 禁止执行脚本，可先执行：
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 三、coco-eda 依赖说明

应用依赖 **coco-eda** 中的 `CocoEDA` 类（`coco_eda_utils`）。需保证以下**任一**位置存在该模块：

| 方式 | 路径说明 |
|------|-----------|
| **A. 同级目录** | 在 `coco-visualizer` 的**上一级**目录下存在 `coco-eda` 文件夹，且其中有 `coco_eda_utils.py`（或包含 `CocoEDA` 的包）。 |
| **B. 项目内目录** | 在**本项目目录内**创建 `coco_eda` 文件夹，将 `coco_eda_utils.py` 放在其中。 |

目录结构示例：

```
# 方式 A：与 coco-visualizer 同级
Desktop\coco-visualizer\
  coco-visualizer\    ← 本应用
  coco-eda\          ← 需包含 coco_eda_utils.py

# 方式 B：放在本应用内
coco-visualizer\
  app.py
  coco_eda\          ← 需包含 coco_eda_utils.py
    coco_eda_utils.py
```

若你从零开始，需要自行实现或从内部仓库获取 `coco_eda_utils`（提供 `CocoEDA` 及 `compute_bbox_features`、`get_class_distribution` 等接口）。

---

## 四、启动应用

依赖和 coco-eda 就绪后：

```powershell
# 若未激活虚拟环境，先激活
.\.venv\Scripts\Activate.ps1

# 启动
python app.py
```

或使用脚本（需在脚本内指定使用项目中的 Python/venv）：

```powershell
.\run.ps1
```

启动成功后，在浏览器访问：**http://localhost:6009**

---

## 五、一键安装脚本（PowerShell）

已提供 `setup.ps1`，在**已安装 Python** 的前提下可自动完成虚拟环境创建与依赖安装：

```powershell
cd "c:\Users\Administrator\Desktop\coco-visualizer\coco-visualizer"
.\setup.ps1
```

脚本会：

- 检查是否已安装 Python
- 创建 `.venv` 虚拟环境（若不存在）
- 执行 `pip install -r requirements.txt`
- 提示 coco-eda 的放置方式

**注意**：coco-eda 需你自行放置到上述 A 或 B 路径，脚本不会自动下载。

---

## 六、requirements.txt 依赖概览

| 包 | 用途 |
|----|------|
| Flask | Web 框架 |
| flask-cors | 跨域支持 |
| numpy, pandas | 数据处理 |
| matplotlib, seaborn | 图表（若后端生成图） |
| opencv-python | 图像相关功能 |

---

## 常见问题

**Q: 提示 “Python 不是内部或外部命令”**  
A: 未将 Python 加入 PATH，或安装后未重启终端。请重新安装并勾选 “Add Python to PATH”，或手动将 Python 安装目录加入系统 PATH。

**Q: 提示 “No module named 'coco_eda_utils'”**  
A: 按上文「三、coco-eda 依赖说明」将 `coco_eda_utils` 放在方式 A 或 B 的路径下。

**Q: 安装 opencv-python 很慢或失败**  
A: 可先尝试使用国内镜像：  
`pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple`
