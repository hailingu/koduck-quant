#!/bin/bash
# ==========================================
# Koduck Quant 开发环境快速启动脚本
# ==========================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Koduck Quant 开发环境启动${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 1. 启动基础设施
echo -e "${BLUE}🐳 启动 Docker 基础设施...${NC}"
docker-compose up -d postgresql redis data-service

echo -e "${BLUE}⏳ 等待基础设施就绪...${NC}"
sleep 5

# 2. 构建并启动后端
echo -e "${BLUE}☕ 启动后端服务...${NC}"
cd koduck-backend
export SPRING_PROFILES_ACTIVE=dev
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=koduck_dev
export DB_USERNAME=koduck
export DB_PASSWORD=koduck
export REDIS_HOST=localhost
export REDIS_PORT=6379
export DATA_SERVICE_URL=http://localhost:8000/api/v1
export JWT_SECRET=your-256-bit-secret-key-for-jwt-signing-must-be-at-least-32-characters-long
export RATE_LIMIT_LOGIN_FAILURE_MAX_PER_USER=${RATE_LIMIT_LOGIN_FAILURE_MAX_PER_USER:-5}
export RATE_LIMIT_LOGIN_FAILURE_MAX_PER_IP=${RATE_LIMIT_LOGIN_FAILURE_MAX_PER_IP:-20}
export RATE_LIMIT_LOGIN_FAILURE_WINDOW=${RATE_LIMIT_LOGIN_FAILURE_WINDOW:-15m}
export RATE_LIMIT_PASSWORD_RESET_MAX_PER_USER=${RATE_LIMIT_PASSWORD_RESET_MAX_PER_USER:-3}
export RATE_LIMIT_PASSWORD_RESET_MAX_PER_EMAIL=${RATE_LIMIT_PASSWORD_RESET_MAX_PER_EMAIL:-5}
export RATE_LIMIT_PASSWORD_RESET_MAX_PER_IP=${RATE_LIMIT_PASSWORD_RESET_MAX_PER_IP:-10}
export RATE_LIMIT_PASSWORD_RESET_WINDOW=${RATE_LIMIT_PASSWORD_RESET_WINDOW:-1h}

# 检查 JAR 是否存在
if [ ! -f "target/koduck-backend-0.1.0-SNAPSHOT.jar" ]; then
    echo -e "${YELLOW}🔨 构建后端 JAR...${NC}"
    mvn clean package -DskipTests
fi

# 停止可能存在的旧进程
pkill -f "koduck-backend-0.1.0-SNAPSHOT.jar" 2>/dev/null || true
sleep 1

# 启动后端
nohup java -jar target/koduck-backend-0.1.0-SNAPSHOT.jar > /tmp/backend.log 2>&1 &
echo $! > /tmp/backend.pid
cd ..

echo -e "${BLUE}⏳ 等待后端就绪...${NC}"
sleep 8

# 3. 启动前端
echo -e "${BLUE}⚛️  启动前端服务...${NC}"
cd koduck-frontend

# 停止可能存在的旧进程
pkill -f "vite" 2>/dev/null || true
sleep 1

nohup npm run dev > /tmp/frontend.log 2>&1 &
echo $! > /tmp/frontend.pid
cd ..

echo -e "${BLUE}⏳ 等待前端就绪...${NC}"
sleep 3

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  ✅ 所有服务已启动！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}访问地址：${NC}"
echo -e "  🌐 前端: ${GREEN}http://localhost:3000${NC}"
echo -e "  🔌 后端: ${GREEN}http://localhost:8080${NC}"
echo -e "  📊 数据: ${GREEN}http://localhost:8000${NC}"
echo ""
echo -e "${YELLOW}日志文件：${NC}"
echo -e "  后端: /tmp/backend.log"
echo -e "  前端: /tmp/frontend.log"
echo ""
echo -e "${YELLOW}停止命令：${NC}"
echo -e "  ./stop-dev.sh"
