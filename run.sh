#!/bin/bash
# COCO数据集可视化工具启动脚本

cd "$(dirname "$0")"

echo "=========================================="
echo "COCO数据集可视化工具"
echo "=========================================="
echo ""

# 检查Python环境
if ! command -v python3 &> /dev/null; then
    echo "错误: 未找到Python3"
    exit 1
fi

# 检查依赖
echo "检查依赖..."
if ! python3 -c "import flask" 2>/dev/null; then
    echo "正在安装依赖..."
    pip install -r requirements.txt
fi

# 创建必要的目录
mkdir -p uploads
mkdir -p static
mkdir -p templates

echo ""
echo "启动Flask应用..."
echo "请在浏览器中访问: http://127.0.0.1:6010 或 http://localhost:6010"
echo "（不要使用 0.0.0.0，该地址仅用于服务绑定）"
echo "按 Ctrl+C 停止服务"
echo ""

python3 app.py
