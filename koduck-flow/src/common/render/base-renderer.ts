import React from "react";
import type { IEntity } from "../entity/types";
import type { IMeta, IRegistryManager } from "../registry/types";
import type { IRender, RenderPerformanceStats, IRenderConfig } from "./types";
import { meter, ScopedMeter } from "../metrics";

/**
 * Abstract base class for all renderers
 * Unified management of performance stats, metrics, registry, and other shared features
 *
 * @remarks
 * This base class extracts features shared by all renderers:
 * - Performance statistics tracking
 * - Metrics collection
 * - Registry management
 * - Basic interface implementation
 *
 * Subclasses only need to implement core rendering logic.
 *
 * @example
 * ```typescript
 * class CustomRender extends BaseRenderer implements ICanvasRenderer {
 *   constructor(registryManager?: IRegistryManager<IEntity, IMeta>) {
 *     super("CustomRender", "canvas", registryManager);
 *   }
 *
 *   getType(): "canvas" {
 *     return "canvas";
 *   }
 *
 *   render(entity: IEntity): void {
 *     const startTime = performance.now();
 *     try {
 *       // Custom rendering logic
 *     } finally {
 *       this.recordRenderMetrics(startTime, entity);
 *     }
 *   }
 *
 *   canRender(entity: IEntity): boolean {
 *     return true;
 *   }
 *
 *   dispose(): void {
 *     // Clean up resources
 *   }
 * }
 * ```
 */
export abstract class BaseRenderer implements Partial<IRender> {
  // Shared properties
  protected registryManager: IRegistryManager<IEntity, IMeta> | undefined;

  /**
   * Performance statistics
   * Records render count, duration, cache hit rate, etc.
   */
  protected performanceStats = {
    totalRenderTime: 0,
    renderCount: 0,
    cacheHitCount: 0,
    cacheMissCount: 0,
    averageRenderTime: 0,
  };

  /**
   * Metrics collector
   * Used to report performance metrics to monitoring system
   */
  protected readonly m: ScopedMeter;

  /**
   * Renderer name
   */
  protected readonly rendererName: string;

  /**
   * Renderer type
   */
  protected readonly rendererType: string;

  /**
   * Create renderer instance
   *
   * @param name - Renderer name (e.g., "CanvasRender")
   * @param type - Renderer type (e.g., "canvas")
   * @param registryManager - Optional registry manager
   */
  constructor(name: string, type: string, registryManager?: IRegistryManager<IEntity, IMeta>) {
    this.rendererName = name;
    this.rendererType = type;
    this.registryManager = registryManager;
    this.m = new ScopedMeter(meter("render"), {
      renderer: type,
      component: name,
    });
  }

  // ==================== Shared method implementations ====================

  /**
   * Get renderer name
   */
  getName(): string {
    return this.rendererName;
  }

  /**
   * Get renderer type
   * Subclasses must implement this method to return the specific type
   */
  abstract getType(): "react" | "canvas" | "svg" | "webgl" | "webgpu" | "ssr";

  /**
   * Set registry manager
   */
  setRegistryManager(registryManager: IRegistryManager<IEntity, IMeta>): void {
    this.registryManager = registryManager;
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): RenderPerformanceStats {
    return {
      ...this.performanceStats,
      name: this.rendererName,
      type: this.rendererType,
    };
  }

  /**
   * Configure renderer (optional implementation)
   */
  configure?(config: IRenderConfig): void;

  // ==================== Protected utility methods ====================

  /**
   * Update performance statistics
   *
   * @param startTime - Render start time (performance.now())
   */
  protected updatePerformanceStats(startTime: number): void {
    const renderTime = performance.now() - startTime;
    this.performanceStats.renderCount++;
    this.performanceStats.totalRenderTime += renderTime;
    this.performanceStats.averageRenderTime =
      this.performanceStats.totalRenderTime / this.performanceStats.renderCount;
  }

  /**
   * Record render metrics
   *
   * @param startTime - Render start time
   * @param entity - Entity being rendered
   * @param additionalAttributes - Additional metrics attributes
   */
  protected recordRenderMetrics(
    startTime: number,
    entity: IEntity,
    additionalAttributes?: Record<string, string | number | boolean>
  ): void {
    const dur = performance.now() - startTime;
    const attributes = {
      entityType: entity.type,
      ...additionalAttributes,
    };

    this.m.counter("render.count").add(1, attributes);
    this.m.histogram("render.duration.ms", { unit: "ms" }).record(dur, attributes);
  }

  /**
   * Record cache hit
   *
   * @param entityType - Entity type
   */
  protected recordCacheHit(entityType: string): void {
    this.performanceStats.cacheHitCount++;
    this.m.counter("cache.hit").add(1, { entityType });
  }

  /**
   * Record cache miss
   *
   * @param entityType - Entity type
   */
  protected recordCacheMiss(entityType: string): void {
    this.performanceStats.cacheMissCount++;
    this.m.counter("cache.miss").add(1, { entityType });
  }

  /**
   * Record render error
   *
   * @param entityType - Entity type
   * @param errorType - Error type
   */
  protected recordRenderError(entityType: string, errorType: string): void {
    this.m.counter("render.error").add(1, { entityType, errorType });
  }

  /**
   * Record batch render metrics
   *
   * @param size - Batch size
   * @param duration - Duration (milliseconds)
   */
  protected recordBatchMetrics(size: number, duration: number): void {
    this.m.histogram("batch.size", { unit: "count" }).record(size);
    this.m.histogram("batch.duration.ms", { unit: "ms" }).record(duration);
    this.m.counter("batch.count").add(1);
  }

  // ==================== Abstract methods - subclasses must implement ====================

  /**
   * Render a single entity
   * Subclasses must implement this method to define specific rendering logic
   */
  abstract render(entity: IEntity): React.ReactElement | string | Promise<string> | null | void;

  /**
   * Check if specified entity can be rendered
   * Subclasses must implement this method to determine rendering capability
   */
  abstract canRender(entity: IEntity): boolean;

  /**
   * Release resources
   * Subclasses must implement this method to clean up resources
   */
  abstract dispose(): void;
}
