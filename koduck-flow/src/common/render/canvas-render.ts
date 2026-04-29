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
 * Canvas render operation interface
 */
interface CanvasRenderOperation {
  type: string;
  id: string;
  bounds: { x: number; y: number; width: number; height: number };
  render: (ctx: CanvasRenderingContext2D) => void;
  priority: number;
}

/**
 * Canvas performance optimization configuration
 */
interface CanvasPerformanceOptimization {
  enableOffscreenRendering: boolean;
  enableLayerCaching: boolean;
  enableViewportCulling: boolean;
  enableDPR: boolean; // New: DPR handling switch
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

  // Performance configuration
  private readonly config: CanvasPerformanceOptimization = {
    enableOffscreenRendering: true,
    enableLayerCaching: true,
    enableViewportCulling: true,
    enableDPR: true, // New: enable DPR handling by default
    cacheExpiration: 5 * 60 * 1000, // 5 minutes
    maxOperationsPerFrame: 100,
  };

  // Offscreen Canvas (for optimization)
  private offscreenCanvas: OffscreenCanvas | null = null;
  // Reserved for future offscreen canvas optimization - not currently used
  private offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;

  // DPR-related properties
  private dpr: number = 1; // Current device pixel ratio

  // Cache manager for rendered entity results
  private readonly cache!: RenderCacheManager<string, ImageData>;

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
    // If canvas is updated, reinitialize
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
   * Get Canvas 2D context
   */
  private getCanvas2DContext(): CanvasRenderingContext2D | null {
    if (!this.ctx?.canvas) {
      return null;
    }
    return this.ctx.canvas.getContext("2d");
  }

  /**
   * Initialize Canvas
   */
  private initializeCanvas(ctx: IRenderContext): void {
    // New: DPR handling
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

      // Try to directly call entity render method as fallback
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
      // Render using member variable ctx directly
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
      // Use base class metrics recording method
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

    // Batch render entities using registry.render method
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

    // Use base class batch metrics recording
    const renderTime = performance.now() - startTime;
    this.updatePerformanceStats(startTime);
    this.recordBatchMetrics(entities.length, renderTime);
  }

  /**
   *
   */
  canRender(entity: IEntity): boolean {
    // Check if render context exists
    if (!this.ctx) {
      return false;
    }

    // Check if entity type ends with "canvas"
    const isCanvasEntity = entity.type?.endsWith("canvas");

    // Check if a render registry is available
    const registry = this.registryManager?.getRegistryForEntity(entity) as ICapabilityAwareRegistry<
      IEntity,
      IMeta
    >;
    const hasRenderRegistry = registry && RegistryCapabilityUtils.hasCapability(registry, "render");

    // Condition for entity renderability: type matches and has render registry
    return isCanvasEntity && hasRenderRegistry;
  }

  /**
   *
   */
  override configure(config: IRenderConfig): void {
    // Map generic config to Canvas-specific config
    if (config.enableCache !== undefined) {
      this.config.enableLayerCaching = config.enableCache;
    }
    if (config.maxCacheAge !== undefined) {
      this.config.cacheExpiration = config.maxCacheAge;
    }
    if (config.batchSize !== undefined) {
      this.config.maxOperationsPerFrame = config.batchSize;
    }
    // New: support DPR config
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
   * Add multiple render operations
   */
  addRenderOperations(operations: CanvasRenderOperation[]): void {
    this.renderOperations.push(...operations);
  }

  /**
   * Execute render operations
   */
  private executeRenderOperations(): void {
    if (!this.ctx || this.renderOperations.length === 0) return;

    // Sort by priority
    this.renderOperations.sort((a, b) => b.priority - a.priority);

    // Limit operations per frame
    const operationsToExecute = this.renderOperations.splice(0, this.config.maxOperationsPerFrame);

    // Clear canvas (accounting for DPR)
    this.ctx
      .canvas!.getContext("2d")!
      .clearRect(0, 0, this.ctx.canvas!.width, this.ctx.canvas!.height);

    // Execute render operations
    operationsToExecute.forEach((operation) => {
      try {
        // Check viewport culling
        if (this.config.enableViewportCulling && !this.isInViewport(operation.bounds)) {
          return;
        }

        // Check cache
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

        // Execute rendering
        operation.render(this.ctx!.canvas!.getContext("2d")!);

        // Cache render result
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

    // If there are pending operations, schedule next frame
    if (this.renderOperations.length > 0) {
      requestAnimationFrame(() => this.executeRenderOperations());
    }
  }

  /**
   * Check if bounds are within viewport
   */
  private isInViewport(bounds: { x: number; y: number; width: number; height: number }): boolean {
    if (!this.ctx) return true;

    // Viewport check accounting for DPR
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
   * Setup DPR handling
   */
  private setupDPR(canvas: HTMLCanvasElement): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    // Save original dimensions
    const originalWidth = rect.width;
    const originalHeight = rect.height;

    // Set actual render dimensions (accounting for DPR)
    canvas.width = Math.floor(originalWidth * dpr);
    canvas.height = Math.floor(originalHeight * dpr);

    // Set CSS display dimensions
    canvas.style.width = `${originalWidth}px`;
    canvas.style.height = `${originalHeight}px`;

    // Set render context transform
    this.ctx!.canvas!.getContext("2d")!.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Save DPR info for later use
    this.dpr = dpr;
  }

  /**
   * Get current DPR
   */
  getDPR(): number {
    return this.dpr;
  }

  /**
   * Check if DPR is enabled
   */
  isDPREnabled(): boolean {
    return this.config.enableDPR;
  }

  /**
   * Coordinate conversion (from CSS coordinates to Canvas coordinates)
   */
  convertToCanvasCoordinates(cssX: number, cssY: number): { x: number; y: number } {
    return {
      x: cssX * this.dpr,
      y: cssY * this.dpr,
    };
  }

  /**
   * Coordinate conversion (from Canvas coordinates to CSS coordinates)
   */
  convertToCSSCoordinates(canvasX: number, canvasY: number): { x: number; y: number } {
    return {
      x: canvasX / this.dpr,
      y: canvasY / this.dpr,
    };
  }

  /**
   * Clean up expired cache
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

    // Reset performance statistics
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
