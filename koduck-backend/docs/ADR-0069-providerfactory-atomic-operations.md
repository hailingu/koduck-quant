# ADR-0069: 使用 ReentrantReadWriteLock 保证 ProviderFactory 跨 Map 操作原子性

- Status: Accepted
- Date: 2026-04-04
- Issue: #432

## Context

根据 `ARCHITECTURE-EVALUATION.md` 的并发安全性评估，`ProviderFactory` 中 `registerProvider` / `unregisterProvider` 涉及 3 个 `ConcurrentHashMap` 的复合操作：

| Map | 用途 |
|-----|------|
| `providersByName` | 按 provider 名称索引 |
| `providersByMarket` | 按市场类型分组 |
| `primaryProviders` | 每个市场的主 provider |

### 当前实现的问题

**`registerProvider`**（第 43-56 行）：
```java
providersByName.put(providerName, provider);
providersByMarket.computeIfAbsent(marketType, k -> new CopyOnWriteArrayList<>()).add(provider);
primaryProviders.putIfAbsent(marketType, provider);
```

**`unregisterProvider`**（第 63-86 行）：
```java
providersByName.remove(providerName);
providersByMarket.get(marketType).remove(provider);
if (primaryProviders.get(marketType) == provider) {
    primaryProviders.put(marketType, remaining.get(0)); // or remove
}
```

虽然每个 `ConcurrentHashMap` 的单次操作是线程安全的，但**跨多个 Map 的复合操作并不是原子的**。这导致：
- **中间状态可见**：其他线程可能在 `providersByName` 已写入但 `providersByMarket` 尚未写入时读取到不一致状态
- **Primary 指向已注销 provider**：`unregisterProvider` 中更新 `primaryProviders` 与其他 Map 操作之间存在竞态窗口
- **读操作读取不一致视图**：`getProviderHealthInfo` 同时访问 3 个 Map，可能把已注销的 provider 当作 primary

## Decision

### 1. 引入 ReentrantReadWriteLock

由于 `ProviderFactory` 是 Spring `@Component`，provider 的注册/注销通常发生在启动或动态重载阶段，**写操作频率低，读操作频率高**。`ReentrantReadWriteLock` 是最适合此场景的同步机制：

- **写锁（write lock）**：保护 `registerProvider`、`unregisterProvider`、`setPrimaryProvider`、`clear` 等所有写操作
- **读锁（read lock）**：保护所有读操作（`getProvider`、`getPrimaryProvider`、`getProviders`、`getProviderHealthInfo`、...）
- **读读并发**：多个读线程可同时获取读锁，不互相阻塞
- **读写互斥**：写操作与读操作互斥，保证写操作期间读操作观察到的是一致快照

### 2. 对所有读写方法加锁

**写操作使用 `writeLock.lock()`：**
- `registerProvider`
- `unregisterProvider`
- `setPrimaryProvider`
- `clear`

**读操作使用 `readLock.lock()`：**
- `getProvider`
- `getPrimaryProvider`
- `getProviders`
- `getAvailableProvider`
- `isMarketSupported`
- `getRegisteredMarketTypes`
- `getSupportedMarkets`
- `getProviderHealthInfo`
- `getProviderHealthSummary`
- `getProviderNames`

### 3. 保持数据结构不变

继续使用现有的 `ConcurrentHashMap` 和 `CopyOnWriteArrayList` 作为底层容器。虽然加了读写锁后 `ConcurrentHashMap` 的内置并发能力被部分覆盖，但保留它们有以下好处：
- **最小侵入性**：不需要重构为单一 Map 或不可变快照
- **安全兜底**：即使未来有人误读了锁的使用，底层容器仍然是线程安全的
- **减少代码改动**：避免引入新的数据结构带来的回归风险

### 4. 使用 try-finally 确保锁释放

所有加锁逻辑遵循标准模式：
```java
readLock.lock();
try {
    // 读操作
} finally {
    readLock.unlock();
}
```

```java
writeLock.lock();
try {
    // 写操作
} finally {
    writeLock.unlock();
}
```

## Consequences

### 正向影响

- **消除竞态条件**：`register` / `unregister` 对 3 个 Map 的修改成为原子操作
- **读操作一致性**：并发读操作要么看到完整的新状态，要么看到完整的旧状态，不会看到中间状态
- **性能可接受**：读操作极多、写操作极少，ReadWriteLock 的读读并发特性不会成为瓶颈
- **实现简单清晰**：比不可变快照 + CAS 方案更容易理解和维护

### 兼容性影响

- **API 签名不变**：所有 public 方法的签名和返回值完全一致
- **行为不变**：单线程场景下功能表现完全相同
- **并发行为改善**：多线程场景下消除了之前的不一致风险
- **锁竞争风险极低**：provider 注册/注销不是高频操作，写锁不会长时间持有

## Alternatives Considered

1. **不可变 Map + AtomicReference CAS 替换**
   - 拒绝：需要将 3 个 Map 封装为不可变快照对象，每次写操作复制全部数据，代码复杂度显著增加；对于当前规模（provider 数量通常 < 20）收益不明显
   - 当前方案：使用 ReentrantReadWriteLock，实现简单且足够安全

2. **单一 Map 重构**
   - 拒绝：将 3 个 Map 合并为按 market 聚合的复合对象可以减少锁粒度，但需要重构大量查询方法，侵入性过大
   - 当前方案：在现有 3-Map 结构上统一加锁，改动最小

3. **synchronized 方法**
   - 拒绝：`synchronized` 会阻塞所有读操作之间的并发，而 `ReentrantReadWriteLock` 支持读读并发，更适合读多写少的场景
   - 当前方案：使用 `ReentrantReadWriteLock`

## Verification

- `mvn -f koduck-backend/pom.xml clean compile` 编译通过
- `mvn -f koduck-backend/pom.xml checkstyle:check` 无异常
- `./koduck-backend/scripts/quality-check.sh` 全绿
- `ProviderFactoryTest` 全部通过
