# 静态分析治理记录

> 本文档记录 KODUCK-QUANT 后端代码静态分析（PMD）的治理历程，按 Phase 划分。

---

## Phase 2（已完成）

### 1. 目标与口径

- 目标 Issue: #238（P2-04 PMD 非阻断项分批治理）
- 检查口径: `koduck-backend/pom.xml` 中 PMD Phase 2 规则集（`config/pmd/ruleset-phase2.xml`）
- 阻断标准: PMD P1 违规必须为 0（`minimumPriority=1` + `pmd:check`）

### 2. 基线与当前结果

| 指标 | 基线（2026-03-31） | 当前（2026-04-01） | 变化 |
|------|-------------------|-------------------|------|
| PMD 违规总量（Phase 2 规则口径） | 9951 | 0 | -100% |
| PMD 阻断级（P1） | >0 | 0 | 达标 |
| `mvn pmd:check` | 失败 | 通过 | 达标 |

### 3. 本轮完成内容（2026-04-01）

- 修复 P1 风险项（构造期间可覆写方法调用、仅私有构造类 final 化、修饰符顺序等）
- 对日志常量命名统一为 `LOG`，消除 `FieldNamingConventions` 阻断
- 规则集保留高价值规则，延期高噪声规则到 Phase 3：
  - `CommentRequired`
  - `MethodArgumentCouldBeFinal`
  - `LocalVariableCouldBeFinal`

### 4. 复验命令

```bash
mvn -q -f koduck-backend/pom.xml pmd:pmd
grep -c "<violation" koduck-backend/target/pmd.xml
mvn -q -f koduck-backend/pom.xml pmd:check
```

### 5. DoD 对照（#238）

- [x] PMD 非阻断总量下降（>=30%）
- [x] 无新增阻断级问题
- [x] 延期项有明确责任人与时间窗口（见 `docs/phase3/pmd-backlog-governance.md`）

---

## Phase 3（进行中）

> 目标 Issue: #254（P3-05 PMD 存量治理机制）

### 1. 治理策略

#### 1.1 规则分级策略

| 级别 | 规则类别 | 治理策略 | 质量门禁 |
|------|----------|----------|----------|
| **阻断级 (P1)** | errorprone, bestpractices 中高风险 | 零容忍，必须清零 | `pmd:check` 强制阻断 |
| **高价值 (P2)** | design, performance, codestyle 核心项 | 存量分批清偿，新增零容忍 | PR 检查，超阈值阻断 |
| **低噪声 (P3)** | documentation, 可争议的 style 项 | 延后处理或禁用 | 人工审查 |

#### 1.2 新增零容忍策略

- **所有新增代码**必须满足：
  - PMD P1 违规 = 0（当前已达标，持续保持）
  - 新增 P2 违规 = 0（PR 阶段拦截）
- **PR 门禁增强**：
  - 每次 PR 触发 PMD 增量扫描
  - 新增违规 > 0 时 PR 阻断
  - 存量违规逐批递减（每周目标）

#### 1.3 存量清偿批次计划

延期自 Phase 2 的规则（高噪声但仍有价值）：

| 规则 | 预估问题数 | 批次 | 时间窗口 | Owner | 状态 |
|------|-----------|------|----------|-------|------|
| `MethodArgumentCouldBeFinal` | ~1800 | Batch 1 | 2026-04-07 ~ 2026-04-13 | @dev-team | 🟡 未开始 |
| `LocalVariableCouldBeFinal` | ~2200 | Batch 2 | 2026-04-14 ~ 2026-04-20 | @dev-team | ⚪ 待开始 |
| `CommentRequired` | ~1500 | Batch 3 | 2026-04-21 ~ 2026-04-27 | @doc-team | ⚪ 待开始 |
| 遗留杂项清理 | ~500 | Batch 4 | 2026-04-28 ~ 2026-05-04 | @dev-team | ⚪ 待开始 |

> 详细批次计划见：`docs/phase3/pmd-backlog-governance.md`

### 2. 周治理进度追踪表

| 周次 | 日期范围 | 批次 | 目标清理数 | 实际清理数 | 存量剩余 | 负责人 | 状态 |
|------|----------|------|-----------|-----------|----------|--------|------|
| W1 | 04/07 ~ 04/13 | Batch 1 | 1800 | - | - | @dev-team | 🟡 计划中 |
| W2 | 04/14 ~ 04/20 | Batch 2 | 2200 | - | - | @dev-team | ⚪ 待开始 |
| W3 | 04/21 ~ 04/27 | Batch 3 | 1500 | - | - | @doc-team | ⚪ 待开始 |
| W4 | 04/28 ~ 05/04 | Batch 4 | 500 | - | - | @dev-team | ⚪ 待开始 |

### 3. 验收标准

- [ ] 新增 PMD 阻断级问题 = 0（保持现状）
- [ ] 存量治理有周维度进展记录（本表每周更新）
- [ ] 延期项具备 owner 与截止时间（见批次计划）
- [ ] Phase 3 结束时 `ruleset-phase3.xml` 违规 = 0

### 4. 复验命令

```bash
# 全量扫描
mvn -q -f koduck-backend/pom.xml pmd:pmd

# 查看违规数
grep -c "<violation" koduck-backend/target/pmd.xml

# 阻断检查
mvn -q -f koduck-backend/pom.xml pmd:check

# 增量扫描（PR 用）
mvn -q -f koduck-backend/pom.xml pmd:pmd -Dpmd.printFailingErrors=true
```

---

## 附录

### 规则集文件

| Phase | 规则集文件 | 说明 |
|-------|-----------|------|
| Phase 2 | `koduck-backend/config/pmd/ruleset-phase2.xml` | 高价值规则，已清零 |
| Phase 3 | `koduck-backend/config/pmd/ruleset-phase3.xml` | 完整规则集（规划中） |

### 关联文档

- [Phase 3 PMD 批次治理任务清单](./phase3/pmd-backlog-governance.md)
- [Phase 2 复盘输入](./phase2/phase3-input.md)
