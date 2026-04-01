# ADR-0021: 引入 DDD 领域划分与模块边界治理

- Status: Accepted
- Date: 2026-04-02
- Issue: #332

## Context

当前后端模块主要按技术分层组织（controller/service/repository），缺少显式的领域边界定义。随着功能增长，可能出现：

- 跨业务场景服务相互调用，耦合增加；
- 领域规则散落在实现层，难以复用和审查；
- 新功能落地时缺少“模块归属”判断标准。

## Decision

采用 DDD 思想定义 bounded context，并建立领域模块基线：

- 核心领域：`market`、`strategy`、`trading`、`community`、`identity`；
- 共享域：`shared`（值对象、异常语义、通用事件）；
- 跨域协作通过应用服务或事件/契约完成，禁止直接跨域 repository 依赖。

同步新增 `DOMAIN-MODEL-DESIGN.md` 作为持续演进文档，沉淀职责、依赖和评审清单。

## Consequences

正向影响：

- 模块职责更清晰，降低跨域耦合；
- 架构评审可基于统一边界进行约束；
- 为后续拆分与团队并行开发提供稳定框架。

代价：

- 初期需要额外文档维护与边界梳理；
- 现有代码向新边界迁移需要分阶段推进。

## Alternatives Considered

1. 继续沿用纯技术分层，不定义领域上下文
   - 拒绝：难以控制业务复杂度扩散。

2. 一次性重构为完整 DDD 分层架构
   - 未采用：改造成本高，风险集中，不利于持续交付。

## Verification

- `DOMAIN-MODEL-DESIGN.md` 已新增，包含领域划分、依赖规则和落地策略；
- `docs/README.md` 已加入 DDD 文档与本 ADR 索引入口；
- 本地 `mvn -DskipTests compile -f koduck-backend/pom.xml` 通过。
