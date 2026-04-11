# ADR-0020: Task 3.1 让 koduck-user 实体与 Repository 对齐 tenant scope

## 元数据

- **状态**: 已接受
- **日期**: 2026-04-11
- **作者**: @hailingu
- **相关**: #770, docs/implementation/koduck-auth-user-tenant-semantics-tasks.md Task 3.1, ADR-0019

---

## 背景与问题陈述

Task 2.1 与 Task 2.3 已经完成 `koduck-user` 的 tenant 列引入和租户内唯一约束切换，但应用层仍存在两类不一致：

1. `User`、`Role`、`UserRole`、`RolePermission`、`UserCredential` 实体没有 `tenant_id`
2. `UserRepository`、`RoleRepository`、`UserRoleRepository`、`RolePermissionRepository` 仍以全局范围查询为主

如果不先完成这一层收口，后续 Task 3.2 的 internal API 租户上下文和 Task 3.3 的 `UserContext` 扩展就会继续建立在全局查询假设上。

---

## 决策驱动因素

1. **实体一致性**: JPA 实体必须与当前数据库 schema 对齐。
2. **查询收口**: Repository 需要显式表达 tenant scope，避免继续跨租户读取。
3. **渐进兼容**: 在 Task 3.2 引入 `X-Tenant-Id` 之前，需要一个可运行的默认 tenant 兼容路径。
4. **任务边界清晰**: 本任务处理实体与 repository，不修改 internal API 契约。

---

## 考虑的选项

### 选项 1：只补实体字段，Repository 暂时保持全局

**优点**:
- 改动较少

**缺点**:
- “查询不再是全局范围”的验收标准无法满足
- 后续 Task 3.2 仍需要先清理 repository 全局方法

### 选项 2：实体与 Repository 一起 tenant-aware，并在服务层先收口到 `default` tenant（选定）

**优点**:
- 直接满足 Task 3.1 的两个验收标准
- 为 Task 3.2 留出清晰的 header 注入点
- 不提前改变对外/internal API 结构

**缺点**:
- 在 `X-Tenant-Id` 引入前，服务层仍需保留默认 tenant 过渡逻辑

### 选项 3：等 Task 3.2 / 3.3 再一起修改

**优点**:
- 减少本任务修改量

**缺点**:
- 违背任务拆分顺序
- 风险和改动面过大

---

## 决策结果

采用 **选项 2**：

1. 为 `User`、`Role`、`UserRole`、`RolePermission`、`UserCredential` 增加 `tenantId` 字段，并与表结构保持一致
2. 将 repository 主查询路径切为 tenant-aware 形式，例如 `findByTenantIdAndUsername`
3. 在 `UserServiceImpl`、`RoleServiceImpl`、`PermissionServiceImpl` 中统一通过 `default` tenant 调用 repository，先消除全局查询
4. `InternalUserController` 的 header 契约留给 Task 3.2 再扩展

---

## 实施细节

### 变更文件

| 文件 | 变更说明 |
|------|------|
| `koduck-user/src/main/java/com/koduck/entity/user/*.java` | 为核心实体补充 `tenantId` 字段，并让实体注解与当前 schema 对齐 |
| `koduck-user/src/main/java/com/koduck/repository/user/*.java` | 将用户、角色、关系表 repository 改为显式 tenant-aware 查询 |
| `koduck-user/src/main/java/com/koduck/service/impl/*.java` | 现阶段统一通过 `default` tenant 调用 repository，去除全局范围查询 |
| `koduck-user/src/test/java/...` | 调整测试到 tenant-aware repository 语义 |
| `docs/implementation/koduck-auth-user-tenant-semantics-tasks.md` | 回填 Task 3.1 执行结果与 checklist |

---

## 权衡与影响

### 正向影响

- 实体与数据库 schema 正式一致。
- Repository 查询不再默认走全局范围。
- Task 3.2 可以直接在服务层上方注入 `X-Tenant-Id`，无需再回头重构 repository。

### 负向影响

- 当前阶段的 tenant 来源仍是固定的 `default`。
- internal API 仍未显式暴露租户上下文。

### 缓解措施

- 在 Task 3.2 中扩展 `InternalUserController` 支持 `X-Tenant-Id`。
- 在 Task 3.3 中把 `tenant_id` 纳入 `UserContext`，替代固定默认值。

---

## 兼容性影响

1. **运行时兼容性**: 现有调用链仍可工作，因为服务层暂时统一使用 `default` tenant。
2. **数据兼容性**: 继续沿用前序任务中对 `default` tenant 的回填策略。
3. **接口兼容性**: 本任务不修改 HTTP/internal API 输入输出结构。

---

## 相关文档

- [koduck-auth-user-tenant-semantics.md](../../../docs/design/koduck-auth-user-tenant-semantics.md)
- [koduck-auth-user-tenant-semantics-tasks.md](../../../docs/implementation/koduck-auth-user-tenant-semantics-tasks.md)
- [ADR-0019](./0019-switch-uniqueness-constraints-to-tenant-scope.md)

---

## 变更日志

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-04-11 | 初始版本 | @hailingu |
