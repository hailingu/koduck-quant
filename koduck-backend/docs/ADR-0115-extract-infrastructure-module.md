# ADR-0115: 创建独立的 koduck-infrastructure 模块

- Status: Proposed
- Date: 2026-04-05
- Issue: #539

## Context

根据 ARCHITECTURE-EVALUATION.md 高优先级建议 #3，当前模块依赖方向不合理：`market → core → auth → common`，市场模块依赖了无关的认证/用户模块。

### 当前问题

**模块依赖链过长：**
```
koduck-market → koduck-core → koduck-auth → koduck-common
```

这导致：
1. koduck-market 只需要行情数据功能，却被迫依赖 koduck-core 中的所有业务（auth/user/credential/settings/watchlist/backtest）
2. koduck-portfolio 和 koduck-community 模块目前只能作为空壳存在，因为与 koduck-core 存在循环依赖
3. koduck-core 作为"上帝模块"，同时承载全局基础设施和多业务域全栈代码

### 当前模块结构

```
koduck-common (基础工具类 + 缓存配置)
    ↑
koduck-auth (认证业务)
    ↑
koduck-core (业务逻辑 + 大量基础设施) ← 所有模块依赖
    ↑
koduck-market/portfolio/strategy/community (业务模块)
```

### 需要迁移的基础设施类

koduck-core 中以下类属于基础设施，应独立：

| 类别 | 类名 | 说明 |
|------|------|------|
| **安全配置** | SecurityConfig, JwtAuthenticationFilter, JwtTokenProvider | Spring Security 配置 |
| **Redis 配置** | RedisConfig | Redis 连接配置 |
| **WebSocket 配置** | WebSocketConfig, WebSocketAuthInterceptor | WebSocket/STOMP 配置 |
| **RabbitMQ 配置** | RabbitPricePushConfig | 消息队列配置 |
| **WebClient 配置** | WebClientConfig, DataServiceProperties | HTTP 客户端配置 |
| **其他配置** | OpenApiConfig, SchedulingConfig, AgentConfig | 其他基础设施配置 |
| **属性配置** | FinnhubProperties, MailProperties, PricePushRabbitProperties, RateLimitProperties, SecurityEndpointProperties, StompRelayProperties, WebSocketProperties | 配置属性类 |
| **全局异常处理** | GlobalExceptionHandler | 统一异常处理 |
| **工具类** | JwtUtil, CredentialEncryptionUtil, EntityCopyUtils | 通用工具 |

## Decision

### 创建独立的 koduck-infrastructure 模块

**目标架构：**

```
                    ┌─────────────────────────────────────┐
                    │         业务模块层 (Business)        │
  ┌─────────┐ ┌─────┴────┐ ┌──────────┐ ┌──────────────┐  │
  │  market │ │ portfolio│ │ strategy │ │   community  │  │
  └────┬────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘  │
       └────────────┴────────────┴──────────────┘          │
                    ↓ 依赖                                  │
┌─────────────────────────────────────────────────────────┤
│              基础设施层 (Infrastructure)                  │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────────┐  │
│  │  cache  │ │  redis  │ │ websocket│ │   rabbitmq   │  │
│  │security │ │webclient│ │   jpa    │ │   openapi    │  │
│  └────┬────┘ └────┬────┘ └────┬─────┘ └──────┬───────┘  │
│       └────────────┴────────────┴──────────────┘          │
│                    ↓ 依赖                                 │
├─────────────────────────────────────────────────────────┤
│              公共工具层 (Common)                         │
│         异常、工具类、常量、基础 DTO、缓存配置            │
└─────────────────────────────────────────────────────────┘
```

**模块职责重新定义：**

| 模块 | 新职责 | 依赖 |
|------|--------|------|
| koduck-common | 基础工具类、常量、异常、DTO、缓存配置 | 无 |
| koduck-infrastructure | 所有基础设施配置（Security、Redis、WebSocket、RabbitMQ、WebClient、JPA 等） | koduck-common |
| koduck-auth | 认证业务逻辑（User、Role、Permission、Login） | koduck-infrastructure + koduck-common |
| koduck-core | 核心业务逻辑（user/credential/settings/watchlist/backtest） | koduck-infrastructure + koduck-auth + koduck-common |
| koduck-market | 行情数据业务 | koduck-infrastructure + koduck-common |
| koduck-portfolio | 投资组合业务 | koduck-infrastructure + koduck-common |
| koduck-strategy | 策略业务 | koduck-infrastructure + koduck-common |
| koduck-community | 社区业务 | koduck-infrastructure + koduck-common |
| koduck-ai | AI 分析业务 | koduck-infrastructure + koduck-core + koduck-common |

### 实施策略

由于迁移范围较大，采用分阶段实施：

