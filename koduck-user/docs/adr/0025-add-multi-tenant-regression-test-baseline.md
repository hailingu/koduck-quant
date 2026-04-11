# ADR-0025: 为用户域补齐多租户回归测试基线

## 状态

已接受

## 背景

Task 2.x 到 Task 5.x 已经把 `tenant_id` 从 schema、repository、internal API、JWT 与 APISIX 透传链路打通，但当前自动化测试仍然存在两个缺口：

1. 已有测试更多聚焦单点能力，缺少“同用户名/邮箱跨租户共存、同租户冲突失败”的服务级回归基线。
2. 缺少一组能直接证明“查询不会串租户”的集成测试，后续修改很容易在 repository/service/controller 某一层重新引入跨租户可见性问题。

Task 6.1 需要把这些风险沉淀为可重复执行的单元与集成测试，而不是继续依赖人工回归。

## 决策

本次采用以下测试策略：

1. 保留现有 schema 迁移测试，继续验证数据库层的租户内唯一约束。
2. 在 `UserServiceImplTest` 中补充 tenant-aware 单元测试，明确服务层不会跨 tenant 回退查询，也不会把唯一性校验错误地落到别的 tenant。
3. 在 `InternalUserControllerIntegrationTest` 中加入真实数据库场景：
   - 同用户名/邮箱在不同 tenant 下可以共存
   - internal lookup 必须按 `X-Tenant-Id` 返回当前 tenant 的用户
   - 同 tenant 下重复创建会返回 `409`

## 权衡

### 收益

- 多租户语义从“设计正确”升级成“自动化可验证”。
- 一旦 repository 或 service 层误用了无 tenant 条件查询，测试会直接失败。
- 后续 Task 6.2/6.3 与下游服务适配时，可以复用这组测试作为基线。

### 代价

- 集成测试继续依赖 Testcontainers 与 PostgreSQL，执行成本高于纯单测。
- 测试数据准备需要显式构造多个 tenant，测试代码会比单租户场景更长。

## 兼容性影响

1. 本次变更只增加测试与文档，不改变运行时接口契约。
2. 对 CI 的影响是会新增多租户回归用例，但它们仍然复用现有 `koduck-user` 测试设施。
3. 后续如果默认 tenant 过渡策略变化，相关测试数据可以按同样结构继续扩展，而无需推翻当前基线。
