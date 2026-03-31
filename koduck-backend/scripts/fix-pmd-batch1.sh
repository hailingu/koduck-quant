#!/bin/bash
# PMD 治理第一批：低风险自动修复

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║          PMD 治理第一批：低风险自动修复                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

cd "$(dirname "$0")/.."

# 统计修复前数量
echo "📊 修复前统计:"
mvn pmd:pmd -q
TOTAL_BEFORE=$(grep -c '<violation' target/pmd.xml)
echo "  总问题数: $TOTAL_BEFORE"
echo ""

# 1. 修复 UnnecessaryImport
echo "🔧 修复 1: 移除未使用导入 (UnnecessaryImport)"
UNUSED_IMPORT_COUNT=$(grep -c 'UnnecessaryImport' target/pmd.xml || echo 0)
echo "  发现 $UNUSED_IMPORT_COUNT 处未使用导入"
echo "  ⚠️ 请使用 IDE 自动优化导入 (Optimize Imports)"
echo ""

# 2. 修复 ModifierOrder
echo "🔧 修复 2: 修正修饰符顺序 (ModifierOrder)"
MODIFIER_ORDER_COUNT=$(grep -c 'ModifierOrder' target/pmd.xml || echo 0)
echo "  发现 $MODIFIER_ORDER_COUNT 处修饰符顺序问题"
if [ $MODIFIER_ORDER_COUNT -gt 0 ]; then
    # 简单替换：static final -> final static (错误顺序修正)
    # 注意：这只是示例，实际应该用 IDE 或更精确的脚本
    echo "  ⚠️ 请手动检查并修正: grep -r 'static final' src/main/java --include='*.java'"
fi
echo ""

# 3. 修复 UseDiamondOperator
echo "🔧 修复 3: 使用 Diamond Operator (UseDiamondOperator)"
DIAMOND_COUNT=$(grep -c 'UseDiamondOperator' target/pmd.xml || echo 0)
echo "  发现 $DIAMOND_COUNT 处可简化泛型"
echo "  ⚠️ 请使用 IDE 自动重构"
echo ""

# 4. 生成需人工审核的清单
echo "📋 需人工审核的高风险问题:"
echo ""

# CommentRequired - 需要补充文档
COMMENT_REQUIRED=$(grep -c 'CommentRequired' target/pmd.xml || echo 0)
echo "  CommentRequired: $COMMENT_REQUIRED 处"
echo "    建议: 优先为 public API 添加 Javadoc"
echo ""

# AvoidCatchingGenericException
GENERIC_EXCEPTION=$(grep -c 'AvoidCatchingGenericException' target/pmd.xml || echo 0)
echo "  AvoidCatchingGenericException: $GENERIC_EXCEPTION 处"
echo "    建议: 捕获具体异常类型，或记录后重新抛出"
echo ""

# CyclomaticComplexity
COMPLEXITY=$(grep -c 'CyclomaticComplexity' target/pmd.xml || echo 0)
echo "  CyclomaticComplexity: $COMPLEXITY 处"
echo "    建议: 提取方法，降低圈复杂度"
echo ""

# GodClass
GOD_CLASS=$(grep -c 'GodClass' target/pmd.xml || echo 0)
echo "  GodClass: $GOD_CLASS 处"
echo "    建议: 拆分类，单一职责原则"
echo ""

echo "════════════════════════════════════════════════════════════"
echo "✅ 第一批治理清单生成完成"
echo ""
echo "📁 报告位置: target/pmd.html"
echo "🎯 目标: 降低 30% 非阻断项"
echo ""
