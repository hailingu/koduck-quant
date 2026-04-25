/**
 * Duck Flow 缓存系统统一导出（仅接口）
 */

export type {
  Cache,
  SetOptions,
  ComputeOptions,
  CacheInfo,
  CachePolicy,
  CacheEntry,
  EvictReason,
  EvictionPolicy,
  Clock,
  SchedulerLike,
  CacheEvents,
  MultiLevelCache,
  CacheFactory,
  CacheBuilderOptions,
} from "./types";

export { MemoryLRUCache } from "./memory-lru";
