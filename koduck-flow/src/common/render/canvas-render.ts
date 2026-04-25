/**
 * @module src/common/render/canvas-render
 * @description Canvas rendering implementation module providing GPU-optimized 2D graphics rendering.
 * Implements the Renderer strategy pattern for CPU-based canvas contexts, with support for
 * performance optimizations including offscreen rendering, layer caching, viewport culling,
 * and device pixel ratio handling.
 *
 * Key Features:
 * - Hardware-accelerated Canvas 2D rendering
 * - Intelligent render cache with expiration
 * - Operation batching for performance optimization
 * - Viewport culling to reduce overdraw
 * - Device pixel ratio (DPR) awareness for high-DPI displays
 * - Performance metrics collection
 *
 * Usage Pattern:
 * 1. Create CanvasRender instance with registry manager
 * 2. Set render context with Canvas element
 * 3. Call render() with entities and configuration
 * 4. Renderer handles all rendering pipeline internally
 *
 * Performance Characteristics:
 * - Operation batching: max 100 operations per frame (configurable)
 * - Cache expiration: 5 minutes default (configurable)
 * - Offscreen rendering: optional, reduces main thread blocking
 *
 * @example
 * ```typescript
 * import { CanvasRender } from '@/render/canvas-render';
 * import { RegistryManager } from '@/registry';
 *
 * // Create renderer with registry
 * const registry = new RegistryManager();
 * const renderer = new CanvasRender(registry, {
 *   enableOffscreenRendering: true,
 *   enableLayerCaching: true,
 *   enableViewportCulling: true,
 *   enableDPR: true,
 *   maxOperationsPerFrame: 100
 * });
 *
 * // Set rendering context
 * const canvas = document.getElementById('canvas') as HTMLCanvasElement;
 * renderer.setRenderContext({
 *   canvas,
 *   ctx: canvas.getContext('2d')!,
 *   viewport: { x: 0, y: 0, width: 800, height: 600 },
 *   dpr: window.devicePixelRatio
 * });
 *
 * // Render entities
 * const config: IRenderConfig = {
 *   entities: [entity1, entity2],
 *   dirtyRegions: [{ x: 0, y: 0, width: 100, height: 100 }],
 *   performanceHint: 'high'
 * };
 *
 * const stats = await renderer.render(config);
 * console.log('Rendered in', stats.renderTime, 'ms');
 *
 * // Clean up
 * renderer.dispose();
 * ```
 */

import type { IEntity } from "../entity/";
import type {
  ICanvasRenderer,
  RenderPerformanceStats,
  IRenderConfig,
  IRenderContext,
} from "./types";
import { RegistryCapabilityUtils, RegistryManager } from "../registry";
import { logger } from "../logger";
import { BaseRenderer } from "./base-renderer";
import { getConfig } from "../config/loader";
import { RenderCacheManager } from "./cache-manager";

/**
 * Canvas render event type definitions
 * @constant
 */
export const CanvasRenderEvent = {
  NotInitialized: "canvas-render:not-initialized",
  RegistryMissing: "canvas-render:registry-missing",
  FallbackRender: "canvas-render:fallback-render",
  FallbackError: "canvas-render:fallback-error",
  CapabilityRender: "canvas-render:capability-render",
  CapabilityMissing: "canvas-render:capability-missing",
  ContextUnavailable: "canvas-render:context-unavailable",
  RenderTrace: "canvas-render:render-trace",
  RenderSuccess: "canvas-render:render-success",
  RenderError: "canvas-render:render-error",
  OperationError: "canvas-render:operation-error",
  BatchRendered: "canvas-render:batch-rendered",
  BatchNoRegistry: "canvas-render:batch-no-registry",
  BatchError: "canvas-render:batch-error",
} as const;

const canvasLogger = logger.withContext({
  tag: "render:canvas",
  metadata: { component: "CanvasRender" },
});
import type { ICapabilityAwareRegistry, IMeta } from "../registry/types";

