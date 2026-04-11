# ADR-0017: 冻结 Auth/User `tenant_id` V1 语义

## 元数据

- **状态**: 已接受
- **日期**: 2026-04-11
- **作者**: @hailingu
- **相关**: #759, docs/implementation/koduck-auth-user-tenant-semantics-tasks.md Task 1.1, ADR-0016

---

## 背景与问题陈述

`koduck-auth` 与 `koduck-user` 已经有多租户设计草案，但现有模块设计文档仍残留单租户语义：用户名、邮箱、角色名被描述为全局唯一，内部 API 也没有固定 `X-Tenant-Id` 上下文来源。

如果在 Phase 2 之前不冻结 `tenant_id` 的 V1 语义，后续数据库迁移、JWT claims、internal API、gRPC 与 APISIX 透传会各自做出不同假设，导致同一个用户身份在跨服务调用中被不一致解释。

---

## 决策驱动因素

1. **跨服务一致性**: `koduck-auth`、`koduck-user`、APISIX 以及下游业务服务必须对租户有同一个解释。
2. **迁移可执行性**: 数据库字段类型、索引与唯一约束需要先有稳定定义。
3. **认证安全性**: 不能允许认证链路通过邮箱域名、角色名等弱信号推断租户。
4. **范围收敛**: V1 目标是打通租户身份语义，不引入 hierarchy 或跨租户共享模型。

---

## 考虑的选项

### 选项 1：延后冻结，等数据库与接口改造时再逐步决定

**优点**:
- 前期文档改动少

**缺点**:
- 各模块会在实现期形成不同假设
- 后续返工成本高，容易出现 schema / JWT / header 不一致

### 选项 2：现在冻结最小但完整的 V1 语义（选定）

**优点**:
- 为 Phase 2-5 提供统一边界
- 可以直接约束数据库、JWT、header、internal API 与 gRPC

**缺点**:
- 需要现在就放弃部分未来扩展自由度

### 选项 3：直接引入 hierarchy / tenant admin / 超级租户

**优点**:
- 一次性覆盖未来复杂场景

**缺点**:
- 超出当前任务范围
- 会显著拉高迁移与实现复杂度

---

## 决策结果

采用 **选项 2**，冻结 `tenant_id` 的 V1 语义如下：

1. `tenant_id` 统一使用字符串语义，数据库列类型固定为 `VARCHAR(128)`。
2. `tenant_id` 的真值来源是 `koduck-user` 的租户真值 `tenants.id` 以及用户记录上的 `users.tenant_id`。
3. `koduck-auth` 只负责读取并传播 `tenant_id`，不自行生成，也不从邮箱域名、角色名或其他隐式信息推断租户。
4. 跨服务用户身份统一解释为 `(tenant_id, user_id)`；单独的 `user_id` 不能作为完整身份语义。
5. APISIX 与下游服务统一消费认证链路传出的 `X-Tenant-Id`，不以自行解析 JWT 作为主路径。
6. V1 不支持 tenant hierarchy、父子租户继承、跨租户共享资源或超级租户穿透访问。

---

## 实施细节

### 文档落点

| 文件 | 变更说明 |
|------|------|
| `docs/design/koduck-auth-user-tenant-semantics.md` | 新增 Task 1.1 冻结结果，明确类型、长度、来源与 V1 边界 |
| `docs/implementation/koduck-auth-user-tenant-semantics-tasks.md` | 回填 Task 1.1 冻结结果 |
| `koduck-user/docs/design/koduck-auth-user-service-design.md` | 修正为租户化 schema、internal API 与上下文要求 |
| `koduck-auth/docs/design/koduck-auth-user-service-design.md` | 同步与 `koduck-user` 相同的跨服务设计约束 |

### 语义约束

1. `tenant_id` 是 opaque identifier，不约定前缀编码、层级语法或可解析结构。
2. 认证链路必须先确认租户，再允许用户名或邮箱查找用户。
3. 用户与角色的唯一性语义从“全局唯一”切换为“租户内唯一”。

---

## 权衡与影响

### 正向影响

- Phase 2-5 的实现拥有统一契约基础。
- 模块文档不再与根设计草案冲突。
- 为后续 `koduck-ai`、`memory` 等服务提供统一身份语义。

### 负向影响

- 未来如果需要 hierarchy，需要额外 ADR 扩展，而不是在 V1 中隐式兼容。
- 部分旧文档示例需要同步改写为带租户上下文的版本。

### 缓解措施

- 将 hierarchy、跨租户共享等需求显式留给后续 ADR。
- 在每个后续阶段任务中继续引用本 ADR 作为约束基线。

---

## 兼容性影响

1. **接口兼容性**: 当前任务仅冻结语义，不直接引入运行时代码破坏，但后续 internal API、JWT 与 gRPC 将基于本语义增加 `tenant_id`。
2. **数据兼容性**: 存量数据将在后续阶段以 `default` tenant 过渡，不要求当前阶段完成迁移。
3. **认知兼容性**: 所有服务必须停止使用“全局唯一用户名、邮箱、角色名”的旧前提。

---

## 相关文档

- [koduck-auth-user-tenant-semantics.md](../../../docs/design/koduck-auth-user-tenant-semantics.md)
- [koduck-auth-user-tenant-semantics-tasks.md](../../../docs/implementation/koduck-auth-user-tenant-semantics-tasks.md)
- [koduck-auth-user-service-design.md](../design/koduck-auth-user-service-design.md)

---

## 变更日志

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-04-11 | 初始版本 | @hailingu |
