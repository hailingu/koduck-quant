#!/bin/bash
# 架构违规检查脚本

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║              模块边界与依赖违规检查                        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

VIOLATIONS=0

# 1. 检查 Repository 层是否调用 Service 层
echo "📋 检查 1: Repository → Service 违规"
REPO_SERVICE=$(grep -r "import com.koduck.service" src/main/java/com/koduck/repository/ 2>/dev/null || true)
if [ -n "$REPO_SERVICE" ]; then
    echo "❌ 发现 repository -> service 违规:"
    echo "$REPO_SERVICE"
    VIOLATIONS=$((VIOLATIONS + 1))
else
    echo "✅ Repository 层干净"
fi
echo ""

# 2. 检查 Service 层是否调用 Controller 层
echo "📋 检查 2: Service → Controller 违规"
SERVICE_CONTROLLER=$(grep -r "import com.koduck.controller" src/main/java/com/koduck/service/ 2>/dev/null || true)
if [ -n "$SERVICE_CONTROLLER" ]; then
    echo "❌ 发现 service -> controller 违规:"
    echo "$SERVICE_CONTROLLER"
    VIOLATIONS=$((VIOLATIONS + 1))
else
    echo "✅ Service 层干净"
fi
echo ""

# 3. 检查 Entity 是否依赖 DTO
echo "📋 检查 3: Entity → DTO 违规"
ENTITY_DTO=$(grep -r "import com.koduck.dto" src/main/java/com/koduck/entity/ 2>/dev/null || true)
if [ -n "$ENTITY_DTO" ]; then
    echo "❌ 发现 entity -> dto 违规:"
    echo "$ENTITY_DTO"
    VIOLATIONS=$((VIOLATIONS + 1))
else
    echo "✅ Entity 层干净"
fi
echo ""

# 4. 检查 Mapper 是否依赖 Service（应该只依赖 Entity/DTO）
echo "📋 检查 4: Mapper → Service 违规"
MAPPER_SERVICE=$(grep -r "import com.koduck.service" src/main/java/com/koduck/mapper/ 2>/dev/null || true)
if [ -n "$MAPPER_SERVICE" ]; then
    echo "❌ 发现 mapper -> service 违规:"
    echo "$MAPPER_SERVICE"
    VIOLATIONS=$((VIOLATIONS + 1))
else
    echo "✅ Mapper 层干净"
fi
echo ""

# 5. 统计各层文件数量
echo "📊 模块统计:"
echo "  Controller: $(find src/main/java/com/koduck/controller -name '*.java' 2>/dev/null | wc -l) 个文件"
echo "  Service:    $(find src/main/java/com/koduck/service -name '*.java' 2>/dev/null | wc -l) 个文件"
echo "  Repository: $(find src/main/java/com/koduck/repository -name '*.java' 2>/dev/null | wc -l) 个文件"
echo "  Entity:     $(find src/main/java/com/koduck/entity -name '*.java' 2>/dev/null | wc -l) 个文件"
echo "  DTO:        $(find src/main/java/com/koduck/dto -name '*.java' 2>/dev/null | wc -l) 个文件"
echo ""

# 6. 检查循环依赖（简单检查）
echo "📋 检查 5: 潜在循环依赖（Service 互相导入）"
SERVICE_IMPORTS=$(grep -h "import com.koduck.service" src/main/java/com/koduck/service/*.java 2>/dev/null | sort | uniq -c | sort -rn | head -10)
if [ -n "$SERVICE_IMPORTS" ]; then
    echo "Service 层内部依赖 Top 10:"
    echo "$SERVICE_IMPORTS"
else
    echo "✅ 未发现复杂 Service 间依赖"
fi
echo ""

# 结果汇总
echo "════════════════════════════════════════════════════════════"
if [ $VIOLATIONS -eq 0 ]; then
    echo "✅ 检查通过，未发现架构违规"
    exit 0
else
    echo "❌ 发现 $VIOLATIONS 处架构违规，请修复"
    exit 1
fi