/**
 * Canvas 渲染操作接口
 */
interface CanvasRenderOperation {
  type: string;
  id: string;
  bounds: { x: number; y: number; width: number; height: number };
  render: (ctx: CanvasRenderingContext2D) => void;
  priority: number;
}

/**
 * Canvas 性能优化配置
 */
interface CanvasPerformanceOptimization {
  enableOffscreenRendering: boolean;
  enableLayerCaching: boolean;
  enableViewportCulling: boolean;
  enableDPR: boolean; // 新增：DPR处理开关
  cacheExpiration: number;
  maxOperationsPerFrame: number;
}

/**
 * Canvas Renderer Implementation
 *
 * High-performance 2D graphics renderer for HTML5 Canvas contexts using CPU-based rendering.
 * Implements the Renderer strategy pattern from the rendering architecture.
 *
 * Key Responsibilities:
 * - Render entities to 2D Canvas contexts
 * - Manage render cache with configurable expiration
 * - Optimize rendering through batching and viewport culling
 * - Track performance metrics (render time, cache hits, etc.)
 * - Handle device pixel ratio for high-DPI displays
 *
 * Performance Optimizations:
 * - **Operation Batching**: Groups up to 100 render operations per frame
 * - **Render Cache**: Caches rendered entities with 5-minute expiration
 * - **Viewport Culling**: Skips rendering entities outside visible bounds
 * - **Offscreen Rendering**: Optional offscreen canvas for complex scenes
 * - **DPR Handling**: Automatically handles device pixel ratio scaling
 *
 * Architecture:
 * - Extends `BaseRenderer` for common renderer interface
 * - Implements `ICanvasRenderer` for Canvas-specific capabilities
 * - Uses `RenderCacheManager` for intelligent caching
 * - Integrates with `RegistryManager` for capability detection
 *
 * Usage:
 * ```typescript
 * const renderer = new CanvasRender(registryManager, {
 *   enableLayerCaching: true,
 *   enableViewportCulling: true
 * });
 * renderer.setRenderContext(ctx);
 * renderer.render(config);
 * ```
 *
 * @class CanvasRender
 * @augments {BaseRenderer}
 * @implements {ICanvasRenderer}
 */
class CanvasRender extends BaseRenderer implements ICanvasRenderer {
  private ctx: IRenderContext | undefined;

  // Observable gauge callbacks
  private ogPendingCb:
    | ((
        observe: (o: {
          value: number;
          attributes?: Record<string, string | number | boolean>;
        }) => void
      ) => void)
    | undefined;
  private ogCacheSizeCb:
    | ((
        observe: (o: {
          value: number;
          attributes?: Record<string, string | number | boolean>;
        }) => void
      ) => void)
    | undefined;
  private ogDprCb:
    | ((
        observe: (o: {
          value: number;
          attributes?: Record<string, string | number | boolean>;
        }) => void
      ) => void)
    | undefined;

  // Render operation queue for batch processing
  private renderOperations: CanvasRenderOperation[] = [];

  /**
   * Get the renderer type identifier
   * @returns {"canvas"} The constant string 'canvas' identifying this renderer type
   */
  getType(): "canvas" {
    return "canvas";
  }

  /**
   * Check if this renderer can handle the given render context
   * @param context - The render context to evaluate for Canvas compatibility
   * @returns {boolean} true if context has a canvas element, false otherwise
   */
  canHandle(context: IRenderContext): boolean {
    return !!context?.canvas;
  }

  /**
   * Get the renderer priority for strategy selection
   * Medium priority ensures Canvas renderer is used after GPU renderers but before fallback
   * @returns {number} Priority value 75 for Canvas-based rendering
   */
  getPriority(): number {
    return 75;
  }

