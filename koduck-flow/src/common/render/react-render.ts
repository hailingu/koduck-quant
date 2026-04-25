import React, { startTransition } from "react";
import type {
  IReactRenderer,
  RenderPerformanceStats,
  IRenderConfig,
  IRenderContext,
} from "./types";
import type { IEntity } from "../entity";
import { RegistryManager } from "../registry";
import { logger } from "../logger";
import { BaseRenderer } from "./base-renderer";
export const ReactRenderEvent = {
  Initialized: "react-render:initialized",
  CacheInspect: "react-render:cache-inspect",
  RenderCall: "react-render:render-call",
  InvalidEntity: "react-render:invalid-entity",
  ContextHandled: "react-render:context-handled",
} as const;

const reactRenderLogger = logger.withContext({
  tag: "render:react",
  metadata: { component: "ReactRender" },
});
import type { ObservableGauge } from "../metrics";

/**
 * React 渲染缓存
 */
interface ReactRenderCache {
  element: React.ReactElement;
  version: number;
  timestamp: number;
  error?: Error;
}

/**
 * 异步渲染缓存
 */
interface AsyncRenderCache {
  promise: Promise<React.ReactElement>;
  element?: React.ReactElement;
  error?: Error;
  timestamp: number;
}

/**
 * React 渲染器实现
 * 专门负责 React 组件的渲染逻辑
 *
 * 注：使用 WeakMap 作为缓存以便与 React 组件生命周期关联
 */
class ReactRender extends BaseRenderer implements IReactRenderer {
  // React 特有：使用 WeakMap 以便自动垃圾回收
  private entityRenderMap = new WeakMap<IEntity, ReactRenderCache>();
  private ogCacheGauge: ObservableGauge | undefined;
  private ogCacheCb:
    | ((
        observe: (o: {
          value: number;
          attributes?: Record<string, string | number | boolean>;
        }) => void
      ) => void)
    | undefined;

  constructor(registryManager?: RegistryManager) {
    super("ReactRender", "react", registryManager);
    reactRenderLogger.debug({
      event: ReactRenderEvent.Initialized,
      message: "ReactRender initialized",
      metadata: { hasRegistryManager: Boolean(this.registryManager) },
      details: this.registryManager,
    });
    reactRenderLogger.debug({
      event: ReactRenderEvent.CacheInspect,
      message: "Entity render cache initialized",
    });

    // observable gauge for cache size
    const g = this.m.observableGauge("cache.size", {
      description: "ReactRender cache size",
      unit: "count",
    });
    this.ogCacheCb = (observe) => {
      // WeakMap size is not directly measurable; approximate by counting entries we cached in a side map
      // Here we expose 0 as we cannot iterate WeakMap; provide async cache size instead
      observe({
        value: this.asyncRenderCache.size,
        attributes: { kind: "async" },
      });
      // best-effort: expose known cached elements count via heuristic using recent stats
      observe({
        value:
          this.performanceStats.cacheHitCount + this.performanceStats.cacheMissCount > 0 ? 1 : 0,
        attributes: { kind: "weakmap_approx" },
      });
    };
    g.addCallback(this.ogCacheCb);
    this.ogCacheGauge = g;
  }
  /**
   * 渲染单个实体为 React 元素
   */
  render(entity: IEntity): React.ReactElement | null {
    reactRenderLogger.debug({
      event: ReactRenderEvent.RenderCall,
      message: "ReactRender.render invoked",
      metadata: {
        entityId: entity?.id,
        entityType: entity?.type,
      },
      details: entity,
    });

    // 处理无效实体
    if (!entity || !entity.id || !entity.type) {
      reactRenderLogger.warn({
        event: ReactRenderEvent.InvalidEntity,
        message: "ReactRender.render called with invalid entity",
        emoji: "⚠️",
        details: entity,
      });
      return null;
    }

    const startTime = performance.now();

    // 检查缓存
    const cached = this.entityRenderMap.get(entity);
    if (cached && cached.element) {
      this.recordCacheHit(entity.type || "unknown");
      return cached.element;
    }

    this.recordCacheMiss(entity.type || "unknown");

    // 创建新的 React 元素
    const element = React.createElement(
      "div",
      {
        key: entity.id,
        "data-entity-id": entity.id,
        "data-entity-type": entity.type,
      },
      `Entity: ${entity.type}`
    );

    // 缓存结果
    this.entityRenderMap.set(entity, {
      element,
      version: 1,
      timestamp: Date.now(),
    });

    this.recordRenderMetrics(startTime, entity);
    this.updatePerformanceStats(startTime);
    return element;
  }

  /**
   * 获取渲染器类型
   */
  getType(): "react" {
    return "react";
  }

  /**
   * 判断是否能处理当前渲染上下文
   */
  canHandle(context: IRenderContext): boolean {
    return !!(context?.nodes || context?.edges);
  }

