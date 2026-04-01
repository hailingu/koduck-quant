# ADR-0023: DDD Phase 2 完成剩余 ServiceImpl 迁移

- Status: Accepted
- Date: 2026-04-02
- Issue: #334

## Context

`ADR-0022` 已完成核心服务首批迁移，但 `com.koduck.service.impl` 仍保留大量实现类，无法达成“领域边界在代码结构可见”的目标。

## Decision

执行 DDD Phase 2：迁移 `service.impl` 中剩余实现类，按领域落到对应 `application` 包，并同步修复测试引用。

- `market.application`：行情聚合、推送、缓存、订阅、分钟线与同步等实现
- `identity.application`：用户、凭证、配置与资料相关实现
- `shared.application`：AI、邮件、内存、监控、限流等跨领域能力实现

迁移后，`com.koduck.service.impl` 不再承载业务实现类。

## Consequences

正向影响：

- DDD 领域边界在包结构层面完整落地；
- 服务实现按业务语义聚合，维护与协作成本下降；
- 后续可在此基础上增加架构规则检查（禁止回流至旧包）。

代价：

- 包路径变更会影响直接引用实现类的测试/工具代码；
- 短期需要适配历史脚本或文档中的旧路径。

## Alternatives Considered

1. 保留部分实现于 `service.impl`
   - 拒绝：无法形成一致的边界规范。

2. 一步迁移到更细颗粒 `domain/application/infrastructure/interfaces`
   - 未采用：当前阶段先完成 bounded context 级别收敛，避免过度改造。

## Verification

- 主代码 `mvn -DskipTests compile -f koduck-backend/pom.xml` 通过；
- `com.koduck.service.impl` 中已无实现类文件；
- 受影响测试导入已切换为新包路径。
