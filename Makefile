# ==========================================
# Koduck Quant Docker Makefile
# ==========================================

.PHONY: help up down restart build logs ps clean dev prod

# Default target
.DEFAULT_GOAL := help

# Colors for output
BLUE := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RED := \033[31m
NC := \033[0m # No Color

help: ## 显示帮助信息
	@echo "$(BLUE)Koduck Quant Docker 管理命令$(NC)"
	@echo "================================"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# ==========================================
# Development Commands
# ==========================================

up: ## 启动所有服务（开发环境）
	@echo "$(BLUE)启动 Koduck Quant 开发环境...$(NC)"
	docker-compose up -d
	@echo "$(GREEN)✅ 服务已启动$(NC)"
	@echo "$(YELLOW)前端: http://localhost:3000$(NC)"
	@echo "$(YELLOW)后端: http://localhost:8080$(NC)"

down: ## 停止所有服务
	@echo "$(BLUE)停止所有服务...$(NC)"
	docker-compose down
	@echo "$(GREEN)✅ 服务已停止$(NC)"

down-v: ## 停止所有服务并删除数据卷（⚠️ 数据将丢失）
	@echo "$(RED)警告: 这将删除所有数据卷！$(NC)"
	@read -p "确定要继续吗? [y/N] " confirm && [ $$confirm = "y" ] && docker-compose down -v || echo "已取消"

down-vmi: ## 停止所有服务并删除数据卷和镜像（⚠️ 数据和镜像都将丢失）
	@echo "$(RED)警告: 这将删除所有数据卷和镜像！$(NC)"
	@read -p "确定要继续吗? [y/N] " confirm && [ $$confirm = "y" ] && docker-compose down -v --rmi all || echo "已取消"

restart: ## 重启所有服务
	@echo "$(BLUE)重启所有服务...$(NC)"
	docker-compose restart
	@echo "$(GREEN)✅ 服务已重启$(NC)"

build: ## 重新构建所有镜像
	@echo "$(BLUE)重新构建所有镜像...$(NC)"
	docker-compose build --no-cache
	@echo "$(GREEN)✅ 镜像构建完成$(NC)"

rebuild: down build up ## 完全重建（停止+构建+启动）

rebuild-clean: ## 完全清理重建（删除容器+卷+镜像+重新构建+启动）
	@echo "$(RED)⚠️  警告: 这将完全清理所有 Docker 资源！$(NC)"
	@echo "$(YELLOW)将执行以下操作:$(NC)"
	@echo "  1. 删除所有容器"
	@echo "  2. 删除所有数据卷"
	@echo "  3. 删除所有相关镜像"
	@echo "  4. 重新构建镜像（不使用缓存）"
	@echo "  5. 启动所有服务"
	@read -p "确定要继续吗? [y/N] " confirm && [ $$confirm = "y" ] || exit 0
	@echo "$(BLUE)🧹 完全清理中...$(NC)"
	docker-compose down -v --rmi all
	@echo "$(BLUE)🔨 重新构建镜像（不使用缓存）...$(NC)"
	docker-compose build --no-cache
	@echo "$(BLUE)🚀 启动服务...$(NC)"
	docker-compose up -d
	@echo "$(GREEN)✅ 完全清理重建完成$(NC)"
	@echo "$(YELLOW)前端: http://localhost:3000$(NC)"
	@echo "$(YELLOW)后端: http://localhost:8080$(NC)"

dev-rebuild-clean: ## 开发环境完全清理重建（使用 docker-compose.local.yml）
	@echo "$(RED)⚠️  警告: 这将完全清理所有 Docker 资源！$(NC)"
	@echo "$(YELLOW)将执行以下操作:$(NC)"
	@echo "  1. 删除所有容器"
	@echo "  2. 删除所有数据卷"
	@echo "  3. 删除所有相关镜像"
	@echo "  4. 重新构建镜像（不使用缓存）"
	@echo "  5. 启动所有服务"
	@echo "$(YELLOW)使用 docker-compose.local.yml（包含 Demo 用户配置）$(NC)"
	@read -p "确定要继续吗? [y/N] " confirm && [ $$confirm = "y" ] || exit 0
	@echo "$(BLUE)🧹 完全清理中...$(NC)"
	docker-compose -f docker-compose.local.yml down -v --rmi all
	@echo "$(BLUE)🔨 重新构建镜像（不使用缓存）...$(NC)"
	docker-compose -f docker-compose.local.yml build --no-cache
	@echo "$(BLUE)🚀 启动服务...$(NC)"
	docker-compose -f docker-compose.local.yml up -d
	@echo "$(GREEN)✅ 开发环境完全清理重建完成$(NC)"
	@echo "$(YELLOW)前端: http://localhost:3000$(NC)"
	@echo "$(YELLOW)后端: http://localhost:8080$(NC)"
	@echo "$(YELLOW)Demo 用户: demo / demo123$(NC)"

# ==========================================
# Service Management
# ==========================================

logs: ## 查看所有服务日志
	docker-compose logs -f

logs-backend: ## 查看后端服务日志
	docker-compose logs -f backend

logs-frontend: ## 查看前端服务日志
	docker-compose logs -f frontend

logs-db: ## 查看数据库日志
	docker-compose logs -f postgresql

ps: ## 查看服务状态
	docker-compose ps

top: ## 查看资源使用情况
	docker-compose top

stats: ## 查看 Docker 资源统计
	docker stats

# ==========================================
# Individual Services
# ==========================================

up-db: ## 仅启动数据库和缓存（用于本地开发）
	@echo "$(BLUE)启动数据库和缓存...$(NC)"
	docker-compose up -d postgresql redis
	@echo "$(GREEN)✅ 数据库已启动$(NC)"
	@echo "$(YELLOW)PostgreSQL: localhost:5432$(NC)"
	@echo "$(YELLOW)Redis: localhost:6379$(NC)"

restart-backend: ## 重启后端服务
	docker-compose restart backend

restart-frontend: ## 重启前端服务
	docker-compose restart frontend

build-backend: ## 重新构建后端镜像
	docker-compose up -d --build backend

build-frontend: ## 重新构建前端镜像
	docker-compose up -d --build frontend

# ==========================================
# Database Operations
# ==========================================

db-shell: ## 进入 PostgreSQL 命令行
	docker-compose exec postgresql psql -U koduck -d koduck_dev

db-backup: ## 备份数据库
	@echo "$(BLUE)备份数据库...$(NC)"
	@mkdir -p backups
	@timestamp=$$(date +%Y%m%d_%H%M%S); \
	docker-compose exec -T postgresql pg_dump -U koduck koduck_dev > backups/koduck_backup_$$timestamp.sql
	@echo "$(GREEN)✅ 备份完成: backups/koduck_backup_*.sql$(NC)"

db-restore: ## 恢复数据库（需要指定文件: make db-restore FILE=backups/xxx.sql）
	@if [ -z "$(FILE)" ]; then \
		echo "$(RED)错误: 请指定备份文件，例如: make db-restore FILE=backups/xxx.sql$(NC)"; \
		exit 1; \
	fi
	@echo "$(BLUE)恢复数据库: $(FILE)$(NC)"
	@docker-compose exec -T postgresql psql -U koduck koduck_dev < $(FILE)
	@echo "$(GREEN)✅ 数据库恢复完成$(NC)"

# ==========================================
# Production Commands
# ==========================================

prod-up: ## 启动生产环境
	@echo "$(BLUE)启动 Koduck Quant 生产环境...$(NC)"
	docker-compose -f docker-compose.prod.yml up -d
	@echo "$(GREEN)✅ 生产环境已启动$(NC)"

prod-down: ## 停止生产环境
	docker-compose -f docker-compose.prod.yml down
	@echo "$(GREEN)✅ 生产环境已停止$(NC)"

prod-logs: ## 查看生产环境日志
	docker-compose -f docker-compose.prod.yml logs -f

# ==========================================
# Maintenance
# ==========================================

clean: ## 清理未使用的 Docker 资源
	@echo "$(YELLOW)清理未使用的 Docker 资源...$(NC)"
	docker system prune -f

clean-all: ## 完全清理（包括卷和镜像）⚠️ 小心使用
	@echo "$(RED)警告: 这将删除所有未使用的 Docker 资源，包括卷！$(NC)"
	@read -p "确定要继续吗? [y/N] " confirm && [ $$confirm = "y" ] && docker system prune -a -f --volumes || echo "已取消"

update: ## 更新所有镜像
	@echo "$(BLUE)更新所有镜像...$(NC)"
	docker-compose pull
	docker-compose build --no-cache
	@echo "$(GREEN)✅ 镜像更新完成$(NC)"

# ==========================================
# Shell Access
# ==========================================

shell-backend: ## 进入后端容器
	docker-compose exec backend sh

shell-db: ## 进入数据库容器
	docker-compose exec postgresql sh

shell-redis: ## 进入 Redis 容器
	docker-compose exec redis sh

redis-cli: ## 进入 Redis CLI
	docker-compose exec redis redis-cli
