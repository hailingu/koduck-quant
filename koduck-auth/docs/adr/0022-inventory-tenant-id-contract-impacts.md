# ADR-0022: Task 1.2 租户契约影响清单冻结

## 元数据

- **状态**: 已接受
- **日期**: 2026-04-11
- **作者**: @hailingu
- **相关**: #761, docs/implementation/koduck-auth-user-tenant-semantics-tasks.md Task 1.2, ADR-0021

---

## 背景与问题陈述

Task 1.1 已冻结 `tenant_id` 的语义，但还没有明确“哪些现有 JWT、internal API、gRPC 契约必须调整，哪些不需要动”。如果没有这层盘点，后续各阶段很容易出现两类问题：

1. 漏改关键返回结构，导致下游只能拿到 `user_id` 而拿不到租户。
2. 在 internal HTTP 和 gRPC 上重复设计 `tenant_id` 的传递方式，形成 header、body、message 三套不一致语义。

因此需要先冻结 Task 1.2 的契约影响边界，再进入 Phase 2-5 的实现。

---

## 决策驱动因素

1. **完整性**: 必须列清所有会被多租户语义影响的契约面，而不是只列设计文档中提到的几个代表项。
2. **一致性**: HTTP internal API 与 gRPC 需要采用清晰且一致的传递规则。
3. **最小重复**: 避免在 header、body、response 同时重复携带 `tenant_id`，造成双真值。
4. **可实施性**: 后续开发任务需要直接依据本清单逐项落代码与测试。

---

## 考虑的选项

### 选项 1：仅在根设计文档中保留抽象描述

**优点**:
- 文档最少

**缺点**:
- 无法告诉实施者具体该改哪个 DTO、哪个 message
- 容易在 auth/user 两边产生理解偏差

### 选项 2：补一份专门的契约影响清单，并同步关键合同文档（选定）

**优点**:
- 能直接映射到 JWT model、internal DTO、proto message
- 便于后续按阶段实现

**缺点**:
- 文档维护成本略有增加

### 选项 3：直接修改所有 proto / DTO / OpenAPI，而不先盘点

**优点**:
- 看起来推进更快

**缺点**:
- 在数据库和运行时语义尚未全面落地前，容易做出过度或错误改动
- 缺少边界文档，不利于审查

---

## 决策结果

采用 **选项 2**，冻结 Task 1.2 的契约盘点规则：

1. **JWT / OIDC / introspection**
   - 所有直接表达 claims 或 claims 投影的结构，都要补充 `tenant_id`
2. **internal HTTP API**
   - `koduck-auth -> koduck-user` 统一通过 `X-Tenant-Id` 传递租户上下文
   - 请求体 DTO 默认不重复增加 `tenant_id`
   - 身份回传 DTO（如 `UserDetailsResponse`）需要显式增加 `tenantId`
3. **gRPC**
   - 由于当前没有统一 metadata 约定，涉及身份作用域的 request/response message 必须显式增加 `tenant_id`，或通过 `UserInfo` 回传
4. **边界排除**
   - `RefreshTokenRequest/Response` 与 `GenerateTokenPairResponse` 不额外增加顶层 `tenant_id`，避免与 JWT claims 形成双真值

---

## 实施细节

### 文档落点

| 文件 | 变更说明 |
|------|------|
| `docs/design/koduck-auth-user-tenant-semantics.md` | 增加 Task 1.2 契约盘点摘要与入口链接 |
| `docs/design/koduck-auth-user-tenant-contract-inventory.md` | 新增完整影响清单 |
| `koduck-user/docs/contracts/koduck-auth-user-internal-api-contract.md` | 固定 `X-Tenant-Id` header 语义与 DTO 边界 |

### 关键边界

1. `X-Tenant-Id` 是 internal HTTP 的单一请求上下文来源。
2. gRPC 不依赖隐式 metadata，而是依赖显式 message 字段。
3. `tenant_id` 只在“返回身份”时进入响应 DTO，不在普通更新类 body 中重复出现。

---

## 权衡与影响

### 正向影响

- 后续 Phase 3-5 可直接按清单落地，不需要再次猜测契约边界。
- HTTP 和 gRPC 的租户传递策略更清晰。
- 审查时可以直接对照“是否漏项”。

### 负向影响

- 需要维护一份额外的契约盘点文档。
- 某些现有设计文档中的示例会暂时落后于目标契约，直到后续实现阶段同步更新。

### 缓解措施

- 将完整清单集中在单一文档中，减少分散维护成本。
- 后续实现 PR 需明确引用本 ADR 与影响清单。

---

## 兼容性影响

1. **运行时兼容性**: 本任务仅冻结清单，不直接修改运行时代码。
2. **接口兼容性**: 后续实现会对部分 proto、DTO、OpenAPI 产生非向后兼容变更，需要在相关阶段评估灰度路径。
3. **调用方兼容性**: 下游未来需要显式消费 `tenant_id` 或 `X-Tenant-Id`，不能继续只依赖 `user_id`。

---

## 相关文档

- [koduck-auth-user-tenant-semantics.md](../../../docs/design/koduck-auth-user-tenant-semantics.md)
- [koduck-auth-user-tenant-contract-inventory.md](../../../docs/design/koduck-auth-user-tenant-contract-inventory.md)
- [koduck-auth-user-internal-api-contract.md](../../../koduck-user/docs/contracts/koduck-auth-user-internal-api-contract.md)

---

## 变更日志

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-04-11 | 初始版本 | @hailingu |
