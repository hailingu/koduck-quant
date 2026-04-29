/**
 * Generic cache interface design (type definitions only)
 * Goal: serve both the event system and rendering system, supporting concurrent deduplication, TTL/weight, tag-based invalidation, and resource disposal.
 */

// Core cache interface (sync + async helpers)
export interface Cache<K, V> {
  // Basic operations
  get(key: K): V | undefined;
  set(key: K, value: V, options?: SetOptions): void;
  has(key: K): boolean;
  delete(key: K): boolean;
  clear(): void;

  // Convenient computation (concurrent deduplication)
  getOrSet(key: K, producer: () => V, options?: ComputeOptions): V;
  getOrSetAsync(
    key: K,
    producer: () => Promise<V>,
    options?: ComputeOptions
  ): Promise<V>;

  // Metadata
  size(): number; // Current entry count (O(1) depends on implementation)
  info(): CacheInfo; // Metrics/capacity/hit rate, etc.

  // Tags and invalidation
  addTags(key: K, ...tags: string[]): void;
  invalidateByTag(tag: string): number; // Returns the number of affected entries
}

// Write and compute options
export interface SetOptions {
  ttl?: number; // Milliseconds, 0/undefined means no expiration
  tags?: string[]; // Tag-based invalidation
  priority?: number; // Eviction priority (higher = less likely to be evicted)
  weight?: number; // Weight (bytes/estimated cost) for maxWeight control
  staleWhileRevalidate?: boolean; // SWR: return stale value first when expired and refresh in background
  dispose?: (value: unknown) => void; // Release resources on delete/evict (e.g., WebGPU/Canvas objects)
}

export interface ComputeOptions extends SetOptions {
  dedupe?: boolean; // Default true: concurrent getOrSet/Async with the same key share the same computation
  timeout?: number; // Async only: producer computation timeout (soft timeout, no forced interruption)
  promote?: boolean; // Multi-level cache: whether to promote to upper level on lower-level hit
}

// Metric information
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

// Policy and entry definitions
export interface CachePolicy<K, V> {
  maxEntries?: number; // Limit based on entry count
  maxWeight?: number; // Limit based on weight
  defaultTTL?: number; // Default TTL
  clock?: Clock; // Injected clock for testing
  scheduler?: SchedulerLike; // Periodic cleanup/delayed tasks (can reuse event system scheduler adapter)
  weigh?: (key: K, value: V) => number; // Weight estimation
  onEvict?: (entry: CacheEntry<K, V>, reason: EvictReason) => void; // Eviction/expiration callback
  eviction?: EvictionPolicy; // Eviction policy
}

export type EvictReason = "evict" | "expire" | "manual" | "clear" | "promote";

export interface CacheEntry<K, V> {
  key: K;
  value: V;
  tags?: string[];
  priority?: number;
  weight?: number;
  expiresAt?: number; // Expiration time (ms timestamp)
  createdAt: number;
  lastAccessedAt: number;
}

export type EvictionPolicy = "lru" | "lfu" | "fifo" | "none";

// Clock and scheduler (lightweight interfaces to avoid direct coupling with event system types)
export interface Clock {
  now(): number;
}

export interface SchedulerLike {
  set(fn: () => void, delayMs: number): number;
  clear(id: number): void;
}

// Observable events (optional)
export interface CacheEvents<K, V> {
  onHit?(key: K): void;
  onMiss?(key: K): void;
  onSet?(entry: CacheEntry<K, V>): void;
  onEvict?(entry: CacheEntry<K, V>, reason: EvictReason): void;
  onExpire?(entry: CacheEntry<K, V>): void;
}

// Multi-level cache (optional composition)
export interface MultiLevelCache<K, V> extends Cache<K, V> {
  levels: Cache<K, V>[]; // Priority from high to low
}

// Simplified factory interface (types only)
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
  keyHash?: (key: K) => string; // Stable hash for structured keys
}
