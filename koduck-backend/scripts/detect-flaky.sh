#!/bin/bash
#
# Flaky Test 本地检测脚本
# 用法: ./scripts/detect-flaky.sh [TestClassName] [runs]
#

set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 默认参数
TEST_CLASS="${1:-}"          # 测试类名，为空则检测所有
RUN_COUNT="${2:-10}"         # 默认运行 10 次
RERUN_COUNT="${3:-2}"        # 失败重试次数

# 显示帮助
show_help() {
    echo "Flaky Test 本地检测脚本"
    echo ""
    echo "用法:"
    echo "  $0 [TestClassName] [runs] [rerun_count]"
    echo ""
    echo "参数:"
    echo "  TestClassName  - 测试类名（如: UserServiceTest），为空则检测所有"
    echo "  runs           - 运行次数，默认 10"
    echo "  rerun_count    - 失败重试次数，默认 2"
    echo ""
    echo "示例:"
    echo "  $0                          # 检测所有测试，运行 10 次"
    echo "  $0 UserServiceTest          # 检测 UserServiceTest，运行 10 次"
    echo "  $0 UserServiceTest 20       # 检测 UserServiceTest，运行 20 次"
    echo "  $0 UserServiceTest 10 3     # 检测 UserServiceTest，运行 10 次，重试 3 次"
}

# 检查是否在 koduck-backend 目录
check_directory() {
    if [ ! -f "pom.xml" ]; then
        echo -e "${RED}错误: 未找到 pom.xml，请在 koduck-backend 目录下运行此脚本${NC}"
        exit 1
    fi
}

# 运行单次测试
run_test() {
    local run_num=$1
    local test_arg=""
    
    if [ -n "$TEST_CLASS" ]; then
        test_arg="-Dtest=${TEST_CLASS}"
    fi
    
    echo "=== 运行第 $run_num/$RUN_COUNT 次 ==="
    
    if mvn -q test \
        $test_arg \
        -Dsurefire.rerunFailingTestsCount="$RERUN_COUNT" \
        -Dsurefire.reportFormat=xml \
        -DskipITs 2>&1 > /tmp/flaky-run-$run_num.log; then
        echo -e "${GREEN}✓ 通过${NC}"
        return 0
    else
        echo -e "${RED}✗ 失败${NC}"
        return 1
    fi
}

# 分析结果
analyze_results() {
    local pass_count=0
    local fail_count=0
    local flaky_detected=false
    
    echo ""
    echo "========== 检测结果 =========="
    
    for i in $(seq 1 $RUN_COUNT); do
        if [ -f "/tmp/flaky-run-$i.log" ]; then
            # 检查是否有 flaky 标记
            if grep -q "<flakyFailure" target/surefire-reports/*.xml 2>/dev/null; then
                flaky_detected=true
            fi
            
            if grep -q "BUILD SUCCESS" /tmp/flaky-run-$i.log; then
                pass_count=$((pass_count + 1))
            else
                fail_count=$((fail_count + 1))
            fi
        fi
    done
    
    echo "总运行次数: $RUN_COUNT"
    echo -e "通过次数: ${GREEN}$pass_count${NC}"
    echo -e "失败次数: ${RED}$fail_count${NC}"
    
    if [ "$flaky_detected" = true ]; then
        echo ""
        echo -e "${YELLOW}⚠️ 检测到 Flaky Test!${NC}"
        echo ""
        echo "Flaky 测试详情:"
        
        # 提取 flaky 测试名
        for file in target/surefire-reports/*.xml; do
            if [ -f "$file" ] && grep -q "<flakyFailure" "$file" 2>/dev/null; then
                classname=$(grep -o 'classname="[^"]*"' "$file" | head -1 | cut -d'"' -f2)
                grep -B5 "<flakyFailure" "$file" 2>/dev/null | \
                    grep -o 'name="[^"]*"' | head -1 | cut -d'"' -f2 | \
                    while read testname; do
                        echo "  - ${classname}#${testname}"
                    done
            fi
        done
        
        echo ""
        echo "建议操作:"
        echo "  1. 按团队当前测试治理流程分析并记录 flaky 原因"
        echo "  2. 使用 @Tag(\"flaky\") 标记该测试"
        echo "  3. 创建修复 Issue，标签: flaky"
        return 1
    elif [ $fail_count -gt 0 ]; then
        echo ""
        echo -e "${YELLOW}⚠️ 存在稳定的测试失败，请检查:${NC}"
        echo "  mvn test -Dtest=${TEST_CLASS:-*}"
        return 1
    else
        echo ""
        echo -e "${GREEN}✅ 未发现 Flaky Test${NC}"
        return 0
    fi
}

# 清理临时文件
cleanup() {
    rm -f /tmp/flaky-run-*.log
}

# 主函数
main() {
    # 处理帮助参数
    if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
        show_help
        exit 0
    fi
    
    check_directory
    
    echo "========== Flaky Test 检测 =========="
    echo "测试类: ${TEST_CLASS:-所有测试}"
    echo "运行次数: $RUN_COUNT"
    echo "失败重试: $RERUN_COUNT"
    echo "======================================"
    echo ""
    
    # 清理旧报告
    rm -rf target/surefire-reports
    
    # 运行多次测试
    for i in $(seq 1 $RUN_COUNT); do
        run_test $i || true
    done
    
    # 分析结果
    analyze_results
    local result=$?
    
    # 清理
    cleanup
    
    exit $result
}

# 执行主函数
main "$@"
