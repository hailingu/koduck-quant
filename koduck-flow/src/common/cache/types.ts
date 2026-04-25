/**
 * 通用缓存接口设计（仅类型定义）
 * 目标：同时服务于事件系统与渲染系统，支持并发去重、TTL/权重、标签化失效与资源释放。
 */

// 核心缓存接口（同步 + 异步便捷器）
export interface Cache<K, V> {
  // 基础操作
  get(key: K): V | undefined;
  set(key: K, value: V, options?: SetOptions): void;
  has(key: K): boolean;
  delete(key: K): boolean;
  clear(): void;

  // 便捷计算（并发去重）
  getOrSet(key: K, producer: () => V, options?: ComputeOptions): V;
  getOrSetAsync(
    key: K,
    producer: () => Promise<V>,
    options?: ComputeOptions
  ): Promise<V>;

  // 元信息
  size(): number; // 当前条目数（由实现决定是否 O(1)）
  info(): CacheInfo; // 指标/容量/命中率等

  // 标签与失效
  addTags(key: K, ...tags: string[]): void;
  invalidateByTag(tag: string): number; // 返回影响的 entry 数
}

// 写入与计算选项
export interface SetOptions {
  ttl?: number; // 毫秒，0/undefined 表示不过期
  tags?: string[]; // 标签化失效
  priority?: number; // 淘汰优先级（越高越不易被淘汰）
  weight?: number; // 权重（字节/估算成本），用于 maxWeight 控制
  staleWhileRevalidate?: boolean; // SWR：过期时先返回陈旧值并后台刷新
  dispose?: (value: unknown) => void; // 删除/淘汰时释放资源（如 WebGPU/Canvas 对象）
}

export interface ComputeOptions extends SetOptions {
  dedupe?: boolean; // 默认 true：同 key 并发 getOrSet/Async 共享同一计算
  timeout?: number; // 仅 Async：producer 计算超时（软超时，不强制中断）
  promote?: boolean; // 多级缓存：命中下层时是否提升到上层
}

// 指标信息
export interface CacheInfo {
  namespace?: string;
  maxEntries?: number;
  maxWeight?: number;
  currentEntries: number;
  currentWeight?: number;
  hits: number;
  misses: number;
  evictions: number;
  expirations: number;
}

// 策略与条目定义
export interface CachePolicy<K, V> {
  maxEntries?: number; // 基于条目数的上限
  maxWeight?: number; // 基于权重的上限
  defaultTTL?: number; // 默认 TTL
  clock?: Clock; // 注入时钟，便于测试
  scheduler?: SchedulerLike; // 定时清扫/延迟任务（可复用事件系统的 scheduler 适配）
  weigh?: (key: K, value: V) => number; // 权重估算
  onEvict?: (entry: CacheEntry<K, V>, reason: EvictReason) => void; // 淘汰/过期回调
  eviction?: EvictionPolicy; // 淘汰策略
}

export type EvictReason = "evict" | "expire" | "manual" | "clear" | "promote";

export interface CacheEntry<K, V> {
  key: K;
  value: V;
  tags?: string[];
  priority?: number;
  weight?: number;
  expiresAt?: number; // 过期时间（ms 时间戳）
  createdAt: number;
  lastAccessedAt: number;
}

export type EvictionPolicy = "lru" | "lfu" | "fifo" | "none";

// 时钟与调度器（轻量接口，避免与事件系统类型直接耦合）
export interface Clock {
  now(): number;
}

export interface SchedulerLike {
  set(fn: () => void, delayMs: number): number;
  clear(id: number): void;
}

// 可观测事件（可选）
export interface CacheEvents<K, V> {
  onHit?(key: K): void;
  onMiss?(key: K): void;
  onSet?(entry: CacheEntry<K, V>): void;
  onEvict?(entry: CacheEntry<K, V>, reason: EvictReason): void;
  onExpire?(entry: CacheEntry<K, V>): void;
}

// 多级缓存（可选组合）
export interface MultiLevelCache<K, V> extends Cache<K, V> {
  levels: Cache<K, V>[]; // 优先级从高到低
}

// 简化版工厂接口（仅类型）
export interface CacheFactory {
  createMemoryCache<K, V>(
    options?: CacheBuilderOptions<K, V> & CacheEvents<K, V>
  ): Cache<K, V>;
  createLRUCache<K, V>(
    options?: CacheBuilderOptions<K, V> & CacheEvents<K, V>
  ): Cache<K, V>;
  createMultiLevelCache<K, V>(
    levels: Cache<K, V>[],
    options?: { namespace?: string }
  ): MultiLevelCache<K, V>;
}

export interface CacheBuilderOptions<K, V> extends CachePolicy<K, V> {
  namespace?: string;
  keyHash?: (key: K) => string; // 结构化 Key 的稳定哈希
}
