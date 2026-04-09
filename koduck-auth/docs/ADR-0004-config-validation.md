# ADR-0004: 配置验证机制设计

- Status: Accepted
- Date: 2026-04-07
- Issue: #636

## Context

koduck-auth 服务需要从环境变量和配置文件加载各种配置参数，包括服务器端口、数据库连接、JWT 设置、安全策略等。错误的配置可能导致：

1. **运行时失败**：如端口冲突、无效的数据库连接参数
2. **安全隐患**：如过短的 JWT 过期时间、过弱的 Argon2 参数
3. **性能问题**：如不合理的连接池大小
4. **难以调试**：配置错误在运行时才发现，增加排查成本

因此，需要在应用启动时进行全面的配置验证，确保所有参数在有效范围内。

## Decision

### 验证策略

采用**集中式验证**策略，在配置加载后立即进行验证：

```
Config::from_env() -> Config::validate() -> Result<Config, ConfigError>
```

### 验证规则

| 配置类别 | 验证规则 | 错误信息 |
|---------|---------|---------|
| **服务器端口** | 1-65535 范围 | "{port} is not a valid port number (1-65535)" |
| **JWT 过期时间** | access_token > 0, refresh_token > 0 | "Token expiration must be greater than 0" |
| **JWT 密钥路径** | 非空字符串 | "Private/Public key path cannot be empty" |
| **Argon2 内存成本** | ≥ 1024 (1MB) | "Argon2 memory cost must be at least 1024" |
| **Argon2 时间成本** | ≥ 1 | "Argon2 time cost must be at least 1" |
| **Argon2 并行度** | 1-255 | "Argon2 parallelism must be between 1 and 255" |
| **数据库连接池** | max > min, max ≥ 1, min ≥ 0 | "max_connections must be greater than min_connections" |
| **数据库超时** | > 0 | "Timeout must be greater than 0" |
| **密码长度** | min < max, min ≥ 1, max ≤ 128 | "Invalid password length configuration" |
| **登录限制** | max_attempts ≥ 1, lockout_duration > 0 | "Invalid login attempt configuration" |
| **客户端超时** | > 0 | "Client timeout must be greater than 0" |

### 实现方式

在 `Config` 结构体上实现 `validate()` 方法：

```rust
impl Config {
    pub fn validate(&self) -> Result<(), ConfigError> {
        // 验证服务器配置
        self.server.validate()?;
        // 验证数据库配置
        self.database.validate()?;
        // ... 其他配置验证
        Ok(())
    }
}
```

每个子配置结构体也实现各自的验证方法，便于单元测试和复用。

### 错误处理

使用 `config::ConfigError` 类型统一错误处理，验证失败时提供清晰的错误信息，帮助运维人员快速定位问题。

## Consequences

### 正向影响

1. **早失败原则**：配置错误在启动时发现，避免运行时故障
2. **清晰的错误信息**：帮助运维人员快速修复配置
3. **安全保障**：防止因配置错误导致的安全漏洞
4. **可测试性**：验证逻辑可独立测试

### 代价与风险

1. **启动延迟**：验证增加少量启动时间（可忽略）
2. **严格限制**：某些边界场景可能需要调整验证规则

### 兼容性影响

- **向后兼容**：现有有效配置不受影响
- **无效配置**：原本可能运行的无效配置现在会被拒绝

## Alternatives Considered

### 1. 运行时验证

- **方案**：在使用配置时进行验证
- **拒绝理由**：延迟发现问题，增加代码复杂度

### 2. 宏派生验证

- **方案**：使用 `validator` crate 的宏进行派生验证
- **拒绝理由**：增加额外依赖，当前需求简单，手动实现更清晰

## Implementation Plan

1. 为每个配置子结构体添加 `validate()` 方法
2. 在 `Config::from_env()` 中调用验证
3. 添加单元测试覆盖所有验证规则
4. 更新文档说明验证规则

## References

- 任务文档: `docs/implementation/koduck-auth-rust-grpc-tasks.md` Task 1.2
- 设计文档: `docs/design/koduck-auth-rust-grpc-design.md` 8.1 节
- config crate: https://docs.rs/config/
