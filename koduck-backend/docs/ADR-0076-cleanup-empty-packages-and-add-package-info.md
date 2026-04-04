# ADR-0076: 清理空包并补充 package-info.java

- Status: Accepted
- Date: 2026-04-04
- Issue: #446

## Context

`ARCHITECTURE-EVALUATION.md` 将"空壳包误导"列为代码组织缺陷：

| 包路径 | 状态 | 问题 |
|--------|------|------|
| `com.koduck.identity` | 完全空包（0 个文件，Git 未跟踪） | 给开发者造成"已规划但未实现"的错觉 |
| `com.koduck.trading` | 完全空包（0 个文件，Git 未跟踪） | 同上 |
| `com.koduck.strategy` | 顶层目录为空 | 看起来像是空壳模块，但实际上 `controller/strategy/`、`entity/strategy/`、`service/impl/strategy/`、`repository/strategy/`、`dto/strategy/` 均已存在且有代码 |

这些空目录不仅不能通过编译产出类文件，还会在 IDE 包视图中留下无意义的节点，降低导航效率并增加新成员的认知负担。

## Decision

### 1. 删除完全空包 `identity/` 和 `trading/`

`com.koduck.identity` 和 `com.koduck.trading` 在 Git 中没有任何跟踪文件，也没有任何类引用它们。直接删除对应的物理目录，零编译风险。

### 2. 为 `com.koduck.strategy` 添加 `package-info.java`

由于 `strategy` 的子包（`controller/strategy`、`entity/strategy` 等）已经存在大量代码，父目录在文件系统上必然存在。删除父目录不可行（操作系统/文件系统会在子目录存在时自动重建它）。因此，选择添加 `package-info.java` 明确说明该包的定位：

- 它是策略模块的根命名空间
- 实际的 Controller、Entity、Service 实现、Repository、DTO 分别位于对应的子包中
- 未来若引入策略引擎核心类（如 `StrategyEngine`），可直接放置于此包

## Consequences

### 正向影响

- **消除误导**：开发者不会再看到没有任何内容的 `identity/` 和 `trading/` 空包
- **文档化意图**：`package-info.java` 为 `strategy` 包的现状和未来规划提供了显式说明
- **改善导航**：IDE 包视图中减少了无意义的折叠节点

### 兼容性影响

- **零 API 变更**：不涉及任何类、接口、HTTP 端点或数据库结构的修改
- **零编译影响**：删除的目录原本就没有文件，编译产物不变
- **Git 历史**：删除空目录不会影响任何文件的历史记录

## Alternatives Considered

1. **在 `identity/` 和 `trading/` 中也添加 `package-info.java` 说明规划意图**
   - 拒绝：这两个包没有任何子包或代码支撑，保留它们只会继续占用包视图空间；删除比占位更符合 YAGNI 原则
   - 当前方案：直接删除

2. **将 strategy 相关类上提到 `com.koduck.strategy` 根包，从而根包不再为空**
   - 拒绝：需要大规模移动已有类（`StrategyController`、`StrategyServiceImpl`、`Strategy` Entity 等），破坏现有的分层包结构一致性；且根包为空在分层架构中是完全正常的现象
   - 当前方案：保留现有子包结构，仅添加 `package-info.java`

3. **等待 future 功能开发时自然填充这些包**
   - 拒绝：无法预测 `identity` 和 `trading` 何时会真正启用；空包的存在持续产生误导成本
   - 当前方案：立即清理

## Verification

- `mvn -f koduck-backend/pom.xml clean compile` 编译通过
- `mvn -f koduck-backend/pom.xml checkstyle:check` 无异常
- `./koduck-backend/scripts/quality-check.sh` 全绿
