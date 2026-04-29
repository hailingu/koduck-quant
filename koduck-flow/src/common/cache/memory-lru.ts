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
 * Lightweight in-memory LRU cache implementation (concurrent deduplication + tag-based invalidation)
 */
export class MemoryLRUCache<K, V> implements Cache<K, V> {
  private readonly namespace?: string;
  private readonly maxEntries?: number;
  private readonly maxWeight?: number;
  private readonly weigh?: (key: K, value: V) => number;
  // Reserved: eviction policy (current implementation follows LRU behavior)
  private readonly onEvict?: (entry: CacheEntry<K, V>, reason: EvictReason) => void;
  private readonly clock: Clock = { now: () => Date.now() };
  private readonly scheduler?: SchedulerLike;
  private readonly defaultTTL?: number;
  private readonly keyHash: (key: K) => KeyHash = (k) => JSON.stringify(k);

  // LRU: Use Map to preserve insertion order; move-to-end on each hit
  private readonly map = new Map<KeyHash, InternalEntry<K, V>>();
  private readonly tags = new Map<string, Set<KeyHash>>();
  private readonly inFlight = new Map<KeyHash, Promise<V>>();

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
    // Reserved eviction policy switch, current implementation fixed to LRU behavior
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
    // LRU promotion
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
      // Replacement: update weight first
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

    const dedupe = options?.dedupe !== false; // deduplicate by default
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
      // Soft timeout: caller times out but the producer is not cancelled
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

  // ===== Internal utilities =====

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
    // Resource release can be implemented via external onEvict/SetOptions.dispose; no forced reflective call here
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
    // Based on maxEntries
    if (this.maxEntries !== undefined) {
      while (this.map.size > this.maxEntries) {
        // LRU: the first item in Map is the oldest
        const first = this.map.entries().next().value;
        if (!first) break;
        const [kh, e] = first;
        this.removeEntry(kh, e, "evict", true);
      }
    }
    // Based on maxWeight
    if (this.maxWeight !== undefined && this.weigh) {
      while (this.currentWeight > this.maxWeight) {
        const first = this.map.entries().next().value;
        if (!first) break;
        const [kh, e] = first;
        this.removeEntry(kh, e, "evict", true);
      }
    }
  }
}
