#!/bin/bash
# 架构改进计划 Issues 批量创建脚本
# 使用: ./scripts/create-architecture-issues.sh

set -e

echo "=== 创建架构改进计划 Issues ==="
echo ""

# 检查 gh 是否登录
if ! gh auth status &>/dev/null; then
    echo "错误: 请先使用 'gh auth login' 登录 GitHub"
    exit 1
fi

REPO="hailingu/koduck-quant"

# Issue 1: Phase 1.1 - 创建 koduck-market-api 模块
echo "创建 Issue 1: [Architecture] Phase 1.1 - 创建 koduck-market-api 模块..."
gh issue create --repo "$REPO" \
    --title "[Architecture] Phase 1.1 - 创建 koduck-market-api 模块" \
    --label "enhancement,architecture" \
    --body "## 功能描述

创建 Market 领域的 API 模块，作为架构改进计划 Phase 1 的第一个任务。

### 背景

根据 ARCHITECTURE-EVALUATION.md 的分析，当前架构存在以下问题：
- \`koduck-core\` 成为\"上帝模块\"，承载全部业务逻辑
- 模块依赖方向混乱，存在循环依赖
- 需要通过 ACL（防腐层）解耦模块间依赖

### 目标

建立清晰的 API 模块边界，为后续模块拆分奠定基础。

## 任务清单

- [ ] 创建 \`koduck-backend/koduck-market/koduck-market-api/\` 目录结构
- [ ] 创建 \`pom.xml\`，继承 \`koduck-backend-parent\`
- [ ] 从 \`koduck-core\` 提取 \`MarketService\` 接口，拆分为 \`MarketQueryService\` + \`MarketCommandService\`
- [ ] 提取相关 DTO：\`MarketDataDto\`, \`KlineDto\`, \`IndicatorDto\`, \`RealTimePriceDto\`
- [ ] 创建防腐层接口 \`MarketDataAcl\`
- [ ] 创建领域事件 \`MarketDataUpdatedEvent\`
- [ ] 创建领域异常 \`MarketDataException\`

## 验收标准

- [ ] \`mvn clean compile\` 成功
- [ ] 不包含任何 Spring 依赖（除 \`spring-context\` 用于事件）
- [ ] 所有 DTO 使用 Java Record 或 \`@Value\`
- [ ] 接口方法有完整 Javadoc
- [ ] ArchUnit 测试通过（如已引入）

## 预估工期

2 天

## 依赖

无（Phase 1 起始任务）

## 优先级

🔴 P0 - 高（架构基础设施）

## 关联文档

- koduck-backend/docs/ARCHITECTURE-EVALUATION.md
- koduck-backend/docs/ARCHITECTURE-IMPROVEMENT-PLAN.md
- koduck-backend/docs/ARCHITECTURE-TASKS.md

## 相关 Issue

- 父 Issue: #525, #526, #527, #528（模块迁移相关）"

echo "Issue 1 创建完成"
echo ""

# Issue 2: Phase 1.2 - 创建 koduck-portfolio-api 模块
echo "创建 Issue 2: [Architecture] Phase 1.2 - 创建 koduck-portfolio-api 模块..."
gh issue create --repo "$REPO" \
    --title "[Architecture] Phase 1.2 - 创建 koduck-portfolio-api 模块" \
    --label "enhancement,architecture" \
    --body "## 功能描述

创建 Portfolio 领域的 API 模块，定义投资组合管理的核心接口。

## 任务清单

- [ ] 创建 \`koduck-portfolio/koduck-portfolio-api/\` 目录
- [ ] 创建 \`pom.xml\`
- [ ] 提取 \`PortfolioService\` → \`PortfolioQueryService\` + \`PortfolioCommandService\`
- [ ] 提取 \`PositionService\` → \`PositionQueryService\` + \`PositionCommandService\`
- [ ] 提取 DTO：\`PortfolioDto\`, \`PortfolioSummaryDto\`, \`PositionDto\`, \`TransactionDto\`
- [ ] 创建 ACL 接口 \`PortfolioQueryService\`（供 AI 模块使用）
- [ ] 创建值对象 \`PortfolioSnapshot\`（不可变）

## 验收标准

- [ ] 编译成功
- [ ] DTO 全部不可变
- [ ] ACL 接口只暴露必要查询方法
- [ ] 接口方法有完整 Javadoc

## 预估工期

2 天

## 依赖

- #1 (Phase 1.1) - 参考结构

## 优先级

🔴 P0 - 高（架构基础设施）

## 关联文档

- koduck-backend/docs/ARCHITECTURE-IMPROVEMENT-PLAN.md
- 相关: #525, #526, #527, #528"

echo "Issue 2 创建完成"
echo ""

# Issue 3: Phase 1.3 - 引入 ArchUnit 架构测试
echo "创建 Issue 3: [Architecture] Phase 1.3 - 引入 ArchUnit 架构测试..."
gh issue create --repo "$REPO" \
    --title "[Architecture] Phase 1.3 - 引入 ArchUnit 架构测试" \
    --label "enhancement,architecture,testing" \
    --body "## 功能描述

引入 ArchUnit 框架，编写架构守护测试，确保改进后的架构不被破坏。

### 背景

根据架构评估报告，当前存在以下架构问题：
- 模块依赖方向混乱
- 缺乏架构守护机制
- 需要防止架构退化

## 任务清单

- [ ] 在父 POM 添加 ArchUnit 依赖
- [ ] 创建 \`koduck-bootstrap/src/test/java/com/koduck/architecture/\` 目录
- [ ] 编写 \`ApiModuleRulesTest\` - API 模块不依赖实现
- [ ] 编写 \`DomainDependencyRulesTest\` - 领域模块间不循环依赖
- [ ] 编写 \`LayeredArchitectureTest\` - 分层架构规则
- [ ] 编写 \`NamingConventionTest\` - 命名规范
- [ ] 创建 \`ArchitectureConstants.java\` 定义包结构常量

## ArchUnit 规则示例

\`\`\`java
@ArchTest
static final ArchRule apiModulesShouldNotDependOnImpl =
    noClasses()
        .that().resideInAPackage(\"..api..\")
        .should().dependOnClassesThat()
        .resideInAPackage(\"..impl..\")
        .because(\"API 模块只应包含接口和 DTO，不应依赖实现\");

@ArchTest
static final ArchRule domainModulesShouldBeFreeOfCycles =
    slices()
        .matching(\"com.koduck(*)..\")
        .should().beFreeOfCycles();
\`\`\`

## 验收标准

- [ ] ArchUnit 测试在 CI 中运行
- [ ] 所有现有代码通过基础规则检查
- [ ] 规则有清晰的中文注释说明
- [ ] 新增违规依赖时测试失败

## 预估工期

2 天

## 依赖

- Phase 1.1-1.5 完成结构定义

## 优先级

🔴 P0 - 高（架构基础设施）

## 关联文档

- koduck-backend/docs/ARCHITECTURE-IMPROVEMENT-PLAN.md
- [ArchUnit User Guide](https://www.archunit.org/userguide/html/000_Index.html)"

echo "Issue 3 创建完成"
echo ""

# Issue 4: Phase 2 - 迁移 Market 领域实现
echo "创建 Issue 4: [Architecture] Phase 2.1 - 迁移 Market 领域实现..."
gh issue create --repo "$REPO" \
    --title "[Architecture] Phase 2.1 - 迁移 Market 领域实现" \
    --label "enhancement,architecture,refactor" \
    --body "## 功能描述

创建 koduck-market-impl 模块，将 Market 相关实现从 koduck-core 迁移出来。

## 任务清单

- [ ] 创建 \`koduck-market/koduck-market-impl/\` 模块
- [ ] 创建 \`pom.xml\`，依赖 \`koduck-market-api\`
- [ ] 迁移 \`MarketServiceImpl\` 到 koduck-market-impl
- [ ] 迁移 Market 相关的 Repository 接口和实现
- [ ] 迁移 Market 相关的 Entity
- [ ] 确保实现类实现新 API 接口
- [ ] 补充单元测试（覆盖率 ≥ 60%）

## 验收标准

- [ ] \`mvn clean test\` 通过
- [ ] 单元测试覆盖率 ≥ 60%
- [ ] 无编译错误
- [ ] ArchUnit 测试通过

## 预估工期

3 天

## 依赖

- #1 (Phase 1.1) - koduck-market-api 完成

## 优先级

🔴 P0 - 高

## 关联文档

- koduck-backend/docs/ARCHITECTURE-IMPROVEMENT-PLAN.md
- koduck-backend/docs/ARCHITECTURE-PLAYBOOK.md"

echo "Issue 4 创建完成"
echo ""

# Issue 5: Phase 3 - 瘦身 koduck-core
echo "创建 Issue 5: [Architecture] Phase 3 - 瘦身 koduck-core 模块..."
gh issue create --repo "$REPO" \
    --title "[Architecture] Phase 3 - 瘦身 koduck-core 模块" \
    --label "enhancement,architecture,refactor" \
    --body "## 功能描述

移除 koduck-core 中的所有业务逻辑，仅保留跨领域协调，解决\"上帝模块\"问题。

### 当前状态

- koduck-core 代码行数: ~15,000 行
- 包含 Market/Portfolio/Strategy/Community/AI 全部 Service 实现
- 职责严重越界

### 目标

- koduck-core 代码行数 < 1,000 行
- 仅保留跨领域事务协调
- 所有业务逻辑下沉到各领域模块

## 任务清单

- [ ] 迁移剩余业务代码到对应领域模块
- [ ] 保留内容（仅以下）：
  - 跨领域事务协调服务
  - 全局配置（如需要）
  - 共享工具类（考虑移到 common）
- [ ] 删除已迁移的 Service、Repository、Entity
- [ ] 更新 \`koduck-core/pom.xml\`，移除不需要的依赖
- [ ] 验证 koduck-bootstrap 正常启动

## 验收标准

- [ ] koduck-core 代码行数 < 1,000
- [ ] 仅保留协调逻辑
- [ ] 编译通过，测试通过
- [ ] 启动正常

## 预估工期

3 天

## 依赖

- Phase 2 所有领域迁移完成

## 优先级

🔴 P0 - 高

## 关联文档

- koduck-backend/docs/ARCHITECTURE-EVALUATION.md
- koduck-backend/docs/ARCHITECTURE-IMPROVEMENT-PLAN.md"

echo "Issue 5 创建完成"
echo ""

echo "=== 核心 Issues 创建完成 ==="
echo ""
echo "已创建 5 个核心 Issues，更多 Issues 请手动创建或运行完整脚本。"
echo "查看所有 Issues: gh issue list --label architecture"
