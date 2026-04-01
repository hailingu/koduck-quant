# ADR-0018: Service 层异常抛出规范统一

- Status: Accepted
- Date: 2026-04-02
- Issue: #326

## Context

当前 Service 层存在异常抛出不一致问题：同类业务场景中同时混用 `IllegalArgumentException`、`IllegalStateException` 与业务异常，导致：

- 全局异常映射语义不稳定（同类错误返回码可能不一致）；
- 错误语义不清晰，调用方难以基于异常类型做稳定处理；
- 维护与排障时，需要逐个 Service 猜测异常约定。

## Decision

统一 Service 层异常抛出规范：

- 资源不存在：使用 `ResourceNotFoundException`；
- 参数/业务规则不满足：使用 `ValidationException` 或 `BusinessException`（绑定 `ErrorCode`）；
- 状态冲突：使用 `StateException`；
- 重复操作：使用 `DuplicateException`。

本次在高频 Service 实现中落地替换，移除通用运行时异常在业务路径中的直接抛出。

## Consequences

正向影响：

- Service 异常语义统一，便于全局处理器稳定映射 HTTP 状态码与业务错误码；
- 错误可观测性提升，日志与接口返回更可预测；
- 后续新功能可按同一约定扩展，降低认知成本。

代价：

- 需要逐步清理存量代码中剩余的泛化异常；
- 历史测试若断言具体异常类型，需要同步调整。

## Alternatives Considered

1. 保持现状，依赖全局处理器兜底
   - 拒绝：错误语义继续漂移，问题会累积。

2. 仅在 Controller 层统一转换
   - 未采用：根因在 Service 层，延后转换无法提升领域语义。

## Verification

- 关键 Service 实现已将通用运行时异常替换为业务异常体系；
- 本地 `mvn -DskipTests compile -f koduck-backend/pom.xml` 通过。
