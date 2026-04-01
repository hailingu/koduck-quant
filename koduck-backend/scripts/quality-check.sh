#!/bin/bash
# 一键本地质量检查脚本
# 集成所有 Phase 2 质量门禁检查

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "╔════════════════════════════════════════════════════════════════════════════╗"
echo "║                    Koduck Backend 质量检查脚本                             ║"
echo "╚════════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "项目路径: $PROJECT_ROOT"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查结果统计
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# 检查函数
run_check() {
    local name=$1
    local cmd=$2
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    echo "════════════════════════════════════════════════════════════════════════════"
    echo "🔍 [$TOTAL_CHECKS] $name"
    echo "════════════════════════════════════════════════════════════════════════════"
    
    if eval "$cmd"; then
        echo -e "${GREEN}✅ $name 通过${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        echo -e "${RED}❌ $name 失败${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        return 1
    fi
}

cd "$PROJECT_ROOT"

# ========== 1. 代码格式检查 ==========
echo ""
echo "📦 阶段 1: 代码格式检查"
echo ""

run_check "PMD 代码格式检查" "mvn pmd:check -q"

# ========== 2. 静态分析检查 ==========
echo ""
echo "📦 阶段 2: 静态分析检查"
echo ""

run_check "SpotBugs 安全漏洞检查" "mvn spotbugs:check -q"

# ========== 3. 编译检查 ==========
echo ""
echo "📦 阶段 3: 编译检查"
echo ""

run_check "Maven 编译" "mvn clean compile -q -DskipTests"

# ========== 4. 测试执行 ==========
echo ""
echo "📦 阶段 4: 测试执行"
echo ""

run_check "单元测试" "mvn test -q -Dtest='**/unit/**/*Test'"

run_check "切片测试" "mvn test -q -Dtest='**/slice/**/*Test'"

# ========== 5. 覆盖率检查 ==========
echo ""
echo "📦 阶段 5: 覆盖率检查"
echo ""

run_check "JaCoCo 覆盖率 (60%阈值)" "mvn jacoco:check -q"

# ========== 6. 架构检查 ==========
echo ""
echo "📦 阶段 6: 架构检查"
echo ""

run_check "架构违规检查" "./scripts/check-arch-violations.sh"

# ========== 汇总 ==========
echo ""
echo "╔════════════════════════════════════════════════════════════════════════════╗"
echo "║                          检查结果汇总                                      ║"
echo "╚════════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "总检查项: $TOTAL_CHECKS"
echo -e "通过: ${GREEN}$PASSED_CHECKS${NC}"
echo -e "失败: ${RED}$FAILED_CHECKS${NC}"
echo ""

if [ $FAILED_CHECKS -eq 0 ]; then
    echo -e "${GREEN}🎉 所有检查通过！可以提交代码。${NC}"
    echo ""
    echo "建议操作:"
    echo "  git add ."
    echo "  git commit -m 'feat: your change'"
    echo "  git push origin your-branch"
    exit 0
else
    echo -e "${RED}⚠️  有 $FAILED_CHECKS 项检查未通过，请修复后重试。${NC}"
    echo ""
    echo "快速修复命令:"
    echo "  # 查看详细错误"
    echo "  mvn pmd:pmd"
    echo "  mvn spotbugs:spotbugs"
    echo ""
    exit 1
fi