  /**
   * Set the render context for subsequent rendering operations
   * Initializes Canvas resources and performance tracking callbacks
   * @param ctx - The render context containing canvas element, 2D context, and viewport info
   */
  setRenderContext(ctx: IRenderContext): void {
    this.ctx = ctx;
    this.initializeCanvas(ctx);
  }

  // 性能配置
  private config: CanvasPerformanceOptimization = {
    enableOffscreenRendering: true,
    enableLayerCaching: true,
    enableViewportCulling: true,
    enableDPR: true, // 新增：默认启用DPR处理
    cacheExpiration: 5 * 60 * 1000, // 5分钟
    maxOperationsPerFrame: 100,
  };

  // 离屏 Canvas（用于优化）
  private offscreenCanvas: OffscreenCanvas | null = null;
  // Reserved for future offscreen canvas optimization - not currently used
  private offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;

  // DPR相关属性
  private dpr: number = 1; // 当前设备像素比

  // Cache manager for rendered entity results
  private cache!: RenderCacheManager<string, ImageData>;

  /**
   * Create a Canvas renderer instance with optional performance configuration
   * @param registryManager - Optional entity registry for capability detection
   * @param config - Performance optimization configuration
   * @param config.enableOffscreenRendering - Use offscreen canvas for complex scenes (default: true)
   * @param config.enableLayerCaching - Cache rendered layers for reuse (default: true)
   * @param config.enableViewportCulling - Skip rendering entities outside viewport (default: true)
   * @param config.enableDPR - Handle device pixel ratio for high-DPI displays (default: true)
   * @param config.cacheExpiration - Cache entry expiration time in ms (default: 5 minutes)
   * @param config.maxOperationsPerFrame - Maximum render operations per frame (default: 100)
   * @example
   * ```typescript
   * // Create with default configuration
   * const renderer = new CanvasRender();
   *
   * // Create with performance optimization
   * const renderer = new CanvasRender(registryManager, {
   *   enableLayerCaching: true,
   *   enableViewportCulling: true,
   *   maxOperationsPerFrame: 150
   * });
   * ```
   */
  constructor(registryManager?: RegistryManager, config?: Partial<CanvasPerformanceOptimization>) {
    super("CanvasRender", "canvas", registryManager);

    const defaultConfig = getConfig();
    // Use unified cache manager for rendered entity results
    this.cache = new RenderCacheManager<string, ImageData>("canvas", {
      maxSize: defaultConfig.render.maxCacheSize,
      maxAge: defaultConfig.render.cacheTTL,
      enableMetrics: true,
    });

    if (config) {
      this.config = { ...this.config, ...config };
    }

    // Observable gauges
    const pending = this.m.observableGauge("operations.pending", {
      description: "Pending canvas render operations",
      unit: "count",
    });
    this.ogPendingCb = (observe) => {
      observe({ value: this.renderOperations.length });
    };
    pending.addCallback(this.ogPendingCb);

    const cacheSize = this.m.observableGauge("cache.size", {
      description: "Canvas render cache size",
      unit: "count",
    });
    this.ogCacheSizeCb = (observe) => {
      observe({ value: this.cache.size() });
    };
    cacheSize.addCallback(this.ogCacheSizeCb);

    const dprGauge = this.m.observableGauge("dpr", {
      description: "Current device pixel ratio used by canvas",
    });
    this.ogDprCb = (observe) => {
      observe({ value: this.dpr });
    };
    dprGauge.addCallback(this.ogDprCb);
  }
  /**
   *
   */
  updateRenderContext(updates: Partial<IRenderContext>): void {
    if (!this.ctx) return;
    this.ctx = { ...this.ctx, ...updates };
    // 如果 canvas 被更新，重新初始化
    if (updates.canvas) {
      this.initializeCanvas(this.ctx);
    }
  }

  /**
   *
   */
  getRenderContext(): IRenderContext | undefined {
    return this.ctx;
  }

