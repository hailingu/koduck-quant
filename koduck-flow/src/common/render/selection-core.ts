import type { IEntity } from "../entity";
import type { IRenderContext, RenderSelection } from "./types";
import { ENTITY_COUNT_THRESHOLDS } from "./render-constants";

/**
 * 选择上下文
 * 包含实体和性能指标等信息
 */
export interface SelectionContext {
  entity: IEntity;
  renderContext: IRenderContext;
  performanceMetrics?: PerformanceMetrics;
}

/**
 * 性能指标接口
 */
export interface PerformanceMetrics {
  fps: number;
  memory: number;
  lastUpdateTime: number;
}

/**
 * 缓存项接口
 */
export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  accessCount: number;
}

/**
 * 选择器核心工具类
 * 提供选择器之间共享的实用方法
 */
export class SelectionCore {
  /**
   * 分析实体复杂度
   * 返回 0-1 之间的复杂度分数
   *
   * @param entity 要分析的实体
   * @returns 复杂度分数，0 表示最简单，1 表示最复杂
   */
  static analyzeComplexity(entity: IEntity): number {
    const entityData = entity.data?.toJSON() || {};
    let complexity = 0.1; // 基础复杂度

    // 顶点数量复杂度
    if (typeof entityData.vertexCount === "number") {
      complexity += Math.min(entityData.vertexCount / ENTITY_COUNT_THRESHOLDS.ULTRA_LARGE, 0.5);
    }

    // 实体类型复杂度
    if (entity.type?.includes("3d") || entity.type?.includes("mesh")) {
      complexity += 0.4;
    }

    if (entity.type === "large-dataset" || entity.type === "gpu-compute") {
      complexity += 0.3;
    }

    // 数据复杂度
    if (typeof entityData.complexity === "number") {
      complexity += entityData.complexity / 10;
    }

    return Math.min(complexity, 1.0);
  }

  /**
   * 创建默认渲染上下文
   *
   * @param entity 实体
   * @returns 默认的渲染上下文
   */
  static createDefaultContext(entity: IEntity): IRenderContext {
    return {
      nodes: [entity],
      viewport: { x: 0, y: 0, zoom: 1, width: 0, height: 0 },
      timestamp: Date.now(),
    };
  }

  /**
   * 生成缓存键
   * 基于实体特征和性能指标生成稳定的缓存键
   *
   * @param entity 实体
   * @param metrics 可选的性能指标
   * @param additionalFactors 额外的缓存因素（如设备能力）
   * @returns 缓存键字符串
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

    // 添加额外因素
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
   * 验证缓存是否有效
   *
   * @param entry 缓存项
   * @param maxAge 最大缓存时间（毫秒），默认 30000
   * @returns 是否有效
   */
  static isCacheValid<T>(entry: CacheEntry<T> | undefined, maxAge = 30000): boolean {
    if (!entry) return false;

    const age = Date.now() - entry.timestamp;
    return age < maxAge;
  }

  /**
   * 创建缓存项
   *
   * @param value 缓存值
   * @returns 缓存项
   */
  static createCacheEntry<T>(value: T): CacheEntry<T> {
    return {
      value,
      timestamp: Date.now(),
      accessCount: 0,
    };
  }

  /**
   * 更新缓存项访问计数
   *
   * @param entry 缓存项
   * @returns 更新后的缓存项
   */
  static touchCacheEntry<T>(entry: CacheEntry<T>): CacheEntry<T> {
    return {
      ...entry,
      accessCount: entry.accessCount + 1,
    };
  }

  /**
   * LRU 缓存淘汰策略
   * 根据访问次数和时间戳淘汰最少使用的缓存项
   *
   * @param cache 缓存 Map
   * @param maxSize 最大缓存大小
   */
  static evictLRU<K, V>(cache: Map<K, CacheEntry<V>>, maxSize: number): void {
    if (cache.size <= maxSize) return;

    // 按访问次数和时间戳排序，找出最少使用的
    const entries = Array.from(cache.entries()).sort(([, a], [, b]) => {
      // 优先按访问次数排序
      if (a.accessCount !== b.accessCount) {
        return a.accessCount - b.accessCount;
      }
      // 访问次数相同时按时间戳排序（旧的先淘汰）
      return a.timestamp - b.timestamp;
    });

    // 淘汰最少使用的项，直到满足大小限制
    const toRemove = cache.size - maxSize + Math.floor(maxSize * 0.1); // 多淘汰 10% 以减少频繁淘汰
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      cache.delete(entries[i][0]);
    }
  }

  /**
   * 验证选择结果的置信度
   *
   * @param selection 选择结果
   * @param minConfidence 最小置信度阈值
   * @returns 是否满足最小置信度
   */
  static isConfidentSelection(selection: RenderSelection, minConfidence = 0.75): boolean {
    return selection.confidence >= minConfidence;
  }

  /**
   * 比较两个选择结果，返回更好的选择
   *
   * @param a 选择结果 A
   * @param b 选择结果 B
   * @returns 更好的选择结果
   */
  static compareSelections(a: RenderSelection, b: RenderSelection): RenderSelection {
    // 优先选择置信度更高的
    if (a.confidence !== b.confidence) {
      return a.confidence > b.confidence ? a : b;
    }

    // 置信度相同时，选择有更详细原因的
    if (a.reason && !b.reason) return a;
    if (!a.reason && b.reason) return b;

    // 都相同时返回第一个
    return a;
  }

  /**
   * 批量分组实体
   * 根据选择结果将实体分组到不同的渲染器
   *
   * @param entities 实体数组
   * @param selectFn 选择函数
   * @returns 按渲染器分组的实体 Map
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
        // 选择失败的实体会被忽略，可以在这里记录日志
        // 调用者可以决定如何处理失败的实体
      }
    });

    return groups;
  }

  /**
   * 估算批量渲染的最佳分组大小
   *
   * @param totalCount 总实体数量
   * @param avgComplexity 平均复杂度
   * @returns 建议的批次大小
   */
  static estimateBatchSize(totalCount: number, avgComplexity: number): number {
    // 基础批次大小
    let batchSize = 100;

    // 根据复杂度调整
    if (avgComplexity > 0.7) {
      batchSize = 50; // 高复杂度，小批次
    } else if (avgComplexity < 0.3) {
      batchSize = 200; // 低复杂度，大批次
    }

    // 根据总数量调整
    if (totalCount < 100) {
      batchSize = totalCount; // 少量实体，一次处理
    } else if (totalCount > 10000) {
      batchSize = Math.max(50, Math.floor(totalCount / 100)); // 大量实体，分更多批次
    }

    return batchSize;
  }
}
