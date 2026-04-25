/**
 * Worker Pool Metrics and Observability Module
 *
 * Bridges WorkerPool events with structured metrics and logging to provide
 * comprehensive observability for worker pool performance, health, and behavior.
 *
 * ## Features
 *
 * **Metrics Collection**:
 * - Real-time gauges: active workers, queue size, task counts
 * - Event counters: task completion, failures, fallback, worker crashes
 * - Scoped measurement with pool identification
 * - Error code tracking for failure classification
 *
 * **Observability Integration**:
 * - OpenTelemetry Meter integration via ScopedMeter
 * - Structured logging for critical events
 * - Context-aware logging with pool/worker identifiers
 * - Error metadata extraction and enrichment
 *
 * **Event Handling**:
 * - POOL_STATS_UPDATED: Synchronize gauge metrics
 * - TASK_COMPLETED: Increment completion counter
 * - TASK_FAILED: Increment failure counter with error code
 * - TASK_FALLBACK: Log fallback execution with attempt count
 * - WORKER_UNAVAILABLE: Log crash and increment counter
 * - WORKER_RECOVERY_SCHEDULED: Log recovery scheduling
 * - WORKER_RECOVERED: Log recovery completion
 *
 * **Usage Pattern**:
 * Create adapter with pool instance, optionally configure scope/attributes,
 * then metrics/logging are automatically collected. Call dispose() on shutdown.
 *
 * @module WorkerPoolMetrics
 * @see {@link WorkerPoolMetricsAdapter}
 * @see {@link ScopedMeter}
 * @see {@link logger}
 *
 * @example
 * ```typescript
 * // Create metrics adapter
 * const adapter = new WorkerPoolMetricsAdapter(pool, {
 *   poolId: 'primary-compute',
 *   scope: 'worker-pool-metrics',
 *   attributes: {
 *     environment: 'production',
 *     version: '1.0.0'
 *   }
 * });
 *
 * // Metrics are automatically collected from pool events:
 * // - pool.active_workers gauge: current active workers
 * // - pool.queue.size gauge: tasks waiting in queue
 * // - pool.tasks.completed_total gauge: cumulative successes
 * // - pool.tasks.failed_total gauge: cumulative failures
 * // - pool.task.completed.count counter: completion events
 * // - pool.task.failed.count counter: failure events
 * // - pool.task.fallback.count counter: fallback executions
 * // - pool.worker.crash.count counter: worker crashes
 * // - pool.worker.recovered.count counter: worker recoveries
 *
 * // Cleanup on shutdown
 * adapter.dispose();
 * ```
 */

import { ScopedMeter, meter, type Attributes } from "../metrics";
import { logger } from "../logger";
import type { PoolStats, WorkerPool, WorkerPoolEvent, WorkerPoolEventListener } from "./types";
import { WorkerPoolError } from "./types";
import type { LoggerContextAdapter } from "../logger";

/**
 * Configuration options for WorkerPoolMetricsAdapter
 *
 * Allows customization of metrics scope, pool identification, and logging.
 *
 * @example
 * ```typescript
 * const options: WorkerPoolMetricsOptions = {
 *   poolId: 'worker-pool-1',
 *   scope: 'custom-worker-metrics',
 *   attributes: {
 *     region: 'us-east-1',
 *     tier: 'premium'
 *   },
 *   loggerTag: 'pool:worker-compute'
 * };
 * ```
 */
export interface WorkerPoolMetricsOptions {
  /**
   * Pool instance identifier for metrics differentiation
   * Default: 'default'
   * Used as 'poolId' attribute in all metrics
   */
  poolId?: string;

  /**
   * Additional attributes merged with component/poolId
   * Useful for adding environment, region, or version labels
   * Default: none
   */
  attributes?: Attributes;

  /**
   * Meter scope name for metrics collection
   * Default: 'worker-pool'
   * Groups metrics under this scope in OpenTelemetry
   */
  scope?: string;

  /**
   * Custom logger tag for filtering in log system
   * Default: 'worker-pool:{poolId}'
   * Used in structured logging context
   */
  loggerTag?: string;
}

