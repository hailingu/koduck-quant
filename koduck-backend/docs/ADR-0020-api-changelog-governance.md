# ADR-0020: 建立 API Changelog 记录机制

- Status: Accepted
- Date: 2026-04-02
- Issue: #330

## Context

当前项目缺少统一的 API 变更历史记录机制。即使存在 API 版本策略文档，也无法快速回答“某个版本改了什么、是否兼容、如何迁移”等问题，导致：

- 客户端升级与联调成本升高；
- 回归测试缺少版本化输入；
- 变更审查依赖 PR 零散信息，不利于长期追踪。

## Decision

在 `koduck-backend/docs` 建立 `API-CHANGELOG.md`，并将其作为 API 变更的唯一汇总入口，要求：

- 每次 API 变更必须在 Changelog 记录；
- 使用固定分类（Added/Changed/Deprecated/Removed/Fixed/Security）；
- 不兼容变更必须提供迁移说明，并关联 ADR/版本策略文档。

## Consequences

正向影响：

- API 变更可追溯、可审计；
- 版本沟通成本下降，客户端升级路径更清晰；
- 为发布说明、回归测试与兼容性评估提供稳定输入。

代价：

- 需要在开发流程中增加文档维护步骤；
- 若维护不及时，会出现“代码与文档偏离”风险。

## Alternatives Considered

1. 仅依赖 PR 描述，不维护集中 Changelog
   - 拒绝：历史检索成本高，信息结构不一致。

2. 仅在 Release 页面维护变更说明
   - 未采用：发布节奏与 API 迭代节奏不总一致，且粒度不足。

## Verification

- `API-CHANGELOG.md` 已新增并包含分类规范、模板与首条记录；
- `docs/README.md` 已增加 API Changelog 入口与本 ADR 索引；
- 本地 `mvn -DskipTests compile -f koduck-backend/pom.xml` 通过。
