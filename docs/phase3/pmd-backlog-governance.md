# Phase 3 PMD 批次治理任务清单

> 目标 Issue: #254（P3-05 PMD 存量治理机制）
> 
> 本文档记录从 Phase 2 延期的 PMD 规则治理计划，采用"新增零容忍 + 存量分批清偿"策略。

---

## 1. 延期规则清单（Phase 2 → Phase 3）

以下规则因高噪声/高问题数在 Phase 2 中延期，纳入 Phase 3 分批治理：

| 规则名 | 规则集 | 预估问题数 | 延期原因 | 治理价值 |
|--------|--------|-----------|----------|----------|
| `MethodArgumentCouldBeFinal` | codestyle | 0（已完成） | 已在 Batch 1 收口 | 提升不变性语义 |
| `LocalVariableCouldBeFinal` | codestyle | ~2200 | 高频低价值 | 提升不变性语义 |
| `CommentRequired` | documentation | ~1500 | 需人工判断 | 提升文档覆盖率 |
| **合计** | - | **~5500** | - | - |

---

## 2. 批次清偿计划

### 2.1 批次总览

| 批次 | 规则 | 预估问题数 | 时间窗口 | Owner | 验收标准 |
|------|------|-----------|----------|-------|----------|
| Batch 1 | `MethodArgumentCouldBeFinal` | 0（已清零） | 2026-04-07 ~ 2026-04-13 | @dev-team | 该规则违规 = 0 |
| Batch 2 | `LocalVariableCouldBeFinal` | ~2200 | 2026-04-14 ~ 2026-04-20 | @dev-team | 该规则违规 = 0 |
| Batch 3 | `CommentRequired` | ~1500 | 2026-04-21 ~ 2026-04-27 | @doc-team | 核心类注释覆盖 |
| Batch 4 | 遗留杂项清理 | ~500 | 2026-04-28 ~ 2026-05-04 | @dev-team | P3 规则集违规 = 0 |

### 2.2 详细批次规划

#### Batch 1: MethodArgumentCouldBeFinal

- **时间窗口**: 2026-04-07（周一）~ 2026-04-13（周日）
- **Owner**: @dev-team
- **预估问题数**: ~1800
- **治理方式**: IDE 自动修复 + 人工 review
- **具体步骤**:
  1. 在 IDE 中启用 "Make method argument final" 意图动作
  2. 按模块分批处理，每批 200-300 个文件
  3. 每批处理完成后运行测试确保无回归
  4. 合并前进行代码审查
- **风险控制**:
  - 避免修改接口方法参数（可能影响实现类）
  - 修改后全量测试通过方可合并
- **验收标准**:
  - [ ] `MethodArgumentCouldBeFinal` 违规数 = 0
  - [ ] 所有修改通过代码审查
  - [ ] 全量测试通过

#### Batch 2: LocalVariableCouldBeFinal

- **时间窗口**: 2026-04-14（周一）~ 2026-04-20（周日）
- **Owner**: @dev-team
- **预估问题数**: ~2200
- **治理方式**: IDE 自动修复 + 人工 review
- **具体步骤**:
  1. 在 IDE 中启用 "Make local variable final" 意图动作
  2. 按模块分批处理，每批 300-400 个文件
  3. 优先处理核心 Service 类，再处理工具类
  4. 每批处理完成后运行测试确保无回归
- **风险控制**:
  - 注意 lambda 表达式中的变量捕获
  - 避免对可能重新赋值的变量误加 final
- **验收标准**:
  - [ ] `LocalVariableCouldBeFinal` 违规数 = 0
  - [ ] 所有修改通过代码审查
  - [ ] 全量测试通过

#### Batch 3: CommentRequired

- **时间窗口**: 2026-04-21（周一）~ 2026-04-27（周日）
- **Owner**: @doc-team
- **预估问题数**: ~1500
- **治理方式**: 人工补充 + 模板化
- **优先级**:
  1. P0: 所有 public/protected 类和方法（影响 API 文档）
  2. P1: 复杂业务逻辑方法
  3. P2: 简单 getter/setter（可考虑 @SuppressWarnings）
- **注释模板**:
  ```java
  /**
   * [方法功能简述].
   *
   * @param paramName 参数说明
   * @return 返回值说明
   * @throws ExceptionType 异常说明
   */
  ```
- **验收标准**:
  - [ ] 核心类（Service/Controller/Repository）注释覆盖率 100%
  - [ ] 公共 API 方法均有 Javadoc
  - [ ] 遗留未处理项有明确原因记录

#### Batch 4: 遗留杂项清理

- **时间窗口**: 2026-04-28（周一）~ 2026-05-04（周日）
- **Owner**: @dev-team
- **预估问题数**: ~500
- **治理内容**:
  - 前三个批次遗漏的个别问题
  - 新增的其他 codestyle 问题
  - 规则集升级后的新检测项
- **验收标准**:
  - [ ] `ruleset-phase3.xml` 全量扫描违规 = 0
  - [ ] `mvn pmd:check` 通过

---

## 3. 验收标准汇总

### 3.1 DoD 检查清单

- [ ] **新增零容忍**: 新增 PMD 阻断级问题 = 0（持续保持）
- [ ] **周维度进展**: 每周更新 `docs/static-analysis.md` 进度追踪表
- [ ] **延期项管理**: 每个批次具备明确 owner 和截止时间
- [ ] **最终验收**: Phase 3 结束时 `ruleset-phase3.xml` 违规 = 0

### 3.2 质量门禁

