# ADR-0086: 拆分 koduck-auth 独立 Maven 模块

- Status: Accepted
- Date: 2026-04-04
- Issue: #466

## Context

根据 ARCHITECTURE-EVALUATION.md 的评估（第4节 模块化），当前 koduck-core 作为单一模块承载全部业务逻辑，存在以下问题：

1. **模块边界不清晰**：所有业务逻辑（AI、Auth、Backtest、Community 等 10+ 个领域）均在一个 Maven 模块内
2. **无法独立演进**：各领域共享同一编译和部署单元，无法按需独立发布
3. **依赖关系混乱**：缺乏物理隔离，容易形成隐式循环依赖

评估报告建议：按 `market`、`trading`、`auth`、`ai` 等领域拆分为独立 Maven 模块，通过接口模块解耦。

## Decision

将 `auth` 领域作为第一个拆分的独立 Maven 模块，命名为 `koduck-auth`。

### 拆分范围

koduck-auth 模块包含以下代码：

| 类型 | 路径 |
|------|------|
| Controller | `controller/auth/AuthController.java` |
| Service 接口 | `service/AuthService.java` |
| Service 实现 | `service/impl/auth/AuthServiceImpl.java` |
| Entity | `entity/auth/User.java`, `RefreshToken.java`, `PasswordResetToken.java` |
| Repository | `repository/auth/UserRepository.java`, `RoleRepository.java`, `RefreshTokenRepository.java`, `UserRoleRepository.java`, `PasswordResetTokenRepository.java` |
| DTO | `dto/auth/*` |

### 模块依赖关系

```
koduck-auth
    ↓ (依赖)
koduck-common (新增共享模块，包含 dto/ApiResponse, exception/, util/JwtUtil 等)
    ↓ (依赖)
koduck-bom
```

koduck-core 将依赖 koduck-auth 使用其功能：

```
koduck-core
    ↓ (依赖)
koduck-auth
```

## Consequences

### 正向影响

1. **物理隔离**：auth 领域的代码独立编译，强制边界清晰
2. **独立演进**：auth 模块可以独立版本化、测试和发布
3. **基础先行**：auth 作为基础领域，为后续其他模块拆分提供依赖基础
4. **降低风险**：分阶段拆分比一次性重构风险更可控

### 代价与风险

1. **短期复杂度增加**：Maven 多模块配置更复杂，构建时间可能略有增加
2. **共享代码处理**：ApiResponse、异常类、JwtUtil 等共享代码需要决定是否下沉到 common 模块
3. **循环依赖风险**：若其他模块已依赖 auth 的实现细节，需要梳理并调整为依赖接口

### 兼容性影响

- **API 兼容性**：对外 REST API 保持不变，仅内部模块结构调整
- **数据库兼容性**：Entity 和 Repository 迁移不改变表结构
- **依赖兼容性**：koduck-core 通过 Maven 依赖继续使用 auth 功能，代码调用方式不变

## Alternatives Considered

1. **一次性拆分所有模块**
   - 拒绝：改动范围过大，风险集中，难以 review 和回滚

2. **保持单模块，仅加强包约束**
   - 未采用：包级别约束缺乏物理隔离，无法防止非法依赖

3. **先拆分共享 common 模块，再拆分业务模块**
   - 未采用：common 模块的内容边界不清晰，且 auth 模块本身可以作为其他模块依赖的基础

## Implementation Plan

1. 创建 `koduck-auth` 模块目录结构和 `pom.xml`
2. 迁移 auth 相关代码到 koduck-auth
3. 处理共享依赖（ApiResponse, exceptions, JwtUtil 等）
4. 更新 koduck-core 的 `pom.xml`，添加对 koduck-auth 的依赖
5. 更新父 `pom.xml`，添加 koduck-auth 模块
6. 运行质量门禁验证

## Verification

- `mvn -f koduck-backend/pom.xml clean compile` 通过
- `koduck-backend/scripts/quality-check.sh` 通过
- `mvn -f koduck-backend/pom.xml checkstyle:check` 无异常
- 所有现有测试通过
