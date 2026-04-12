# ADR-0009: Session Repository 设计与实现

- Status: Accepted
- Date: 2026-04-12
- Issue: #804

## Context

Task 3.1 要求实现 `memory_sessions` 的 DAO 层（Session Repository），为后续 `GetSession`（Task 3.2）和 `UpsertSessionMeta`（Task 3.3）提供数据访问能力。

在 Task 3.1 之前：
- `memory_sessions` 表已通过 migration 基线（0001）建好，包含完整的字段、主键和索引。
- `session/` 模块仅是一个 placeholder，没有实际代码。
- `MemoryGrpcService` 中 `get_session` 和 `upsert_session_meta` 均返回 `NOT_IMPLEMENTED`。
- 服务启动时 `RuntimeState` 持有 `PgPool`，但未传递给 gRPC service 层。

需要解决的关键问题：
1. 如何在 Rust 中映射 `memory_sessions` 表到结构体（含 UUID、JSONB、timestamptz 类型）。
2. `session_id` 在 proto 中是 `string`，在 DB 中是 `UUID` — 需要明确的转换策略。
3. `extra` 在 proto 中是 `map<string, string>`，在 DB 中是 `JSONB` — 需要序列化/反序列化。
4. Upsert 如何保证幂等且不产生重复 session。
5. `RuntimeState` 如何注入到 gRPC service 层。

## Decision

### 模型层：`Session` 结构体

定义一个独立于 proto 的 domain model `Session`，直接映射数据库列：

```rust
pub struct Session {
    pub session_id: Uuid,
    pub tenant_id: String,
    pub user_id: String,
    pub parent_session_id: Option<Uuid>,
    pub forked_from_session_id: Option<Uuid>,
    pub title: String,
    pub status: String,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
    pub last_message_at: OffsetDateTime,
    pub extra: serde_json::Value,
}
```

使用 `sqlx::FromRow` 自动映射，避免手写列名解析。

### 类型转换策略

| 字段 | Proto 类型 | DB 类型 | Rust 类型 | 转换 |
|------|-----------|---------|-----------|------|
| session_id | string | UUID | Uuid | `Uuid::parse_str` / `to_string()` |
| parent_session_id | string | UUID nullable | Option<Uuid> | 同上，空串映射为 None |
| forked_from_session_id | string | UUID nullable | Option<Uuid> | 同上 |
| created_at / updated_at / last_message_at | int64 (unix ms) | TIMESTAMPTZ | OffsetDateTime | `from_unix_millis` / `unix_timestamp()` |
| extra | map<string, string> | JSONB | serde_json::Value | `serde_json::to_value` / `as_object()` |

### Repository 层：`SessionRepository`

`SessionRepository` 持有 `PgPool` 引用，提供以下方法：

1. **`get_by_id(tenant_id, session_id)`** — 按 `tenant_id + session_id` 查询，不存在时返回 `None`。
2. **`upsert(session)`** — 使用 `INSERT ... ON CONFLICT (session_id) DO UPDATE` 实现幂等写入：
   - `created_at` 仅在 INSERT 时设置，UPDATE 时不覆盖。
   - `updated_at` 每次都刷新为 `now()`。
   - 其余字段按传入值更新。
3. **`update_meta(tenant_id, session_id, ...)`** — 局部更新 `title/status/last_message_at/extra`，不传的字段保持原值。

### 依赖注入

将 `RuntimeState` 注入到 `MemoryGrpcService` 中：
- `MemoryGrpcService::new(config, runtime)` 同时持有 `AppConfig` 和 `RuntimeState`。
- 在 `app/lifecycle.rs` 中创建 service 时传入 `runtime`。
- `SessionRepository::new(pool)` 从 `RuntimeState::pool()` 获取连接池。

### 模块结构

```
src/session/
  mod.rs         — 模块导出
  model.rs       — Session domain model
  repository.rs  — SessionRepository DAO
```

## Consequences

### 正向影响

1. `session/` 模块从 placeholder 变为可工作的数据访问层。
2. 为 Task 3.2（GetSession）和 Task 3.3（UpsertSessionMeta）提供直接可用的 Repository。
3. Domain model 与 proto 解耦，后续 proto 字段扩展不会直接影响 DAO 层。

### 权衡与代价

1. 引入 `uuid` 和 `time` crate 作为新增依赖（sqlx UUID feature 和时间转换）。
2. `Session` 结构体与 proto `SessionInfo` 存在冗余 — 需要显式转换函数，但这是 domain 层与 contract 层解耦的合理代价。
3. `extra` 使用 `serde_json::Value` 而非强类型 — 与 DB JSONB 对齐，但失去了类型安全；V1 可以接受。

### 兼容性影响

1. 无 proto 变更，完全向后兼容。
2. `MemoryGrpcService` 构造函数签名变更，但仅影响内部启动流程。
3. 数据库无 migration 变更，表结构已由 0001 基线定义。

## Alternatives Considered

### 1. 直接使用 proto SessionInfo 作为 DAO model

- 未采用理由：proto 类型不含 `sqlx::FromRow` 派生，且 proto 字段是 `String` 而非 `Uuid`，会导致 DAO 层充斥类型转换逻辑。

### 2. 使用 diesel ORM

- 未采用理由：项目已使用 sqlx，且 Task 2.3 的 migration 也是 sqlx 驱动的。引入 diesel 会导致两个 ORM 共存。

### 3. 在 Repository 层直接返回 proto 类型

- 未采用理由：违反关注点分离 — Repository 应该返回 domain model，由 service 层负责 proto 转换。

## Verification

- `cargo test` — 单元测试覆盖 model 转换和 repository 逻辑
- `docker build -t koduck-memory:dev ./koduck-memory`
- `kubectl rollout restart deployment/dev-koduck-memory -n koduck-dev`
- `kubectl rollout status deployment/dev-koduck-memory -n koduck-dev --timeout=180s`

## References

- 设计文档: [koduck-memory-for-koduck-ai.md](../../../docs/design/koduck-memory-for-koduck-ai.md)
- 任务清单: [koduck-memory-koduck-ai-tasks.md](../../../docs/implementation/koduck-memory-koduck-ai-tasks.md)
- 前序 ADR: [0008-memory-capabilities-contract.md](./0008-memory-capabilities-contract.md)
- Issue: [#804](https://github.com/hailingu/koduck-quant/issues/804)
