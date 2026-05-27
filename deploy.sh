#!/bin/bash
# 快递柜系统部署脚本
# 先检测 TypeScript 错误，无错误再执行 Docker 构建部署
set -e

echo "========================================="
echo "  快递柜管理系统 - 安全部署脚本"
echo "========================================="

cd ~/maps-kd || { echo "❌ 目录 ~/maps-kd 不存在"; exit 1; }

echo ""
echo "→ 第1步：拉取最新代码"
git pull
echo "✅ 代码已更新"

echo ""
echo "→ 第2步：检测前端 TypeScript 类型错误"
cd client
if npx tsc --noEmit 2>&1; then
    echo "✅ TypeScript 类型检查通过"
else
    echo ""
    echo "❌ 检测到 TypeScript 错误，中止部署！"
    echo "   请先修复上述错误后再运行部署。"
    exit 1
fi
cd ..

echo ""
echo "→ 第3步：Docker 构建并部署"
sudo docker compose up -d --build

echo ""
echo "✅ 部署完成！"
echo "   服务地址: http://$(curl -s ifconfig.me || echo 'localhost'):3000"
echo "========================================="
