#!/bin/bash
#
# 质量指标采集脚本
# 功能：运行测试并生成 JaCoCo、PMD、SpotBugs 质量指标报告
# 输出：docs/phase3/quality-trend/quality-metrics-YYYY-MM-DD.json
#

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
BACKEND_DIR="koduck-backend"
OUTPUT_DIR="docs/phase3/quality-trend"
DATE=$(date +%Y-%m-%d)
WEEK=$(date +%Y-W%V)
TIMESTAMP=$(date +%Y-%m-%dT%H:%M:%S)
OUTPUT_FILE="${OUTPUT_DIR}/quality-metrics-${DATE}.json"

# 帮助信息
show_help() {
    cat << EOF
质量指标采集脚本

用法: $0 [选项]

选项:
    -h, --help          显示帮助信息
    -o, --output DIR    指定输出目录 (默认: ${OUTPUT_DIR})
    -d, --date DATE     指定日期 (格式: YYYY-MM-DD, 默认: 今天)
    --dry-run           模拟运行，不实际执行测试
    --skip-tests        跳过测试执行，仅解析现有报告

示例:
    $0                          # 采集当天指标
    $0 -d 2026-03-25            # 采集指定日期指标
    $0 --dry-run                # 模拟运行
EOF
}

# 解析命令行参数
DRY_RUN=false
SKIP_TESTS=false
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -d|--date)
            DATE="$2"
            WEEK=$(date -d "$2" +%Y-W%V 2>/dev/null || date -j -f "%Y-%m-%d" "$2" +%Y-W%V 2>/dev/null || echo "$(echo $2 | cut -d'-' -f1)-W00")
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        *)
            echo -e "${RED}错误: 未知选项 $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

OUTPUT_FILE="${OUTPUT_DIR}/quality-metrics-${DATE}.json"

# 打印信息
info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# 检查依赖
check_dependencies() {
    info "检查依赖..."
    
    if ! command -v mvn &> /dev/null; then
        error "未找到 Maven (mvn)，请安装 Maven"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        warn "未找到 jq，将使用 Python 解析 JSON"
        if ! command -v python3 &> /dev/null; then
            error "未找到 Python3，无法解析 JSON"
            exit 1
        fi
    fi
    
    success "依赖检查通过"
}

# 运行测试
run_tests() {
    if [ "$SKIP_TESTS" = true ]; then
        info "跳过测试执行 (--skip-tests)"
        return
    fi
    
    if [ "$DRY_RUN" = true ]; then
        info "[模拟] 运行测试: mvn -q test jacoco:report"
        return
    fi
    
    info "运行 Maven 测试..."
    cd "${BACKEND_DIR}"
    
    # 清理并运行测试
    mvn clean test jacoco:report -q || {
        warn "部分测试失败，继续采集可用指标..."
    }
    
    cd ..
    success "测试执行完成"
}

# 运行 PMD 分析
run_pmd() {
    if [ "$DRY_RUN" = true ]; then
        info "[模拟] 运行 PMD: mvn pmd:pmd"
        return
    fi
    
    info "运行 PMD 静态分析..."
    cd "${BACKEND_DIR}"
    
    mvn pmd:pmd -q || {
        warn "PMD 分析执行失败或发现问题"
    }
    
    cd ..
    success "PMD 分析完成"
}

# 运行 SpotBugs 分析
run_spotbugs() {
    if [ "$DRY_RUN" = true ]; then
        info "[模拟] 运行 SpotBugs: mvn spotbugs:spotbugs"
        return
    fi
    
    info "运行 SpotBugs 静态分析..."
    cd "${BACKEND_DIR}"
    
    mvn spotbugs:spotbugs -q || {
        warn "SpotBugs 分析执行失败或发现问题"
    }
    
    cd ..
    success "SpotBugs 分析完成"
}

