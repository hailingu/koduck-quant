# ADR-0012: AuthClient Token 自省通过 APISIX 调用（Task 5.3）

## 元数据

- **状态**: 已接受
- **日期**: 2026-04-09
- **作者**: @hailingu
- **相关**: #697, docs/implementation/koduck-user-service-tasks.md Task 5.3, ADR-0008

---

## 背景与问题陈述

默认主链路为 `koduck-auth -> koduck-user`（auth 调用 user 的内部 API），koduck-user 作为纯被调用方。但在某些场景下 koduck-user 需要反向调用 koduck-auth：

1. **Token 自省**：高风险操作（如删除账户）需实时验证 Token 有效性
2. **会话强制失效**：密码修改后需要吊销所有活跃 Token

本任务为可选链路，需明确：调用路径、认证方式、开关策略、失败处理。

---

## 决策驱动因素

1. **默认不调用**：大多数场景 koduck-user 无需调用 auth，必须支持完全关闭
2. **网关统一认证**：服务间调用必须经过 APISIX，禁止直连 auth 服务
3. **安全性**：apikey 缺失或错误时必须快速失败并记录审计日志
4. **可靠性**：区分认证失败（不重试）和瞬态错误（有限重试）

---

## 考虑的选项

### 选项 1：RestTemplate + Spring Retry（选定）

**描述**: 使用 Spring 自带的 `RestTemplate` 发起 HTTP 调用，配合自定义重试逻辑。

**优点**:
- 无需额外依赖（`spring-boot-starter-web` 已包含 RestTemplate）
- 同步模型，调用逻辑简单直观
- 可精确控制重试策略
- 与现有 Spring Boot 3.4 生态一致

**缺点**:
- 阻塞式调用，在高并发场景下可能占用线程
- 需手动管理超时和重试逻辑

### 选项 2：WebClient（响应式）

**优点**:
- 非阻塞，资源利用率高
- 内置重试机制

**缺点**:
- 需引入 `spring-boot-starter-webflux`，增加依赖
- 项目当前为同步架构（JPA + Spring MVC），引入响应式增加复杂度
- 大部分代码仍为同步，仅 AuthClient 为响应式造成风格不一致

### 选项 3：Spring Cloud OpenFeign

**优点**:
- 声明式客户端，代码简洁

**缺点**:
- 需引入 Spring Cloud 依赖，重量级
- 当前阶段不需要服务发现等 Cloud 特性
- 过度工程化

---

## 决策结果

采用 **选项 1**：`RestTemplate` + 自定义重试逻辑。

### 核心设计

1. **AuthClient**：封装调用 koduck-auth 的 HTTP 客户端
2. **AuthClientConfig**：配置 RestTemplate Bean 和相关属性
3. **Feature Toggle**：`auth.introspection.enabled=false` 默认关闭
4. **路由策略**：所有调用通过 `AUTH_BASE_URL`（默认 APISIX 地址），禁止直连 auth
5. **认证方式**：每次请求携带 `apikey` header
6. **失败策略**：
   - 401/403（认证失败）：不重试，记录安全审计日志
   - 5xx/网络错误：最多重试 2 次，指数退避
   - 4xx 其他：不重试

---

## 实施细节

### 配置项

```yaml
auth:
  introspection:
    enabled: ${AUTH_INTROSPECTION_ENABLED:false}
  base-url: ${AUTH_BASE_URL:http://apisix:9080}
  api-key: ${AUTH_API_KEY:}
  connect-timeout: 3000
  read-timeout: 5000
  retry:
    max-attempts: 2
    backoff-millis: 500
```

### 新增文件

| 文件 | 说明 |
|------|------|
| `client/AuthClient.java` | 调用 auth 的客户端接口 |
| `client/AuthClientImpl.java` | 客户端实现（RestTemplate + 重试） |
| `client/AuthClientConfig.java` | RestTemplate Bean 配置 |
| `client/dto/TokenIntrospectionRequest.java` | Token 自省请求 |
| `client/dto/TokenIntrospectionResponse.java` | Token 自省响应 |
| `client/dto/TokenRevocationRequest.java` | Token 吊销请求 |
| `client/exception/AuthClientException.java` | 客户端异常 |

### 测试覆盖

- 开关关闭时，AuthClient 不发起任何 HTTP 调用
- 开关开启时，调用走 APISIX 地址
- apikey 缺失/错误 -> 记录安全日志并失败
- 成功响应 -> 正确解析
- 401/403 -> 不重试
- 5xx -> 有限重试

---

## 权衡与影响

### 正向影响

- 提供可选的反向调用能力，支持高风险场景
- 通过 APISIX 统一认证，复用网关安全能力
- Feature toggle 确保默认行为不变

### 负向影响

- 新增出站 HTTP 调用，增加 koduck-user 的外部依赖面
- 需要管理 apikey 的安全存储和轮换

### 缓解措施

- 默认关闭开关，仅在明确需要时启用
- apikey 通过 K8s Secret 注入，禁止硬编码
- 安全审计日志确保调用可追踪

---

## 兼容性影响

1. **API 路由兼容**: 无新增/删除路由，仅新增出站调用
2. **响应语义兼容**: 不影响现有 API 行为
3. **配置兼容**: 新增配置项均有默认值，不影响现有部署
4. **依赖兼容**: 无新增外部依赖

---

## 相关文档

- [koduck-user-jwt-design.md](../../../docs/design/koduck-user-jwt-design.md) 5.2~5.5 节
- [koduck-auth-user-service-design.md](../../../docs/design/koduck-auth-user-service-design.md)
- [koduck-user-api.yaml](../../../docs/design/koduck-user-api.yaml)
- [ADR-0008](./0008-internal-user-controller-implementation.md)

---

## 变更日志

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-04-09 | 初始版本 | @hailingu |
