import type { ScopedMeter } from "../metrics";
import type { IEntity } from "../entity";

/**
 * 渲染 Metrics 记录器接口
 */
export interface RenderMetricsRecorder {
  /**
   * 记录渲染开始，返回结束记录函数
   *
   * @param entityId - 实体 ID
   * @param entityType - 实体类型
   * @returns 结束记录函数，调用时会自动计算耗时并记录 metrics
   *
   * @example
   * ```typescript
   * const endRecord = recorder.recordRenderStart(entity.id, entity.type);
   * try {
   *   // 渲染逻辑
   * } finally {
   *   endRecord();
   * }
   * ```
   */
  recordRenderStart(entityId: string, entityType: string): () => void;

  /**
   * 记录缓存命中
   *
   * @param entityType - 实体类型
   */
  recordCacheHit(entityType: string): void;

  /**
   * 记录缓存未命中
   *
   * @param entityType - 实体类型
   */
  recordCacheMiss(entityType: string): void;

  /**
   * 记录渲染错误
   *
   * @param entityType - 实体类型
   * @param errorType - 错误类型
   */
  recordError(entityType: string, errorType: string): void;

  /**
   * 记录批量渲染
   *
   * @param size - 批量大小
   * @param duration - 耗时（毫秒）
   */
  recordBatch(size: number, duration: number): void;

  /**
   * 记录跳过的渲染
   *
   * @param entityType - 实体类型
   * @param reason - 跳过原因
   */
  recordSkipped(entityType: string, reason: string): void;
}

/**
 * 创建渲染 Metrics 记录器
 *
 * @remarks
 * 提供统一的 metrics 收集接口，简化渲染器中的 metrics 代码。
 * 所有渲染器都应使用此工具来收集性能指标。
 *
 * @param meter - ScopedMeter 实例
 * @returns RenderMetricsRecorder 实例
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
 *       // 渲染逻辑
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
 * 批量渲染辅助函数
 * 自动测量耗时并记录 metrics
 *
 * @param recorder - Metrics 记录器
 * @param entities - 要渲染的实体数组
 * @param renderFn - 渲染函数
 * @returns 渲染结果数组
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
