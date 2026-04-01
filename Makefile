# ==========================================
# Koduck Quant Docker Makefile
# ==========================================

.PHONY: help up down restart build logs ps clean dev prod dev-up check-local-llm-key

# Default target
.DEFAULT_GOAL := help

# Colors for output
BLUE := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RED := \033[31m
NC := \033[0m # No Color
LOCAL_ENV_FILE := $(if $(wildcard .env.local),--env-file .env.local,$(if $(wildcard .env),--env-file .env,))

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

dev-up: check-local-llm-key ## 启动本地开发环境（使用 docker-compose.local.yml）
	@echo "$(BLUE)启动 Koduck Quant 本地开发环境...$(NC)"
	@echo "$(YELLOW)使用 docker-compose.local.yml（默认 Demo: demo / demo123）$(NC)"
	docker-compose $(LOCAL_ENV_FILE) -f docker-compose.local.yml up -d
	@echo "$(GREEN)✅ 本地开发服务已启动$(NC)"
	@echo "$(YELLOW)前端: http://localhost:3000$(NC)"
	@echo "$(YELLOW)后端: http://localhost:8080$(NC)"
	@echo "$(YELLOW)Agent: http://localhost:8001$(NC)"

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

dev-rebuild: check-local-llm-key ## 开发环境快速重建（使用缓存，只更新代码层）
	@echo "$(BLUE)🔄 开发环境快速重建（使用 Docker 缓存）...$(NC)"
	@echo "$(YELLOW)将执行以下操作:$(NC)"
	@echo "  1. 停止所有容器"
	@echo "  2. 删除项目构建镜像（backend/frontend/data-service/agent）"
	@echo "  3. 重新构建镜像（使用缓存，只更新代码层）"
	@echo "  4. 启动所有服务"
	@echo "$(YELLOW)使用 docker-compose.local.yml（默认 Demo: demo / demo123）$(NC)"
	@read -p "确定要继续吗? [y/N] " confirm && [ $$confirm = "y" ] || exit 0
	@echo "$(BLUE)🛑 停止容器中...$(NC)"
	@docker-compose $(LOCAL_ENV_FILE) -f docker-compose.local.yml down --remove-orphans
	@project_images=$$(docker-compose $(LOCAL_ENV_FILE) -f docker-compose.local.yml images -q backend frontend data-service agent | sort -u); \
	if [ -n "$$project_images" ]; then \
		echo "$(BLUE)🗑️  删除项目镜像...$(NC)"; \
		docker rmi -f $$project_images; \
	else \
		echo "$(YELLOW)未发现可删除的项目镜像$(NC)"; \
	fi
	@echo "$(BLUE)🔨 重新构建镜像（使用缓存）...$(NC)"
	@docker-compose $(LOCAL_ENV_FILE) -f docker-compose.local.yml build
	@echo "$(BLUE)🚀 启动服务...$(NC)"
	@docker-compose $(LOCAL_ENV_FILE) -f docker-compose.local.yml up -d
	@echo "$(BLUE)⏳ 等待基础数据导入完成（stock_basic / kline_data）...$(NC)"
	@expected_pairs=$$(find koduck-data-service/data/kline -name '*.csv' | wc -l | tr -d ' '); \
	if [ -z "$$expected_pairs" ] || [ "$$expected_pairs" -eq 0 ]; then expected_pairs=1; fi; \
	max_tries=60; \
	try=1; \
	while [ $$try -le $$max_tries ]; do \
		stock_count=$$(docker-compose $(LOCAL_ENV_FILE) -f docker-compose.local.yml exec -T postgresql psql -U $${POSTGRES_USER:-koduck} -d $${POSTGRES_DB:-koduck_dev} -Atc "SELECT COUNT(*) FROM stock_basic" 2>/dev/null | tr -d '[:space:]'); \
		pair_count=$$(docker-compose $(LOCAL_ENV_FILE) -f docker-compose.local.yml exec -T postgresql psql -U $${POSTGRES_USER:-koduck} -d $${POSTGRES_DB:-koduck_dev} -Atc "SELECT COUNT(DISTINCT symbol || '|' || timeframe) FROM kline_data WHERE market='AShare'" 2>/dev/null | tr -d '[:space:]'); \
		stock_count=$${stock_count:-0}; \
		pair_count=$${pair_count:-0}; \
		echo "  [$$try/$$max_tries] stock_basic=$$stock_count, kline_pairs=$$pair_count/$$expected_pairs"; \
		if [ "$$stock_count" -ge 3000 ] && [ "$$pair_count" -ge "$$expected_pairs" ]; then \
			echo "$(GREEN)✅ 基础数据导入完成$(NC)"; \
			break; \
		fi; \
		sleep 5; \
		try=$$((try + 1)); \
	done; \
	if [ $$try -gt $$max_tries ]; then \
		echo "$(YELLOW)⚠️ 等待超时：服务已启动，但基础数据仍在后台导入。$(NC)"; \
	fi
	@echo "$(GREEN)✅ 开发环境快速重建完成$(NC)"
	@echo "$(YELLOW)前端: http://localhost:3000$(NC)"
	@echo "$(YELLOW)后端: http://localhost:8080$(NC)"
	@echo "$(YELLOW)Demo 用户: demo / demo123（可通过 APP_DEMO_USERNAME / APP_DEMO_PASSWORD 覆盖）$(NC)"

dev-rebuild-clean: check-local-llm-key ## 开发环境完全清理重建（使用 docker-compose.local.yml，不使用缓存）
	@echo "$(RED)⚠️  警告: 这将清理开发环境容器/数据卷，并删除项目构建镜像！$(NC)"
	@echo "$(YELLOW)将执行以下操作:$(NC)"
	@echo "  1. 删除所有容器"
	@echo "  2. 删除所有数据卷"
	@echo "  3. 仅删除项目构建镜像（backend/frontend/data-service/agent）"
	@echo "  4. 重新构建镜像（不使用缓存）"
	@echo "  5. 启动所有服务"
	@echo "$(YELLOW)使用 docker-compose.local.yml（默认 Demo: demo / demo123）$(NC)"
	@read -p "确定要继续吗? [y/N] " confirm && [ $$confirm = "y" ] || exit 0
	@echo "$(BLUE)🧹 完全清理中...$(NC)"
	@project_images=$$(docker-compose $(LOCAL_ENV_FILE) -f docker-compose.local.yml images -q backend frontend data-service agent | sort -u); \
	docker-compose $(LOCAL_ENV_FILE) -f docker-compose.local.yml down -v --remove-orphans; \
	if [ -n "$$project_images" ]; then \
		echo "$(BLUE)🗑️  删除项目镜像...$(NC)"; \
		docker rmi -f $$project_images; \
	else \
		echo "$(YELLOW)未发现可删除的项目镜像$(NC)"; \
	fi
	@echo "$(BLUE)🔨 重新构建镜像（不使用缓存）...$(NC)"
	docker-compose $(LOCAL_ENV_FILE) -f docker-compose.local.yml build --no-cache
	@echo "$(BLUE)🚀 启动服务...$(NC)"
	docker-compose $(LOCAL_ENV_FILE) -f docker-compose.local.yml up -d
	@echo "$(BLUE)⏳ 等待基础数据导入完成（stock_basic / kline_data）...$(NC)"
	@expected_pairs=$$(find koduck-data-service/data/kline -name '*.csv' | wc -l | tr -d ' '); \
	if [ -z "$$expected_pairs" ] || [ "$$expected_pairs" -eq 0 ]; then expected_pairs=1; fi; \
	max_tries=60; \
	try=1; \
	while [ $$try -le $$max_tries ]; do \
		stock_count=$$(docker-compose $(LOCAL_ENV_FILE) -f docker-compose.local.yml exec -T postgresql psql -U $${POSTGRES_USER:-koduck} -d $${POSTGRES_DB:-koduck_dev} -Atc "SELECT COUNT(*) FROM stock_basic" 2>/dev/null | tr -d '[:space:]'); \
		pair_count=$$(docker-compose $(LOCAL_ENV_FILE) -f docker-compose.local.yml exec -T postgresql psql -U $${POSTGRES_USER:-koduck} -d $${POSTGRES_DB:-koduck_dev} -Atc "SELECT COUNT(DISTINCT symbol || '|' || timeframe) FROM kline_data WHERE market='AShare'" 2>/dev/null | tr -d '[:space:]'); \
		stock_count=$${stock_count:-0}; \
		pair_count=$${pair_count:-0}; \
		echo "  [$$try/$$max_tries] stock_basic=$$stock_count, kline_pairs=$$pair_count/$$expected_pairs"; \
		if [ "$$stock_count" -ge 3000 ] && [ "$$pair_count" -ge "$$expected_pairs" ]; then \
			echo "$(GREEN)✅ 基础数据导入完成$(NC)"; \
			break; \
		fi; \
		sleep 5; \
		try=$$((try + 1)); \
	done; \
	if [ $$try -gt $$max_tries ]; then \
		echo "$(YELLOW)⚠️ 等待超时：服务已启动，但基础数据仍在后台导入。$(NC)"; \
	fi
	@echo "$(GREEN)✅ 开发环境完全清理重建完成$(NC)"
	@echo "$(YELLOW)前端: http://localhost:3000$(NC)"
	@echo "$(YELLOW)后端: http://localhost:8080$(NC)"
	@echo "$(YELLOW)Demo 用户: demo / demo123（可通过 APP_DEMO_USERNAME / APP_DEMO_PASSWORD 覆盖）$(NC)"

check-local-llm-key: ## 校验本地开发环境的 LLM 密钥是否存在
	@has_key=0; \
	if [ -n "$$MINIMAX_API_KEY" ] || [ -n "$$LLM_API_KEY" ] || [ -n "$$OPENAI_API_KEY" ]; then \
		has_key=1; \
	fi; \
	if [ $$has_key -eq 0 ] && [ -f .env.local ] && grep -Eq '^[[:space:]]*(MINIMAX_API_KEY|LLM_API_KEY|OPENAI_API_KEY)[[:space:]]*=[[:space:]]*[^[:space:]#]+' .env.local; then \
		has_key=1; \
	fi; \
	if [ $$has_key -eq 0 ] && [ -f .env ] && grep -Eq '^[[:space:]]*(MINIMAX_API_KEY|LLM_API_KEY|OPENAI_API_KEY)[[:space:]]*=[[:space:]]*[^[:space:]#]+' .env; then \
		has_key=1; \
	fi; \
	if [ $$has_key -eq 0 ]; then \
		echo "$(RED)❌ 未检测到有效 LLM 密钥。$(NC)"; \
		echo "$(YELLOW)请在 .env.local（推荐）或 .env 中设置 MINIMAX_API_KEY / LLM_API_KEY / OPENAI_API_KEY 之一。$(NC)"; \
		echo "$(YELLOW)示例: cp .env.local.example .env.local 并填写密钥$(NC)"; \
		exit 1; \
	fi

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

build-data-service: ## 仅重新构建 data-service 镜像（不使用缓存）
	@echo "$(BLUE)仅重新构建 data-service 镜像（不使用缓存）...$(NC)"
	docker-compose build --no-cache data-service
	@echo "$(GREEN)✅ data-service 镜像构建完成$(NC)"

build-data-service-up: ## 重新构建 data-service 并启动依赖服务
	@echo "$(BLUE)启动依赖服务并重新构建 data-service...$(NC)"
	docker-compose up -d --build data-service
	@echo "$(GREEN)✅ data-service 已启动$(NC)"

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

# ==========================================
# Quality Check Commands (Phase 2)
# ==========================================

.PHONY: quality quality-backend quality-pmd quality-pmd-debt quality-spotbugs quality-test quality-coverage quality-arch hooks-install hooks-uninstall

quality: ## 一键质量检查（全部）
	@echo "$(BLUE)🔍 执行一键质量检查...$(NC)"
	@cd koduck-backend && ./scripts/quality-check.sh

quality-backend: quality ## 后端质量检查（同 quality）

quality-pmd: ## PMD 静态分析检查
	@echo "$(BLUE)🔍 执行 PMD 检查...$(NC)"
	@cd koduck-backend && mvn pmd:check

quality-pmd-debt: ## PMD 存量非回退检查（ratchet）
	@echo "$(BLUE)🔍 执行 PMD 存量非回退检查...$(NC)"
	@cd koduck-backend && ./scripts/pmd-debt-guard.sh

quality-spotbugs: ## SpotBugs 安全漏洞检查
	@echo "$(BLUE)🔍 执行 SpotBugs 检查...$(NC)"
	@cd koduck-backend && mvn spotbugs:check

quality-test: ## 运行所有测试
	@echo "$(BLUE)🔍 执行测试...$(NC)"
	@cd koduck-backend && mvn test

quality-test-unit: ## 运行单元测试
	@echo "$(BLUE)🔍 执行单元测试...$(NC)"
	@cd koduck-backend && mvn test -Dtest='**/unit/**/*Test'

quality-test-slice: ## 运行切片测试
	@echo "$(BLUE)🔍 执行切片测试...$(NC)"
	@cd koduck-backend && mvn test -Dtest='**/slice/**/*Test'

quality-coverage: ## 覆盖率检查（60%阈值）
	@echo "$(BLUE)🔍 执行覆盖率检查...$(NC)"
	@cd koduck-backend && mvn jacoco:check

quality-arch: ## 架构违规检查
	@echo "$(BLUE)🔍 执行架构检查...$(NC)"
	@cd koduck-backend && ./scripts/check-arch-violations.sh

quality-format: ## 代码格式化检查
	@echo "$(BLUE)🔍 执行代码格式化检查...$(NC)"
	@cd koduck-backend && mvn spotless:check 2>/dev/null || echo "$(YELLOW)⚠️ Spotless 未配置，跳过$(NC)"

quality-report: ## 生成质量报告
	@echo "$(BLUE)📊 生成质量报告...$(NC)"
	@cd koduck-backend && mvn site -DskipTests 2>/dev/null || echo "$(YELLOW)⚠️ Maven Site 未配置，跳过$(NC)"
	@echo "$(GREEN)✅ 质量报告生成完成$(NC)"
	@echo "$(YELLOW)报告位置: koduck-backend/target/site/$(NC)"

hooks-install: ## 安装仓库 git hooks（启用 pre-commit 质量门禁）
	@echo "$(BLUE)🔧 安装 Git hooks...$(NC)"
	@./scripts/install-git-hooks.sh

hooks-uninstall: ## 卸载仓库 hooksPath 配置（恢复默认 .git/hooks）
	@echo "$(BLUE)🔧 卸载 Git hooks...$(NC)"
	@git config --unset core.hooksPath || true
	@echo "$(GREEN)✅ 已取消 core.hooksPath 配置$(NC)"

# ==========================================
# Release & Rollback
# ==========================================

rollback: ## 回滚到指定版本 (用法: make rollback VERSION=v1.2.2)
	@if [ -z "$(VERSION)" ]; then \
		echo "$(RED)❌ 错误: 请指定 VERSION 参数$(NC)"; \
		echo "$(YELLOW)用法: make rollback VERSION=v1.2.2$(NC)"; \
		exit 1; \
	fi
	@echo "$(RED)🚨 启动回滚流程...$(NC)"
	@echo "$(YELLOW)目标版本: $(VERSION)$(NC)"
	@read -p "确定要回滚到 $(VERSION) 吗? [y/N] " confirm && [ $$confirm = "y" ] || exit 0
	@echo "$(BLUE)🛑 停止当前服务...$(NC)"
	@docker-compose down
	@echo "$(BLUE)📥 拉取目标版本镜像...$(NC)"
	@docker-compose pull backend:$(VERSION) 2>/dev/null || echo "$(YELLOW)⚠️ 使用本地镜像$(NC)"
	@echo "$(BLUE)🚀 启动 $(VERSION) 版本...$(NC)"
	@VERSION=$(VERSION) docker-compose up -d
	@echo "$(GREEN)✅ 回滚完成，开始验证...$(NC)"
	@sleep 5
	@curl -s http://localhost:8080/actuator/health | jq -r '.status' | grep -q "UP" && \
		echo "$(GREEN)✅ 健康检查通过$(NC)" || \
		echo "$(RED)❌ 健康检查失败，请查看日志$(NC)"
	@echo "$(YELLOW)请执行完整的回滚验证: docs/rollback-runbook.md$(NC)"