| 阶段 | 触发条件 | 检查内容 | 阻断条件 |
|------|----------|----------|----------|
| PR 创建 | 自动 | PMD 增量扫描 | 新增违规 > 0 |
| 每日构建 | 定时 | PMD 全量扫描 | P1 违规 > 0 |
| 周度回顾 | 手动 | 存量治理进度 | 进度偏差 > 20% |

### 3.3 Ratchet 非回退守门（P0）

- 基线文件：`koduck-backend/config/pmd/debt-baseline.txt`（当前存量上限）
- 守门脚本：`koduck-backend/scripts/pmd-debt-guard.sh`
- CI 工作流：`.github/workflows/ci-pmd-debt-guard.yml`

机制说明：

- 任一 PR/Push 若 PMD 总量高于基线，则 CI 失败；
- 仅允许“持平或下降”，确保存量治理不回退；
- 每个治理批次完成后，可通过 `--update-baseline` 将基线下调。

---

## 4. 进度追踪（按 2026-04-01 基线更新）

### 4.1 批次完成状态

| 批次 | Owner | 计划开始 | 计划完成 | 实际开始 | 实际完成 | 已完成数量（截至 2026-04-01） | 状态 | 备注 |
|------|-------|----------|----------|----------|----------|----------------------------|------|------|
| Batch 1 | @dev-team | 04/07 | 04/13 | 04/02 | 04/02 | 已完成（违规 0） | 🟢 已完成 | 规则已启用，基线已下调 |
| Batch 2 | @dev-team | 04/14 | 04/20 | - | - | 0 / ~2200 | ⚪ 待开始 | 规则: `LocalVariableCouldBeFinal` |
| Batch 3 | @doc-team | 04/21 | 04/27 | - | - | 0 / ~1500 | ⚪ 待开始 | 规则: `CommentRequired` |
| Batch 4 | @dev-team | 04/28 | 05/04 | - | - | 0 / ~500 | ⚪ 待开始 | 遗留杂项 |

> 状态说明: ⚪ 待开始 | 🟡 进行中 | 🟢 已完成 | 🔴 延期

### 4.2 每周更新记录

#### Week 0 (2026-04-01 基线周)

- **目标**: 建立批次台账与责任人、确保门禁稳定
- **进展**:
  - [x] 四个批次 owner/计划窗口已明确
  - [x] 已建立“计划 vs 实际”追踪字段
  - [x] `mvn -q -f koduck-backend/pom.xml pmd:check` 通过
- **问题与风险**:
  - 存量清偿尚未启动，当前为治理准备阶段

#### Week 1 (2026-04-02 执行补记)

- **目标**: Batch 1 完成
- **进展**:
  - [x] 取消 `ruleset-phase2.xml` 对 `MethodArgumentCouldBeFinal` 的排除
  - [x] 全量 PMD 复验该规则违规数 = 0
  - [x] PMD 存量基线由 9951 下调至 0（`debt-baseline.txt`）
- **问题与风险**:
  - Batch 2/3/4 尚未执行，需保持周度追踪

#### Week 1 (2026-04-07 ~ 2026-04-13)

- **目标**: Batch 1 完成
- **进展**:
  - [ ] 待执行后回填
- **问题与风险**:
  - [ ] 待执行后回填

#### Week 2 (2026-04-14 ~ 2026-04-20)

- **目标**: Batch 2 完成
- **进展**:
  - [ ] 待执行后回填

#### Week 3 (2026-04-21 ~ 2026-04-27)

- **目标**: Batch 3 完成
- **进展**:
  - [ ] 待执行后回填

#### Week 4 (2026-04-28 ~ 2026-05-04)

- **目标**: Batch 4 完成，Phase 3 收官
- **进展**:
  - [ ] 待执行后回填

---

## 5. 关联文档

| 文档 | 路径 | 说明 |
|------|------|------|
| 静态分析治理总览 | `docs/static-analysis.md` | Phase 2/3 完整记录 |
| Phase 3 输入清单 | `docs/phase2/phase3-input.md` | Phase 2 复盘输入 |
| PMD 规则集 | `koduck-backend/config/pmd/ruleset-phase2.xml` | 当前规则集 |
| PMD Phase 3 规则集 | `koduck-backend/config/pmd/ruleset-phase3.xml` | 规划中完整规则集 |

---

## 6. 附录

### 6.1 复验命令

```bash
# 切换到 worktree 目录
cd /Users/guhailin/Git/worktree-254-pmd

# 全量 PMD 扫描
mvn -q -f koduck-backend/pom.xml pmd:pmd

# 查看违规统计
echo "Total violations: $(grep -c '<violation' koduck-backend/target/pmd.xml)"

# 按规则分组统计
grep '<violation' koduck-backend/target/pmd.xml | \
  sed 's/.*rule="\([^"]*\)".*/\1/' | \
  sort | uniq -c | sort -rn

# 阻断检查
mvn -q -f koduck-backend/pom.xml pmd:check

# 存量非回退检查（Ratchet）
./koduck-backend/scripts/pmd-debt-guard.sh

# 存量下降后下调基线
./koduck-backend/scripts/pmd-debt-guard.sh --update-baseline
```

### 6.2 责任人联系

| 角色 | 负责人 | 职责 |
|------|--------|------|
| 开发团队 | @dev-team | Batch 1/2/4 代码治理 |
| 文档团队 | @doc-team | Batch 3 注释补充 |
| 技术负责人 | @tech-lead | 整体进度把控、风险决策 |

---

*最后更新: 2026-04-02*
