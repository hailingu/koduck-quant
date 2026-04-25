import type {
  Cache,
  SetOptions,
  ComputeOptions,
  CacheInfo,
  CachePolicy,
  CacheEntry,
  EvictReason,
  Clock,
  SchedulerLike,
} from "./types";

type KeyHash = string;

interface InternalEntry<K, V> extends CacheEntry<K, V> {
  keyHash: KeyHash;
}

/**
 * 轻量内存 LRU 缓存实现（并发去重 + 标签化失效）
 */
export class MemoryLRUCache<K, V> implements Cache<K, V> {
  private namespace?: string;
  private maxEntries?: number;
  private maxWeight?: number;
  private weigh?: (key: K, value: V) => number;
  // 预留：淘汰策略（当前实现按 LRU 行为处理）
  private onEvict?: (entry: CacheEntry<K, V>, reason: EvictReason) => void;
  private clock: Clock = { now: () => Date.now() };
  private scheduler?: SchedulerLike;
  private defaultTTL?: number;
  private keyHash: (key: K) => KeyHash = (k) => JSON.stringify(k);

  // LRU: 使用 Map 保持插入顺序；每次命中 move-to-end
  private map = new Map<KeyHash, InternalEntry<K, V>>();
  private tags = new Map<string, Set<KeyHash>>();
  private inFlight = new Map<KeyHash, Promise<V>>();

  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private expirations = 0;
  private currentWeight = 0;

  constructor(
    policy?: CachePolicy<K, V> & {
      namespace?: string;
      keyHash?: (key: K) => string;
    }
  ) {
    if (policy?.namespace) this.namespace = policy.namespace;
    if (policy?.maxEntries !== undefined) this.maxEntries = policy.maxEntries;
    if (policy?.maxWeight !== undefined) this.maxWeight = policy.maxWeight;
    if (policy?.weigh) this.weigh = policy.weigh;
    // 预留 eviction 策略开关，当前实现固定 LRU 行为
    if (policy?.onEvict) this.onEvict = policy.onEvict;
    if (policy?.clock) this.clock = policy.clock;
    if (policy?.scheduler) this.scheduler = policy.scheduler;
    if (policy?.defaultTTL !== undefined) this.defaultTTL = policy.defaultTTL;
    if (policy?.keyHash) this.keyHash = policy.keyHash;
  }

  get(key: K): V | undefined {
    const kh = this.keyHash(key);
    const e = this.map.get(kh);
    if (!e) {
      this.misses++;
      return undefined;
    }
    if (this.isExpired(e)) {
      this.expireEntry(kh, e);
      this.misses++;
      return undefined;
    }
    // LRU 提升
    this.map.delete(kh);
    e.lastAccessedAt = this.clock.now();
    this.map.set(kh, e);
    this.hits++;
    return e.value;
  }

  set(key: K, value: V, options?: SetOptions): void {
    const kh = this.keyHash(key);
    const now = this.clock.now();
    const old = this.map.get(kh);
    if (old) {
      // 替换：先更新权重
      if (this.weigh) {
        this.currentWeight -= old.weight ?? 0;
      }
      this.detachTags(kh, old.tags);
      this.map.delete(kh);
    }

    const weight = options?.weight ?? (this.weigh ? this.weigh(key, value) : undefined);
    if (weight !== undefined) this.currentWeight += weight;

    const entry: InternalEntry<K, V> = {
      key,
      keyHash: kh,
      value,
      createdAt: now,
      lastAccessedAt: now,
    };

    if (options?.tags && options.tags.length > 0) {
      entry.tags = [...options.tags];
    }

    if (options?.priority !== undefined) {
      entry.priority = options.priority;
    }

    if (weight !== undefined) {
      entry.weight = weight;
    }

    const expiresAt = this.expiresAtFrom(options?.ttl);
    if (expiresAt !== undefined) {
      entry.expiresAt = expiresAt;
    }
    this.map.set(kh, entry);
    this.attachTags(kh, entry.tags);

    this.evictIfNeeded();
  }

  has(key: K): boolean {
    const kh = this.keyHash(key);
    const e = this.map.get(kh);
    if (!e) return false;
    if (this.isExpired(e)) {
      this.expireEntry(kh, e);
      return false;
    }
    return true;
  }

  delete(key: K): boolean {
    const kh = this.keyHash(key);
    const e = this.map.get(kh);
    if (!e) return false;
    this.removeEntry(kh, e, "manual", true);
    return true;
  }

  clear(): void {
    for (const [kh, e] of this.map) {
      this.removeEntry(kh, e, "clear", false);
    }
    this.map.clear();
    this.tags.clear();
    this.inFlight.clear();
    this.currentWeight = 0;
  }

  getOrSet(key: K, producer: () => V, options?: ComputeOptions): V {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    const value = producer();
    this.set(key, value, options);
    return value;
  }