# 解析 JaCoCo 覆盖率报告
parse_jacoco() {
    local jacoco_xml="${BACKEND_DIR}/target/site/jacoco/jacoco.xml"
    local jacoco_html="${BACKEND_DIR}/target/site/jacoco/index.html"
    
    # 默认值
    LINE_COVERAGE=0
    BRANCH_COVERAGE=0
    INSTRUCTION_COVERAGE=0
    
    if [ "$DRY_RUN" = true ]; then
        LINE_COVERAGE=40.6
        BRANCH_COVERAGE=29.6
        INSTRUCTION_COVERAGE=35.2
        return
    fi
    
    if [ -f "$jacoco_xml" ]; then
        info "解析 JaCoCo XML 报告..."
        
        # 使用 Python 解析 XML
        if command -v python3 &> /dev/null; then
            local coverage_data
            coverage_data=$(python3 << EOF
import xml.etree.ElementTree as ET
import sys

try:
    tree = ET.parse('${jacoco_xml}')
    root = tree.getroot()
    
    # 获取总体覆盖率
    for counter in root.findall('.//counter'):
        type_attr = counter.get('type')
        missed = int(counter.get('missed', 0))
        covered = int(counter.get('covered', 0))
        total = missed + covered
        
        if total > 0:
            percent = (covered / total) * 100
            if type_attr == 'LINE':
                print(f"LINE:{percent:.1f}")
            elif type_attr == 'BRANCH':
                print(f"BRANCH:{percent:.1f}")
            elif type_attr == 'INSTRUCTION':
                print(f"INSTRUCTION:{percent:.1f}")
except Exception as e:
    print(f"ERROR:{e}", file=sys.stderr)
    sys.exit(1)
EOF
)
            
            while IFS= read -r line; do
                if [[ $line == LINE:* ]]; then
                    LINE_COVERAGE=$(echo "$line" | cut -d: -f2)
                elif [[ $line == BRANCH:* ]]; then
                    BRANCH_COVERAGE=$(echo "$line" | cut -d: -f2)
                elif [[ $line == INSTRUCTION:* ]]; then
                    INSTRUCTION_COVERAGE=$(echo "$line" | cut -d: -f2)
                fi
            done <<< "$coverage_data"
        fi
    elif [ -f "$jacoco_html" ]; then
        info "解析 JaCoCo HTML 报告..."
        # 从 HTML 中提取覆盖率
        LINE_COVERAGE=$(grep -oP 'Total[^%]+%' "$jacoco_html" 2>/dev/null | grep -oP '\d+%' | head -1 | tr -d '%' || echo 0)
    else
        warn "未找到 JaCoCo 报告，使用默认值"
    fi
    
    info "覆盖率 - 行: ${LINE_COVERAGE}%, 分支: ${BRANCH_COVERAGE}%, 指令: ${INSTRUCTION_COVERAGE}%"
}