  /**
   * 获取Canvas 2D上下文
   */
  private getCanvas2DContext(): CanvasRenderingContext2D | null {
    if (!this.ctx?.canvas) {
      return null;
    }
    return this.ctx.canvas.getContext("2d");
  }

  /**
   * 初始化 Canvas
   */
  private initializeCanvas(ctx: IRenderContext): void {
    // 新增：DPR处理
    if (this.config.enableDPR) {
      this.setupDPR(ctx.canvas!);
    }

    if (this.config.enableOffscreenRendering && typeof OffscreenCanvas !== "undefined") {
      this.offscreenCanvas = new OffscreenCanvas(ctx.canvas!.width, ctx.canvas!.height);
      this.offscreenCtx = this.offscreenCanvas.getContext("2d");
    }
  }

  /**
   *
   */
  render(entity: IEntity): void {
    if (!this.ctx) {
      canvasLogger.warn({
        event: CanvasRenderEvent.NotInitialized,
        message: "CanvasRender not initialized. Call setRenderContext first.",
        emoji: "⚠️",
      });
      this.m.counter("render.skipped").add(1, { reason: "no_context" });
      return;
    }

    const registry = this.registryManager?.getRegistryForEntity(entity) as ICapabilityAwareRegistry<
      IEntity,
      IMeta
    >;
    if (!registry) {
      canvasLogger.warn({
        event: CanvasRenderEvent.RegistryMissing,
        message: "No registry found for entity",
        emoji: "⚠️",
        metadata: { entityId: entity.id, entityType: entity.type },
      });
      this.m.counter("render.skipped").add(1, { reason: "no_registry" });

      // 尝试直接调用实体的 render 方法作为兜底
      const maybeRenderable = entity as unknown as {
        render?: (ctx?: unknown) => unknown;
        canRender?: (ctx?: unknown) => boolean;
      };
      if (
        typeof maybeRenderable.render === "function" &&
        (!maybeRenderable.canRender || maybeRenderable.canRender(this.ctx))
      ) {
        canvasLogger.warn({
          event: CanvasRenderEvent.FallbackRender,
          message: "Registry missing; invoking entity render fallback",
          emoji: "⚠️",
          metadata: { entityId: entity.id },
        });
        try {
          maybeRenderable.render(this.ctx);
          this.m.counter("render.fallback.entity").add(1);
        } catch (e) {
          canvasLogger.error({
            event: CanvasRenderEvent.FallbackError,
            message: "Entity fallback render failed",
            emoji: "💥",
            metadata: { entityId: entity.id },
            error: e,
          });
          this.m.counter("render.error").add(1, { where: "entity_fallback" });
        }
        return;
      }

      return;
    }

    const hasRenderCap = RegistryCapabilityUtils.hasCapability(registry, "render");
    if (!hasRenderCap) {
      const maybeRenderable = entity as unknown as {
        render?: (ctx?: unknown) => unknown;
        canRender?: (ctx?: unknown) => boolean;
      };
      if (
        typeof maybeRenderable.render === "function" &&
        (!maybeRenderable.canRender || maybeRenderable.canRender(this.ctx))
      ) {
        canvasLogger.warn({
          event: CanvasRenderEvent.FallbackRender,
          message: "Registry lacks render capability; invoking entity fallback",
          emoji: "⚠️",
          metadata: { entityId: entity.id },
        });
        try {
          maybeRenderable.render(this.ctx);
          this.m.counter("render.fallback.entity").add(1);
        } catch (e) {
          canvasLogger.error({
            event: CanvasRenderEvent.FallbackError,
            message: "Entity fallback render failed",
            emoji: "💥",
            metadata: { entityId: entity.id },
            error: e,
          });
          this.m.counter("render.error").add(1, { where: "entity_fallback" });
        }
        return;
      }
      const caps = (registry.meta?.extras as { capabilities?: string[] } | undefined)?.capabilities;
      canvasLogger.warn({
        event: CanvasRenderEvent.CapabilityMissing,
        message: "Registry lacks render capability and entity has no usable render method",
        emoji: "⚠️",
        metadata: { entityId: entity.id, entityType: entity.type, caps },
      });
      this.m.counter("render.skipped").add(1, { reason: "no_capability" });
      return;
    }
    const caps = (registry.meta?.extras as { capabilities?: string[] } | undefined)?.capabilities;
    canvasLogger.debug({
      event: CanvasRenderEvent.CapabilityRender,
      message: "Using registry render capability",
      metadata: { entityId: entity.id, entityType: entity.type, caps },
    });
    const canvas2D = this.getCanvas2DContext();
    if (!canvas2D) {
      canvasLogger.warn({
        event: CanvasRenderEvent.ContextUnavailable,
        message: "Canvas 2D context not available",
        emoji: "⚠️",
      });
      this.m.counter("render.skipped").add(1, { reason: "no_2d_ctx" });
      return;
    }

    const startTime = performance.now();

    try {
      // 直接使用成员变量ctx进行渲染
      // this.drawEntityToCanvas(canvas2D, entity);
      canvasLogger.debug({
        event: CanvasRenderEvent.RenderTrace,
        message: "Executing canvas render",
        metadata: {
          entityId: entity.id,
          entityType: entity.type,
          contextAvailable: Boolean(this.ctx),
        },
      });
      registry.executeCapability("render", entity, this.ctx);
      canvasLogger.info({
        event: CanvasRenderEvent.RenderSuccess,
        message: "CanvasRender rendered entity",
        emoji: "✅",
        metadata: {
          entityId: entity.id,
          entityType: entity.type,
          timestamp: Date.now(),
        },
      });
      // 使用基类的 metrics 记录方法
      this.recordRenderMetrics(startTime, entity);
      this.updatePerformanceStats(startTime);
    } catch (error) {
      canvasLogger.error({
        event: CanvasRenderEvent.RenderError,
        message: `CanvasRender failed for entity ${entity.id}`,
        emoji: "💥",
        metadata: { entityId: entity.id, entityType: entity.type },
        error,
      });
      this.recordRenderError(entity.type || "unknown", "render");
    }
  }

