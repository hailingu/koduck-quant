# ADR-0016: 统一 DataService MarketProvider 抽象与错误处理

- Status: Accepted
- Date: 2026-04-01
- Issue: #322

## Context

`ForexProvider`、`HKStockProvider`、`FuturesProvider` 过去各自实现了大量重复逻辑：

- DataService URL 组装与 HTTP 调用流程重复；
- `RestClientException` 处理分散，日志与回退策略不一致；
- `subscribe/search/tick/kline` 的通用行为在多个类中重复维护。

项目中已有 `AbstractDataServiceMarketProvider`，但上述 Provider 未完全收敛到该抽象层。

## Decision

将 `ForexProvider`、`HKStockProvider`、`FuturesProvider` 统一迁移为继承
`AbstractDataServiceMarketProvider`：

- 公共调用链（kline/tick/search/subscribe）由基类统一实现；
- 公共异常处理（`RestClientException`）在基类统一兜底；
- 子类仅保留市场差异化能力：
  - symbol 规范化；
  - mock 数据生成；
  - DTO/Map 到领域对象转换；
  - 市场状态判定。

## Consequences

正向影响：

- Provider 接口行为更加一致；
- 错误处理统一，降低维护与排障成本；
- 重复代码显著减少，后续新增 DataService Provider 更可复用。

代价：

- 抽象基类职责增大，需要保持稳定性；
- 子类需要遵循基类约定，定制点需在抽象层扩展。

## Alternatives Considered

1. 保持现状，各 Provider 独立实现
   - 拒绝：重复逻辑持续扩散，错误处理难以统一。

2. 仅提炼工具类，不统一继承关系
   - 未采用：仍无法彻底统一调用链与异常处理语义。

## Verification

- `ForexProvider/HKStockProvider/FuturesProvider` 已统一继承抽象基类；
- 编译验证通过：`mvn -DskipTests compile -f koduck-backend/pom.xml`。
