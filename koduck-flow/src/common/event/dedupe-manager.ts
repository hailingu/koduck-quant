import { MemoryLRUCache } from "../cache/memory-lru";
import type { EventConfiguration } from "./types";

/**
 * Payload deduplication manager
 * Responsible for deduplication of event data to avoid duplicate event execution
 */
export class DedupeManager<T> {
  /** Payload deduplication cache (optional) */
  private _dedupeCache: MemoryLRUCache<string, true> | undefined;

  /** Event name, used for cache namespace */
  private readonly _eventName: string;

  /** Event configuration */
  private _config: Readonly<EventConfiguration>;

  constructor(eventName: string, config: Readonly<EventConfiguration>) {
    this._eventName = eventName;
    this._config = config;
    this._ensureDedupeCache();
  }

  /**
   * Check whether event should be dropped due to deduplication
   * @param data Event data
   * @returns true means should drop, false means should process
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
   * Update configuration
   * @param newConfig New event configuration
   */
  updateConfiguration(newConfig: Readonly<EventConfiguration>): void {
    const oldConfig = this._config;
    this._config = newConfig;

    // If deduplication config changes, rebuild cache
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
   * Clear deduplication cache
   */
  clear(): void {
    if (this._dedupeCache) {
      this._dedupeCache.clear();
    }
  }

  /**
   * Get current cache state
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
   * Ensure correct state of deduplication cache
   */
  private _ensureDedupeCache(): void {
    const d = this._config.payloadDedupe;
    if (d?.enabled) {
      // Rebuild cache to apply policy changes
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
   * Generate deduplication key
   * @param data Event data
   * @returns Deduplication key, returns undefined if unable to generate
   */
  private _dedupeKeyOf(data: T): string | undefined {
    const d = this._config.payloadDedupe;
    if (!d?.enabled) return undefined;
    try {
      const keyFn = d.key ?? ((x: unknown) => JSON.stringify(x));
      return keyFn(data as unknown);
    } catch {
      return undefined;
    }
  }
}