  getOrSetAsync(key: K, producer: () => Promise<V>, options?: ComputeOptions): Promise<V> {
    const kh = this.keyHash(key);
    const hit = this.get(key);
    if (hit !== undefined) return Promise.resolve(hit);

    const dedupe = options?.dedupe !== false; // 默认去重
    if (dedupe) {
      const inflight = this.inFlight.get(kh);
      if (inflight) return inflight;
    }

    const p = (async () => {
      const v = await producer();
      this.set(key, v, options);
      return v;
    })();

    if (dedupe) this.inFlight.set(kh, p);

    const timeout = options?.timeout && options.timeout > 0 ? options.timeout : undefined;
    if (timeout && this.scheduler) {
      // 软超时：到时调用方超时，但不取消生产者
      return Promise.race<Promise<V>>([
        p.finally(() => this.inFlight.delete(kh)),
        new Promise<V>((_, reject) => {
          const id = this.scheduler!.set(() => {
            reject(new Error(`Cache compute timeout: ${timeout}ms`));
          }, timeout);
          void p.finally(() => this.scheduler!.clear(id));
        }),
      ]);
    }

    return p.finally(() => this.inFlight.delete(kh));
  }

  size(): number {
    return this.map.size;
  }

  info(): CacheInfo {
    const info: CacheInfo = {
      currentEntries: this.map.size,
      currentWeight: this.currentWeight,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      expirations: this.expirations,
    };

    if (this.namespace !== undefined) {
      info.namespace = this.namespace;
    }

    if (this.maxEntries !== undefined) {
      info.maxEntries = this.maxEntries;
    }

    if (this.maxWeight !== undefined) {
      info.maxWeight = this.maxWeight;
    }

    return info;
  }

  addTags(key: K, ...tags: string[]): void {
    const kh = this.keyHash(key);
    const e = this.map.get(kh);
    if (!e) return;
    const set = new Set([...(e.tags ?? []), ...tags]);
    e.tags = [...set];
    this.attachTags(kh, tags);
  }

  invalidateByTag(tag: string): number {
    const set = this.tags.get(tag);
    if (!set || set.size === 0) return 0;
    let count = 0;
    for (const kh of Array.from(set)) {
      const e = this.map.get(kh);
      if (e) {
        this.removeEntry(kh, e, "manual", true);
        count++;
      } else {
        set.delete(kh);
      }
    }
    if (set.size === 0) this.tags.delete(tag);
    return count;
  }

  // ===== 内部工具 =====

  private expiresAtFrom(ttl?: number): number | undefined {
    const t = ttl ?? this.defaultTTL;
    if (!t || t <= 0) return undefined;
    return this.clock.now() + t;
  }

  private isExpired(e: CacheEntry<K, V>): boolean {
    return e.expiresAt !== undefined && e.expiresAt <= this.clock.now();
  }

  private expireEntry(kh: KeyHash, e: InternalEntry<K, V>): void {
    this.removeEntry(kh, e, "expire", true);
    this.expirations++;
  }

  private removeEntry(
    kh: KeyHash,
    e: InternalEntry<K, V>,
    reason: EvictReason,
    detachTags: boolean
  ): void {
    this.map.delete(kh);
    if (detachTags) this.detachTags(kh, e.tags);
    if (this.weigh) this.currentWeight -= e.weight ?? 0;
    // 资源释放可通过外部 onEvict/SetOptions.dispose 实现；此处不强行反射调用
    this.onEvict?.(e, reason);
    if (reason === "evict") this.evictions++;
  }

  private attachTags(kh: KeyHash, tags?: string[]): void {
    if (!tags || tags.length === 0) return;
    for (const t of tags) {
      if (!this.tags.has(t)) this.tags.set(t, new Set());
      this.tags.get(t)!.add(kh);
    }
  }

  private detachTags(kh: KeyHash, tags?: string[]): void {
    if (!tags || tags.length === 0) return;
    for (const t of tags) {
      const set = this.tags.get(t);
      if (!set) continue;
      set.delete(kh);
      if (set.size === 0) this.tags.delete(t);
    }
  }

  private evictIfNeeded(): void {
    // 基于 maxEntries
    if (this.maxEntries !== undefined) {
      while (this.map.size > this.maxEntries) {
        // LRU：Map 的第一项为最旧
        const first = this.map.entries().next().value as [KeyHash, InternalEntry<K, V>] | undefined;
        if (!first) break;
        const [kh, e] = first;
        this.removeEntry(kh, e, "evict", true);
      }
    }
    // 基于 maxWeight
    if (this.maxWeight !== undefined && this.weigh) {
      while (this.currentWeight > this.maxWeight) {
        const first = this.map.entries().next().value as [KeyHash, InternalEntry<K, V>] | undefined;
        if (!first) break;
        const [kh, e] = first;
        this.removeEntry(kh, e, "evict", true);
      }
    }
  }
}
