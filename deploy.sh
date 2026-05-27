#!/bin/bash
# 快递柜系统部署脚本
# 先检测 TypeScript 错误，确认无误后再构建
#
# 快捷命令配置（Linux/macOS）：
#   echo "alias kd='~/maps-kd/deploy.sh'" >> ~/.bashrc && source ~/.bashrc
#   echo "alias kd='~/maps-kd/deploy.sh'" >> ~/.zshrc  && source ~/.zshrc
#
set -e

# ANSI 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

# 项目目录检测
PROJECT_DIR="${MAPS_KD_DIR:-$HOME/maps-kd}"
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}❌ 目录 $PROJECT_DIR 不存在${NC}"
    echo -e "${YELLOW}💡 可通过环境变量 MAPS_KD_DIR 设置项目路径${NC}"
    read -p "   请输入项目路径: " PROJECT_DIR
    if [ ! -d "$PROJECT_DIR" ]; then
        echo -e "${RED}❌ 目录 $PROJECT_DIR 无效，退出${NC}"
        exit 1
    fi
fi

echo -e "${CYAN}=========================================${NC}"
echo -e "${CYAN}  快递柜管理系统 - 部署脚本${NC}"
echo -e "${CYAN}=========================================${NC}"
echo ""
echo "  1) 完整构建部署（git pull + TS检查 + Docker构建）"
echo "  2) 仅 TypeScript 检查（git pull + tsc --noEmit）"
echo "  3) 查看运行状态（docker ps + 日志）"
echo "  4) 查看容器日志（实时跟踪）"
echo "  5) 重启服务"
echo "  6) 数据库备份"
echo ""
read -p "  请选择 [1-6]: " choice
echo ""

cd "$PROJECT_DIR" || { echo -e "${RED}❌ 无法进入目录 $PROJECT_DIR${NC}"; exit 1; }

# Docker 服务检测
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker 服务未运行，请先启动 Docker${NC}"
    exit 1
fi

# 选项 3: 查看运行状态
if [ "$choice" = "3" ]; then
    echo -e "${GREEN}→ 容器状态${NC}"
    docker ps --filter "name=cabinet" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    echo -e "${GREEN}→ 最近 20 行日志${NC}"
    docker compose logs --tail=20
    echo ""
    echo -e "${CYAN}=========================================${NC}"
    exit 0
fi

# 选项 4: 查看容器日志
if [ "$choice" = "4" ]; then
    echo -e "${GREEN}→ 实时日志（Ctrl+C 退出）${NC}"
    docker compose logs -f
    exit 0
fi

# 选项 5: 重启服务
if [ "$choice" = "5" ]; then
    echo -e "${GREEN}→ 重启服务${NC}"
    docker compose restart
    echo -e "${GREEN}✅ 服务已重启${NC}"
    echo -e "${CYAN}=========================================${NC}"
    exit 0
fi

# 选项 6: 数据库备份
if [ "$choice" = "6" ]; then
    BACKUP_DIR="./backups"
    mkdir -p "$BACKUP_DIR"
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    BACKUP_FILE="$BACKUP_DIR/cabinet_$TIMESTAMP.db"
    if [ -f "./server/data/cabinet.db" ]; then
        cp "./server/data/cabinet.db" "$BACKUP_FILE"
        echo -e "${GREEN}✅ 数据库已备份到 $BACKUP_FILE${NC}"
    else
        echo -e "${YELLOW}⚠️  未找到数据库文件 ./server/data/cabinet.db${NC}"
    fi
    echo -e "${CYAN}=========================================${NC}"
    exit 0
fi

# 选项 1/2: 需要先拉代码和 TS 检查
echo -e "${GREEN}→ 拉取最新代码${NC}"
git pull

echo ""
echo -e "${GREEN}→ TypeScript 类型检查${NC}"
cd client
if npx tsc --noEmit 2>&1; then
    echo -e "${GREEN}✅ 类型检查通过${NC}"
else
    echo ""
    echo -e "${RED}❌ 存在 TypeScript 错误，中止操作！${NC}"
    echo "   修复后重新运行脚本。"
    exit 1
fi
cd ..

if [ "$choice" = "1" ]; then
    # 磁盘空间检查
    AVAIL=$(df -h . | awk 'NR==2 {print $4}')
    echo ""
    echo -e "${YELLOW}→ 磁盘可用空间: $AVAIL${NC}"
    echo ""
    read -p "   确认构建部署？按 Enter 继续，Ctrl+C 取消: "

    echo ""
    echo -e "${GREEN}→ Docker 构建并部署${NC}"
    sudo docker compose up -d --build
    echo ""
    echo -e "${GREEN}✅ 部署完成！${NC}"
else
    echo ""
    echo -e "${GREEN}✅ 类型检查通过，未执行构建。${NC}"
fi
echo -e "${CYAN}=========================================${NC}"
