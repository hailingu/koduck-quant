# ADR-0114: 提取 koduck-core 缓存基础设施到 koduck-common 模块

- Status: Accepted
- Date: 2026-04-05
- Issue: #537

## Context

根据 ARCHITECTURE-EVALUATION.md 的分析，koduck-core 目前是一个"上帝模块"，同时承载全局基础设施和多业务域全栈代码，违反了单一职责原则。

### 问题描述

**koduck-core 职责过重：**
- 包含全局基础设施：Security、Cache、Redis、WebSocket、RabbitMQ、WebClient 配置
- 包含多个业务域的全栈代码：auth/user/credential/settings/watchlist/backtest 的 controller/service/repository/entity/dto
- 包含全局异常处理和通用工具类

**循环依赖问题：**
```
koduck-portfolio → koduck-core (需要基础设施)
koduck-core → koduck-portfolio (需要 DTO/Entity)
```

这导致 portfolio 和 community 模块无法真正独立，代码只能放在 koduck-core 中。

### 当前模块结构

```
koduck-common (基础工具类)
    ↑
koduck-core (业务逻辑 + 基础设施) ← 所有模块依赖
    ↑
koduck-portfolio/community (空壳，依赖 core)
```

## Decision

### 将 koduck-core 中的缓存基础设施提取到 koduck-common

**提取范围：**

1. **缓存配置类**
   - `CacheConfig`: 缓存配置（包含 RedisCacheManager 配置）
   - `CacheProperties`: 缓存 TTL 配置属性

**保持不变的类（仍在 koduck-core）：**

- `WebClientConfig`: 需要 DataServiceProperties，与市场数据相关
- `DataServiceProperties`: 市场数据服务配置
- `FinnhubProperties`: 美股数据源配置
- `DataServiceClient`: 市场数据服务客户端
- `MarketDataProvider` 及相关类: 市场数据提供者
- `GlobalExceptionHandler`: 全局异常处理（依赖 koduck-core 的 DTO）

### 目标模块结构

```
koduck-common (基础设施 + 通用工具 + 缓存配置)
    ↑
koduck-core (业务逻辑 + 市场数据基础设施)
    ↑
koduck-portfolio/community (业务模块，依赖 common 而非 core)
```

### 迁移策略

1. **识别基础设施类**
   - 分析 koduck-core 中的类，识别被多个模块共享的基础设施
   - CacheConfig 和 CacheProperties 被 koduck-market 和 koduck-core 共享

2. **迁移到 koduck-common**
   - 保持包路径不变（com.koduck.config）
   - 更新 koduck-common 的 pom.xml，添加必要依赖（Spring Cache, Redis, Jackson JSR310）

3. **更新 koduck-core**
   - 删除已迁移的类
   - 从 koduck-common 导入

4. **验证依赖关系**
   - koduck-market 可以通过 koduck-common 访问缓存配置
   - 无需直接依赖 koduck-core 的缓存配置

## Consequences

### 正向影响

1. **缓存配置复用**: koduck-market 可以直接使用 koduck-common 中的缓存配置
2. **模块化进展**: 向真正的模块化架构迈进了一步
3. **可测试性提升**: 缓存配置可以在不依赖 koduck-core 的情况下使用
4. **单一职责**: koduck-common 现在包含基础设施，koduck-core 专注于业务逻辑

### 兼容性影响

| 层面 | 影响 | 说明 |
|------|------|------|
| API 兼容 | ✅ 无变化 | 类全名保持不变 |
| 功能兼容 | ✅ 无变化 | 仅文件位置调整 |
| 依赖关系 | ✅ 优化 | koduck-market 可以通过 koduck-common 访问缓存配置 |

### 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 遗漏依赖 | 低 | 中 | 全面分析 koduck-core 的依赖关系 |
| 编译错误 | 低 | 中 | 仔细处理 import 语句 |
| Bean 重复定义 | 低 | 中 | 确保 Spring 扫描路径正确 |

## Implementation

### 变更清单

1. **koduck-common 模块**
   - [x] 创建 config 包，迁移 CacheConfig
   - [x] 创建 config/properties 包，迁移 CacheProperties
   - [x] 更新 pom.xml，添加必要依赖（Spring Cache, Redis, Jackson JSR310）

2. **koduck-core 模块**
   - [x] 删除已迁移的 CacheConfig 和 CacheProperties
   - [x] 从 koduck-common 导入

3. **koduck-market 模块**
   - [x] 可以通过 koduck-common 访问缓存配置

### 验证步骤

- [x] `mvn clean compile` 编译通过
- [x] `mvn checkstyle:check` 无异常
- [x] 所有模块可以正常访问缓存配置类

### 后续工作

本次迁移仅完成了缓存基础设施的提取。后续可以继续：
- 迁移其他基础设施类（如全局异常处理）
- 将市场数据相关的配置和客户端迁移到 koduck-market
- 进一步优化模块依赖关系

## References

- Issue: #537
- ADR-0109: 提取共享基础设施到 koduck-common 模块
- ARCHITECTURE-EVALUATION.md: 高优先级建议 #1