/**
 * WorkerPool Metrics Adapter
 *
 * Converts WorkerPool event stream to metrics and structured logs
 * to satisfy observability requirements (NFR 3.1.1).
 *
 * This adapter:
 * 1. Listens to pool lifecycle events
 * 2. Updates OpenTelemetry gauges and counters
 * 3. Emits structured logs for significant events
 * 4. Tracks error codes and failure reasons
 * 5. Maintains pool statistics snapshots
 *
 * @implements {WorkerPoolEventListener}
 *
 * @example
 * ```typescript
 * // Create and configure adapter
 * const adapter = new WorkerPoolMetricsAdapter(pool, {
 *   poolId: 'primary',
 *   scope: 'application-metrics',
 *   loggerTag: 'pool:primary'
 * });
 *
 * // Metrics automatically collected from:
 * // - Task execution: completion, failures, fallback invocations
 * // - Worker state: crashes, recovery attempts, recovery success
 * // - Queue state: depth changes, overflow conditions
 *
 * // Cleanup when shutting down
 * adapter.dispose();
 * ```
 */
export class WorkerPoolMetricsAdapter {
  /** Pool instance being monitored */
  private readonly pool: WorkerPool;

  /** Scoped meter for metric emission */
  private readonly scoped: ScopedMeter;

  /** Event listener callback registered with pool */
  private readonly listener: WorkerPoolEventListener;

  /** Structured logger with context */
  private readonly log: LoggerContextAdapter;

  /** Active workers gauge metric */
  private readonly activeGauge;

  /** Queue size gauge metric */
  private readonly queueGauge;

  /** Cumulative completed tasks gauge */
  private readonly completedGauge;

  /** Cumulative failed tasks gauge */
  private readonly failedGauge;

  /** Task completion event counter */
  private readonly completedCounter;

  /** Task failure event counter */
  private readonly failedCounter;

  /** Fallback execution counter */
  private readonly fallbackCounter;

  /** Worker crash counter */
  private readonly crashCounter;

  /** Worker recovery counter */
  private readonly recoveryCounter;

  /** Disposal flag to prevent operations after dispose */
  private disposed = false;

  /** Last stats snapshot for delta calculation if needed */
  private lastStats: PoolStats = {
    totalWorkers: 0,
    activeWorkers: 0,
    queueSize: 0,
    completedTasks: 0,
    failedTasks: 0,
  };

  /**
   * Construct metrics adapter for worker pool
   *
   * Creates gauge and counter metrics, registers event listener with pool,
   * and initializes structured logger with pool context.
   *
   * Metrics created:
   * - Gauges: active_workers, queue.size, tasks.completed_total, tasks.failed_total
   * - Counters: task.completed.count, task.failed.count, task.fallback.count,
   *   worker.crash.count, worker.recovered.count
   *
   * @param pool - WorkerPool instance to monitor
   * @param options - Configuration for metrics and logging
   *
   * @example
   * ```typescript
   * const adapter = new WorkerPoolMetricsAdapter(pool, {
   *   poolId: 'compute-pool',
   *   scope: 'my-app-metrics',
   *   attributes: {
   *     env: 'production',
   *     region: 'us-west-2'
   *   },
   *   loggerTag: 'pool:compute'
   * });
   * ```
   */
  constructor(pool: WorkerPool, options?: WorkerPoolMetricsOptions) {
    this.pool = pool;
    const poolId = options?.poolId ?? "default";
    const attributes: Attributes = {
      component: "worker-pool",
      poolId,
      ...options?.attributes,
    };

    this.scoped = new ScopedMeter(meter(options?.scope ?? "worker-pool"), attributes);
    this.log = logger.withContext({ tag: options?.loggerTag ?? `worker-pool:${poolId}` });

    this.activeGauge = this.scoped.gauge("pool.active_workers", {
      description: "Current number of active workers",
      unit: "count",
    });
    this.queueGauge = this.scoped.gauge("pool.queue.size", {
      description: "Number of tasks waiting in queue",
      unit: "count",
    });
    this.completedGauge = this.scoped.gauge("pool.tasks.completed_total", {
      description: "Cumulative number of completed tasks",
      unit: "count",
    });
    this.failedGauge = this.scoped.gauge("pool.tasks.failed_total", {
      description: "Cumulative number of failed tasks",
      unit: "count",
    });

    this.completedCounter = this.scoped.counter("pool.task.completed.count", {
      description: "Task completion event count",
    });
    this.failedCounter = this.scoped.counter("pool.task.failed.count", {
      description: "Task failure event count",
    });
    this.fallbackCounter = this.scoped.counter("pool.task.fallback.count", {
      description: "Main thread fallback execution count",
    });
    this.crashCounter = this.scoped.counter("pool.worker.crash.count", {
      description: "Worker crash count",
    });
    this.recoveryCounter = this.scoped.counter("pool.worker.recovered.count", {
      description: "Worker recovery success count",
    });

    try {
      this.lastStats = pool.getStats();
      this.applyStats(this.lastStats);
    } catch {
      // If pool not ready yet, keep default zero state
    }

    this.listener = (event) => this.handleEvent(event);
    this.pool.addEventListener(this.listener);
  }

