#!/bin/bash
# ==========================================
# Koduck Quant 本地开发启动脚本
# ==========================================
# 用于网络问题无法构建 Docker 镜像时的临时方案

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}  Koduck Quant 本地开发模式${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

# Compose env file priority: .env.local > .env
COMPOSE_ENV_ARGS=""
if [ -f ".env.local" ]; then
    COMPOSE_ENV_ARGS="--env-file .env.local"
elif [ -f ".env" ]; then
    COMPOSE_ENV_ARGS="--env-file .env"
fi

# 检查本地 JAR 是否存在
if [ ! -f "koduck-backend/target/koduck-backend-0.1.0-SNAPSHOT.jar" ]; then
    echo -e "${YELLOW}⚠️  本地 JAR 不存在，开始构建...${NC}"
    cd koduck-backend
    mvn clean package -DskipTests
    cd ..
fi

# 启动基础设施
echo -e "${BLUE}🚀 启动基础设施 (PostgreSQL, Redis, Data Service)...${NC}"
docker-compose ${COMPOSE_ENV_ARGS} -f docker-compose.local.yml up -d

echo ""
echo -e "${BLUE}⏳ 等待基础设施就绪...${NC}"
sleep 5

# 检查服务状态
echo -e "${YELLOW}检查服务状态：${NC}"
docker-compose ${COMPOSE_ENV_ARGS} -f docker-compose.local.yml ps

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}  ✅ 基础设施已启动！${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo -e "${YELLOW}请在单独的终端窗口中运行后端和前端：${NC}"
echo ""
echo -e "${BLUE}终端 1 - 后端:${NC}"
echo "  cd koduck-backend"
echo "  export SPRING_PROFILES_ACTIVE=dev"
echo "  export DB_HOST=localhost"
echo "  export DB_PORT=5432"
echo "  export DB_NAME=koduck_dev"
echo "  export DB_USERNAME=koduck"
echo "  export DB_PASSWORD=koduck"
echo "  export REDIS_HOST=localhost"
echo "  export REDIS_PORT=6379"
echo "  export DATA_SERVICE_URL=http://localhost:8000/api/v1"
echo "  export JWT_SECRET=your-256-bit-secret-key-for-jwt-signing-must-be-at-least-32-characters-long"
echo "  export RATE_LIMIT_LOGIN_FAILURE_MAX_PER_USER=${RATE_LIMIT_LOGIN_FAILURE_MAX_PER_USER:-5}"
echo "  export RATE_LIMIT_LOGIN_FAILURE_MAX_PER_IP=${RATE_LIMIT_LOGIN_FAILURE_MAX_PER_IP:-20}"
echo "  export RATE_LIMIT_LOGIN_FAILURE_WINDOW=${RATE_LIMIT_LOGIN_FAILURE_WINDOW:-15m}"
echo "  export RATE_LIMIT_PASSWORD_RESET_MAX_PER_USER=${RATE_LIMIT_PASSWORD_RESET_MAX_PER_USER:-3}"
echo "  export RATE_LIMIT_PASSWORD_RESET_MAX_PER_EMAIL=${RATE_LIMIT_PASSWORD_RESET_MAX_PER_EMAIL:-5}"
echo "  export RATE_LIMIT_PASSWORD_RESET_MAX_PER_IP=${RATE_LIMIT_PASSWORD_RESET_MAX_PER_IP:-10}"
echo "  export RATE_LIMIT_PASSWORD_RESET_WINDOW=${RATE_LIMIT_PASSWORD_RESET_WINDOW:-1h}"
echo "  java -jar target/koduck-backend-0.1.0-SNAPSHOT.jar"
echo ""
echo -e "${BLUE}终端 2 - 前端:${NC}"
echo "  cd koduck-frontend"
echo "  npm install"
echo "  npm run dev"
echo ""
echo -e "${GREEN}服务访问地址：${NC}"
echo -e "  🌐 前端界面: ${GREEN}http://localhost:3000${NC}"
echo -e "  🔌 后端 API: ${GREEN}http://localhost:8080${NC}"
echo -e "  📊 数据服务: ${GREEN}http://localhost:8000${NC}"
echo ""
