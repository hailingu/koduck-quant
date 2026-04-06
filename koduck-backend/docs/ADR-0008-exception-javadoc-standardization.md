# ADR-0008: Exception 层 Javadoc 规范化

- Status: Accepted
- Date: 2026-04-01
- Issue: #306

## Context

`com.koduck.exception` 包中部分异常类存在注释空白、语义不完整或风格不一致的问题，导致：

- 新成员理解异常语义成本上升；
- 构造器与工厂方法用途不清晰；
- 文档质量与代码规范不一致。

本次问题属于“文档可维护性治理”，不涉及业务逻辑调整。

## Decision

对核心异常类进行 Javadoc 标准化，统一描述：

- 类级职责（何时抛出）；
- 构造器参数语义；
- 工厂方法用途和返回值；
- 关键字段含义。

本次覆盖：

- `BusinessException`
- `AuthenticationException`
- `AuthorizationException`
- `ValidationException`
- `ResourceNotFoundException`
- `DuplicateException`
- `StateException`

## Consequences

正向影响：

- 异常语义更清晰，提升可维护性和可读性；
- 统一注释风格，降低协作沟通成本；
- 无行为改动，风险低。

代价：

- 文档维护工作量上升，需要在后续新增异常时持续遵循规范。

## Alternatives Considered

1. 保持现状，仅靠口头约定  
   - 拒绝：信息不可执行，规范易漂移。

2. 仅修复单个类注释  
   - 暂不采用：无法形成一致风格，治理收益有限。

## Verification

- 目标异常类 Javadoc 已统一补全；
- 未修改异常行为与对外契约；
- 编译验证通过：`mvn -DskipTests compile -f koduck-backend/pom.xml`。