  /**
   * Dispose and cleanup adapter resources
   *
   * Removes event listener from pool. Safe to call multiple times (idempotent).
   * After disposal, no more metrics or logs will be emitted.
   *
   * @example
   * ```typescript
   * // On application shutdown
   * adapter.dispose();
   * ```
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.pool.removeEventListener(this.listener);
  }

  /**
   * Handle pool event and emit metrics/logs
   *
   * Event handler called for each pool event. Updates metrics based on event type:
   * - POOL_STATS_UPDATED: sync gauge metrics
   * - TASK_COMPLETED: increment completion counter
   * - TASK_FAILED: increment failure counter, extract error code
   * - TASK_FALLBACK: increment fallback counter, emit warning log
   * - WORKER_UNAVAILABLE: increment crash counter, emit warning log
   * - WORKER_RECOVERY_SCHEDULED: emit info log with delay
   * - WORKER_RECOVERED: increment recovery counter, emit info log
   *
   * @private
   * @param event - WorkerPool event
   */
  private handleEvent(event: WorkerPoolEvent): void {
    if (this.disposed) {
      return;
    }

    switch (event.type) {
      case "POOL_STATS_UPDATED": {
        this.applyStats(event.stats);
        break;
      }
      case "TASK_COMPLETED": {
        this.completedCounter.add(1, { taskId: event.taskId });
        break;
      }
      case "TASK_FAILED": {
        this.failedCounter.add(1, this.extractErrorAttributes(event.error));
        break;
      }
      case "TASK_FALLBACK": {
        this.fallbackCounter.add(1, { attempts: event.attempts });
        this.log.warn({
          message: "Worker task enters main thread fallback execution",
          event: "worker_pool.fallback",
          metadata: { taskId: event.taskId, attempts: event.attempts },
          error: event.error,
        });
        break;
      }
      case "WORKER_UNAVAILABLE": {
        this.crashCounter.add(1, { workerId: event.workerId });
        this.log.warn({
          message: "Worker crash detected, awaiting recovery",
          event: "worker_pool.crash",
          metadata: { workerId: event.workerId },
          error: event.error,
        });
        break;
      }
      case "WORKER_RECOVERY_SCHEDULED": {
        this.log.info({
          message: "Worker recovery task scheduled",
          event: "worker_pool.recovery_scheduled",
          metadata: { workerId: event.workerId, delay: event.delay },
        });
        break;
      }
      case "WORKER_RECOVERED": {
        this.recoveryCounter.add(1, { workerId: event.workerId });
        this.log.info({
          message: "Worker restored to service",
          event: "worker_pool.recovered",
          metadata: { workerId: event.workerId },
        });
        break;
      }
      default:
        break;
    }
  }

  /**
   * Apply statistics snapshot to gauges
   *
   * Updates all gauge metrics to match current pool state.
   * Called on POOL_STATS_UPDATED event or initialization.
   *
   * @private
   * @param stats - Current pool statistics
   */
  private applyStats(stats: PoolStats): void {
    this.activeGauge.set(stats.activeWorkers);
    this.queueGauge.set(stats.queueSize);
    this.completedGauge.set(stats.completedTasks);
    this.failedGauge.set(stats.failedTasks);

    this.lastStats = stats;
  }

  /**
   * Extract error attributes for metrics
   *
   * If error is WorkerPoolError, extracts error code as attribute
   * for classification in metrics system.
   *
   * @private
   * @param error - Error to extract attributes from
   * @returns Attributes with errorCode if applicable, undefined otherwise
   */
  private extractErrorAttributes(error: Error): Attributes | undefined {
    if (error instanceof WorkerPoolError && typeof error.code === "string") {
      return { errorCode: error.code } satisfies Attributes;
    }
    return undefined;
  }
}
