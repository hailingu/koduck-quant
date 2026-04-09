# ADR-0001: UserController 用户上下文传递与统一错误处理

## 元数据

- **状态**: 已接受
- **日期**: 2026-04-09
- **作者**: @hailingu
- **相关**: #689, koduck-auth-user-service-design.md 4.1.1

---

## 背景与问题陈述

koduck-user 服务需要实现对外 HTTP API Controller 层，将已完成的 Service 层能力暴露为 REST 端点。在此过程中需要解决两个核心问题：

1. **用户身份获取**：APISIX 网关完成 JWT 验签后，通过 `X-User-Id`、`X-Username`、`X-Roles` 请求头将用户身份透传给后端。Controller 需要可靠地读取这些上下文信息。
2. **统一错误处理**：Service 层抛出的业务异常和框架层面的参数校验异常需要统一转换为标准 `ApiResponse` 格式。

### 上下文

- **架构背景**：koduck-user 不自行处理 JWT 解析，认证完全委托给 APISIX 网关
- **技术背景**：当前服务未引入 Spring Security，采用轻量级 Header 透传方案
- **已有实现**：Service 层、DTO 层、Entity 层、Repository 层均已完成

---

## 决策驱动因素

1. **简单性**：不引入 Spring Security 依赖，保持当前阶段的轻量化
2. **可靠性**：用户上下文读取失败应有明确错误提示，而非静默失败
3. **一致性**：所有 API 返回统一的 `ApiResponse<T>` 结构
4. **可维护性**：异常处理逻辑集中管理，避免散落在各 Controller 中

---

## 考虑的选项

### 选项 1: 简单工具类 + `@ControllerAdvice`

**描述**: 使用静态工具方法从 `HttpServletRequest` 读取 Header 上下文，配合 `@ControllerAdvice` 实现全局异常处理。

**优点**:
- 零额外依赖，实现简单直接
- 与现有不使用 Spring Security 的架构一致
- `@ControllerAdvice` 是 Spring 标准机制，团队熟悉

**缺点**:
- 需要手动在每个端点注入 `HttpServletRequest`
- 无法通过注解声明式校验权限

### 选项 2: 自定义 `HandlerMethodArgumentResolver`

**描述**: 实现 Spring 的 `HandlerMethodArgumentResolver`，将 Header 自动解析为 `UserContext` 对象注入 Controller 方法参数。

**优点**:
- Controller 方法签名更干净，直接获取 `UserContext`
- 可复用于所有 Controller

**缺点**:
- 额外的 Spring 配置类
- 错误时机延后到参数解析阶段

### 选项 3: 引入 Spring Security + `@PreAuthorize`

**描述**: 完整引入 Spring Security 框架，使用 SecurityContext 和权限注解。

**优点**:
- 企业级安全框架，功能完善
- 支持方法级权限控制

**缺点**:
- 引入重量级依赖，与当前阶段最小化原则冲突
- JWT 认证由 APISIX 处理，Security 在此场景下价值有限

---

## 决策结果

**选定的方案**: 选项 1 - 简单工具类 + `@ControllerAdvice`

**理由**:

1. **阶段匹配**：当前阶段 APISIX 负责认证，后端仅需读取上下文，无需完整安全框架
2. **最小依赖**：不引入 Spring Security，保持依赖最小化（与 Task 1.2 原则一致）
3. **实现简单**：工具类 + `@ControllerAdvice` 方案代码量小，易于理解和维护
4. **可演进**：后续若需方法级权限控制，可平滑迁移到选项 2 或 3

**积极后果**:

- 代码简单直观，上手成本低
- 统一响应格式，前端处理一致
- 异常处理集中化，便于维护

**消极后果**:
- Controller 中需手动注入 `HttpServletRequest`
- 权限校验需在 Controller 层手动编码（当前阶段可接受）

**缓解措施**:
- 后续 Task 4.2（角色/权限 Controller）可复用同一套 UserContext 和异常处理
- 若权限逻辑变复杂，可在 Task 6.2（认证与权限边界落地）中引入 `HandlerMethodArgumentResolver`

---

## 实施细节

### 实施计划

- [ ] 创建 `UserContext` 工具类
- [ ] 创建 `GlobalExceptionHandler`（`@ControllerAdvice`）
- [ ] 实现 `UserController` 覆盖所有用户管理端点
- [ ] 编译验证

### 影响范围

- 新增: `com.koduck.context.UserContext`
- 新增: `com.koduck.exception.GlobalExceptionHandler`
- 新增: `com.koduck.controller.user.UserController`

---

## 相关文档

- [koduck-auth-user-service-design.md](../design/koduck-auth-user-service-design.md) 4.1.1
- [koduck-user-api.yaml](../design/koduck-user-api.yaml)
- [koduck-user-jwt-design.md](../design/koduck-user-jwt-design.md)

---

## 变更日志

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-04-09 | 初始版本 | @hailingu |