  /**
   *
   */
  batchRender(entities: IEntity[]): void {
    if (!this.ctx) return;

    const startTime = performance.now();

    // 批量渲染实体，使用 registry.render 方法
    entities.forEach((entity) => {
      try {
        const registry = this.registryManager?.getRegistryForEntity(
          entity
        ) as ICapabilityAwareRegistry<IEntity, IMeta>;

        if (registry && RegistryCapabilityUtils.hasCapability(registry, "render")) {
          registry.executeCapability("render", entity, this.ctx!);
          canvasLogger.debug({
            event: CanvasRenderEvent.BatchRendered,
            message: "Batch rendered entity",
            emoji: "✅",
            metadata: { entityId: entity.id, entityType: entity.type },
          });
          this.m.counter("render.count").add(1, { entityType: entity.type });
        } else {
          canvasLogger.warn({
            event: CanvasRenderEvent.BatchNoRegistry,
            message: "No render registry for entity during batch",
            emoji: "⚠️",
            metadata: { entityId: entity.id, entityType: entity.type },
          });
          this.m.counter("render.skipped").add(1, { reason: "no_registry" });
        }
      } catch (error) {
        canvasLogger.error({
          event: CanvasRenderEvent.BatchError,
          message: `Batch render failed for entity ${entity.id}`,
          emoji: "💥",
          metadata: { entityId: entity.id, entityType: entity.type },
          error,
        });
        this.m.counter("render.error").add(1, { where: "batch" });
      }
    });

    // 使用基类的批量 metrics 记录
    const renderTime = performance.now() - startTime;
    this.updatePerformanceStats(startTime);
    this.recordBatchMetrics(entities.length, renderTime);
  }

