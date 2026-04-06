# ADR-0009: GlobalExceptionHandler Javadoc 补全与规范化

- Status: Accepted
- Date: 2026-04-01
- Issue: #308

## Context

`GlobalExceptionHandler` 是后端统一异常响应的关键入口，但原有注释存在空白和语义不完整问题，导致：

- 各异常映射的职责边界不清晰；
- 新成员难以快速理解不同 `@ExceptionHandler` 的处理意图；
- 文档质量与异常层整体规范不一致。

本次变更聚焦文档可维护性，不涉及错误码、HTTP 状态或响应结构调整。

## Decision

对 `GlobalExceptionHandler` 进行类级与方法级 Javadoc 完整补充，统一描述：

- 处理的异常类型；
- 返回语义（HTTP 状态和统一响应）；
- 方法参数用途；
- fallback 处理策略。

保持现有处理逻辑、异常映射关系和响应构造方式不变。

## Consequences

正向影响：

- 异常映射语义更直观，降低维护和交接成本；
- 与异常类文档规范（ADR-0008）形成一致；
- 风险低，无运行时行为变更。

代价：

- 后续新增异常处理方法需同步维护 Javadoc 规范。

## Alternatives Considered

1. 仅补类注释，不补方法注释  
   - 拒绝：关键映射语义仍不明确，收益有限。

2. 保持现状  
   - 拒绝：文档债务继续累积，影响可维护性。

## Verification

- `GlobalExceptionHandler` 类与核心处理方法 Javadoc 已补全；
- 处理逻辑无变更（仅注释层变更）；
- 编译验证通过：`mvn -DskipTests compile -f koduck-backend/pom.xml`。
