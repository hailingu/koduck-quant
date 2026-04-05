# ADR-0112: 迁移 Community 代码到 koduck-community 模块

- Status: Accepted
- Date: 2026-04-05
- Issue: #533

## Context

根据 ADR-0107、ADR-0108、ADR-0109、ADR-0110、ADR-0111 的规划，共享基础设施已经逐步迁移到 koduck-common 模块。现在可以安全地将 community 业务代码从 koduck-core 迁移到 koduck-community 模块。

### 已完成的基础设施迁移

| ADR | 迁移内容 |
|-----|----------|
| ADR-0109 | ApiResponse, ErrorCode |
| ADR-0110 | BusinessException, ResourceNotFoundException, ValidationException |
| ADR-0111 | AuthenticationException, DuplicateException, ExternalServiceException, StateException, CredentialEncryptionException |

### 当前 koduck-core 中的 community 代码

**Controller (1):**
- CommunitySignalController

**Service (3):**
- CommunitySignalService (接口)
- CommunitySignalServiceImpl (实现)
- CommunitySignalResponseAssembler (支持类)

**DTO (8):**
- CommentResponse
- CreateCommentRequest
- CreateSignalRequest
- SignalListResponse
- SignalResponse
- SignalSubscriptionResponse
- UpdateSignalRequest
- UserSignalStatsResponse

**Entity (6):**
- CommunitySignal
- SignalComment
- SignalFavorite
- SignalLike
- SignalSubscription
- UserSignalStats

**Repository (6):**
- CommunitySignalRepository
- SignalCommentRepository
- SignalFavoriteRepository
- SignalLikeRepository
- SignalSubscriptionRepository
- UserSignalStatsRepository

**Test (2):**
- CommunitySignalControllerTest
- CommunitySignalControllerValidationTest

## Decision

### 将 community 业务代码从 koduck-core 迁移到 koduck-community 模块

**迁移策略：**

1. **创建目录结构**
   - 在 koduck-community 创建 com.koduck.controller.community 包
   - 在 koduck-community 创建 com.koduck.service 和 com.koduck.service.impl.community 包
   - 在 koduck-community 创建 com.koduck.service.support 包
   - 在 koduck-community 创建 com.koduck.dto.community 包
   - 在 koduck-community 创建 com.koduck.entity.community 包
   - 在 koduck-community 创建 com.koduck.repository.community 包

2. **移动文件**
   - 将所有 community 相关文件从 koduck-core 移动到 koduck-community
   - 保持包路径不变

3. **更新 koduck-core 依赖**
   - 在 koduck-core/pom.xml 中添加对 koduck-community 的依赖
   - 修复 koduck-core 中引用迁移类的 import 语句

4. **更新 koduck-community 依赖**
   - 确保 koduck-community 依赖 koduck-common（已存在）
   - 确保 koduck-community 依赖 koduck-core（已存在）

### 依赖关系调整

迁移后，模块依赖关系将变为：

```
koduck-common (基础设施)
    ↑
koduck-core (业务逻辑) → koduck-community (社区模块)
    ↑
koduck-community (依赖 common 和 core)
```

注意：koduck-core 需要依赖 koduck-community 来获取 CommunitySignalService 等类。

## Consequences

### 正向影响

1. **代码组织清晰**: community 代码归属于独立的业务模块
2. **模块化进展**: 向真正的模块化架构迈进一步
3. **减少 koduck-core 体积**: 移除 24 个 community 相关文件
4. **单一职责**: koduck-community 负责社区功能，koduck-core 负责核心功能

### 兼容性影响

| 层面 | 影响 | 说明 |
|------|------|------|
| API 兼容 | ✅ 无变化 | 类全名保持不变 |
| 功能兼容 | ✅ 无变化 | 仅文件位置调整 |
| 依赖关系 | ⚠️ 调整 | koduck-core 新增对 koduck-community 的依赖 |

### 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 编译错误 | 中 | 中 | 仔细处理 import 语句和依赖关系 |
| 测试失败 | 中 | 中 | 同步迁移测试文件，确保测试通过 |
| 循环依赖 | 低 | 高 | 验证最终的依赖关系图 |

## Implementation

### 变更清单

1. **koduck-community 模块**
   - [ ] 创建 src/main/java 目录结构
   - [ ] 迁移 Entity 类 (6个)
   - [ ] 迁移 Repository 类 (6个)
   - [ ] 迁移 DTO 类 (8个)
   - [ ] 迁移 Service 接口和实现 (3个)
   - [ ] 迁移 Controller (1个)
   - [ ] 创建 src/test/java 目录结构
   - [ ] 迁移测试文件 (2个)

2. **koduck-core 模块**
   - [ ] 添加 koduck-community 依赖到 pom.xml
   - [ ] 删除已迁移的 community 文件
   - [ ] 更新 import 语句（如有）

3. **验证**
   - [ ] mvn clean compile 编译通过
   - [ ] mvn checkstyle:check 无异常
   - [ ] 质量检查脚本通过

### 验证步骤

- [ ] `mvn clean compile` 编译通过
- [ ] `mvn checkstyle:check` 无异常
- [ ] `./scripts/quality-check.sh` 通过

### 后续工作

完成 community 模块迁移后，可以继续：
- 迁移 portfolio 代码到 koduck-portfolio 模块
- 进一步拆分 koduck-core 中的其他业务模块

## References

- Issue: #533
- ADR-0107: 迁移 portfolio 和 community 代码到对应模块
- ADR-0108: Phase 2 - 记录 DTO/Entity 迁移的循环依赖问题
- ADR-0109: 提取共享基础设施到 koduck-common 模块
- ADR-0110: 继续提取共享基础设施到 koduck-common
- ADR-0111: 继续迁移剩余共享基础设施