# 解析测试报告
parse_test_results() {
    local surefire_dir="${BACKEND_DIR}/target/surefire-reports"
    
    # 默认值
    TEST_TOTAL=0
    TEST_PASSED=0
    TEST_FAILED=0
    TEST_SKIPPED=0
    TEST_DURATION=0
    
    if [ "$DRY_RUN" = true ]; then
        TEST_TOTAL=116
        TEST_PASSED=116
        TEST_FAILED=0
        TEST_SKIPPED=0
        TEST_DURATION=45
        return
    fi
    
    if [ -d "$surefire_dir" ]; then
        info "解析 Surefire 测试报告..."
        
        # 统计测试数量
        for xml_file in "${surefire_dir}"/*.xml; do
            if [ -f "$xml_file" ]; then
                local tests
                local failures
                local errors
                local skipped
                local time
                
                tests=$(grep -oP 'tests="\d+"' "$xml_file" | grep -oP '\d+' | head -1 || echo 0)
                failures=$(grep -oP 'failures="\d+"' "$xml_file" | grep -oP '\d+' | head -1 || echo 0)
                errors=$(grep -oP 'errors="\d+"' "$xml_file" | grep -oP '\d+' | head -1 || echo 0)
                skipped=$(grep -oP 'skipped="\d+"' "$xml_file" | grep -oP '\d+' | head -1 || echo 0)
                time=$(grep -oP 'time="[0-9.]+"' "$xml_file" | grep -oP '[0-9.]+' | head -1 || echo 0)
                
                TEST_TOTAL=$((TEST_TOTAL + tests))
                TEST_FAILED=$((TEST_FAILED + failures + errors))
                TEST_SKIPPED=$((TEST_SKIPPED + skipped))
                
                # 累加执行时间
                if command -v python3 &> /dev/null; then
                    TEST_DURATION=$(python3 -c "print(${TEST_DURATION} + ${time})")
                fi
            fi
        done
        
        TEST_PASSED=$((TEST_TOTAL - TEST_FAILED - TEST_SKIPPED))
        
        # 转换时间为整数秒
        if command -v python3 &> /dev/null; then
            TEST_DURATION=$(python3 -c "import math; print(math.ceil(${TEST_DURATION}))")
        else
            TEST_DURATION=${TEST_DURATION%.*}
        fi
    else
        warn "未找到 Surefire 报告目录"
    fi
    
    info "测试结果 - 总计: ${TEST_TOTAL}, 通过: ${TEST_PASSED}, 失败: ${TEST_FAILED}, 跳过: ${TEST_SKIPPED}"
}

# 解析 PMD 报告
parse_pmd() {
    local pmd_xml="${BACKEND_DIR}/target/pmd.xml"
    
    # 默认值
    PMD_VIOLATIONS=0
    
    if [ "$DRY_RUN" = true ]; then
        PMD_VIOLATIONS=0
        return
    fi
    
    if [ -f "$pmd_xml" ]; then
        info "解析 PMD 报告..."
        PMD_VIOLATIONS=$(grep -c '<violation' "$pmd_xml" 2>/dev/null || echo 0)
    else
        warn "未找到 PMD 报告"
    fi
    
    info "PMD 违规: ${PMD_VIOLATIONS}"
}

# 解析 SpotBugs 报告
parse_spotbugs() {
    local spotbugs_xml="${BACKEND_DIR}/target/spotbugsXml.xml"
    
    # 默认值
    SPOTBUGS_WARNINGS=0
    
    if [ "$DRY_RUN" = true ]; then
        SPOTBUGS_WARNINGS=0
        return
    fi
    
    if [ -f "$spotbugs_xml" ]; then
        info "解析 SpotBugs 报告..."
        SPOTBUGS_WARNINGS=$(grep -c '<BugInstance' "$spotbugs_xml" 2>/dev/null || echo 0)
    else
        warn "未找到 SpotBugs 报告"
    fi
    
    info "SpotBugs 警告: ${SPOTBUGS_WARNINGS}"
}

# 统计代码量
count_code_metrics() {
    local src_dir="${BACKEND_DIR}/src/main/java"
    
    # 默认值
    CODE_FILES=0
    CODE_LINES=0
    CODE_CLASSES=0
    CODE_METHODS=0
    
    if [ "$DRY_RUN" = true ]; then
        CODE_FILES=345
        CODE_LINES=25000
        CODE_CLASSES=450
        CODE_METHODS=1800
        return
    fi
    
    if command -v cloc &> /dev/null; then
        info "使用 cloc 统计代码量..."
        local cloc_output
        cloc_output=$(cloc --quiet --json "${src_dir}" 2>/dev/null || echo '{}')
        
        if command -v jq &> /dev/null; then
            CODE_FILES=$(echo "$cloc_output" | jq '.Java.code // 0' 2>/dev/null || echo 0)
            CODE_LINES=$(echo "$cloc_output" | jq '.SUM.code // 0' 2>/dev/null || echo 0)
        fi
    fi
    
    # 统计 Java 文件数
    if [ -d "$src_dir" ]; then
        CODE_FILES=$(find "$src_dir" -name "*.java" | wc -l | tr -d ' ')
        
        # 统计类和方法数（近似）
        CODE_CLASSES=$(grep -r "^\s*\(public\|private\|protected\)\?\s*\(class\|interface\|enum\)" "$src_dir" --include="*.java" 2>/dev/null | wc -l | tr -d ' ' || echo 0)
        CODE_METHODS=$(grep -r "^\s*\(public\|private\|protected\)\s.*(" "$src_dir" --include="*.java" 2>/dev/null | wc -l | tr -d ' ' || echo 0)
    fi
    
    info "代码统计 - 文件: ${CODE_FILES}, 类: ${CODE_CLASSES}, 方法: ${CODE_METHODS}"
}

# 生成 JSON 报告
generate_report() {
    info "生成质量指标报告..."
    
    # 确保输出目录存在
    mkdir -p "${OUTPUT_DIR}"
    
    # 构建 JSON
    cat > "${OUTPUT_FILE}" << EOF
{
  "week": "${WEEK}",
  "date": "${DATE}",
  "timestamp": "${TIMESTAMP}",
  "project": "koduck-backend",
  "version": "0.1.0-SNAPSHOT",
  "metrics": {
    "tests": {
      "total": ${TEST_TOTAL},
      "passed": ${TEST_PASSED},
      "failed": ${TEST_FAILED},
      "skipped": ${TEST_SKIPPED},
      "duration_seconds": ${TEST_DURATION},
      "pass_rate": $(awk "BEGIN {printf \"%.1f\", (${TEST_TOTAL} > 0 ? ${TEST_PASSED} / ${TEST_TOTAL} * 100 : 0)}")
    },
    "coverage": {
      "line_percent": ${LINE_COVERAGE},
      "branch_percent": ${BRANCH_COVERAGE},
      "instruction_percent": ${INSTRUCTION_COVERAGE}
    },
    "static_analysis": {
      "pmd_violations": ${PMD_VIOLATIONS},
      "spotbugs_warnings": ${SPOTBUGS_WARNINGS}
    },
    "code": {
      "files": ${CODE_FILES},
      "lines": ${CODE_LINES},
      "classes": ${CODE_CLASSES},
      "methods": ${CODE_METHODS}
    }
  }
}
EOF
    
    success "报告已生成: ${OUTPUT_FILE}"
}

# 对比历史趋势
show_trend() {
    info "历史趋势对比..."
    
    local current_week=$(date +%Y-W%V)
    local prev_weeks=()
    
    for i in 1 2 3 4; do
        local prev_date
        prev_date=$(date -v-${i}w +%Y-%m-%d 2>/dev/null || date -d "-${i} weeks" +%Y-%m-%d 2>/dev/null || echo "")
        if [ -n "$prev_date" ]; then
            prev_weeks+=("${OUTPUT_DIR}/quality-metrics-${prev_date}.json")
        fi
    done
    
    echo ""
    echo "=========================================="
    echo "           质量指标趋势 (最近4周)          "
    echo "=========================================="
    printf "%-12s | %-6s | %-6s | %-6s | %-6s\n" "日期" "测试" "行覆盖" "PMD" "SpotBugs"
    echo "-------------|--------|--------|--------|----------"
    
    # 显示历史数据
    for prev_file in "${prev_weeks[@]}"; do
        if [ -f "$prev_file" ]; then
            if command -v jq &> /dev/null; then
                local p_date p_tests p_line p_pmd p_spot
                p_date=$(jq -r '.date' "$prev_file")
                p_tests=$(jq '.metrics.tests.total' "$prev_file")
                p_line=$(jq '.metrics.coverage.line_percent' "$prev_file")
                p_pmd=$(jq '.metrics.static_analysis.pmd_violations' "$prev_file")
                p_spot=$(jq '.metrics.static_analysis.spotbugs_warnings' "$prev_file")
                printf "%-12s | %-6s | %-5.1f%% | %-6s | %-8s\n" "$p_date" "$p_tests" "$p_line" "$p_pmd" "$p_spot"
            fi
        fi
    done
    
    # 显示当前数据
    if [ -f "$OUTPUT_FILE" ]; then
        if command -v jq &> /dev/null; then
            local c_tests c_line c_pmd c_spot
            c_tests=$(jq '.metrics.tests.total' "$OUTPUT_FILE")
            c_line=$(jq '.metrics.coverage.line_percent' "$OUTPUT_FILE")
            c_pmd=$(jq '.metrics.static_analysis.pmd_violations' "$OUTPUT_FILE")
            c_spot=$(jq '.metrics.static_analysis.spotbugs_warnings' "$OUTPUT_FILE")
            printf "%-12s | %-6s | %-5.1f%% | %-6s | %-8s | ← 当前\n" "$DATE" "$c_tests" "$c_line" "$c_pmd" "$c_spot"
        fi
    fi
    
    echo "=========================================="
}

# 主流程
main() {
    echo "=========================================="
    echo "        质量指标采集脚本 v1.0             "
    echo "=========================================="
    echo "日期: ${DATE}"
    echo "周次: ${WEEK}"
    echo "输出: ${OUTPUT_FILE}"
    echo "=========================================="
    echo ""
    
    check_dependencies
    
    if [ "$SKIP_TESTS" = false ]; then
        run_tests
        run_pmd
        run_spotbugs
    fi
    
    parse_jacoco
    parse_test_results
    parse_pmd
    parse_spotbugs
    count_code_metrics
    
    generate_report
    
    echo ""
    show_trend
    
    echo ""
    success "质量指标采集完成!"
    
    if [ "$DRY_RUN" = true ]; then
        echo ""
        warn "注意: 本次为模拟运行 (--dry-run)，数据为示例值"
    fi
}

main "$@"
