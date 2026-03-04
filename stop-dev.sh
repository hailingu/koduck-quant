#!/bin/bash
# ==========================================
# Koduck Quant 开发环境停止脚本
# ==========================================

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}停止 Koduck Quant 服务...${NC}"

# 停止前端
echo -e "${YELLOW}⚛️  停止前端...${NC}"
if [ -f /tmp/frontend.pid ]; then
    kill $(cat /tmp/frontend.pid) 2>/dev/null || true
    rm -f /tmp/frontend.pid
fi
pkill -f "vite" 2>/dev/null || true

# 停止后端
echo -e "${YELLOW}☕ 停止后端...${NC}"
if [ -f /tmp/backend.pid ]; then
    kill $(cat /tmp/backend.pid) 2>/dev/null || true
    rm -f /tmp/backend.pid
fi
pkill -f "koduck-backend" 2>/dev/null || true

# 停止 Docker 服务
echo -e "${YELLOW}🐳 停止 Docker 服务...${NC}"
docker-compose down

echo ""
echo -e "${GREEN}✅ 所有服务已停止${NC}"
