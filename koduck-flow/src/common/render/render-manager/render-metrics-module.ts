import type { Attributes } from "../../metrics";
import { meter, ScopedMeter } from "../../metrics";
import { RenderManagerMetrics } from "./render-manager-metrics";
import type { RenderStats } from "./types";

/**
 * Dependencies required by RenderMetricsModule.
 *
 * These are thin accessor functions that the metrics module calls to read
 * runtime state from the RenderManager without creating tight coupling.
 */
export interface RenderMetricsModuleDependencies {
  getQueueSize: () => number;
  getDirtyRegionCount: () => number;
  getDirtyEntityCount: () => number;
  isFullRedrawPending: () => boolean;
  getRenderResultsSize: () => number;
  getRendererNames: () => string[];
  getDefaultRenderer: () => string;
}

/**
 * Metrics helper for the RenderManager.
 *
 * Provides a scoped meter and convenience methods for recording common
 * render-manager metrics by delegating to RenderManagerMetrics.
 */
export class RenderMetricsModule {
  private readonly scope: ScopedMeter;
  private readonly metrics: RenderManagerMetrics;

  /**
   * Create a new RenderMetricsModule.
   *
   * The module creates a scoped meter and forwards the provided accessors
   * to the internal `RenderManagerMetrics` instance.
   *
   * @param deps - Small dependency bag of accessor functions used to read render state for metrics collection.
   */
  constructor(deps: RenderMetricsModuleDependencies) {
    this.scope = new ScopedMeter(meter("render"), {
      component: "RenderManager",
    });

    this.metrics = new RenderManagerMetrics({
      meter: this.scope,
      getQueueSize: deps.getQueueSize,
      getDirtyRegionCount: deps.getDirtyRegionCount,
      getDirtyEntityCount: deps.getDirtyEntityCount,
      isFullRedrawPending: deps.isFullRedrawPending,
      getRenderResultsSize: deps.getRenderResultsSize,
      getRendererNames: deps.getRendererNames,
      getDefaultRenderer: deps.getDefaultRenderer,
    });
  }

  /**
   * Expose the internal, scoped meter used for emitting render metrics.
   *
   * @returns The scoped meter instance used by the module.
   */
  get meter(): ScopedMeter {
    return this.scope;
  }

  /**
   * Record render manager lifecycle events such as `init` and `dispose`.
   *
   * @param event - Lifecycle event name.
   * @param attributes - Optional attributes included with the metric.
   */
  recordLifecycle(event: "init" | "dispose", attributes?: Attributes): void {
    this.metrics.recordLifecycle(event, attributes);
  }

  /**
   * Record a connection-related metric (entity attached or registry attached).
   *
   * @param target - Either `entity` or `registry` describing the connection.
   * @param attributes - Optional attributes for the metric
   */
  recordConnection(target: "entity" | "registry", attributes?: Attributes): void {
    this.metrics.recordConnection(target, attributes);
  }

  /**
   * Record a context operation for metrics (context being set or updated).
   *
   * @param operation - The context operation name: `set` or `update`.
   */
  recordContextOperation(operation: "set" | "update"): void {
    this.metrics.recordContextOperation(operation);
  }

  /**
   * Record when a redraw is scheduled.
   *
   * @param kind - `full` for entire view redraws or `partial` for incremental updates.
   * @param trigger - Optional string describing what triggered the redraw.
   */
  recordRedrawScheduled(kind: "full" | "partial", trigger?: string): void {
    this.metrics.recordRedrawScheduled(kind, trigger);
  }

  /**
   * Record a request for a full redraw and the reason for the request.
   *
   * @param reason - Human-readable reason for requesting a full redraw.
   */
  recordFullRedrawRequest(reason: string): void {
    this.metrics.recordFullRedrawRequest(reason);
  }

  /**
   * Record a change in the event bridge lifecycle.
   *
   * @param event - Attachment state: `attach`, `detach` or `detach_error`.
   */
  recordEventBridge(event: "attach" | "detach" | "detach_error"): void {
    this.metrics.recordEventBridge(event);
  }

  /**
   * Record an error type seen by the render manager.
   *
   * @param type - An identifying string for the error class.
   */
  recordError(type: string): void {
    this.metrics.recordError(type);
  }

  /**
   * Record when a dirty fallback path is used during rendering.
   *
   * @param kind - The kind of fallback performed.
   * @param reason - Optional reason message.
   */
  recordDirtyFallback(kind: string, reason?: string): void {
    this.metrics.recordDirtyFallback(kind, reason);
  }

  /**
   * Record scheduler backpressure state changes.
   *
   * @param event - `triggered` when backpressure starts, `relieved` when it ends.
   * @param attributes - Optional attributes describing the backpressure event.
   */
  recordSchedulerBackpressure(event: "triggered" | "relieved", attributes?: Attributes): void {
    this.metrics.recordSchedulerBackpressure(event, attributes);
  }

  /**
   * Retrieve current render statistics aggregated by the metrics layer.
   *
   * @returns RenderStats summary object.
   */
  getRenderStats(): RenderStats {
    return this.metrics.getRenderStats();
  }

  /**
   * Retrieve aggregated performance statistics for the render manager.
   *
   * @returns An object describing render timings, counts and renderer info.
   */
  getPerformanceStats(): {
    totalRenderTime: number;
    renderCount: number;
    cacheHitCount: number;
    cacheMissCount: number;
    averageRenderTime: number;
    name: string;
    type: string;
    renderers: string[];
    totalRenderers: number;
    defaultRenderer: string;
  } {
    return this.metrics.getPerformanceStats();
  }

  /**
   * Dispose of internal metric resources, flushing any pending state.
   */
  dispose(): void {
    this.metrics.dispose();
  }
}
