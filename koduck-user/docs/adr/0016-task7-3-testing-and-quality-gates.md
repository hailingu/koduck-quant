# ADR-0016: Task 7.3 测试覆盖与质量门禁落地

## 元数据

- **状态**: 已接受
- **日期**: 2026-04-09
- **作者**: @hailingu
- **相关**: #705, docs/implementation/koduck-user-service-tasks.md Task 7.3, ADR-0015

---

## 背景与问题陈述

Task 7.3 要求 `koduck-user` 在进入上线阶段前，完成三层测试与最小质量门禁：

1. 单元测试覆盖 Service 核心规则（邮箱重验证、角色幂等、权限聚合）。
2. 集成测试覆盖 Controller + Repository + DB（Testcontainers）。
3. 端到端通过 APISIX 验证公开与内部 API 关键路径。
4. 门禁命令可在本地和 CI 复现（`compile` + `test`）。

此前测试主要集中在控制器切片与 `AuthClient`，缺少 Service 规则与真实数据库链路验证。

---

## 决策驱动因素

1. **风险前移**: 在合并前发现业务规则回归，避免上线后暴露权限/一致性问题。
2. **环境一致性**: 使用 Testcontainers 复现 PostgreSQL + Flyway 行为，减少“本地过、CI 挂”。
3. **网关一致性**: 通过 APISIX 验证内部 key-auth 401/200 行为与公开登录路径。
4. **可维护性**: 测试分层清晰，便于后续任务增量扩展。

---

## 考虑的选项

### 选项 1：仅保留 Mock/切片测试

**优点**:
- 运行快，改动小

**缺点**:
- 无法覆盖真实数据库迁移与持久化行为
- 无法证明 APISIX 网关链路验收

### 选项 2：补齐单元 + Testcontainers 集成 + APISIX e2e 脚本（选定）

**优点**:
- 对应 Task 7.3 三层验收
- 兼顾执行效率与真实性

**缺点**:
- 测试运行成本上升
- 引入 Testcontainers 依赖后，CI 需具备容器能力

### 选项 3：全部依赖集群手工回归

**优点**:
- 不增加仓库测试复杂度

**缺点**:
- 不可重复、不可自动化，无法作为稳定质量门禁

---

## 决策结果

采用 **选项 2**，实现三层测试与门禁：

1. 新增 `UserServiceImplTest`（单元）覆盖核心规则。
2. 新增 `InternalUserControllerIntegrationTest`（SpringBoot + Testcontainers PostgreSQL）覆盖控制器到数据库链路。
3. 新增 `scripts/e2e-koduck-user-apisix.sh`（APISIX e2e 冒烟）覆盖公开登录与内部 key-auth 行为。
4. 以 `mvn -f koduck-user/pom.xml -DskipTests compile` 与 `mvn -f koduck-user/pom.xml test` 作为最小门禁。

---

## 实施细节

### 变更文件

| 文件 | 变更说明 |
|------|------|
| `koduck-user/pom.xml` | 新增 Testcontainers 测试依赖 |
| `koduck-user/src/test/java/com/koduck/service/impl/UserServiceImplTest.java` | Service 单元测试 |
| `koduck-user/src/test/java/com/koduck/integration/InternalUserControllerIntegrationTest.java` | Testcontainers 集成测试 |
| `scripts/e2e-koduck-user-apisix.sh` | APISIX e2e 冒烟脚本 |

### 覆盖点映射

1. 邮箱重验证：`updateProfile` 邮箱变更后 `emailVerifiedAt` 清空。
2. 角色幂等：重复分配角色不重复写入 `user_roles`。
3. 权限聚合：按用户聚合权限列表。
4. Controller + DB：内部 API 创建用户、按用户名查询、回写最后登录信息。
5. APISIX e2e：`/api/v1/auth/login` 200、内部接口 missing/wrong key 401、正确 key 200。

---

## 权衡与影响

### 正向影响

- 核心业务规则具备自动化回归保护。
- Flyway + PostgreSQL 行为在测试中真实可验证。
- 网关鉴权关键路径具备可重放脚本。

### 负向影响

- `mvn test` 总时长增加（容器启动成本）。
- 本地运行需要 Docker 环境支持 Testcontainers。

### 缓解措施

- 集成测试范围保持在关键路径，避免过度膨胀。
- e2e 脚本保持轻量，仅验证网关关键行为。

---

## 兼容性影响

1. **运行时兼容性**: 仅增加测试与脚本，不改变生产接口契约。
2. **CI 兼容性**: 需容器能力以运行 Testcontainers。
3. **调用方兼容性**: 对外/内部 API 行为保持不变，强化了验证手段。

---

## 相关文档

- [koduck-user-service-tasks.md](../../../docs/implementation/koduck-user-service-tasks.md)
- [koduck-user-jwt-design.md](../../../docs/design/koduck-user-jwt-design.md)
- [koduck-user-api.yaml](../../../docs/design/koduck-user-api.yaml)
- [koduck-auth-user-service-design.md](../../../docs/design/koduck-auth-user-service-design.md)
- [ADR-0015](./0015-apisix-user-route-init-script.md)

---

## 变更日志

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-04-09 | 初始版本 | @hailingu |
