#!/bin/bash
# ==========================================
# Koduck Quant Docker Status Script
# ==========================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}  Koduck Quant 服务状态${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

# Service status
echo -e "${YELLOW}容器状态：${NC}"
docker-compose ps

echo ""
echo -e "${YELLOW}资源使用：${NC}"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.PIDs}}"

echo ""
echo -e "${YELLOW}服务健康检查：${NC}"

# Check backend
if curl -s http://localhost:8080/actuator/health > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅ 后端服务 (localhost:8080)${NC}"
else
    echo -e "  ❌ 后端服务 (localhost:8080)"
fi

# Check frontend
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200\|304"; then
    echo -e "  ${GREEN}✅ 前端服务 (localhost:3000)${NC}"
else
    echo -e "  ❌ 前端服务 (localhost:3000)"
fi

# Check PostgreSQL
if docker-compose exec -T postgresql pg_isready -U koduck > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅ PostgreSQL (localhost:5432)${NC}"
else
    echo -e "  ❌ PostgreSQL (localhost:5432)"
fi

# Check Redis
if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅ Redis (localhost:6379)${NC}"
else
    echo -e "  ❌ Redis (localhost:6379)"
fi

echo ""
