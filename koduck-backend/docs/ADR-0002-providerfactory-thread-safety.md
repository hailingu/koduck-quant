# ADR-0002: ProviderFactory 注册表线程安全策略

- Status: Accepted
- Date: 2026-04-01
- Issue: #294

## Context

`ProviderFactory` 使用 `ConcurrentHashMap<MarketType, List<MarketDataProvider>>` 管理市场与 provider 列表映射。
原实现中，列表值为 `ArrayList`，并在 `registerProvider()` 中通过 `computeIfAbsent(...).add(...)` 进行写入。

该结构在并发注册、反注册与读取（如 `getAvailableProvider()` 的遍历）并发发生时，存在可见性与迭代安全风险，可能导致：
- 列表并发修改异常；
- 读写竞态下状态不一致；
- 回退选择逻辑行为不稳定。

## Decision

对 `providersByMarket` 的值类型改为 `CopyOnWriteArrayList`，并在对外 `getProviders()` 返回时使用只读快照（`List.copyOf`）。

具体策略：
- `registerProvider()`：`computeIfAbsent(..., k -> new CopyOnWriteArrayList<>()).add(provider)`。
- `getProviders()`：返回不可变快照，避免外部代码直接修改内部状态。

## Consequences

正向影响：
- 并发迭代与写入不再共享可变游标，降低 `ConcurrentModificationException` 风险。
- provider 注册表语义更稳定，读操作不受并发写入影响。
- 通过只读快照保护内部结构，减少外部误用。

代价与权衡：
- `CopyOnWriteArrayList` 写时复制带来写放大开销。
- 适用于“读多写少”场景；若将来 provider 动态变更频繁，需要重新评估数据结构（如锁分段或无锁队列方案）。

## Alternatives Considered

1. `Collections.synchronizedList(new ArrayList<>())`
- 未采用：仍需要调用方手动在遍历时加锁，易误用。

2. 使用显式 `ReentrantReadWriteLock`
- 未采用：复杂度更高，不符合本次缺陷修复的最小改动目标。

3. 保持现状
- 拒绝：无法满足并发安全要求。

## Verification

- 新增并发测试：在多线程下并发执行 register/unregister/read 路径，验证无异常抛出。
