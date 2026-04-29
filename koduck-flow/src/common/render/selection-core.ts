import type { IEntity } from "../entity";
import type { IRenderContext, RenderSelection } from "./types";
import { ENTITY_COUNT_THRESHOLDS } from "./render-constants";

/**
 * Selection context
 * Contains entity and performance metrics information
 */
export interface SelectionContext {
  entity: IEntity;
  renderContext: IRenderContext;
  performanceMetrics?: PerformanceMetrics;
}

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
  fps: number;
  memory: number;
  lastUpdateTime: number;
}

/**
 * Cache entry interface
 */
export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  accessCount: number;
}

/**
 * Selector core utility class
 * Provides shared utility methods between selectors
 */
export class SelectionCore {
  /**
   * Analyze entity complexity
   * Returns a complexity score between 0 and 1
   *
   * @param entity Entity to analyze
   * @returns Complexity score, 0 means simplest, 1 means most complex
   */
  static analyzeComplexity(entity: IEntity): number {
    const entityData = entity.data?.toJSON() || {};
    let complexity = 0.1; // Base complexity

    // Vertex count complexity
    if (typeof entityData.vertexCount === "number") {
      complexity += Math.min(entityData.vertexCount / ENTITY_COUNT_THRESHOLDS.ULTRA_LARGE, 0.5);
    }

    // Entity type complexity
    if (entity.type?.includes("3d") || entity.type?.includes("mesh")) {
      complexity += 0.4;
    }

    if (entity.type === "large-dataset" || entity.type === "gpu-compute") {
      complexity += 0.3;
    }

    // Data complexity
    if (typeof entityData.complexity === "number") {
      complexity += entityData.complexity / 10;
    }

    return Math.min(complexity, 1.0);
  }

  /**
   * Create default render context
   *
   * @param entity Entity
   * @returns Default render context
   */
  static createDefaultContext(entity: IEntity): IRenderContext {
    return {
      nodes: [entity],
      viewport: { x: 0, y: 0, zoom: 1, width: 0, height: 0 },
      timestamp: Date.now(),
    };
  }

  /**
   * Generate cache key
   * Generates a stable cache key based on entity characteristics and performance metrics
   *
   * @param entity Entity
   * @param metrics Optional performance metrics
   * @param additionalFactors Additional cache factors (e.g., device capabilities)
   * @returns Cache key string
   */
  static generateCacheKey(
    entity: IEntity,
    metrics?: PerformanceMetrics,
    additionalFactors?: Record<string, unknown>
  ): string {
    const complexity = Math.floor(SelectionCore.analyzeComplexity(entity) * 10);
    const fps = metrics ? Math.floor(metrics.fps / 15) : 0;
    const memory = metrics ? Math.floor(metrics.memory * 5) : 0;

    let key = `${entity.type}_${entity.id ?? "unknown"}_${complexity}_${fps}_${memory}`;

    // Add additional factors
    if (additionalFactors) {
      const factors = Object.entries(additionalFactors)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${v}`)
        .join("_");
      key += `_${factors}`;
    }

    return key;
  }

  /**
   * Validate whether cache is valid
   *
   * @param entry Cache entry
   * @param maxAge Maximum cache age (milliseconds), default 30000
   * @returns Whether valid
   */
  static isCacheValid<T>(entry: CacheEntry<T> | undefined, maxAge = 30000): boolean {
    if (!entry) return false;

    const age = Date.now() - entry.timestamp;
    return age < maxAge;
  }

  /**
   * Create cache entry
   *
   * @param value Cache value
   * @returns Cache entry
   */
  static createCacheEntry<T>(value: T): CacheEntry<T> {
    return {
      value,
      timestamp: Date.now(),
      accessCount: 0,
    };
  }

  /**
   * Update cache entry access count
   *
   * @param entry Cache entry
   * @returns Updated cache entry
   */
  static touchCacheEntry<T>(entry: CacheEntry<T>): CacheEntry<T> {
    return {
      ...entry,
      accessCount: entry.accessCount + 1,
    };
  }

  /**
   * LRU cache eviction policy
   * Evicts least recently used cache entries based on access count and timestamp
   *
   * @param cache Cache Map
   * @param maxSize Maximum cache size
   */
  static evictLRU<K, V>(cache: Map<K, CacheEntry<V>>, maxSize: number): void {
    if (cache.size <= maxSize) return;

    // Sort by access count and timestamp to find least recently used
    const entries = Array.from(cache.entries()).sort(([, a], [, b]) => {
      // Prioritize sorting by access count
      if (a.accessCount !== b.accessCount) {
        return a.accessCount - b.accessCount;
      }
      // When access counts are equal, sort by timestamp (older evicted first)
      return a.timestamp - b.timestamp;
    });

    // Evict least recently used items until size limit is met
    const toRemove = cache.size - maxSize + Math.floor(maxSize * 0.1); // Evict extra 10% to reduce frequent evictions
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      cache.delete(entries[i][0]);
    }
  }

  /**
   * Validate selection result confidence
   *
   * @param selection Selection result
   * @param minConfidence Minimum confidence threshold
   * @returns Whether minimum confidence is met
   */
  static isConfidentSelection(selection: RenderSelection, minConfidence = 0.75): boolean {
    return selection.confidence >= minConfidence;
  }

  /**
   * Compare two selection results and return the better one
   *
   * @param a Selection result A
   * @param b Selection result B
   * @returns Better selection result
   */
  static compareSelections(a: RenderSelection, b: RenderSelection): RenderSelection {
    // Prefer higher confidence
    if (a.confidence !== b.confidence) {
      return a.confidence > b.confidence ? a : b;
    }

    // When confidence is equal, prefer the one with a more detailed reason
    if (a.reason && !b.reason) return a;
    if (!a.reason && b.reason) return b;

    // Return the first one when all else is equal
    return a;
  }

  /**
   * Batch group entities
   * Group entities into different renderers based on selection results
   *
   * @param entities Entity array
   * @param selectFn Selection function
   * @returns Entity Map grouped by renderer
   */
  static groupEntitiesByRenderer<T extends { renderer: unknown }>(
    entities: IEntity[],
    selectFn: (entity: IEntity) => T
  ): Map<T["renderer"], IEntity[]> {
    const groups = new Map<T["renderer"], IEntity[]>();

    entities.forEach((entity) => {
      try {
        const selection = selectFn(entity);
        const renderer = selection.renderer;

        if (!groups.has(renderer)) {
          groups.set(renderer, []);
        }
        groups.get(renderer)!.push(entity);
      } catch {
        // Entities that fail selection will be ignored; logging can be added here
        // Caller can decide how to handle failed entities
      }
    });

    return groups;
  }

  /**
   * Estimate optimal batch size for batch rendering
   *
   * @param totalCount Total entity count
   * @param avgComplexity Average complexity
   * @returns Recommended batch size
   */
  static estimateBatchSize(totalCount: number, avgComplexity: number): number {
    // Base batch size
    let batchSize = 100;

    // Adjust based on complexity
    if (avgComplexity > 0.7) {
      batchSize = 50; // High complexity, small batches
    } else if (avgComplexity < 0.3) {
      batchSize = 200; // Low complexity, large batches
    }

    // Adjust based on total count
    if (totalCount < 100) {
      batchSize = totalCount; // Small number of entities, process all at once
    } else if (totalCount > 10000) {
      batchSize = Math.max(50, Math.floor(totalCount / 100)); // Large number of entities, split into more batches
    }

    return batchSize;
  }
}
