import { meter, ScopedMeter } from "../metrics";

/**
 * 通用缓存项接口
 */
export interface CacheEntry<T> {
  /** 缓存的值 */
  value: T;
  /** 缓存创建时间戳 */
  timestamp: number;
  /** 可选的版本号 */
  version?: number;
  /** 可选的大小（字节） */
  size?: number;
}

/**
 * 缓存配置选项
 */
export interface CacheConfig {
  /** 最大缓存条目数，默认 1000 */
  maxSize?: number;
  /** 最大缓存时间（毫秒），默认 5 分钟 */
  maxAge?: number;
  /** 是否启用 metrics 收集，默认 true */
  enableMetrics?: boolean;
}

/**
 * 统一的渲染缓存管理器
 *
 * @remarks
 * 提供通用的缓存功能，包括：
 * - 基于大小的 LRU 淘汰策略
 * - 基于时间的过期机制
 * - Metrics 收集
 * - 泛型类型支持
 *
 * @typeParam K - 缓存键类型
 * @typeParam V - 缓存值类型
 *
 * @example
 * ```typescript
 * // 创建 ImageData 缓存
 * const cache = new RenderCacheManager<string, ImageData>("canvas-cache", {
 *   maxSize: 500,
 *   maxAge: 3 * 60 * 1000, // 3 分钟
 * });
 *
 * // 设置缓存
 * cache.set("entity-123", imageData, { version: 1, size: 1024 });
 *
 * // 获取缓存
 * const cached = cache.get("entity-123");
 * if (cached) {
 *   // 使用缓存数据
 * }
 * ```
 */
export class RenderCacheManager<K, V> {
  private readonly cache = new Map<string, CacheEntry<V>>();
  private readonly config: Required<CacheConfig>;
  private readonly m: ScopedMeter;
  private readonly cacheType: string;

  /**
   * 创建缓存管理器实例
   *
   * @param cacheType - 缓存类型标识（用于 metrics）
   * @param config - 可选的缓存配置
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
   * 设置缓存项
   *
   * @param key - 缓存键
   * @param value - 缓存值
   * @param metadata - 可选的元数据（版本号、大小）
   */
  set(key: K, value: V, metadata?: { version?: number; size?: number }): void {
    const keyStr = this.keyToString(key);

    // 检查缓存大小限制
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
   * 获取缓存项
   *
   * @param key - 缓存键
   * @returns 缓存值，如果不存在或已过期则返回 undefined
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

    // 检查过期
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
   * 检查缓存是否包含指定键
   *
   * @param key - 缓存键
   * @returns 如果缓存存在且未过期则返回 true
   */
  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * 删除指定的缓存项
   *
   * @param key - 缓存键
   * @returns 如果删除成功返回 true
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
   * 清空所有缓存
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
   * 获取当前缓存大小
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 获取缓存统计信息
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
   * 将键转换为字符串
   */
  private keyToString(key: K): string {
    if (typeof key === "string") return key;
    if (typeof key === "object" && key !== null) {
      // 对于对象，使用 JSON 序列化（适用于简单对象）
      // 对于复杂对象，子类可以重写此方法
      return JSON.stringify(key);
    }
    return String(key);
  }

  /**
   * 淘汰最旧的缓存项（LRU）
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
   * 设置 metrics 收集
   */
  private setupMetrics(): void {
    // Observable gauge 用于监控缓存大小
    const sizeGauge = this.m.observableGauge("size", {
      description: `Cache size for ${this.cacheType}`,
      unit: "count",
    });

    sizeGauge.addCallback((observe) => {
      observe({ value: this.cache.size });
    });

    // 缓存命中率可以通过 hit 和 miss counter 计算
    // 在监控系统中配置计算规则
  }

  /**
   * 释放资源
   */
  dispose(): void {
    this.clear();
  }
}
