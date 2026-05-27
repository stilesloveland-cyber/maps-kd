#!/bin/bash

# =============================================
#   快递柜可视化地图管理系统 - 部署脚本
#   支持 Linux / macOS
#
#   最简单的方式（无需此脚本）：
#     git clone https://github.com/stilesloveland-cyber/maps-kd.git
#     cd maps-kd
#     sudo docker compose up -d
#
#   如需交互式配置（端口/密码/域名），使用本脚本：
#     chmod +x deploy.sh && ./deploy.sh
# =============================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}      ${CYAN}📦 快递柜可视化地图管理系统 - 一键部署${NC}     ${BLUE}║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ---- 检测环境 ----
echo -e "${YELLOW}▶ 第一步：检测服务器环境${NC}"

OS_TYPE=$(uname -s)
echo -e "   ✔ 系统: ${GREEN}$OS_TYPE $(uname -m)${NC}"

if command -v docker &> /dev/null; then
    DOCKER_VER=$(docker --version | cut -d ' ' -f3 | tr -d ',')
    echo -e "   ✔ Docker: ${GREEN}已安装 (v$DOCKER_VER)${NC}"
else
    echo -e "   ${RED}✘ Docker 未安装！请先安装 Docker: https://docs.docker.com/engine/install/${NC}"
    exit 1
fi

if command -v curl &> /dev/null; then
    PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "未知")
    echo -e "   ✔ 公网IP: ${GREEN}$PUBLIC_IP${NC}"
fi

echo ""

# ---- 端口配置 ----
echo -e "${YELLOW}▶ 第二步：端口配置${NC}"
read -p "   请输入服务端口号 [默认: 3000]: " PORT
PORT=${PORT:-3000}
echo -e "   ✔ 端口: ${GREEN}$PORT${NC}"
echo ""

# ---- 管理员密码 ----
echo -e "${YELLOW}▶ 第三步：管理员密码${NC}"
read -p "   请设置管理员密码 [默认: admin123]: " ADMIN_PW
ADMIN_PW=${ADMIN_PW:-admin123}
echo -e "   ✔ 密码已设置${NC}"
echo ""

# ---- JWT密钥 ----
JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "cabinet-manager-secret-$(date +%s)")
echo -e "   ✔ JWT密钥: ${GREEN}已自动生成${NC}"
echo ""

# ---- 域名配置 ----
echo -e "${YELLOW}▶ 第四步：域名配置（可选）${NC}"
read -p "   是否配置域名访问？(y/N): " HAS_DOMAIN
DOMAIN=""
if [[ "$HAS_DOMAIN" =~ ^[Yy]$ ]]; then
    read -p "   请输入域名 (如 kuaidi.example.com): " DOMAIN

    read -p "   是否通过 Cloudflare 托管？(Y/n): " CF_MODE
    if [[ "$CF_MODE" =~ ^[Nn]$ ]]; then
        echo -e "   ${YELLOW}💡 建议使用 Let's Encrypt 申请 SSL 证书：certbot --nginx -d $DOMAIN${NC}"
    else
        echo -e "   ${GREEN}✔ Cloudflare 模式${NC} — 请在 Cloudflare 面板将 SSL/TLS 设为 Flexible 或 Full"
    fi
    echo -e "   ✔ 域名: ${GREEN}$DOMAIN${NC}"
fi
echo ""

# ---- 生成 .env 文件 ----
echo -e "${YELLOW}▶ 第五步：生成配置文件${NC}"
cat > .env << EOF
PORT=$PORT
ADMIN_PASSWORD=$ADMIN_PW
JWT_SECRET=$JWT_SECRET
EOF
echo -e "   ✔ ${GREEN}.env${NC} 文件已生成"
echo ""

# ---- 确认部署 ----
echo -e "${YELLOW}▶ 第六步：确认部署${NC}"
echo -e "   ┌──────────────────────────────────────────────┐"
echo -e "   │  端口映射    ${CYAN}$PORT${NC} → 容器 3000"
echo -e "   │  数据目录    ${CYAN}./data${NC} (已挂载持久卷)"
echo -e "   │  镜像名称    ${CYAN}cabinet-manager:latest${NC}"
if [ -n "$DOMAIN" ]; then
    echo -e "   │  访问地址    ${CYAN}http://$DOMAIN${NC}"
else
    echo -e "   │  访问地址    ${CYAN}http://localhost:$PORT${NC}"
fi
echo -e "   └──────────────────────────────────────────────┘"
read -p "   确认部署？(Y/n): " CONFIRM
if [[ "$CONFIRM" =~ ^[Nn]$ ]]; then
    echo -e "${RED}   部署已取消${NC}"
    exit 0
fi
echo ""

# ---- 构建并启动 ----
echo -e "${YELLOW}▶ 第七步：开始部署${NC}"
echo -e "   ⏳ 构建 Docker 镜像..."
docker compose build -q 2>/dev/null || docker-compose build -q
echo -e "   ${GREEN}✔${NC} 镜像构建完成"

echo -e "   ⏳ 启动容器..."
docker compose up -d 2>/dev/null || docker-compose up -d
echo -e "   ${GREEN}✔${NC} 容器启动完成"
echo ""

# ---- 完成 ----
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}          ✅ 部署成功！                        ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}                                              ${GREEN}║${NC}"
if [ -n "$DOMAIN" ]; then
    echo -e "${GREEN}║${NC}     访问地址: ${CYAN}http://$DOMAIN${NC}                ${GREEN}║${NC}"
else
    echo -e "${GREEN}║${NC}     访问地址: ${CYAN}http://localhost:$PORT${NC}            ${GREEN}║${NC}"
fi
echo -e "${GREEN}║${NC}                                              ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}     管理后台: ${CYAN}/admin${NC}                          ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}     API文档: ${CYAN}/api-docs${NC}                         ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}                                              ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}     更简单的方式（下次部署直接）：                    ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}     ${CYAN}git clone https://github.com/stilesloveland-cyber/maps-kd.git${NC} ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}     ${CYAN}&& cd maps-kd && sudo docker compose up -d${NC}    ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}                                              ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}     管理命令:                                    ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}     查看日志: ${CYAN}docker compose logs -f${NC}            ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}     停止服务: ${CYAN}docker compose down${NC}               ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}     重启服务: ${CYAN}docker compose restart${NC}             ${GREEN}║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
