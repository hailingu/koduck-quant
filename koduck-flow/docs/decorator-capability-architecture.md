# Decorator Capability 架构

decorator capability 代码按五层处理。这样可以让扩展行为更容易定位，同时避免 `CapabilityManager` 和 `capability-container.ts` 吸收所有新关注点。

## 分层

| 层级 | 当前实现 | 归属职责 |
|------|------------------------|-----------|
| Provider | `DefaultCapabilityProvider` | 注册、移除、过滤、克隆 |
| Cache | `DefaultCapabilityCache` | TTL、缓存统计、清理 |
| Executor | `DefaultCapabilityExecutor` | 同步/异步执行、retry、timeout、batch |
| Manager | `CapabilityManager` | facade、配置、性能与健康报告 |
| Defaults | `capability-system-defaults.ts` | 具名常量与默认配置创建 |

## 规则

1. 新增数字默认值统一放入 `capability-system-defaults.ts`。
2. Provider 代码不关心执行耗时、retry 或 timeout。
3. Cache 代码不调用 capability handler。
4. Executor 代码可以使用 provider/cache 接口，但不直接修改 manager 状态。
5. Manager 只负责组装各层并提供报告能力。

## 后续拆分点

后续最安全的文件拆分顺序如下：

| 新文件 | 从 `capability-container.ts` 迁移 |
|----------|-------------------------------------|
| `capability-provider.ts` | `DefaultCapabilityProvider` |
| `capability-cache.ts` | `DefaultCapabilityCache` |
| `capability-executor.ts` | `DefaultCapabilityExecutor` |
| `capability-manager.ts` | `CapabilityManager` |
| `capability-container-utils.ts` | `CapabilityContainerUtils` |

公共的 `capability-container.ts` 文件最终可以退化为兼容性 re-export barrel。
