# ADR-0011: 密码重置流程设计

- Status: Accepted
- Date: 2026-04-08
- Issue: #650

## Context

koduck-auth 需要实现密码重置功能，允许用户在忘记密码时通过邮箱重置。这是认证系统的基本功能。

密码重置流程涉及安全性考虑：
1. 重置令牌必须安全随机
2. 令牌有时效性（通常 1 小时）
3. 令牌一次性使用
4. 重置后需要吊销所有现有会话
5. 防止暴力破解（频率限制）

## Decision

### 1. 流程设计

#### Forgot Password

```
1. 用户提交邮箱
2. 查找用户（不存在也返回成功，不暴露信息）
3. 生成随机令牌（32 字节，URL-safe Base64）
4. 保存令牌哈希到数据库（SHA256）
5. 发送邮件（异步，包含原始令牌）
6. 返回成功
```

#### Reset Password

```
1. 用户提交令牌 + 新密码
2. 计算令牌哈希
3. 查询数据库验证令牌
4. 检查是否过期
5. 检查是否已使用
6. 开启事务
7. 更新密码
8. 标记令牌为已使用
9. 吊销所有用户 refresh token
10. 提交事务
11. 返回成功
```

### 2. 令牌生成

使用密码学安全的随机数生成器：

```rust
use rand::Rng;

let token: String = rand::thread_rng()
    .sample_iter(&rand::distributions::Alphanumeric)
    .take(32)
    .map(char::from)
    .collect();
```

令牌哈希保存（防止数据库泄露导致令牌暴露）：

```rust
let mut hasher = Sha256::new();
hasher.update(&token);
let token_hash = format!("{:x}", hasher.finalize());
```

### 3. 邮件发送

由于 koduck-auth 是认证服务，邮件发送委托给 koduck-user 或消息队列：

```rust
// 异步发送邮件（不阻塞响应）
tokio::spawn(async move {
    // 调用 koduck-user API 或发送消息队列
    send_password_reset_email(email, token).await;
});
```

当前简化实现：记录日志，实际邮件发送待集成。

### 4. 频率限制

使用 Redis 限制重置请求频率：

- 同一邮箱：每小时最多 3 次
- 同一 IP：每小时最多 10 次

## Consequences

### 正向影响

1. **用户体验**: 用户可以自助重置密码
2. **安全性**: 安全的令牌机制，防止重放攻击
3. **完整性**: 认证流程完整

### 代价与风险

1. **邮件依赖**: 需要可靠的邮件发送机制
2. **复杂度**: 涉及异步邮件发送和事务管理
3. **安全风险**: 如果邮箱被攻破，攻击者可以重置密码

### 兼容性影响

- **API 兼容**: 新增接口，不影响现有功能
- **数据库兼容**: 使用已有 password_reset_tokens 表

## Implementation Plan

1. **AuthService 添加方法**:
   - `forgot_password(email, ip)`
   - `reset_password(token, new_password)`

2. **添加 Redis 频率限制**:
   - `check_reset_rate_limit(email, ip)`

3. **邮件发送**:
   - 当前记录日志
   - TODO: 集成 koduck-user 或消息队列

4. **单元测试**:
   - 测试完整重置流程
   - 测试令牌过期
   - 测试频率限制

## References

- 任务文档: `koduck-auth/docs/implementation/koduck-auth-rust-grpc-tasks.md` Task 4.3
- OWASP 密码重置指南: https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
