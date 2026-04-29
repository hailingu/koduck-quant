import type { ScopedMeter } from "../metrics";
import type { IEntity } from "../entity";

/**
 * Render metrics recorder interface
 */
export interface RenderMetricsRecorder {
  /**
   * Record the start of rendering, returning an end record function
   *
   * @param entityId - Entity ID
   * @param entityType - Entity type
   * @returns End record function that automatically calculates duration and records metrics when called
   *
   * @example
   * ```typescript
   * const endRecord = recorder.recordRenderStart(entity.id, entity.type);
   * try {
   *   // Rendering logic
   * } finally {
   *   endRecord();
   * }
   * ```
   */
  recordRenderStart(entityId: string, entityType: string): () => void;

  /**
   * Record a cache hit
   *
   * @param entityType - Entity type
   */
  recordCacheHit(entityType: string): void;

  /**
   * Record a cache miss
   *
   * @param entityType - Entity type
   */
  recordCacheMiss(entityType: string): void;

  /**
   * Record a rendering error
   *
   * @param entityType - Entity type
   * @param errorType - Error type
   */
  recordError(entityType: string, errorType: string): void;

  /**
   * Record batch rendering
   *
   * @param size - Batch size
   * @param duration - Duration (milliseconds)
   */
  recordBatch(size: number, duration: number): void;

  /**
   * Record a skipped render
   *
   * @param entityType - Entity type
   * @param reason - Reason for skipping
   */
  recordSkipped(entityType: string, reason: string): void;
}

/**
 * Create a render metrics recorder
 *
 * @remarks
 * Provides a unified metrics collection interface to simplify metrics code in renderers.
 * All renderers should use this utility to collect performance metrics.
 *
 * @param meter - ScopedMeter instance
 * @returns RenderMetricsRecorder instance
 *
 * @example
 * ```typescript
 * class MyRenderer extends BaseRenderer {
 *   private readonly metricsRecorder: RenderMetricsRecorder;
 *
 *   constructor() {
 *     super("MyRenderer", "custom");
 *     this.metricsRecorder = createRenderMetricsRecorder(this.m);
 *   }
 *
 *   render(entity: IEntity): void {
 *     const endRecord = this.metricsRecorder.recordRenderStart(entity.id, entity.type);
 *     try {
 *       // Rendering logic
 *     } finally {
 *       endRecord();
 *     }
 *   }
 * }
 * ```
 */
export function createRenderMetricsRecorder(meter: ScopedMeter): RenderMetricsRecorder {
  return {
    recordRenderStart(_entityId: string, entityType: string) {
      const startTime = performance.now();

      return () => {
        const duration = performance.now() - startTime;
        meter.counter("render.count").add(1, { entityType });
        meter.histogram("render.duration.ms", { unit: "ms" }).record(duration, { entityType });
      };
    },

    recordCacheHit(entityType: string) {
      meter.counter("cache.hit").add(1, { entityType });
    },

    recordCacheMiss(entityType: string) {
      meter.counter("cache.miss").add(1, { entityType });
    },

    recordError(entityType: string, errorType: string) {
      meter.counter("render.error").add(1, { entityType, errorType });
    },

    recordBatch(size: number, duration: number) {
      meter.histogram("batch.size", { unit: "count" }).record(size);
      meter.histogram("batch.duration.ms", { unit: "ms" }).record(duration);
      meter.counter("batch.count").add(1);
    },

    recordSkipped(entityType: string, reason: string) {
      meter.counter("render.skipped").add(1, { entityType, reason });
    },
  };
}

/**
 * Batch rendering helper function
 * Automatically measures duration and records metrics
 *
 * @param recorder - Metrics recorder
 * @param entities - Array of entities to render
 * @param renderFn - Render function
 * @returns Array of rendering results
 *
 * @example
 * ```typescript
 * const results = batchRenderWithMetrics(
 *   this.metricsRecorder,
 *   entities,
 *   (entity) => this.renderSingleEntity(entity)
 * );
 * ```
 */
export function batchRenderWithMetrics<T>(
  recorder: RenderMetricsRecorder,
  entities: IEntity[],
  renderFn: (entity: IEntity) => T
): T[] {
  const startTime = performance.now();
  const results = entities.map((entity) => renderFn(entity));
  const duration = performance.now() - startTime;

  recorder.recordBatch(entities.length, duration);

  return results;
}
