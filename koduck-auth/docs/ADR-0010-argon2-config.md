# ADR-0010: Argon2 密码哈希参数配置化

- Status: Accepted
- Date: 2026-04-08
- Issue: #648

## Context

koduck-auth 使用 Argon2id 进行密码哈希，当前实现使用 `Argon2::default()`，其默认参数为：
- memory_cost: 19456 (19 KB)
- time_cost: 2
- parallelism: 1

但设计文档要求更安全的参数：
- memory_cost: 65536 (64 MB)
- time_cost: 3
- parallelism: 4

此外，需要验证密码哈希性能满足 < 100ms 的要求。

## Decision

### 1. 参数配置化

从 `Config.security` 读取 Argon2 参数，创建自定义 `Argon2` 实例：

```rust
use argon2::{Argon2, Params};

let params = Params::new(
    config.security.argon2_memory_cost,    // 65536
    config.security.argon2_time_cost,      // 3
    config.security.argon2_parallelism,    // 4
    None, // output length (default)
)?;

let argon2 = Argon2::new(
    argon2::Algorithm::Argon2id,
    argon2::Version::V0x13,
    params,
);
```

### 2. 参数验证

在 `Config::validate()` 中验证 Argon2 参数：

```rust
if self.argon2_memory_cost < 1024 {
    return Err(ValidationError::new("Argon2 memory cost must be at least 1024"));
}
if self.argon2_time_cost < 1 {
    return Err(ValidationError::new("Argon2 time cost must be at least 1"));
}
if self.argon2_parallelism < 1 || self.argon2_parallelism > 255 {
    return Err(ValidationError::new("Argon2 parallelism must be between 1 and 255"));
}
```

### 3. 性能测试

使用 Criterion 创建 benchmark：

```rust
fn bench_password_hash(c: &mut Criterion) {
    c.bench_function("hash_password", |b| {
        b.iter(|| {
            hash_password(black_box("test_password_123"))
        })
    });
}
```

性能目标：
- 哈希操作: < 100ms
- 验证操作: < 100ms

## Consequences

### 正向影响

1. **安全性提升**: 使用推荐的 Argon2 参数，抵抗 GPU/ASIC 破解
2. **可配置性**: 可根据硬件能力调整参数
3. **性能可验证**: benchmark 确保性能满足要求
4. **标准化**: 符合 OWASP 密码存储指南

### 代价与风险

1. **性能下降**: 更高参数意味着更慢的计算（但 < 100ms 可接受）
2. **兼容性**: 已存储的密码哈希仍可用，新密码使用新参数
3. **资源占用**: 64MB 内存占用对并发场景有影响

### 兼容性影响

- **向后兼容**: 已存储的密码哈希验证不受影响
- **配置变更**: 需要确保生产环境配置符合推荐值

## Implementation Plan

1. **修改 password.rs**:
   - 添加 `hash_password_with_config` 和 `verify_password_with_config`
   - 使用 `Argon2::new()` 自定义参数
   - 保留旧函数使用默认参数（向后兼容）

2. **修改 config.rs**:
   - 验证 Argon2 参数范围

3. **创建 benchmark**:
   - `benches/password_hash.rs`
   - 测试 hash 和 verify 性能

4. **更新 service**:
   - AuthService 传递 Config 到密码函数

## References

- 任务文档: `docs/implementation/koduck-auth-rust-grpc-tasks.md` Task 4.2
- Argon2 规范: https://github.com/P-H-C/phc-winner-argon2
- OWASP 密码存储: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- Criterion: https://docs.rs/criterion/