  /**
   * 获取渲染器优先级
   */
  getPriority(): number {
    return 100; // 高优先级
  }

  /**
   * 渲染上下文方法
   */
  renderContext(context: IRenderContext): void {
    // React渲染通常在组件内部进行，这里主要做性能统计
    const startTime = performance.now();

    try {
      // 实际的React渲染会在具体的组件中完成
      reactRenderLogger.debug({
        event: ReactRenderEvent.ContextHandled,
        message: "ReactRender processed render context",
        metadata: {
          nodeCount: context.nodes?.length ?? 0,
          hasEdges: Boolean((context as { edges?: unknown[] }).edges?.length),
        },
      });
    } finally {
      this.updatePerformanceStats(startTime);
      const dur = performance.now() - startTime;
      this.m.counter("context.render.count").add(1, {
        nodes: (context.nodes?.length || 0) > 0 ? 1 : 0,
      });
      this.m.histogram("context.render.duration.ms", { unit: "ms" }).record(dur);
    }
  }

  // 批处理配置
  private batchConfig: IRenderConfig = {
    enableBatchRendering: true,
    batchSize: 100,
    batchTimeout: 16,
    enablePerformanceOptimization: true,
    performanceThreshold: 100,
  };

  private batchTimer: number | null = null;

  // 异步渲染支持
  private asyncRenderCache = new Map<string, AsyncRenderCache>();

  private concurrentConfig = {
    enableConcurrentFeatures: true,
    enableSuspense: true,
    enableTransitions: true,
  };

  canRender(entity?: IEntity): boolean {
    // React 渲染器可以渲染任何实体，只要实体存在
    return !!entity;
  }

  batchRender(entities: IEntity[]): React.ReactElement[] {
    if (!this.batchConfig.enableBatchRendering) {
      return entities.map((entity) => this.render(entity) as React.ReactElement);
    }

    // 如果启用了并发特性，使用 startTransition
    if (this.concurrentConfig.enableTransitions) {
      let results: React.ReactElement[] = [];
      const start = performance.now();
      startTransition(() => {
        results = entities.map((entity) => this.render(entity) as React.ReactElement);
      });
      const dur = performance.now() - start;
      this.recordBatchMetrics(entities.length, dur);
      this.m.counter("batch.count").add(1, { mode: "transition" });
      return results;
    }

    const start = performance.now();
    const out = entities.map((entity) => this.render(entity) as React.ReactElement);
    const dur = performance.now() - start;
    this.recordBatchMetrics(entities.length, dur);
    this.m.counter("batch.count").add(1, { mode: "sync" });
    return out;
  }

  override configure(config: IRenderConfig): void {
    this.batchConfig = { ...this.batchConfig, ...config };
  }

  override getPerformanceStats(): RenderPerformanceStats {
    const stats = super.getPerformanceStats();
    const totalCount = this.performanceStats.cacheHitCount + this.performanceStats.cacheMissCount;
    return {
      ...stats,
      cacheHitRatio: totalCount > 0 ? this.performanceStats.cacheHitCount / totalCount : 0,
    };
  }

  // 清理缓存
  clearCache(): void {
    this.entityRenderMap = new WeakMap();
    this.asyncRenderCache.clear();
  }

  // 资源清理
  dispose(): void {
    this.clearCache();
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    // 重置性能统计
    this.performanceStats.totalRenderTime = 0;
    this.performanceStats.renderCount = 0;
    this.performanceStats.cacheHitCount = 0;
    this.performanceStats.cacheMissCount = 0;
    this.performanceStats.averageRenderTime = 0;

    if (this.ogCacheGauge && this.ogCacheCb) {
      this.ogCacheGauge.removeCallback(this.ogCacheCb);
      this.ogCacheCb = undefined;
      this.ogCacheGauge = undefined;
    }
  }

  /**
   * React 19 并发渲染支持
   */
  renderEntityConcurrent(
    entity: IEntity,
    options: { useTransition: boolean; priority: string }
  ): React.ReactElement | null {
    if (options.useTransition) {
      let result: React.ReactElement | null = null;
      startTransition(() => {
        result = this.render(entity) as React.ReactElement;
      });
      return result;
    }
    return this.render(entity) as React.ReactElement;
  }

  /**
   * 异步渲染支持
   */
  async renderEntityAsync(entity: IEntity): Promise<React.ReactElement | null> {
    return Promise.resolve(this.render(entity) as React.ReactElement);
  }

  /**
   * 批量并发渲染
   */
  async batchRenderConcurrent(entities: IEntity[]): Promise<Map<string, React.ReactElement>> {
    const results = new Map<string, React.ReactElement>();

    for (const entity of entities) {
      const element = await this.renderEntityAsync(entity);
      if (element) {
        results.set(entity.id, element);
      }
    }

    return results;
  }
}

export { ReactRender };
export type { ReactRenderCache, AsyncRenderCache };