**Phase 1: 创建 koduck-infrastructure 模块（本次 ADR）**
- 创建新模块 koduck-infrastructure
- 迁移基础设施配置类（Security、Redis、WebSocket、RabbitMQ、WebClient 等）
- 迁移全局异常处理
- 迁移工具类
- 更新所有模块的依赖关系

**Phase 2: 清理 koduck-core（后续 ADR）**
- 删除 koduck-core 中已迁移的类
- 调整 koduck-core 依赖为仅依赖 koduck-infrastructure

**Phase 3: 独立业务模块（后续 ADR）**
- 使 koduck-market、koduck-portfolio 等模块独立
- 消除对 koduck-core 的依赖

## Consequences

### 正向影响

1. **清晰的模块分层**: 基础设施与业务逻辑分离，符合单一职责原则
2. **消除循环依赖**: portfolio/community 可以真正独立，不再依赖 koduck-core
3. **可复用的基础设施**: 新模块可以直接依赖 infrastructure 而无需引入 core 的所有业务
4. **更好的可测试性**: 基础设施可以独立测试，业务模块测试无需加载整个 core
5. **为未来微服务化铺路**: 基础设施独立后，各业务模块可以更容易拆分为独立服务

### 兼容性影响

| 层面 | 影响 | 说明 |
|------|------|------|
| API 兼容 | ⚠️ 包路径变化 | 部分类从 `com.koduck.config` 迁移到 `com.koduck.infrastructure.config`，需要更新 import |
| 功能兼容 | ✅ 无变化 | 仅代码位置调整，功能保持不变 |
| 配置兼容 | ✅ 无变化 | application.yml 配置项保持不变 |
| 依赖关系 | ⚠️ 需要更新 | 各模块 pom.xml 需要更新依赖 |

### 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 遗漏依赖 | 中 | 高 | 全面分析 koduck-core 的依赖关系，分阶段验证 |
| 编译错误 | 中 | 中 | 仔细处理 import 语句，确保所有引用更新 |
| Bean 重复定义 | 低 | 中 | 确保 Spring 扫描路径正确，避免重复注册 |
| 循环依赖 | 低 | 高 | 使用 dependency:analyze 检查循环依赖 |

## Implementation

### 变更清单

1. **新建 koduck-infrastructure 模块**
   - [ ] 创建 koduck-infrastructure/pom.xml
   - [ ] 创建 src/main/java 目录结构
   - [ ] 添加必要的依赖（Spring Boot starters、Security、Redis、WebSocket、RabbitMQ 等）

2. **迁移配置类**
   - [ ] SecurityConfig、JwtAuthenticationFilter、JwtTokenProvider
   - [ ] RedisConfig
   - [ ] WebSocketConfig、WebSocketAuthInterceptor
   - [ ] RabbitPricePushConfig
   - [ ] WebClientConfig、DataServiceProperties
   - [ ] OpenApiConfig、SchedulingConfig、AgentConfig
   - [ ] 所有 Properties 类

3. **迁移异常处理和工具类**
   - [ ] GlobalExceptionHandler
   - [ ] JwtUtil、CredentialEncryptionUtil、EntityCopyUtils

4. **更新父 pom.xml**
   - [ ] 添加 koduck-infrastructure 到 modules
   - [ ] 添加 koduck-infrastructure 到 dependencyManagement

5. **更新 BOM**
   - [ ] 在 koduck-bom/pom.xml 中添加 koduck-infrastructure

6. **更新各业务模块 pom.xml**
   - [ ] koduck-auth: 添加 koduck-infrastructure 依赖
   - [ ] koduck-core: 添加 koduck-infrastructure 依赖
   - [ ] koduck-market: 替换 koduck-core 为 koduck-infrastructure
   - [ ] koduck-portfolio: 替换 koduck-core 为 koduck-infrastructure
   - [ ] koduck-strategy: 替换 koduck-core 为 koduck-infrastructure
   - [ ] koduck-community: 替换 koduck-core 为 koduck-infrastructure
   - [ ] koduck-ai: 更新依赖
   - [ ] koduck-bootstrap: 添加 koduck-infrastructure 依赖

### 验证步骤

- [ ] `mvn clean compile` 编译通过
- [ ] `mvn checkstyle:check` 无异常
- [ ] `koduck-backend/scripts/quality-check.sh` 全绿
- [ ] 所有模块可以正常启动
- [ ] 单元测试通过
- [ ] 集成测试通过

### 后续工作

本次迁移完成后，后续可以继续：
- Phase 2: 清理 koduck-core 中已迁移的类
- Phase 3: 使业务模块完全独立，消除对 koduck-core 的依赖
- 考虑将 market 相关的 provider 和客户端迁移到 koduck-market 模块

## References

- Issue: #539
- ADR-0114: 提取 koduck-core 缓存基础设施到 koduck-common 模块
- ARCHITECTURE-EVALUATION.md: 高优先级建议 #3
