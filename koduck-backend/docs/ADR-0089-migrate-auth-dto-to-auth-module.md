# ADR-0089: 迁移 Auth DTO 到 koduck-auth 模块

- Status: Accepted
- Date: 2026-04-04
- Issue: #472

## Context

在 ADR-0086 中，我们创建了 koduck-auth 模块作为认证领域的独立模块。目前已完成 koduck-common 共享代码的迁移，现在开始迁移 koduck-auth 的业务代码。

Auth 相关的 DTO（数据传输对象）是认证领域的核心组成部分，应优先迁移到 koduck-auth 模块。

## Decision

将 koduck-core 中的 auth 相关 DTO 迁移到 koduck-auth 模块。

### 迁移范围

| DTO | 说明 | 依赖分析 |
|-----|------|----------|
| LoginRequest | 登录请求 | 仅依赖 jakarta.validation，可迁移 ✅ |
| RegisterRequest | 注册请求 | 仅依赖 jakarta.validation，可迁移 ✅ |
| ForgotPasswordRequest | 忘记密码请求 | 仅依赖 jakarta.validation，可迁移 ✅ |
| ResetPasswordRequest | 重置密码请求 | 仅依赖 jakarta.validation，可迁移 ✅ |
| RefreshTokenRequest | 刷新令牌请求 | 仅依赖 jakarta.validation，可迁移 ✅ |
| SecurityConfigResponse | 安全配置响应 | 仅依赖 lombok，可迁移 ✅ |

### 暂时保留

| DTO | 说明 | 保留原因 |
|-----|------|----------|
| TokenResponse | 令牌响应 | 依赖 UserInfo，需等 UserInfo 迁移后再处理 |

## Consequences

### 正向影响

1. **领域归属清晰**：Auth DTO 归属 koduck-auth 模块
2. **独立演进**：koduck-auth 可以独立编译和测试
3. **为后续迁移做准备**：DTO 迁移后，可以继续迁移 Service 和 Controller

### 代价与风险

1. **模块依赖**：koduck-core 需要依赖 koduck-auth 才能使用这些 DTO
2. **循环依赖风险**：需确保 koduck-auth 不反向依赖 koduck-core

### 兼容性影响

- **API 兼容性**：无变化，包名和字段保持不变
- **行为兼容性**：无变化，纯代码位置迁移

## Implementation Plan

1. 在 koduck-auth 中创建 dto/auth 目录
2. 迁移 6 个 DTO 文件
3. 更新 koduck-core 的 pom.xml，添加对 koduck-auth 的依赖
4. 从 koduck-core 删除已迁移的 DTO
5. 运行质量门禁验证

## Verification

- `mvn -f koduck-backend/pom.xml clean compile` 通过
- `koduck-backend/scripts/quality-check.sh` 通过
- `mvn -f koduck-backend/pom.xml checkstyle:check` 无异常
- 所有现有测试通过
