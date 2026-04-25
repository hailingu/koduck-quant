import { MemoryLRUCache } from "../cache/memory-lru";
import type { EventConfiguration } from "./types";

/**
 * 负载去重管理器
 * 负责事件数据的去重处理，避免重复事件的执行
 */
export class DedupeManager<T> {
  /** 负载去重缓存（可选） */
  private _dedupeCache: MemoryLRUCache<string, true> | undefined;

  /** 事件名称，用于缓存命名空间 */
  private readonly _eventName: string;

  /** 事件配置 */
  private _config: Readonly<EventConfiguration>;

  constructor(eventName: string, config: Readonly<EventConfiguration>) {
    this._eventName = eventName;
    this._config = config;
    this._ensureDedupeCache();
  }

  /**
   * 检查是否应该因去重而丢弃事件
   * @param data 事件数据
   * @returns true 表示应该丢弃，false 表示应该处理
   */
  shouldDropByDedupe(data: T): boolean {
    if (!this._dedupeCache) return false;
    const key = this._dedupeKeyOf(data);
    if (key === undefined) return false;
    if (this._dedupeCache.has(key)) return true;
    this._dedupeCache.set(key, true);
    return false;
  }

  /**
   * 更新配置
   * @param newConfig 新的事件配置
   */
  updateConfiguration(newConfig: Readonly<EventConfiguration>): void {
    const oldConfig = this._config;
    this._config = newConfig;

    // 如果去重配置改变，重建缓存
    const oldDedupe = oldConfig.payloadDedupe;
    const newDedupe = newConfig.payloadDedupe;

    if (
      oldDedupe?.enabled !== newDedupe?.enabled ||
      oldDedupe?.maxEntries !== newDedupe?.maxEntries ||
      oldDedupe?.ttl !== newDedupe?.ttl
    ) {
      this._ensureDedupeCache();
    }
  }

  /**
   * 清理去重缓存
   */
  clear(): void {
    if (this._dedupeCache) {
      this._dedupeCache.clear();
    }
  }

  /**
   * 获取当前缓存状态
   */
  getCacheStats(): { size: number; enabled: boolean } {
    let cacheSize = 0;
    if (this._dedupeCache) {
      cacheSize = this._dedupeCache.size();
    }

    return {
      size: cacheSize,
      enabled: !!this._dedupeCache,
    };
  }

  /**
   * 确保去重缓存的正确状态
   */
  private _ensureDedupeCache(): void {
    const d = this._config.payloadDedupe;
    if (d && d.enabled) {
      // 重建缓存以应用策略变更
      this._dedupeCache = new MemoryLRUCache<string, true>({
        namespace: `event:${this._eventName}`,
        maxEntries: d.maxEntries ?? 1000,
        defaultTTL: d.ttl,
      });
    } else {
      this._dedupeCache = undefined;
    }
  }

  /**
   * 生成去重键
   * @param data 事件数据
   * @returns 去重键，如果无法生成则返回 undefined
   */
  private _dedupeKeyOf(data: T): string | undefined {
    const d = this._config.payloadDedupe;
    if (!d || !d.enabled) return undefined;
    try {
      const keyFn = d.key ?? ((x: unknown) => JSON.stringify(x));
      return keyFn(data as unknown);
    } catch {
      return undefined;
    }
  }
}