  /**
   *
   */
  canRender(entity: IEntity): boolean {
    // 检查渲染上下文是否存在
    if (!this.ctx) {
      return false;
    }

    // 检查实体类型是否以 "canvas" 结尾
    const isCanvasEntity = entity.type?.endsWith("canvas");

    // 检查是否有可用的渲染注册表
    const registry = this.registryManager?.getRegistryForEntity(entity) as ICapabilityAwareRegistry<
      IEntity,
      IMeta
    >;
    const hasRenderRegistry = registry && RegistryCapabilityUtils.hasCapability(registry, "render");

    // 实体可以渲染的条件：类型匹配且有渲染注册表
    return isCanvasEntity && hasRenderRegistry;
  }

  /**
   *
   */
  override configure(config: IRenderConfig): void {
    // 映射通用配置到 Canvas 特定配置
    if (config.enableCache !== undefined) {
      this.config.enableLayerCaching = config.enableCache;
    }
    if (config.maxCacheAge !== undefined) {
      this.config.cacheExpiration = config.maxCacheAge;
    }
    if (config.batchSize !== undefined) {
      this.config.maxOperationsPerFrame = config.batchSize;
    }
    // 新增：支持DPR配置
    if ("enableDPR" in config && typeof config.enableDPR === "boolean") {
      this.config.enableDPR = config.enableDPR;
    }
  }

  /**
   *
   */
  override getPerformanceStats(): RenderPerformanceStats {
    const stats = super.getPerformanceStats();
    const cacheTotal = this.performanceStats.cacheHitCount + this.performanceStats.cacheMissCount;
    const cacheHitRatio = cacheTotal > 0 ? this.performanceStats.cacheHitCount / cacheTotal : 0;

    return {
      ...stats,
      cacheHitRatio: Math.round(cacheHitRatio * 100) / 100,
    };
  }

  /**
   * 添加多个渲染操作
   */
  addRenderOperations(operations: CanvasRenderOperation[]): void {
    this.renderOperations.push(...operations);
  }

  /**
   * 执行渲染操作
   */
  private executeRenderOperations(): void {
    if (!this.ctx || this.renderOperations.length === 0) return;

    // 按优先级排序
    this.renderOperations.sort((a, b) => b.priority - a.priority);

    // 限制每帧的操作数量
    const operationsToExecute = this.renderOperations.splice(0, this.config.maxOperationsPerFrame);

    // 清空画布（考虑DPR）
    this.ctx
      .canvas!.getContext("2d")!
      .clearRect(0, 0, this.ctx.canvas!.width, this.ctx.canvas!.height);

    // 执行渲染操作
    operationsToExecute.forEach((operation) => {
      try {
        // 检查视口剔除
        if (this.config.enableViewportCulling && !this.isInViewport(operation.bounds)) {
          return;
        }

        // 检查缓存
        if (this.config.enableLayerCaching) {
          const cached = this.cache.get(operation.id);
          if (cached) {
            this.recordCacheHit(operation.type);
            this.ctx!.canvas!.getContext("2d")!.putImageData(
              cached,
              operation.bounds.x,
              operation.bounds.y
            );
            return;
          }
          this.recordCacheMiss(operation.type);
        }

        // 执行渲染
        operation.render(this.ctx!.canvas!.getContext("2d")!);

        // 缓存渲染结果
        if (this.config.enableLayerCaching) {
          const imageData = this.ctx!.canvas!.getContext("2d")!.getImageData(
            operation.bounds.x,
            operation.bounds.y,
            operation.bounds.width,
            operation.bounds.height
          );
          this.cache.set(operation.id, imageData, {
            size: operation.bounds.width * operation.bounds.height * 4,
          });
        }
      } catch (error) {
        canvasLogger.error({
          event: CanvasRenderEvent.OperationError,
          message: `Failed to execute render operation for ${operation.id}`,
          emoji: "💥",
          metadata: { operationId: operation.id },
          error,
        });
        this.m.counter("render.error").add(1, { where: "operation" });
      }
    });

    // 如果还有待处理的操作，调度下一帧
    if (this.renderOperations.length > 0) {
      requestAnimationFrame(() => this.executeRenderOperations());
    }
  }

