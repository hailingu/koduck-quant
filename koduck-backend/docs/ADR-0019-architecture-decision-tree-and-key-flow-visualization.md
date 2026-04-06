# ADR-0019: 补充架构决策树与关键业务流程可视化文档

- Status: Accepted
- Date: 2026-04-02
- Issue: #328

## Context

现有后端文档主要覆盖接口约定、配置治理与若干专题 ADR，但缺少“架构决策树 + 关键业务流程图”的统一可视化入口，导致：

- 新成员理解系统时依赖代码跳转，学习成本高；
- 架构评审时难以快速对齐关键决策节点；
- 关键流程变更后，缺乏统一的图形化更新基线。

## Decision

在 `koduck-backend/docs` 新增可视化文档 `ARCHITECTURE-FLOWS.md`，至少覆盖：

- 后端变更决策树（何时引入 Provider、Circuit Breaker、Batch、版本策略、异常语义）；
- KLine 查询与同步触发流程；
- 回测执行流程；
- Service 异常规范映射流程。

并在 `docs/README.md` 增加入口索引，纳入常规文档治理范围。

## Consequences

正向影响：

- 业务与架构路径更易于沟通和评审；
- 减少“口头约定”带来的理解偏差；
- 形成图文一致的维护方式，降低 onboarding 成本。

代价：

- 文档维护成本上升；
- 流程与代码偏离时需要及时同步，避免文档过期。

## Alternatives Considered

1. 不新增流程图，仅依赖代码与 ADR 文本
   - 拒绝：可读性与跨角色沟通效率不足。

2. 使用外部绘图工具维护，不落库
   - 未采用：版本不可追踪，审查和协作成本更高。

## Verification

- `ARCHITECTURE-FLOWS.md` 已新增并包含决策树与关键流程图；
- `docs/README.md` 已增加索引入口；
- 本地 `mvn -DskipTests compile -f koduck-backend/pom.xml` 通过。
