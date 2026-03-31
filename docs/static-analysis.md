# 静态代码分析与治理文档

## 概述

本文档记录 koduck-backend 的 PMD 静态分析结果与治理计划。

## Phase 2 第一批治理

### 基线数据（2026-03-31）

| 类别 | 数量 | 占比 |
|------|------|------|
| **总问题数** | **9951** | 100% |
| CommentRequired | 3295 | 33.1% |
| MethodArgumentCouldBeFinal | 2442 | 24.5% |
| LocalVariableCouldBeFinal | 1491 | 15.0% |
| AvoidFieldNameMatchingMethodName | 617 | 6.2% |
| OnlyOneReturn | 473 | 4.8% |
| LongVariable | 454 | 4.6% |
| ShortVariable | 260 | 2.6% |
| GuardLogStatement | 186 | 1.9% |
| 其他 | 743 | 7.5% |

### 治理策略

#### 第一批（低风险，自动修复）

| 规则 | 数量 | 处理方式 | 预计修复 |
|------|------|----------|----------|
| UnnecessaryImport | 18 | IDE 自动优化 | 100% |
| ModifierOrder | 18 | IDE 自动重构 | 100% |
| UseDiamondOperator | 10 | IDE 自动重构 | 100% |

#### 第一批（低风险，批量处理）

| 规则 | 数量 | 处理方式 | 预计修复 |
|------|------|----------|----------|
| MethodArgumentCouldBeFinal | 2442 | IDE 批量添加 final | 100% |
| LocalVariableCouldBeFinal | 1491 | IDE 批量添加 final | 100% |

**小计**: 约 4000 处，治理后预计降低 **40%**

#### 第二批（中风险，人工审核）

| 规则 | 数量 | 处理方式 | 预计修复 |
|------|------|----------|----------|
| AvoidFieldNameMatchingMethodName | 617 | 评估后重命名 | 50% |
| OnlyOneReturn | 473 | 评估后重构 | 30% |
| LongVariable/ShortVariable | 714 | 评估后重命名 | 50% |

#### 第三批（高风险，延期处理）

| 规则 | 数量 | 延期原因 | 计划时间 |
|------|------|----------|----------|
| CommentRequired | 3295 | API 不稳定，待稳定后补充 | Phase 3 |
| AvoidCatchingGenericException | 65 | 需设计异常处理策略 | Phase 3 |
| CyclomaticComplexity | 26 | 需重构业务逻辑 | Phase 3 |
| GodClass | 16 | 需拆分大服务 | Phase 3 |

### 执行计划

```
第 1 周: 自动修复批次 (UnnecessaryImport, ModifierOrder, UseDiamondOperator)
第 2 周: final 修饰符批量处理 (MethodArgumentCouldBeFinal, LocalVariableCouldBeFinal)
第 3 周: 变量命名规范 (LongVariable, ShortVariable, AvoidFieldNameMatchingMethodName)
第 4 周: 代码结构优化 (OnlyOneReturn 评估)
```

### 检查命令

```bash
# 生成 PMD 报告
mvn pmd:pmd

# 查看 HTML 报告
open target/pmd.html

# 统计问题数量
grep -c '<violation' target/pmd.xml

# 查看特定规则问题
grep 'rule="CommentRequired"' target/pmd.xml | wc -l
```

### CI 集成

```yaml
# .github/workflows/pmd-check.yml
name: PMD Check
on: [pull_request]

jobs:
  pmd:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run PMD
        run: cd koduck-backend && mvn pmd:check
```

## 验收标准

- [ ] 总问题数下降 >= 30% (目标: 9951 → 6965)
- [ ] 无新增阻断级问题
- [ ] 高风险问题有明确延期计划
- [ ] 治理文档完整记录

## 历史记录

### Phase 2 第一批（进行中）

| 日期 | 操作 | 问题数变化 |
|------|------|------------|
| 2026-03-31 | 基线建立 | 9951 |
