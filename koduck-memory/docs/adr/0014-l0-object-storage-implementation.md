# ADR-0014: L0 对象存储实现

- Status: Accepted
- Date: 2026-04-12
- Issue: #815

## Context

Task 4.3 要求实现 L0（Layer 0）原始材料的对象存储写入。当前 `AppendMemory` 实现中，`l0_uri` 使用占位值 `l0://pending/{entry_id}`，尚未实际写入对象存储。

L0 存储需要满足：
1. 原始对话内容的完整保留，支持回放与审计
2. 不触发单对象重写竞争（S3/MinIO 不支持原地追加）
3. 符合多租户隔离的对象 Key 组织
4. 支持离线排障和数据分析

需要决策：
1. 对象 Key 的命名策略（如何组织租户、会话、条目层级）
2. 数据格式（JSON vs JSONL vs 其他）
3. 写入时机与事务边界
4. URI 格式规范（`s3://` vs `minio://` vs `l0://`）

## Decision

### 1. 对象 Key 命名策略

采用分层前缀组织，确保租户隔离和可遍历性：

```
tenants/{tenant_id}/sessions/{session_id}/entries/{sequence_num}-{entry_id}.json
```

设计理由：
- `tenants/{tenant_id}/` - 强制租户前缀，支持按租户的生命周期管理和权限边界
- `sessions/{session_id}/` - 会话分组，便于按会话检索和清理
- `entries/` - 条目子目录，避免单目录对象过多
- `{sequence_num}-{entry_id}.json` - 序列号保证顺序，entry_id 保证唯一性

### 2. 数据格式：JSON

每个 entry 独立存储为一个 JSON 对象：

```json
{
  "schema_version": "1.0",
  "session_id": "uuid",
  "tenant_id": "string",
  "entry_id": "uuid",
  "sequence_num": 1,
  "role": "user|assistant|system",
  "content": "string",
  "timestamp": "2026-04-12T13:56:00Z",
  "metadata": {
    "message_id": "string",
    "turn_id": "string",
    "model": "string"
  },
  "request_id": "string",
  "trace_id": "string",
  "stored_at": "2026-04-12T13:56:01Z"
}
```

设计理由：
- 独立对象避免并发写入冲突
- JSON 格式人类可读，便于调试
- `schema_version` 支持未来格式演进

### 3. 写入时机与事务边界

```
1. 分配 sequence_num（事务内）
2. 构建 L0 对象内容
3. 写入对象存储（事务外）
4. 获取对象 URI
5. 写入 PostgreSQL memory_entries（事务内，含 l0_uri）
```

关键决策：对象存储写入在 PostgreSQL 事务外执行。理由：
- S3/MinIO 不支持两阶段提交，无法与 PostgreSQL 事务原子化
- 先写对象存储再写数据库，确保数据库记录始终指向有效对象
- 失败时对象可能成为孤儿，通过后台清理任务回收

### 4. URI 格式规范

存储 URI 采用统一格式：

```
s3://{bucket}/tenants/{tenant_id}/sessions/{session_id}/entries/{sequence_num}-{entry_id}.json
```

- 统一使用 `s3://` scheme，不区分 S3 或 MinIO（MinIO 是 S3 兼容的）
- bucket 名包含在 URI 中，便于跨 bucket 迁移

### 5. 对象存储客户端设计

新增 `store::ObjectStoreClient`：

```rust
pub struct ObjectStoreClient {
    client: aws_sdk_s3::Client,
    bucket: String,
    endpoint: String,
}

impl ObjectStoreClient {
    pub async fn put_l0_entry(
        &self,
        tenant_id: &str,
        session_id: Uuid,
        sequence_num: i64,
        entry_id: Uuid,
        content: L0EntryContent,
    ) -> Result<String>;
}
```

依赖：使用 `aws-sdk-s3` 0.39+，支持 S3 兼容端点（MinIO）。

## Consequences

### 正向影响

1. **可追溯性**：每条 memory entry 都有完整的 L0 来源
2. **审计能力**：原始材料永久保存，支持回放
3. **离线分析**：可直接访问对象存储进行大数据分析
4. **无单对象竞争**：每个 entry 独立对象，天然无并发冲突

### 权衡与代价

1. **存储开销**：独立 JSON 对象比聚合 JSONL 占用更多存储（HTTP 头、padding）
2. **List 性能**：单会话条目过多时，ListObjectsV2 可能变慢（建议用数据库索引）
3. **孤儿对象风险**：数据库写入失败后，对象可能成为孤儿，需要后台清理

### 兼容性影响

1. **URI scheme 变更**：从 `l0://pending/...` 变为 `s3://...`，下游需适配
2. **新增依赖**：引入 `aws-sdk-s3` 及相关 crate
3. **配置变更**：需要验证 `OBJECT_STORE__*` 配置项已正确设置

## Alternatives Considered

### 1. JSONL 聚合文件

- **方案**：按会话聚合为 JSONL 文件，每行一个 entry
- **未采用理由**：S3 不支持原地追加，需要重写整个文件，引入并发冲突

### 2. 先写数据库后写对象存储

- **方案**：PostgreSQL 事务成功后，异步写入对象存储
- **未采用理由**：可能导致数据库记录指向不存在的对象，破坏可追溯性

### 3. 使用 MinIO 原生 SDK

- **方案**：使用 `minio` crate 而非 `aws-sdk-s3`
- **未采用理由**：`aws-sdk-s3` 是标准实现，MinIO 完全兼容 S3 API，使用 AWS SDK 更具通用性

## Implementation

### 新增文件

- `src/store/object_store.rs` - 对象存储客户端
- `src/store/l0.rs` - L0 内容模型和序列化

### 修改文件

- `src/capability/service.rs` - `append_memory` 集成 L0 写入
- `Cargo.toml` - 添加 `aws-sdk-s3` 依赖
- `src/store/mod.rs` - 暴露新模块

### 配置验证

确保以下环境变量已设置：

```bash
OBJECT_STORE__ENDPOINT=http://minio:9000
OBJECT_STORE__BUCKET=koduck-memory
OBJECT_STORE__ACCESS_KEY=minioadmin
OBJECT_STORE__SECRET_KEY=minioadmin
OBJECT_STORE__REGION=ap-east-1
```

## Verification

- `docker build -t koduck-memory:dev ./koduck-memory`
- `kubectl rollout restart deployment/dev-koduck-memory -n koduck-dev`

## References

- 设计文档: `docs/design/koduck-memory-for-koduck-ai.md`
- 任务清单: `docs/implementation/koduck-memory-koduck-ai-tasks.md`
- 前序 ADR: `0013-append-memory-implementation.md`
- Issue: [#815](https://github.com/hailingu/koduck-quant/issues/815)
