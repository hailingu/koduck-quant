# ADR-0072: 建立 ADR 分类索引页（ADR-INDEX）

- Status: Accepted
- Date: 2026-04-04
- Issue: #438

## Context

根据 `ARCHITECTURE-EVALUATION.md` 的可维护性评估，`koduck-backend/docs/` 目录下已积累 71 个 ADR（Architecture Decision Record）。所有文档平铺在同一层级，存在以下问题：

- **检索困难**：新开发者无法快速了解历史决策的分布和重点
- **缺乏分类**：架构级决策（如 DDD 模块划分、缓存抽象、安全策略）与代码规范级决策（如 Checkstyle 修复、Javadoc 补全）混放在一起
- **价值稀释**：大量代码风格 ADR 淹没了关键架构决策，导致 ADR 作为知识库的核心价值下降

## Decision

### 1. 新增 ADR-INDEX.md 作为统一索引页

在 `koduck-backend/docs/` 下新建 `ADR-INDEX.md`，按主题和级别对所有现有 ADR 进行分类索引，并提供快速导航。

### 2. 采用两级分类体系

| 分类 | 标识 | 范围 |
|------|------|------|
| **Architecture** | `A` | 架构设计、模块边界、技术选型、性能优化、安全策略、数据持久化策略、领域模型调整 |
| **Code Standard** | `C` | 代码规范、Checkstyle/PMD 修复、常量提取、Javadoc 补全、代码风格统一、冗余清理 |

### 3. 不修改现有 ADR 文件名

**核心原则**：仅通过索引页进行分类标注，**不批量重命名现有 `ADR-XXXX` 文件**。

原因：
- **保护外部引用**：Issue、PR、Wiki、聊天记录中存在大量对 `ADR-XXXX` 的直接链接，重命名会导致大面积死链
- **保持 Git 历史连续性**：`git log --follow` 和 `git blame` 等历史追踪依赖稳定路径
- **避免无意义改动**：71 个文件批量重命名属于形式大于内容的高风险重构
- **保留时序编号价值**：现有 `ADR-0001` 到 `ADR-0071` 的编号体系反映了决策演进的时间线

### 4. 未来新增 ADR 的命名约定

从 `ADR-0072` 开始，建议在文件名 slug 或标题中体现分类主题，例如：
- `ADR-0075-a-websocket-scaling.md`（架构类）
- `ADR-0076-c-checkstyle-rule-update.md`（代码规范类）

但**编号主体仍保持连续增长**，不拆分独立编号序列，避免管理复杂度。

## Consequences

### 正向影响

- **检索效率提升**：通过 `ADR-INDEX.md` 可在一页内定位到感兴趣的决策
- **知识价值分层**：架构决策与代码规范清晰分离，维护者能优先关注关键设计
- **零破坏性**：所有现有文件路径、外部链接、Git 历史均不受影响
- **可渐进维护**：未来每新增一个 ADR，只需在索引页追加一行即可

### 兼容性影响

- **文件路径不变**：所有 `ADR-XXXX-*.md` 保持原位置
- **外部引用不变**：Issue、PR 中的链接继续有效
- **新增文件**：仅增加 `ADR-INDEX.md` 和本文件，无修改或删除操作

## Alternatives Considered

1. **批量重命名为 `ADR-A-XXXX` / `ADR-C-XXXX`**
   - 拒绝：会破坏大量历史引用，且改动面过大（71 个文件 + 所有引用点），收益与风险严重不对等
   - 当前方案：保留文件名，通过索引页分类

2. **按分类拆分到子目录（`docs/adr/architecture/` vs `docs/adr/code-standard/`）**
   - 拒绝：同样会改变 71 个文件的路径，破坏外部引用；且子目录对 Markdown 链接的相对路径管理增加复杂度
   - 当前方案：平铺目录 + 索引页分类

3. **为每个 ADR 打 GitHub Label 或 Tag**
   - 拒绝：ADR 是仓库内的 Markdown 文档，GitHub Issue Label 无法直接关联到文件；在文档内打标签（如 Front Matter）收益有限且需要批量编辑
   - 当前方案：单一索引页足够满足检索和分类需求

## Verification

- `ADR-INDEX.md` 已覆盖 `koduck-backend/docs/` 下所有现有 ADR
- 每个 ADR 均已标注 `A` 或 `C` 分类
- `mvn -f koduck-backend/pom.xml clean compile` 编译通过
- `mvn -f koduck-backend/pom.xml checkstyle:check` 无异常
- `./koduck-backend/scripts/quality-check.sh` 全绿
