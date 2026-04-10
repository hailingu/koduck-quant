# Architecture Decision Records (ADR)

本文档目录存放 koduck-quant 项目的架构决策记录（Architecture Decision Records）。

---

## 什么是 ADR

架构决策记录（ADR）是捕捉重要架构决策及其上下文和后果的文档。每个 ADR 描述一个决策及其完整的历史背景，帮助团队成员理解：

- 为什么做出这个决策
- 考虑了哪些替代方案
- 决策的影响和后果

---

## 何时需要编写 ADR

以下情况**必须**编写 ADR：

- ✅ 引入新的技术栈或框架
- ✅ 改变系统的核心架构（如：单体 → 微服务）
- ✅ 引入新的数据存储方案
- ✅ 改变模块/服务的边界划分
- ✅ 引入新的通信协议或接口规范
- ✅ 性能优化策略的重大变更
- ✅ 安全架构的调整

以下情况**建议**编写 ADR：

- 💡 引入新的设计模式
- 💡 改变代码组织方式
- 💡 引入新的开发流程或工具

以下情况**不需要** ADR：

- ❌ 日常 Bug 修复
- ❌ 功能增量开发（无架构影响）
- ❌ 代码重构（保持行为不变）
- ❌ 依赖版本升级（无 API 变更）

---

## ADR 编号规则

ADR 使用 4 位数字编号，格式为 `NNNN-title.md`：

| 编号范围 | 类别 | 示例 |
|----------|------|------|
| 0000 | 模板和工具 | `0000-template.md` |
| 0001-0999 | 架构原则与规范 | `0001-java-coding-standards.md` |
| 1000-1999 | 后端架构决策 | `1001-websocket-architecture.md` |
| 2000-2999 | 前端架构决策 | `2001-state-management.md` |
| 3000-3999 | 数据架构决策 | `3001-database-selection.md` |
| 4000-4999 | 基础设施与部署 | `4001-container-orchestration.md` |
| 5000-5999 | 安全架构决策 | `5001-authentication-strategy.md` |
| 9000-9999 | 流程与治理 | `9001-code-review-process.md` |

---

## ADR 状态流转

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   提议      │ --> │   已接受    │ --> │   已弃用    │
│ (Proposed)  │     │  (Accepted) │     │ (Deprecated)│
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       |                   |                   |
       v                   v                   v
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   已拒绝    │     │  已被替代   │
│  (Rejected) │     │ (Superseded)│
└─────────────┘     └─────────────┘
```

**状态说明**:

- **提议 (Proposed)**: ADR 已创建，正在讨论中
- **已接受 (Accepted)**: 决策已被团队接受，正在实施或已实施
- **已拒绝 (Rejected)**: 决策被团队拒绝，记录备查
- **已弃用 (Deprecated)**: 决策曾生效但已不再适用，无替代方案
- **已被替代 (Superseded)**: 决策已被新的 ADR 替代，需链接到新 ADR

---

## 如何编写 ADR

### 1. 创建新 ADR

```bash
# 复制模板
cp docs/adr/0000-template.md docs/adr/NNNN-title.md

# 编辑新 ADR
# ...
```

### 2. 填写内容

按照模板填写以下内容：

1. **背景与问题陈述**: 描述需要决策的问题
2. **决策驱动因素**: 列出影响决策的关键因素
3. **考虑的选项**: 详细描述每个备选方案
4. **决策结果**: 明确最终选择及其理由
5. **实施细节**: 实施计划和影响范围

### 3. 提交审查

将 ADR 作为 PR 的一部分提交审查：

```bash
git add docs/adr/NNNN-title.md
git commit -m "docs(adr): add ADR-NNNN: 标题

- 决策: ...
- 影响: ...

Refs: #相关issue"
```

---

## ADR 审查流程

### 提交前自查清单

- [ ] 问题陈述是否清晰？
- [ ] 是否考虑了至少 2 个备选方案？
- [ ] 决策理由是否充分？
- [ ] 是否分析了积极和消极后果？
- [ ] 是否有实施计划？

### 审查要点

审查者应关注：

1. **完整性**: 是否覆盖了所有必要信息？
2. **准确性**: 技术细节是否正确？
3. **权衡分析**: 是否充分考虑了各方案的利弊？
4. **影响评估**: 是否准确评估了对现有系统的影响？

---

## 现有 ADR 列表

| 编号 | 标题 | 状态 | 日期 |
|------|------|------|------|
| 0000 | [模板](0000-template.md) | 工具 | - |
| 0001 | [WebSocket 实时数据推送架构](0001-websocket-realtime-architecture.md) | 已接受 | 2026-04-01 |
| 0002 | [测试覆盖率门禁机制](0002-test-coverage-gate.md) | 已接受 | 2026-03-31 |

---

## 参考

- [ADR GitHub Organization](https://adr.github.io/)
- [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [Markdown ADR Tools](https://github.com/npryce/adr-tools)
