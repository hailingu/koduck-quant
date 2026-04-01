# ADR-0004: Entity 核心字段不可变约定（id / createdAt）

- Status: Accepted
- Date: 2026-04-01
- Issue: #298

## Context

当前大量 Entity 通过 Lombok `@Data` 或 `@Setter` 生成全量 setter，导致核心字段（如主键 `id` 与创建时间 `createdAt`）也可被业务代码直接改写。

这会带来风险：

- 持久化标识可能被意外篡改；
- 创建时间元数据完整性变弱；
- 领域对象不变量不清晰。

## Decision

在 Entity 层引入统一约束：

- 对主键字段（`@Id` + `id`）禁用 setter；
- 对创建时间字段（映射 `created_at` 的 `createdAt`）禁用 setter；
- 继续通过 JPA 持久化机制、构造器或 Builder 初始化这些字段。

技术实现采用 Lombok 字段级注解：

- `@Setter(AccessLevel.NONE)`

## Consequences

正向影响：

- 降低核心字段被误改的概率；
- 强化 Entity 的生命周期语义（创建后不可随意重写）；
- 约束比“团队约定”更可执行，落地到编译期结构。

代价：

- 依赖这些 setter 的调用需要调整；
- 测试/夹具中若直接设置 `id` 或 `createdAt`，需改为其他构造方式。

## Alternatives Considered

1. 保持现状，仅靠代码评审约束  
   - 拒绝：执行不稳定，容易回退。

2. 全量移除 Entity 上所有 setter  
   - 暂不采用：改动过大、影响面超出当前问题范围。

## Verification

- 已在 entity 包批量应用字段级 setter 禁用；
- 主代码执行编译验证（`mvn -DskipTests compile`）。
