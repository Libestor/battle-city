#!/bin/bash

# 坦克大战联机功能快速启动脚本

echo "🎮 坦克大战联机功能启动脚本"
echo "================================"

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未检测到Node.js，请先安装Node.js"
    exit 1
fi

echo "✅ Node.js版本: $(node -v)"

# 启动后端服务器
echo ""
echo "📡 启动WebSocket服务器..."
cd server

# 检查依赖是否安装
if [ ! -d "node_modules" ]; then
    echo "📦 安装服务器依赖..."
    npm install
fi

# 构建服务器
echo "🔨 构建服务器..."
npm run build

# 启动服务器（后台运行）
echo "🚀 启动服务器..."
npm start &
SERVER_PID=$!

echo "✅ 服务器已启动 (PID: $SERVER_PID)"
echo "   服务器地址: http://localhost:3001"

# 返回根目录
cd ..

# 启动前端应用
echo ""
echo "🎨 启动前端应用..."

# 检查依赖是否安装
if [ ! -d "node_modules" ]; then
    echo "📦 安装前端依赖..."
    npm install
fi

echo "🚀 启动前端..."
echo ""
echo "================================"
echo "✅ 启动完成！"
echo ""
echo "📝 使用说明:"
echo "   1. 在浏览器中打开 http://localhost:8080"
echo "   2. 选择 'ONLINE' 进入联机模式"
echo "   3. 创建房间或加入房间"
echo ""
echo "⚠️  停止服务:"
echo "   按 Ctrl+C 停止前端"
echo "   运行 'kill $SERVER_PID' 停止服务器"
echo "================================"
echo ""

# 启动前端
npm start
