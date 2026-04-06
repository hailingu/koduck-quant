# ADR-0090: 迁移 Auth Entity 和 Repository 到 koduck-auth 模块

- Status: Accepted
- Date: 2026-04-04
- Issue: #474

## Context

在 ADR-0089 中，我们迁移了 auth DTO 到 koduck-auth 模块。现在继续迁移 auth 领域的数据层代码（entity 和 repository）。

## Decision

将 koduck-core 中的 auth 相关 entity 和 repository 迁移到 koduck-auth 模块。

### 迁移范围

**Entity (7个)**：
- User - 用户实体
- Role - 角色实体
- Permission - 权限实体
- RefreshToken - 刷新令牌实体
- PasswordResetToken - 密码重置令牌实体
- LoginAttempt - 登录尝试记录实体
- UserCredential - 用户凭证实体

**Repository (7个)**：
- UserRepository
- RoleRepository
- PermissionRepository
- RefreshTokenRepository
- PasswordResetTokenRepository
- LoginAttemptRepository
- UserRoleRepository

### 依赖分析

- Entity 仅依赖 JPA 注解和 Lombok，无 koduck-core 内部依赖 ✅
- Repository 仅依赖对应的 Entity，无其他内部依赖 ✅
- UserCredential 依赖 CollectionCopyUtils（已在 koduck-common）✅

## Consequences

### 正向影响

1. **数据层归属清晰**：Auth 数据层代码归到 koduck-auth 模块
2. **独立演进**：koduck-auth 可以独立管理数据库 Schema 变更
3. **为 Service 迁移做准备**：Entity 和 Repository 迁移后，Service 可以顺利迁移

### 代价与风险

1. **模块依赖**：koduck-core 需要依赖 koduck-auth 才能使用这些类
2. **数据库表**：虽然代码迁移，但数据库表结构保持不变

### 兼容性影响

- **API 兼容性**：无变化，包名和类签名保持不变
- **数据库兼容性**：无变化，Entity 映射的表结构不变
- **行为兼容性**：无变化，纯代码位置迁移

## Implementation Plan

1. 在 koduck-auth 中创建 entity/auth 和 repository/auth 目录
2. 迁移所有 entity 文件
3. 迁移所有 repository 文件
4. 从 koduck-core 删除已迁移的文件
5. 运行质量门禁验证

## Verification

- `mvn -f koduck-backend/pom.xml clean compile` 通过
- `koduck-backend/scripts/quality-check.sh` 通过
- `mvn -f koduck-backend/pom.xml checkstyle:check` 无异常
- 所有现有测试通过
