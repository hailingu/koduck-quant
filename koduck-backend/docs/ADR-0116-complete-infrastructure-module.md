# ADR-0116: 继续完善 koduck-infrastructure 模块 - 迁移剩余配置类

- Status: Proposed
- Date: 2026-04-05
- Issue: #541

## Context

ADR-0115 成功创建了 koduck-infrastructure 模块并迁移了 RedisConfig 和所有 Properties 配置类。但 koduck-core 中仍有大量基础设施配置类需要迁移，以进一步解耦基础设施与业务逻辑。

### 当前状态

**已迁移（ADR-0115）:**
- RedisConfig
- 所有 Properties 类 (CacheProperties, DataServiceProperties, etc.)

**仍需迁移:**
- SecurityConfig
- JwtAuthenticationFilter
- WebSocketConfig
- RabbitPricePushConfig
- WebClientConfig
- OpenApiConfig
- SchedulingConfig
- AgentConfig
- DataInitializer
- JwtConfig
- CacheConfig

### 目标

完成 koduck-infrastructure 模块的基础设施建设，使 koduck-core 专注于业务逻辑。

## Decision

### 迁移以下配置类到 koduck-infrastructure

| 配置类 | 说明 | 依赖关系 |
|--------|------|----------|
| SecurityConfig | Spring Security 主配置 | 依赖 SecurityEndpointProperties, JwtAuthenticationFilter |
| JwtAuthenticationFilter | JWT 认证过滤器 | 依赖 JwtConfig, JwtUtil |
| JwtConfig | JWT 配置属性 | 无额外依赖 |
| WebSocketConfig | WebSocket/STOMP 配置 | 依赖 StompRelayProperties, WebSocketProperties |
| RabbitPricePushConfig | RabbitMQ 价格推送配置 | 依赖 PricePushRabbitProperties |
| WebClientConfig | WebClient HTTP 客户端配置 | 依赖 DataServiceProperties, FinnhubProperties |
| OpenApiConfig | OpenAPI/Swagger 配置 | 无额外依赖 |
| SchedulingConfig | 定时任务配置 | 无额外依赖 |
| AgentConfig | AI Agent 配置 | 无额外依赖 |
| DataInitializer | 数据初始化 | 可能依赖多个 Repository |
| CacheConfig | 缓存配置 | 已在 koduck-common，保持不动 |

### 实施策略

**Phase 1: 迁移独立配置类**
- OpenApiConfig
- SchedulingConfig
- AgentConfig
- JwtConfig

**Phase 2: 迁移有依赖的配置类**
- SecurityConfig + JwtAuthenticationFilter
- WebSocketConfig
- RabbitPricePushConfig
- WebClientConfig

**Phase 3: 特殊处理**
- DataInitializer（可能需要保留在 core，因为它涉及业务数据初始化）
- CacheConfig（已在 koduck-common，无需迁移）

## Consequences

### 正向影响

1. **进一步解耦**: koduck-core 将减少基础设施代码，更专注于业务逻辑
2. **可复用性**: 其他模块可以直接依赖 infrastructure 获取基础设施能力
3. **可测试性**: 基础设施配置可以独立测试

### 兼容性影响

| 层面 | 影响 | 说明 |
|------|------|------|
| 包路径 | ⚠️ 变化 | 配置类从 `com.koduck.config` 迁移到 `com.koduck.infrastructure.config` |
| 功能 | ✅ 无变化 | 仅代码位置调整 |
| 配置 | ✅ 无变化 | application.yml 配置项保持不变 |

### 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 循环依赖 | 中 | 高 | 仔细检查类之间的依赖关系 |
| Bean 重复定义 | 低 | 中 | 确保 Spring 扫描路径正确 |
| 测试失败 | 中 | 中 | 更新测试类中的 import 语句 |

## Implementation

### 变更清单

1. **koduck-infrastructure 模块**
   - [ ] 迁移 SecurityConfig
   - [ ] 迁移 JwtAuthenticationFilter
   - [ ] 迁移 JwtConfig
   - [ ] 迁移 WebSocketConfig
   - [ ] 迁移 RabbitPricePushConfig
   - [ ] 迁移 WebClientConfig
   - [ ] 迁移 OpenApiConfig
   - [ ] 迁移 SchedulingConfig
   - [ ] 迁移 AgentConfig

2. **koduck-core 模块**
   - [ ] 删除已迁移的配置类
   - [ ] 更新 import 语句

3. **其他模块**
   - [ ] 更新引用配置类的 import 语句

### 验证步骤

- [ ] `mvn clean compile` 编译通过
- [ ] `mvn checkstyle:check` 无异常
- [ ] SpotBugs 检查通过

## References

- Issue: #541
- ADR-0115: 创建独立的 koduck-infrastructure 模块
- ARCHITECTURE-EVALUATION.md: 关键缺陷 #1