  /**
   * 检查边界是否在视口内
   */
  private isInViewport(bounds: { x: number; y: number; width: number; height: number }): boolean {
    if (!this.ctx) return true;

    // 考虑DPR的视口检查
    const canvasWidth = this.ctx.canvas!.width / this.dpr;
    const canvasHeight = this.ctx.canvas!.height / this.dpr;

    return !(
      bounds.x + bounds.width < 0 ||
      bounds.y + bounds.height < 0 ||
      bounds.x > canvasWidth ||
      bounds.y > canvasHeight
    );
  }

  /**
   * 设置 DPR 处理
   */
  private setupDPR(canvas: HTMLCanvasElement): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    // 保存原始尺寸
    const originalWidth = rect.width;
    const originalHeight = rect.height;

    // 设置实际渲染尺寸（考虑DPR）
    canvas.width = Math.floor(originalWidth * dpr);
    canvas.height = Math.floor(originalHeight * dpr);

    // 设置CSS显示尺寸
    canvas.style.width = `${originalWidth}px`;
    canvas.style.height = `${originalHeight}px`;

    // 设置渲染上下文变换
    this.ctx!.canvas!.getContext("2d")!.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 保存DPR信息供后续使用
    this.dpr = dpr;
  }

  /**
   * 获取当前 DPR
   */
  getDPR(): number {
    return this.dpr;
  }

  /**
   * 检查是否启用了 DPR
   */
  isDPREnabled(): boolean {
    return this.config.enableDPR;
  }

  /**
   * 坐标转换（从CSS坐标转换为Canvas坐标）
   */
  convertToCanvasCoordinates(cssX: number, cssY: number): { x: number; y: number } {
    return {
      x: cssX * this.dpr,
      y: cssY * this.dpr,
    };
  }

  /**
   * 坐标转换（从Canvas坐标转换为CSS坐标）
   */
  convertToCSSCoordinates(canvasX: number, canvasY: number): { x: number; y: number } {
    return {
      x: canvasX / this.dpr,
      y: canvasY / this.dpr,
    };
  }

  /**
   * 清理过期缓存
   */
  cleanupCache(): void {
    this.cache.clear();
    const legacyCache = (this as unknown as { renderCache?: Map<string, ImageData> }).renderCache;
    legacyCache?.clear();
  }

  /**
   *
   */
  dispose(): void {
    this.renderOperations = [];
    this.cache.clear();
    const legacyCache = (this as unknown as { renderCache?: Map<string, ImageData> }).renderCache;
    legacyCache?.clear();

    // 重置性能统计
    this.performanceStats.totalRenderTime = 0;
    this.performanceStats.renderCount = 0;
    this.performanceStats.cacheHitCount = 0;
    this.performanceStats.cacheMissCount = 0;
    this.performanceStats.averageRenderTime = 0;

    this.ctx = undefined;
    this.offscreenCanvas = null;
    if (this.offscreenCtx) {
      this.offscreenCtx = null;
    }

    // Remove observable callbacks
    if (this.ogPendingCb) {
      this.m.observableGauge("operations.pending").removeCallback(this.ogPendingCb);
      this.ogPendingCb = undefined;
    }
    if (this.ogCacheSizeCb) {
      this.m.observableGauge("cache.size").removeCallback(this.ogCacheSizeCb);
      this.ogCacheSizeCb = undefined;
    }
    if (this.ogDprCb) {
      this.m.observableGauge("dpr").removeCallback(this.ogDprCb);
      this.ogDprCb = undefined;
    }
  }
}

export { CanvasRender, type CanvasRenderOperation, type CanvasPerformanceOptimization };
