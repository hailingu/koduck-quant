# ADR-0111: 继续迁移剩余共享基础设施

- Status: Accepted
- Date: 2026-04-05
- Issue: #523

## Context

根据 ADR-0107/0108/0109/0110 的规划，继续迁移 koduck-core 中的共享基础设施到 koduck-common 模块。

### 已完成的基础设施迁移

| ADR | 迁移内容 |
|-----|----------|
| ADR-0109 | ApiResponse, ErrorCode |
| ADR-0110 | BusinessException, ResourceNotFoundException, ValidationException |
| Issue #521 | 删除 UserInfo，使用 AuthUserPrincipal |

### 剩余待迁移的基础设施

**Controller Support:**
- AuthenticatedUserResolver - 认证用户解析器

**异常类：**
- AuthenticationException - 认证异常
- DuplicateException - 重复数据异常
- ExternalServiceException - 外部服务异常
- StateException - 状态异常
- CredentialEncryptionException - 凭证加密异常

**全局异常处理：**
- GlobalExceptionHandler - 全局异常处理器

## Decision

### 迁移剩余共享基础设施到 koduck-common

**提取范围：**

1. **Controller Support**
   - ~~AuthenticatedUserResolver~~: 无法迁移，依赖 AuthUserPrincipal (koduck-auth)
     - koduck-common 不能依赖 koduck-auth，否则会形成循环依赖
     - 保留在 koduck-core 中

2. **异常类**
   - AuthenticationException: 认证相关异常
   - DuplicateException: 数据重复异常
   - ExternalServiceException: 外部服务调用异常
   - StateException: 业务状态异常
   - CredentialEncryptionException: 凭证加密异常

3. **全局异常处理**
   - GlobalExceptionHandler: 统一异常处理
     - 依赖: ApiResponse (已在 koduck-common)
     - 依赖: 上述异常类

### 迁移策略

1. **分析依赖**: 检查每个类的依赖关系
2. **分批迁移**: 先迁移异常类，再迁移 Controller Support
3. **验证编译**: 确保每个迁移后编译通过
4. **更新引用**: 修改 koduck-core 中的 import 语句

## Consequences

### 正向影响

1. **进一步模块化**: koduck-core 继续瘦身
2. **统一异常体系**: 所有异常类集中在 koduck-common
3. **便于复用**: 其他模块可以直接使用这些基础设施

### 兼容性影响

| 层面 | 影响 | 说明 |
|------|------|------|
| API 兼容 | ✅ 无变化 | 类全名保持不变 |
| 功能兼容 | ✅ 无变化 | 仅文件位置调整 |
| 依赖关系 | ✅ 优化 | 依赖关系更清晰 |

### 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 依赖复杂 | 中 | 中 | GlobalExceptionHandler 依赖多个 Spring 组件 |
| 编译错误 | 低 | 中 | 逐步迁移，充分测试 |

## Implementation

### 变更清单

1. **koduck-common 模块** ✅ 已完成
   - [x] ~~迁移 AuthenticatedUserResolver.java~~（无法迁移，依赖 koduck-auth）
   - [x] 迁移 AuthenticationException.java
   - [x] 迁移 DuplicateException.java
   - [x] 迁移 ExternalServiceException.java
   - [x] 迁移 StateException.java
   - [x] 迁移 CredentialEncryptionException.java
   - [ ] ~~迁移 GlobalExceptionHandler.java~~（保留在 koduck-core）

2. **koduck-core 模块** ✅ 已完成
   - [x] 删除已迁移的异常类
   - [x] 保留 AuthenticatedUserResolver.java
   - [x] 保留 GlobalExceptionHandler.java

### 验证步骤

- [ ] `mvn clean compile` 编译通过
- [ ] `mvn checkstyle:check` 无异常
- [ ] 所有模块可以正常访问迁移的类

### 后续工作

完成基础设施迁移后，可以继续：
- Phase 3: 迁移 Repository（需要解决依赖关系）
- Phase 4: 迁移 Service 和 Controller

## References

- Issue: #523
- ADR-0107: 迁移 portfolio 和 community 代码到对应模块
- ADR-0108: Phase 2 - 记录 DTO/Entity 迁移的循环依赖问题
- ADR-0109: 提取共享基础设施到 koduck-common 模块
- ADR-0110: 继续提取共享基础设施到 koduck-common
