#!/bin/bash
# 快递柜系统部署脚本
# 先检测 TypeScript 错误，确认无误后再构建
set -e

echo "========================================="
echo "  快递柜管理系统 - 部署脚本"
echo "========================================="
echo ""
echo "  1) 完整构建部署（git pull + TS检查 + Docker构建）"
echo "  2) 仅 TypeScript 检查（git pull + tsc --noEmit）"
echo ""
read -p "  请选择 [1/2]: " choice
echo ""

cd ~/maps-kd || { echo "❌ 目录 ~/maps-kd 不存在"; exit 1; }

echo "→ 拉取最新代码"
git pull

echo ""
echo "→ TypeScript 类型检查"
cd client
if npx tsc --noEmit 2>&1; then
    echo "✅ 类型检查通过"
else
    echo ""
    echo "❌ 存在 TypeScript 错误，中止操作！"
    echo "   修复后重新运行脚本。"
    exit 1
fi
cd ..

if [ "$choice" = "1" ]; then
    echo ""
    echo "→ Docker 构建并部署"
    sudo docker compose up -d --build
    echo ""
    echo "✅ 部署完成！"
else
    echo ""
    echo "✅ 类型检查通过，未执行构建。"
fi
echo "========================================="
