# ==========================================
# Koduck Quant Kubernetes Makefile
# ==========================================

.PHONY: help \
	k8s-dev-install k8s-dev-status k8s-dev-port-forward k8s-dev-logs k8s-dev-uninstall \
	k8s-prod-install k8s-prod-status k8s-prod-port-forward k8s-prod-logs k8s-prod-uninstall \
	build-auth-dev rollout-auth-dev \
	quality quality-backend quality-pmd quality-pmd-debt quality-spotbugs quality-test \
	quality-test-unit quality-test-slice quality-coverage quality-arch quality-format quality-report \
	hooks-install hooks-uninstall

.DEFAULT_GOAL := help

BLUE := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RED := \033[31m
NC := \033[0m

help: ## 显示帮助信息
	@echo "$(BLUE)Koduck Quant Kubernetes 管理命令$(NC)"
	@echo "================================"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z0-9_-]+:.*?## / {printf "  $(GREEN)%-24s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# ==========================================
# Kubernetes Deployment
# ==========================================

k8s-dev-install: ## 部署 dev 环境
	@./k8s/deploy.sh dev install

k8s-dev-status: ## 查看 dev 环境状态
	@./k8s/deploy.sh dev status

k8s-dev-port-forward: ## 启动 dev 环境端口转发
	@./k8s/deploy.sh dev port-forward

k8s-dev-logs: ## 查看 dev 环境 APISIX 日志
	@./k8s/deploy.sh dev logs

k8s-dev-uninstall: ## 卸载 dev 环境
	@./k8s/uninstall.sh dev

k8s-prod-install: ## 部署 prod 环境
	@./k8s/deploy.sh prod install

k8s-prod-status: ## 查看 prod 环境状态
	@./k8s/deploy.sh prod status

k8s-prod-port-forward: ## 启动 prod 环境端口转发
	@./k8s/deploy.sh prod port-forward

k8s-prod-logs: ## 查看 prod 环境 APISIX 日志
	@./k8s/deploy.sh prod logs

k8s-prod-uninstall: ## 卸载 prod 环境
	@./k8s/uninstall.sh prod

build-auth-dev: ## 构建 koduck-auth:dev 镜像
	@echo "$(BLUE)构建 koduck-auth:dev 镜像...$(NC)"
	docker build -t koduck-auth:dev ./koduck-auth
	@echo "$(GREEN)✅ 镜像构建完成$(NC)"

rollout-auth-dev: ## 重启 dev 环境的 koduck-auth 并等待就绪
	@echo "$(BLUE)重启 dev-koduck-auth...$(NC)"
	kubectl rollout restart deployment/dev-koduck-auth -n koduck-dev
	kubectl rollout status deployment/dev-koduck-auth -n koduck-dev --timeout=180s
	@echo "$(GREEN)✅ dev-koduck-auth 已完成 rollout$(NC)"

# ==========================================
# Quality Check Commands
# ==========================================

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
