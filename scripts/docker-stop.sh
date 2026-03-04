#!/bin/bash
# ==========================================
# Koduck Quant Docker Stop Script
# ==========================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}停止 Koduck Quant 服务...${NC}"

# Check for flags
if [ "$1" = "-vmi" ] || [ "$1" = "--volumes-images" ]; then
    echo -e "${RED}⚠️ 警告: 这将删除所有数据卷和镜像！${NC}"
    read -p "确定要继续吗? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker-compose down -v --rmi all
        echo -e "${GREEN}✅ 服务已停止，数据卷和镜像已删除${NC}"
    else
        echo -e "${YELLOW}已取消${NC}"
        exit 0
    fi
elif [ "$1" = "-v" ] || [ "$1" = "--volumes" ]; then
    echo -e "${RED}⚠️ 警告: 这将删除所有数据卷！${NC}"
    read -p "确定要继续吗? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker-compose down -v
        echo -e "${GREEN}✅ 服务已停止，数据卷已删除${NC}"
    else
        echo -e "${YELLOW}已取消${NC}"
        exit 0
    fi
else
    docker-compose down
    echo -e "${GREEN}✅ 服务已停止${NC}"
fi
