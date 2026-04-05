# ADR-0117: 迁移剩余配置类到 koduck-infrastructure 模块

- Status: Proposed
- Date: 2026-04-05
- Issue: #543

## Context

经过 ADR-0115 和 ADR-0116 的两阶段迁移，koduck-infrastructure 模块已包含大部分基础设施配置。本 ADR 完成剩余配置类的迁移，使 koduck-core 更专注于业务逻辑。

### 当前状态

**已迁移配置类：**
- RedisConfig (ADR-0115)
- 所有 Properties 类 (ADR-0115)
- AgentConfig, JwtConfig, OpenApiConfig, SchedulingConfig (ADR-0116)

**koduck-core 中剩余的配置类：**
- WebSocketConfig
- RabbitPricePushConfig
- WebClientConfig
- DataInitializer
- SecurityConfig（暂时保留，与业务逻辑耦合）
- CacheConfig（已在 koduck-common，无需迁移）

## Decision

### 迁移以下配置类到 koduck-infrastructure

| 配置类 | 说明 | 依赖 |
|--------|------|------|
| WebSocketConfig | WebSocket/STOMP 配置 | StompRelayProperties, WebSocketProperties |
| RabbitPricePushConfig | RabbitMQ 价格推送配置 | PricePushRabbitProperties |
| WebClientConfig | WebClient HTTP 客户端配置 | DataServiceProperties, FinnhubProperties |
| DataInitializer | 数据初始化 | 多个 Repository（可能需要调整） |

### 暂时保留在 koduck-core 的配置类

| 配置类 | 原因 |
|--------|------|
| SecurityConfig | 依赖 UserDetailsService（业务逻辑） |
| JwtAuthenticationFilter | 依赖 UserDetailsService（业务逻辑） |

### 实施策略

1. **迁移独立配置类**
   - WebSocketConfig
   - RabbitPricePushConfig
   - WebClientConfig

2. **特殊处理 DataInitializer**
   - DataInitializer 涉及业务数据初始化，可能需要重构后再迁移
   - 或者保留在 koduck-core 作为业务初始化逻辑

## Consequences

### 正向影响

1. **基础设施完整**: koduck-infrastructure 将包含大部分基础设施配置
2. **业务逻辑清晰**: koduck-core 更专注于业务逻辑
3. **可复用性**: 其他模块可以通过 infrastructure 获取基础设施能力

### 兼容性影响

| 层面 | 影响 | 说明 |
|------|------|------|
| 包路径 | ⚠️ 变化 | 配置类从 `com.koduck.config` 迁移到 `com.koduck.infrastructure.config` |
| 功能 | ✅ 无变化 | 仅代码位置调整 |
| 配置 | ✅ 无变化 | application.yml 配置项保持不变 |

## Implementation

### 变更清单

1. **koduck-infrastructure 模块**
   - [ ] 迁移 WebSocketConfig
   - [ ] 迁移 RabbitPricePushConfig
   - [ ] 迁移 WebClientConfig
   - [ ] 评估 DataInitializer 的迁移

2. **koduck-core 模块**
   - [ ] 删除已迁移的配置类
   - [ ] 更新 import 语句

3. **其他模块**
   - [ ] 更新引用配置类的 import 语句

### 验证步骤

- [ ] `mvn clean compile` 编译通过
- [ ] `mvn checkstyle:check` 无异常
- [ ] SpotBugs 检查通过
- [ ] `quality-check.sh` 全绿

## References

- Issue: #543
- ADR-0115: 创建独立的 koduck-infrastructure 模块
- ADR-0116: 继续完善 koduck-infrastructure 模块
- ARCHITECTURE-EVALUATION.md: 关键缺陷 #1
