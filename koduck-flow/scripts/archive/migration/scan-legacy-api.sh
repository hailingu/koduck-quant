#!/bin/bash
set -e

echo "🔍 Scanning for legacy deity API usage..."
echo "========================================"

# 定义颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 创建输出目录
REPORT_DIR="migration-reports"
mkdir -p "$REPORT_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$REPORT_DIR/migration-report-$TIMESTAMP.txt"
STATS_FILE="$REPORT_DIR/migration-stats-$TIMESTAMP.json"

# 扫描deity直接引用
echo -e "\n${BLUE}📦 Scanning direct deity imports...${NC}"
DEITY_IMPORTS=$(grep -rn "import.*deity.*from\|import.*\bdeity\b" src/ 2>/dev/null || echo "")
DEITY_IMPORTS_COUNT=$(echo "$DEITY_IMPORTS" | grep -c "." || echo "0")
echo "Found: $DEITY_IMPORTS_COUNT instances"
echo "$DEITY_IMPORTS" | head -20

# 扫描deity使用
echo -e "\n${BLUE}🎯 Scanning deity usage...${NC}"
DEITY_USAGE=$(grep -rn "deity\." src/ 2>/dev/null || echo "")
DEITY_USAGE_COUNT=$(echo "$DEITY_USAGE" | grep -c "." || echo "0")
echo "Found: $DEITY_USAGE_COUNT instances"
echo "$DEITY_USAGE" | head -20

# 扫描getDeity调用
echo -e "\n${BLUE}🔧 Scanning getDeity() calls...${NC}"
GET_DEITY_CALLS=$(grep -rn "getDeity()" src/ 2>/dev/null || echo "")
GET_DEITY_COUNT=$(echo "$GET_DEITY_CALLS" | grep -c "." || echo "0")
echo "Found: $GET_DEITY_COUNT instances"
echo "$GET_DEITY_CALLS" | head -20

# 扫描legacyDeity引用
echo -e "\n${BLUE}⚠️  Scanning legacyDeity usage...${NC}"
LEGACY_DEITY=$(grep -rn "legacyDeity" src/ 2>/dev/null || echo "")
LEGACY_DEITY_COUNT=$(echo "$LEGACY_DEITY" | grep -c "." || echo "0")
echo "Found: $LEGACY_DEITY_COUNT instances"
echo "$LEGACY_DEITY" | head -20

# 扫描globalKoduckFlowRuntime
echo -e "\n${BLUE}🌐 Scanning globalKoduckFlowRuntime usage...${NC}"
GLOBAL_RUNTIME=$(grep -rn "globalKoduckFlowRuntime" src/ 2>/dev/null || echo "")
GLOBAL_RUNTIME_COUNT=$(echo "$GLOBAL_RUNTIME" | grep -c "." || echo "0")
echo "Found: $GLOBAL_RUNTIME_COUNT instances"

# 扫描已使用KoduckFlowProvider的文件
echo -e "\n${GREEN}✅ Scanning KoduckFlowProvider usage...${NC}"
PROVIDER_USAGE=$(grep -rn "KoduckFlowProvider\|useKoduckFlowRuntime" src/ 2>/dev/null || echo "")
PROVIDER_COUNT=$(echo "$PROVIDER_USAGE" | grep -c "." || echo "0")
echo "Found: $PROVIDER_COUNT instances"

# 统计总数
echo -e "\n${YELLOW}📊 Summary:${NC}"
echo "  - deity imports:           $DEITY_IMPORTS_COUNT"
echo "  - deity usage:             $DEITY_USAGE_COUNT"
echo "  - getDeity calls:          $GET_DEITY_COUNT"
echo "  - legacyDeity:             $LEGACY_DEITY_COUNT"
echo "  - globalKoduckFlowRuntime:   $GLOBAL_RUNTIME_COUNT"
echo "  - KoduckFlowProvider usage:  $PROVIDER_COUNT"

TOTAL_LEGACY=$((DEITY_IMPORTS_COUNT + DEITY_USAGE_COUNT + GET_DEITY_COUNT + LEGACY_DEITY_COUNT + GLOBAL_RUNTIME_COUNT))
echo -e "\n${RED}Total legacy API usage: $TOTAL_LEGACY${NC}"

# 生成详细报告
{
  echo "Koduck Flow API Migration Report"
  echo "Generated: $(date)"
  echo "========================================"
  echo ""
  echo "DEITY IMPORTS:"
  echo "$DEITY_IMPORTS"
  echo ""
  echo "DEITY USAGE:"
  echo "$DEITY_USAGE"
  echo ""
  echo "GET_DEITY CALLS:"
  echo "$GET_DEITY_CALLS"
  echo ""
  echo "LEGACY_DEITY:"
  echo "$LEGACY_DEITY"
  echo ""
  echo "GLOBAL_RUNTIME:"
  echo "$GLOBAL_RUNTIME"
  echo ""
  echo "PROVIDER USAGE:"
  echo "$PROVIDER_USAGE"
} > "$REPORT_FILE"

# 生成JSON统计数据
cat > "$STATS_FILE" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "statistics": {
    "deityImports": $DEITY_IMPORTS_COUNT,
    "deityUsage": $DEITY_USAGE_COUNT,
    "getDeityCalls": $GET_DEITY_COUNT,
    "legacyDeity": $LEGACY_DEITY_COUNT,
    "globalRuntime": $GLOBAL_RUNTIME_COUNT,
    "totalLegacy": $TOTAL_LEGACY,
    "providerUsage": $PROVIDER_COUNT
  },
  "files": {
    "detailedReport": "$REPORT_FILE",
    "statsFile": "$STATS_FILE"
  }
}
EOF

echo -e "\n${GREEN}✅ Reports generated:${NC}"
echo "  - Detailed report: $REPORT_FILE"
echo "  - Statistics JSON: $STATS_FILE"

# 按文件分组统计
echo -e "\n${YELLOW}📁 Top files with legacy API usage:${NC}"
if [ -n "$DEITY_USAGE" ]; then
  echo "$DEITY_USAGE" | awk -F: '{print $1}' | sort | uniq -c | sort -rn | head -10
fi

# 风险评估
echo -e "\n${YELLOW}⚠️  Risk Assessment:${NC}"
if [ $TOTAL_LEGACY -gt 100 ]; then
  echo "  ${RED}HIGH RISK${NC}: $TOTAL_LEGACY legacy API usages detected"
  echo "  Recommendation: Allocate 6-8 weeks for migration"
elif [ $TOTAL_LEGACY -gt 50 ]; then
  echo "  ${YELLOW}MEDIUM RISK${NC}: $TOTAL_LEGACY legacy API usages detected"
  echo "  Recommendation: Allocate 4-6 weeks for migration"
else
  echo "  ${GREEN}LOW RISK${NC}: $TOTAL_LEGACY legacy API usages detected"
  echo "  Recommendation: Allocate 2-4 weeks for migration"
fi

echo -e "\n${GREEN}✅ Scan complete!${NC}"
