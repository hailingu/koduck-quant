import { meter, ScopedMeter } from "../metrics";

/**
 * Generic cache entry interface
 */
export interface CacheEntry<T> {
  /** Cached value */
  value: T;
  /** Cache creation timestamp */
  timestamp: number;
  /** Optional version number */
  version?: number;
  /** Optional size (bytes) */
  size?: number;
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
  /** Max cache entries, default 1000 */
  maxSize?: number;
  /** Max cache age (milliseconds), default 5 minutes */
  maxAge?: number;
  /** Whether to enable metrics collection, default true */
  enableMetrics?: boolean;
}

/**
 * Unified render cache manager
 *
 * @remarks
 * Provides generic caching features, including:
 * - Size-based LRU eviction policy
 * - Time-based expiration mechanism
 * - Metrics collection
 * - Generic type support
 *
 * @typeParam K - Cache key type
 * @typeParam V - Cache value type
 *
 * @example
 * ```typescript
 * // Create ImageData cache
 * const cache = new RenderCacheManager<string, ImageData>("canvas-cache", {
 *   maxSize: 500,
 *   maxAge: 3 * 60 * 1000, // 3 minutes
 * });
 *
 * // Set cache
 * cache.set("entity-123", imageData, { version: 1, size: 1024 });
 *
 * // Get cache
 * const cached = cache.get("entity-123");
 * if (cached) {
 *   // Use cached data
 * }
 * ```
 */
export class RenderCacheManager<K, V> {
  private readonly cache = new Map<string, CacheEntry<V>>();
  private readonly config: Required<CacheConfig>;
  private readonly m: ScopedMeter;
  private readonly cacheType: string;

  /**
   * Create cache manager instance
   *
   * @param cacheType - Cache type identifier (for metrics)
   * @param config - Optional cache configuration
   */
  constructor(cacheType: string, config?: CacheConfig) {
    this.cacheType = cacheType;
    this.config = {
      maxSize: config?.maxSize ?? 1000,
      maxAge: config?.maxAge ?? 5 * 60 * 1000, // 5 minutes
      enableMetrics: config?.enableMetrics ?? true,
    };

    this.m = new ScopedMeter(meter("render.cache"), {
      cacheType: this.cacheType,
    });

    if (this.config.enableMetrics) {
      this.setupMetrics();
    }
  }

  /**
   * Set cache entry
   *
   * @param key - Cache key
   * @param value - Cache value
   * @param metadata - Optional metadata (version, size)
   */
  set(key: K, value: V, metadata?: { version?: number; size?: number }): void {
    const keyStr = this.keyToString(key);

    // Check cache size limit
    if (this.cache.size >= this.config.maxSize) {
      this.evictOldest();
      if (this.config.enableMetrics) {
        this.m.counter("eviction").add(1, { reason: "size_limit" });
      }
    }

    const entry: CacheEntry<V> = {
      value,
      timestamp: Date.now(),
    };

    if (metadata?.version !== undefined) {
      entry.version = metadata.version;
    }
    if (metadata?.size !== undefined) {
      entry.size = metadata.size;
    }

    this.cache.set(keyStr, entry);

    if (this.config.enableMetrics) {
      this.m.counter("set").add(1);
    }
  }

  /**
   * Get cache entry
   *
   * @param key - Cache key
   * @returns Cache value, or undefined if not found or expired
   */
  get(key: K): V | undefined {
    const keyStr = this.keyToString(key);
    const entry = this.cache.get(keyStr);

    if (!entry) {
      if (this.config.enableMetrics) {
        this.m.counter("miss").add(1, { reason: "not_found" });
      }
      return undefined;
    }

    // Check expiration
    if (Date.now() - entry.timestamp > this.config.maxAge) {
      this.cache.delete(keyStr);
      if (this.config.enableMetrics) {
        this.m.counter("miss").add(1, { reason: "expired" });
        this.m.counter("eviction").add(1, { reason: "expired" });
      }
      return undefined;
    }

    if (this.config.enableMetrics) {
      this.m.counter("hit").add(1);
    }

    return entry.value;
  }

  /**
   * Check if cache contains specified key
   *
   * @param key - Cache key
   * @returns true if cache exists and has not expired
   */
  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Delete specified cache entry
   *
   * @param key - Cache key
   * @returns true if deletion succeeded
   */
  delete(key: K): boolean {
    const keyStr = this.keyToString(key);
    const result = this.cache.delete(keyStr);
    if (result && this.config.enableMetrics) {
      this.m.counter("delete").add(1);
    }
    return result;
  }

  /**
   * Clear all cache
   */
  clear(): void {
    const count = this.cache.size;
    this.cache.clear();
    if (this.config.enableMetrics && count > 0) {
      this.m.counter("clear").add(1);
      this.m.histogram("clear.size", { unit: "count" }).record(count);
    }
  }

  /**
   * Get current cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    maxAge: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      maxAge: this.config.maxAge,
    };
  }

  /**
   * Convert key to string
   */
  private keyToString(key: K): string {
    if (typeof key === "string") return key;
    if (typeof key === "object" && key !== null) {
      // For objects, use JSON serialization (suitable for simple objects)
      // For complex objects, subclasses can override this method
      return JSON.stringify(key);
    }
    return String(key);
  }

  /**
   * Evict oldest cache entry (LRU)
   */
  private evictOldest(): void {
    let oldest: [string, CacheEntry<V>] | undefined;

    for (const entry of this.cache.entries()) {
      if (!oldest || entry[1].timestamp < oldest[1].timestamp) {
        oldest = entry;
      }
    }

    if (oldest) {
      this.cache.delete(oldest[0]);
    }
  }

  /**
   * Setup metrics collection
   */
  private setupMetrics(): void {
    // Observable gauge for monitoring cache size
    const sizeGauge = this.m.observableGauge("size", {
      description: `Cache size for ${this.cacheType}`,
      unit: "count",
    });

    sizeGauge.addCallback((observe) => {
      observe({ value: this.cache.size });
    });

    // Cache hit rate can be calculated from hit and miss counters
    // Configure calculation rules in monitoring system
  }

  /**
   * Release resources
   */
  dispose(): void {
    this.clear();
  }
}
