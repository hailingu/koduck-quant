# ADR-0087: 迁移共享常量和工具类到 koduck-common 模块

- Status: Accepted
- Date: 2026-04-04
- Issue: #468

## Context

在 ADR-0086 中，我们创建了 koduck-common 共享模块作为模块拆分的第一阶段。目前 koduck-common 仅包含 `ApiStatusCodeConstants`，需要进一步丰富其内容。

koduck-core 中的以下代码适合迁移到 koduck-common：

1. **common/constants/** - 所有常量类都是纯常量定义，无业务依赖
2. **util/** 中的部分工具类 - 纯工具方法，无业务实体依赖

## Decision

将 koduck-core 中的共享常量和无依赖工具类迁移到 koduck-common 模块。

### 迁移范围

**常量类 (com.koduck.common.constants)**：
- `AiConstants` - AI 相关常量
- `ApiMessageConstants` - API 消息常量
- `DataServicePathConstants` - 数据服务路径常量
- `DateTimePatternConstants` - 日期时间格式常量
- `HttpHeaderConstants` - HTTP 头常量
- `LlmConstants` - LLM 相关常量
- `MapKeyConstants` - Map 键名常量
- `MarketConstants` - 市场相关常量
- `PaginationConstants` - 分页常量
- `RedisKeyConstants` - Redis 键常量
- `RoleConstants` - 角色常量

**工具类 (com.koduck.util)**：
- `CollectionCopyUtils` - 集合防御性拷贝工具
- `SymbolUtils` - 股票代码规范化工具
- `ServiceValidationUtils` - 服务层验证工具
- `ReservedUsernameValidator` - 保留用户名验证器

### 不迁移的内容

以下代码因存在内部依赖，暂时保留在 koduck-core：
- `CredentialEncryptionUtil` - 依赖 `CredentialEncryptionException`
- `JwtUtil` - 依赖 `JwtConfig`
- `EntityCopyUtils` - 依赖多个 entity 类

## Consequences

### 正向影响

1. **代码复用**：共享代码集中管理，避免重复定义
2. **模块解耦**：业务模块可以通过依赖 koduck-common 获取基础设施
3. **编译加速**：koduck-common 无 Spring 等重依赖，编译更快
4. **测试简化**：工具类可以独立测试

### 代价与风险

1. **导入路径变化**：虽然包名保持不变，但物理位置变化需要确认 IDE 识别正常
2. **依赖关系**：需要确保 koduck-core 正确依赖 koduck-common

### 兼容性影响

- **API 兼容性**：无变化，所有类保持相同的包名和签名
- **行为兼容性**：无变化，纯代码位置迁移

## Alternatives Considered

1. **将所有 util 类一并迁移**
   - 拒绝：部分工具类依赖 Spring Config 或 Exception，需要额外处理

2. **创建多个细分模块 (koduck-common-constants, koduck-common-utils)**
   - 拒绝：过度拆分增加维护复杂度，当前 koduck-common 规模适中

## Implementation Plan

1. 在 koduck-common 中创建对应的包结构
2. 迁移常量类文件
3. 迁移工具类文件
4. 从 koduck-core 删除已迁移的文件
5. 运行质量门禁验证

## Verification

- `mvn -f koduck-backend/pom.xml clean compile` 通过
- `koduck-backend/scripts/quality-check.sh` 通过
- `mvn -f koduck-backend/pom.xml checkstyle:check` 无异常
- 所有现有测试通过
