#!/bin/bash
# ==========================================
# Koduck Quant Docker Startup Script
# ==========================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}  Koduck Quant Docker 启动脚本${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  未找到 .env 文件，使用默认配置${NC}"
    echo -e "${YELLOW}   建议运行: cp .env.example .env 并修改配置${NC}"
    echo ""
fi

# Parse arguments
CLEAN_MODE=false
for arg in "$@"; do
    case $arg in
        --clean|-c)
            CLEAN_MODE=true
            shift
            ;;
        --help|-h)
            echo "用法: $0 [选项]"
            echo ""
            echo "选项:"
            echo "  --clean, -c    完全清理模式（删除容器+卷+镜像后重新构建）"
            echo "  --help, -h    显示帮助信息"
            exit 0
            ;;
    esac
done

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker 未安装，请先安装 Docker${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose 未安装，请先安装 Docker Compose${NC}"
    exit 1
fi

# Clean mode: completely clean and rebuild
if [ "$CLEAN_MODE" = true ]; then
    echo -e "${RED}⚠️  完全清理模式已启用！${NC}"
    echo -e "${YELLOW}将执行以下操作:${NC}"
    echo "  1. 删除所有容器"
    echo "  2. 删除所有数据卷"
    echo "  3. 删除所有相关镜像"
    echo "  4. 重新构建镜像（不使用缓存）"
    echo "  5. 启动所有服务"
    read -p "确定要继续吗? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}已取消${NC}"
        exit 0
    fi
    
    echo -e "${BLUE}🧹 完全清理中...${NC}"
    docker-compose down -v --rmi all
    echo -e "${GREEN}✅ 清理完成${NC}"
    
    echo -e "${BLUE}🔨 重新构建镜像（不使用缓存）...${NC}"
    docker-compose build --no-cache
    
    echo -e "${BLUE}🚀 启动服务...${NC}"
    docker-compose up -d
    
    echo ""
    echo -e "${GREEN}=========================================${NC}"
    echo -e "${GREEN}  ✅ 完全清理重建完成！${NC}"
    echo -e "${GREEN}=========================================${NC}"
    echo ""
    echo -e "${YELLOW}服务访问地址：${NC}"
    echo -e "  🌐 前端界面: ${GREEN}http://localhost:3000${NC}"
    echo -e "  🔌 后端 API: ${GREEN}http://localhost:8080${NC}"
    echo ""
    exit 0
fi

# Check if containers are already running
if docker-compose ps | grep -q "Up"; then
    echo -e "${YELLOW}⚠️  部分服务已在运行${NC}"
    read -p "是否重启服务? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}🔄 重启服务...${NC}"
        docker-compose down
    else
        echo -e "${GREEN}✅ 服务保持运行${NC}"
        exit 0
    fi
fi

# Build and start
echo -e "${BLUE}🔨 构建镜像...${NC}"
docker-compose build

echo ""
echo -e "${BLUE}🚀 启动服务...${NC}"
docker-compose up -d

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}  ✅ Koduck Quant 启动成功！${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo -e "${YELLOW}服务访问地址：${NC}"
echo -e "  🌐 前端界面: ${GREEN}http://localhost:3000${NC}"
echo -e "  🔌 后端 API: ${GREEN}http://localhost:8080${NC}"
echo -e "  📊 健康检查: ${GREEN}http://localhost:8080/actuator/health${NC}"
echo ""
echo -e "${YELLOW}常用命令：${NC}"
echo -e "  查看日志: ${BLUE}docker-compose logs -f${NC}"
echo -e "  停止服务: ${BLUE}docker-compose down${NC}"
echo -e "  查看状态: ${BLUE}docker-compose ps${NC}"
echo ""

# Wait for services to be ready
echo -e "${BLUE}⏳ 等待服务就绪...${NC}"
sleep 5

# Health check
echo -e "${BLUE}🔍 检查服务健康状态...${NC}"
if curl -s http://localhost:8080/actuator/health > /dev/null 2>&1; then
    echo -e "${GREEN}  ✅ 后端服务健康${NC}"
else
    echo -e "${YELLOW}  ⚠️  后端服务启动中，请稍后检查${NC}"
fi

if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}  ✅ 前端服务健康${NC}"
else
    echo -e "${YELLOW}  ⚠️  前端服务启动中，请稍后检查${NC}"
fi

echo ""
echo -e "${GREEN}🎉 部署完成！${NC}"
